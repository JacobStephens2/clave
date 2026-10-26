import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { MiddlewareHandler } from "hono";

/**
 * Every type this server is prepared to serve: art, audio, fonts, source maps, and the
 * documents. It is deliberately wider than what the client ships today — the audio and font
 * rows are here so a soundtrack or a self-hosted face cannot arrive as a download — and the
 * test beside it holds the other end: every extension the build does emit has a row.
 */
const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".map": "application/json",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Serves the built client. HTML responses carry script-src 'self'. */
export function serveClientAssets(clientDist: string): MiddlewareHandler {
  return async (context) => {
    if (!existsSync(clientDist)) {
      return context.json({ service: "clave", message: "Client assets have not been built yet." });
    }
    const requested = context.req.path === "/" ? "index.html" : context.req.path.slice(1);
    const relativePath = requested.includes("..") ? "index.html" : requested;
    const candidate = join(clientDist, relativePath);
    const path = existsSync(candidate) ? candidate : join(clientDist, "index.html");
    const body = await readFile(path);
    const headers: Record<string, string> = {
      "Content-Type": mimeTypes[extname(path)] ?? "application/octet-stream",
    };
    if (extname(path) === ".html") headers["Content-Security-Policy"] = "script-src 'self'";
    return context.body(body, 200, headers);
  };
}
