// agent.js
const WebSocket = require("ws");
const osUtils = require("os-utils");

// Ganti SERVER_URL jika server tidak di localhost
const SERVER_URL = process.env.SERVER_URL || "ws://localhost:3000";

// DEMO token (ditandatangani dengan secret demo "super_secret_demo_token_ChangeMe")
// TOKEN INI BERLAKU HANYA UNTUK DEMO LOKAL. GANTI DI PRODUKSI.
const TOKEN = process.env.AGENT_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIn0.88iI5penq7svQo-WILwEN6_jqDLgQT2OOUd_BbWhGio";

if (!TOKEN) {
  console.error("ERROR: Token tidak di-set. Set AGENT_TOKEN env atau isi TOKEN variable.");
  process.exit(1);
}

function collectMetrics(cb) {
  osUtils.cpuUsage((cpu) => {
    const totalMemMB = osUtils.totalmem();
    const freeMemMB = osUtils.freemem();
    cb({
      cpuPercent: cpu,
      memTotal: totalMemMB,
      memFree: freeMemMB,
      uptimeSeconds: osUtils.sysUptime()
    });
  });
}

function start() {
  const ws = new WebSocket(SERVER_URL);

  ws.on("open", () => {
    console.log("[agent] connected to server");
    ws.send(JSON.stringify({ type: "auth", token: TOKEN }));

    setInterval(() => {
      collectMetrics((m) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "metrics", payload: m }));
        }
      });
    }, 10000);

    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 5000);
  });

  ws.on("message", (msg) => {
    try {
      const obj = JSON.parse(msg.toString());
      if (obj.type === "auth_ok") {
        console.log("[agent] auth OK. clientId:", obj.clientId);
      } else if (obj.type === "auth_fail") {
        console.error("[agent] auth failed:", obj.reason);
      } else {
        console.log("[agent] message from server:", obj);
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.log("[agent] disconnected — reconnecting in 5s");
    setTimeout(start, 5000);
  });

  ws.on("error", (err) => {
    console.error("[agent] ws error:", err.message);
  });
}

start();