import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getMergeJob,
  getQueuePosition,
  startMergeQueue,
} from "@/lib/server/youtube-merge-jobs";
import {
  ensureMergedVideo,
  ensureYouTubeThumbnailFallbackVideo,
  isValidVideoId,
  streamLocalMp4,
} from "@/lib/server/youtube-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toPayload(job: {
  id: string;
  videoId: string;
  status: "queued" | "processing" | "ready" | "failed";
  message: string;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}) {
  const queuePosition = job.status === "queued" ? getQueuePosition(job.id) : 0;
  return {
    jobId: job.id,
    videoId: job.videoId,
    status: job.status,
    message: job.message,
    error: job.error,
    queuePosition: queuePosition > 0 ? queuePosition : null,
    streamUrl:
      job.status === "ready" ? `/api/youtube/jobs?jobId=${job.id}&stream=1` : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function buildStreamUrl(videoId: string, fallbackMode?: string | null): string {
  const params = new URLSearchParams({ videoId, stream: "1" });
  if (fallbackMode === "thumbnail") {
    params.set("fallback", "thumbnail");
  }
  return `/api/youtube/jobs?${params.toString()}`;
}

// POST /api/youtube/jobs
// Returns a stateless stream URL. The stream request prepares the MP4 in-process.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const videoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";
  const fallbackMode =
    typeof body?.fallbackMode === "string" ? body.fallbackMode.trim() : null;

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }
  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  const now = Date.now();
  return NextResponse.json({
    jobId: randomUUID(),
    videoId,
    status: "ready",
    message:
      fallbackMode === "thumbnail"
        ? "Thumbnail preview stream ready"
        : "Stream request ready",
    error: null,
    queuePosition: null,
    streamUrl: buildStreamUrl(videoId, fallbackMode),
    createdAt: now,
    updatedAt: now,
  }, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

// GET /api/youtube/jobs?videoId=...&stream=1
// Streams a prepared MP4. Legacy jobId polling remains for older tabs.
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim() || "";
  const stream = request.nextUrl.searchParams.get("stream") === "1";
  const fallback = request.nextUrl.searchParams.get("fallback") === "thumbnail";

  if (stream && videoId) {
    if (!isValidVideoId(videoId)) {
      return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
    }

    const filePath = fallback
      ? await ensureYouTubeThumbnailFallbackVideo(videoId)
      : await ensureMergedVideo(videoId);
    return streamLocalMp4(filePath);
  }

  startMergeQueue();

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = getMergeJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!stream) {
    return NextResponse.json(toPayload(job), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (job.status !== "ready" || !job.mergedPath) {
    return NextResponse.json(
      {
        error: "Job is not ready yet",
        status: job.status,
        message: job.message,
      },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  return streamLocalMp4(job.mergedPath);
}
