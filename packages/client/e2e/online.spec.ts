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
  const leadStatus = lead.locator(".connection-status");
  await expect(leadStatus).toHaveAttribute("data-connection", "connected");
  await expect(leadStatus).toHaveAttribute("data-partner", "absent");
  await expect(lead.getByText("Invite your partner")).toBeVisible();
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
  await expect(follow.locator(".connection-status")).toHaveAttribute(
    "data-connection",
    "connected",
  );
  await expect(leadStatus).toHaveAttribute("data-partner", "connected");
  await expect(lead.getByText("Invite your partner")).toHaveCount(0);

  await lead.getByRole("button", { name: "Keep this hand" }).click();
  await follow.getByRole("button", { name: "Keep this hand" }).click();

  for (const screen of [lead, follow]) {
    await expect(screen.locator('[data-slot="position"] .empty-slot')).toBeVisible();
    await expect(screen.locator('[data-slot="move"] .empty-slot')).toBeVisible();
  }

  for (let count = 1; count <= 16; count += 1) {
    const active = count % 2 === 1 ? lead : follow;
    const partner = count % 2 === 1 ? follow : lead;
    if (count === 1) {
      await expect(lead).toHaveTitle(/^Your turn · Clave/);
      await expect(follow).not.toHaveTitle(/Your turn/);
      await expect(follow.getByRole("status").filter({ hasText: "Lead’s 8-count" })).toHaveCount(1);
    }
    await finishTurn(active);
    if (count === 1) {
      await expect(follow).toHaveTitle(/^Your turn · Clave/);
      await expect(lead).not.toHaveTitle(/Your turn/);
      await expect(
        follow.getByRole("status").filter({ hasText: /^Your 8-count: Open invitation/ }),
      ).toHaveCount(1);
    }
    if (count === 4) {
      await partner.reload();
      await expect(active.locator(".connection-status")).toHaveAttribute("data-partner", "away");
      await expect(active.getByText("The dance resumes when they reconnect.")).toBeVisible();
      await partner.getByRole("button", { name: "Reconnect" }).click();
      await expect(partner.locator(".connection-status")).toHaveAttribute(
        "data-connection",
        "connected",
      );
      await expect(active.locator(".connection-status")).toHaveAttribute(
        "data-partner",
        "connected",
      );
    }
  }

  await expect(lead.getByText("final score")).toBeVisible();
  await expect(follow.getByText("final score")).toBeVisible();
  await expect(lead.getByRole("button", { name: "Create a new room" })).toBeVisible();
  await expect(lead.getByRole("button", { name: "Dance again" })).toHaveCount(0);
  await lead.getByRole("button", { name: "Create a new room" }).click();
  await expect(lead.locator(".room-code strong")).not.toHaveText(code);
  await expect(lead.locator(".connection-status")).toHaveAttribute("data-connection", "connected");
  await expect(lead.getByRole("button", { name: "Keep this hand" })).toBeVisible();
  await leadContext.close();
  await followContext.close();
});

test("invites a partner with a link that opens a prefilled join form", async ({ browser }) => {
  const hostContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  // Force the copy fallback so the invite link lands on the clipboard.
  await hostContext.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByRole("button", { name: /Two devices/ }).click();
  await host.getByRole("radio", { name: "Follow" }).first().click();
  await host.getByRole("button", { name: "Create room" }).click();
  const code = (await host.locator(".room-code strong").textContent())!.trim();
  const invite = host.getByRole("region", { name: "Invite your partner" });
  await expect(invite.getByText(code.match(/.{1,4}/g)!.join(" "))).toBeVisible();
  await invite.getByRole("button", { name: "Share invite link" }).click();
  await expect(invite.getByRole("button", { name: "Link copied" })).toBeVisible();
  const link = await host.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(new RegExp(`/#join=${code}$`));

  await guest.goto(link);
  await expect(guest.getByLabel("Room code")).toHaveValue(code);
  await expect(guest.getByRole("radio", { name: "Lead" }).last()).toBeChecked();
  expect(await guest.evaluate(() => location.hash)).toBe("");
  await guest.getByRole("button", { name: "Join room" }).click();
  await expect(guest.locator(".connection-status")).toHaveAttribute("data-connection", "connected");
  await expect(host.locator(".connection-status")).toHaveAttribute("data-partner", "connected");
  await hostContext.close();
  await guestContext.close();
});
