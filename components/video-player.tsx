"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import {
  type RGB,
  type CropBounds,
  extractColorsFromCanvas,
  extractColorsAsync,
  detectLetterbox,
  hasCrop,
} from "@/lib/color-extractor";

interface VideoPlayerProps {
  src: string;
  fileName: string;
  colorCount: number;
  onColorsExtracted: (colors: RGB[]) => void;
  onRemove: () => void;
  fullscreenContainerRef?: React.RefObject<HTMLDivElement | null>;
  isExternalFullscreen?: boolean;
}

export function VideoPlayer({
  src,
  fileName,
  colorCount,
  onColorsExtracted,
  onRemove,
  fullscreenContainerRef,
  isExternalFullscreen = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastExtractRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crop, setCrop] = useState<CropBounds | null>(null);
  const cropDetectedRef = useRef(false);

  // Async extraction via Web Worker (~15fps throttle, ~66ms)
  const extractColors = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused) return;

    const now = performance.now();
    if (now - lastExtractRef.current >= 66) {
      lastExtractRef.current = now;
      // Fire and forget: don't block on previous extraction
      extractColorsAsync(canvas, video, colorCount).then((colors) => {
        if (colors.length > 0) onColorsExtracted(colors);
      });
      setCurrentTime(video.currentTime);
    }

    rafRef.current = requestAnimationFrame(extractColors);
  }, [colorCount, onColorsExtracted]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume, duration]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
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
      extractColorsFromCanvas(canvas, video, colorCount).then((colors) => {
        if (colors.length > 0) onColorsExtracted(colors);
      });
    }
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
    const canvas = canvasRef.current;
    if (canvas) {
      setTimeout(async () => {
        const colors = await extractColorsFromCanvas(canvas, video, colorCount);
        if (colors.length > 0) onColorsExtracted(colors);
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
    // Prefer external container (wraps palette too), fall back to player wrapper
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
    cropDetectedRef.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      setTimeout(async () => {
        const colors = await extractColorsFromCanvas(canvas, video, colorCount);
        if (colors.length > 0) {
          onColorsExtracted(colors);
          // Detect letterbox after first successful extraction (frame is decoded)
          if (!cropDetectedRef.current) {
            cropDetectedRef.current = true;
            const detected = detectLetterbox(video);
            if (hasCrop(detected)) {
              setCrop(detected);
            }
          }
        }
      }, 100);
    }
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

  return (
    <div ref={wrapperRef} className={`flex flex-col ${isExternalFullscreen ? "h-full gap-2" : "gap-4"}`}>
      {/* Video container */}
      <div className={`relative overflow-hidden bg-black/50 group ${isExternalFullscreen ? "flex-1 min-h-0" : "rounded-xl"}`}>
        <video
          ref={videoRef}
          src={src}
          className={`w-full object-contain ${
            isExternalFullscreen ? "h-full" : "max-h-[50vh]"
          }`}
          style={
            crop && hasCrop(crop)
              ? {
                  clipPath: `inset(${(crop.top * 100).toFixed(1)}% ${(crop.right * 100).toFixed(1)}% ${(crop.bottom * 100).toFixed(1)}% ${(crop.left * 100).toFixed(1)}%)`,
                }
              : undefined
          }
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
        <canvas ref={canvasRef} className="hidden" />

        {/* Center overlay play/pause */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
          <button
            onClick={handleTogglePlay}
            className="w-16 h-16 rounded-full bg-foreground/90 flex items-center justify-center text-background backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
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
