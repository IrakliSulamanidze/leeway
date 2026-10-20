# Leeway design (signed off by Irakli, 2026-10-20)

Mockups: https://claude.ai/artifact/9t68FRVN5eTFp3zPRUEiUA (source: edtech/design/mockups.html, snapshot here as mockups.html)
Tokens: docs/tokens.css. The product name is one token: `APP` in the mockup script, `NEXT_PUBLIC_APP_NAME` / `lib/config.ts` in code. Name: Leeway (was Faltas, changed 20 Oct).

## Rules
- Look "Quiet": ink on warm grey, system font, 1px hairlines, no shadows except the toast and the bottom sheet. No gradients, no web fonts, no emoji, no badges with tinted backgrounds.
- Colour means state only: green Safe, amber Burning fast, red Last life / Out of lives / Over the limit. State colour goes on the big number and the status word, nothing else. Buttons and text are ink. Test days are ink bold, not coloured.
- Hearts: filled red = life left, red 2px outline = planned skip, filled grey = used. Order: left, planned, used. No lock icon. A legend sits under the course list.
- Course row (Monzo pattern): name + "<state> · N weeks to go" on the left, big number + "left" on the right, hearts below. Rows live in one hairline list, sorted by fewest lives left.
- Preview line under the field (Citymapper pattern): plain text, verdict first, number in state colour. Space reserved from first paint.
- Risk line: one red dot + text at the top of /app, no box.
- Undo: dark toast pinned at the bottom, "Skip logged. Undo", 5 seconds.
- Only dialog: last-spare bottom sheet, primary "Keep my spare", text link "Plan it anyway".
- Logged-in pages: header with logo and "Log out" (contract); bottom tabs Home, Plan, Settings.

## Word budgets (measured in the mockups)
Landing above the button 30 words; course row 10; preview 15; risk line 8; toast 3. Whole screens: landing 45, /app 120, other screens 30 to 90 (see captions).

## Screens
/, /signup, /login, /app (no calendar, empty, last-spare sheet), /app with calendar (Today list with Missed switches), course page (syllabus dates, test days), /app/plan (If you have to miss one, Trip check, Can I skip this week?), calendar connect, course mapping, syllabus review, settings (alerts, calendar, syllabi, delete account), sync failed, 21:00 night-before alert, Sunday check alert. Laptop: landing two columns, /app form left and courses right.

## Copy changes approved with this sign-off (spec to update)
1. Subhead: "For IE University students. Before you skip a class, see what it costs against the 80% rule."
2. Last-spare buttons: "Keep my spare" / "Plan it anyway" (were "Keep it / Plan it").
3. Headline: "Never fail a class on attendance." (replaces "Never fail a course on attendance by surprise.")
4. Landing proof row removed; the live course row shows the features.

## Checks passed
WCAG AA contrast for every text, state and heart colour (contrast-report.txt); 375px no sideways scroll; every tap target 44px+; word budgets; fresh AI-look reviews (reviews/design-ai-tells.md, -2.md) and 5-second stranger (reviews/design-5-second.md), all fixes applied.

## Kept on purpose, against reviewer advice
- Course names show exactly as typed (grading contract), so "microeconomics" stays lower case.
- "Log out" stays in the header (contract).
- Field label "Which class are you skipping?" stays: deciding before the skip is the product.

## Open for the build
- No dark mode in v1.
- iPhone push needs Add to Home Screen; the settings screen says so.
