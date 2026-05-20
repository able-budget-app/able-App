/**
 * youtube-flip-cron
 *
 * Trickle-flips YouTube videos from Unlisted to Public based on the
 * yt-longform sheet schedule. Fires on Tue/Thu via pg_cron (job uses
 * Bearer CRON_SECRET auth). Manual test via x-internal-auth header.
 *
 * Logic:
 *   1. Read yt-longform sheet via Google Sheets API.
 *   2. Filter rows where:
 *        - youtube_video_id is set
 *        - youtube_privacy = 'unlisted'
 *        - youtube_public_flip_date <= today
 *        - linkedin_status != 'deferred'
 *   3. For each match: call YouTube videos.update, set privacyStatus='public'.
 *   4. Write 'public' to the youtube_privacy column for successful flips.
 *
 * Required env vars:
 *   - CRON_SECRET                     (pg_cron Bearer auth)
 *   - INTERNAL_FUNCTION_SECRET        (manual-test header auth)
 *   - YT_SHEET_ID                     (Google Sheets ID for yt-longform)
 *   - GOOGLE_OAUTH_CLIENT_ID
 *   - GOOGLE_OAUTH_CLIENT_SECRET
 *   - GOOGLE_OAUTH_REFRESH_TOKEN      (one-time generated from desktop OAuth)
 */

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
const YT_SHEET_ID = Deno.env.get('YT_SHEET_ID') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '';
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN') ?? '';

const TAB = 'yt-longform';

interface Row {
  rowIdx: number;    // 1-based sheet row (incl. header at row 1)
  slug: string;
  videoId: string;
  flipDate: string;
  privacy: string;
  liStatus: string;
}

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

async function readSheet(accessToken: string): Promise<{ header: string[]; rows: string[][] }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${YT_SHEET_ID}/values/${TAB}!A1:ZZ`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Sheet read failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const values: string[][] = data.values ?? [];
  return { header: values[0] ?? [], rows: values.slice(1) };
}

function colLetter(idx: number): string {
  // 0→A, 25→Z, 26→AA, 27→AB...
  let out = '';
  let n = idx;
  while (true) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
    if (n < 0) return out;
  }
}

async function flipVideo(accessToken: string, videoId: string): Promise<void> {
  const url = 'https://www.googleapis.com/youtube/v3/videos?part=status';
  const body = {
    id: videoId,
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube update failed for ${videoId}: ${res.status} ${text}`);
  }
}

async function markRowsPublic(accessToken: string, privacyCol: string, rowIdxs: number[]): Promise<void> {
  if (rowIdxs.length === 0) return;
  const data = rowIdxs.map((r) => ({
    range: `${TAB}!${privacyCol}${r}`,
    values: [['public']],
  }));
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${YT_SHEET_ID}/values:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
  if (!res.ok) throw new Error(`Sheet update failed: ${res.status} ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  // Auth: Bearer CRON_SECRET OR x-internal-auth header
  const auth = req.headers.get('Authorization') ?? '';
  const internalHdr = req.headers.get('x-internal-auth') ?? '';
  const isCron = !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
  const isInternal = !!INTERNAL_SECRET && internalHdr === INTERNAL_SECRET;
  if (!isCron && !isInternal) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Env sanity
  const missing: string[] = [];
  for (const [name, val] of [
    ['YT_SHEET_ID', YT_SHEET_ID],
    ['GOOGLE_OAUTH_CLIENT_ID', GOOGLE_CLIENT_ID],
    ['GOOGLE_OAUTH_CLIENT_SECRET', GOOGLE_CLIENT_SECRET],
    ['GOOGLE_OAUTH_REFRESH_TOKEN', GOOGLE_REFRESH_TOKEN],
  ]) {
    if (!val) missing.push(name as string);
  }
  if (missing.length > 0) {
    return new Response(JSON.stringify({ error: 'Missing env vars', missing }), { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const accessToken = await getAccessToken();
    const { header, rows } = await readSheet(accessToken);

    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => { colIdx[h.trim()] = i; });

    const required = ['slug', 'youtube_video_id', 'youtube_public_flip_date', 'youtube_privacy', 'linkedin_status'];
    for (const c of required) {
      if (!(c in colIdx)) {
        return new Response(JSON.stringify({ error: `Sheet missing column: ${c}` }), { status: 500 });
      }
    }
    const privacyCol = colLetter(colIdx.youtube_privacy);

    // Build candidate list
    const due: Row[] = [];
    rows.forEach((r, i) => {
      const padded = [...r];
      while (padded.length < header.length) padded.push('');
      const videoId = (padded[colIdx.youtube_video_id] ?? '').trim();
      const flipDate = (padded[colIdx.youtube_public_flip_date] ?? '').trim();
      const privacy = (padded[colIdx.youtube_privacy] ?? '').trim();
      const liStatus = (padded[colIdx.linkedin_status] ?? '').trim();
      const slug = (padded[colIdx.slug] ?? '').trim();
      if (!videoId) return;
      if (privacy !== 'unlisted') return;
      if (!flipDate || flipDate > today) return;
      if (liStatus === 'deferred') return;
      due.push({ rowIdx: i + 2, slug, videoId, flipDate, privacy, liStatus });
    });

    const flipped: string[] = [];
    const errors: { videoId: string; slug: string; error: string }[] = [];
    for (const row of due) {
      try {
        await flipVideo(accessToken, row.videoId);
        flipped.push(`${row.videoId} (${row.slug})`);
      } catch (e) {
        errors.push({ videoId: row.videoId, slug: row.slug, error: String(e).slice(0, 200) });
      }
    }

    // Mark successful flips in sheet
    const successRowIdxs = due
      .filter((r) => flipped.some((f) => f.startsWith(r.videoId)))
      .map((r) => r.rowIdx);
    await markRowsPublic(accessToken, privacyCol, successRowIdxs);

    return new Response(JSON.stringify({
      ok: true,
      today,
      candidates: due.length,
      flipped: flipped.length,
      flipped_videos: flipped,
      errors,
    }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 500) }), { status: 500 });
  }
});
