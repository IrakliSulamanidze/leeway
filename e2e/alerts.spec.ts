import { expect, test } from "@playwright/test";

// Alerts: no permission prompt until "Turn on alerts" is tapped, a valid
// manifest, and the tap saves a subscription. The browser's push service is
// stubbed (headless browsers have none), so nothing leaves the machine.
test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

const domain = process.env.BOT_EMAIL_DOMAIN ?? "example.com";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __prompts: number };
    w.__prompts = 0;
    Object.defineProperty(Notification, "permission", {
      get: () => (w.__prompts ? "granted" : "default"),
    });
    Notification.requestPermission = async () => {
      w.__prompts++;
      return "granted";
    };
    const id = Math.random().toString(36).slice(2);
    const fake = {
      endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${id}`,
      toJSON: () => ({
        endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${id}`,
        keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" },
      }),
    };
    let subscribed = false;
    PushManager.prototype.getSubscription = async () =>
      (subscribed ? fake : null) as unknown as PushSubscription;
    PushManager.prototype.subscribe = async () => {
      subscribed = true;
      return fake as unknown as PushSubscription;
    };
  });
});

const prompts = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __prompts: number }).__prompts);

test("manifest is valid", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe("Leeway");
  expect(m.start_url).toBe("/app");
  expect(m.display).toBe("standalone");
  expect(m.icons.length).toBeGreaterThan(0);
});

test("no prompt until the tap, then the subscription is saved", async ({
  page,
}) => {
  await page.goto("/");
  expect(await prompts(page)).toBe(0);

  const id = Math.random().toString(36).slice(2, 10);
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(`qa-alerts-${id}@${domain}`);
  await page.getByTestId("signup-password").fill(`pw-${id}-alerts`);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
  expect(await prompts(page)).toBe(0);

  await page.goto("/app/settings");
  const button = page.getByRole("button", { name: "Turn on alerts" });
  await expect(button).toBeVisible();
  expect(await prompts(page)).toBe(0);

  // "Alerts are on." shows only after the server action saved the row.
  await button.click();
  await expect(page.getByText("Alerts are on.")).toBeVisible();
  expect(await prompts(page)).toBe(1);
});
