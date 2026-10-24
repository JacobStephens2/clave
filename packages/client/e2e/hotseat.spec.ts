import { expect, test, type Page } from "@playwright/test";

async function acceptPass(page: Page, role: "Lead" | "Follow") {
  await page.getByRole("button", { name: `I’m the ${role}` }).click();
}

/**
 * The button that ends the dance step. It names what taking the song pays whenever this
 * 8-count met the song card, so it reads "Take the song · +1 Style" as often as not.
 */
const endDance = (page: Page) =>
  page.getByRole("button", { name: /^(Take the song|Finish the 8-count)/ });

async function finishBasicTurn(page: Page) {
  await page.getByRole("button", { name: "Dance the basic" }).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
}

async function finishSetup(page: Page) {
  await acceptPass(page, "Lead");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Lead");
}

/**
 * Deals the same cards every game: the store seeds itself from `crypto.getRandomValues`.
 * Seed 1 opens the Lead with Closed Position, Open Position, Cross Body Lead — Closed and
 * Hand Twist; seed 5 ({@link BOTH_OPENINGS}) swaps the Flourish for Follow Left Turn, so
 * each Position has a Move of its own and neither opening is the only one.
 */
async function seedDeal(page: Page, seed = 1) {
  await page.addInitScript((value: number) => {
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(value);
        return values;
      },
    });
  }, seed);
}

/** The deal that gives the Lead a Move from Open and a Move from Closed. */
const BOTH_OPENINGS = 5;

/** The deal whose first hand card is the deck's longest name, "Cross Body Lead — Closed". */
const LONGEST_CARD_NAME = 4;

/** Plays to the Lead's second 8-count, after the Follow's stumble cleared the floor. */
async function reachEmptyFloor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await finishBasicTurn(page);
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Stumble · −2 Connection" }).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
  await acceptPass(page, "Lead");
}

/** Opens a card's enlarged view by clicking its always-visible top edge, as a person would. */
async function openCardDetail(page: Page, card: ReturnType<Page["locator"]>) {
  await card.click({ position: { x: 40, y: 56 } });
  const detail = page.getByRole("dialog", { name: "Card detail" });
  await expect(detail).toBeVisible();
  return detail;
}

async function stageOpeningPosition(page: Page) {
  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  const detail = await openCardDetail(page, position);
  await detail.getByRole("button", { name: "Stage Position" }).click();
  await expect(detail).toBeHidden();
}

test("carries the card artwork into the home-screen visual system", async ({ page }) => {
  await page.goto("/");

  const heroArtwork = page.locator(".home-hero img");
  await expect(heroArtwork).toBeVisible();
  // The hero is served through a width-descriptor srcset, so its naturalWidth depends on the
  // viewport and the device pixel ratio. What must hold is that the painting itself arrived,
  // which is a frame or two after the element it arrives into.
  await expect
    .poll(() =>
      heroArtwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  expect(await heroArtwork.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(
    "/art/home-hero",
  );
  await expect(page.locator(".home")).toHaveCSS("background-color", "rgb(8, 27, 37)");
});

test("makes the rulebook accessible from home and live play", async ({ page }) => {
  await page.goto("/");

  const homeRules = page.getByRole("button", { name: "How to play" });
  await homeRules.click();
  const dialog = page.getByRole("dialog", { name: "How to dance the song" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Move → Position → Flourish").first()).toBeVisible();
  await expect(dialog.getByText(/If the floor is empty/)).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Choose your opening Position" })).toBeVisible();
  await expect(dialog.getByText(/The floor starts empty/)).toBeVisible();
  await expect(dialog.locator(".rules-costs > span").first()).toContainText("$1");
  await expect(page.getByRole("button", { name: "Close game rules" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(homeRules).toBeFocused();

  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");
  const gameRules = page.getByRole("button", { name: "How to play" });
  await gameRules.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Your turn" }).click();
  await expect(dialog.getByRole("heading", { name: "Your turn is one 8-count" })).toBeVisible();
  await dialog.getByRole("button", { name: "Return to the dance" }).click();
  await expect(dialog).toBeHidden();
  await expect(gameRules).toBeFocused();
});

test("offers Llorarás in Spotify when the embedded player is not loaded", async ({ page }) => {
  const spotifyScripts: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://open.spotify.com/embed/iframe-api/"))
      spotifyScripts.push(request.url());
  });
  await page.goto("/");

  const drawer = page.getByRole("complementary", { name: "Llorarás music player" });
  const open = page.getByRole("button", { name: "Open Llorarás" });
  await expect(open).toBeEnabled();
  await expect(drawer).toBeHidden();
  await open.click();

  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("status")).toHaveText(
    "The embedded player could not load. Open the recording in Spotify.",
  );
  await expect(drawer.getByRole("link", { name: /Open in Spotify/ })).toHaveAttribute(
    "href",
    "https://open.spotify.com/track/5SsgnRkcr4ogLB9rcW61tf",
  );
  expect(spotifyScripts).toEqual([]);
  await page.getByRole("button", { name: "Hide music player" }).click();
  await expect(drawer).toBeHidden();

  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");
  await expect(page.getByRole("button", { name: "Open Llorarás" })).toBeVisible();
  expect(spotifyScripts).toEqual([]);
});

test("plays procedural game cues and remembers the sound-effects preference", async ({ page }) => {
  await page.setViewportSize({ width: 1482, height: 1139 });
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(1);
        return values;
      },
    });
    const counter = window as typeof window & { __claveSfxStarts: number };
    counter.__claveSfxStarts = 0;
    const parameter = {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
    const node = () => ({
      connect(destination: unknown) {
        return destination;
      },
    });

    class FakeAudioContext {
      currentTime = 0;
      sampleRate = 1_000;
      state = "running";
      destination = node();

      createGain() {
        return { ...node(), gain: { ...parameter, value: 1 } };
      }

      createOscillator() {
        return {
          ...node(),
          type: "sine",
          frequency: parameter,
          start() {
            counter.__claveSfxStarts += 1;
          },
          stop() {},
        };
      }

      createBuffer(_channels: number, length: number) {
        const data = new Float32Array(length);
        return { getChannelData: () => data };
      }

      createBufferSource() {
        return {
          ...node(),
          buffer: null,
          start() {
            counter.__claveSfxStarts += 1;
          },
          stop() {},
        };
      }

      createBiquadFilter() {
        return { ...node(), type: "bandpass", frequency: parameter, Q: parameter };
      }

      resume() {
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });
  await page.goto("/");

  const homeToggle = page.getByRole("button", { name: "Turn sound effects off" });
  await expect(homeToggle).toHaveAttribute("aria-pressed", "true");
  await homeToggle.click();
  await expect(page.getByRole("button", { name: "Turn sound effects on" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("clave.soundEffects.v1"))).toBe("off");

  await page.reload();
  const enable = page.getByRole("button", { name: "Turn sound effects on" });
  await expect(enable).toHaveAttribute("aria-pressed", "false");
  await enable.click();
  const beforeTurn = await page.evaluate(
    () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
  );
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");
  expect(
    await page.evaluate(
      () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
    ),
  ).toBeGreaterThan(beforeTurn);

  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Lead");

  const floor = page.getByRole("region", {
    name: "Current dance state and card drop area",
  });
  await page.locator(".hand-scroll .dance-card.position.playable").first().dragTo(floor);
  const beforeMove = await page.evaluate(
    () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
  );
  await page.locator(".hand-scroll .dance-card.move.playable").first().dragTo(floor);
  const afterMove = await page.evaluate(
    () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
  );
  expect(afterMove).toBeGreaterThan(beforeMove);

  await page.locator(".hand-scroll .dance-card.position.playable").first().dragTo(floor);
  expect(
    await page.evaluate(
      () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
    ),
  ).toBeGreaterThan(afterMove);

  await endDance(page).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Stumble · −2 Connection" }).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
  await acceptPass(page, "Lead");

  const beforeStagedPosition = await page.evaluate(
    () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
  );
  await page.locator(".hand-scroll .dance-card.position.playable").first().dragTo(floor);
  expect(
    await page.evaluate(
      () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
    ),
  ).toBeGreaterThan(beforeStagedPosition);

  await page.getByRole("button", { name: "Turn sound effects off" }).click();
  const afterMute = await page.evaluate(
    () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
  );
  await page.getByRole("button", { name: "Return Position to hand" }).click();
  expect(
    await page.evaluate(
      () => (window as typeof window & { __claveSfxStarts: number }).__claveSfxStarts,
    ),
  ).toBe(afterMute);
});

test("keeps the Opening Hands instruction inside its song banner", async ({ page }, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === "mobile-chrome"
      ? { width: 412, height: 839 }
      : { width: 1440, height: 700 },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");

  const instruction = page.getByText("Look for a matching Position and Move.");
  await expect(instruction).toBeVisible();
  expect(
    await instruction.evaluate((element) => {
      const banner = element.closest(".song-card");
      if (!banner) return false;
      const instructionBounds = element.getBoundingClientRect();
      const bannerBounds = banner.getBoundingClientRect();
      return (
        instructionBounds.top >= bannerBounds.top && instructionBounds.bottom <= bannerBounds.bottom
      );
    }),
  ).toBe(true);
});

test("plays a complete sixteen-count hot-seat game", async ({ page }) => {
  // Sixteen 8-counts, each with a handoff and a hand flying into the discard: about 35s of
  // animation on a phone profile, where the default budget is 30.
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  for (let count = 1; count <= 16; count += 1) {
    await expect(page.locator(".song-count > span")).toHaveText(String(count).padStart(2, "0"));
    await finishBasicTurn(page);
    if (count < 16) await acceptPass(page, count % 2 === 1 ? "Follow" : "Lead");
  }

  await expect(page.getByText("final score")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dance again" })).toBeVisible();
  const rating = await page.locator(".terminal-screen h2").innerText();
  const ladder = page.getByRole("region", { name: "Performance ratings" });
  await expect(ladder.locator('[aria-current="true"]')).toContainText(rating);
  await expect(ladder.getByText(/more points? reaches/)).toBeVisible();
  await expect(page.getByRole("region", { name: /Phrase choreography/ })).toBeVisible();
});

test("keeps result-screen card details modal and returns focus to the choreography", async ({
  page,
}) => {
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await stageOpeningPosition(page);
  const detail = await openCardDetail(
    page,
    page.locator(".hand-scroll .dance-card.move.playable").first(),
  );
  await detail.getByRole("button", { name: "Dance move" }).click();
  await endDance(page).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();

  for (const [index, role] of (["Follow", "Lead", "Follow"] as const).entries()) {
    await acceptPass(page, role);
    await page.getByRole("button", { name: "Stumble · −2 Connection" }).click();
    if (index < 2) await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
  }

  await expect(page.getByRole("heading", { name: "The dance ends here" })).toBeVisible();
  const historyCard = page.getByRole("button", { name: /^move, .* View card\./ }).first();
  await historyCard.focus();
  await page.keyboard.press("Enter");
  await expect(detail.getByRole("button", { name: "Close" })).toBeFocused();
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest(".terminal-screen"))),
    ).toBe(false);
  }
  await page.keyboard.press("Escape");
  await expect(historyCard).toBeFocused();
});

test("restores the exact hot-seat turn after a page reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await finishBasicTurn(page);
  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await acceptPass(page, "Follow");
  await expect(page.locator(".song-count > span")).toHaveText("02");
  await expect(page.getByText("Follow hand")).toBeVisible();
});

test("automatically flies the entire remaining hand into the discard pile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await page.getByRole("button", { name: "Dance the basic" }).click();

  const handCards = page.locator(".hand-scroll .dance-card");
  expect(await handCards.count()).toBe(4);
  await expect(page.getByText("Your whole remaining hand discards automatically.")).toBeVisible();
  await expect(page.getByText(/select cards to discard/i)).toHaveCount(0);
  const finishTurn = page.getByRole("button", { name: "Finish turn · discard hand" });
  await expect(finishTurn).toBeEnabled();
  await finishTurn.click();
  const flights = page.locator(".cleanup-card-flight.flying");
  const discardPile = page.locator(".discard-pile-target");
  await expect(flights).toHaveCount(4);
  await expect(flights.first()).toBeVisible();
  await expect(discardPile).toHaveClass(/receiving/);
  await expect(page.locator(".pass-screen")).toHaveCount(0);
  await expect(flights).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator(".pass-screen")).toBeVisible();
});

test("lets the Lead choose the first Position before its matching Move", async ({ page }) => {
  await page.setViewportSize({ width: 1482, height: 1139 });
  await seedDeal(page, BOTH_OPENINGS);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  const activeSong = page.locator(".song-card:not(.waiting)");
  const activeRule = activeSong.getByText("+1 Connection if you play a Move worth 2 Style or less");
  const activeSongBox = await activeSong.boundingBox();
  const activeRuleBox = await activeRule.boundingBox();
  expect(activeSongBox).not.toBeNull();
  expect(activeRuleBox).not.toBeNull();
  expect(activeRuleBox!.y + activeRuleBox!.height).toBeLessThan(
    activeSongBox!.y + activeSongBox!.height - 2,
  );

  const floor = page.getByRole("region", {
    name: "Current dance state and card drop area",
  });
  const positionSlot = page.locator('[data-slot="position"]');
  const moveSlot = page.locator('[data-slot="move"]');
  const phraseHistory = page.getByRole("region", { name: /Phrase choreography/ });
  const phraseSlots = phraseHistory.locator(".phrase-combo");
  await expect(phraseSlots).toHaveCount(8);
  await expect(phraseSlots.nth(0)).toHaveAttribute("data-outcome", "current");
  const historyWidths = await phraseHistory
    .locator(".phrase-history-scroll")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(historyWidths.scrollWidth).toBeLessThanOrEqual(historyWidths.clientWidth + 1);
  expect(
    await page
      .locator(".table-slot")
      .evaluateAll((slots) => slots.map((slot) => (slot as HTMLElement).dataset.slot)),
  ).toEqual(["move", "position", "flourish"]);
  await expect(positionSlot.locator(".empty-slot")).toBeVisible();
  await expect(moveSlot.locator(".empty-slot")).toBeVisible();
  await expect(page.locator(".step-heading strong")).toHaveText("Open the floor with a Position");
  await expect(floor.getByText("Drag a highlighted Position here", { exact: true })).toBeVisible();

  await expect(page.locator(".opening-options")).toHaveCount(0);
  await expect(page.locator(".hand-scroll .dance-card.playable:not(.position)")).toHaveCount(0);
  await page
    .locator(".hand-scroll .dance-card.position.playable")
    .filter({ hasText: "Open Position" })
    .dragTo(floor);
  await expect(positionSlot).toHaveClass(/staged-slot/);
  await expect(page.locator(".hand-heading strong")).toHaveText("3 cards");
  const mismatchedMove = page
    .locator(".hand-scroll .dance-card.move")
    .filter({ hasText: "Cross Body Lead — Closed" });
  await expect(mismatchedMove).toContainText("Needs Closed or Half-Closed · Open is staged");
  await page.getByRole("button", { name: "Return Position to hand" }).click();
  await expect(positionSlot.locator(".empty-slot")).toBeVisible();
  await page
    .locator(".hand-scroll .dance-card.position.playable")
    .filter({ hasText: "Closed Position" })
    .dragTo(floor);
  await expect(positionSlot).toContainText("Closed Position");
  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  await expect(move).toContainText("Cross Body Lead — Closed");
  await expect(move.locator(".card-unavailable-reason")).toHaveCount(0);
  const moveName = await move.locator("h4").innerText();
  await move.dragTo(floor);

  await expect(moveSlot).toContainText(moveName);
  await expect(page.getByText("Move played — add a Position", { exact: true })).toBeVisible();
  await expect(floor.getByText(`Just played: ${moveName}`, { exact: true })).toBeVisible();
  await expect(
    floor.getByText("Now drag a highlighted Position here", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hand-heading strong")).toHaveText("2 cards");
  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await acceptPass(page, "Lead");
  await expect(positionSlot).toContainText("Closed Position");
  await expect(moveSlot).toContainText(moveName);
  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  const positionName = await position.locator("h4").innerText();
  await position.dragTo(floor);

  await expect(positionSlot).toContainText(positionName);
  await expect(moveSlot).toContainText(moveName);
  await expect(page.locator(".hand-heading strong")).toHaveText(/^1 card/);

  const playedArtwork = await floor.locator(".dance-card.full-artwork").evaluateAll((cards) => {
    const floorBounds = cards[0]?.closest(".dance-table")?.getBoundingClientRect();
    return cards.map((card) => {
      const cardBounds = card.getBoundingClientRect();
      const image = card.querySelector("img");
      const name = card.querySelector("h4");
      const nameBounds = name?.getBoundingClientRect();
      return {
        objectFit: image ? getComputedStyle(image).objectFit : "",
        name: name?.textContent ?? "",
        nameInsideCard: nameBounds
          ? nameBounds.left >= cardBounds.left - 1 && nameBounds.right <= cardBounds.right + 1
          : false,
        fullyInsideFloor: floorBounds
          ? cardBounds.top >= floorBounds.top && cardBounds.bottom <= floorBounds.bottom
          : false,
      };
    });
  });
  expect(playedArtwork).toHaveLength(2);
  for (const artwork of playedArtwork) {
    // On the table a card lies down — the painting keeps its proportions in a strip at the
    // left and the name it is played by reads across the rest, inside the floor's band.
    expect(artwork.objectFit).toBe("contain");
    expect(artwork.name).not.toBe("");
    expect(artwork.nameInsideCard).toBe(true);
    expect(artwork.fullyInsideFloor).toBe(true);
  }

  await endDance(page).click();
  const firstCombo = phraseSlots.nth(0);
  await expect(firstCombo).toHaveAttribute("data-outcome", "dance");
  await expect(firstCombo).toHaveClass(/latest/);
  await expect(
    firstCombo.getByRole("button", { name: `move, ${moveName}. View card.`, exact: true }),
  ).toBeVisible();
  await expect(
    firstCombo.getByRole("button", { name: `position, ${positionName}. View card.`, exact: true }),
  ).toBeVisible();
  await expect(firstCombo.locator(".combo-thumbnail.flourish.empty")).toBeVisible();

  await firstCombo
    .getByRole("button", { name: `move, ${moveName}. View card.`, exact: true })
    .click();
  await expect(page.locator(".card-inspector .dance-card")).toContainText(moveName);
});

test("stages Position then matching Move when a stumble empties the floor", async ({ page }) => {
  await page.setViewportSize({ width: 1482, height: 1139 });
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(1);
        return values;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await finishBasicTurn(page);
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Stumble · −2 Connection" }).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
  await acceptPass(page, "Lead");

  const floor = page.getByRole("region", {
    name: "Current dance state and card drop area",
  });
  const positionSlot = page.locator('[data-slot="position"]');
  const moveSlot = page.locator('[data-slot="move"]');
  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  const positionName = await position.locator("h4").innerText();

  await expect(moveSlot.locator(".empty-slot")).toBeVisible();
  await expect(positionSlot.locator(".empty-slot")).toBeVisible();
  await expect(page.locator(".hand-scroll .dance-card.playable:not(.position)")).toHaveCount(0);
  await position.dragTo(floor);

  await expect(positionSlot).toHaveClass(/staged-slot/);
  await expect(positionSlot).toContainText(positionName);
  await expect(positionSlot).toContainText("Waiting for Move");
  await expect(page.getByText("Return Position to hand")).toBeVisible();
  await expect(page.locator(".hand-scroll .dance-card.playable:not(.move)")).toHaveCount(0);

  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  const moveName = await move.locator("h4").innerText();
  await move.dragTo(floor);

  await expect(positionSlot).not.toHaveClass(/staged-slot/);
  await expect(positionSlot).toContainText(positionName);
  await expect(moveSlot).toContainText(moveName);
  await expect(page.getByText("Return Position to hand")).toHaveCount(0);
  await expect(page.locator(".hand-heading strong")).toHaveText("2 cards");
});

test("opens an empty floor from the enlarged cards without dragging", async ({ page }) => {
  await seedDeal(page);
  await reachEmptyFloor(page);

  const positionSlot = page.locator('[data-slot="position"]');
  const moveSlot = page.locator('[data-slot="move"]');

  let detail = await openCardDetail(page, page.locator(".hand-scroll .dance-card.move").first());
  await expect(detail.getByText("Stage a Position first")).toBeVisible();
  await expect(detail.getByRole("button", { name: "Dance move" })).toHaveCount(0);
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toBeHidden();

  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  const positionName = await position.locator("h4").innerText();
  detail = await openCardDetail(page, position);
  await detail.getByRole("button", { name: "Stage Position" }).click();
  await expect(detail).toBeHidden();
  await expect(positionSlot).toHaveClass(/staged-slot/);
  await expect(positionSlot).toContainText(positionName);

  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  const moveName = await move.locator("h4").innerText();
  detail = await openCardDetail(page, move);
  await detail.getByRole("button", { name: "Dance move" }).click();
  await expect(moveSlot).toContainText(moveName);
  await expect(positionSlot).toContainText(positionName);
  await expect(positionSlot).not.toHaveClass(/staged-slot/);
});

test("taps Stage Position and the matching Move on phone cards", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Phone cards show their actions inline.");
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  const positionSlot = page.locator('[data-slot="position"]');
  const moveSlot = page.locator('[data-slot="move"]');
  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  const positionName = await position.locator("h4").innerText();
  await position.getByRole("button", { name: "Stage Position" }).tap();
  await expect(positionSlot).toHaveClass(/staged-slot/);
  await expect(positionSlot).toContainText(positionName);

  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  const moveName = await move.locator("h4").innerText();
  await move.getByRole("button", { name: "Dance move" }).tap();
  await expect(moveSlot).toContainText(moveName);
  await expect(positionSlot).not.toHaveClass(/staged-slot/);
});

test("offers a lesson from its enlarged card and explains when it cannot", async ({ page }) => {
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  await page.locator(".market > summary").click();
  const lesson = page
    .locator(".market-section")
    .filter({ hasText: "Beginner supply" })
    .locator(".dance-card")
    .first();
  let detail = await openCardDetail(page, lesson);
  await expect(detail.getByText("Learn after you dance this 8-count")).toBeVisible();
  await expect(detail.getByRole("button", { name: /^Learn/ })).toHaveCount(0);
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toBeHidden();

  await page.getByRole("button", { name: "Dance the basic" }).click();
  const lessonName = await lesson.locator("h4").innerText();
  detail = await openCardDetail(page, lesson);
  await detail.getByRole("button", { name: "Learn · $1" }).click();
  await expect(detail).toBeHidden();
  const discardPile = page.locator(".discard-pile-target");
  await expect(discardPile).toHaveText("Discard 1");
  await expect(page.locator(".lesson-card-flight")).toHaveCount(0, { timeout: 3_000 });
  await discardPile.click();
  await expect(
    page.getByRole("dialog", { name: "Lead discard pile" }).locator(".dance-card h4"),
  ).toHaveText(lessonName);
});

test("shows each score change, a landed song bonus, and a recap at the handoff", async ({
  page,
}) => {
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await stageOpeningPosition(page);

  const scoreStatus = page.locator(".hud").getByRole("status");
  const styleStat = page.locator(".hud-stat").filter({ hasText: "Style" });
  const connectionStat = page.locator(".hud-stat").filter({ hasText: "Connection" });
  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  const moveName = await move.locator("h4").innerText();
  const moveStyle = Number((await move.locator(".card-style-top").innerText()).match(/\d+/)![0]);
  const detail = await openCardDetail(page, move);
  await detail.getByRole("button", { name: "Dance move" }).click();
  await expect(styleStat.locator(".hud-delta.up")).toHaveText(`+${moveStyle}`);
  await expect(scoreStatus).toContainText(`Lead danced ${moveName}`);

  await endDance(page).click();
  await expect(page.locator(".song-card .song-landed")).toHaveText("Landed · +1 Connection");
  await expect(connectionStat.locator(".hud-delta.up")).toHaveText("+1");
  await expect(scoreStatus).toContainText("Connection up 1. Settle in lands: +1 Connection.");

  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
  const handoff = page.getByRole("dialog", { name: /Pass to the/ });
  await expect(handoff).toBeVisible();
  await expect(handoff.getByText(`Lead danced ${moveName}`)).toBeVisible();
  await expect(handoff.getByText("Up next · 02 of 16")).toBeVisible();
  await expect(handoff.getByText(`Style ${moveStyle} · Connection 5`)).toBeVisible();
});

test("keeps keyboard focus inside each overlay and returns it after", async ({ page }) => {
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  const focusIsBehindOverlay = () =>
    page.evaluate(() => Boolean(document.activeElement?.closest(".game-header, .hud, .game-grid")));
  const tabAround = async (presses: number) => {
    for (let press = 0; press < presses; press += 1) {
      await page.keyboard.press("Tab");
      expect(await focusIsBehindOverlay()).toBe(false);
    }
  };

  await expect(page.getByRole("button", { name: "I’m the Lead" })).toBeFocused();
  await tabAround(8);
  await page.getByRole("button", { name: "I’m the Lead" }).click();

  const card = page.locator(".hand-scroll .dance-card").first();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Card detail" })).toBeVisible();
  await tabAround(6);
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();

  const watch = page.getByRole("button", { name: "Watch dancers" });
  await watch.click();
  const demo = page.getByRole("dialog", { name: "Watch the partnership" });
  await expect(demo.getByRole("button", { name: "Close" })).toBeFocused();
  await tabAround(6);
  await page.keyboard.press("Escape");
  await expect(demo).toBeHidden();
  await expect(watch).toBeFocused();
});

test("plays a card and signals with the keyboard alone", async ({ page }, testInfo) => {
  await seedDeal(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  await position.focus();
  await page.keyboard.press("Enter");
  const positionDetail = page.getByRole("dialog", { name: "Card detail" });
  await positionDetail.getByRole("button", { name: "Stage Position" }).focus();
  await page.keyboard.press("Enter");
  await expect(positionDetail).toBeHidden();

  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  const moveName = await move.locator("h4").innerText();
  await move.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", { name: "Card detail" });
  await expect(detail.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(detail.getByRole("button", { name: "Dance move" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-slot="move"]')).toContainText(moveName);

  const signaledCard = page.locator(".hand-scroll .dance-card").first();
  await signaledCard.focus();
  await page.keyboard.press("Enter");
  await detail.getByRole("button", { name: "Signal to partner" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Hide it again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(signaledCard).toBeFocused();

  if (testInfo.project.name !== "mobile-chrome") return;
  // Phone cards show their buttons inline; Enter on one must press it, not open the card.
  const signal = page
    .locator(".hand-scroll .dance-card")
    .first()
    .getByRole("button", {
      name: /as a signal/,
    });
  await signal.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Show only this card to your partner")).toBeVisible();
  await expect(detail).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hide it again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(signal).toBeFocused();
});

test("animates a lesson into an inspectable discard pile", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  const discardPile = page.locator(".discard-pile-target");
  await discardPile.click();
  const emptyDialog = page.getByRole("dialog", { name: "Lead discard pile" });
  await expect(emptyDialog).toBeVisible();
  await expect(emptyDialog.getByText("No cards discarded yet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(emptyDialog).toBeHidden();
  await expect(discardPile).toBeFocused();

  await page.getByRole("button", { name: "Dance the basic" }).click();

  const lessonHeading = page.locator(".step-heading").filter({ hasText: "Take a lesson" });
  const lessonEyebrowBox = await lessonHeading.getByText("Take a lesson").boundingBox();
  const lessonMessageBox = await lessonHeading
    .getByText("Practice something new—or keep moving")
    .boundingBox();
  expect(lessonEyebrowBox).not.toBeNull();
  expect(lessonMessageBox).not.toBeNull();
  expect(lessonEyebrowBox!.y + lessonEyebrowBox!.height).toBeLessThanOrEqual(lessonMessageBox!.y);

  const beginnerLessons = page.locator(".market-section").filter({ hasText: "Beginner supply" });
  const availableLessons = beginnerLessons.locator(".dance-card.playable");
  expect(await availableLessons.count()).toBeGreaterThan(0);
  const learnedCard = availableLessons.first();
  const learnedCardName = await learnedCard.locator("h4").innerText();
  const learnButton = learnedCard.getByRole("button", { name: "Learn · $1" });
  await expect(learnButton).toBeEnabled();
  if (testInfo.project.name === "mobile-chrome") await learnButton.click();
  else await learnedCard.dragTo(discardPile);

  const flight = page.locator(".lesson-card-flight.flying");
  await expect(flight).toBeVisible();
  await expect(discardPile).toHaveText("Discard 1");
  await expect(discardPile).toHaveClass(/receiving/);
  await expect(flight).toBeHidden({ timeout: 2_000 });
  await expect(discardPile).not.toHaveClass(/receiving/);

  await discardPile.click();
  const dialog = page.getByRole("dialog", { name: "Lead discard pile" });
  await expect(dialog).toBeVisible();
  const discardedCards = dialog.locator(".discard-card-grid .dance-card");
  await expect(discardedCards).toHaveCount(1);
  await expect(discardedCards.locator("h4")).toHaveText(learnedCardName);

  await discardedCards.click();
  const cardDetail = page.locator(".card-inspector");
  await expect(cardDetail).toBeVisible();
  await expect(cardDetail.locator("h4")).toHaveText(learnedCardName);
  await page.keyboard.press("Escape");
  await expect(cardDetail).toBeHidden();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(discardPile).toBeFocused();
});

test("previews animated Position, Move, and Flourish choreography", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");
  await page.getByRole("button", { name: "Watch dancers" }).click();

  const dialog = page.getByRole("dialog", { name: "Watch the partnership" });
  const stage = page.locator(".dancer-demo-stage");
  await expect(dialog).toBeVisible();
  await expect(stage).toHaveAttribute("data-choreography", "position");
  await expect(stage.locator(".demo-dancer.lead")).toHaveCSS(
    "animation-name",
    "position-lead-step",
  );

  await dialog.getByRole("tab", { name: "move" }).click();
  await expect(stage).toHaveAttribute("data-choreography", "move");
  await expect(stage).toHaveAccessibleName(/Follow Right Turn/);
  await expect(stage.locator(".demo-dancer.follow")).toHaveCSS(
    "animation-name",
    "move-follow-turn",
  );

  await dialog.getByRole("tab", { name: "flourish" }).click();
  await expect(stage).toHaveAttribute("data-choreography", "flourish");
  await expect(stage).toHaveAccessibleName(/Arm Overhead/);
  await expect(stage.locator(".demo-dancer.lead .arm.outside")).toHaveCSS(
    "animation-name",
    "flourish-overhead-arm",
  );

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("keeps a readable hand in a 13-inch laptop viewport and enlarges cards", async ({ page }) => {
  await page.setViewportSize({ width: 1482, height: 1139 });
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");

  const firstCard = page.locator(".hand-scroll .dance-card").first();
  const firstMove = page.locator(".hand-scroll .dance-card.move").first();
  const firstArtwork = firstCard.locator(".card-art img");
  const openingSong = page.locator(".song-card.waiting");
  const openingInstruction = openingSong.getByText("Look for a matching Position and Move.");
  const openingSongBox = await openingSong.boundingBox();
  const openingInstructionBox = await openingInstruction.boundingBox();
  expect(openingSongBox).not.toBeNull();
  expect(openingInstructionBox).not.toBeNull();
  expect(openingInstructionBox!.y + openingInstructionBox!.height).toBeLessThan(
    openingSongBox!.y + openingSongBox!.height - 2,
  );
  await expect(firstMove.locator(".card-requirement-top")).toBeVisible();
  await expect(firstMove.locator(".card-requirement-top")).not.toHaveText("");
  await expect(firstMove.locator(".card-style-top")).toContainText("+");
  await expect(firstMove.locator(".style-pip")).toHaveCount(0);
  await expect(firstArtwork).toBeVisible();
  expect(await firstArtwork.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(512);
  const cardBox = await firstCard.boundingBox();
  const cardNameBox = await firstCard.locator("h4").boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardNameBox).not.toBeNull();
  // The call control joined the dance row, which starts the hand rail half a pixel lower.
  // What this guards is how much of the card the player can read, not where it begins.
  expect(1139 - cardBox!.y).toBeGreaterThan(230);
  expect(cardNameBox!.y + cardNameBox!.height).toBeLessThanOrEqual(1139);
  expect(cardBox!.y + cardBox!.height).toBeGreaterThan(1139 + 32);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1139);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const songTop = async () => (await page.locator(".song-card").boundingBox())!.y;
  const songTopBeforeDetail = await songTop();

  await firstCard.click({ position: { x: 70, y: 80 } });
  const inspector = page.locator(".card-inspector");
  const enlarged = inspector.locator(".dance-card");
  await expect(inspector).toHaveAttribute("data-motion-origin", "hand");
  await expect(inspector).toHaveAttribute("data-motion-state", /opening|open/);
  await expect(enlarged).toBeVisible();
  const enlargedArtwork = enlarged.locator(".card-art img");
  await expect(enlargedArtwork).toBeVisible();
  const handArtworkSource = await firstArtwork.getAttribute("src");
  expect(handArtworkSource).not.toBeNull();
  await expect(enlargedArtwork).toHaveAttribute("src", handArtworkSource!);
  await expect(inspector).toHaveAttribute("data-motion-state", "open");
  const enlargedBox = await enlarged.boundingBox();
  expect(enlargedBox!.width).toBeGreaterThan(cardBox!.width);
  expect(enlargedBox!.height).toBeGreaterThan(cardBox!.height);
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(inspector).toHaveAttribute("data-motion-state", "closing");
  await expect(enlarged).toBeHidden();
  await expect(firstCard).toBeFocused();
  expect(await songTop()).toBe(songTopBeforeDetail);
});

test("shows readable card content above the fold in a shorter laptop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1482, height: 800 });
  // The hardest name in the deck to fit: "Cross Body Lead — Closed" wraps onto two lines.
  // Left to the shuffle this was a one-line name as often as not, and the test with it.
  await seedDeal(page, LONGEST_CARD_NAME);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");

  const firstCard = page.locator(".hand-scroll .dance-card").first();
  const cardName = firstCard.locator("h4");
  await expect(cardName).toHaveText("Cross Body Lead — Closed");
  const cardBox = await firstCard.boundingBox();
  const nameBox = await cardName.boundingBox();

  expect(cardBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect(Math.min(cardBox!.y + cardBox!.height, 800) - Math.max(cardBox!.y, 0)).toBeGreaterThan(
    140,
  );
  // Both lines of the name are on screen; the last fraction of a pixel of the descender
  // sits on the fold itself, which no reader can tell from sitting just above it.
  expect(Math.floor(nameBox!.y + nameBox!.height)).toBeLessThanOrEqual(800);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("keeps the just-played Move readable on a short desktop floor", async ({ page }) => {
  await page.setViewportSize({ width: 1494, height: 825 });
  await seedDeal(page, BOTH_OPENINGS);
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);

  const position = page
    .locator(".hand-scroll .dance-card.position.playable")
    .filter({ hasText: "Open Position" });
  const positionDetail = await openCardDetail(page, position);
  await positionDetail.getByRole("button", { name: "Stage Position" }).click();
  const move = page.locator(".hand-scroll .dance-card.move.playable").first();
  const moveName = await move.locator("h4").innerText();
  const mismatchReason = page
    .locator(".hand-scroll .dance-card.move")
    .filter({ hasText: "Cross Body Lead — Closed" })
    .locator(".card-unavailable-reason");
  await expect(mismatchReason).toBeVisible();
  const reasonBox = await mismatchReason.boundingBox();
  expect(reasonBox).not.toBeNull();
  expect(reasonBox!.y + reasonBox!.height).toBeLessThanOrEqual(825);
  const detail = await openCardDetail(page, move);
  await detail.getByRole("button", { name: "Dance move" }).click();

  const floorMove = page.locator('[data-slot="move"] .dance-card.full-artwork');
  await expect(page.getByText(`Just played: ${moveName}`, { exact: true })).toBeVisible();
  const cardBox = await floorMove.boundingBox();
  const nameBox = await floorMove.locator("h4").boundingBox();
  expect(cardBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect(cardBox!.width).toBeGreaterThanOrEqual(160);
  expect(cardBox!.height).toBeGreaterThanOrEqual(48);
  expect(nameBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
  expect(nameBox!.y).toBeGreaterThanOrEqual(cardBox!.y);
  expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
});
