import assert from "node:assert/strict";
import test from "node:test";
import {
  getCoverCrop,
  getPreset,
  moveCrop,
  scaleCrop,
} from "./social-composition.ts";

test("Reel crops a landscape source to the video area inside the final palette canvas", () => {
  const reel = getPreset("reel");
  const crop = getCoverCrop(1920, 1080, reel);

  assert.equal(crop.top, 0);
  assert.equal(crop.bottom, 0);
  assert.ok(crop.left > 0.3);
  assert.ok(crop.right > 0.3);
});

test("moving a crop keeps its dimensions and clamps it inside the source video", () => {
  const moved = moveCrop(
    { left: 0.25, right: 0.25, top: 0.1, bottom: 0.1 },
    1,
    -1
  );

  assert.deepEqual(moved, { left: 0.5, right: 0, top: 0, bottom: 0.2 });
});

test("scaling a social crop keeps its target video aspect ratio", () => {
  const square = getPreset("square");
  const initial = getCoverCrop(1920, 1080, square);
  const scaled = scaleCrop(initial, 1920, 1080, square, 0.7);
  const width = 1 - scaled.left - scaled.right;
  const height = 1 - scaled.top - scaled.bottom;
  const targetAspect = square.videoAspectRatio!;

  assert.ok(width < 1 - initial.left - initial.right);
  assert.ok(Math.abs((1920 * width) / (1080 * height) - targetAspect) < 0.0001);
});
