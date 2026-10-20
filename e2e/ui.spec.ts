import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phone-size checks on the public pages: no sideways scroll, 44px tap targets,
// and no axe contrast or label errors.
test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
});

async function signUp(page: Page) {
  const id = Math.random().toString(36).slice(2, 10);
  const domain = process.env.BOT_EMAIL_DOMAIN ?? "example.com";
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(`qa-ui-${id}@${domain}`);
  await page.getByTestId("signup-password").fill(`pw-${id}-ui`);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/app$/);
}

test("landing: at most 30 words above the sign-up button", async ({ page }) => {
  await page.goto("/");
  const words = await page.evaluate(() => {
    const button = [...document.querySelectorAll("a")].find((a) =>
      /sign up/i.test(a.textContent ?? ""),
    );
    if (!button) return -1;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let text = "";
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (button.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)
        break;
      if (button.contains(n)) break;
      const parent = n.parentElement;
      if (parent && parent.closest("script, style, template")) continue;
      text += ` ${n.textContent}`;
    }
    return text.split(/\s+/).filter(Boolean).length;
  });
  expect(words).toBeGreaterThan(0);
  expect(words).toBeLessThanOrEqual(30);
});

for (const path of ["/", "/signup", "/login", "/app", "/app/settings"]) {
  test(`${path} passes the phone and accessibility checks`, async ({
    page,
  }) => {
    if (path.startsWith("/app")) {
      await signUp(page);
      await page.getByTestId("core-input").fill("Statistics II");
      await page.getByTestId("core-submit").click();
      await expect(page.getByTestId("core-item")).toHaveCount(1);
      await page.getByTestId("core-input").fill("Statistics II");
    }
    if (path !== "/app") await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scroll at 375px").toBeLessThanOrEqual(0);

    const small = await page.$$eval(
      "a, button, input, textarea, select",
      (els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({
            el: el.outerHTML.slice(0, 80),
            box: el.getBoundingClientRect(),
          }))
          .filter(({ box }) => box.height < 44 || box.width < 44)
          .map(
            ({ el, box }) =>
              `${Math.round(box.width)}x${Math.round(box.height)} ${el}`,
          ),
    );
    expect(small, "tap targets are at least 44x44").toEqual([]);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
