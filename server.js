// server.js
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const PORT = process.env.PORT || 3000;
// DEMO SECRET (replace in production)
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_demo_token_ChangeMe";

const users = { admin: { password: "adminpass" } };

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "missing username/password" });
  const u = users[username];
  if (!u || u.password !== password) return res.status(401).json({ error: "invalid credentials" });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
});

app.get("/clients", (req, res) => {
  const out = [];
  for (const [id, c] of clients) {
    out.push({
      id,
      username: c.meta.username,
      lastSeen: c.meta.lastSeen,
      info: c.meta.info
    });
  }
  res.json(out);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map();

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

wss.on("connection", (ws) => {
  let clientId = null;
  ws.isAlive = true;

  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "auth") {
        const payload = verifyToken(msg.token);
        if (!payload) {
          ws.send(JSON.stringify({ type: "auth_fail", reason: "invalid_token" }));
          return ws.close();
        }
        clientId = `${payload.username}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        clients.set(clientId, {
          ws,
          meta: { username: payload.username, lastSeen: Date.now(), info: { connectedAt: Date.now() } }
        });
        ws.send(JSON.stringify({ type: "auth_ok", clientId }));
        console.log(`[WS] client authenticated: ${clientId}`);
        return;
      }

      if (!clientId) {
        return ws.send(JSON.stringify({ type: "error", error: "not_authenticated" }));
      }

      if (msg.type === "metrics") {
        const c = clients.get(clientId);
        if (!c) return;
        c.meta.lastSeen = Date.now();
        c.meta.info = Object.assign({}, c.meta.info, msg.payload);
        console.log(`[metrics] ${clientId} cpu:${(msg.payload.cpuPercent*100).toFixed(1)}% memFree:${msg.payload.memFree}MB`);
        return;
      }

      if (msg.type === "heartbeat") {
        const c = clients.get(clientId);
        if (c) c.meta.lastSeen = Date.now();
        return;
      }
    } catch (err) {
      console.warn("[WS] invalid message:", err.message);
      ws.send(JSON.stringify({ type: "error", error: "invalid_json" }));
    }
  });

  ws.on("close", () => {
    if (clientId && clients.has(clientId)) {
      clients.delete(clientId);
      console.log(`[WS] client disconnected: ${clientId}`);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] error", err.message);
  });
});

setInterval(() => {
  for (const [id, obj] of clients) {
    const ws = obj.ws;
    if (!ws.isAlive) {
      ws.terminate();
      clients.delete(id);
      console.log(`[WS] terminated dead client ${id}`);
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Static files served from /public (dashboard)`);
});