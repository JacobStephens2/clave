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

test("keeps a readable hand in a 13-inch laptop viewport and enlarges cards", async ({ page }) => {
  await page.setViewportSize({ width: 1482, height: 1139 });
  await page.goto("/");
  await page.getByRole("button", { name: /Pass & play/ }).click();
  await acceptPass(page, "Lead");

  const firstCard = page.locator(".hand-scroll .dance-card").first();
  const cardBox = await firstCard.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.y).toBeLessThan(900);
  expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(1139);

  await firstCard.click({ position: { x: 70, y: 80 } });
  const enlarged = page.locator(".card-inspector .dance-card");
  await expect(enlarged).toBeVisible();
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
