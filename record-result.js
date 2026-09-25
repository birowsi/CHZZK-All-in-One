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
let percentKnown;
const recordingId = new URL(location.href).searchParams.get('id');

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
    if (value > 0 && value <= 1) {
      percentKnown = true;
      const percent = Math.round(value * 100);
      progress.value = percent;
      progressText.textContent = `${percent}%`;
    } else if (!percentKnown) progress.removeAttribute("value");
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
  setBusy(true);
  percentKnown = false;
  progress.removeAttribute("value");
  progressText.textContent = "준비 중…";
  setStatus("변환기를 불러오는 중…");
  let ticker = null;
  try {
    const spec = conversionSpec(kind, options);
    const engine = await loadFFmpeg();
    await cleanWorkspace(engine);
    setStatus("브라우저에서 변환 중입니다. 이 탭을 닫지 마세요. 긴 영상은 수 분 이상 걸릴 수 있습니다.");
    await engine.writeFile("input.webm", new Uint8Array(await recording.blob.arrayBuffer()));
    const startedAt = Date.now();
    ticker = setInterval(() => {
      if (!percentKnown) progressText.textContent = `인코딩 중 · ${Math.round((Date.now() - startedAt) / 1000)}초 경과`;
    }, 1000);
    const command = current => [...(current.preInput || []), "-i", "input.webm", ...current.args, current.output];
    if (spec.split === "chunks") {
      if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("영상 길이를 확인할 수 없어 분할하지 못했습니다.");
      for (let index = 0, start = 0; start < video.duration; index++, start += spec.seconds) {
        const part = conversionSpec("trim", { start, end: Math.min(video.duration, start + spec.seconds), format: spec.format });
        if (await engine.exec(command(part)) !== 0) throw new Error(`${index + 1}번째 분할 변환에 실패했습니다.`);
        const data = await engine.readFile(part.output);
        await downloadBlob(new Blob([data], { type: part.mime }), `${safeName(recording.fileName)}_${String(index + 1).padStart(3, "0")}.${part.ext}`);
        await engine.deleteFile(part.output);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      setStatus("변환과 다운로드를 완료했습니다. 다운로드 폴더에서 분할 파일을 확인하세요.");
      return;
    }
    const exitCode = await engine.exec(command(spec));
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
      setStatus("변환과 다운로드를 완료했습니다. 다운로드 폴더에서 분할 파일을 확인하세요.");
    } else {
      const data = await engine.readFile(spec.output);
      const fileName = `${safeName(recording.fileName)}${spec.suffix || ""}.${spec.ext}`;
      await downloadBlob(new Blob([data], { type: spec.mime }), fileName);
      setStatus(`변환과 다운로드를 완료했습니다. 다운로드 폴더의 "${fileName}" 파일입니다.`);
    }
  } catch (error) {
    console.error("[CHZZK All-in-One recorder]", error);
    setStatus(error?.message || "변환에 실패했습니다.", true);
  } finally {
    if (ticker) clearInterval(ticker);
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
  convert("trim", { start: document.getElementById("trim-start").value, end: document.getElementById("trim-end").value, format: document.getElementById("trim-format").value });
});
document.getElementById("split-form").addEventListener("submit", (event) => {
  event.preventDefault();
  convert("split", { seconds: document.getElementById("split-seconds").value, format: document.getElementById("split-format").value });
});

video.addEventListener("loadedmetadata", () => {
  const duration = Number.isFinite(video.duration) ? `${video.duration.toFixed(1)}초` : "길이 계산 불가";
  const size = `${(recording.blob.size / 1024 / 1024).toFixed(1)} MB`;
  document.getElementById("file-meta").textContent = `${duration} · ${size} · ${recording.mimeType}`;
  if (Number.isFinite(video.duration)) document.getElementById("trim-end").value = video.duration.toFixed(1);
});

try {
  recording = await api.runtime.sendMessage({ type: "get-recording", id: recordingId });
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

document.getElementById('delete-recording').addEventListener('click', async () => {
  if (!confirm('브라우저에 보관된 이 녹화를 삭제할까요? 다운로드한 파일은 유지됩니다.')) return;
  try {
    await api.runtime.sendMessage({ type: 'delete-recording', id: recordingId });
    video.pause(); video.removeAttribute('src'); video.load();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recording = null; setBusy(false); setStatus('보관된 녹화를 삭제했습니다.');
  } catch (error) { setStatus(error.message, true); }
});
