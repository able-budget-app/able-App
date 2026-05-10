# YouTube API + Sheets Setup

One-time setup so `scripts/youtube-upload.py` can post videos to YouTube and write IDs back to the tracker sheet. ~15 minutes.

## 1. Google Cloud project (3 min)

1. Open https://console.cloud.google.com/
2. Top bar → project dropdown → **New Project**
3. Name: `Able Content Engine` (or anything; only you see it)
4. Create. Wait for the spinner to settle, then make sure that project is selected in the top bar.

## 2. Enable APIs (2 min)

In the project, go to **APIs & Services → Library** and enable:
- **YouTube Data API v3**
- **Google Sheets API**

(Search each by name, click, hit "Enable.")

## 3. OAuth consent screen (3 min)

1. **APIs & Services → OAuth consent screen**
2. User type: **External** → Create
3. Fill in:
   - App name: `Able Content Engine`
   - User support email: your email
   - Developer contact: same
4. Save and continue → Scopes → Save and continue → Test users → **+ Add user** → your YouTube/Google email → Save and continue → Back to dashboard
5. Status will be "Testing" — that's fine. Don't publish; you only need to upload to your own channel.

## 4. OAuth credentials (3 min)

1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. Application type: **Desktop app**
3. Name: `Able uploader local` → Create
4. Pop-up shows your client ID — click **Download JSON**
5. Save as: `~/Desktop/Able/secrets/google-oauth-credentials.json`

## 5. Get the Sheet ID (1 min)

1. Open your Google Sheet (the one you imported the CSV into)
2. URL looks like: `https://docs.google.com/spreadsheets/d/1AbCdE...XyZ/edit#gid=0`
3. Copy the long string between `/d/` and `/edit` — that's the Sheet ID
4. In your terminal, set it:
   ```bash
   export SHEET_ID=1AbCdE...XyZ
   ```
   (Add to your shell profile `~/.zshrc` so it persists across sessions.)

## 6. Confirm sheet columns

The script reads/writes these column headers — make sure they exist in row 1 of the sheet (the auto-generated tracker has them all):

- `slug`
- `status` (the script picks rows where this = "ready-to-upload")
- `yt_title`, `yt_description`, `yt_tags`
- `youtube_video_id` (script writes here on success)
- `youtube_url` (optional — script writes if present)
- `yt_published_date` (optional — script writes if present)

## 7. First run (5 min — does the OAuth dance)

```bash
cd ~/Desktop/Able
python3 scripts/youtube-upload.py --dry-run
```

The first run:
1. Opens a browser tab
2. Asks you to log in with the YouTube/Google account that owns the channel
3. Shows a "This app isn't verified" warning — click **Advanced → Go to Able Content Engine (unsafe)** (it's safe, you're just unverified for now)
4. Click **Allow** when it asks for YouTube + Sheets access
5. Browser shows "The authentication flow has completed"

Token gets saved at `secrets/google-oauth-token.json`. Future runs are headless — no browser popup.

`--dry-run` shows what would be uploaded without actually uploading. Verify the queue looks right.

## 8. Mark some rows ready

In the sheet, change `status` from `draft` to `ready-to-upload` for the rows you want to upload (start with 5 since the daily quota is 10,000 units = ~5 uploads/day).

## 9. Real run

```bash
python3 scripts/youtube-upload.py            # picks up to 5 ready rows
python3 scripts/youtube-upload.py --batch=3  # smaller batch
python3 scripts/youtube-upload.py --slug=taxes  # specific slug
```

Each upload:
- Posts the mp4 as Unlisted
- Sets the custom thumbnail
- Writes `youtube_video_id` and `status='uploaded'` back to the sheet
- Sleeps 90s before the next one (avoids spam-flagging)

## 10. After uploads finish

In YouTube Studio:
1. Filter: Visibility = Unlisted
2. Watch each one (or trust the pipeline if you've spot-checked)
3. Bulk select → Visibility → **Public**

Then update the article frontmatter for each — paste `youtube_id: "<id>"` into `able-content/<cluster>/<slug>.md` (or `index.md`), run `python3 scripts/build-resources.py able-content`, and commit.

## Troubleshooting

**"Missing secrets/google-oauth-credentials.json"** — you skipped step 4 or saved it elsewhere. Re-download the JSON from Cloud Console → Credentials.

**"quotaExceeded"** — you've hit the 10,000-unit daily quota. Resets at midnight Pacific. Or apply for a quota increase (next section).

**"Access blocked: This app isn't verified"** — click **Advanced → Go to ... (unsafe)**. You don't need to verify for personal use.

**Token expired** — delete `secrets/google-oauth-token.json` and re-run; it'll do the OAuth flow again.

## Quota increase (optional, lifts the 5/day cap)

Default quota: 10,000 units/day. Each upload costs 1,700 → 5 uploads/day max.

To lift it:
1. Open the form: https://support.google.com/youtube/contact/yt_api_form
2. Project ID: from Cloud Console (top bar, hover the project name)
3. Use case: "Auto-publishing AI-generated educational video overviews of long-form articles for our small-business education site (becomeable.app). Daily upload volume: 10-20 videos in a backlog phase, then 1-3/week ongoing."
4. Channel URL: paste your YouTube channel URL
5. Submit. Approval is 1-7 days for legitimate channels.

After approval, you can do the full backlog in one or two days instead of two weeks.

## Security note

`secrets/` is gitignored. Never commit:
- `google-oauth-credentials.json` (your client secrets)
- `google-oauth-token.json` (your refresh token — equivalent to a password for your YouTube channel)

Both stay on your Mac only.
