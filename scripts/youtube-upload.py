#!/usr/bin/env python3
"""
Auto-upload Able videos to YouTube as Unlisted, write video IDs back to
the Google Sheet tracker. Picks the next N rows where status='ready-to-upload'
and youtube_video_id is empty. After a successful upload, status flips to
'uploaded' (still Unlisted). When you've reviewed them, flip Visibility to
Public manually in YouTube Studio.

Long-form mode also (by default) chains the article-linking pipeline at the
end of the run:
  1. Upload MP4 to YouTube, write video_id to the sheet
  2. Run inject-youtube-ids.py to patch `youtube_id:` into article frontmatter
     (also flips embed_status → 'linked' in the sheet)
  3. Run build-resources.py to rebuild the public HTML pages with the embed
  4. git add the changed `able-content/` + public HTML, commit, and push to main
     (Netlify auto-deploys on push). Pass --no-commit to stop after step 3.
  5. Run draft-linkedin-batch.py to write a LinkedIn post draft into the sheet
     for every newly-uploaded video. Pass --no-linkedin to skip.
Pass --no-website to skip steps 2-5.

Run:
  python3 scripts/youtube-upload.py                          # long-form (default), batch=5
  python3 scripts/youtube-upload.py --batch=3
  python3 scripts/youtube-upload.py --slug=taxes             # one specific video
  python3 scripts/youtube-upload.py --no-website             # skip inject+build chain
  python3 scripts/youtube-upload.py --shorts                 # carousel MP4s as Shorts
  python3 scripts/youtube-upload.py --shorts --batch=3

Long-form mode reads from a sheet with column `slug` and expects the MP4 at
  article-video/videos/{slug}/out.mp4 (+ thumbnail.png).

Shorts mode reads from a sheet with column `file_slug` (= {ID}_{carousel-slug})
and expects the MP4 at
  marketing-footage/social-export/youtube-shorts/{file_slug}.mp4
Thumbnail is skipped — YouTube auto-generates from the first frame.

Build the shorts sheet via: node scripts/build-shorts-sheet.js
That writes docs/youtube-shorts-tracker.csv. Import the CSV into a Google
Sheet, flip statuses to 'ready-to-upload', then run this script with --shorts.

Requires (one-time setup, see docs/youtube-api-setup.md):
  - secrets/google-oauth-credentials.json    (Desktop OAuth credentials)
  - SHEET_ID env var                          (Google Sheet ID, long-form)
  - SHORTS_SHEET_ID env var                   (Google Sheet ID, shorts)

First run kicks off the OAuth browser flow; saves token at
secrets/google-oauth-token.json for subsequent headless runs.

Per-upload cost: 1700 quota units (1600 upload + 50 thumbnail + 50 metadata).
Default daily quota: 10,000 → 5 uploads/day. Apply for an increase at
https://support.google.com/youtube/contact/yt_api_form to lift the cap.
"""
import argparse
import os
import random
import subprocess
import sys
import time
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

ROOT = Path(__file__).resolve().parent.parent
SECRETS = ROOT / "secrets"
SECRETS.mkdir(exist_ok=True)
CREDS_FILE = SECRETS / "google-oauth-credentials.json"
TOKEN_FILE = SECRETS / "google-oauth-token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/spreadsheets",
]

CATEGORY_ID = "27"   # Education
PRIVACY = "unlisted" # Default — review in Studio before flipping to public
SLEEP_BETWEEN = 90   # seconds, throttles uploads to look human


def _execute_with_retry(req, attempts=4, base_delay=2.0):
    """Run a googleapiclient request with exponential backoff on transient errors.
    Retries on 429/500/502/503/504; re-raises on auth, quota, or other 4xx."""
    for n in range(attempts):
        try:
            return req.execute()
        except HttpError as e:
            status = getattr(e.resp, "status", 0)
            if status not in (429, 500, 502, 503, 504) or n == attempts - 1:
                raise
            delay = base_delay * (2 ** n) + random.uniform(0, 1)
            print(f"  [retry] Google API {status}, sleeping {delay:.1f}s ({n + 1}/{attempts - 1})", file=sys.stderr)
            time.sleep(delay)


def get_credentials():
    if not CREDS_FILE.exists():
        sys.exit(
            f"\nMissing {CREDS_FILE.relative_to(ROOT)}.\n"
            f"Follow docs/youtube-api-setup.md to create the OAuth credentials,\n"
            f"download as JSON, and save as the path above.\n"
        )
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def get_sheet_rows(sheets_svc, sheet_id, tab=None):
    """Return the header row + data rows of `tab` (or the first tab if tab is None)."""
    rng = f"{tab}!A1:ZZ" if tab else "A1:ZZ"
    req = sheets_svc.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=rng,
    )
    res = _execute_with_retry(req)
    values = res.get("values", [])
    if not values:
        return [], []
    return values[0], values[1:]


def col_letter(idx: int) -> str:
    """0 → A, 25 → Z, 26 → AA."""
    out = ""
    while True:
        out = chr(ord("A") + idx % 26) + out
        idx = idx // 26 - 1
        if idx < 0:
            return out


def update_cell(sheets_svc, sheet_id, row_idx_1based, col_idx, value, tab=None):
    cell = f"{col_letter(col_idx)}{row_idx_1based}"
    rng = f"{tab}!{cell}" if tab else cell
    req = sheets_svc.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=rng,
        valueInputOption="RAW",
        body={"values": [[value]]},
    )
    _execute_with_retry(req)


def upload_video(youtube, mp4_path: Path, title: str, description: str, tags_str: str):
    tags = [t.strip() for t in tags_str.split(",") if t.strip()]
    body = {
        "snippet": {
            "title": title[:100],          # YouTube hard cap
            "description": description[:5000],
            "tags": tags[:30],
            "categoryId": CATEGORY_ID,
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus": PRIVACY,
            "madeForKids": False,
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(mp4_path), mimetype="video/mp4", resumable=True, chunksize=8 * 1024 * 1024)
    req = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    last_pct = -1
    while response is None:
        status, response = req.next_chunk(num_retries=3)
        if status:
            pct = int(status.progress() * 100)
            if pct != last_pct:
                sys.stdout.write(f"\r    upload {pct}%")
                sys.stdout.flush()
                last_pct = pct
    sys.stdout.write("\n")
    return response["id"]


def set_thumbnail(youtube, video_id: str, thumb_path: Path):
    req = youtube.thumbnails().set(
        videoId=video_id,
        media_body=MediaFileUpload(str(thumb_path), mimetype="image/png"),
    )
    _execute_with_retry(req)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--batch", type=int, default=999, help="Max uploads this run (default 999; script stops naturally on quotaExceeded)")
    p.add_argument("--slug", help="Upload only this slug/file_slug (overrides --batch)")
    p.add_argument("--sheet-id", help="Google Sheet ID (or set SHEET_ID / SHORTS_SHEET_ID env)")
    p.add_argument("--dry-run", action="store_true", help="Show what would be uploaded; don't actually upload")
    p.add_argument("--shorts", action="store_true",
                   help="Upload carousel MP4s as YouTube Shorts (file_slug column, no thumbnail)")
    p.add_argument("--tab", help="Sheet tab name (default: yt-shorts for --shorts, yt-longform otherwise)")
    p.add_argument("--no-website", action="store_true",
                   help="Skip the post-upload inject + build chain (long-form only; default is to run it)")
    p.add_argument("--no-commit", action="store_true",
                   help="Run inject + build but skip the git commit/push (long-form only)")
    p.add_argument("--no-linkedin", action="store_true",
                   help="Skip the LinkedIn draft step at the end of the chain (long-form only)")
    args = p.parse_args()

    # --shorts mode swaps: sheet env var, file lookup column, mp4 path, tab, thumbnail handling.
    is_shorts = args.shorts
    if is_shorts:
        sheet_id = args.sheet_id or os.environ.get("SHORTS_SHEET_ID") or os.environ.get("SHEET_ID")
        slug_col = "file_slug"
        tab = args.tab or os.environ.get("SHORTS_TAB") or "yt-shorts"
    else:
        sheet_id = args.sheet_id or os.environ.get("SHEET_ID")
        slug_col = "slug"
        tab = args.tab or os.environ.get("YT_LONGFORM_TAB") or "yt-longform"

    if not sheet_id:
        env_var = "SHORTS_SHEET_ID" if is_shorts else "SHEET_ID"
        sys.exit(f"error: pass --sheet-id or set {env_var} env var (the long string from the sheet's URL)")

    creds = get_credentials()
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
    youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)

    header, rows = get_sheet_rows(sheets, sheet_id, tab=tab)
    if not header:
        sys.exit(f"error: tab '{tab}' is empty (or doesn't exist in this workbook)")

    cols = {h.strip(): i for i, h in enumerate(header)}
    required = [slug_col, "status", "yt_title", "yt_description", "yt_tags", "youtube_video_id"]
    missing = [c for c in required if c not in cols]
    if missing:
        sys.exit(f"error: sheet is missing columns: {missing}")

    # Find queue
    queue = []
    for i, row in enumerate(rows):
        # Pad row so cols.get works
        row = row + [""] * (len(header) - len(row))
        slug = row[cols[slug_col]].strip()
        status = row[cols["status"]].strip().lower()
        existing_id = row[cols["youtube_video_id"]].strip()
        if not slug or existing_id:
            continue
        if args.slug:
            if slug == args.slug:
                queue.append((i, row))
                break
        else:
            if status == "ready-to-upload":
                queue.append((i, row))

    if not queue:
        print("[upload] no rows to process")
        print(f"  rows where status='ready-to-upload' AND youtube_video_id is empty: 0")
        print(f"  → flip status to 'ready-to-upload' on a row to queue it")
        return

    if not args.slug:
        queue = queue[: args.batch]

    mode = "shorts" if is_shorts else "long-form"
    print(f"[upload · {mode}] {len(queue)} video(s) queued")

    ok, fail = 0, 0
    for n, (i, row) in enumerate(queue, start=1):
        slug = row[cols[slug_col]].strip()
        title = row[cols["yt_title"]].strip()
        description = row[cols["yt_description"]]
        tags = row[cols["yt_tags"]].strip()
        sheet_row_1based = i + 2  # 1-based, plus header

        if is_shorts:
            mp4 = ROOT / f"marketing-footage/social-export/youtube-shorts/{slug}.mp4"
            thumb = None
        else:
            mp4 = ROOT / f"article-video/videos/{slug}/out.mp4"
            thumb = ROOT / f"article-video/videos/{slug}/thumbnail.png"

        print(f"\n[{n}/{len(queue)}] {slug}")
        if not mp4.exists():
            print(f"  [skip] no mp4 at {mp4.relative_to(ROOT)}")
            fail += 1
            continue
        if thumb is not None and not thumb.exists():
            print(f"  [skip] no thumbnail at {thumb.relative_to(ROOT)}")
            fail += 1
            continue
        if args.dry_run:
            print(f"  [dry] would upload {mp4.relative_to(ROOT)} → \"{title}\"")
            continue

        # Mark uploading so a re-run doesn't double-process
        update_cell(sheets, sheet_id, sheet_row_1based, cols["status"], "uploading", tab=tab)
        try:
            video_id = upload_video(youtube, mp4, title, description, tags)
            print(f"  [video] {video_id}")
            if thumb is not None:
                set_thumbnail(youtube, video_id, thumb)
                print(f"  [thumb] set")
            else:
                print(f"  [thumb] skipped (Shorts auto-thumbnail)")
            update_cell(sheets, sheet_id, sheet_row_1based, cols["youtube_video_id"], video_id, tab=tab)
            url = f"https://youtu.be/{video_id}"
            if "youtube_url" in cols:
                update_cell(sheets, sheet_id, sheet_row_1based, cols["youtube_url"], url, tab=tab)
            if "yt_published_date" in cols:
                update_cell(sheets, sheet_id, sheet_row_1based, cols["yt_published_date"], time.strftime("%Y-%m-%d"), tab=tab)
            update_cell(sheets, sheet_id, sheet_row_1based, cols["status"], "uploaded", tab=tab)
            ok += 1
        except HttpError as e:
            print(f"  [error] {e}")
            update_cell(sheets, sheet_id, sheet_row_1based, cols["status"], "failed", tab=tab)
            fail += 1
            if "quotaExceeded" in str(e):
                print(f"  [stop] quota exceeded — try again tomorrow or apply for increase")
                break

        if n < len(queue):
            print(f"  [pace] sleeping {SLEEP_BETWEEN}s before next upload")
            time.sleep(SLEEP_BETWEEN)

    print(f"\n[upload · {mode}] done — ok:{ok} fail:{fail}")
    print(f"  next: review the {ok} uploaded video(s) in YouTube Studio,")
    print(f"  then flip Visibility from Unlisted → Public via Studio's bulk action.")

    # Chain: long-form uploads → patch article frontmatter → rebuild public HTML
    # → git push → draft LinkedIn posts. Shorts don't link to articles, so the
    # chain is long-form only.
    if not is_shorts and not args.no_website and ok > 0 and not args.dry_run:
        run_website_chain(
            sheet_id, tab,
            do_commit=not args.no_commit,
            do_linkedin=not args.no_linkedin,
            uploaded_count=ok,
        )


# Output dirs that build-resources.py writes to. These plus able-content/
# are the only paths the chain should ever stage for commit.
PUBLISH_PATHS = ["able-content", "learn", "taxes", "business", "budgeting"]


def run_website_chain(sheet_id: str, tab: str, do_commit: bool, do_linkedin: bool, uploaded_count: int):
    """Inject youtube_ids → rebuild HTML → git push → draft LinkedIn posts."""
    env = {**os.environ, "SHEET_ID": sheet_id, "YT_LONGFORM_TAB": tab}

    print(f"\n[website] inject — patch youtube_id into article frontmatter")
    inject_rc = subprocess.run(
        ["python3", "scripts/inject-youtube-ids.py"],
        cwd=ROOT, env=env,
    ).returncode
    if inject_rc != 0:
        print(f"  [error] inject-youtube-ids.py exited {inject_rc} — skipping build")
        return

    print(f"\n[website] build — regenerate public HTML")
    build_rc = subprocess.run(
        ["python3", "scripts/build-resources.py", "able-content"],
        cwd=ROOT,
    ).returncode
    if build_rc != 0:
        print(f"  [error] build-resources.py exited {build_rc}")
        return

    if do_commit:
        git_publish(uploaded_count)
    else:
        print(f"\n[website] skipped commit (--no-commit). Stage & push manually to publish.")

    if do_linkedin:
        run_linkedin_drafter(env, uploaded_count)
    else:
        print(f"\n[linkedin] skipped (--no-linkedin)")


def run_linkedin_drafter(env: dict, uploaded_count: int):
    """Draft LinkedIn posts for the newly-uploaded videos. The drafter picks the
    next N eligible rows (yid set, linkedin_status empty), so passing
    --count=uploaded_count drains the new uploads without touching legacy rows."""
    print(f"\n[linkedin] drafting {uploaded_count} LinkedIn post(s) for new upload(s)")
    rc = subprocess.run(
        ["python3", "scripts/draft-linkedin-batch.py", f"--count={uploaded_count}"],
        cwd=ROOT, env=env,
    ).returncode
    if rc != 0:
        print(f"  [error] draft-linkedin-batch.py exited {rc} — drafts may be incomplete")
        return
    print(f"\n[linkedin] done — review drafts in the sheet's linkedin_post_text column,")
    print(f"           then flip linkedin_status: pending_review → approved to schedule.")


def git_publish(uploaded_count: int):
    """Stage only the publish paths, commit, push to current upstream."""
    print(f"\n[git] staging {', '.join(PUBLISH_PATHS)}")
    paths_present = [p for p in PUBLISH_PATHS if (ROOT / p).exists()]
    subprocess.run(["git", "add", "--", *paths_present], cwd=ROOT, check=True)

    # Anything staged?
    diff_rc = subprocess.run(
        ["git", "diff", "--cached", "--quiet"], cwd=ROOT
    ).returncode
    if diff_rc == 0:
        print(f"  [git] no staged changes — nothing to commit (frontmatter + HTML already up-to-date)")
        return

    plural = "s" if uploaded_count != 1 else ""
    msg = (
        f"blog: embed {uploaded_count} new YouTube video{plural} in article pages\n"
        f"\n"
        f"Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
    )
    commit_rc = subprocess.run(
        ["git", "commit", "-m", msg], cwd=ROOT
    ).returncode
    if commit_rc != 0:
        print(f"  [git] commit failed (rc={commit_rc}) — fix and push manually")
        return

    print(f"[git] pushing to remote")
    push_rc = subprocess.run(["git", "push"], cwd=ROOT).returncode
    if push_rc != 0:
        print(f"  [git] push failed (rc={push_rc}) — push manually")
        return

    print(f"\n[website] live — Netlify will redeploy from main; embeds will appear within ~1 min")


if __name__ == "__main__":
    main()
