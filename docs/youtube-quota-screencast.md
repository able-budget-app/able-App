# YouTube Quota Increase — Screencast + Reply

Recording plan for the YouTube API Services compliance review (received 2026-05-14).

## What they asked for

1. Screen-cast (in English) showing how the YouTube API is used to upload videos automatically **and** how the videos are displayed within the API client location.
2. Demo credentials (username + password) for the API client location.

## Before you record

- Quota resets midnight Pacific. Make sure you have at least 1 upload slot left for today (or wait until tomorrow morning Pacific time).
- Open QuickTime Player → File → New Screen Recording → record with internal mic for voice-over.
- Make sure the Able repo terminal is open at `/Users/pauljohnson/Desktop/Able`.
- Make sure you are signed into YouTube Studio for the Able channel in a browser tab.
- Make sure becomeable.app is open in another tab to a published article with an embedded video (e.g. `/business/emergency-fund/`).

## Shot list (3 to 5 min total)

### Part 1 — Upload via API (90 sec)

1. Show the terminal in the repo directory. Briefly narrate: "This is Able's content pipeline. We programmatically upload one short educational video per blog article to our YouTube channel via the YouTube Data API."
2. Run a real upload:
   ```
   python3 scripts/youtube-upload.py --batch=1
   ```
3. While the script runs, narrate what's happening: "The script reads the next ready row from our Google Sheet, calls youtube.videos.insert with the MP4 plus title, description, and tags. Privacy status is unlisted by default so we can review before going public."
4. Watch the upload progress percentage tick up to 100%.
5. Wait for the final success line showing the returned `video_id`.

### Part 2 — Display in the API client location (90 sec)

1. Switch to the browser, YouTube Studio tab. Refresh. Show the just-uploaded video appearing in the Content list as Unlisted.
2. Click into the video, show its title, description, and unlisted status. Narrate: "Each upload is set to Unlisted on creation. We review in Studio, then manually flip to Public via the bulk-action menu when we're ready to launch that week's article."
3. Switch to the becomeable.app tab. Navigate to an article that already has an embedded video (e.g. `/business/emergency-fund/`).
4. Scroll to the embedded YouTube player. Click play briefly. Narrate: "On the consumer side, each article on becomeable.app embeds its companion YouTube video via the standard iframe embed. Visitors watch the video alongside the article. This is the only consumer-facing surface for our YouTube content."

### Part 3 — Use case statement (30 sec voice-over)

End on the terminal or a static brand frame, narrating:

"Able is a budgeting app for self-employed people with variable income. We're the sole producer of all video content uploaded via this API client — there is no user-generated upload functionality. Volume is one video per Monday for a 52-week launch sequence. We're requesting a quota increase from the default 10,000 units per day so we can complete this launch without artificial blocks."

## Demo credentials

Two options. Send both for thoroughness.

### Option 1 — Channel Manager access

1. Create a new Google account just for this review:
   - Suggested email: `youtube-review-able@gmail.com` (or any clean address)
2. Grant Channel Manager access on the Able YouTube channel:
   - YouTube Studio → Settings → Permissions → Invite
   - Enter the new email, role: Manager (or Editor at minimum)
   - The account can now access the channel without needing your personal login.
3. Send YouTube the username + password.

### Option 2 — Public verification links

Add these to the email so they can verify the embed-display surface without credentials:

- YouTube channel: `https://www.youtube.com/@<your-handle>`
- Two example articles with embedded videos:
  - `https://becomeable.app/business/emergency-fund/`
  - `https://becomeable.app/budgeting/feast-or-famine/`

## Draft reply email

```
Hi,

Thanks for the follow-up. Please find the requested materials below.

Use case: Able is a budgeting application for self-employed people
with variable income (becomeable.app). We produce one short
educational video per blog article and use the YouTube Data API to
upload these videos programmatically to our own YouTube channel.
We are the sole content producer — there is no user-generated upload
functionality. Each uploaded video is embedded back into the
corresponding article on becomeable.app for visitors to watch
alongside the article text.

1) Screencast: [link to your unlisted YouTube upload or Google Drive
   share of the recording]

2) Demo credentials (Channel Manager access to our YouTube channel):
     username: youtube-review-able@gmail.com
     password: <password>
   This account has been granted Channel Manager permission via
   YouTube Studio → Settings → Permissions, so you can verify the
   channel, uploaded videos, and OAuth-authorized client setup.

3) Public verification (no credentials needed):
     YouTube channel: https://www.youtube.com/@<your-handle>
     Example articles with embedded videos:
       https://becomeable.app/business/emergency-fund/
       https://becomeable.app/budgeting/feast-or-famine/

Quota request: lift our YouTube Data API daily quota from the default
10,000 units. At 1,700 units per upload, the default cap restricts
us to 5 uploads per day. We have a planned 52-video weekly launch
series for the new content cluster, and are also catching up on a
backlog of ~80 videos that need to publish before the series starts.
A higher cap (or per-application unit-cost reduction) would let us
complete the launch on schedule.

Happy to provide any additional context.

Thanks,
Paul Johnson
Able
```

## After the screencast lands

Once the quota increase is approved (timeline: days to weeks):

1. Paste the rows from `docs/yt-longform-new-52.csv` into the `yt-longform` tab of the mega-workbook.
2. Run `python3 scripts/youtube-upload.py --batch=N` where N matches the new daily cap.
3. The script writes returned `video_id`s back to the sheet.
4. Run `python3 scripts/inject-youtube-ids.py` to patch `youtube_id:` into each article's markdown frontmatter.
5. When launch date is set, backfill `publish_date:` for the 52 articles. The drip publishing begins.
