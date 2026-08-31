import { defineConfig, loadEnv, type PreviewServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

function postbackProxy(postbackBase: string, secret: string) {
  return {
    name: "postback-proxy",
    configureServer(server: ViteDevServer) {
      attachPostback(server, postbackBase, secret);
    },
    configurePreviewServer(server: PreviewServer) {
      attachPostback(server, postbackBase, secret);
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
  return {
    plugins: [
      react(),
      postbackProxy(
        env.POSTBACK_BASE || "https://ai-production-cad5.up.railway.app/postback",
        env.POSTBACK_SECRET || "",
      ),
    ],
    server: {
      host: "127.0.0.1",
      port: 5173,
    },
  };
});
