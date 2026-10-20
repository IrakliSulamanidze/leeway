import { expect, test, type Page } from "@playwright/test";

// The core loop on /app: course cards, undo, a failed save, and a layout that
// doesn't move. Each test signs up its own fresh user.
test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

const domain = process.env.BOT_EMAIL_DOMAIN ?? "example.com";

async function signUp(page: Page) {
  const id = Math.random().toString(36).slice(2, 10);
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(`qa-core-${id}@${domain}`);
  await page.getByTestId("signup-password").fill(`pw-${id}-core`);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

async function logSkip(page: Page, text: string) {
  const before = await page.getByTestId("core-item").count();
  await page.getByTestId("core-input").fill(text);
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(before + 1);
  await expect(page.getByTestId("core-input")).toHaveValue("");
}

const course = (page: Page, name: string) =>
  page.locator(`[data-course="${name}"]`);

test("cards: empty state, then rows sorted by fewest lives left", async ({
  page,
}) => {
  await signUp(page);
  await expect(page.getByText("No skips yet.", { exact: false })).toBeVisible();
  await expect(page.getByText(/on its last life/)).toHaveCount(0);

  await logSkip(page, "Financial Accounting");
  await expect(course(page, "Financial Accounting")).toContainText("5 of 6");
  await expect(course(page, "Financial Accounting")).toContainText("Safe");
  for (let i = 0; i < 4; i++) await logSkip(page, "Statistics II");
  // Different case and spacing still count against the same course.
  await logSkip(page, "statistics  ii");
  await expect(course(page, "Statistics II")).toContainText("1 of 6");
  await expect(page.locator("[data-course]").first()).toHaveAttribute(
    "data-course",
    "Statistics II",
  );
  await expect(
    page.getByText("Statistics II is on its last life."),
  ).toBeVisible();
  await expect(page.getByText("Left", { exact: true })).toBeVisible();
  await expect(page.getByText("6 logged")).toBeVisible();
  // Newest first, text exactly as typed.
  await expect(page.getByTestId("core-item").first()).toContainText(
    "statistics  ii",
  );
  await expect(page.getByTestId("core-item").last()).toContainText(
    "Financial Accounting",
  );
});

test("undo: the toast removes the skip and the course it created", async ({
  page,
}) => {
  await signUp(page);
  await page.getByTestId("core-input").fill("Microeconomics");
  await expect(
    page.getByText(/New course\. You'll have 5 of 6 lives left\./),
  ).toBeVisible();
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(1);
  await expect(page.getByText("Skip logged.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("core-item")).toHaveCount(0);
  await expect(course(page, "Microeconomics")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("core-item")).toHaveCount(0);
});

test("offline save keeps text and saves once back online", async ({
  page,
  context,
}) => {
  await signUp(page);
  await page.getByTestId("core-input").fill("Algorithms");
  await context.setOffline(true);
  await page.getByTestId("core-submit").click();
  await expect(page.getByText(/Couldn't save/)).toBeVisible();
  await expect(page.getByTestId("core-input")).toHaveValue("Algorithms");
  await context.setOffline(false);
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(1);
  await expect(page.getByTestId("core-item")).toContainText("Algorithms");
});

test("layout: field and button don't move when typing or saving", async ({
  page,
}) => {
  await signUp(page);
  const input = page.getByTestId("core-input");
  const submit = page.getByTestId("core-submit");
  const boxes = async () => [
    await input.boundingBox(),
    await submit.boundingBox(),
  ];
  const start = await boxes();
  await input.fill("A very long course name that wraps the preview line");
  await expect(page.getByText(/New course/)).toBeVisible();
  expect(await boxes()).toEqual(start);
  await submit.click();
  await expect(page.getByTestId("core-item")).toHaveCount(1);
  expect(await boxes()).toEqual(start);
  // The course chip now shows above the field, in space kept from first paint.
  await expect(chip(page, LONG)).toBeVisible();
  await input.fill(LONG);
  await expect(page.getByText(/This uses 1 life\. 4 left/)).toBeVisible();
  expect(await boxes()).toEqual(start);
  await input.fill("A very long course name that wraps the preview lin");
  const near = page.getByRole("button", { name: `Did you mean ${LONG}?` });
  await expect(near).toBeVisible();
  expect(await boxes()).toEqual(start);
  await near.click();
  await expect(input).toHaveValue(LONG);
  await expect(chip(page, LONG)).toHaveAttribute("aria-pressed", "true");
  expect(await boxes()).toEqual(start);
});

const LONG = "A very long course name that wraps the preview line";
const chip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Your courses" }).getByRole("button", {
    name,
    exact: true,
  });
const dayButton = (page: Page, name: "Today" | "Tomorrow") =>
  page.getByRole("group", { name: "Day" }).getByRole("button", { name });
const doubleSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Double class" });

async function expectReset(page: Page) {
  await expect(dayButton(page, "Today")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(doubleSwitch(page)).toHaveAttribute("aria-checked", "false");
}

test("form: planned shows hollow hearts, double costs 2, every save resets", async ({
  page,
}) => {
  await signUp(page);
  await expectReset(page);
  await page.getByTestId("core-input").fill("Microeconomics");
  await dayButton(page, "Tomorrow").click();
  await doubleSwitch(page).click();
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(1);
  await expect(page.getByText("Planned for tomorrow.")).toBeVisible();
  await expectReset(page);
  const item = page.getByTestId("core-item").first();
  await expect(item).toContainText("Microeconomics");
  await expect(item).toContainText("x2");
  await expect(item).toContainText("planned");
  const card = course(page, "Microeconomics");
  await expect(card).toContainText("4 of 6");
  await expect(card).toContainText("2 planned");
  await expect(card.locator('path[fill="none"]')).toHaveCount(2);

  // Back on Today, single: one tap logs exactly one session for today.
  await logSkip(page, "Microeconomics");
  await expect(card).toContainText("3 of 6");
  await expect(page.getByTestId("core-item").first()).not.toContainText("x2");
  await expect(page.getByTestId("core-item").first()).toContainText("Today");
  await expectReset(page);

  // A chip fills the field.
  await chip(page, "Microeconomics").click();
  await expect(page.getByTestId("core-input")).toHaveValue("Microeconomics");
});

test("last spare: the sheet asks on a planned save only, never on Today", async ({
  page,
}) => {
  await signUp(page);
  const input = page.getByTestId("core-input");
  for (let i = 0; i < 2; i++) {
    await input.fill("Statistics II");
    await doubleSwitch(page).click();
    await page.getByTestId("core-submit").click();
    await expect(page.getByTestId("core-item")).toHaveCount(i + 1);
  }
  await logSkip(page, "Statistics II");
  await expect(course(page, "Statistics II")).toContainText("1 of 6");
  const sheet = page.getByRole("dialog");

  // Planned: asks. Keep my spare saves nothing.
  await input.fill("Statistics II");
  await expect(page.getByText(/This uses your last spare\./)).toBeVisible();
  await dayButton(page, "Tomorrow").click();
  await page.getByTestId("core-submit").click();
  await expect(sheet).toContainText("This is your last spare. Plan it anyway?");
  await sheet.getByRole("button", { name: "Keep my spare" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("core-item")).toHaveCount(3);

  // Plan it anyway saves the plan.
  await page.getByTestId("core-submit").click();
  await sheet.getByRole("button", { name: "Plan it anyway" }).click();
  await expect(page.getByTestId("core-item")).toHaveCount(4);
  await expect(course(page, "Statistics II")).toContainText("0 of 6");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("core-item")).toHaveCount(3);

  // Today with the last spare: no dialog, saved in one tap.
  await expectReset(page);
  await logSkip(page, "Statistics II");
  await expect(sheet).toHaveCount(0);
  await expect(course(page, "Statistics II")).toContainText("0 of 6");
});

test("course row: a new course's card sets its sessions inline", async ({
  page,
}) => {
  await signUp(page);
  await logSkip(page, "Algorithms");
  const card = course(page, "Algorithms");
  await expect(card).toContainText("estimated");
  const sessions = card.getByLabel("Sessions in this course:");
  const missed = card.getByLabel("Missed before today:");
  await expect(sessions).toHaveValue("30");
  await expect(missed).toHaveValue("0");
  await sessions.fill("15");
  await missed.fill("1");
  await card.getByRole("button", { name: "Save" }).click();
  // 15 sessions = 3 lives, minus 1 missed and 1 skip.
  await expect(card).toContainText("1 of 3");
  await expect(card).not.toContainText("estimated");
  await expect(card.getByLabel("Sessions in this course:")).toHaveCount(0);
  // Missed-before sessions aren't listed in Recent skips.
  await expect(page.getByTestId("core-item")).toHaveCount(1);
});

test("remove course: course page deletes skips, keeps the course, then removes it", async ({
  page,
}) => {
  await signUp(page);
  await logSkip(page, "Marketing");
  await page.getByTestId("core-input").fill("Marketing");
  await dayButton(page, "Tomorrow").click();
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(2);

  await course(page, "Marketing")
    .getByRole("link", { name: "Marketing" })
    .click();
  await expect(page).toHaveURL(/\/app\/courses\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Marketing" })).toBeVisible();
  await expect(page.getByText("Counting from today")).toBeVisible();
  const rows = page.getByTestId("course-skip");
  await expect(rows).toHaveCount(2);
  await rows.getByRole("button", { name: "Cancel" }).click();
  await expect(rows).toHaveCount(1);
  await rows.getByRole("button", { name: "Delete" }).click();
  await expect(rows).toHaveCount(0);
  await expect(
    page.getByText("No skips in this course. It keeps all 6 lives."),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("6 of 6 left");

  // Sessions out of range are refused; lowering below what's used is allowed.
  await page.getByLabel("Sessions in this course:").fill("201");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Sessions must be 1 to 200.")).toBeVisible();

  await page.getByRole("button", { name: "Remove course" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(course(page, "Marketing")).toHaveCount(0);
  await expect(page.getByTestId("core-item")).toHaveCount(0);
});
