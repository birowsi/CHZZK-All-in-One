// Merge perf-off.json + perf-on.json into qa/performance-results.json with deltas.
"use strict";
const fs = require("fs");
const path = require("path");

const OFF = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "perf-off.json"), "utf8")).summary;
const ON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "perf-on.json"), "utf8")).summary;

const rows = [];
const add = (scenario, metric, unit, base, test, good = "lower") => rows.push({
  scenario, metric, unit,
  baseline: base, extensionOn: test,
  delta: test !== null && base !== null ? +(test - base).toFixed(3) : null,
  verdict: "see-report",
  good,
});

if (OFF.fatal || ON.fatal) {
  console.error("치명 오류 포함:", OFF.fatal ?? "-", ON.fatal ?? "-");
}

// playback
add("PERF-A", "paused samples", "samples/10min", OFF.playback?.pausedSampleCount, ON.playback?.pausedSampleCount);
add("PERF-A", "stall events", "events/10min", OFF.playback?.stallCount, ON.playback?.stallCount);
add("PERF-A", "currentTime advance", "s (10min run)", OFF.playback ? +(OFF.playback.currentTimeEnd - OFF.playback.currentTimeStart).toFixed(1) : null, ON.playback ? +(ON.playback.currentTimeEnd - ON.playback.currentTimeStart).toFixed(1) : null, "higher");
add("PERF-A", "dropped frames", "frames/10min", OFF.playback?.droppedFrames, ON.playback?.droppedFrames);
add("PERF-A", "frame interval p50", "ms", OFF.frameCadence?.p50, ON.frameCadence?.p50);
add("PERF-A", "frame interval p95", "ms", OFF.frameCadence?.p95, ON.frameCadence?.p95);
add("PERF-A", "frame interval p99", "ms", OFF.frameCadence?.p99, ON.frameCadence?.p99);
add("PERF-A", "hitch windows (>50ms frames)", "windows/3", OFF.frameCadence?.hitchWindows, ON.frameCadence?.hitchWindows);

// process (QA firefox only)
add("PERF-A", "QA firefox CPU", "% of one core", OFF.process?.avgCpuPercent, ON.process?.avgCpuPercent);
add("PERF-A", "QA firefox working set delta", "MB/10min", OFF.process?.workingSetDeltaMB, ON.process?.workingSetDeltaMB);

// network
const offNet = OFF.network ?? {}, onNet = ON.network ?? {};
const hosts = [...new Set([...Object.keys(offNet), ...Object.keys(onNet)])];
for (const host of hosts) add("PERF-A", `HTTP ${host}`, "responses/10min", offNet[host] ?? 0, onNet[host] ?? 0);

// DOM
add("PERF-A", "extension DOM nodes end", "nodes", OFF.dom?.hanbiNodesEnd ?? 0, ON.dom?.hanbiNodesEnd ?? 0);
add("PERF-A", "duplicate extension ids", "ids", (OFF.dom?.duplicateIds ?? []).length, (ON.dom?.duplicateIds ?? []).length);

const report = {
  generatedAt: new Date().toISOString(),
  channel: ON.channel ?? OFF.channel,
  offRun: { startedAt: OFF.startedAt, minutes: OFF.minutes },
  onRun: { startedAt: ON.startedAt, minutes: ON.minutes },
  caveats: [
    "동일 방송·동일 시간대 연속 실행(순차). 네트워크/방송 품질 변동은 완전히 통제되지 않음.",
    "CPU/메모리는 QA 세션 Firefox 프로세스만 집계(사용자 실행 브라우저 PID 제외).",
    "확장 OFF 실행에도 CHZZK 자체 네트워크·프레임 특성이 포함되므로 절대값보다 delta 해석.",
    "실광고/GRID/제한중계는 이 실행에서 강제 불가 — fixture 기반 회귀 테스트로 보완, 아래 unverified 참조.",
  ],
  rows,
};
fs.writeFileSync(path.resolve(__dirname, "..", "performance-results.json"), JSON.stringify(report, null, 2));
console.table(rows.map((r) => ({ scenario: r.scenario, metric: r.metric, baseline: r.baseline, on: r.extensionOn, delta: r.delta })));
console.log("저장: qa/performance-results.json");
