// Cuts test-results/demo/raw.webm (from scripts/record-demo.mjs) into the landing page loop: the waits are cut,
// each kept moment plays at most a few seconds, sped up by a fixed amount, and nothing is added or retouched.
// Writes public/demo.mp4 and public/demo-poster.jpg. Needs ffmpeg.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const dir = "test-results/demo";
const moments = JSON.parse(readFileSync(`${dir}/moments.json`, "utf8"));
// Seconds of the original to keep from each moment, and how much faster to play it.
const plan = { setup: [3, 1.5], opening: [5, 1.5], answer: [1.6, 2], reply: [5, 1.5], coaching: [10.5, 3], changes: [5.8, 2], retry: [4.5, 2], comparison: [7, 1.2] };

const parts = moments.flatMap((moment, index) => {
  const keep = plan[moment.label];
  if (!keep) return [];
  const next = moments[index + 1]?.at ?? moment.at + keep[0];
  return [{ start: moment.at, end: Math.min(next, moment.at + keep[0]), speed: keep[1] }];
});
const filters = parts.map(({ start, end, speed }, index) => `[0:v]trim=${start.toFixed(2)}:${end.toFixed(2)},setpts=(PTS-STARTPTS)/${speed}[v${index}]`);
const graph = `${filters.join(";")};${parts.map((_, index) => `[v${index}]`).join("")}concat=n=${parts.length}:v=1:a=0,fps=25,format=yuv420p[out]`;
const length = parts.reduce((sum, { start, end, speed }) => sum + (end - start) / speed, 0);

execFileSync("ffmpeg", ["-v", "error", "-y", "-i", `${dir}/raw.webm`, "-filter_complex", graph, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-movflags", "+faststart", "public/demo.mp4"], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", "public/demo.mp4", "-frames:v", "1", "-q:v", "6", "public/demo-poster.jpg"], { stdio: "inherit" });
console.log(`public/demo.mp4: ${parts.length} moments, about ${length.toFixed(1)} seconds.`);
