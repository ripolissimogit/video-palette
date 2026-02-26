import { NextRequest, NextResponse } from "next/server";
import {
  ensureMergedVideo,
  extractVideoId,
  getYouTubeVideoInfo,
  isValidVideoId,
  streamLocalMp4,
} from "@/lib/server/youtube-utils";

export const maxDuration = 300;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function proxyStreamUrl(streamUrl: string): Promise<NextResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  let res: Response;
  try {
    res = await fetch(streamUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://www.youtube.com/",
        Origin: "https://www.youtube.com",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Upstream request timed out" },
        { status: 504 }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${res.status}` },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("content-type") || "video/mp4";
  const contentLength = res.headers.get("content-length");

  const responseHeaders: HeadersInit = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  };

  if (contentLength) {
    responseHeaders["Content-Length"] = contentLength;
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: responseHeaders,
  });
}

// GET /api/youtube?url=...
// Uses yt-dlp to get video info and direct stream URL
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL" },
      { status: 400 }
    );
  }

  try {
    const info = await getYouTubeVideoInfo(videoId);
    return NextResponse.json(info);
  } catch (error) {
    console.error("[youtube] yt-dlp error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    // Check for common yt-dlp errors
    if (message.includes("Sign in to confirm")) {
      return NextResponse.json(
        {
          error:
            "YouTube is requiring sign-in for this video. Try a different video or direct URL.",
        },
        { status: 403 }
      );
    }
    if (message.includes("Private video") || message.includes("not available")) {
      return NextResponse.json(
        { error: "This video is private or not available." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: `Failed to get video info: ${message.slice(0, 200)}` },
      { status: 500 }
    );
  }
}

// POST /api/youtube
// Preferred mode: download bestvideo+bestaudio and merge server-side with ffmpeg.
// Fallback mode: proxy a single stream URL.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const videoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";
  const streamUrl = typeof body?.streamUrl === "string" ? body.streamUrl.trim() : "";

  if (!videoId && !streamUrl) {
    return NextResponse.json({ error: "Missing videoId or streamUrl" }, { status: 400 });
  }

  try {
    if (videoId) {
      if (!isValidVideoId(videoId)) {
        return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
      }

      try {
        const mergedPath = await ensureMergedVideo(videoId);
        return streamLocalMp4(mergedPath);
      } catch (mergeError) {
        console.error("[youtube] Merge failed, falling back to direct stream proxy", mergeError);
        if (!streamUrl) {
          const message =
            mergeError instanceof Error ? mergeError.message : "Unknown merge error";
          return NextResponse.json(
            { error: `Failed to prepare merged video: ${message}` },
            { status: 500 }
          );
        }
      }
    }

    if (!streamUrl) {
      return NextResponse.json({ error: "Missing streamUrl for fallback" }, { status: 400 });
    }
    if (!isHttpUrl(streamUrl)) {
      return NextResponse.json({ error: "Invalid streamUrl" }, { status: 400 });
    }

    return await proxyStreamUrl(streamUrl);
  } catch (error) {
    console.error("[youtube] Stream proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to stream video: ${message}` },
      { status: 500 }
    );
  }
}
