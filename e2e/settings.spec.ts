import { expect, test } from "@playwright/test";

// Settings: "Delete my account and data" removes the account, signs out, and
// the same email and password no longer log in.
test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

const domain = process.env.BOT_EMAIL_DOMAIN ?? "example.com";

test("delete account: data gone, signed out, can't log in again", async ({
  page,
}) => {
  const id = Math.random().toString(36).slice(2, 10);
  const email = `qa-settings-${id}@${domain}`;
  const password = `pw-${id}-settings`;
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByTestId("core-input").fill("Statistics II");
  await page.getByTestId("core-submit").click();
  await expect(page.getByTestId("core-item")).toHaveCount(1);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Yes, delete everything" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("logout")).toHaveCount(0);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(
    page.getByText("That email and password don't match."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
