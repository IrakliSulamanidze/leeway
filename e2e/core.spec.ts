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
    page.getByText("New course. You'll have 5 of 6 lives left."),
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
  await input.fill("A very long course name that wraps the preview line");
  await expect(page.getByText(/This uses 1 life\. 4 left/)).toBeVisible();
  expect(await boxes()).toEqual(start);
});
