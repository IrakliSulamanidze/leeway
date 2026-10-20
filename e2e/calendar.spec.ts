import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { madridToday, seedCalendarUser } from "./helpers/seed";

// Calendar screens: the secret link never leaves the POST body, the class
// sheet, no sync without a calendar, and sync never eats typing.

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

const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test("calendar: mark a past class missed, exam slots stay unskippable", async ({
  page,
}) => {
  const yesterday = shiftDay(madridToday(), -1);
  const user = await seedCalendarUser({
    courses: ["Financial Accounting", "Statistics II"],
    classes: [
      {
        key: "fin",
        course: "Financial Accounting",
        day: yesterday,
        hourUtc: 8,
      },
      {
        key: "slot",
        course: "Statistics II",
        day: yesterday,
        hourUtc: 11,
        examSlot: true,
      },
    ],
  });
  await logIn(page, user);
  await page.goto(`/app/schedule?day=${yesterday}&view=day`);
  await expect(page.getByTestId("schedule-class")).toHaveCount(2);

  const sheet = page.getByRole("dialog");
  await page
    .getByTestId("schedule-class")
    .filter({ hasText: "Financial Accounting" })
    .click();
  await expect(sheet.getByTestId("sheet-cost")).toContainText(
    "lives left if you missed it",
  );
  await sheet.getByRole("button", { name: "I missed it" }).click();
  await expect(sheet).toContainText("Marked as missed. 5 left");
  await sheet.getByRole("button", { name: "I was there" }).click();
  await expect(sheet.getByTestId("sheet-cost")).toBeVisible();
  await sheet.getByRole("link", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);

  // Exam slots are never skippable.
  await page
    .getByTestId("schedule-class")
    .filter({ hasText: "Statistics II" })
    .click();
  await expect(sheet).toContainText("Exams aren't skippable classes.");
  await expect(sheet.getByRole("button", { name: "I missed it" })).toHaveCount(
    0,
  );
});

test("calendar: tap a class tomorrow, skip it, then undo", async ({ page }) => {
  const tomorrow = shiftDay(madridToday(), 1);
  const user = await seedCalendarUser({
    courses: ["Microeconomics"],
    classes: [
      { key: "m", course: "Microeconomics", day: tomorrow, hourUtc: 9 },
    ],
  });
  await logIn(page, user);
  const url = `/app/schedule?day=${tomorrow}&view=day`;
  await page.goto(url);
  const block = page.getByTestId("schedule-class");
  await expect(block).toHaveCount(1);
  await block.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("sheet-cost")).toContainText(
    "lives left if you skip",
  );
  await sheet.getByRole("button", { name: "Skip this class" }).click();
  await expect(sheet).toContainText("You're skipping this one. 5 left");
  await expect(block).toContainText("Skipping");

  await page.goto("/app");
  await expect(page.getByTestId("core-item")).toHaveCount(1);

  await page.goto(url);
  await block.click();
  await sheet.getByRole("button", { name: "Undo skip" }).click();
  await expect(sheet.getByTestId("sheet-cost")).toBeVisible();
  await expect(block).not.toContainText("Skipping");
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

test("add all: one tap adds every course, sections share one", async ({
  page,
}) => {
  const user = await seedCalendarUser({
    courses: [],
    classes: [],
    pending: [
      "FINANCIAL ACCOUNTING BBA1 S1",
      "STATISTICS II BBA2 S1 SEC1",
      "STATISTICS II BBA2 S1 SEC2",
    ],
  });
  await page.route("**/api/calendar/sync", (r) => r.fulfill({ json: {} }));
  await logIn(page, user);
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: "Add all 3" }).click();
  await expect(page.getByText(/We found/)).toHaveCount(0);
  // The new courses have no classes yet, so the schedule syncs right away.
  const synced = page.waitForRequest("**/api/calendar/sync");
  await page.getByRole("link", { name: "See your week" }).click();
  await expect(page).toHaveURL(/\/app\/schedule$/);
  await synced;
  await page.goto("/app/courses");
  await expect(page.getByRole("link", { name: /Statistics II/ })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("link", { name: /Financial Accounting/ }),
  ).toHaveCount(1);
});

test.describe("phone and accessibility", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  for (const path of ["/app/calendar", "/app/plan", "/app/schedule"]) {
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
