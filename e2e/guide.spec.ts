import { expect, test, type Page } from "@playwright/test";

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
    guide(page).getByRole("link", { name: /Connect your IE calendar/ }),
  ).toHaveAttribute("href", "/app/calendar");
  await expect(
    guide(page).getByRole("link", { name: /Plan a trip/ }),
  ).toHaveAttribute("href", "/app/plan");

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
