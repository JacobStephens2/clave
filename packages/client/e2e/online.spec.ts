import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function finishTurn(page: Page) {
  await page.getByRole("button", { name: "Dance the basic" }).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
}

test("keeps two authoritative screens synchronized through reload and song end", async ({
  browser,
}) => {
  const leadContext: BrowserContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const followContext: BrowserContext = await browser.newContext();
  const lead = await leadContext.newPage();
  const follow = await followContext.newPage();

  await lead.goto("/");
  await lead.getByRole("button", { name: /Two devices/ }).click();
  await lead.getByRole("button", { name: "Create room" }).click();
  await expect(lead.locator(".connection-status")).toContainText("connected");
  const roomCode = lead.locator(".room-code");
  const code = (await roomCode.locator("strong").textContent())!.trim();
  await roomCode.click();
  await expect(roomCode).toContainText("Copied!");
  await expect(roomCode).toHaveAccessibleName(`Room ${code} copied to clipboard`);
  await expect(lead.getByRole("status").filter({ hasText: `Room ${code}` })).toHaveText(
    `Room ${code} copied to clipboard.`,
  );
  await expect.poll(() => lead.evaluate(() => navigator.clipboard.readText())).toBe(code);

  await follow.goto("/");
  await follow.getByRole("button", { name: /Two devices/ }).click();
  await follow.getByLabel("Room code").fill(code);
  await follow.getByRole("button", { name: "Join room" }).click();
  await expect(follow.locator(".connection-status")).toContainText("connected");

  await lead.getByRole("button", { name: "Keep this hand" }).click();
  await follow.getByRole("button", { name: "Keep this hand" }).click();

  for (let count = 1; count <= 16; count += 1) {
    const active = count % 2 === 1 ? lead : follow;
    await finishTurn(active);
    const partner = count % 2 === 1 ? follow : lead;
    if (count === 4) {
      await partner.reload();
      await partner.getByRole("button", { name: "Reconnect" }).click();
      await expect(partner.locator(".connection-status")).toContainText("connected");
    }
  }

  await expect(lead.getByText("final score")).toBeVisible();
  await expect(follow.getByText("final score")).toBeVisible();
  await expect(lead.getByRole("button", { name: "Create a new room" })).toBeVisible();
  await expect(lead.getByRole("button", { name: "Dance again" })).toHaveCount(0);
  await lead.getByRole("button", { name: "Create a new room" }).click();
  await expect(lead.locator(".room-code strong")).not.toHaveText(code);
  await expect(lead.locator(".connection-status")).toContainText("connected");
  await expect(lead.getByRole("button", { name: "Keep this hand" })).toBeVisible();
  await leadContext.close();
  await followContext.close();
});
