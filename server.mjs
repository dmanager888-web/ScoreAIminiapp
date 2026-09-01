import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(ROOT, "dist");
const POSTBACK_BASE =
  process.env.POSTBACK_BASE || "https://placar-bot-production.up.railway.app/postback";
const POSTBACK_SECRET = process.env.POSTBACK_SECRET || "";
const BOT_API_BASE = (
  process.env.BOT_API_BASE || "https://placar-bot-production.up.railway.app"
).replace(/\/$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function safeFile(urlPath) {
  const clean = normalize(urlPath.split("?")[0]).replace(/^(\.\.[/\\])+/, "");
  const file = resolve(DIST, `.${clean === "/" ? "/index.html" : clean}`);
  if (!file.startsWith(DIST)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  const index = join(DIST, "index.html");
  return existsSync(index) ? index : null;
}

async function proxyJson(req, res, target) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8") || "{}";

  try {
    const remote = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await remote.text();
    send(
      res,
      remote.status,
      text || JSON.stringify({ ok: remote.ok }),
      remote.headers.get("content-type") || "application/json; charset=utf-8",
    );
  } catch {
    send(res, 502, JSON.stringify({ ok: false, error: "ai_failed" }));
  }
}

async function handlePostback(req, res) {
  const incoming = new URL(req.url || "/", `http://127.0.0.1`);
  const sub1 = incoming.searchParams.get("sub1") || "";
  const sub2 = incoming.searchParams.get("sub2") || "";
  if (!sub1 || !POSTBACK_SECRET) {
    send(res, 400, JSON.stringify({ ok: false, error: "missing_sub1" }));
    return;
  }

  const target = new URL(POSTBACK_BASE);
  target.searchParams.set("sub1", sub1);
  if (sub2) target.searchParams.set("sub2", sub2);
  target.searchParams.set("secret", POSTBACK_SECRET);

  try {
    const remote = await fetch(target);
    const text = await remote.text();
    send(
      res,
      remote.status,
      text || JSON.stringify({ ok: remote.ok }),
      remote.headers.get("content-type") || "application/json; charset=utf-8",
    );
  } catch {
    send(res, 502, JSON.stringify({ ok: false, error: "postback_failed" }));
  }
}

createServer(async (req, res) => {
  const path = req.url || "/";
  if (path.startsWith("/api/postback")) {
    await handlePostback(req, res);
    return;
  }
  if (req.method === "POST" && path.startsWith("/api/ai/predict")) {
    await proxyJson(req, res, `${BOT_API_BASE}/miniapp/predict`);
    return;
  }
  if (req.method === "POST" && path.startsWith("/api/ai/saldo")) {
    await proxyJson(req, res, `${BOT_API_BASE}/miniapp/saldo`);
    return;
  }

  const file = safeFile(path);
  if (!file) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Placar Mini App on ${PORT}`);
});
