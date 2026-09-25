(function (root) {
  "use strict";

  const compatibleMp4 = [
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
  ];

  function conversionSpec(kind, options = {}) {
    switch (kind) {
      case "mp4":
        return { output: "output.mp4", ext: "mp4", mime: "video/mp4", args: compatibleMp4 };
      case "gif":
        return { output: "output.gif", ext: "gif", mime: "image/gif", args: ["-an", "-vf", "fps=15,scale=640:-1:flags=lanczos", "-loop", "0"] };
      case "webp":
        return { output: "output.webp", ext: "webp", mime: "image/webp", args: ["-an", "-vf", "fps=15,scale=640:-1:flags=lanczos", "-c:v", "libwebp", "-loop", "0"] };
      case "trim": {
        const start = Number(options.start);
        const end = Number(options.end);
        if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start) throw new Error("종료 시간은 시작 시간보다 커야 합니다.");
        const format = options.format || "mp4";
        const formats = {
          mp4: compatibleMp4,
          webm: ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "5", "-b:v", "0", "-crf", "20", "-c:a", "libopus", "-b:a", "160k"],
          gif: conversionSpec("gif").args,
          webp: conversionSpec("webp").args,
        };
        if (!Object.hasOwn(formats, format)) throw new Error("지원하지 않는 자르기 형식입니다.");
        const mime = { mp4: "video/mp4", webm: "video/webm", gif: "image/gif", webp: "image/webp" }[format];
        return { output: `output-trim.${format}`, ext: format, mime, suffix: `_${start}-${end}s`, preInput: ["-ss", String(start)], args: ["-t", String(end - start), ...formats[format]] };
      }
      case "split": {
        const seconds = Math.floor(Number(options.seconds));
        if (!Number.isFinite(seconds) || seconds < 1) throw new Error('분할 간격은 1초 이상이어야 합니다.');
        const format = options.format || "mp4";
        if (!["mp4", "webm", "gif", "webp"].includes(format)) throw new Error("지원하지 않는 분할 형식입니다.");
        if (format !== "mp4") return { split: "chunks", seconds, format, ext: format };
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
