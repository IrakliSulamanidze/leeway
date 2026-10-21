import { expect, test, type Page } from "@playwright/test";
import { madridToday, seedCalendarUser } from "./helpers/seed";

// The "Start here" guide a new student sees on the Skip tab: it never moves the
// skip box, "Got it" hides it for that account only, and it stays hidden.
test.use({ viewport: { width: 375, height: 812 }, isMobile: true });
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.BASE_URL,
  "needs Supabase",
);

const domain = process.env.BOT_EMAIL_DOMAIN ?? "example.com";

async function signUp(page: Page) {
  const id = Math.random().toString(36).slice(2, 10);
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(`qa-guide-${id}@${domain}`);
  await page.getByTestId("signup-password").fill(`pw-${id}-guide`);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

const guide = (page: Page) => page.getByRole("region", { name: "Start here" });

test("a new student sees the guide, and a save doesn't move the skip box", async ({
  page,
}) => {
  await signUp(page);
  await expect(guide(page)).toBeVisible();
  await expect(
    guide(page).getByRole("link", { name: "Connect calendar" }),
  ).toHaveAttribute("href", "/app/calendar");
  await expect(page.getByTestId("tour")).toHaveCount(0);

  const input = await page.getByTestId("core-input").boundingBox();
  const submit = await page.getByTestId("core-submit").boundingBox();
  await page.getByTestId("core-input").fill("Statistics II");
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(guide(page)).toBeVisible();
  expect(await page.getByTestId("core-input").boundingBox()).toEqual(input);
  expect(await page.getByTestId("core-submit").boundingBox()).toEqual(submit);
});

test("Got it hides the guide for that account only", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page);
  await guide(page).getByRole("button", { name: "Got it" }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Connect your IE calendar" }),
  ).toBeVisible();
  await page.reload();
  await expect(guide(page)).toHaveCount(0);

  // Same browser, new account: its own guide is back.
  await page.getByTestId("logout").click();
  await signUp(page);
  await expect(guide(page)).toBeVisible();
  await context.close();
});

test("a new student's tour: skip box, connect, alerts, then connect for real", async ({
  page,
}) => {
  await signUp(page);
  await guide(page).getByRole("link", { name: "Show me around" }).click();
  const tour = page.getByTestId("tour");
  const stops = [
    ["/app", "Skip a class"],
    ["/app/schedule", "Your calendar"],
    ["/app/settings", "Night-before alerts"],
  ];
  for (const [i, [path, title]] of stops.entries()) {
    await expect(page).toHaveURL(new RegExp(`${path}\\?tour=${i}$`));
    await expect(tour.getByRole("heading", { name: title })).toBeVisible();
    if (i === 1) {
      // The tab it lives on stays lit, and the arrow keys move too.
      await expect(
        page.locator('[data-tabs] a[aria-current="page"]').first(),
      ).toHaveText(/Calendar/);
      await page.keyboard.press("ArrowLeft");
      await expect(page).toHaveURL(/\/app\?tour=0$/);
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(/\/app\/schedule\?tour=1$/);
      await expect(tour.getByRole("heading", { name: title })).toBeVisible();
    }
    if (i < stops.length - 1)
      await tour.getByRole("button", { name: "Next", exact: true }).click();
  }
  await tour.getByRole("button", { name: "Connect my calendar" }).click();
  await expect(page).toHaveURL(/\/app\/calendar$/);
  await expect(tour).toHaveCount(0);
  await page.goto("/app");
  await expect(guide(page)).toHaveCount(0);
});

test("with a calendar the tour shows the week, Plan a trip and courses", async ({
  page,
}) => {
  const user = await seedCalendarUser({
    courses: ["Microeconomics"],
    classes: [
      { key: "a", course: "Microeconomics", day: madridToday(), hourUtc: 9 },
    ],
  });
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/app$/);
  await guide(page).getByRole("link", { name: "Show me around" }).click();
  const tour = page.getByTestId("tour");
  const stops = [
    ["/app", "Skip a class"],
    ["/app/schedule", "Your calendar"],
    ["/app/schedule", "Plan a trip"],
    ["/app/courses", "Your courses"],
    ["/app/settings", "Night-before alerts"],
  ];
  for (const [i, [path, title]] of stops.entries()) {
    await expect(page).toHaveURL(new RegExp(`${path}\\?tour=${i}$`));
    await expect(tour.getByRole("heading", { name: title })).toBeVisible();
    if (i < stops.length - 1)
      await tour.getByRole("button", { name: "Next", exact: true }).click();
  }
  await tour.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/app\/courses\?tour=3$/);
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await tour.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(tour).toHaveCount(0);
  await expect(guide(page)).toHaveCount(0);
});

test("Skip tour closes it and keeps the guide", async ({ page }) => {
  await signUp(page);
  await guide(page).getByRole("link", { name: "Show me around" }).click();
  await page
    .getByTestId("tour")
    .getByRole("button", { name: "Skip tour" })
    .click();
  await expect(page.getByTestId("tour")).toHaveCount(0);
  await expect(page).toHaveURL(/\/app$/);
  await expect(guide(page)).toBeVisible();
});

test("the lit part stays usable: tapping Connect leaves the tour for it", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/app/schedule?tour=1");
  await expect(page.getByTestId("tour")).toBeVisible();
  await page.getByRole("link", { name: "Connect your IE calendar" }).click();
  await expect(page).toHaveURL(/\/app\/calendar$/);
  await expect(page.getByTestId("tour")).toHaveCount(0);
});
