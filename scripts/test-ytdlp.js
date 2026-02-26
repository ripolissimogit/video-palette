import { execSync } from "child_process";
import { resolveYtDlpBinary } from "./_shared/ytdlp-resolver.mjs";

const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

function findNodePath() {
  const lookupCmd = process.platform === "win32" ? "where node" : "command -v node";
  const output = execSync(lookupCmd, { encoding: "utf-8" }).trim();
  return output.split(/\r?\n/)[0].trim();
}

const resolved = await resolveYtDlpBinary();
const nodePath = findNodePath();

console.log(`[ytdlp] Using ${resolved.path} (${resolved.source})`);
console.log("Node.js path:", nodePath);

const strategies = [
  {
    name: "nodejs runtime + ios client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=ios"`,
  },
  {
    name: "nodejs runtime + android client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=android"`,
  },
  {
    name: "nodejs runtime + mweb client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=mweb"`,
  },
  {
    name: "nodejs runtime + tv client",
    args: `--js-runtimes nodejs:${nodePath} --extractor-args "youtube:player_client=tv"`,
  },
  {
    name: "nodejs runtime + default clients",
    args: `--js-runtimes nodejs:${nodePath}`,
  },
];

let success = false;

for (const strategy of strategies) {
  console.log(`\n--- Testing: ${strategy.name} ---`);
  const cmd = `"${resolved.path}" ${strategy.args} --dump-json --no-download -f "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]" "${VIDEO}" 2>&1`;
  try {
    const output = execSync(cmd, { timeout: 30_000, encoding: "utf-8" });
    const jsonLine = output
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith("{"));

    if (!jsonLine) {
      console.log("No JSON found in output:");
      console.log(output.slice(0, 500));
      continue;
    }

    const data = JSON.parse(jsonLine);
    console.log("SUCCESS! Title:", data.title);
    console.log("Format:", data.format);
    console.log("URL available:", !!data.url);
    console.log("Requested formats:", data.requested_formats?.length || 0);
    if (Array.isArray(data.requested_formats)) {
      data.requested_formats.forEach((format, index) => {
        console.log(
          `  Format ${index}: ${format.format} | ext: ${format.ext} | vcodec: ${format.vcodec} | acodec: ${format.acodec}`
        );
      });
    }
    success = true;
    break;
  } catch (error) {
    const err = error;
    const stderr =
      err?.stderr?.toString() || err?.stdout?.toString() || err?.message || "";
    console.log("FAILED:", stderr.slice(0, 400));
  }
}

if (!success) {
  console.error("All yt-dlp strategies failed.");
  process.exitCode = 1;
}
