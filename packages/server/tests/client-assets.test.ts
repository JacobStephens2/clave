import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { serveClientAssets } from "../src/client-assets.js";

describe("static HTML response", () => {
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
