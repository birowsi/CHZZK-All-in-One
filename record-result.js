import { FFmpeg } from "./vendor/ffmpeg/wrapper/index.js";

const api = globalThis.browser ?? globalThis.chrome;
const { conversionSpec } = globalThis.HanbiRecorderLogic;
const video = document.getElementById("result-video");
const status = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progress = document.getElementById("progress");
const progressText = document.getElementById("progress-text");
let recording;
let recordingUrl;
let ffmpeg;
let ffmpegLoading;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function setBusy(busy) {
  document.querySelectorAll("button").forEach((button) => { button.disabled = busy || !recording; });
  progressWrap.hidden = !busy;
}

function safeName(name) {
  return (name || "chzzk-recording").replace(/[\\/:*?"<>|]/g, "_");
}

function download(url, name) {
  return api.downloads.download({ url, filename: name, saveAs: false });
}

async function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  await download(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function loadFFmpeg() {
  if (ffmpeg?.loaded) return ffmpeg;
  if (ffmpegLoading) return ffmpegLoading;
  ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress: value }) => {
    const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
    progress.value = percent;
    progressText.textContent = `${percent}%`;
  });
  ffmpegLoading = ffmpeg.load({
    coreURL: api.runtime.getURL("vendor/ffmpeg/core/ffmpeg-core.js"),
    wasmURL: api.runtime.getURL("vendor/ffmpeg/core/ffmpeg-core.wasm"),
  }).then(() => ffmpeg).catch((error) => {
    ffmpegLoading = null;
    throw error;
  });
  return ffmpegLoading;
}

async function cleanWorkspace(engine) {
  for (const entry of await engine.listDir(".")) {
    if (entry.name === "input.webm" || entry.name.startsWith("output")) {
      await engine.deleteFile(entry.name).catch(() => {});
    }
  }
}

async function convert(kind, options) {
  const spec = conversionSpec(kind, options);
  setBusy(true);
  progress.value = 0;
  progressText.textContent = "준비 중…";
  setStatus("변환기를 불러오는 중…");
  try {
    const engine = await loadFFmpeg();
    await cleanWorkspace(engine);
    setStatus("브라우저에서 변환 중입니다. 이 탭을 닫지 마세요.");
    await engine.writeFile("input.webm", new Uint8Array(await recording.blob.arrayBuffer()));
    const exitCode = await engine.exec(["-i", "input.webm", ...spec.args, spec.output]);
    if (exitCode !== 0) throw new Error("변환기가 작업을 완료하지 못했습니다.");

    if (spec.split) {
      const files = (await engine.listDir("."))
        .filter((entry) => /^output-\d+\.mp4$/.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!files.length) throw new Error("분할된 파일이 없습니다.");
      for (const [index, file] of files.entries()) {
        const data = await engine.readFile(file.name);
        await downloadBlob(new Blob([data], { type: spec.mime }), `${safeName(recording.fileName)}_${String(index + 1).padStart(3, "0")}.${spec.ext}`);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } else {
      const data = await engine.readFile(spec.output);
      await downloadBlob(new Blob([data], { type: spec.mime }), `${safeName(recording.fileName)}${spec.suffix || ""}.${spec.ext}`);
    }
    setStatus("변환과 다운로드를 완료했습니다.");
  } catch (error) {
    console.error("[CHZZK All-in-One recorder]", error);
    setStatus(`${error?.message || "변환에 실패했습니다."} MP4 빠른 변환이 실패하면 호환 변환을 사용하세요.`, true);
  } finally {
    setBusy(false);
  }
}

document.querySelector("[data-action='original']").addEventListener("click", async () => {
  const ext = recording.mimeType.includes("mp4") ? "mp4" : "webm";
  await download(recordingUrl, `${safeName(recording.fileName)}.${ext}`);
});
document.querySelectorAll("[data-convert]").forEach((button) => {
  button.addEventListener("click", () => convert(button.dataset.convert));
});
document.getElementById("trim-form").addEventListener("submit", (event) => {
  event.preventDefault();
  convert("trim", { start: document.getElementById("trim-start").value, end: document.getElementById("trim-end").value });
});
document.getElementById("split-form").addEventListener("submit", (event) => {
  event.preventDefault();
  convert("split", { seconds: document.getElementById("split-seconds").value });
});

video.addEventListener("loadedmetadata", () => {
  const duration = Number.isFinite(video.duration) ? `${video.duration.toFixed(1)}초` : "길이 계산 불가";
  const size = `${(recording.blob.size / 1024 / 1024).toFixed(1)} MB`;
  document.getElementById("file-meta").textContent = `${duration} · ${size} · ${recording.mimeType}`;
  if (Number.isFinite(video.duration)) document.getElementById("trim-end").value = video.duration.toFixed(1);
});

try {
  recording = await api.runtime.sendMessage({ type: "get-recording" });
  if (!(recording?.blob instanceof Blob)) throw new Error("녹화 데이터를 받지 못했습니다. 방송 탭에서 다시 녹화해 주세요.");
  recordingUrl = URL.createObjectURL(recording.blob);
  video.src = recordingUrl;
  document.getElementById("file-name").textContent = recording.fileName;
  setBusy(false);
  setStatus("원본 저장 또는 원하는 형식으로 변환할 수 있습니다.");
} catch (error) {
  setStatus(error?.message || "녹화 데이터를 불러오지 못했습니다.", true);
}

window.addEventListener("pagehide", () => {
  if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  ffmpeg?.terminate();
}, { once: true });
