PR 3: feat: lives, pace and Madrid date rules
Lane: rules. Needs merged: 1 (row types may be stubbed; switch to `src/lib/db/types.ts` when PR 2 merges). Budget: 25 min. Review: CI only.
Goal: the core product rules as pure, tested functions shared by the page and the preview.
Spec + design refs: spec "Rules", "Defaults and limits", "Inside the app" copy table; tech-plan 5 (signatures fixed), counting rule in tech-plan 2.
Files to touch: `src/lib/rules/{dates,lives,match,preview}.ts`, `src/lib/config.ts` (term fall 2026: 7 Sep to 18 Dec), tests next to each file.
Out of scope: `week.ts` (PR 7), `alert.ts` (PR 9), UI, database calls.
Done when: vitest passes `dates.test.ts` (23:30 UTC rollovers, 25 Oct 2026 and 28 Mar 2027, weeksToGo 0 after term), `lives.test.ts` (30->6, 25->5, 15->3, source order typed > syllabus > calendar > 30, estimated flag, missed_before, x2, planned counted), `pace.test.ts` (order over/out/last/burning/safe, burning only from week 4 with 2+ skips in the last 4 weeks or 2 left with >4 weeks, attendance safe), `match.test.ts`, `preview.test.ts` (every preview string in the spec copy table verbatim); `npm run check` green.
Risk: none (pure code) -> no security review.
