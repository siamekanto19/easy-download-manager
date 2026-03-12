package downloader

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	defaultBufferSize    = 32 * 1024 // 32 KB
	progressInterval     = 250 * time.Millisecond
	defaultTimeout       = 30 * time.Second
	maxRedirects         = 10
	speedWindowSize      = 5 // seconds for speed averaging
)

// HTTPDownloader implements the Downloader interface using HTTP/HTTPS.
type HTTPDownloader struct {
	client *http.Client
}

// NewHTTPDownloader creates a new HTTP-based downloader.
func NewHTTPDownloader() *HTTPDownloader {
	return &HTTPDownloader{
		client: &http.Client{
			Timeout: 0, // no overall timeout, we use context for cancellation
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= maxRedirects {
					return fmt.Errorf("too many redirects (%d)", maxRedirects)
				}
				return nil
			},
		},
	}
}

// Download performs the download. Blocks until done/cancelled/errored.
func (d *HTTPDownloader) Download(ctx context.Context, req DownloadRequest, progressCb ProgressCallback) DownloadResult {
	// If multi-connection requested and > 1, delegate to segmented downloader
	if req.Connections > 1 {
		seg := &SegmentedDownloader{client: d.client}
		return seg.Download(ctx, req, progressCb)
	}
	startedAt := time.Now()
	result := DownloadResult{
		StartedAt: startedAt,
	}

	// Validate URL
	parsedURL, err := url.Parse(req.URL)
	if err != nil {
		result.Error = fmt.Errorf("invalid URL: %w", err)
		return result
	}
	result.SourceHost = parsedURL.Hostname()

	// Ensure output directory exists
	if err := os.MkdirAll(req.OutputDirectory, 0755); err != nil {
		result.Error = fmt.Errorf("create output directory: %w", err)
		return result
	}

	// Probe for resume support and get metadata
	totalBytes, canResume, err := d.Probe(ctx, req.URL)
	if err != nil {
		result.Error = fmt.Errorf("probe failed: %w", err)
		return result
	}
	result.CanResume = canResume

	// Check for existing partial file
	var startByte int64
	tempPath := req.TempPath
	if tempPath == "" {
		tempPath = filepath.Join(req.OutputDirectory, "."+SanitizeFileName(req.FileName)+".edm.partial")
	}
	result.TempPath = tempPath

	if canResume {
		if info, err := os.Stat(tempPath); err == nil {
			startByte = info.Size()
			if totalBytes > 0 && startByte >= totalBytes {
				// File is already complete
				startByte = 0
			}
		}
	}

	// Build the request
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, req.URL, nil)
	if err != nil {
		result.Error = fmt.Errorf("create request: %w", err)
		return result
	}
	httpReq.Header.Set("User-Agent", "EasyDownloadManager/0.1")

	if startByte > 0 && canResume {
		httpReq.Header.Set("Range", fmt.Sprintf("bytes=%d-", startByte))
		result.Resumable = true
	}

	// Execute request
	resp, err := d.client.Do(httpReq)
	if err != nil {
		result.Error = fmt.Errorf("request failed: %w", err)
		return result
	}
	defer resp.Body.Close()

	// Handle response status
	switch resp.StatusCode {
	case http.StatusOK:
		// Full download (server ignored or doesn't support range)
		startByte = 0
		if ct := resp.Header.Get("Content-Length"); ct != "" {
			if v, err := strconv.ParseInt(ct, 10, 64); err == nil {
				totalBytes = v
			}
		}
	case http.StatusPartialContent:
		// Resume successful
		if totalBytes == 0 {
			if cr := resp.Header.Get("Content-Range"); cr != "" {
				totalBytes = ParseContentRangeTotal(cr)
			}
		}
	case http.StatusRequestedRangeNotSatisfiable:
		// File might be complete or server doesn't support our range
		startByte = 0
		result.Resumable = false
	default:
		result.Error = fmt.Errorf("server returned %d %s", resp.StatusCode, resp.Status)
		return result
	}

	result.TotalBytes = totalBytes

	// Infer file name — always try to get the best name from HTTP headers
	fileName := InferFileName(resp, parsedURL)
	// Only use the pre-set name if InferFileName returns a generic "download"
	if req.FileName != "" && (fileName == "download" || fileName == req.FileName) {
		fileName = req.FileName
	}
	// Ensure we have an extension — try Content-Type if missing
	if filepath.Ext(fileName) == "" {
		fileName = addExtFromContentType(fileName, resp)
	}
	result.FileName = fileName

	// Detect MIME type
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		result.MimeType, _, _ = mime.ParseMediaType(ct)
	}

	// Determine target path
	targetPath := filepath.Join(req.OutputDirectory, fileName)
	result.TargetPath = targetPath

	// Open temp file for writing
	var file *os.File
	if startByte > 0 {
		file, err = os.OpenFile(tempPath, os.O_WRONLY|os.O_APPEND, 0644)
	} else {
		file, err = os.Create(tempPath)
	}
	if err != nil {
		result.Error = fmt.Errorf("open temp file: %w", err)
		return result
	}
	defer file.Close()

	// Download with progress tracking
	downloaded := startByte
	buf := make([]byte, defaultBufferSize)
	lastProgressReport := time.Now()
	speedSamples := make([]SpeedSample, 0, speedWindowSize*4)

	for {
		// Check for cancellation
		select {
		case <-ctx.Done():
			result.Error = ctx.Err()
			return result
		default:
		}

		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := file.Write(buf[:n]); writeErr != nil {
				result.Error = fmt.Errorf("write to disk: %w", writeErr)
				return result
			}
			downloaded += int64(n)

			// Report progress
			now := time.Now()
			speedSamples = append(speedSamples, SpeedSample{Bytes: int64(n), At: now})

			if now.Sub(lastProgressReport) >= progressInterval && progressCb != nil {
				speed := CalculateSpeed(speedSamples, now)
				var eta float64
				var progress float64
				if totalBytes > 0 {
					progress = float64(downloaded) / float64(totalBytes) * 100
					if speed > 0 {
						remaining := totalBytes - downloaded
						eta = float64(remaining) / float64(speed)
					}
				}

				progressCb(ProgressUpdate{
					DownloadedBytes:  downloaded,
					TotalBytes:       totalBytes,
					ProgressPercent:  progress,
					SpeedBytesPerSec: speed,
					ETASeconds:       eta,
				})
				lastProgressReport = now
			}
		}

		if readErr != nil {
			if readErr == io.EOF {
				break // Download complete
			}
			result.Error = fmt.Errorf("read from network: %w", readErr)
			return result
		}
	}

	// Sync and close the temp file before moving
	if err := file.Sync(); err != nil {
		result.Error = fmt.Errorf("sync file: %w", err)
		return result
	}
	file.Close()

	// Move temp file to target path
	if err := os.Rename(tempPath, targetPath); err != nil {
		result.Error = fmt.Errorf("move file to target: %w", err)
		return result
	}

	result.TotalBytes = downloaded
	result.CompletedAt = time.Now()
	return result
}

// probe does a HEAD request to check for resume support and total size.
// Probe does a HEAD request to check for resume support and total size.
func (d *HTTPDownloader) Probe(ctx context.Context, rawURL string) (totalBytes int64, canResume bool, err error) {
	probeCtx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(probeCtx, http.MethodHead, rawURL, nil)
	if err != nil {
		return 0, false, err
	}
	req.Header.Set("User-Agent", "EasyDownloadManager/0.1")

	resp, err := d.client.Do(req)
	if err != nil {
		// HEAD failed, try to download anyway
		return 0, false, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, false, nil
	}

	// Check Accept-Ranges header
	acceptRanges := resp.Header.Get("Accept-Ranges")
	canResume = strings.EqualFold(acceptRanges, "bytes")

	// Get content length
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		if v, err := strconv.ParseInt(cl, 10, 64); err == nil {
			totalBytes = v
		}
	}

	return totalBytes, canResume, nil
}

// ── Helpers ──

// SpeedSample records bytes downloaded at a specific time.
type SpeedSample struct {
	Bytes int64
	At    time.Time
}

// CalculateSpeed computes download speed from recent samples.
func CalculateSpeed(samples []SpeedSample, now time.Time) int64 {
	cutoff := now.Add(-time.Duration(speedWindowSize) * time.Second)
	var totalBytes int64
	var validSamples int
	for _, s := range samples {
		if s.At.After(cutoff) {
			totalBytes += s.Bytes
			validSamples++
		}
	}
	if validSamples == 0 {
		return 0
	}
	elapsed := now.Sub(samples[0].At).Seconds()
	if elapsed < 0.1 {
		elapsed = 0.1
	}
	if elapsed > float64(speedWindowSize) {
		elapsed = float64(speedWindowSize)
	}
	return int64(float64(totalBytes) / elapsed)
}

// InferFileName extracts a filename from the response or URL.
func InferFileName(resp *http.Response, parsedURL *url.URL) string {
	// Try Content-Disposition header first
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		_, params, err := mime.ParseMediaType(cd)
		if err == nil {
			if fn, ok := params["filename"]; ok && fn != "" {
				return SanitizeFileName(fn)
			}
		}
	}

	// Fall back to URL path
	path := parsedURL.Path
	if path == "" || path == "/" {
		return addExtFromContentType("download", resp)
	}
	name := filepath.Base(path)
	if name == "." || name == "/" {
		return addExtFromContentType("download", resp)
	}

	// URL-decode the filename
	if decoded, err := url.PathUnescape(name); err == nil {
		name = decoded
	}
	name = SanitizeFileName(name)

	// If the name has no extension, try to add one from Content-Type
	if filepath.Ext(name) == "" {
		name = addExtFromContentType(name, resp)
	}
	return name
}

// addExtFromContentType appends a file extension based on the Content-Type header.
func addExtFromContentType(name string, resp *http.Response) string {
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		return name
	}
	mediaType, _, _ := mime.ParseMediaType(ct)
	if mediaType == "" || mediaType == "application/octet-stream" {
		return name
	}
	exts, _ := mime.ExtensionsByType(mediaType)
	if len(exts) > 0 {
		// Prefer common extensions
		best := exts[0]
		for _, ext := range exts {
			switch ext {
			case ".zip", ".pdf", ".mp4", ".mp3", ".jpg", ".png", ".gif",
				".tar", ".gz", ".dmg", ".exe", ".iso", ".avi", ".mkv",
				".doc", ".docx", ".xls", ".xlsx", ".ppt", ".csv":
				best = ext
			}
		}
		return name + best
	}
	return name
}

// SanitizeFileName removes or replaces problematic file system characters.
func SanitizeFileName(name string) string {
	// Remove or replace characters that are problematic in file systems
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "",
	)
	name = replacer.Replace(name)
	if name == "" {
		return "download"
	}
	return name
}

// ParseContentRangeTotal extracts total size from a Content-Range header.
func ParseContentRangeTotal(cr string) int64 {
	// Format: bytes 0-999/5000
	parts := strings.Split(cr, "/")
	if len(parts) != 2 {
		return 0
	}
	total := strings.TrimSpace(parts[1])
	if total == "*" {
		return 0
	}
	v, err := strconv.ParseInt(total, 10, 64)
	if err != nil {
		return 0
	}
	return v
}
