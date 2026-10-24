import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { serveClientAssets } from "../src/client-assets.js";

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

  it("names the media type of every kind of file the built client ships", async () => {
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

  it("falls back to the game document for a path the client does not ship", async () => {
    const { app } = await appWithDocument("<!doctype html><title>Clave</title>");
    const response = await app.request("http://127.0.0.1/art/missing.webp");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });
});
