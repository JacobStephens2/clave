import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { MiddlewareHandler } from "hono";

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

/** Serves the built client. HTML responses carry script-src 'self'. */
export function serveClientAssets(clientDist: string): MiddlewareHandler {
  return async (context) => {
    if (!existsSync(clientDist)) {
      return context.json({ service: "clave", message: "Client assets have not been built yet." });
    }
    const requested = context.req.path === "/" ? "index.html" : context.req.path.slice(1);
    const safePath = requested.includes("..") ? "index.html" : requested;
    const candidate = join(clientDist, safePath);
    const path = existsSync(candidate) ? candidate : join(clientDist, "index.html");
    const body = await readFile(path);
    const headers: Record<string, string> = {
      "Content-Type": mimeTypes[extname(path)] ?? "application/octet-stream",
    };
    if (extname(path) === ".html") headers["Content-Security-Policy"] = "script-src 'self'";
    return context.body(body, 200, headers);
  };
}
