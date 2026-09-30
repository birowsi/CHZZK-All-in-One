// Probe: install unpacked extension dir via BiDi webExtension.install.
"use strict";
const { spawn } = require("child_process");
const path = require("path");

(async () => {
  const root = path.resolve(__dirname, "..", "..");  // project root (contains manifest.json)
  const xpi = process.argv[2] || null;               // optional: test archivePath with this
  console.log("root:", root, "exists:", require("fs").existsSync(path.join(root, "manifest.json")));

  const proc = spawn("node_modules/geckodriver/geckodriver.exe", ["--port", "4499", "--websocket-port", "9888"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((r) => setTimeout(r, 2500));
  try {
    const res = await fetch("http://127.0.0.1:4499/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capabilities: { alwaysMatch: { browserName: "firefox", webSocketUrl: true, "moz:firefoxOptions": { args: ["-headless"] } } } }),
    });
    const body = (await res.json()).value;
    const id = body.sessionId;
    const ws = new WebSocket(body.capabilities.webSocketUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let nextId = 1;
    const send = (method, params) => new Promise((resolve, reject) => {
      const tid = nextId++;
      ws.onmessage = function h(ev) { const m = JSON.parse(ev.data); if (m.id === tid) { ws.removeEventListener("message", h); m.type === "error" ? reject(new Error(m.error + ": " + m.message)) : resolve(m.result); } };
      ws.send(JSON.stringify({ id: tid, method, params }));
    });
    try {
      const extData = xpi ? { type: "archivePath", path: xpi } : { type: "path", path: root };
      const installed = await send("webExtension.install", { extensionData: extData });
      console.log("INSTALL OK:", JSON.stringify(installed));
    } catch (e) { console.log("INSTALL FAILED:", e.message.slice(0, 300)); }
    try { ws.close(); } catch (_) {}
    await fetch("http://127.0.0.1:4499/session/" + id, { method: "DELETE" }).catch(() => {});
  } finally {
    await new Promise((r) => setTimeout(r, 600));
    proc.kill();
    process.exit(0);
  }
})();
