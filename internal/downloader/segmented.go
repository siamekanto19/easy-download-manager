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
	"sync"
	"sync/atomic"
	"time"
)

const (
	minSegmentSize = 1 * 1024 * 1024 // 1 MB — below this, don't segment
)

// SegmentedDownloader downloads files using multiple parallel connections.
// Each connection downloads a byte-range segment, then segments are merged.
type SegmentedDownloader struct {
	client *http.Client
}

// segment tracks one byte-range chunk.
type segment struct {
	index     int
	startByte int64
	endByte   int64
	tempPath  string
	downloaded atomic.Int64
}

// Download splits the file into segments and downloads them in parallel.
// Falls back to single-connection when the server doesn't support ranges
// or the file is too small.
func (d *SegmentedDownloader) Download(ctx context.Context, req DownloadRequest, progressCb ProgressCallback) DownloadResult {
	startedAt := time.Now()
	result := DownloadResult{StartedAt: startedAt}

	// Parse URL
	parsedURL, err := url.Parse(req.URL)
	if err != nil {
		result.Error = fmt.Errorf("invalid URL: %w", err)
		return result
	}
	result.SourceHost = parsedURL.Hostname()

	// Ensure output directory
	if err := os.MkdirAll(req.OutputDirectory, 0755); err != nil {
		result.Error = fmt.Errorf("create output directory: %w", err)
		return result
	}

	// Probe for range support and total size
	probe := &HTTPDownloader{client: d.client}
	totalBytes, canResume, err := probe.Probe(ctx, req.URL)
	if err != nil {
		result.Error = fmt.Errorf("probe failed: %w", err)
		return result
	}
	result.CanResume = canResume

	connections := req.Connections
	if connections < 1 {
		connections = 1
	}

	// Fall back to single connection if:
	// - Server doesn't support range requests
	// - File size unknown
	// - File too small to benefit from segmenting
	if !canResume || totalBytes <= 0 || totalBytes < int64(connections)*minSegmentSize {
		single := &HTTPDownloader{client: d.client}
		singleReq := req
		singleReq.Connections = 1
		return single.Download(ctx, singleReq, progressCb)
	}

	result.TotalBytes = totalBytes

	// Always try to infer filename from HEAD response (Content-Disposition, Content-Type)
	fileName := d.inferFileNameFromHead(ctx, req.URL, parsedURL)
	// Only use pre-set name if HEAD returned a generic "download"
	if req.FileName != "" && (fileName == "download" || fileName == req.FileName) {
		fileName = req.FileName
	}
	// Ensure extension — if still missing, try to add from MIME type
	if filepath.Ext(fileName) == "" {
		fileName = d.addExtFromHeadResponse(ctx, req.URL, fileName)
	}
	result.FileName = fileName

	// Determine target path
	targetPath := filepath.Join(req.OutputDirectory, fileName)
	result.TargetPath = targetPath

	// Create segments
	segments := d.createSegments(totalBytes, connections, req.OutputDirectory, fileName)

	// Download all segments in parallel
	err = d.downloadSegments(ctx, req.URL, segments, totalBytes, progressCb)
	if err != nil {
		// Clean up partial segment files
		for _, seg := range segments {
			os.Remove(seg.tempPath)
		}
		result.Error = err
		return result
	}

	// Merge segments into final file
	if err := d.mergeSegments(segments, targetPath); err != nil {
		// Clean up segment files on merge failure
		for _, seg := range segments {
			os.Remove(seg.tempPath)
		}
		result.Error = fmt.Errorf("merge segments: %w", err)
		return result
	}

	// Clean up segment temp files
	for _, seg := range segments {
		os.Remove(seg.tempPath)
	}

	result.TotalBytes = totalBytes
	result.CompletedAt = time.Now()
	return result
}

// createSegments splits totalBytes into N segments.
func (d *SegmentedDownloader) createSegments(totalBytes int64, n int, outputDir, fileName string) []*segment {
	segSize := totalBytes / int64(n)
	segments := make([]*segment, n)

	for i := 0; i < n; i++ {
		start := int64(i) * segSize
		end := start + segSize - 1
		if i == n-1 {
			end = totalBytes - 1 // Last segment gets the remainder
		}

		segments[i] = &segment{
			index:     i,
			startByte: start,
			endByte:   end,
			tempPath:  filepath.Join(outputDir, fmt.Sprintf(".%s.edm.seg%d.partial", SanitizeFileName(fileName), i)),
		}
	}
	return segments
}

// downloadSegments downloads all segments concurrently.
func (d *SegmentedDownloader) downloadSegments(
	ctx context.Context,
	rawURL string,
	segments []*segment,
	totalBytes int64,
	progressCb ProgressCallback,
) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	errCh := make(chan error, len(segments))
	mimeDetected := atomic.Value{}

	// Start all segment downloads
	for _, seg := range segments {
		wg.Add(1)
		go func(seg *segment) {
			defer wg.Done()
			if err := d.downloadOneSegment(ctx, rawURL, seg); err != nil {
				cancel() // Cancel all other segments
				errCh <- fmt.Errorf("segment %d: %w", seg.index, err)
			}
		}(seg)
	}

	// Progress reporting goroutine
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(progressInterval)
		defer ticker.Stop()

		speedSamples := make([]SpeedSample, 0, speedWindowSize*4)
		var lastTotal int64

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if progressCb == nil {
					continue
				}
				now := time.Now()
				var total int64
				segProgresses := make([]SegmentProgress, len(segments))

				for i, seg := range segments {
					dl := seg.downloaded.Load()
					total += dl
					segSize := seg.endByte - seg.startByte + 1
					pct := 0.0
					if segSize > 0 {
						pct = float64(dl) / float64(segSize) * 100
					}
					segProgresses[i] = SegmentProgress{
						Index:           seg.index,
						StartByte:       seg.startByte,
						EndByte:         seg.endByte,
						DownloadedBytes: dl,
						TotalBytes:      segSize,
						Percent:         pct,
					}
				}

				delta := total - lastTotal
				if delta > 0 {
					speedSamples = append(speedSamples, SpeedSample{Bytes: delta, At: now})
					lastTotal = total
				}

				speed := CalculateSpeed(speedSamples, now)
				progress := 0.0
				eta := 0.0
				if totalBytes > 0 {
					progress = float64(total) / float64(totalBytes) * 100
					if speed > 0 {
						eta = float64(totalBytes-total) / float64(speed)
					}
				}

				progressCb(ProgressUpdate{
					DownloadedBytes:  total,
					TotalBytes:       totalBytes,
					ProgressPercent:  progress,
					SpeedBytesPerSec: speed,
					ETASeconds:       eta,
					Segments:         segProgresses,
				})
			}
		}
	}()

	// Wait for all segments
	wg.Wait()
	cancel() // Stop progress reporter
	<-done

	_ = mimeDetected // May use later for content type

	// Check errors
	close(errCh)
	for err := range errCh {
		return err
	}
	return nil
}

// downloadOneSegment downloads a single byte range to a temp file.
func (d *SegmentedDownloader) downloadOneSegment(ctx context.Context, rawURL string, seg *segment) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "EasyDownloadManager/0.1")
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", seg.startByte, seg.endByte))

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPartialContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d for segment %d", resp.StatusCode, seg.index)
	}

	file, err := os.Create(seg.tempPath)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	defer file.Close()

	buf := make([]byte, defaultBufferSize)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := file.Write(buf[:n]); writeErr != nil {
				return fmt.Errorf("write: %w", writeErr)
			}
			seg.downloaded.Add(int64(n))
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return fmt.Errorf("read: %w", readErr)
		}
	}

	return file.Sync()
}

// mergeSegments concatenates all segment temp files into the final file.
func (d *SegmentedDownloader) mergeSegments(segments []*segment, targetPath string) error {
	out, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("create target file: %w", err)
	}
	defer out.Close()

	for _, seg := range segments {
		in, err := os.Open(seg.tempPath)
		if err != nil {
			return fmt.Errorf("open segment %d: %w", seg.index, err)
		}
		if _, err := io.Copy(out, in); err != nil {
			in.Close()
			return fmt.Errorf("copy segment %d: %w", seg.index, err)
		}
		in.Close()
	}

	return out.Sync()
}

// inferFileNameFromHead does a quick HEAD to get Content-Disposition.
func (d *SegmentedDownloader) inferFileNameFromHead(ctx context.Context, rawURL string, parsedURL *url.URL) string {
	probeCtx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(probeCtx, http.MethodHead, rawURL, nil)
	if err != nil {
		return fileNameFromURL(parsedURL)
	}
	req.Header.Set("User-Agent", "EasyDownloadManager/0.1")

	resp, err := d.client.Do(req)
	if err != nil {
		return fileNameFromURL(parsedURL)
	}
	defer resp.Body.Close()

	// Try Content-Disposition
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		_, params, err := mime.ParseMediaType(cd)
		if err == nil {
			if fn, ok := params["filename"]; ok && fn != "" {
				return SanitizeFileName(fn)
			}
		}
	}

	// Fall back to URL path, add extension from Content-Type if needed
	name := fileNameFromURL(parsedURL)
	if filepath.Ext(name) == "" {
		name = addExtFromContentType(name, resp)
	}
	return name
}

func fileNameFromURL(u *url.URL) string {
	path := u.Path
	if path == "" || path == "/" {
		return "download"
	}
	name := filepath.Base(path)
	if name == "." || name == "/" {
		return "download"
	}
	// URL-decode the filename
	if decoded, err := url.PathUnescape(name); err == nil {
		name = decoded
	}
	return SanitizeFileName(name)
}

// parseContentLength extracts Content-Length from a response.
func parseContentLength(resp *http.Response) int64 {
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		if v, err := strconv.ParseInt(cl, 10, 64); err == nil {
			return v
		}
	}
	return 0
}

// addExtFromHeadResponse does a HEAD request to get Content-Type for extension.
func (d *SegmentedDownloader) addExtFromHeadResponse(ctx context.Context, rawURL string, name string) string {
	probeCtx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(probeCtx, http.MethodHead, rawURL, nil)
	if err != nil {
		return name
	}
	req.Header.Set("User-Agent", "EasyDownloadManager/0.1")

	resp, err := d.client.Do(req)
	if err != nil {
		return name
	}
	defer resp.Body.Close()

	return addExtFromContentType(name, resp)
}
