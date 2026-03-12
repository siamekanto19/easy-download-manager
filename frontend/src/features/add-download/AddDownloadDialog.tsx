import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxDownloadIcon, FolderOpenIcon, LinkCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { AddDownload, SelectDirectory, GetDefaultDownloadDir, ProbeURL } from "../../../wailsjs/go/main/App";
import { formatBytes } from "@/lib/utils";

interface AddDownloadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddDownloadDialog({ open, onClose }: AddDownloadDialogProps) {
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [startImmediately, setStartImmediately] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [canResume, setCanResume] = useState<boolean | null>(null);
  const [userEditedFileName, setUserEditedFileName] = useState(false);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (open && !outputDir) {
    GetDefaultDownloadDir().then((dir) => {
      if (dir) setOutputDir(dir);
    });
  }

  // Auto-probe URL when user types with debounce
  useEffect(() => {
    if (probeTimerRef.current) {
      clearTimeout(probeTimerRef.current);
    }

    const trimmed = url.trim();
    if (!trimmed) {
      setFileSize(null);
      setCanResume(null);
      if (!userEditedFileName) setFileName("");
      return;
    }

    // Validate URL first
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    } catch {
      return;
    }

    probeTimerRef.current = setTimeout(async () => {
      setProbing(true);
      try {
        const result = await ProbeURL(trimmed);
        if (result) {
          const r = result as Record<string, unknown>;
          if (!userEditedFileName && r.fileName) {
            setFileName(r.fileName as string);
          }
          setFileSize(r.totalBytes as number || null);
          setCanResume(r.canResume as boolean);
        }
      } catch {
        // Probe failed — non-critical, user can still proceed
      } finally {
        setProbing(false);
      }
    }, 500);

    return () => {
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDir = async () => {
    try {
      const dir = await SelectDirectory();
      if (dir) setOutputDir(dir);
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!url.trim()) { setError("Please enter a URL"); return; }
    try { new URL(url.trim()); } catch { setError("Please enter a valid URL"); return; }

    setLoading(true);
    try {
      await AddDownload(url.trim(), outputDir, fileName.trim(), startImmediately);
      setUrl("");
      setFileName("");
      setFileSize(null);
      setCanResume(null);
      setError("");
      setUserEditedFileName(false);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) handleSubmit();
  };

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
    setUserEditedFileName(e.target.value.trim() !== "");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <HugeiconsIcon icon={InboxDownloadIcon} size={24} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Add Download</DialogTitle>
              <DialogDescription>
                Enter a URL to start downloading a file.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <div className="relative">
              <HugeiconsIcon
                icon={LinkCircleIcon}
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.zip"
                autoFocus
                className="pl-10 h-10"
              />
              {probing && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
                />
              )}
            </div>
            {/* File info from probe */}
            {(fileSize !== null || canResume !== null) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {fileSize !== null && fileSize > 0 && (
                  <span>{formatBytes(fileSize)}</span>
                )}
                {canResume !== null && (
                  <>
                    {fileSize !== null && fileSize > 0 && <span>·</span>}
                    <span className={canResume ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                      {canResume ? "Resumable" : "Not resumable"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* File Name */}
          <div className="space-y-2">
            <Label htmlFor="filename">
              File Name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="filename"
              value={fileName}
              onChange={handleFileNameChange}
              placeholder="Auto-detected from server"
              className="h-10"
            />
          </div>

          {/* Output Directory */}
          <div className="space-y-2">
            <Label>Save to</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center h-10 px-3 text-sm bg-muted rounded-lg text-muted-foreground overflow-hidden">
                <span className="truncate">{outputDir || "Select folder…"}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 cursor-default h-10 w-10"
                onClick={handleSelectDir}
              >
                <HugeiconsIcon icon={FolderOpenIcon} size={18} />
              </Button>
            </div>
          </div>

          {/* Start Immediately Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="start-immediately" className="cursor-pointer">
              Start immediately
            </Label>
            <Switch
              id="start-immediately"
              checked={startImmediately}
              onCheckedChange={setStartImmediately}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose} className="cursor-default">
            Cancel
          </Button>
          <Button size="lg" disabled={loading} onClick={handleSubmit} className="cursor-default">
            {loading ? "Adding…" : startImmediately ? "Download" : "Add to Queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
