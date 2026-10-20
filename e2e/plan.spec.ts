import { expect, test, type Page } from "@playwright/test";
import { madridToday, seedCalendarUser } from "./helpers/seed";

// Plan a trip with Save as planned skips, then Can I skip this week?, If you
// have to miss one and test marks.

async function logIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

const today = madridToday();

test("tests", async ({ page }) => {
  const user = await seedCalendarUser({
    courses: ["Microeconomics"],
    classes: [{ key: "m", course: "Microeconomics", day: today, hourUtc: 9 }],
  });
  await logIn(page, user);
  await page.goto("/app/plan");
  await expect(
    page.getByText("Left out: Microeconomics (mark test days first)."),
  ).toBeVisible();

  await page.getByLabel("Test day", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Mark test day" }).click();
  await expect(page.getByTestId("week-verdict")).toContainText(
    "Microeconomics has a test on",
  );
  // A test day is never offered as the one to miss.
  await expect(
    page.getByText(/Left out: Microeconomics on .* \(test day\)/),
  ).toBeVisible();
});

test("if you have to miss one never offers a last life", async ({ page }) => {
  const user = await seedCalendarUser({
    courses: ["Financial Accounting"],
    classes: [
      { key: "f", course: "Financial Accounting", day: today, hourUtc: 9 },
    ],
    tests: [{ course: "Financial Accounting", day: "2026-12-10" }],
  });
  await logIn(page, user);
  await page.goto("/app/plan");
  await expect(
    page
      .getByRole("region", { name: "If you have to miss one" })
      .getByTestId("plan-class"),
  ).toHaveCount(1);
  await expect(page.getByTestId("week-verdict")).toHaveText(
    "You'd miss 1 class. Every course stays safe.",
  );
});

test("trip check saves planned skips", async ({ page }) => {
  const user = await seedCalendarUser({
    courses: ["Algorithms"],
    classes: [{ key: "a", course: "Algorithms", day: today, hourUtc: 9 }],
    tests: [{ course: "Algorithms", day: "2026-12-10" }],
  });
  await logIn(page, user);
  await page.goto("/app/plan");
  await page.getByLabel("From", { exact: true }).fill(today);
  await page.getByLabel("To", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Check these dates" }).click();
  await expect(page.getByTestId("trip-verdict")).toHaveText(
    "You'd miss 1 class. Every course stays safe.",
  );
  const card = page.getByTestId("trip-course");
  await expect(card).toContainText("Misses 1 class");
  await expect(card).toContainText("lives left");
  await page.getByRole("button", { name: "Save as planned skips" }).click();
  await expect(page.getByTestId("trip-verdict")).toHaveText(
    "Already planned. Every course stays safe.",
  );
  await expect(card).toContainText("Already planned");
});

test("trip check calls out a test in the dates", async ({ page }) => {
  const user = await seedCalendarUser({
    courses: ["Algorithms", "Microeconomics"],
    classes: [
      { key: "a", course: "Algorithms", day: today, hourUtc: 9 },
      { key: "m", course: "Microeconomics", day: today, hourUtc: 11 },
    ],
    tests: [{ course: "Algorithms", day: today }],
  });
  await logIn(page, user);
  await page.goto("/app/plan");
  await page.getByLabel("From", { exact: true }).fill(today);
  await page.getByLabel("To", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Check these dates" }).click();
  await expect(page.getByTestId("trip-verdict")).toContainText(
    "Algorithms has a test on",
  );
  const cards = page.getByTestId("trip-course");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText(/on \w{3} \d+/);
  await expect(cards.nth(1)).toContainText("No test dates marked yet.");
  await cards.first().locator("summary").click();
  await expect(cards.first().getByTestId("plan-class")).toHaveCount(1);
});
