import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync, writeFileSync } from "fs";

export const maxDuration = 60;

const YTDLP_DIR = "/tmp/ytdlp-bin";
const YTDLP_PATH = `${YTDLP_DIR}/yt-dlp`;
const YTDLP_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

// Ensure yt-dlp binary is available in /tmp
async function ensureYtDlp(): Promise<string> {
  if (existsSync(YTDLP_PATH)) return YTDLP_PATH;

  if (!existsSync(YTDLP_DIR)) {
    mkdirSync(YTDLP_DIR, { recursive: true });
  }

  console.log("[youtube] Downloading yt-dlp binary...");
  const res = await fetch(YTDLP_URL);
  if (!res.ok) throw new Error(`Failed to download yt-dlp: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(YTDLP_PATH, buffer);
  chmodSync(YTDLP_PATH, 0o755);

  const version = execSync(`"${YTDLP_PATH}" --version`, {
    encoding: "utf-8",
  }).trim();
  console.log(`[youtube] yt-dlp ${version} ready`);

  return YTDLP_PATH;
}

// Extract YouTube video ID from various URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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
    const ytdlp = await ensureYtDlp();

    // Use yt-dlp --dump-json to get video info + stream URL.
    // IMPORTANT: export needs a SINGLE progressive stream with both video+audio.
    // Avoid split DASH selections (bv+ba) because they often return video-only URLs.
    const formatStr =
      "best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/b[ext=mp4][vcodec!=none][acodec!=none]/b[vcodec!=none][acodec!=none]";

    const cmd = `"${ytdlp}" -j --no-download -f "${formatStr}" "https://www.youtube.com/watch?v=${videoId}"`;

    console.log("[youtube] Running yt-dlp for video:", videoId);

    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const data = JSON.parse(output);

    // Prefer direct progressive URL when available
    let streamUrl = typeof data.url === "string" ? data.url : "";
    const title = data.title || `youtube-${videoId}`;
    const duration = data.duration || 0;
    const width = data.width || 0;
    const height = data.height || 0;
    const acodec = typeof data.acodec === "string" ? data.acodec : "none";
    const vcodec = typeof data.vcodec === "string" ? data.vcodec : "none";

    // Fallback: if yt-dlp still returned split formats, try to find a muxed entry.
    if ((!streamUrl || acodec === "none" || vcodec === "none") && Array.isArray(data.requested_formats)) {
      const muxed = data.requested_formats.find(
        (f: { url?: string; acodec?: string; vcodec?: string }) =>
          typeof f?.url === "string" &&
          f?.acodec &&
          f?.acodec !== "none" &&
          f?.vcodec &&
          f?.vcodec !== "none"
      );
      if (muxed?.url) {
        streamUrl = muxed.url;
      }
    }

    if (!streamUrl) {
      return NextResponse.json(
        {
          error:
            "No stream URL found. The video may be restricted or unavailable.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      videoId,
      title,
      duration,
      streamUrl,
      width,
      height,
      hasAudio: acodec !== "none",
    });
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

// POST /api/youtube - proxies the stream to avoid CORS
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const streamUrl = body?.streamUrl;

  if (!streamUrl) {
    return NextResponse.json(
      { error: "Missing streamUrl" },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const res = await fetch(streamUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://www.youtube.com/",
        Origin: "https://www.youtube.com",
      },
    });
    clearTimeout(timeout);

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
  } catch (error) {
    console.error("[youtube] Stream proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to stream video: ${message}` },
      { status: 500 }
    );
  }
}
