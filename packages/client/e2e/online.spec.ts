import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

async function finishTurn(page: Page) {
  await page.getByRole("button", { name: "Dance the basic" }).click();
  await page.getByRole("button", { name: "Finish turn · discard hand" }).click();
}

/** Opens the two screens on one room, hands kept, with the Lead's 8-count on the floor. */
async function pairUp(browser: Browser) {
  const leadContext = await browser.newContext();
  const followContext = await browser.newContext();
  const lead = await leadContext.newPage();
  const follow = await followContext.newPage();

  await lead.goto("/");
  await lead.getByRole("button", { name: /Two devices/ }).click();
  await lead.getByRole("button", { name: "Create room" }).click();
  const code = (await lead.locator(".room-code strong").textContent())!.trim();

  await follow.goto("/");
  await follow.getByRole("button", { name: /Two devices/ }).click();
  await follow.getByLabel("Room code").fill(code);
  await follow.getByRole("button", { name: "Join room" }).click();
  await expect(follow.locator(".connection-status")).toHaveAttribute(
    "data-connection",
    "connected",
  );

  await lead.getByRole("button", { name: "Keep this hand" }).click();
  await follow.getByRole("button", { name: "Keep this hand" }).click();
  return { leadContext, followContext, lead, follow };
}

/**
 * Leaves a Position on the floor — opening with a matching Move, or taking the hold with
 * the Position alone — so the active screen can make a call. The room's deal is the
 * server's, so this dances the basic and tries again on any 8-count that cannot open.
 */
async function danceUntilTheFloorIsSet(screens: readonly Page[]) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const active = screens[attempt % 2]!;
    const position = active.locator(".hand-scroll .dance-card.position.playable").first();
    if ((await position.count()) > 0) {
      await position.click({ position: { x: 40, y: 56 } });
      const detail = active.getByRole("dialog", { name: "Card detail" });
      await expect(detail).toBeVisible();
      const staging = detail.getByRole("button", { name: "Stage Position" });
      const holding = detail.getByRole("button", { name: "Take the hold" });
      if ((await staging.count()) > 0) {
        await staging.click();
        const move = active.locator(".hand-scroll .dance-card.move.playable").first();
        await move.click({ position: { x: 40, y: 56 } });
        await detail.getByRole("button", { name: "Dance move" }).click();
      } else {
        await holding.click();
      }
      await expect(active.locator('[data-slot="position"] .empty-slot')).toHaveCount(0);
      return active;
    }
    await finishTurn(active);
  }
  throw new Error("Four 8-counts without a Position in hand: the deal cannot be danced.");
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

test("carries a call across to the partner's device", async ({ browser }) => {
  const { leadContext, followContext, lead, follow } = await pairUp(browser);

  const caller = await danceUntilTheFloorIsSet([lead, follow]);
  const watcher = caller === lead ? follow : lead;
  const callerName = caller === lead ? "Lead" : "Follow";

  await caller.getByRole("button", { name: "Make a call" }).click();
  const sheet = caller.getByRole("dialog", { name: "Make a call" });
  const chosen = (await sheet.locator(".call-option-name").first().innerText())
    .replace("★", "")
    .trim();
  await sheet.locator(".call-option").first().click();
  await expect(sheet).toBeHidden();

  // A call is public the moment it is made: both devices hear it, each in its own words.
  await expect(caller.locator(".snapshot-cues .cue")).toContainText(`You call ${chosen}`);
  await expect(watcher.locator(".snapshot-cues .cue")).toContainText(
    `The ${callerName} calls ${chosen}`,
  );
  await expect(watcher.locator(".snapshot-cues").getByRole("status")).toContainText(chosen);

  // It stands over the next 8-count, so the banner arrives with the handover of the turn.
  await caller.getByRole("button", { name: "Finish turn · discard hand" }).click();
  const banner = { name: "The call standing over this 8-count" };
  await expect(watcher.getByRole("region", banner)).toContainText(`${callerName} calls ${chosen}`);
  await expect(watcher.getByRole("region", banner).getByRole("status")).toContainText(
    "Not answered yet",
  );
  await expect(caller.getByRole("region", banner)).toContainText(`You called ${chosen}`);
  await expect(watcher.getByRole("status").filter({ hasText: "Your 8-count" })).toHaveCount(1);
  await leadContext.close();
  await followContext.close();
});
