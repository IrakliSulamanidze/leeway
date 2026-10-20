# Leeway: Product Spec v1

Oct 20, 2026 · @Irakli

## Summary

Leeway is a phone-first web app for IE University bachelor's students. Every course gets a number of lives, the classes you can miss before the 80% rule fails you, and Leeway shows what a skip costs before you take it.

**One-liner:** Leeway helps IE University bachelor's students check what a skip costs before they take it, so they never fail a class on attendance.

**Data:** private. Each student sees only their own courses and skips.

**Where this sits:** stage 1 of 5 (spec, design, technical plan, build, deploy). This version folds in the three-lens review (grader, product, build risk) and Irakli's real IE calendar feed. The earlier prototype, built under the old name Faltas, is throwaway.

## Target user

The user is any IE University bachelor's student. IE's 2026-27 bachelor attendance policy appears to set one rule for every year: below 80% attendance in a course, a 0.0 in both the ordinary and extraordinary calls ([Attendance Policy, Bachelor Programs](https://docs.ie.edu/documents/Attendance_Policy_Bachelor_Programs.pdf), found by search; ie.edu is blocked from here, so not opened yet). Older student guides had year tiers, so Leeway copy stays year-neutral and is right under either version.

**Persona: Lucía, 19, first-year Business, Madrid campus**

- Takes 6 to 8 courses a semester, each with its own number of sessions.
- Skips about one class a week: a late metro, a bad night, a deadline elsewhere.
- Lives on her phone. Opens Blackboard on a laptop, rarely, and never to check attendance.
- Knows the 80% rule exists, but not her own count or limit in any course.

**When she opens Leeway**

1. The night before or the morning of a class, deciding whether to skip. This is the main moment, and she can save the decision as a planned skip for tomorrow.
2. Right after a skip she didn't plan, to log it.
3. When the app or a night-before alert shows a course at risk, to decide what to protect.
4. With a calendar connected: before a trip, or on Sunday to check the week.

**Not the user (v1):** students at universities without a hard attendance minimum, and professors.

## Problem, and why Blackboard doesn't solve it

The pain isn't a missing record. It's a decision made blind: "Can I skip tomorrow?" gets answered with a guess, and a wrong guess can cost a 0.0 in both exam calls and a paid re-enrolment next year.

|  | Blackboard | Leeway |
| --- | --- | --- |
| Question it answers | What was my attendance? | What does this skip cost me? |
| Timing | Backwards, often days or weeks late (professors enter it late) | Instant, at the moment you decide |
| View | One course at a time, as a percentage | All courses at once, as lives left |
| Warning before the limit | None | Pace label and risk banner |
| Device | Mostly laptop | Phone first |

**Why students don't just check Blackboard:** people avoid information that might be bad news, the "ostrich effect" (Karlsson, Loewenstein and Seppi, 2009). A student close to the limit checks least, exactly when checking matters most. The same effect would hide the warning inside an app she avoids, so v1 also sends a night-before push alert when tomorrow carries a risk. v2 adds a Leeway calendar feed that puts "Micro · 2 lives left" in the calendar she already reads.

**The honest cost:** Leeway does not sync with Blackboard, because IE gives no API. The student logs each skip themselves, which takes one field and one tap. With a calendar connected, it becomes one tap on today's class.

## Core loop

The loop takes one field and one tap, with Today preselected. Tapping Tomorrow saves a planned skip instead, and only a planned skip that would spend the last spare asks first. A skip that already happened is never questioned.

&#91;embedded content: core loop · one skip, one decision\]

The cost shows while the student is still deciding, so "Go to class" is a real outcome of the loop, not a failure to log.

## Mechanics and the psychology behind each

Every mechanic has to make the student look at their real risk more often and decide better. None of them may shame or nag.

| Mechanic | What the student sees | Psychology | Why it earns its place |
| --- | --- | --- | --- |
| Lives per course | "Microeconomics: 3 lives left", shown as hearts | Discrete units are more concrete than a percentage: "3 left" is easier to act on than "81%". Risk: a budget set aside tends to get spent to its limit, so lives are framed as a safety buffer and the button says "Log a skip", never "Use a life". | Turns a percentage into something you can count and protect. |
| Skip cost preview | While typing: "This uses 1 life. 2 left, 8 weeks to go: about one skip a month." | Feedback at the moment of choice. The rate does the maths she would otherwise skip. | The one thing Blackboard can't do, and the reason to open the app. |
| Planned skips | A Tomorrow chip, and "Plan this trip" with a calendar. Planned skips show as hollow hearts and count in every preview. | Present bias is beaten by commitment, not by information alone. A trip saved in October makes a casual November skip visibly cost the trip. | Records the decision when it's made, so the count never depends on remembering to log tomorrow. |
| Pace label | Safe, Burning fast, Last life, Out of lives, Over the limit | Temporal framing: 2 lives with 8 weeks left is a different risk from 2 lives with 1 week left. | Warns before the limit, not at it. |
| Reserve life | The last life is a spare. Planning to spend it asks first. | Earmarking plus a little friction: money (or lives) kept for emergencies is spent less casually. The friction sits on the decision, never on recording what happened. | Protects against the skip you didn't choose, like being ill in December. |
| Risk banner | One line under the form for any course that isn't Safe | Rare, well-timed warnings get read. Frequent ones get ignored (alert fatigue). | Shows the risk inside the app without a popup. |
| Night-before alert | At 21:00, only when tomorrow carries a risk: "Tomorrow 9:00 Stats. Last life, don't skip." | The cue lands when the decision is made, the evening before. Rare alerts get read; daily ones get muted (alert fatigue). | Reaches students who avoid opening the app, the ostrich effect's blind spot. |
| Weekly check (with a calendar) | A Sunday card: "Skipped anything else this week?" with the week's classes | Feedback after the fact works too: home energy reports cut use by about 2% (Allcott, 2011). A fixed weekly moment catches forgotten logs. | Keeps the hearts honest without asking about every class. |
| Shame-free tone | "Stats is on its last life. Guard it." No red guilt walls. | Shame ("I'm bad") drives hiding, while guilt about an act ("I skipped") drives repair (Tangney and Dearing, 2002). Copy talks about the course and the count, never the student. | Honest logging is what keeps the numbers true. |
| Instant undo | "Skip logged. Undo" for 5 seconds, plus delete on every skip | Lowers the fear of a wrong tap, so logging stays quick. | Prevents dirty data without a confirm step on every save. |

**Lines we won't cross:** no streaks that punish a missed day, no fake urgency, no daily nagging, and no wording that encourages skipping. No feature recommends a class to skip: the week tool is called "If you have to miss one" and never offers a test day. The frame is protection ("don't fail on attendance"), not permission.

## Scope: one release

v1 ships as one release with everything below, as Irakli decided on 20 Oct. It's built in dependency order (core, then calendar, then syllabus and alerts), and the finished app passes the bot-copy test before it's submitted. Before the technical plan, two quick spikes test the riskiest parts on Irakli's Mac (decision 9).

**Core: the graded path**

- Landing page, sign-up, login and logout, following the grading contract.
- Log a skip: the course name is the only field you must fill. Today is preselected; Tomorrow saves a planned skip.
- A "Double class" toggle that logs 2 sessions in one tap, because IE's 2h50 classes count as 2.
- Your courses as one-tap chips above the field, and "Did you mean Microeconomics?" when a new name is close to one you already have.
- Skip cost preview before saving.
- Lives per course from its number of sessions (default 30 sessions, so 6 lives). After a new course's first skip, its card shows an inline row for the course's sessions and any classes missed before today.
- Pace label, reserve life and risk banner.
- Recent skips: every skip ever logged, newest first, always visible under the course cards.
- Instant undo, delete on any skip, and cancel on any planned skip.
- Settings: alerts, calendar, and delete my account and data.
- Empty, loading and error states. Works on a phone with no sideways scrolling.

**Calendar** (builds on the core)

- Connect a calendar by link. IE's own calendar link, copied from Blackboard, comes first; iPhone, Google and Outlook links also work.
- One-time course mapping: Leeway reads course names from the event titles, and you confirm each one or link it to a course you already log.
- Sessions per course counted from the calendar, so lives set themselves unless you typed a number.
- **Today:** your classes today, each with a Skipped toggle. Classes you don't mark count as attended.
- **Weekly check:** from Sunday, a card lists the week's classes so you can mark any skip you forgot. "All good" closes it.
- **Can I skip this week?** and **Trip check** (any dates): a one-line verdict first, then each class you'd miss. Trip check can save the trip as planned skips.
- **If you have to miss one:** this week's classes ordered by what they cost. Test days and courses on their last life are left out, and a course with no test days marked says "Mark Micro's test days first".
- Mark a test on any class in one tap, or add one by date on a course card.
- **Attendance safe:** shown when a course's lives left cover every class remaining.

**Syllabus and tests** (uses the calendar for dates)

- Import a syllabus by pasting its text or picking the PDF. One AI read, then a review screen you confirm line by line.
- Tests, presentations and the final placed on their sessions, with weights. The preview names them: "Session 16 is Continuous Evaluation II (7.5%)."
- "Exam prep" on the session before a test, and a countdown on the course card.
- **What you'll miss:** the topic and pre-reading of the session you're about to skip. Anything the syllabus doesn't say outright is marked "probably".
- Sessions from the syllabus set lives when you haven't typed a number.
- Re-importing a newer syllabus shows only what changed.

**Night-before alerts**

- At about 21:00 Madrid time, one push alert about tomorrow, sent only when tomorrow carries a risk: a class in a course on its last life or out of lives, a test, or a skip you planned.
- Examples: "Tomorrow 9:00 Stats. Last life, don't skip." · "Algorithms test tomorrow: session 16 (7.5%)." · "You planned to skip Micro tomorrow. That leaves 1 life."
- At most one alert a night, with everything in one message. Nothing is sent on a night with no risk, so the alert keeps its force.
- Without a calendar, alerts cover planned skips and tests added by date, because Leeway doesn't know the timetable.
- Turned on with "Turn on alerts" in Settings or in the risk banner. The browser asks for permission only after that tap. On iPhone, Leeway must first be added to the Home Screen (iOS 16.4 or later), and Settings shows how. Android and laptop browsers work directly.
- A nightly job on the server sends them. It refreshes each connected calendar first, so a cancelled class doesn't trigger an alert.

**v2 (after v1)**

- A Leeway calendar feed to subscribe to once: class events read "Micro · 2 lives left" or "Algorithms · test day".
- A weekly timetable builder for students with no calendar link.
- Justified absences, marked "papers pending" with IE's 7-day deadline for documents.
- Lateness, if IE counts it.
- Blackboard check: flags a gap between Leeway and Blackboard so the student can dispute it early.
- End-of-term card: "You finished the semester with 9 lives to spare."

**Out of scope**

- Blackboard sync: IE has no public API.
- Email alerts and password reset by email: Supabase only emails team members, and a custom sender needs a paid domain.
- Logging classes you attended. Leeway stores only skips, and a class without one counts as attended.
- Sharing, friends or leaderboards. Data stays private.
- A native iOS or Android app. Alerts come through the browser's push instead.
- Cut from v1 to fit the build: a reason field, renaming or merging courses, editing term dates in the app, and typing a skip with a past date. With a calendar, Today and the weekly check cover past classes.

## Rules

Lives left = lives − sessions skipped − classes missed before joining. Planned skips count too, as hollow hearts, until they're cancelled. Everything else follows from that number and the term dates.

**Lives**

- Lives = 20% of the course's sessions, rounded down: 30 sessions = 6 lives, 25 = 5, 15 = 3.
- The session count comes from the first source that has one: the number the student typed, then the syllabus, then the calendar, then the default of 30. From a calendar, it's the number of distinct session numbers in the course's titles, so a double adds 2 and nothing counts twice. Ranges expand, so "Ses. 12-14" adds 12, 13 and 14. Asynchronous sessions are numbered in the same sequence as the course's classes, so each counts once. Events with no number (Extra sessions, Blackboard items, exams) never change the count, and gaps in the numbering aren't filled in: Computer Architecture runs to session 33 but has 30 numbers, so the calendar says 30. That way the calendar never gives more lives than its sessions support.
- A double class costs 2.
- A planned skip turns into a skip on its day by itself. This is worked out whenever the data is read, so no background job is needed. "Today" and "Tomorrow" are Madrid dates. If she goes to class after all, she cancels it, so a forgotten plan errs on the safe side.

**Pace label, checked in this order**

1. **Over the limit:** lives left below 0. "Over the limit. Talk to your professor."
2. **Out of lives:** lives left = 0. "Out of lives. The next skip takes you below 80%."
3. **Last life:** lives left = 1, the reserve life.
4. **Burning fast:** 2 lives left with more than 4 weeks to go, or the last 4 weeks' pace would use up the lives left before term ends. The pace check starts in week 4 and needs 2 skips inside those 4 weeks, so one bad week fades out.
5. **Safe:** everything else. With a calendar, "Attendance safe" replaces it once lives left cover every class remaining.

These labels are used everywhere: in the cards, the preview and the banner.

**Term dates**

- From the calendar feed when connected (the first and last class of the current courses). Otherwise from the app's settings file: fall 7 Sep to 18 Dec 2026, with spring added before January.
- Term dates only set the pace and "weeks to go". They never hide, archive or reset a skip. After the last known term ends, that term stays active and "weeks to go" reads 0.

**Data rules across features** (so the core's data still works once a calendar or syllabus is added)

- One record per save, holding how many sessions it covers: 1, or 2 for a double class. Each keeps the course, the text as typed, its date, whether it's planned, and an empty link to a calendar session. Recent skips shows one row per save, marked "×2" for a double.
- Courses have a stable ID. A typed name is matched to the student's own courses, ignoring case, accents and extra spaces.
- When a calendar is connected, existing skips link to that course's class on the same date. A skip typed later links to today's class, or else the latest unmarked class in the past 7 days. Tapping Skipped on a class that already has a skip adds nothing, so nothing counts twice.
- Calendar changes never delete a logged skip. A skip whose class vanishes stays and still counts. A planned skip whose class is cancelled is released, with a notice.
- Nothing is archived in v1. With a calendar, courses with no classes this term move into a collapsed "Past courses" group. Recent skips is never filtered.

**The bot's path, kept by every release**

- Typing a course and tapping "Log a skip" always works in one tap: no calendar, no syllabus, no setup screen and no onboarding.
- Nothing modal opens after a Today save. The only dialog in the product is the last-spare question on a planned save. Every save resets the form to Today with Double off, so one tap always logs exactly one skip for today.
- The field and the button never move. Anything shown near them (course chips, the preview, warnings) has its space kept from the first paint, and everything else goes below the form.
- Without a calendar there are no prompts at all, apart from the inline row on a new course's card. The browser's notification prompt only appears after the student taps "Turn on alerts".
- Recent skips shows every skip with its full text as typed: wrapped, never cut short, no forced capitals and no limit on how many show.
- Logout is in the header of every logged-in page. It shows straight after sign-up and disappears straight after logout, with no reload.
- A logged-in visitor on the landing page sees "Open app" in place of "Sign up free".
- With no calendar connected, the app makes no sync call. With one, the sync runs after the page shows and never clears what the student is typing.
- The finished app passes the bot-copy test before it's submitted, either on a Vercel preview or on production straight after deploy with an instant rollback (pipeline decision D3). The test covers: sign up, log out, wrong password, log in from a clean browser, save one skip (exactly one new row, 5 of 6 lives), check it from a second browser, a second user who can't see it, and a logged-out API read that returns nothing. Production is frozen while grading may be running.

**Defaults and limits**

| Setting | Default | Allowed | Notes |
| --- | --- | --- | --- |
| Sessions per course | 30 (6 lives) | 1 to 200 | Set on the course card. Hearts show as "estimated" until it's set or read from a calendar or syllabus. |
| Missed before joining | 0 | 0 up to the course's sessions | Set once on the course card. Counts against lives but isn't listed in Recent skips. |
| Reserve life | On for courses with 2 or more lives | No toggle | Asks only on planned saves |
| Skip date | Today | Today or Tomorrow | Madrid dates, reset to Today after every save. Past classes only through the calendar. A save is never rejected because of its date. |
| Course name | Required | 1 to 200 characters | Shown exactly as typed |
| Term dates | From the calendar | Settings file otherwise | Used only for pace |
| Password | None | 6 characters or more | Supabase's default, so the bot's password is never rejected for length |
| Syllabus reads | None | 10 per student per day | Syllabus import |

**Edge cases in the core**

- **First skip in a new course** creates it with 30 sessions and shows the inline row on its card. Nothing blocks the save.
- **Planning the last spare** asks "This is your last spare. Plan it anyway?" with Keep my spare and Plan it anyway. Logging a skip that already happened never asks; the preview says "This uses your last spare."
- **Joining mid-semester:** "Missed before today" on the card fixes the count. Until it's set, the card says "Counting from today".
- **Undo** deletes the skip just saved. The save itself is never delayed.
- **Deleting a course's last skip** keeps the course with full lives. "Remove course" on its card deletes it.
- **Lowering sessions below what's used** is allowed and shows Over the limit.
- **The same course name from two students** makes two separate private courses.
- **A failed save** keeps the typed text and says "Couldn't save. Check your connection and try again."
- **An expired session** sends the user to /login, then back to /app.
- **Order:** course cards by fewest lives left first. Recent skips newest first.
- **The bot's test:** typing "QA-7F3K2A grading bot test" and tapping once creates that course with 5 of 6 lives left. The skip appears at the top of Recent skips with the exact typed text, and no dialog, suggestion or chip gets in the way.

## Calendar sync

Leeway reads a live calendar link (an .ics feed) and refreshes it when the student opens the app. IE students already have one in Blackboard, so no Google or Apple sign-in is needed.

**How a student connects, phone-friendly paths first**

- **Blackboard (IE students, recommended):** copy IE's calendar link from Blackboard and paste it. It's the freshest source and holds every session, asynchronous ones included. Onboarding shows the exact taps, captured with screenshots during design.
- **iPhone:** Settings, Calendar, Accounts, Subscribed Calendars, when the classes arrive as a subscription.
- **Google (needs a computer, 1 minute):** Settings, the calendar with the classes, "Integrate calendar", then "Secret address in iCal format". The phone app doesn't show it.
- **Outlook:** "Publish calendar" gives a link, if IE allows it.
- Links that start with webcal:// work too.
- **No link (manual mode):** everything in the core, plus tests added by date on a course card. A weekly timetable builder comes in v2.

**What IE's feed contains** (Irakli's real feed on 20 Oct 2026: 209 events, Apr 2026 to Mar 2027; notes in ie-feed-analysis.md)

- **Every session is its own event**, titled "COURSE (Ses. N) ROOM", in Madrid time. There are no repeat rules and no cancelled markers, so a cancelled class simply disappears. Event IDs are stable database IDs, so a sync matches events by ID and compares only the title, start, end and room. The timestamp on each event and the "Last update" note change on every fetch, so they're ignored. A course is keyed by the course part of its event IDs, not by its name, and exams share that part, so each exam links to its course.
- **Session numbers are in the titles.** Syllabus session 14 matches the event titled "(Ses. 14)" directly.
- **Double sessions** look like "(Ses. 4-5)" and last 2h50. They count as 2 sessions, so skipping one costs 2 lives. One 4h20 event covers three (Ses. 12-14).
- **The feed mixes five kinds of events,** and Leeway sorts them by title, room and event ID, because the feed has no categories or descriptions. Class sessions count toward lives. Blackboard items (5-minute events with no room, like quizzes) show as deadlines. "EXAM: course" events become exam days. "Extra" sessions have no session number. They show in Today, and a skip logged on one still costs a life, but they don't change the session count. All-day "Asynchronous" sessions count like any class, because IE counts them toward the 80%.
- **Each exam overlaps a regular session** that starts 30 minutes later. That session is treated as the exam slot, not a class you can skip. It still counts toward the session total, as in the syllabus (Algorithms has 30 sessions, with the final in session 30). Exams carry no session number of their own.
- **No time zone block:** times say Europe/Madrid, but the feed doesn't define it, so the parser supplies it. All-day asynchronous events put a time zone on a bare date and give a one-day length instead of an end. Strict parsers reject that, so the parser must read them as Madrid dates.
- **Course names are in capitals,** and one title contains a stray ", null". Mapping shows a clean name for the student to confirm.
- **Only some finals are in the feed.** Continuous evaluations and presentations aren't, so the syllabus or a manual mark is still needed.
- **Two fetches so far.** Spike S1 fetched it again 70 minutes later. 208 of 209 events matched by ID with nothing changed, and the one difference was the "Last update" note. Still to check: whether a moved session keeps its ID, and the 25 Oct clock change.
- **Test file:** a sanitized copy of the feed's 196 course events (fake IDs of the same shape, renamed courses and rooms, no link or key) is the parser's test file.

**How it stays live**

- **On open:** if the last sync is older than 15 minutes, the server fetches the feed after the page shows. Saved data appears straight away, so /app is never slower. IE's feed has no ETag and its Last-Modified is the request time, so every sync downloads the whole feed (about 64 KB) and compares it.
- **Refresh button,** plus "Last synced 10:42" on screen.
- **The student's own login** does the sync, so row-level security still applies. The one exception is the nightly alert job, which refreshes calendars on the server before it sends alerts.
- **Glitch guard:** a reply that isn't a calendar, or a sync that would remove more than 30% of future classes, counts as a failed sync. Leeway keeps the old data and says "Your calendar looks incomplete. Try again."
- **Safe fetching:** https only, public hosts only, every redirect re-checked, a 5-second timeout and a size cap. The technical plan spells out how.

## Syllabus import

A syllabus gives Leeway what the feed lacks: which sessions hold tests, what they weigh, and each session's topic. The calendar says when; the syllabus says what a session is worth.

**How it works**

- Paste the text or pick the PDF. A PDF is turned into text in the browser, so only text is sent and no file is stored. The PDF reader loads only on the import screen, so /app stays light.
- One AI read on the server returns a fixed format. If the answer doesn't fit it, Leeway retries once, then falls back to marking tests by hand. If Gemini is busy, it waits 30 seconds and tries once more, then tries the backup model. One read took 95 seconds in spike S2, so the import screen says "Reading your syllabus. This can take up to two minutes." and the server's time limit for the read has to allow it.
- Nothing is saved until the student confirms each line on the review screen, which shows the date each session lands on.
- With IE's feed, syllabus session N matches "(Ses. N)" directly. Without a calendar, tests keep their session number and get a date once one is connected or typed.
- Model: gemini-3.8-flash on its free tier, with gemini-flash-latest as the backup. Both names live in server settings so they can be swapped without a code change, because Google retires models for new keys (gemini-2.5-flash already refuses them). One read used about 7,900 tokens. The key lives only in Vercel's server settings. Limits: 10 reads per student per day, and Google's own free-tier quota caps the total. Without a key the import is hidden, and the rest of the app works.

  **Spike S2 (20 Oct):** one read of the Algorithms syllabus on gemini-3.8-flash matched every row of the table below on the first try, passed validation and invented nothing. It found the 3-vs-4 tests conflict, kept the 30% for the four tests as one shared weight, and quoted the 80% penalty word for word. The one gap was retakers: it quoted IE's general rule without saying that this syllabus never states its own, so the fixed format gets a separate yes/no for "this syllabus states a retake rule".

**Test read: Algorithms and Data Structures** (a real IE syllabus, 2026-27, semester 1)

| Found | Value | Confidence |
| --- | --- | --- |
| Course | Algorithms and Data Structures, Bachelor in Computer Science and AI | Stated |
| Year | Second year | Stated |
| Sessions | 30, so 6 lives | Stated |
| Penalty below 80% | Fail both calls, re-enrol next year and pay the extra cost | Stated |
| Continuous Evaluation (30%) | Sessions 11, 16, 21 and 25, about 7.5% each | Equal split assumed. Conflict: the method text says 3 tests, the session list shows 4. Leeway asks. |
| Group presentations (part of Group Work, 30%) | Sessions 28 and 29, half the groups each | Leeway asks which one is yours |
| Final exam (30%) | Session 30 | Stated |
| Class participation (10%) | Every session | Stated |
| Key non-graded sessions | Session 6 (groups are formed), session 24 (lab before the test in session 25) | Inferred |
| Format | Every session live, in person | Stated |
| Retake students | Attendance rule for retakers not stated | Leeway asks retakers |

**What this changes in the product**

- **8 of 30 sessions cost more than a life:** 4 tests, 2 presentation days, the final and group formation. The preview names it: "Session 16 is Continuous Evaluation II (7.5%). Skipping costs a life and the test."
- **Every skip also costs participation (10%),** said in one quiet line in the preview.
- **What you'll miss:** skipping session 9 shows "Quicksort. Probably on the test in session 11. Catch up: Grokking Algorithms, chapter 3", with the syllabus line it came from. Syllabi rarely say what a test covers, so that link is marked "probably".
- **Stakes copy, now sourced:** below 80% you fail both calls, re-enrol the course next year and pay for it again. That's the syllabus's own wording.
- **Paste or upload:** this syllabus came as text copied from IE's syllabus page, so the import takes pasted text as well as a PDF.

## Edge cases for calendar, syllabus and security

The core's own edge cases sit under Rules. Everything below ships in v1 except the three rows marked v2, and every case is optional for the grading bot, which never connects a calendar or imports a syllabus.

| Area | Case | What Leeway does |
| --- | --- | --- |
| Schedule | Class moved to another day or time | Matched by event ID, so the session moves and any skip linked to it moves too |
| Schedule | Class cancelled | The class disappears and the session count drops. If lives change (29 sessions = 5), Leeway says "Micro lost a session. Lives now 5." A planned skip for it is released. |
| Schedule | Make-up or extra class added | Counted as a new session. Lives can go up. |
| Schedule | Double session | IE's titles carry the range ("Ses. 4-5"), so it counts as 2. For other feeds the syllabus count wins, and Leeway asks once if the two disagree. |
| Schedule | Clocks change (25 Oct 2026, 28 Mar 2027) | Times are kept in the class's own time zone, so a 9:00 class stays at 9:00. Both dates are test cases. |
| Schedule | Repeating events with exceptions (Google, iPhone, Outlook) | The parser expands repeat rules, removed dates and moved single instances, and reads Outlook's Windows time-zone names. A session is identified by its event ID plus its original start. |
| Schedule | Same class in two calendars | De-duplicated by course and start time |
| Schedule | A class before a marked test is cancelled or added | Asks once: "Is the Micro midterm still Tue 3 Nov?" |
| Schedule | Exam overlaps a class 30 minutes later | That class is the exam slot and is never offered as a skip |
| Counting | All-day asynchronous sessions | Counted like any class, because IE counts them toward the 80%. Today lists them on their day, so a skipped one can be marked. |
| Counting | Logging a skip for a course with no class today | Saved anyway, with an inline note: "No Micro class today in your calendar." No question. |
| Counting | Arriving late or leaving early | In v2: logged as "Late", counted only if IE counts lateness |
| Counting | Justified absence (hospital, bereavement, court, job interview) | In v2: marked "papers pending", with IE's 7-day deadline. It stops counting once the student marks it accepted. |
| Counting | Blackboard shows a different number | In v2: a Blackboard check flags the gap so the student can dispute it early |
| Sync | Link stops working (secret address reset, feed removed) | Banner: "Your calendar hasn't synced since Tue. Reconnect." Old data stays, marked out of date. |
| Sync | The reply is a login page, empty or partial | Treated as a failed sync, and the old data stays (glitch guard) |
| Sync | Two open tabs sync at once | One row per class per student, so nothing duplicates |
| Sync | Student abroad (trip check from Tbilisi) | Class times shown in Madrid time with the city label, because that's when the class happens |
| Mapping | Calendar title differs from the course name ("MICROECONOMICS BBA1 S2 SEC3" vs "Micro") | Mapped once by the course name in the title, and the student confirms it. If IE renames a course, Leeway asks again. |
| Term | Term ends, new term starts | Nothing is archived. New courses arrive from the feed, old ones move to "Past courses", and Recent skips keeps everything. |
| Syllabus | Scanned PDF with no text | "Couldn't read this file." Falls back to marking tests by hand. No OCR in v1. |
| Syllabus | Syllabus in Spanish | Read in both languages. The review screen is always in English. |
| Syllabus | AI misreads a date or weight, or the PDF holds text aimed at the AI | The model can only return the fixed format, and nothing is saved until the student confirms each line |
| Syllabus | The syllabus contradicts itself (3 vs 4 tests) | Shows both readings on the review screen and asks |
| Syllabus | One weight covers several sessions (30% over 4 tests) | Splits it evenly, labelled "assumed" and editable |
| Syllabus | The session depends on your group (presentations on 28 or 29) | Asks once which session your group presents in |
| Syllabus | "The assessment method may change" | Re-importing a newer syllabus shows only what changed |
| Syllabus | Copy-paste noise, typos and duplicates | Logos, bios, office hours and bibliography are ignored. Typos are kept as written, never silently "fixed". |
| Syllabus | The AI provider is down or the free quota is used up | "Syllabus reading is busy. Try later, or mark tests by hand." |
| Privacy | The feed includes personal events (doctor, birthdays) | Only events mapped to a course are stored. Everything else is dropped during sync and never saved. |
| Security | A pasted link pointing at an internal address (server-side request forgery) | https and public hosts only, private addresses blocked, every redirect re-checked, time and size capped |
| Security | Someone uploads hundreds of syllabi to burn the free AI quota | 10 reads per student per day, plus the provider's own quota |
| Alerts | The browser blocks notifications, or an iPhone hasn't added Leeway to the Home Screen | Settings says what's missing and how to fix it. Everything else works without alerts. |
| Alerts | The calendar can't be refreshed on the night | The alert uses the last synced classes and says when they're from: "as of Tue". |
| Alerts | A planned skip is cancelled after 21:00 | Nothing more is sent. The next night's alert reflects the change. |

## Privacy and security

Supabase's secret key never reaches the browser. Only the nightly alert job on the server uses it; everything a student does runs under their own login.

- **Row-level security on every table** (courses, skips, calendars, sessions, tests and AI usage): a student reads and changes only rows with their own user ID, and logged-out visitors read nothing. AI usage rows are read-only for students: a database function (reserve\_ai\_call) counts each syllabus read and enforces the 10-a-day limit, so deleting rows can't reset it.
- **Only Supabase's URL, its publishable key and the push service's public key reach the browser.** The AI key sits in Vercel's server settings only.
- **Delete my account and data** (Settings) calls a database function that deletes only the caller's own account.
- **The calendar link is a secret,** since anyone holding it can read the calendar. It's stored in the student's own row and never shown again after saving ("IE calendar · connected"). Disconnect deletes it and the synced classes; skips stay. IE's reply also repeats the key in its download file name, so the server never logs the link or the feed's response headers.
- **Minimal data:** an email and a password. No names, no phone numbers and no personal calendar events.
- **The public GitHub repo holds no keys** in any commit.

## Landing page, copy and Socratista summary

The landing page has to answer what it is, who it's for and what to click within 5 seconds, using one headline, one line under it and one button. The calendar, syllabus and alert features add no sections or buttons to it.

**Landing page**

- Eyebrow: none, because the subheadline names the user
- Headline: **Never fail a class on attendance.**
- Subheadline: For IE University students. Before you skip a class, see what it costs against the 80% rule.
- Button: **Sign up free**, inside the first screen on a phone. It's the only button; "Log in" is a small link in the header. A logged-in visitor sees "Open app" instead.
- Proof row, three short points: "Log each skip in one tap" · "Lives left in every course" · "A warning the night before a risky day"
- Visual: one phone-sized card showing a course with hearts and "Burning fast". The hearts live here, so the fun shows without the headline overpromising.

**Look:** the "Quiet" direction is locked. Mockups: [Leeway visual direction](https://claude.ai/artifact/9t68FRVN5eTFp3zPRUEiUA).

**Inside the app**

| Moment | Copy |
| --- | --- |
| Course field label | Which class are you skipping? |
| Placeholder | e.g. Microeconomics |
| Day chips | Today · Tomorrow |
| Double toggle | Double class |
| Save button | Log a skip |
| Near match | Did you mean Microeconomics? |
| Preview, new course | New course. You'll have 5 of 6 lives left. |
| Preview, existing course | This uses 1 life. 2 left, 8 weeks to go: about one skip a month. |
| Preview, last spare | This uses your last spare. After it, the next skip takes you below 80%. |
| Planning the last spare | This is your last spare. Plan it anyway? · Keep my spare · Plan it anyway |
| After saving | Skip logged. Undo |
| After planning | Planned for tomorrow. Undo |
| New course row | Sessions in this course: 30 · Missed before today: 0 |
| Risk banner | Stats is on its last life. Guard it. |
| Out of lives | Out of lives. The next skip takes you below 80%. |
| Over the limit | Over the limit. Talk to your professor. |
| Empty state | No skips yet. Type a class to see what skipping it would cost. |
| Weekly check | Skipped anything else this week? · All good |
| No class today | No Micro class today in your calendar. |
| Wrong password | That email and password don't match. |
| Save failed | Couldn't save. Check your connection and try again. |
| Alerts setting | Turn on alerts. One message the night before a risky day, never more. |
| Alert, last life | Tomorrow 9:00 Stats. Last life, don't skip. |
| Alert, planned skip | You planned to skip Micro tomorrow. That leaves 1 life. |

**Socratista summary (draft)**

> Leeway is an attendance tracker for IE University bachelor's students, who get a 0.0 in a course if they attend less than 80% of its sessions ([IE attendance policy](https://docs.ie.edu/documents/Attendance_Policy_Bachelor_Programs.pdf)). Students log each class they skip in one tap, and Leeway shows how many absences ("lives") they have left in every course, and what the next skip costs before they take it. Live at https://\<name>.vercel.app: click "Sign up free".

## How each grading criterion is met

The two bot-checked criteria (60%) are met by following the contract exactly. The two judged criteria (40%) rest on the user, the penalty and the headline.

| Criterion | Weight | How Leeway meets it | How we check before submitting |
| --- | --- | --- | --- |
| Real frequent problem and value | 20% | A specific user (IE bachelor's students), a weekly event (a skip) and a written penalty (0.0 in both calls below 80%), linked to IE's policy. The one-liner names who and what they get. | A fresh reviewer scores the landing page and one-liner as the professor would. |
| Understandable in 5 seconds | 20% | Headline, subheadline, one button and a product card, readable on a phone. | A fresh agent that has never seen the project describes the landing page, and its answer is compared with the Socratista summary. Screenshots at phone and laptop width. |
| Real sign-up | 30% | Supabase email and password, no email confirmation, then straight to /app. Wrong passwords are rejected with a message. | The bot-copy test on the finished app: sign up, log out, wrong password, log in from a clean browser. |
| Does something real | 30% | Skips are saved in Supabase with row-level security, so each student sees only their own rows and logged-out visitors see nothing. | The same test saves a skip, finds it from a second browser, signs up a second user who can't see it, and gets nothing from the API without login. |

**Contract hooks:** `core-input` is the course name field, `core-submit` is "Log a skip", and `core-item` is every skip in Recent skips, showing its text as typed. `logout` sits in the header on every logged-in page.

**Deploy checks:** "Confirm email" is off in Supabase. The sign-up form is exactly email and password, with no confirm field or terms box. The GitHub repo is public with no keys in its history. Supabase's Site URL is the Vercel link, and that link is also under Redirect URLs. The landing page is compared with the summary before submitting.

**Fair play:** no hidden text for AI graders, and bot accounts are treated like any other user.

## Risks and open decisions

All nine decisions are signed off by Irakli (20 Oct). Comment on any row to reopen it.

| # | Decision | Recommendation | Your call |
| --- | --- | --- | --- |
| 1 | Alerts | Night-before push alert in v1 (Irakli, 20 Oct), plus the in-app risk banner. Email stays out because it needs a paid domain. The Leeway calendar feed comes in v2. | Approve |
| 2 | How lives are set | From sessions: 20% rounded down. Default 30 sessions (6 lives), editable on the course card. The calendar and syllabus fill it in later, and a number the student typed always wins. | Approve |
| 3 | Term dates | From the calendar feed, with fall 2026 in a settings file as the fallback. Term dates never archive or hide a skip in v1. | Approve |
| 4 | Who it's for | Name IE University bachelor's students on the landing page. A narrow user scores better than "students". | Approve |
| 5 | Name and language | Name the app "Leeway" (Irakli, 20 Oct), with all text in English. | Approve |
| 6 | Planned skips | Yes, one day ahead: a Tomorrow chip, with Today preselected. Trip plans come with the calendar. | Approve |
| 7 | Reserve life | Ask before planning the last spare. Never ask when logging a skip that already happened. | Approve |
| 8 | Headline | "Never fail a class on attendance." (Irakli, 20 Oct) | Approve |
| 9 | Spikes before the technical plan | Two quick throwaway tests on your Mac, outside the app: re-fetch your feed and run a calendar parser on it, then one Gemini read of the Algorithms syllabus. The second needs a free Gemini key from Google AI Studio. Both ran on 20 Oct. S1's results are in Calendar sync and S2's are in Syllabus import. | Approve |

**Answered by Irakli (20 Oct)**

- The IE calendar link comes from Blackboard, so onboarding points students there.
- Asynchronous sessions count toward the 80%, so they cost lives like any class.
- Deadline: everything well built within about 4 hours, with no quality cuts for time.

**Still to verify (we check these)**

- Open IE's 2026-27 attendance policy and confirm one rule for every year. ie.edu is blocked from the cloud, so this happens on the Mac.
- Whether the 20% counts scheduled or held sessions, whether lateness counts, and what missing an exam means.
- Whether a moved session keeps its event ID, and the 25 Oct clock change. IDs stayed stable across two fetches (spike S1).

**Risks that stay**

- **Manual logging:** a skip that isn't logged makes the hearts wrong. Tomorrow plans, Today and the weekly check narrow the gap but don't close it.
- **How a professor reads "lives":** it could look like a skipping tool. The copy frames it as protection, no tool recommends a skip, and nothing celebrates one.
- **IE rule details** come from search results, not the opened policy.
- **Blackboard lag:** "professors enter attendance late" is an inference, not something we measured.
- **No user evidence:** interviews are skipped by choice. The Socratista summary links IE's policy, because criterion 1 is graded partly on evidence.
- **Scope:** one release holding everything is roughly three times the core's build. The core is built and bot-tested first inside it, so the graded 60% is ready before the rest lands.
- **Free AI quotas change often.** The import hides itself without a key or quota, and nothing else depends on it.
