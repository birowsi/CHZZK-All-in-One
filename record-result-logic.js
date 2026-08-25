(function (root) {
  "use strict";

  const compatibleMp4 = [
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
  ];

  function conversionSpec(kind, options = {}) {
    switch (kind) {
      case "mp4":
        return { output: "output.mp4", ext: "mp4", mime: "video/mp4", args: ["-c", "copy", "-movflags", "+faststart"] };
      case "mp4-compatible":
        return { output: "output.mp4", ext: "mp4", mime: "video/mp4", args: compatibleMp4 };
      case "gif":
        return { output: "output.gif", ext: "gif", mime: "image/gif", args: ["-an", "-vf", "fps=15,scale=640:-1:flags=lanczos", "-loop", "0"] };
      case "webp":
        return { output: "output.webp", ext: "webp", mime: "image/webp", args: ["-an", "-vf", "fps=15,scale=640:-1:flags=lanczos", "-c:v", "libwebp", "-loop", "0"] };
      case "trim": {
        const start = Math.max(0, Number(options.start) || 0);
        const end = Number(options.end);
        if (!Number.isFinite(end) || end <= start) throw new Error("종료 시간은 시작 시간보다 커야 합니다.");
        return { output: "output-trim.mp4", ext: "mp4", mime: "video/mp4", suffix: `_${start}-${end}s`, args: ["-ss", String(start), "-to", String(end), ...compatibleMp4] };
      }
      case "split": {
        const seconds = Math.max(1, Math.floor(Number(options.seconds) || 0));
        return {
          output: "output-%03d.mp4", ext: "mp4", mime: "video/mp4", split: true,
          args: [
            ...compatibleMp4.slice(0, -2), "-force_key_frames", `expr:gte(t,n_forced*${seconds})`,
            "-f", "segment", "-segment_time", String(seconds), "-reset_timestamps", "1",
          ],
        };
      }
      default:
        throw new Error("지원하지 않는 변환 형식입니다.");
    }
  }

  const api = { conversionSpec };
  if (typeof module !== "undefined") module.exports = api;
  else root.HanbiRecorderLogic = api;
})(globalThis);
