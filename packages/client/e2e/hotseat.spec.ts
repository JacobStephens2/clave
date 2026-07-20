import { expect, test, type Page } from "@playwright/test";

async function acceptPass(page: Page, role: "Lead" | "Follow") {
  await page.getByRole("button", { name: `I’m the ${role}` }).click();
}

async function finishBasicTurn(page: Page) {
  await page.getByRole("button", { name: "Dance the basic" }).click();
  await page.getByRole("button", { name: "Finish lessons" }).click();
  await page.getByRole("button", { name: "Keep hand & end turn" }).click();
}

async function finishSetup(page: Page) {
  await acceptPass(page, "Lead");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Follow");
  await page.getByRole("button", { name: "Keep this hand" }).click();
  await acceptPass(page, "Lead");
}

test("carries the card artwork into the home-screen visual system", async ({ page }) => {
  await page.goto("/");

  const heroArtwork = page.locator(".rhythm-mark img");
  await expect(heroArtwork).toBeVisible();
  expect(await heroArtwork.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(512);
  await expect(page.locator(".home")).toHaveCSS("background-color", "rgb(8, 27, 37)");
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

  const instruction = page.getByText("Check for a matching Position and Move.");
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
});

test("restores the exact hot-seat turn after a page reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await finishBasicTurn(page);
  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await acceptPass(page, "Follow");
  await expect(page.getByText("02")).toBeVisible();
  await expect(page.getByText("Follow hand")).toBeVisible();
});

test("flies exact Freshen Up selections into the discard pile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await finishSetup(page);
  await page.getByRole("button", { name: "Dance the basic" }).click();
  await page.getByRole("button", { name: "Finish lessons" }).click();

  const handCards = page.locator(".hand-scroll .dance-card");
  expect(await handCards.count()).toBe(4);
  await handCards.nth(0).click();
  await handCards.nth(1).click();

  await expect(page.locator(".hand-scroll .dance-card.selected")).toHaveCount(2);
  await expect(page.locator(".discard-selection-badge")).toHaveCount(2);
  const discardSelected = page.getByRole("button", {
    name: "Discard 2 selected & end turn",
  });
  await expect(discardSelected).toBeEnabled();
  await discardSelected.click();
  const flights = page.locator(".freshen-card-flight.flying");
  const discardPile = page.locator(".discard-pile-target");
  await expect(flights).toHaveCount(2);
  await expect(flights.first()).toBeVisible();
  await expect(discardPile).toHaveText("Discard 2");
  await expect(discardPile).toHaveClass(/receiving/);
  await expect(page.locator(".pass-screen")).toHaveCount(0);
  await expect(flights).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator(".pass-screen")).toBeVisible();
});

test("opens with a sequential Position-then-Move drag instead of pair buttons", async ({
  page,
}) => {
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
  const moveSlot = page.locator('[data-slot="last-move"]');
  const position = page.locator(".hand-scroll .dance-card.position.playable").first();
  const positionName = await position.locator("h4").innerText();

  await expect(page.locator(".opening-options")).toHaveCount(0);
  await expect(page.locator(".hand-scroll .dance-card.playable:not(.position)")).toHaveCount(0);
  await position.dragTo(floor);

  await expect(positionSlot).toHaveClass(/staged-slot/);
  await expect(positionSlot).toContainText(positionName);
  await expect(positionSlot).toContainText("Waiting for Move");
  await expect(page.getByText("Return Position to hand")).toBeVisible();
  await expect(page.locator(".hand-heading strong")).toHaveText("3 cards");
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
  const openingInstruction = openingSong.getByText("Check for a matching Position and Move.");
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
  expect(cardBox!.y).toBeLessThan(900);
  expect(cardNameBox!.y + cardNameBox!.height).toBeLessThanOrEqual(1139);
  expect(cardBox!.y + cardBox!.height).toBeGreaterThan(1139 + 32);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1139);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await firstCard.click({ position: { x: 70, y: 80 } });
  const enlarged = page.locator(".card-inspector .dance-card");
  await expect(enlarged).toBeVisible();
  const enlargedArtwork = enlarged.locator(".card-art img");
  await expect(enlargedArtwork).toBeVisible();
  await expect(enlargedArtwork).toHaveAttribute("src", await firstArtwork.getAttribute("src"));
  const enlargedBox = await enlarged.boundingBox();
  expect(enlargedBox!.width).toBeGreaterThan(cardBox!.width);
  expect(enlargedBox!.height).toBeGreaterThan(cardBox!.height);
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(enlarged).toBeHidden();
});

test("shows readable card content above the fold in a shorter laptop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1482, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");

  const firstCard = page.locator(".hand-scroll .dance-card").first();
  const cardName = firstCard.locator("h4");
  const cardBox = await firstCard.boundingBox();
  const nameBox = await cardName.boundingBox();

  expect(cardBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect(Math.min(cardBox!.y + cardBox!.height, 800) - Math.max(cardBox!.y, 0)).toBeGreaterThan(
    140,
  );
  expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(800);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
