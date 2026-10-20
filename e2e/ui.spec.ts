import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Phone-size checks on the public pages: no sideways scroll, 44px tap targets,
// and no axe contrast or label errors.
test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
});

for (const path of ["/", "/signup", "/login"]) {
  test(`${path} passes the phone and accessibility checks`, async ({
    page,
  }) => {
    await page.goto(path);
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
