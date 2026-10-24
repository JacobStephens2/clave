import { content } from "@clave/content";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { completedGame, gameAt, lostGame, nextOf, resumeSeeded, viewOf } from "./game-states.js";

/**
 * The call: asking your partner for something, answering it, covering it, and the hold a
 * player with no Move can still leave a floor with. One test walks the whole thing through
 * the UI from a fresh game; the rest start from a real game the engine played to the moment
 * in question, because a Recovery in hand or a whole song danced out is minutes of clicking.
 */

async function acceptPass(page: Page, role: "Lead" | "Follow") {
  await page.getByRole("button", { name: `I’m the ${role}` }).click();
}

/** Deals the same cards every game: the store seeds itself from `crypto.getRandomValues`. */
async function seedDeal(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(1);
        return values;
      },
    });
  });
}

/** Opens a card's enlarged view by clicking its always-visible top edge, as a person would. */
async function openCardDetail(page: Page, card: Locator) {
  await card.click({ position: { x: 40, y: 56 } });
  const detail = page.getByRole("dialog", { name: "Card detail" });
  await expect(detail).toBeVisible();
  return detail;
}

/** Plays a hand card from its enlarged view, the one gesture both phones and desktops share. */
async function playCard(page: Page, card: Locator, action: string) {
  const detail = await openCardDetail(page, card);
  await detail.getByRole("button", { name: action }).click();
  await expect(detail).toBeHidden();
}

/**
 * The button that ends the dance step. It names what taking the song pays when this 8-count
 * met the song card, and says "Dance the basic" while no card has been played.
 */
const endDance = (page: Page) =>
  page.getByRole("button", { name: /^(Take the song|Finish the 8-count|Dance the basic)/ });

const callBanner = (page: Page) =>
  page.getByRole("region", { name: "The call standing over this 8-count" });

const afinqueMeter = (page: Page) => page.locator(".hud-stat.afinque");

/** This game's call rules, so no spec prints a balance number of its own. */
const calls = content.rules.call!;

/** A toast from the snapshot differ, by the line it prints. */
const cue = (page: Page, line: string | RegExp) =>
  page.locator(".snapshot-cues .cue").filter({ hasText: line });

test("calls, hands over, answers, and pays the call out", async ({ page }, testInfo) => {
  // Desktop Chrome's own 720px-tall window cannot show the hand while a call banner is up:
  // the table is over-subscribed and the rail falls below the fold. Phones scroll to it.
  if (testInfo.project.name === "desktop-chrome")
    await page.setViewportSize({ width: 1280, height: 900 });
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Lead");

  // The Lead dances, which is what leaves a floor to call from.
  await playCard(
    page,
    page
      .locator(".hand-scroll .dance-card.position.playable")
      .filter({ hasText: "Closed Position" }),
    "Stage Position",
  );
  await playCard(
    page,
    page.locator(".hand-scroll .dance-card.move.playable").first(),
    "Dance move",
  );

  // The call this song moment marks with a star, and what it pays to give the moment up.
  const favoured = calls.options.find(
    (option) => option.id === content.song.cards[0]!.favouredCall,
  );
  const songPays = (await endDance(page).innerText()).split("·").at(-1)!.trim();

  const trigger = page.getByRole("button", { name: "Make a call" });
  await expect(trigger).toBeEnabled();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();

  const sheet = page.getByRole("dialog", { name: "Make a call" });
  await expect(sheet).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(sheet.locator(".call-sheet-trade")).toHaveText(
    `A call gives up the song’s ${songPays}.`,
  );
  await expect(sheet.locator(".call-option")).toHaveCount(calls.options.length);
  const chosen = sheet.getByRole("button", { name: new RegExp(`^${favoured!.name}\\.`) });
  await expect(chosen).toHaveAccessibleName(/This song card favours it/);
  await chosen.click();
  await expect(sheet).toBeHidden();

  await expect(
    page.getByText(`You called ${favoured!.name}. Your partner answers next 8-count.`),
  ).toBeVisible();
  await expect(cue(page, `You call ${favoured!.name}`)).toBeVisible();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();

  // The handoff leads with the call, because it is the thing the next player has to answer.
  const handoff = page.getByRole("region", { name: "The call you have to answer" });
  await expect(handoff).toContainText("Lead called");
  await expect(handoff).toContainText(favoured!.name);
  await expect(handoff).toContainText(favoured!.ask);
  await acceptPass(page, "Follow");

  const banner = callBanner(page);
  await expect(banner).toContainText(`Lead calls ${favoured!.name}`);
  await expect(banner).toContainText(`Your answer: ${favoured!.ask}.`);
  await expect(banner.getByRole("status")).toHaveText("○ Not answered yet");

  await playCard(
    page,
    page.locator(".hand-scroll .dance-card.move.playable").first(),
    "Dance move",
  );
  await expect(banner.getByRole("status")).toHaveText("✓ Answered · finish to collect");

  await endDance(page).click();
  await expect(cue(page, /answered/)).toContainText(`¡Eso! ${favoured!.name} answered`);
  // A toast is laid over the table, never over the score it is announcing.
  expect(
    await page
      .locator(".snapshot-cues .cue")
      .first()
      .evaluate((toast) => {
        const hud = document.querySelector(".hud")!.getBoundingClientRect();
        return toast.getBoundingClientRect().top >= hud.bottom;
      }),
  ).toBe(true);
  await expect(afinqueMeter(page)).toContainText(
    `Afinque: 1 of ${calls.afinqueBonus.length} links`,
  );
  await expect(
    page.getByRole("article", { name: /^8-count 2\./ }).filter({ hasText: "Follow" }),
  ).toHaveAccessibleName(/Perfect: the call answered/);
});

test("covers a standing call with a Recovery card", async ({ page }) => {
  const standing = gameAt(
    (view) =>
      view.phase === "dance" &&
      view.call !== null &&
      view.legalActions.some((action) => action.type === "COVER_CALL"),
    { learnsRecovery: true },
  );
  const view = await resumeSeeded(page, standing);
  const recovery = view.self.hand.find((card) => card.card.type === "recovery")!.card.name;

  const banner = callBanner(page);
  await expect(banner).toContainText(`calls ${view.call!.name}`);
  const cover = page.getByRole("button", { name: `Cover with ${recovery}` });
  await expect(cover).toHaveAccessibleDescription(/The afinque chain starts over/);
  await cover.click();

  await expect(banner).toHaveCount(0);
  await expect(cue(page, "Nice save")).toBeVisible();
  await expect(afinqueMeter(page)).toContainText(
    `Afinque: 0 of ${calls.afinqueBonus.length} links`,
  );
  await expect(page.getByRole("button", { name: `Cover with ${recovery}` })).toHaveCount(0);

  // The dance step goes on as normal, and ends on Recovered: the call never dropped.
  const count = view.phrase.count;
  await endDance(page).click();
  await expect(
    page.getByRole("article", { name: new RegExp(`^8-count ${count}\\.`) }),
  ).toHaveAccessibleName(/Recovered: the call covered/);
});

test("adjusts the hold before the Move and gives up the song bonus", async ({ page }) => {
  // A floor to adjust, a song moment that is paying right now, and a Move to dance from the
  // new position afterwards — so the forfeit can be seen to last the whole 8-count.
  const held = gameAt((view, envelope) => {
    if (view.phase !== "dance" || view.turn.cardsPlayed !== 0 || view.call !== null) return false;
    if (!view.table.position || view.turn.songBonus === null) return false;
    const adjust = view.legalActions.find((action) => action.type === "ADJUST");
    const after = adjust ? nextOf(envelope, adjust) : null;
    return after !== null && viewOf(after).legalActions.some((a) => a.type === "PLAY_MOVE");
  });
  const view = await resumeSeeded(page, held);
  const floorPosition = view.table.position!.card.name;

  await expect(page.locator(".step-heading strong")).toHaveText(
    "Adjust the hold—or dance the basic",
  );
  await expect(endDance(page)).toHaveText(/^Dance the basic · \+\d/);
  const adjust = page
    .locator(".hand-scroll .dance-card.position.playable")
    .filter({ hasNotText: floorPosition })
    .first();
  const adjustName = await adjust.locator("h4").innerText();

  const detail = await openCardDetail(page, adjust);
  await expect(detail).toContainText("gives up the song bonus this 8-count");
  await detail.getByRole("button", { name: "Adjust the hold" }).click();
  await expect(detail).toBeHidden();

  await expect(page.locator('[data-slot="position"]')).toContainText(adjustName);
  // The song card was paying before the hold; now it pays nothing, and the button says so.
  await expect(endDance(page)).toHaveText("Finish the 8-count");
  await expect(page.locator(".song-card .song-landed")).toHaveCount(0);

  // Dancing on from the new position does not buy the moment back: the hold spent it.
  await playCard(
    page,
    page.locator(".hand-scroll .dance-card.move.playable").first(),
    "Dance move",
  );
  await expect(endDance(page)).toHaveText("Finish the 8-count");
  await expect(page.locator(".song-card .song-landed")).toHaveCount(0);
});

test("ends the song with its illustration and the ladder it was danced on", async ({ page }) => {
  const finished = completedGame();
  const view = viewOf(finished);
  await resumeSeeded(page, finished);

  const recap = page.locator(".song-recap");
  await expect(recap).toHaveAttribute("data-outcome", "completed");
  const illustration = recap.locator(".song-recap-art img");
  await expect(illustration).toBeVisible();
  // The painting decodes a frame or two after the panel it hangs in.
  await expect
    .poll(() =>
      illustration.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await expect(page.getByText("final score")).toBeVisible();
  await expect(recap.locator(".final-score span")).toHaveText(String(view.finalScore));

  const ladder = page.getByRole("region", { name: "How the 8-counts ended" });
  const rungs = ladder.locator(".song-recap-rung");
  await expect(rungs).toHaveCount(5);
  await expect(rungs).toContainText(["Perfect", "Clean", "Awkward", "Recovered", "Break"]);
  const danced = view.danceHistory.length;
  const perfect = view.danceHistory.filter((entry) => entry.rung === "perfect").length;
  await expect(ladder).toContainText(`${danced} of ${view.rules.songLength} danced`);
  await expect(rungs.filter({ hasText: "Perfect" })).toContainText(`${perfect} of ${danced}`);
  await expect(page.getByRole("region", { name: "The two phrases" })).toContainText("Montuno");
  await expect(page.getByRole("region", { name: "The calls" })).toContainText("answered");
  await expect(page.getByRole("button", { name: "Dance again" })).toBeVisible();
});

test("ends a lost dance kindly, on the 8-count the connection ran out", async ({ page }) => {
  const over = lostGame();
  const view = viewOf(over);
  await resumeSeeded(page, over);

  const recap = page.locator(".song-recap");
  await expect(recap).toHaveAttribute("data-outcome", "lost");
  await expect(recap.getByRole("heading", { name: "The dance ends here" })).toBeVisible();
  await expect(recap).toContainText(
    `The connection slipped on 8-count ${view.danceHistory.length} of ${view.rules.songLength}`,
  );
  await expect(recap).toContainText("Mistakes are part of the dance");
  await expect(recap.locator(".song-recap-art img")).toBeVisible();
  // Every 8-count of this dance was a stumble, so one rung carries them all.
  await expect(
    page.getByRole("region", { name: "How the 8-counts ended" }).locator(".song-recap-rung"),
  ).toHaveCount(5);
  await expect(recap.locator('.song-recap-rung[data-rung="break"]')).toContainText(
    `${view.danceHistory.length} of ${view.danceHistory.length}`,
  );
  await expect(recap.locator('.song-recap-rung[data-rung="perfect"]')).toContainText("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("teaches the call, the afinque and the ladder in the rulebook", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How to play" }).click();
  const rules = page.getByRole("dialog", { name: "How to dance the song" });

  await rules.getByRole("button", { name: "The hold", exact: true }).click();
  await expect(rules.getByRole("heading", { name: "Take the hold" })).toBeVisible();
  await expect(rules.locator("#rules-hold")).toContainText(
    "the hold gives up this 8-count’s song bonus",
  );

  await rules.getByRole("button", { name: "The call", exact: true }).click();
  const section = rules.locator("#rules-call");
  await expect(rules.getByRole("heading", { name: "Call and answer" })).toBeVisible();
  await expect(section.locator(".rules-call-list > div")).toHaveCount(calls.options.length);
  for (const option of calls.options)
    await expect(section.locator(".rules-call-list")).toContainText(
      `${option.name}${option.style} Style${option.ask}`,
    );
  await expect(section).toContainText(`+${calls.inPocketStyle} Style in the pocket`);
  await expect(section).toContainText(`loses ${calls.missConnectionCost} Connection`);

  await rules.getByRole("button", { name: "Afinque", exact: true }).click();
  const table = rules.getByRole("list", { name: "Extra Style per afinque link" });
  await expect(table.getByRole("listitem")).toHaveCount(calls.afinqueBonus.length);
  await expect(table.getByRole("listitem").last()).toContainText(
    `+${calls.afinqueBonus.at(-1)} Style`,
  );
  await expect(rules.locator("#rules-afinque")).toContainText(
    `${calls.afinqueBonus.length} links is the most it holds`,
  );

  await rules.getByRole("button", { name: "The ladder", exact: true }).click();
  await expect(rules.getByRole("heading", { name: "Every 8-count lands somewhere" })).toBeVisible();
  await expect(rules.locator(".rules-ladder > div")).toContainText([
    "Perfect",
    "Clean",
    "Awkward",
    "Recovered",
    "Break",
  ]);
  await expect(rules.locator(".rules-ladder")).toContainText(
    `a dropped call costs ${calls.missConnectionCost} Connection`,
  );
});

test("makes a call with the keyboard alone and gives the focus back", async ({ page }) => {
  const ready = gameAt(
    (view) =>
      view.phase === "dance" &&
      view.call === null &&
      view.table.position !== null &&
      view.turn.moveCardId !== null &&
      view.legalActions.some((action) => action.type === "END_DANCE" && action.callId !== null),
  );
  await resumeSeeded(page, ready);

  const trigger = page.getByRole("button", { name: "Make a call" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const sheet = page.getByRole("dialog", { name: "Make a call" });
  const first = sheet.locator(".call-option").first();
  await expect(first).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();

  // Second time through, choose one: the sheet closes and the 8-count ends on that call.
  await page.keyboard.press("Enter");
  await expect(first).toBeFocused();
  const chosen = (await first.locator(".call-option-name").innerText()).replace("★", "").trim();
  await page.keyboard.press("Enter");
  await expect(sheet).toBeHidden();
  await expect(
    page.getByText(`You called ${chosen}. Your partner answers next 8-count.`),
  ).toBeVisible();
});
