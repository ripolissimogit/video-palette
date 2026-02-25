import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureMergedVideo,
  isValidVideoId,
  streamLocalMp4,
} from "@/lib/server/youtube-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type JobStatus = "queued" | "processing" | "ready" | "failed";

interface MergeJob {
  id: string;
  videoId: string;
  status: JobStatus;
  message: string;
  error: string | null;
  mergedPath: string | null;
  fallbackStreamUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

interface JobStore {
  jobs: Map<string, MergeJob>;
  byVideoId: Map<string, string>;
}

const JOB_TTL_MS = 6 * 60 * 60 * 1000;

declare global {
  var __youtubeMergeJobStore: JobStore | undefined;
}

function getStore(): JobStore {
  if (!globalThis.__youtubeMergeJobStore) {
    globalThis.__youtubeMergeJobStore = {
      jobs: new Map<string, MergeJob>(),
      byVideoId: new Map<string, string>(),
    };
  }
  return globalThis.__youtubeMergeJobStore;
}

function cleanupOldJobs() {
  const store = getStore();
  const now = Date.now();

  for (const [jobId, job] of store.jobs.entries()) {
    if (job.status === "processing") continue;
    if (now - job.updatedAt <= JOB_TTL_MS) continue;
    store.jobs.delete(jobId);
    if (store.byVideoId.get(job.videoId) === jobId) {
      store.byVideoId.delete(job.videoId);
    }
  }
}

function toPayload(job: MergeJob) {
  return {
    jobId: job.id,
    videoId: job.videoId,
    status: job.status,
    message: job.message,
    error: job.error,
    streamUrl:
      job.status === "ready" ? `/api/youtube/jobs?jobId=${job.id}&stream=1` : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function runJob(jobId: string): Promise<void> {
  const store = getStore();
  const job = store.jobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.message = "Processing high-quality video...";
  job.updatedAt = Date.now();

  try {
    const mergedPath = await ensureMergedVideo(job.videoId);
    job.mergedPath = mergedPath;
    job.status = "ready";
    job.message = "High-quality stream ready";
    job.updatedAt = Date.now();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    job.status = "failed";
    job.error = message;
    job.message = "Failed to prepare high-quality stream";
    job.updatedAt = Date.now();
  }
}

// POST /api/youtube/jobs
// Creates or reuses an async merge job for a videoId.
export async function POST(request: NextRequest) {
  cleanupOldJobs();

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

  const store = getStore();
  const existingId = store.byVideoId.get(videoId);
  if (existingId) {
    const existing = store.jobs.get(existingId);
    if (existing && existing.status !== "failed") {
      return NextResponse.json(toPayload(existing), {
        status: existing.status === "ready" ? 200 : 202,
      });
    }
  }

  const now = Date.now();
  const job: MergeJob = {
    id: randomUUID(),
    videoId,
    status: "queued",
    message: "Queued for processing...",
    error: null,
    mergedPath: null,
    fallbackStreamUrl: streamUrl,
    createdAt: now,
    updatedAt: now,
  };

  store.jobs.set(job.id, job);
  store.byVideoId.set(videoId, job.id);
  void runJob(job.id);

  return NextResponse.json(toPayload(job), { status: 202 });
}

// GET /api/youtube/jobs?jobId=...&stream=1
// Without stream=1 returns status. With stream=1 returns merged mp4 when ready.
export async function GET(request: NextRequest) {
  cleanupOldJobs();

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";
  const stream = request.nextUrl.searchParams.get("stream") === "1";

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const store = getStore();
  const job = store.jobs.get(jobId);

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
