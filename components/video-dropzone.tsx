"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Film, Link, Loader2, AlertCircle } from "lucide-react";

interface VideoDropzoneProps {
  onVideoSelect: (url: string, name: string) => void;
}

type Tab = "file" | "url";
const JOB_POLL_INTERVAL_MS = 1500;
const JOB_POLL_TIMEOUT_MS = 6 * 60 * 1000;

// Detect YouTube URLs
function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/.test(url);
}

function getYouTubeLoadingMessage(step: "info" | "stream"): string {
  return step === "info"
    ? "Fetching video info..."
    : "Preparing high-quality stream...";
}

export function VideoDropzone({ onVideoSelect }: VideoDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("file");
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("Loading");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        onVideoSelect(url, file.name);
      }
    },
    [onVideoSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleYouTubeUrl = useCallback(async (trimmed: string) => {
    // Step 1: Get video info and stream URL from Piped API
    setLoadingMessage(getYouTubeLoadingMessage("info"));
    const infoRes = await fetch(`/api/youtube?url=${encodeURIComponent(trimmed)}`);
    const infoData = await infoRes.json();

    if (!infoRes.ok) {
      throw new Error(infoData?.error || `Failed to get video info (${infoRes.status})`);
    }
    if (!infoData?.videoId) {
      throw new Error("Missing video id from YouTube response");
    }

    // Step 2: Start async merge job and poll for readiness
    setLoadingMessage(getYouTubeLoadingMessage("stream"));
    const jobRes = await fetch("/api/youtube/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: infoData.videoId,
        streamUrl: infoData.streamUrl,
      }),
    });
    const jobData = await jobRes.json().catch(() => null);
    if (!jobRes.ok || !jobData?.jobId) {
      throw new Error(jobData?.error || `Failed to start merge job (${jobRes.status})`);
    }

    let status = jobData.status as string;
    let statusMessage = jobData.message as string | undefined;
    let mergedStreamUrl = jobData.streamUrl as string | null | undefined;
    const startedAt = Date.now();

    while (status !== "ready") {
      if (status === "failed") break;
      if (Date.now() - startedAt > JOB_POLL_TIMEOUT_MS) {
        throw new Error("Timed out while preparing high-quality stream");
      }

      if (statusMessage) setLoadingMessage(statusMessage);
      await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));

      const pollRes = await fetch(
        `/api/youtube/jobs?jobId=${encodeURIComponent(jobData.jobId)}`,
        { cache: "no-store" }
      );
      const pollData = await pollRes.json().catch(() => null);
      if (!pollRes.ok) {
        throw new Error(pollData?.error || `Merge job failed (${pollRes.status})`);
      }
      status = pollData?.status || "failed";
      statusMessage = pollData?.message;
      mergedStreamUrl = pollData?.streamUrl;
    }

    let streamRes: Response;
    if (status === "ready") {
      const streamUrl =
        mergedStreamUrl || `/api/youtube/jobs?jobId=${encodeURIComponent(jobData.jobId)}&stream=1`;
      setLoadingMessage("Downloading high-quality stream...");
      streamRes = await fetch(streamUrl, { cache: "no-store" });
    } else {
      // Last-resort fallback if merge job failed.
      if (!infoData.streamUrl) {
        throw new Error("High-quality merge failed and no fallback stream is available");
      }
      setLoadingMessage("HQ merge failed, loading fallback stream...");
      streamRes = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamUrl: infoData.streamUrl }),
      });
    }

    if (!streamRes.ok) {
      const errorData = await streamRes.json().catch(() => null);
      throw new Error(errorData?.error || `Failed to stream video (${streamRes.status})`);
    }

    // Create a blob URL from the proxied stream
    const blob = await streamRes.blob();
    const blobUrl = URL.createObjectURL(blob);
    const title = infoData.title || `youtube-${infoData.videoId}`;

    onVideoSelect(blobUrl, title);
  }, [onVideoSelect]);

  const handleDirectUrl = useCallback(async (trimmed: string) => {
    setLoadingMessage("Loading");
    const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(trimmed)}`;

    // Verify the URL is reachable and is a video
    const res = await fetch(proxyUrl, { method: "GET", headers: { Range: "bytes=0-1023" } });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Server returned ${res.status}`);
    }

    // Extract a filename from the URL
    const urlObj = new URL(trimmed);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const fileName = pathParts[pathParts.length - 1] || "remote-video";

    onVideoSelect(proxyUrl, decodeURIComponent(fileName));
  }, [onVideoSelect]);

  const handleUrlSubmit = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setUrlError("Please enter a valid URL");
      return;
    }

    setUrlLoading(true);
    setUrlError("");

    try {
      if (isYouTubeUrl(trimmed)) {
        await handleYouTubeUrl(trimmed);
      } else {
        await handleDirectUrl(trimmed);
      }
    } catch (err) {
      setUrlError(
        err instanceof Error ? err.message : "Failed to load video from URL"
      );
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, handleYouTubeUrl, handleDirectUrl]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleUrlSubmit();
      }
    },
    [handleUrlSubmit]
  );

  const detectedYouTube = urlInput.trim() ? isYouTubeUrl(urlInput.trim()) : false;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg self-center">
        <button
          onClick={() => { setActiveTab("file"); setUrlError(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "file"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Film className="w-4 h-4" />
          File
        </button>
        <button
          onClick={() => { setActiveTab("url"); setUrlError(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "url"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link className="w-4 h-4" />
          URL
        </button>
      </div>

      {activeTab === "file" ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-20 px-8 ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-muted-foreground/50 hover:bg-secondary/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              {isDragging ? (
                <Upload className="w-7 h-7 text-primary" />
              ) : (
                <Film className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium text-lg">
                {isDragging ? "Drop your video here" : "Drop a video here"}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                or click to browse
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              {["MP4", "WebM", "MOV"].map((fmt) => (
                <span
                  key={fmt}
                  className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-md"
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center py-20 px-8">
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Link className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium text-lg">
                Paste a video URL
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                YouTube link or direct URL to a video file
              </p>
            </div>
            <div className="w-full flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
                  onKeyDown={handleUrlKeyDown}
                  placeholder="https://youtube.com/watch?v=... or direct URL"
                  disabled={urlLoading}
                  className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={urlLoading || !urlInput.trim()}
                  className="px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {urlLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">{loadingMessage}</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    "Load"
                  )}
                </button>
              </div>
              {detectedYouTube && !urlLoading && !urlError && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>YouTube video detected</span>
                </div>
              )}
              {urlError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {["YouTube", "MP4", "WebM", "MOV"].map((fmt) => (
                <span
                  key={fmt}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                    fmt === "YouTube"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground bg-secondary"
                  }`}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
