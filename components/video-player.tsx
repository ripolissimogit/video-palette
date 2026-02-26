"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  X,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import {
  type RGB,
  type CropBounds,
  type ExtractionSettings,
  extractColorsFromCanvas,
  extractColorsAsync,
} from "@/lib/color-extractor";

// --- Crop handles ---
// Handles are always at the canvas edges. Dragging inward crops more, outward uncrop.

type HandleType = "top" | "bottom" | "left" | "right" | "tl" | "tr" | "bl" | "br";

function CropHandles({
  crop,
  videoFraction,
  onCropChange,
  onResetCrop,
  onDragEnd,
}: {
  crop: CropBounds;
  videoFraction: number;
  onCropChange: (crop: CropBounds) => void;
  onResetCrop: () => void;
  onDragEnd: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: HandleType;
    startX: number;
    startY: number;
    startCrop: CropBounds;
  } | null>(null);

  const MIN_VISIBLE = 0.05;
  const hasCrop = crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0;

  const startDrag = useCallback(
    (type: HandleType, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { type, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
    },
    [crop]
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !areaRef.current) return;
      const rect = areaRef.current.getBoundingClientRect();
      // dx/dy are in fractions of the cropped canvas; scale to full-video fractions
      const s = drag.startCrop;
      const scaleX = 1 - s.left - s.right;
      const scaleY = 1 - s.top  - s.bottom;
      const dx = ((e.clientX - drag.startX) / rect.width)  * scaleX;
      const dy = ((e.clientY - drag.startY) / rect.height) * scaleY;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const n: CropBounds = { ...s };

      // Symmetric resize: dragging one side affects the opposite side equally.
      const affectsHorizontal =
        drag.type === "left" ||
        drag.type === "right" ||
        drag.type === "tl" ||
        drag.type === "tr" ||
        drag.type === "bl" ||
        drag.type === "br";

      if (affectsHorizontal) {
        const signedDeltaX =
          drag.type === "left" || drag.type === "tl" || drag.type === "bl"
            ? dx
            : -dx;
        const minDeltaX = Math.max(-s.left, -s.right);
        const maxDeltaX = (scaleX - MIN_VISIBLE) / 2;
        const deltaX = clamp(signedDeltaX, minDeltaX, maxDeltaX);
        n.left = s.left + deltaX;
        n.right = s.right + deltaX;
      }

      const affectsVertical =
        drag.type === "top" ||
        drag.type === "bottom" ||
        drag.type === "tl" ||
        drag.type === "tr" ||
        drag.type === "bl" ||
        drag.type === "br";

      if (affectsVertical) {
        const signedDeltaY =
          drag.type === "top" || drag.type === "tl" || drag.type === "tr"
            ? dy
            : -dy;
        const minDeltaY = Math.max(-s.top, -s.bottom);
        const maxDeltaY = (scaleY - MIN_VISIBLE) / 2;
        const deltaY = clamp(signedDeltaY, minDeltaY, maxDeltaY);
        n.top = s.top + deltaY;
        n.bottom = s.bottom + deltaY;
      }

      onCropChange(n);
    },
    [onCropChange]
  );

  const endDrag = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      onDragEnd();
    }
  }, [onDragEnd]);

  // Handles are always at the edges of the cropped canvas (0% / 50% / 100%)
  const mkHandle = (type: HandleType, left: string, top: string, w: number, h: number, cursor: string) => (
    <div
      key={type}
      onPointerDown={(e) => startDrag(type, e)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      style={{
        position: "absolute",
        left,
        top,
        transform: "translate(-50%, -50%)",
        width: w,
        height: h,
        borderRadius: Math.min(w, h) / 2,
        background: "white",
        boxShadow: "0 1px 6px rgba(0,0,0,0.6)",
        cursor,
        pointerEvents: "auto",
        touchAction: "none",
        zIndex: 10,
      }}
    />
  );

  return (
    <div
      ref={areaRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: `${videoFraction * 100}%`,
        pointerEvents: "none",
      }}
    >
      {hasCrop && (
        <button
          onClick={onResetCrop}
          style={{ position: "absolute", top: 8, left: 8, pointerEvents: "auto", zIndex: 20 }}
          className="px-2 py-1 rounded-md bg-white/90 text-black text-[11px] font-medium shadow-md hover:bg-white transition-colors"
          aria-label="Reset crop"
        >
          ↺ Reset
        </button>
      )}

      {/* Edge handles — always at 0% / 50% / 100% of the overlay */}
      {mkHandle("top",    "50%", "0%",   40, 10, "ns-resize")}
      {mkHandle("bottom", "50%", "100%", 40, 10, "ns-resize")}
      {mkHandle("left",   "0%",  "50%",  10, 40, "ew-resize")}
      {mkHandle("right",  "100%","50%",  10, 40, "ew-resize")}

      {/* Corner handles */}
      {mkHandle("tl", "0%",   "0%",   14, 14, "nwse-resize")}
      {mkHandle("tr", "100%", "0%",   14, 14, "nesw-resize")}
      {mkHandle("bl", "0%",   "100%", 14, 14, "nesw-resize")}
      {mkHandle("br", "100%", "100%", 14, 14, "nwse-resize")}
    </div>
  );
}

// --- EWMA smoothing constant ---

const EWMA_ALPHA = 0.15;

// --- VideoPlayer ---

interface VideoPlayerProps {
  src: string;
  fileName: string;
  colorCount: number;
  colors: RGB[];
  userCrop: CropBounds;
  extractionSettings?: ExtractionSettings;
  onCropChange: (crop: CropBounds) => void;
  onColorsExtracted: (colors: RGB[]) => void;
  onRemove: () => void;
  fullscreenContainerRef?: React.RefObject<HTMLDivElement | null>;
  isExternalFullscreen?: boolean;
}

export function VideoPlayer({
  src,
  fileName,
  colorCount,
  colors,
  userCrop,
  extractionSettings,
  onCropChange,
  onColorsExtracted,
  onRemove,
  fullscreenContainerRef,
  isExternalFullscreen = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastExtractRef = useRef<number>(0);
  const colorsRef = useRef<RGB[]>(colors);
  const colorCountRef = useRef(colorCount);
  const userCropRef = useRef<CropBounds>(userCrop);
  const settingsRef = useRef<ExtractionSettings | undefined>(extractionSettings);
  const ewmaRef = useRef<RGB[]>([]);
  const prevSentRef = useRef<RGB[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoDims, setVideoDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    colorCountRef.current = colorCount;
    ewmaRef.current = [];
    prevSentRef.current = [];
  }, [colorCount]);
  useEffect(() => { settingsRef.current = extractionSettings; }, [extractionSettings]);

  // Draw only the cropped region + palette bar to the preview canvas.
  // Matches the export layout exactly: canvas = cropW × (cropH + paletteH).
  const drawPreview = useCallback(() => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const k = colorCountRef.current;
    const crop = userCropRef.current;

    const leftPx   = Math.round(crop.left   * vw);
    const rightPx  = Math.round(crop.right  * vw);
    const topPx    = Math.round(crop.top    * vh);
    const bottomPx = Math.round(crop.bottom * vh);
    const cropW = Math.max(1, vw - leftPx - rightPx);
    const cropH = Math.max(1, vh - topPx - bottomPx);
    const pH = Math.round(cropW / k);

    if (canvas.width !== cropW || canvas.height !== cropH + pH) {
      canvas.width  = cropW;
      canvas.height = cropH + pH;
    }

    // Draw only the visible (non-cropped) region
    ctx.drawImage(video, leftPx, topPx, cropW, cropH, 0, 0, cropW, cropH);

    // Palette bar immediately below the visible content
    const swatchW = cropW / k;
    colorsRef.current.forEach((color, i) => {
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      ctx.fillRect(Math.round(i * swatchW), cropH, Math.ceil(swatchW), pH);
    });
  }, []);

  // Sync colorsRef and redraw when colors change
  useEffect(() => {
    colorsRef.current = colors;
    drawPreview();
  }, [colors, drawPreview]);

  // Sync userCropRef and redraw when crop changes
  useEffect(() => {
    userCropRef.current = userCrop;
    drawPreview();
  }, [userCrop, drawPreview]);

  // Async extraction (~15fps throttle) + preview frame draw
  const extractColors = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused) return;

    const now = performance.now();
    if (now - lastExtractRef.current >= 66) {
      lastExtractRef.current = now;
      extractColorsAsync(canvas, video, colorCount, undefined, userCropRef.current, settingsRef.current).then((extracted) => {
        if (extracted.length === 0) return;
        const deadband = settingsRef.current?.deadband ?? 55;
        const sceneCutSq = (deadband * 2) ** 2;
        const ewma = ewmaRef.current;

        // Scene cut: reset EWMA instantly so transitions are immediate
        const isSceneCut =
          ewma.length !== extracted.length ||
          extracted.some((c, i) => {
            const p = ewma[i];
            return !p || (c.r - p.r) ** 2 + (c.g - p.g) ** 2 + (c.b - p.b) ** 2 > sceneCutSq;
          });

        // EWMA: continuous smoothing, no step functions
        const smoothed: RGB[] = isSceneCut
          ? extracted
          : extracted.map((c, i) => ({
              r: Math.round(EWMA_ALPHA * c.r + (1 - EWMA_ALPHA) * ewma[i].r),
              g: Math.round(EWMA_ALPHA * c.g + (1 - EWMA_ALPHA) * ewma[i].g),
              b: Math.round(EWMA_ALPHA * c.b + (1 - EWMA_ALPHA) * ewma[i].b),
            }));
        ewmaRef.current = smoothed;

        // Tiny gate: only propagate if any channel moved >1 (avoids pointless re-renders)
        const last = prevSentRef.current;
        const changed =
          last.length !== smoothed.length ||
          smoothed.some((c, i) => {
            const p = last[i];
            return !p || Math.abs(c.r - p.r) > 1 || Math.abs(c.g - p.g) > 1 || Math.abs(c.b - p.b) > 1;
          });
        if (changed) {
          prevSentRef.current = smoothed;
          onColorsExtracted(smoothed);
        }
      });
      setCurrentTime(video.currentTime);
    }

    drawPreview();
    rafRef.current = requestAnimationFrame(extractColors);
  }, [colorCount, onColorsExtracted, drawPreview]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Re-extract on crop drag end (only when paused)
  const handleCropDragEnd = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.paused) return;
    extractColorsFromCanvas(canvas, video, colorCountRef.current, undefined, userCropRef.current, settingsRef.current)
      .then((extracted) => {
        if (extracted.length > 0) {
          ewmaRef.current = extracted;
          prevSentRef.current = extracted;
          onColorsExtracted(extracted);
        }
      });
  }, [onColorsExtracted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (isPlaying) handlePause();
          else handlePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          setCurrentTime(video.currentTime);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(duration, video.currentTime + 5);
          setCurrentTime(video.currentTime);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "r":
          e.preventDefault();
          handleRestart();
          break;
        case "s":
        case "S":
          e.preventDefault();
          handleScreenshot();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume, duration]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play();
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(extractColors);
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const canvas = canvasRef.current;
    if (canvas) {
      extractColorsFromCanvas(canvas, video, colorCount, undefined, userCropRef.current, settingsRef.current).then((extracted) => {
        if (extracted.length > 0) {
          ewmaRef.current = extracted;
          prevSentRef.current = extracted;
          onColorsExtracted(extracted);
        }
      });
    }
    setTimeout(drawPreview, 50);
  };

  const handleTogglePlay = () => {
    if (isPlaying) handlePause();
    else handlePlay();
  };

  const handleRestart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) handlePlay();
  };

  const handleScreenshot = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    drawPreview();

    const safeBase = (fileName || "video-palette")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "video-palette";
    const minutes = Math.floor(currentTime / 60).toString().padStart(2, "0");
    const seconds = Math.floor(currentTime % 60).toString().padStart(2, "0");
    const centis = Math.floor((currentTime % 1) * 100).toString().padStart(2, "0");
    const downloadName = `${safeBase}-frame-${minutes}-${seconds}-${centis}.png`;

    const triggerDownload = (url: string, revoke = false) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      a.click();
      if (revoke) {
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    };

    canvas.toBlob((blob) => {
      if (!blob) {
        triggerDownload(canvas.toDataURL("image/png"));
        return;
      }
      const url = URL.createObjectURL(blob);
      triggerDownload(url, true);
    }, "image/png");
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
    const canvas = canvasRef.current;
    if (canvas) {
      setTimeout(async () => {
        drawPreview();
        const extracted = await extractColorsFromCanvas(canvas, video, colorCount, undefined, userCropRef.current, settingsRef.current);
        if (extracted.length > 0) {
          ewmaRef.current = extracted;
          prevSentRef.current = extracted;
          onColorsExtracted(extracted);
        }
      }, 50);
    }
  };

  const handleVolumeChange = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
    if (videoRef.current) {
      videoRef.current.volume = clamped;
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    video.muted = newMuted;
  };

  const toggleFullscreen = async () => {
    const target = fullscreenContainerRef?.current || wrapperRef.current;
    if (!target) return;
    try {
      if (!document.fullscreenElement) {
        await target.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setVideoDims({ w: video.videoWidth, h: video.videoHeight });
    ewmaRef.current = [];
    prevSentRef.current = [];
    setTimeout(drawPreview, 100);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const formatTime = (t: number) => {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Canvas dimensions: cropped region + palette bar (matches export exactly)
  const cropLeftPx  = Math.round(userCrop.left   * videoDims.w);
  const cropRightPx = Math.round(userCrop.right  * videoDims.w);
  const cropTopPx   = Math.round(userCrop.top    * videoDims.h);
  const cropBotPx   = Math.round(userCrop.bottom * videoDims.h);
  const cropW = Math.max(1, videoDims.w - cropLeftPx - cropRightPx);
  const cropH = Math.max(1, videoDims.h - cropTopPx  - cropBotPx);
  const palettePixelH = videoDims.w > 0 ? Math.round(cropW / colorCount) : 0;
  const totalCanvasH  = cropH + palettePixelH;
  const canvasAspect  = videoDims.w > 0 ? `${cropW} / ${totalCanvasH}` : "16 / 9";
  const videoFraction = totalCanvasH > 0 ? cropH / totalCanvasH : 1;
  // Aspect ratio as a number for viewport-fit width calculation
  const ratio = videoDims.w > 0 ? cropW / totalCanvasH : 16 / 9;

  return (
    <div ref={wrapperRef} className={`flex flex-col ${isExternalFullscreen ? "h-full gap-2" : "gap-4"}`}>
      {/* Preview canvas container */}
      <div
        className={`relative bg-black group ${
          isExternalFullscreen
            ? "flex-1 min-h-0 flex items-center justify-center"
            : "rounded-xl"
        }`}
        style={
          !isExternalFullscreen
            ? {
                width: `min(100%, calc((100vh - 240px) * ${ratio}))`,
                aspectRatio: canvasAspect,
                maxHeight: "calc(100vh - 240px)",
                margin: "0 auto",
              }
            : undefined
        }
      >
        {/* Hidden video for playback */}
        <video
          ref={videoRef}
          src={src}
          className="hidden"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnd}
          onPlay={() => {
            setIsPlaying(true);
            rafRef.current = requestAnimationFrame(extractColors);
          }}
          onPause={() => {
            setIsPlaying(false);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
          }}
          playsInline
          crossOrigin="anonymous"
        />

        {/* Hidden canvas for color extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Preview canvas: cropped content + palette bar — identical to export */}
        <canvas
          ref={previewCanvasRef}
          style={{
            display: "block",
            ...(isExternalFullscreen
              ? { height: "100%", width: "auto" }
              : { position: "absolute", inset: "0", width: "100%", height: "100%" }
            ),
          }}
        />

        {/* Crop handles — at the edges of the canvas, covering only the video portion */}
        {videoDims.w > 0 && (
          <CropHandles
            crop={userCrop}
            videoFraction={videoFraction}
            onCropChange={onCropChange}
            onResetCrop={() => onCropChange({ top: 0, bottom: 0, left: 0, right: 0 })}
            onDragEnd={handleCropDragEnd}
          />
        )}

        {/* Center overlay play/pause — pointer-events:none so handles stay interactive */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20"
          style={{ pointerEvents: "none" }}
        >
          <button
            onClick={handleTogglePlay}
            className="w-16 h-16 rounded-full bg-foreground/90 flex items-center justify-center text-background backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
            style={{ pointerEvents: "auto" }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-secondary/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          aria-label="Remove video"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Controls bar */}
      <div className={`flex flex-col px-1 shrink-0 ${isExternalFullscreen ? "gap-1.5 px-4" : "gap-3"}`}>
        {/* Progress bar */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
            style={{
              background: duration
                ? `linear-gradient(to right, var(--foreground) ${(currentTime / duration) * 100}%, var(--secondary) ${(currentTime / duration) * 100}%)`
                : undefined,
            }}
            aria-label="Video progress"
          />
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlay}
              className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <button
              onClick={handleRestart}
              className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-colors"
              aria-label="Restart (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleScreenshot}
              className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-colors"
              aria-label="Screenshot (S)"
              title="Screenshot (S)"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                onClick={toggleMute}
                className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-colors"
                aria-label={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 rounded-full appearance-none cursor-pointer bg-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                aria-label="Volume"
              />
            </div>

            <span className="text-xs font-mono text-muted-foreground ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate max-w-[150px] hidden sm:inline">
              {fileName}
            </span>
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
