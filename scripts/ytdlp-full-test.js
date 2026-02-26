import { execSync } from "child_process";
import { resolveYtDlpBinary } from "./_shared/ytdlp-resolver.mjs";

const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

const resolved = await resolveYtDlpBinary();
console.log(`[ytdlp] Using ${resolved.path} (${resolved.source})`);

const version = execSync(`"${resolved.path}" --version`, {
  encoding: "utf-8",
}).trim();
console.log("yt-dlp version:", version);

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

for (const strategy of strategies) {
  console.log(`\n--- ${strategy.name} ---`);
  try {
    const cmd = `"${resolved.path}" -j --no-download ${strategy.args} "${VIDEO}"`;
    const result = execSync(cmd, {
      encoding: "utf-8",
      timeout: 25_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);
    console.log(
      "WORKS! Title:",
      data.title,
      "| Formats:",
      data.formats?.length || 0,
      "| URL:",
      !!data.url
    );
    success = true;
    break;
  } catch (error) {
    const err = error;
    const msg =
      (err?.stderr || err?.stdout || err?.message || "").toString().slice(0, 300);
    console.log(
      "FAIL:",
      msg.includes("bot")
        ? "bot detection"
        : msg.includes("unavailable")
          ? "unavailable"
          : msg.slice(0, 150)
    );
  }
}

if (!success) {
  console.log("\nAll yt-dlp strategies blocked. Testing Piped API fallback...");
  try {
    const response = await fetch("https://pipedapi.kavin.rocks/streams/jNQXAC9IVRw", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    console.log("Piped OK! Title:", data.title);
    const videoStreams = (data.videoStreams || []).filter(
      (stream) => stream.videoOnly === false
    );
    console.log("Combined streams:", videoStreams.length);
    if (videoStreams.length > 0) {
      console.log("Best stream:", videoStreams[0].quality, videoStreams[0].mimeType);
      console.log("URL available:", !!videoStreams[0].url);
    }
  } catch (error) {
    const err = error;
    console.log("Piped also failed:", err?.message?.slice(0, 200) || "unknown error");
  }

  process.exitCode = 1;
}
