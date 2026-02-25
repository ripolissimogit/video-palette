"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Download,
  Loader2,
  Square,
  ChevronDown,
  Hash,
  Smartphone,
  Monitor,
  FileVideo,
} from "lucide-react";
import {
  type RGB,
  rgbToHex,
  getContrastColor,
  extractColorsFromCanvas,
  matchColorOrder,
  detectLetterbox,
} from "@/lib/color-extractor";

type AspectRatioOption = "original" | "instagram4x5";
type ExportFormat = "webm" | "mp4" | "mov";

interface ExportFormatOption {
  id: ExportFormat;
  label: string;
  extension: string;
  mimeType: string | null;
  supported: boolean;
}

interface ExportPanelProps {
  videoSrc: string;
  colorCount: number;
  colors: RGB[];
}

function getSupportedMimeType(candidates: string[]): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return null;
}

function getFormatOptions(): ExportFormatOption[] {
  const webmMimeType = getSupportedMimeType([
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]);
  const mp4MimeType = getSupportedMimeType([
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ]);
  const movMimeType = getSupportedMimeType([
    "video/quicktime;codecs=h264,aac",
    "video/quicktime;codecs=avc1",
    "video/quicktime",
  ]);

  return [
    {
      id: "webm",
      label: "WebM",
      extension: "webm",
      mimeType: webmMimeType,
      supported: !!webmMimeType,
    },
    {
      id: "mp4",
      label: "MP4",
      extension: "mp4",
      mimeType: mp4MimeType,
      supported: !!mp4MimeType,
    },
    {
      id: "mov",
      label: "MOV",
      extension: "mov",
      mimeType: movMimeType,
      supported: !!movMimeType,
    },
  ];
}

// --- Gaussian temporal smoothing ---
// Applies a weighted moving average across the color sequence.
// Each frame's color is the weighted average of nearby frames, using a
// Gaussian kernel. This is BIDIRECTIONAL: it uses past AND future knowledge,
// which is impossible in real-time but perfect for export.
function gaussianSmoothColors(
  frames: RGB[][],
  sigma: number = 3.0
): RGB[][] {
  const n = frames.length;
  if (n === 0) return [];

  const radius = Math.ceil(sigma * 2.5);
  const k = frames[0].length;
  const result: RGB[][] = new Array(n);

  // Precompute kernel weights
  const kernelSize = radius * 2 + 1;
  const kernel = new Float64Array(kernelSize);
  let kernelSum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernelSum += kernel[i];
  }
  for (let i = 0; i < kernelSize; i++) kernel[i] /= kernelSum;

  for (let f = 0; f < n; f++) {
    const colors: RGB[] = new Array(k);
    for (let c = 0; c < k; c++) {
      let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
      for (let d = -radius; d <= radius; d++) {
        const idx = Math.max(0, Math.min(n - 1, f + d));
        const w = kernel[d + radius];
        rSum += frames[idx][c].r * w;
        gSum += frames[idx][c].g * w;
        bSum += frames[idx][c].b * w;
        wSum += w;
      }
      colors[c] = {
        r: Math.round(rSum / wSum),
        g: Math.round(gSum / wSum),
        b: Math.round(bSum / wSum),
      };
    }
    result[f] = colors;
  }

  return result;
}

export function ExportPanel({
  videoSrc,
  colorCount,
  colors,
}: ExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [showHex, setShowHex] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("original");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("webm");
  const [state, setState] = useState<
    "idle" | "analyzing" | "recording" | "processing"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const abortRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const formatOptions = useMemo(() => getFormatOptions(), []);
  const selectedFormatOption = useMemo(
    () => formatOptions.find((opt) => opt.id === exportFormat),
    [formatOptions, exportFormat]
  );

  useEffect(() => {
    const current = formatOptions.find((opt) => opt.id === exportFormat);
    if (current?.supported) return;

    const firstSupported = formatOptions.find((opt) => opt.supported);
    if (firstSupported) setExportFormat(firstSupported.id);
  }, [formatOptions, exportFormat]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 150);
  }, []);

  const exportVideo = useCallback(
    async (hex: boolean, ratio: AspectRatioOption, format: ExportFormat) => {
      abortRef.current = false;
      setOpen(false);

      const requestedFormat =
        formatOptions.find((opt) => opt.id === format) ?? formatOptions[0];
      const activeFormat =
        requestedFormat?.supported
          ? requestedFormat
          : formatOptions.find((opt) => opt.supported) ?? requestedFormat;
      if (!activeFormat || !activeFormat.mimeType) {
        setState("idle");
        setProgress(0);
        setStatusMsg("");
        return;
      }
      const activeMimeType = activeFormat.mimeType;

      const video = document.createElement("video");
      video.src = videoSrc;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        video.load();
      });

      const rawW = video.videoWidth;
      const rawH = video.videoHeight;
      const dur = video.duration;

      // Detect letterbox crop (seek to get a decoded frame first)
      video.currentTime = Math.min(0.5, dur * 0.05);
      await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
      const crop = detectLetterbox(video);
      const cropSx = Math.round(crop.left * rawW);
      const cropSy = Math.round(crop.top * rawH);
      const vw = rawW - cropSx - Math.round(crop.right * rawW);
      const vh = rawH - cropSy - Math.round(crop.bottom * rawH);
      const fps = 15; // Analysis sample rate
      const totalFrames = Math.ceil(dur * fps);

      // Layout computation
      let canvasW: number, canvasH: number;
      let videoX: number, videoY: number, drawW: number, drawH: number;
      let barsY: number, paletteH: number;

      if (ratio === "instagram4x5") {
        canvasW = Math.min(vw, 1080);
        canvasH = Math.round(canvasW * 1.25);

        const barsH = Math.round(canvasH * 0.15);
        paletteH = barsH;

        const videoAreaH = canvasH - barsH;
        const videoAR = vw / vh;
        const areaAR = canvasW / videoAreaH;

        if (videoAR >= areaAR) {
          drawW = canvasW;
          drawH = Math.round(canvasW / videoAR);
        } else {
          drawH = videoAreaH;
          drawW = Math.round(videoAreaH * videoAR);
        }

        videoX = Math.round((canvasW - drawW) / 2);
        videoY = Math.round((videoAreaH - drawH) / 2);
        barsY = videoAreaH;
      } else {
        canvasW = vw;
        paletteH = Math.round(vw / colorCount);
        canvasH = vh + paletteH;
        drawW = vw;
        drawH = vh;
        videoX = 0;
        videoY = 0;
        barsY = vh;
      }

      // Sampling canvas for color extraction
      const sampleCanvas = document.createElement("canvas");
      const scale = Math.min(1, 200 / vw);
      sampleCanvas.width = Math.round(vw * scale);
      sampleCanvas.height = Math.round(vh * scale);

      // ================================================
      // PASS 1: Analyze - extract colors for each frame
      // ================================================
      setState("analyzing");
      setStatusMsg("Analyzing colors...");
      setProgress(0);

      const rawFrames: RGB[][] = [];
      const frameTimes: number[] = [];

      for (let i = 0; i < totalFrames; i++) {
        if (abortRef.current) {
          setState("idle");
          video.src = "";
          return;
        }

        const t = (i / totalFrames) * dur;
        frameTimes.push(t);

        // Seek to exact time
        video.currentTime = t;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        const raw = await extractColorsFromCanvas(sampleCanvas, video, colorCount, 4000);

        // Stable matching against previous frame
        if (rawFrames.length > 0) {
          rawFrames.push(matchColorOrder(rawFrames[rawFrames.length - 1], raw));
        } else {
          rawFrames.push(raw);
        }

        setProgress((i + 1) / totalFrames * 0.5); // 0-50% for analysis
      }

      if (abortRef.current) {
        setState("idle");
        video.src = "";
        return;
      }

      // ================================================
      // Gaussian temporal smoothing (bidirectional)
      // sigma=3 means each frame averages ~15 neighbors
      // ================================================
      setStatusMsg("Smoothing transitions...");
      const smoothedFrames = gaussianSmoothColors(rawFrames, 3.0);

      // Build a lookup: given a time, return the smoothed colors
      function getColorsAtTime(t: number): RGB[] {
        if (smoothedFrames.length === 0) return colors;
        // Find nearest frame
        let bestIdx = 0;
        let bestDist = Math.abs(frameTimes[0] - t);
        for (let i = 1; i < frameTimes.length; i++) {
          const d = Math.abs(frameTimes[i] - t);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }

        // Interpolate between two nearest frames for extra smoothness
        const idx = bestIdx;
        if (idx >= smoothedFrames.length - 1) return smoothedFrames[idx];

        const t0 = frameTimes[idx];
        const t1 = frameTimes[idx + 1];
        const frac = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
        const clampedFrac = Math.max(0, Math.min(1, frac));

        const a = smoothedFrames[idx];
        const b = smoothedFrames[idx + 1];
        return a.map((ac, i) => ({
          r: Math.round(ac.r + (b[i].r - ac.r) * clampedFrac),
          g: Math.round(ac.g + (b[i].g - ac.g) * clampedFrac),
          b: Math.round(ac.b + (b[i].b - ac.b) * clampedFrac),
        }));
      }

      // ================================================
      // PASS 2: Render - play video and draw pre-smoothed
      // ================================================
      setState("recording");
      setStatusMsg("Recording video...");

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      const swatchW = canvasW / colorCount;
      const hexFontSize = Math.max(10, Math.round(swatchW * 0.045));

      const stream = canvas.captureStream(30);

      // Capture audio from the video via Web Audio API
      video.muted = false;
      const audioCtx = new AudioContext();
      const audioSource = audioCtx.createMediaElementSource(video);
      const audioDest = audioCtx.createMediaStreamDestination();
      audioSource.connect(audioDest);
      // Don't connect to audioCtx.destination — no playback during export
      audioDest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

      const recorder = new MediaRecorder(stream, {
        mimeType: activeMimeType,
        videoBitsPerSecond: 5_000_000,
      });
      recorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        audioCtx.close();
        setState("processing");
        setStatusMsg("Saving...");
        const blobType = recorder.mimeType || activeMimeType;
        const blob = new Blob(chunks, { type: blobType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ratioSuffix = ratio === "instagram4x5" ? "-4x5" : "";
        a.download = `video-palette${ratioSuffix}.${activeFormat.extension}`;
        a.click();
        URL.revokeObjectURL(url);
        setState("idle");
        setProgress(0);
        setStatusMsg("");
      };

      recorder.start();
      video.currentTime = 0;
      await video.play();

      const drawFrame = () => {
        if (abortRef.current || video.ended || video.paused) {
          if (recorder.state === "recording") recorder.stop();
          video.pause();
          video.src = "";
          return;
        }

        const now = video.currentTime;
        setProgress(0.5 + (dur > 0 ? (now / dur) * 0.5 : 0)); // 50-100%

        // 0. Fill background (dark padding for 4:5 mode)
        if (ratio === "instagram4x5") {
          ctx.fillStyle = "#0d0d0d";
          ctx.fillRect(0, 0, canvasW, canvasH);
        }

        // 1. Draw video frame (cropped to remove letterbox)
        ctx.drawImage(video, cropSx, cropSy, vw, vh, videoX, videoY, drawW, drawH);

        // 2. Get pre-smoothed colors for this exact time (NO k-means here)
        const frameColors = getColorsAtTime(now);

        // 3. Draw palette bar
        frameColors.forEach((color, i) => {
          ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
          ctx.fillRect(
            Math.round(i * swatchW),
            barsY,
            Math.ceil(swatchW),
            paletteH
          );

          if (hex) {
            const hexVal = rgbToHex(color);
            const contrast = getContrastColor(color);
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = contrast;
            ctx.font = `${hexFontSize}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              hexVal,
              Math.round(i * swatchW + swatchW / 2),
              barsY + paletteH / 2
            );
            ctx.globalAlpha = 1;
          }
        });

        requestAnimationFrame(drawFrame);
      };

      requestAnimationFrame(drawFrame);

      video.onended = () => {
        if (recorder.state === "recording") recorder.stop();
        video.src = "";
      };
    },
    [videoSrc, colorCount, colors, formatOptions]
  );

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setState("idle");
    setProgress(0);
    setStatusMsg("");
  }, []);

  const handleExport = useCallback(() => {
    exportVideo(showHex, aspectRatio, exportFormat);
  }, [showHex, aspectRatio, exportFormat, exportVideo]);

  // --- Active state UI ---
  if (state !== "idle") {
    const label =
      state === "analyzing"
        ? statusMsg
        : state === "recording"
          ? statusMsg
          : statusMsg;
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm">
          {state === "processing" ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          )}
          <span className="text-muted-foreground text-xs hidden sm:inline">
            {label}
          </span>
          <span className="font-mono text-foreground">
            {Math.round(progress * 100)}%
          </span>
        </div>
        {state !== "processing" && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm text-foreground transition-colors"
            aria-label="Cancel"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={panelRef} className="relative" onBlur={handleBlur}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm text-foreground transition-colors"
        aria-label="Export options"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-80 rounded-xl border border-border bg-card shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3 flex flex-col gap-3">
              <button
                onClick={() => setShowHex((v) => !v)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-secondary transition-colors cursor-pointer"
                aria-pressed={showHex}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    showHex
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Hash className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    Hex codes
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Show color values on palette
                  </span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full ml-auto shrink-0 transition-colors relative ${
                    showHex ? "bg-foreground" : "bg-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-background absolute top-[3px] transition-transform ${
                      showHex ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </div>
              </button>

              <div className="h-px bg-border" />

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                Aspect ratio
              </span>
              <div className="flex gap-1.5">
                {([
                  { id: "original" as const, label: "Original", icon: Monitor },
                  { id: "instagram4x5" as const, label: "4:5", icon: Smartphone },
                ]).map((opt) => {
                  const Icon = opt.icon;
                  const selected = aspectRatio === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setAspectRatio(opt.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        selected
                          ? "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                      aria-pressed={selected}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                Format
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {formatOptions.map((opt) => {
                  const selected = exportFormat === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => opt.supported && setExportFormat(opt.id)}
                      disabled={!opt.supported}
                      className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs transition-colors ${
                        selected
                          ? "bg-foreground/10 text-foreground"
                          : opt.supported
                            ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            : "text-muted-foreground/50 bg-secondary/30 cursor-not-allowed"
                      }`}
                      aria-pressed={selected}
                      aria-disabled={!opt.supported}
                    >
                      <FileVideo className="w-3 h-3" />
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedFormatOption && !selectedFormatOption.supported && (
                <span className="text-[11px] text-muted-foreground px-1">
                  Selected format is not supported by this browser
                </span>
              )}
              <span className="text-[11px] text-muted-foreground px-1">
                Disabled options are not supported by your browser
              </span>
            </div>

            <div className="h-px bg-border" />

            <button
              onClick={handleExport}
              disabled={!formatOptions.some((opt) => opt.supported)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium transition-all hover:opacity-90"
            >
              <Download className="w-4 h-4" />
              Export {selectedFormatOption?.label ?? "Video"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
