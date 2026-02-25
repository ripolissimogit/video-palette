#!/bin/bash
# Download yt-dlp standalone binary into the project bin folder
set -e

mkdir -p /vercel/share/v0-project/bin

echo "Downloading yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /vercel/share/v0-project/bin/yt-dlp

chmod +x /vercel/share/v0-project/bin/yt-dlp

echo "yt-dlp version:"
/vercel/share/v0-project/bin/yt-dlp --version

echo ""
echo "Testing with a short public domain video..."
/vercel/share/v0-project/bin/yt-dlp --dump-json --no-download "https://www.youtube.com/watch?v=jNQXAC9IVRw" 2>&1 | head -5

echo ""
echo "Done!"
