import { randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { ensureMergedVideo } from "@/lib/server/youtube-utils";

export type MergeJobStatus = "queued" | "processing" | "ready" | "failed";

export interface MergeJob {
  id: string;
  videoId: string;
  status: MergeJobStatus;
  message: string;
  error: string | null;
  mergedPath: string | null;
  fallbackStreamUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

interface PersistedStore {
  jobs: MergeJob[];
}

interface MergeJobRuntime {
  initialized: boolean;
  jobs: Map<string, MergeJob>;
  byVideoId: Map<string, string>;
  queue: string[];
  activeWorkers: number;
}

const STORE_PATH = "/tmp/youtube-merge-jobs/store.json";
const STORE_DIR = "/tmp/youtube-merge-jobs";
const JOB_TTL_MS = readPositiveInt(process.env.YT_JOB_TTL_MS, 6 * 60 * 60 * 1000);
const MAX_CONCURRENT_MERGES = readPositiveInt(process.env.YT_MERGE_CONCURRENCY, 2);

declare global {
  var __youtubeMergeJobRuntime: MergeJobRuntime | undefined;
}

function readPositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function getRuntime(): MergeJobRuntime {
  if (!globalThis.__youtubeMergeJobRuntime) {
    globalThis.__youtubeMergeJobRuntime = {
      initialized: false,
      jobs: new Map<string, MergeJob>(),
      byVideoId: new Map<string, string>(),
      queue: [],
      activeWorkers: 0,
    };
  }
  return globalThis.__youtubeMergeJobRuntime;
}

function ensureStoreDir() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function persist(runtime: MergeJobRuntime) {
  ensureStoreDir();
  const data: PersistedStore = {
    jobs: [...runtime.jobs.values()],
  };
  const tmp = `${STORE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, STORE_PATH);
}

function rebuildIndexes(runtime: MergeJobRuntime) {
  runtime.byVideoId.clear();
  for (const job of runtime.jobs.values()) {
    runtime.byVideoId.set(job.videoId, job.id);
  }
}

function cleanupExpiredJobs(runtime: MergeJobRuntime): boolean {
  const now = Date.now();
  const removed = new Set<string>();

  for (const [jobId, job] of runtime.jobs.entries()) {
    if (job.status === "processing") continue;
    if (now - job.updatedAt <= JOB_TTL_MS) continue;
    runtime.jobs.delete(jobId);
    removed.add(jobId);
  }

  if (removed.size > 0) {
    runtime.queue = runtime.queue.filter((id) => !removed.has(id));
    rebuildIndexes(runtime);
    return true;
  }
  return false;
}

function loadPersistedState(runtime: MergeJobRuntime) {
  if (!existsSync(STORE_PATH)) return;

  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as PersistedStore;
    if (!parsed || !Array.isArray(parsed.jobs)) return;

    for (const candidate of parsed.jobs) {
      if (!candidate || typeof candidate.id !== "string") continue;
      if (!candidate.videoId || typeof candidate.videoId !== "string") continue;

      const normalized: MergeJob = {
        ...candidate,
        status: candidate.status,
        message: candidate.message || "Queued for processing...",
        error: candidate.error || null,
        mergedPath: candidate.mergedPath || null,
        fallbackStreamUrl: candidate.fallbackStreamUrl || null,
        createdAt: Number(candidate.createdAt) || Date.now(),
        updatedAt: Number(candidate.updatedAt) || Date.now(),
      };

      if (normalized.status === "processing") {
        normalized.status = "queued";
        normalized.message = "Resumed after restart...";
        normalized.error = null;
      }

      runtime.jobs.set(normalized.id, normalized);
      if (normalized.status === "queued") {
        runtime.queue.push(normalized.id);
      }
    }
    rebuildIndexes(runtime);
    cleanupExpiredJobs(runtime);
  } catch {
    // Corrupted state file should not prevent service startup.
    try {
      unlinkSync(STORE_PATH);
    } catch {
      // no-op
    }
  }
}

function ensureInitialized(runtime: MergeJobRuntime) {
  if (runtime.initialized) return;
  loadPersistedState(runtime);
  runtime.initialized = true;
  persist(runtime);
}

async function processJob(jobId: string) {
  const runtime = getRuntime();
  const job = runtime.jobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.message = "Processing high-quality video...";
  job.updatedAt = Date.now();
  persist(runtime);

  try {
    const mergedPath = await ensureMergedVideo(job.videoId);
    job.mergedPath = mergedPath;
    job.status = "ready";
    job.message = "High-quality stream ready";
    job.error = null;
    job.updatedAt = Date.now();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[youtube-merge] job ${jobId} (${job.videoId}) FAILED:`, msg);
    job.status = "failed";
    job.error = msg;
    job.message = "Failed to prepare high-quality stream";
    job.updatedAt = Date.now();
  } finally {
    persist(runtime);
  }
}

export function startMergeQueue() {
  const runtime = getRuntime();
  ensureInitialized(runtime);
  if (cleanupExpiredJobs(runtime)) {
    persist(runtime);
  }

  while (
    runtime.activeWorkers < MAX_CONCURRENT_MERGES &&
    runtime.queue.length > 0
  ) {
    const jobId = runtime.queue.shift();
    if (!jobId) break;

    const job = runtime.jobs.get(jobId);
    if (!job || job.status !== "queued") {
      continue;
    }

    runtime.activeWorkers += 1;
    persist(runtime);

    void processJob(jobId).finally(() => {
      const rt = getRuntime();
      rt.activeWorkers = Math.max(0, rt.activeWorkers - 1);
      cleanupExpiredJobs(rt);
      persist(rt);
      startMergeQueue();
    });
  }
}

export function getQueuePosition(jobId: string): number {
  const runtime = getRuntime();
  ensureInitialized(runtime);
  return runtime.queue.indexOf(jobId) + 1;
}

export function getMergeJob(jobId: string): MergeJob | null {
  const runtime = getRuntime();
  ensureInitialized(runtime);
  if (cleanupExpiredJobs(runtime)) {
    persist(runtime);
  }
  const job = runtime.jobs.get(jobId);
  if (!job) return null;
  return job;
}

export function createOrReuseMergeJob(
  videoId: string,
  fallbackStreamUrl: string | null
): MergeJob {
  const runtime = getRuntime();
  ensureInitialized(runtime);
  if (cleanupExpiredJobs(runtime)) {
    persist(runtime);
  }

  const existingId = runtime.byVideoId.get(videoId);
  if (existingId) {
    const existing = runtime.jobs.get(existingId);
    if (existing && existing.status !== "failed") {
      startMergeQueue();
      return existing;
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
    fallbackStreamUrl: fallbackStreamUrl || null,
    createdAt: now,
    updatedAt: now,
  };

  runtime.jobs.set(job.id, job);
  runtime.byVideoId.set(videoId, job.id);
  runtime.queue.push(job.id);
  persist(runtime);
  startMergeQueue();
  return job;
}
