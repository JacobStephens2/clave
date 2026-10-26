import { expect, test, type Page } from "@playwright/test";
import { gameAt, resumeSeeded } from "./game-states.js";

/**
 * The house band: two loops made for Clave, one per phrase of the song. Chromium renders
 * Web Audio headlessly, so these specs read the band off the drawer's own attributes —
 * `data-music` for what it is doing and `data-cue` for which loop is sounding — and off the
 * network, which is the honest test of "off by default": a band that never loaded.
 */

const LLORARAS_URL = "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf";

/** The drawer is aria-hidden while shut, so its state is read through the class instead. */
const drawer = (page: Page) => page.locator(".music-player-drawer");
const panel = (page: Page) => page.getByRole("complementary", { name: "Music" });
const bandToggle = (page: Page) => page.getByRole("button", { name: /^House band/ });

/** Every request for a loop, in order, so a spec can prove one was or was not fetched. */
function watchAudio(page: Page): string[] {
  const asked: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/audio/")) asked.push(path);
  });
  return asked;
}

async function openDrawer(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Open music/ }).click();
  await expect(panel(page)).toBeVisible();
}

async function startHotseat(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await page.getByRole("button", { name: "I’m the Lead" }).click();
}

test("keeps the band off, silent and unloaded until a player asks for it", async ({ page }) => {
  const asked = watchAudio(page);
  await page.goto("/");

  await expect(drawer(page)).toHaveAttribute("data-music", "off");
  await openDrawer(page);
  await expect(bandToggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(panel(page)).toContainText("House band off");
  await expect(panel(page)).toContainText("Original music made for Clave with Suno");
  await expect(panel(page).getByRole("link", { name: /Llorarás in Spotify/ })).toHaveAttribute(
    "href",
    LLORARAS_URL,
  );
  expect(asked).toEqual([]);

  // The home screen takes the preference and plays nothing: there is no dance to play under.
  await bandToggle(page).click();
  await expect(bandToggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(drawer(page)).toHaveAttribute("data-music", "idle");
  expect(asked).toEqual([]);

  // Asked for at home, the band comes in with the dance.
  await startHotseat(page);
  await expect(drawer(page)).toHaveAttribute("data-music", "playing", { timeout: 20_000 });
  await expect(drawer(page)).toHaveAttribute("data-cue", "cuerpo");
  expect(asked).toContain("/audio/cuerpo.mp3");
});

test("plays the cuerpo, remembers the band across a reload, and goes quiet on request", async ({
  page,
}) => {
  const asked = watchAudio(page);
  await page.goto("/");
  await startHotseat(page);
  await openDrawer(page);
  await bandToggle(page).click();

  await expect(drawer(page)).toHaveAttribute("data-music", "playing", { timeout: 20_000 });
  await expect(drawer(page)).toHaveAttribute("data-cue", "cuerpo");
  await expect(panel(page)).toContainText("House band on");
  expect(asked).toContain("/audio/cuerpo.mp3");
  expect(await page.evaluate(() => localStorage.getItem("clave.music.v1"))).toBe("on");

  // A reload cannot start audio by itself, so the band waits for the next gesture — here the
  // click that resumes the saved dance — and nobody has to ask for it twice.
  await page.reload();
  await expect(drawer(page)).toHaveAttribute("data-music", "idle");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: /^I’m the/ }).click();
  await expect(drawer(page)).toHaveAttribute("data-music", "playing", { timeout: 20_000 });

  await openDrawer(page);
  await bandToggle(page).click();
  await expect(drawer(page)).toHaveAttribute("data-music", "off");
  await expect(drawer(page)).not.toHaveAttribute("data-cue");
  expect(await page.evaluate(() => localStorage.getItem("clave.music.v1"))).toBe("off");
});

test("takes the montuno once the song crosses into the second phrase", async ({ page }) => {
  const asked = watchAudio(page);
  const montuno = gameAt(
    (view) => view.status === "playing" && view.currentSong?.section === "Montuno",
  );
  const view = await resumeSeeded(page, montuno);
  expect(view.phrase.number).toBe(2);

  await openDrawer(page);
  await bandToggle(page).click();
  await expect(drawer(page)).toHaveAttribute("data-music", "playing", { timeout: 20_000 });
  await expect(drawer(page)).toHaveAttribute("data-cue", "montuno");
  expect(asked).toContain("/audio/montuno.mp3");
});
