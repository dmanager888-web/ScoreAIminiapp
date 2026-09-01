import { defineConfig, loadEnv, type PreviewServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

function proxyJson(
  server: ViteDevServer | PreviewServer,
  matchPath: string,
  target: string,
) {
  server.middlewares.use(async (req, res, next) => {
    const raw = req.url ?? "";
    if (req.method !== "POST" || !raw.startsWith(matchPath)) {
      next();
      return;
    }
    if (!target) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "ai_not_configured" }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString("utf8") || "{}";

    try {
      const remote = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await remote.text();
      res.statusCode = remote.status;
      res.setHeader("Content-Type", remote.headers.get("content-type") || "application/json");
      res.end(text || JSON.stringify({ ok: remote.ok }));
    } catch {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "ai_failed" }));
    }
  });
}

function backendProxy(postbackBase: string, secret: string, botApiBase: string) {
  return {
    name: "backend-proxy",
    configureServer(server: ViteDevServer) {
      attachPostback(server, postbackBase, secret);
      proxyJson(server, "/api/ai/predict", `${botApiBase}/miniapp/predict`);
      proxyJson(server, "/api/ai/saldo", `${botApiBase}/miniapp/saldo`);
    },
    configurePreviewServer(server: PreviewServer) {
      attachPostback(server, postbackBase, secret);
      proxyJson(server, "/api/ai/predict", `${botApiBase}/miniapp/predict`);
      proxyJson(server, "/api/ai/saldo", `${botApiBase}/miniapp/saldo`);
    },
  };
}

function attachPostback(
  server: ViteDevServer | PreviewServer,
  postbackBase: string,
  secret: string,
) {
  server.middlewares.use(async (req, res, next) => {
    const raw = req.url ?? "";
    if (!raw.startsWith("/api/postback")) {
      next();
      return;
    }

    const incoming = new URL(raw, "http://127.0.0.1");
    const sub1 = incoming.searchParams.get("sub1") ?? "";
    if (!sub1 || !secret || !postbackBase) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "missing_sub1" }));
      return;
    }

    const target = new URL(postbackBase);
    target.searchParams.set("sub1", sub1);
    target.searchParams.set("secret", secret);

    try {
      const remote = await fetch(target);
      const text = await remote.text();
      res.statusCode = remote.status;
      res.setHeader("Content-Type", remote.headers.get("content-type") || "application/json");
      res.end(text || JSON.stringify({ ok: remote.ok }));
    } catch {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "postback_failed" }));
    }
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const botApiBase = (
    env.BOT_API_BASE || "https://placar-bot-production.up.railway.app"
  ).replace(/\/$/, "");
  return {
    plugins: [
      react(),
      backendProxy(
        env.POSTBACK_BASE || "https://placar-bot-production.up.railway.app/postback",
        env.POSTBACK_SECRET || "",
        botApiBase,
      ),
    ],
    server: {
      host: "127.0.0.1",
      port: 5173,
    },
  };
});

