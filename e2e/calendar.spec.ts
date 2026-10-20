import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { madridToday, seedCalendarUser } from "./helpers/seed";

// Calendar screens: the secret link never leaves the POST body, Today's
// Skipped switches, no sync without a calendar, and sync never eats typing.

const run = Math.random().toString(36).slice(2, 8);

async function signUp(page: Page) {
  await page.goto("/signup");
  await page
    .getByTestId("signup-email")
    .fill(`cal-ui-${run}-${Date.now()}@example.com`);
  await page.getByTestId("signup-password").fill(`pw-${run}-ui`);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

async function logIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

test("connect", async ({ page }) => {
  const secret = `feedkey${run}secret`;
  const link = `webcal://calendar.example.test/${secret}/calendar.ics`;
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  // The sync route belongs to PR 6; answer it here so the page settles.
  await page.route("**/api/calendar/sync", (r) => r.fulfill({ json: {} }));

  await signUp(page);
  await page.goto("/app/calendar");
  await expect(page.getByText("Blackboard")).toBeVisible();
  await page.getByTestId("calendar-link").fill(link);
  await page.getByTestId("calendar-connect").click();
  await expect(page.getByText("IE calendar · connected")).toBeVisible();
  await expect(page.getByTestId("calendar-link")).toHaveValue("");

  expect(urls.filter((u) => u.includes(secret))).toEqual([]);
  expect(await page.content()).not.toContain(secret);
  await page.reload();
  expect(await page.content()).not.toContain(secret);
  await page.goto("/app");
  expect(await page.content()).not.toContain(secret);

  // A bad link gets a fixed message, never the link.
  await page.goto("/app/calendar");
  await page.getByTestId("calendar-link").fill(`ftp://x/${secret}`);
  await page.getByTestId("calendar-connect").click();
  await expect(
    page.getByText(
      "Use a calendar link that starts with https:// or webcal://.",
    ),
  ).toBeVisible();
  expect(await page.content()).not.toContain(secret);

  // Disconnect removes it.
  await page
    .getByTestId("calendar-feed")
    .getByRole("button", { name: "Disconnect" })
    .click();
  await expect(page.getByTestId("calendar-feed")).toHaveCount(0);
});

test("no sync request for a user without a calendar", async ({ page }) => {
  const syncs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/calendar/sync")) syncs.push(r.url());
  });
  await signUp(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");
  await page.goto("/app/plan");
  await page.waitForLoadState("networkidle");
  expect(syncs).toEqual([]);
});

test("today", async ({ page }) => {
  const today = madridToday();
  const user = await seedCalendarUser({
    courses: ["Financial Accounting", "Statistics II"],
    classes: [
      { key: "fin", course: "Financial Accounting", day: today, hourUtc: 8 },
      {
        key: "slot",
        course: "Statistics II",
        day: today,
        hourUtc: 10,
        examSlot: true,
      },
    ],
  });
  await logIn(page, user);
  const rows = page.getByTestId("today-class");
  await expect(rows).toHaveCount(2);

  const fin = page.getByRole("switch", {
    name: "Skipped Financial Accounting",
  });
  await expect(fin).toHaveAttribute("aria-checked", "false");
  await fin.click();
  await expect(fin).toHaveAttribute("aria-checked", "true");
  await fin.click();
  await expect(fin).toHaveAttribute("aria-checked", "false");

  // Exam slots are never toggleable.
  await expect(page.getByRole("switch", { name: /Statistics II/ })).toHaveCount(
    0,
  );
});

test("typing in core-input during a sync keeps the text", async ({ page }) => {
  const user = await seedCalendarUser({
    courses: ["Microeconomics"],
    classes: [],
    lastSyncedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
  });
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  let fired = 0;
  await page.route("**/api/calendar/sync", async (r) => {
    fired += 1;
    await held;
    await r.fulfill({ json: {} });
  });
  await logIn(page, user);
  await expect.poll(() => fired).toBeGreaterThan(0);
  await page.getByTestId("core-input").fill("Typing while it syncs");
  release();
  await expect(page.getByText(/Last synced \d\d:\d\d/)).toBeVisible();
  await expect(page.getByTestId("core-input")).toHaveValue(
    "Typing while it syncs",
  );
});

test("confirming a course triggers a sync", async ({ page }) => {
  const user = await seedCalendarUser({
    courses: [],
    classes: [],
    pending: ["FINANCIAL ACCOUNTING BBA1 S1"],
  });
  let fired = 0;
  await page.route("**/api/calendar/sync", (r) => {
    fired += 1;
    return r.fulfill({ json: {} });
  });
  await logIn(page, user);
  await page.goto("/app/calendar");
  await expect(page.getByText("We found 1 course")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const before = fired;
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("We found 1 course")).toHaveCount(0);
  await expect.poll(() => fired).toBeGreaterThan(before);
});

test.describe("phone and accessibility", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  for (const path of ["/app/calendar", "/app/plan"]) {
    test(`${path} at 375px with axe`, async ({ page }) => {
      const user = await seedCalendarUser({
        courses: ["Statistics II"],
        classes: [
          { key: "s", course: "Statistics II", day: madridToday(), hourUtc: 9 },
        ],
      });
      await logIn(page, user);
      await page.goto(path);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
