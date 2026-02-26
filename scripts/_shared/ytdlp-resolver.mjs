import { execSync } from "child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

const RELEASE_BASE_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function isWindows() {
  return process.platform === "win32";
}

function commandExists(command) {
  const lookupCmd = isWindows() ? `where ${command}` : `command -v ${command}`;
  try {
    const output = execSync(lookupCmd, { encoding: "utf-8" }).trim();
    if (!output) return null;
    return output.split(/\r?\n/)[0].trim();
  } catch {
    return null;
  }
}

function isExecutable(pathOrCommand) {
  try {
    execSync(`"${pathOrCommand}" --version`, {
      stdio: "ignore",
      timeout: 10_000,
    });
    return true;
  } catch {
    return false;
  }
}

function getDownloadCandidates(platform, arch) {
  if (platform === "win32") {
    return ["yt-dlp.exe"];
  }

  if (platform === "darwin") {
    if (arch === "arm64") {
      return ["yt-dlp_macos", "yt-dlp_macos_aarch64", "yt-dlp"];
    }
    return ["yt-dlp_macos", "yt-dlp"];
  }

  if (platform === "linux") {
    if (arch === "arm64") {
      return ["yt-dlp_linux_aarch64", "yt-dlp_linux", "yt-dlp"];
    }
    if (arch === "arm" || arch === "armv7l") {
      return ["yt-dlp_linux_armv7l", "yt-dlp_linux", "yt-dlp"];
    }
    if (arch === "x64") {
      return ["yt-dlp_linux", "yt-dlp"];
    }
    return ["yt-dlp_linux", "yt-dlp"];
  }

  return ["yt-dlp"];
}

async function downloadToPath(url, destinationPath) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  writeFileSync(destinationPath, data);
}

async function downloadYtDlp(targetPath) {
  const candidates = getDownloadCandidates(process.platform, process.arch);
  let lastError = null;

  for (const assetName of candidates) {
    const url = `${RELEASE_BASE_URL}/${assetName}`;
    try {
      await downloadToPath(url, targetPath);
      if (!isWindows()) {
        chmodSync(targetPath, 0o755);
      }
      if (!isExecutable(targetPath)) {
        throw new Error("Downloaded binary is not executable");
      }
      return { path: targetPath, source: "download", assetName, url };
    } catch (error) {
      lastError = error;
      rmSync(targetPath, { force: true });
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(
    `Unable to download a working yt-dlp binary for ${process.platform}/${process.arch}: ${reason}`
  );
}

export async function resolveYtDlpBinary() {
  const envPath = process.env.YTDLP_PATH?.trim();
  if (envPath && isExecutable(envPath)) {
    return { path: envPath, source: "env" };
  }

  const systemPath = commandExists("yt-dlp");
  if (systemPath && isExecutable(systemPath)) {
    return { path: systemPath, source: "system" };
  }

  const cacheDir = process.env.YTDLP_CACHE_DIR?.trim() || join(tmpdir(), "ytdlp-bin");
  const binaryName = isWindows() ? "yt-dlp.exe" : "yt-dlp";
  const cachedPath = join(cacheDir, binaryName);

  mkdirSync(cacheDir, { recursive: true });

  if (existsSync(cachedPath) && isExecutable(cachedPath)) {
    return { path: cachedPath, source: "cache" };
  }

  return downloadYtDlp(cachedPath);
}

