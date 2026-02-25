import { NextRequest, NextResponse } from "next/server";
import {
  createOrReuseMergeJob,
  getMergeJob,
  getQueuePosition,
  startMergeQueue,
} from "@/lib/server/youtube-merge-jobs";
import {
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

// POST /api/youtube/jobs
// Creates or reuses an async merge job for a videoId.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const videoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";
  const streamUrl =
    typeof body?.streamUrl === "string" ? body.streamUrl.trim() : null;

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }
  if (!isValidVideoId(videoId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  const job = createOrReuseMergeJob(videoId, streamUrl);
  return NextResponse.json(toPayload(job), {
    status: job.status === "ready" ? 200 : 202,
    headers: { "Cache-Control": "no-store" },
  });
}

// GET /api/youtube/jobs?jobId=...&stream=1
// Without stream=1 returns status. With stream=1 returns merged mp4 when ready.
export async function GET(request: NextRequest) {
  startMergeQueue();

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";
  const stream = request.nextUrl.searchParams.get("stream") === "1";

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
