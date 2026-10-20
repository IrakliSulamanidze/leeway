import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";

// Copies the grading bot's steps (docs/process.md 5.4). Runs against BASE_URL
// or the local server; uses only the public UI and the public REST API.
test.describe.configure({ mode: "serial" });

const run = Math.random().toString(36).slice(2, 8).toUpperCase();
const domain = process.env.BOT_EMAIL_DOMAIN ?? "example.com";
const userA = {
  email: `qa-a-${run.toLowerCase()}@${domain}`,
  password: `pw-${run}-a1`,
};
const userB = {
  email: `qa-b-${run.toLowerCase()}@${domain}`,
  password: `pw-${run}-b2`,
};
const itemText = `QA-${run} grading bot test`;
const phone = devices["iPhone 13"];
const iPhone = {
  viewport: phone.viewport,
  userAgent: phone.userAgent,
  deviceScaleFactor: phone.deviceScaleFactor,
  isMobile: phone.isMobile,
  hasTouch: phone.hasTouch,
};

async function signUp(page: Page, user: { email: string; password: string }) {
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(user.email);
  await page.getByTestId("signup-password").fill(user.password);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

test("1. landing page works on laptop and phone; /app needs login", async ({
  browser,
}, info) => {
  for (const [name, options] of [
    ["laptop", { viewport: { width: 1280, height: 800 } }],
    ["phone", iPhone],
  ] as const) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto("/");
    await page.screenshot({
      path: info.outputPath(`landing-${name}.png`),
      fullPage: true,
    });
    await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(1);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `${name}: no horizontal scroll`).toBeLessThanOrEqual(0);
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});

test("2-4. sign up, save an item, log out, log back in", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, userA);
  await expect(page.getByTestId("logout")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("logout")).toBeVisible();

  // 3. Typing only in core-input and one click saves exactly one item.
  await page.goto("/app");
  const before = await page.getByTestId("core-item").count();
  await page.getByTestId("core-input").fill(itemText);
  await page.getByTestId("core-submit").click();
  await expect(
    page.getByTestId("core-item").filter({ hasText: itemText }),
  ).toHaveCount(1);
  await expect(page.getByTestId("core-item")).toHaveCount(before + 1);

  // 4. Log out, then log in again from a clean browser.
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("logout")).toHaveCount(0);
  await context.close();

  const fresh = await browser.newContext();
  const page2 = await fresh.newPage();
  await page2.goto("/login");
  await page2.getByTestId("login-email").fill(userA.email);
  await page2.getByTestId("login-password").fill(`${userA.password}-wrong`);
  await page2.getByTestId("login-submit").click();
  await expect(page2.getByRole("alert")).toBeVisible();
  await expect(page2).toHaveURL(/\/login$/);
  await page2.getByTestId("login-password").fill(userA.password);
  await page2.getByTestId("login-submit").click();
  await expect(page2).toHaveURL(/\/app$/);
  await expect(
    page2.getByTestId("core-item").filter({ hasText: itemText }),
  ).toHaveCount(1);
  await fresh.close();
});

test("5. a second user cannot see the first user's item", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, userB);
  await expect(page.getByTestId("core-input")).toBeVisible();
  await expect(
    page.getByTestId("core-item").filter({ hasText: itemText }),
  ).toHaveCount(0);
  await context.close();
});

test("6. the public REST API returns no rows without a session", async ({
  request,
}) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!process.env.CI)
    test.skip(!url || !key, "set the NEXT_PUBLIC_SUPABASE_* env vars to run");
  expect(url && key, "Supabase URL and publishable key are set").toBeTruthy();

  // Every table created in any migration, so new tables are covered automatically.
  const dir = join("supabase", "migrations");
  const sql = readdirSync(dir)
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  const tables = [
    ...new Set(
      [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map(
        (m) => m[1],
      ),
    ),
  ];
  expect(tables.length).toBeGreaterThan(0);
  for (const table of tables) {
    const res = await request.get(`${url}/rest/v1/${table}?select=*`, {
      headers: { apikey: key!, Authorization: `Bearer ${key}` },
    });
    const body = res.ok() ? await res.json() : [];
    expect(body, `${table}: anonymous read returns nothing`).toEqual([]);
  }
});

test("7. the repo is public", async ({ request }) => {
  test.skip(!process.env.CHECK_REPO_PUBLIC, "deploy stage only");
  const res = await request.get(
    "https://api.github.com/repos/IrakliSulamanidze/leeway",
  );
  expect(res.status()).toBe(200);
  expect((await res.json()).private).toBe(false);
});
