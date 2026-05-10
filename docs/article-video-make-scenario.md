# Make Scenario — YouTube auto-upload from tracker sheet

Spec for the Make.com scenario that watches the article-video tracker Google Sheet and uploads the matching `out.mp4` + `thumbnail.png` to YouTube with the row's title, description, tags, and playlist. Updates the row with the new YouTube video ID.

This document is the build spec — Paul builds the scenario in the Make UI from this. Mirrors how `make_scenario_state.md` documents the existing social cross-post scenario.

## Inputs

**Source of truth: the tracker Google Sheet.**

Each row represents one video. Columns the scenario reads:
- `slug`
- `yt_title`
- `yt_description`
- `yt_tags`
- `yt_playlist`
- `yt_thumbnail_path` — Drive file ID or share URL of the thumbnail PNG
- `video_drive_id` — Drive file ID of the rendered out.mp4
- `status` — must be `ready-to-upload` for the scenario to act on the row

Columns the scenario writes back:
- `youtube_video_id`
- `youtube_url`
- `yt_published_date`
- `status` — bumps to `live` after upload

## Pre-upload (manual or local-script step before Make runs)

For each video to publish:

1. Render locally: `npm run all` (or just `npm run build` per video)
2. Upload `videos/<slug>/out.mp4` to a known Drive folder (e.g., `Able / Videos / mp4`)
3. Upload `videos/<slug>/thumbnail.png` to a known Drive folder (e.g., `Able / Videos / thumbnails`)
4. Paste both Drive file IDs into the tracker row
5. Fill `yt_title`, `yt_description`, `yt_tags`, `yt_playlist`
6. Set `status` to `ready-to-upload`

The `npm run all` step ships the mp4 and PNG in known locations. The Drive upload itself can be a separate manual drag-drop today; later we can add a `npm run drive-upload` that uses the Drive API, if it's worth automating.

## Scenario topology

```
[1] Google Sheets — Watch Rows
       trigger: rows where status="ready-to-upload"
       returns: row_id, slug, yt_title, yt_description, yt_tags,
                yt_playlist, yt_thumbnail_path, video_drive_id
              │
              ▼
[2] Google Drive — Download a File         (input: video_drive_id)
              │
              ▼
[3] Google Drive — Download a File         (input: yt_thumbnail_path)
              │
              ▼
[4] YouTube — Upload Video
       title:        {{yt_title}}
       description:  {{yt_description}}
       tags:         {{yt_tags}}              (comma-separated → array)
       categoryId:   27                       ("Education")
       privacyStatus: public
       file:         {{step 2 output}}
       returns: youtube_video_id
              │
              ▼
[5] YouTube — Set Thumbnail
       videoId:      {{youtube_video_id}}
       file:         {{step 3 output}}
              │
              ▼
[6] YouTube — Add to Playlist               (optional)
       playlistId:   {{lookup yt_playlist on a constants table}}
       videoId:      {{youtube_video_id}}
              │
              ▼
[7] Google Sheets — Update Row              (input: row_id)
       youtube_video_id:    {{youtube_video_id}}
       youtube_url:         https://youtu.be/{{youtube_video_id}}
       yt_published_date:   {{now()}}
       status:              live
```

## Module-by-module notes

### [1] Sheets — Watch Rows

- Watch column: `status`
- Trigger when value equals: `ready-to-upload`
- Polling interval: 15 min (Make's default works; nothing here is time-sensitive)

### [2-3] Drive — Download a File

- Two separate Drive download modules (one for mp4, one for thumbnail).
- Input is the Drive file ID from the row. If the sheet stores the share URL instead of the ID, parse with a `Replace` text module first: extract everything between `/d/` and `/view`.

### [4] YouTube — Upload Video

- Required scopes: `youtube.upload`. First time you connect, Make will prompt for a Google account and OAuth.
- `title` max 100 chars (the tracker spec says 90 to leave room).
- `description` max 5000 chars.
- `tags` is an array — split the comma-separated tracker string on `, ` before passing.
- `categoryId` `27` is "Education." `26` is "Howto & Style." Both fine for our content; pick one and stick with it.
- `privacyStatus`: `public`. Or `unlisted` while you test the scenario, then flip to `public` once it's reliable.
- `defaultLanguage`: `en`.
- `madeForKids`: `false`.

### [5] YouTube — Set Thumbnail

- Separate from the upload because YouTube's API requires the video to exist first before a custom thumbnail can be set. The default upload uses an auto-generated still.
- File size limit: 2MB. Our 1280×720 PNG outputs are typically <500KB, well under.

### [6] YouTube — Add to Playlist (optional)

- If `yt_playlist` is filled, look up the playlist ID from a constants table (sheet, JSON, or hardcoded in a Make `Set Variable`).
- Suggested playlists:
  - "Pillars" — main pillar articles
  - "Supporting" — supporting articles per cluster
  - "By cluster: Budgeting / Taxes / Business / Learn"

### [7] Sheets — Update Row

- Update the same row by `row_id` (Sheets module's stable identifier).
- Fields written are listed in topology above.

## Error handling

- Add a Make error route on the YouTube Upload step: on error, write the error message to a `last_error` column on the row + leave `status` at `ready-to-upload` so a human can intervene.
- Common failures: wrong file format, exceeded 12-hour total upload limit, invalid tag character.

## Cost

- Make: 7 ops per video. At Make's free tier (1000 ops/month), you can upload ~140 videos/month before hitting the cap. Plenty for our cadence.
- YouTube API: free, but quota'd at 10,000 units/day. An upload costs 1600 units; thumbnail set costs 50; playlist insert costs 50. So ~6 videos/day before hitting the quota — also fine.

## Once it works

- First test on a single video with `privacyStatus: unlisted` so you can verify the upload + metadata before going public.
- Once the scenario runs clean for 2-3 videos, flip privacy to `public` and start batching.
- Keep the local render → Drive upload step manual for now. Automating that costs more than it saves at our cadence.
