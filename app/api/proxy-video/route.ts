import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only http/https URLs are allowed" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const range = request.headers.get("range");
    const headers: HeadersInit = {
      "User-Agent": "Mozilla/5.0 (compatible; VideoPalette/1.0)",
    };
    if (range) {
      headers["Range"] = range;
    }

    const upstream = await fetch(parsedUrl.toString(), {
      headers,
      signal: controller.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "video/mp4";

    // Only allow video content types
    if (
      !contentType.startsWith("video/") &&
      !contentType.startsWith("application/octet-stream")
    ) {
      return NextResponse.json(
        { error: "URL does not point to a video file" },
        { status: 400 }
      );
    }

    const responseHeaders: HeadersInit = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    };

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) {
      responseHeaders["Content-Range"] = contentRange;
    }

    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) {
      responseHeaders["Accept-Ranges"] = acceptRanges;
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Upstream request timed out" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
