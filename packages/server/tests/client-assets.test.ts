import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { serveClientAssets } from "../src/client-assets.js";

/**
 * Every extension `vite build` puts in `packages/client/dist`, read without needing the
 * client built: the files Vite copies verbatim out of `public/` (the card art, the mark, the
 * manifest), plus the four its own output has. `npm test` runs before `npm run build` in CI,
 * so a test that read `dist` would skip in the one place it has to hold.
 */
const publicDirectory = fileURLToPath(new URL("../../client/public", import.meta.url));
const VITE_OUTPUT = [".html", ".js", ".css", ".map"];

async function shippedExtensions(): Promise<string[]> {
  const entries = await readdir(publicDirectory, { recursive: true, withFileTypes: true });
  const copied = entries.filter((entry) => entry.isFile()).map((entry) => extname(entry.name));
  return [...new Set([...copied, ...VITE_OUTPUT])].sort();
}

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function appWithDocument(html: string): Promise<{ app: Hono; root: string }> {
  directory = await mkdtemp(join(tmpdir(), "clave-client-"));
  await writeFile(join(directory, "index.html"), html);
  const app = new Hono();
  app.get("*", serveClientAssets(directory));
  return { app, root: directory };
}

describe("static HTML response", () => {
  it("sends Content-Security-Policy script-src 'self' for the game document", async () => {
    const { app } = await appWithDocument("<!doctype html><title>Clave</title>");
    const response = await app.request("http://127.0.0.1/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe("script-src 'self'");
    expect(await response.text()).toContain("Clave");
  });

  it("sends the same policy when an unknown path falls back to the game document", async () => {
    const { app } = await appWithDocument("<!doctype html><title>Clave</title>");
    const response = await app.request("http://127.0.0.1/play/lead");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe("script-src 'self'");
    expect(await response.text()).toContain("Clave");
  });

  it("still serves a same-origin script as javascript", async () => {
    const { app, root } = await appWithDocument("<!doctype html><title>Clave</title>");
    await writeFile(join(root, "app.js"), "console.log('clave');\n");
    const response = await app.request("http://127.0.0.1/app.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await response.text()).toBe("console.log('clave');\n");
  });
});

describe("static asset media types", () => {
  it("serves the painted art as an image instead of a download", async () => {
    const { app, root } = await appWithDocument("<!doctype html><title>Clave</title>");
    await writeFile(join(root, "home-hero.webp"), "RIFF");
    const response = await app.request("http://127.0.0.1/home-hero.webp");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
  });

  it("names the media type of every file type the server serves", async () => {
    const expected: [file: string, contentType: string][] = [
      ["pos_001.webp", "image/webp"],
      ["cuerpo.mp3", "audio/mpeg"],
      ["montuno.m4a", "audio/mp4"],
      ["cierre.ogg", "audio/ogg"],
      ["clave-mark.svg", "image/svg+xml"],
      ["manifest.webmanifest", "application/manifest+json"],
      ["content.json", "application/json"],
      ["index.js.map", "application/json"],
      ["inter.woff2", "font/woff2"],
      ["screenshot.png", "image/png"],
      ["photo.jpg", "image/jpeg"],
      ["favicon.ico", "image/x-icon"],
    ];
    const { app, root } = await appWithDocument("<!doctype html><title>Clave</title>");
    await Promise.all(expected.map(([file]) => writeFile(join(root, file), "clave")));

    for (const [file, contentType] of expected) {
      const response = await app.request(`http://127.0.0.1/${file}`);
      expect(response.status, file).toBe(200);
      expect(response.headers.get("content-type"), file).toBe(contentType);
    }
  });

  it("hands no file the client actually ships to the browser as a download", async () => {
    // Seven extensions over 34 files as this is written. A new kind of asset in `public/`
    // with no row in the table arrives as application/octet-stream, which a browser saves
    // instead of showing, so it fails here rather than on the dance floor. The set is not
    // pinned — shipping audio one day should not fail a test the audio rows already cover.
    const extensions = await shippedExtensions();
    expect(extensions).toContain(".webp");
    const { app, root } = await appWithDocument("<!doctype html><title>Clave</title>");
    const probes = extensions.map((extension) => `shipped${extension}`);
    await Promise.all(probes.map((file) => writeFile(join(root, file), "clave")));

    for (const file of probes) {
      const response = await app.request(`http://127.0.0.1/${file}`);
      expect(response.status, file).toBe(200);
      expect(response.headers.get("content-type"), file).not.toBe("application/octet-stream");
    }
  });

  it("falls back to the game document for a path the client does not ship", async () => {
    const { app } = await appWithDocument("<!doctype html><title>Clave</title>");
    const response = await app.request("http://127.0.0.1/art/missing.webp");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });
});
