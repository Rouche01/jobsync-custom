---
type: how-to
title: Automations
description: Setting up a scheduled ATS search — criteria first, suggested companies to confirm, then resume matching — and handling the jobs it discovers.
feature: automations
tags: [automations, job search, scheduled search, greenhouse, lever, ashby, ats, company boards, watchlist, suggested companies, discovered jobs, match score, keywords, target titles, locations, resume skills, filters, notifications]
aliases: [automated job search, job discovery, scheduled job search, job scraper, run a search, discovered jobs]
status: stable
stale_after: 2027-09-30
---

# Automations

## What does an automation do?

An automation is a saved search that runs once a day. You start with **what you want** (titles, keywords, locations and a resume). JobSync helps you **confirm a shortlist of companies**, then reads those public boards, filters listings, scores the best ones against your resume, and saves **discovered jobs** you can accept or dismiss.

It only reads **Greenhouse**, **Lever** and **Ashby** boards — not the whole internet. One automation covers one board; create another for a different provider. At least one company is required. You also need **Settings → AI Provider** and a resume to match against.

## How do I create an automation?

Open **Automations** and click **Create Automation**. To reuse an existing one (for example on another board), use **Duplicate** from the list **⋮** menu or the detail header — the wizard opens prefilled so you can change the board, companies, schedule, and other fields before creating a new automation. The wizard has six steps:

1. **Basics** — name and job board (Greenhouse, Lever or Ashby).
2. **Search** — criteria first (titles, keywords, locations, run options), then confirm suggested or manually picked companies (up to 25).
3. **Resume** — the resume used for scoring. Resumes with fewer than two sections are greyed out until you fill them in under **Profile**.
4. **Matching** — match threshold; below-threshold AI scores are discarded.
5. **Schedule** — daily hour (server time). Hours already taken are marked **In use**.
6. **Review** — confirm and save.

At least one company is required. Empty titles and keywords leave nothing to rank against, so defaults alone rarely help.

## Which companies can I track, and how many?

Up to **25** per automation. After you enter titles or keywords (or if you have a watchlist), **Suggested companies** appears — add one or **Add all suggested**. Suggestions rank name/token matches plus watched boards; they are a shortlist to confirm, not a full-directory scrape.

Locations do **not** pick companies (the ATS directory has no geo). They only filter **job listings** when **Only show jobs in these locations** is on.

You can still search the directory, use **Add all watched**, or paste a board URL/token under the picker. Watch boards ahead of time under **Library → Companies** → *Browse boards*; watched boards also rise in suggestions. Unwatching removes them from the watchlist only — the company stays in your Library.

## How do I set up filters so the automation returns good results?

**Fill in filters first** — they drive both ranking and company suggestions. A board can list hundreds of roles; filters turn that into a short list.

- **Target job titles** — roles you want (e.g. `Frontend Engineer`). Title matches rank higher and can suggest companies with overlapping names/tokens.
- **Keywords / skills** — e.g. `React`, `Kubernetes`. Matched against title and description; also feed suggestions.
- **Locations** — e.g. `Calgary`, `Canada`. Used only with **Only show jobs in these locations**. Avoid bare `Remote` — it matches remote roles anywhere.

Prefer several specific terms over one generic word. Leaving both titles and keywords empty fails the relevance floor and saves nothing; the wizard warns when both are empty.

## Why does my matching resume need a skills section?

Resume **Skills** are added to your keywords for ranking and sent to the AI for scoring. Discovered jobs can also be tagged with resume skills that appear in the posting (at most ten; no invented tags).

Write skills the way ads do. Bracket notes are ignored (`Angular (v10–14)` still matches "Angular"). Combined labels like **C# / .NET** match nothing — list them separately.

Add skills under **Profile** → your matching resume → **Add Skills** (up to 8 categories, 20 skills each). A resume without skills still works, but only your typed keywords apply.

## How many listings does each run analyze?

**Jobs analyzed per run** (default 10, max 50) is how many top-ranked listings get a full AI score. **Save additional relevant listings** (on by default) keeps lower-ranked relevant jobs unscored, with an **Analyze** button. Only listings clearing the relevance floor are analyzed; only those meeting your threshold are saved. The run log shows skips and below-threshold counts.

## When does it run, and can I run one now?

It runs daily at your chosen hour (server timezone) while **active**. **Run Now** is limited to **5 per hour**; **Abort Run** stops an in-progress run. The page tabs are **Logs**, **Discovered Jobs**, and **Run History**.

## What do I do with a discovered job?

New discoveries get a due date three days out. On **Discovered Jobs**:

- **Accept** — copy into tracked jobs.
- **Dismiss** — hide without deleting.
- **Analyze** — score an unscored listing on demand.

Open a job for match/relevance detail. Filter by status; **Clear** removes discoveries in bulk.

## How do I pause, edit or delete an automation?

Use the list **⋮** menu or the detail header. **Pause** / **Resume** toggles the schedule. **Edit** reopens the wizard. **Delete** removes the automation, runs and discoveries after confirm — accept keepers first. **Resume missing** means the linked resume was deleted; pick a new one before it can run.

## How do I know when a run finishes or a job board fails?

The header bell shows unread notifications (red on failure). Finished runs post a summary; cancelled runs do not. Unreachable boards get a repeating row until fixed — **Edit watchlist** opens the editor. If every board fails, the run fails. Bell **×** / **Clear all** only hide; the Notifications page deletes for good after confirm. Kept for 30 days.
