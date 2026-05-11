# TikTok weekly digest scenario — design

## Purpose

Send Paul one email every Sunday morning (~9am Mountain) with the next 7 days of TT-bound content so he can batch-schedule them in TikTok Studio (https://studio.tiktok.com).

## Why this exists

- Make's official TikTok app is ads-only (no native content posting)
- Community modules are unproven; paid schedulers cost monthly
- TT Studio's native scheduler supports up to 10 days of queued posts, free
- 15 min/week of manual TT scheduling > $15/mo Blotato subscription, for now

## Architecture

```
1. Sheets:filterRows  →  2. Iterator  →  3. Drive:searchForFilesFolders  →  4. Aggregator  →  5. Email
```

### Step 1 — Filter sheet for next 7 days
- Spreadsheet: `1FcBz6Fqk1QHHj0-r-lly6DXUKHtLX5d83vcQHbi9pFY`
- Tab: `Sheet1`
- Filter:
  - `C >= today` AND `C <= today + 6 days`
  - `Z (tt_url)` is empty OR equals "manual" (not yet TT-posted)
- Order by post_date ascending

### Step 2 — Iterator
- Iterates each row → child flow runs once per row

### Step 3 — Drive search
- Look up filename → fileId for each row's media file
- Same pattern as scenario 4869011

### Step 4 — Aggregator (Text aggregator)
- Per row, build a HTML chunk:
  ```
  <h3>{{post_date}} ({{day}}) · {{format}} · {{slug}}</h3>
  <p><strong>Caption (TikTok):</strong></p>
  <pre>{{caption_tt}}</pre>
  <p><a href="https://drive.google.com/file/d/{{fileId}}/view">Open media in Drive</a></p>
  <hr>
  ```
- Aggregate → single combined string

### Step 5 — Email send
- To: pauljohnson912@gmail.com
- Subject: `Able TT digest · week of {{this Monday}} · {{count}} posts to schedule`
- HTML body: aggregated rows + opening line: "Open https://studio.tiktok.com — paste each caption + upload media. Up to 10 days can be scheduled at once."
- Connection: 7727156 (Gmail)

## Schedule

- Sunday, 9:00am Mountain (16:00 NY) — runs once a week
- `scheduling.type = "indefinitely"`, restrict to day=0 time=16:00

## Failure handling

- Gmail error handler on the email send module → fallback notify to pauljohnson912@gmail.com
