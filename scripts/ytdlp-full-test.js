import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync } from "fs";

const BIN_DIR = "/tmp/ytdlp-bin";
const YTDLP = `${BIN_DIR}/yt-dlp`;
const URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

// Step 1: Download yt-dlp in the same execution
if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });

if (!existsSync(YTDLP)) {
  console.log("Downloading yt-dlp_linux binary...");
  execSync(`curl -L --fail -o "${YTDLP}" "${URL}"`, { stdio: "inherit", timeout: 60000 });
  chmodSync(YTDLP, 0o755);
  console.log("Downloaded OK");
} else {
  console.log("yt-dlp already in /tmp");
}

// Step 2: Verify
const version = execSync(`"${YTDLP}" --version`, { encoding: "utf-8" }).trim();
console.log("yt-dlp version:", version);

// Step 3: Test strategies
const strategies = [
  { name: "default", args: "" },
  { name: "tv", args: '--extractor-args "youtube:player_client=tv"' },
  { name: "tv_embedded", args: '--extractor-args "youtube:player_client=tv_embedded"' },
  { name: "mediaconnect", args: '--extractor-args "youtube:player_client=mediaconnect"' },
  { name: "ios", args: '--extractor-args "youtube:player_client=ios"' },
  { name: "android", args: '--extractor-args "youtube:player_client=android"' },
  { name: "web_creator", args: '--extractor-args "youtube:player_client=web_creator"' },
  { name: "web_music", args: '--extractor-args "youtube:player_client=web_music"' },
];

let success = false;
for (const s of strategies) {
  console.log(`\n--- ${s.name} ---`);
  try {
    const cmd = `"${YTDLP}" -j --no-download ${s.args} "${VIDEO}"`;
    const result = execSync(cmd, { encoding: "utf-8", timeout: 25000, maxBuffer: 10 * 1024 * 1024 });
    const data = JSON.parse(result);
    console.log("WORKS! Title:", data.title, "| Formats:", data.formats?.length, "| URL:", !!data.url);
    success = true;
    break;
  } catch (err) {
    const msg = (err.stderr || err.message || "").toString().slice(0, 300);
    console.log("FAIL:", msg.includes("bot") ? "bot detection" : msg.includes("unavailable") ? "unavailable" : msg.slice(0, 150));
  }
}

if (!success) {
  console.log("\nAll yt-dlp strategies blocked. Testing Piped API fallback...");
  try {
    const res = execSync('curl -s "https://pipedapi.kavin.rocks/streams/jNQXAC9IVRw"', { encoding: "utf-8", timeout: 10000 });
    const data = JSON.parse(res);
    console.log("Piped OK! Title:", data.title);
    const videoStreams = data.videoStreams?.filter(s => s.videoOnly === false) || [];
    console.log("Combined streams:", videoStreams.length);
    if (videoStreams.length > 0) {
      console.log("Best stream:", videoStreams[0].quality, videoStreams[0].mimeType);
      console.log("URL available:", !!videoStreams[0].url);
    }
  } catch (e) {
    console.log("Piped also failed:", e.message?.slice(0, 200));
  }
}
