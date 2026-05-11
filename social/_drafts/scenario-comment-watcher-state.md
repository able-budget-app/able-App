# Comment-watcher scenario — state as of 2026-05-10

**Scenario ID:** `5022585` (replaced 5021649) · **Name:** "Able comment-watcher (IG)" · **Folder:** 234788 · **Status:** PAUSED · **Decision (2026-05-10):** SKIPPED for v1 — manual IG comment monitoring until volume justifies v2 build.

## Architecture (polling, IG only)

```
1. instagram-business:GetUserMedia (limit 5)
   ↓ iterates per post
2. instagram-business:listMediaComments (limit 15 per post)
   ↓ iterates per comment
3. anthropic-claude:createAMessage  ← filter: comment NEW (last 65 min) + author != becomeable.app
   ↓
4. builtin:BasicRouter
   ├─ 5. instagram-business:CreateComment   ← filter: AUTO_REPLY in Claude output
   └─ 6. google-email:ActionSendEmail       ← filter: ESCALATE in Claude output
```

## Schedule
- Every 60 minutes
- Adjustable via UI; lighter cadence saves ops

## Connections used
- `8570232` IG/FB Connection (Facebook OAuth) — for IG actions
- `8473431` Rebuilt Anthropic Connection — for Claude calls
- `7727156` My Google connection (Gmail) — for escalation emails

## Anthropic call config
- **Model:** `claude-haiku-4-5-20251001` (cheap, fast classifier)
- **Max tokens:** 500
- **Temperature:** 0.3 (mostly deterministic)
- **Output format:** JSON schema enforcing `{class, confidence, draft_reply, reasoning}`
- **System prompt:** Brand voice rules + capabilities + classification taxonomy (see scenario blueprint)

## Classification taxonomy
- **AUTO_REPLY:** simple positives, basic feature/price questions, audience-recognition. Confidence > 0.8.
- **ESCALATE:** personal financial situations, specific advice, complaints, refunds, bugs, partnerships, anything mentioning specific dollar amounts.
- **IGNORE:** spam, off-topic, neutral emoji-only.

## Cost estimate
- Anthropic Haiku: ~$0.001 per classification (input ~600 tokens cached + ~100 user) + ~$0.002 per draft = ~$0.003/comment
- 50 comments/day × 365 = 18,250 calls × $0.003 ≈ **$55/year**
- Make ops: ~60 ops/run × 24 runs/day = ~1,440 ops/day = ~43,000 ops/month (heavy — may need to reduce poll frequency)

## Confirmed Make limitation (2026-05-10)

**`listMediaComments` returns `OAuthException (1)` regardless of connection.** Tested with both the original IG/FB connection (8570232) AND a fresh-reauthorized one (8801924) — both fail identically.

Root cause: Make's IG/FB Facebook App registration with Meta does NOT include `instagram_manage_comments` in its approved scope list. Make as a vendor would need to submit a new Meta App Review to add the scope. Until they do, no Make user can call `listMediaComments` via this app, period.

Paul confirmed this independently: "fb business manager needs a request from make to approve it."

## v2 path (when revisited)

Bypass Make's IG/FB app entirely via HTTP module + direct Meta Graph API:
1. Generate long-lived Page Access Token at https://developers.facebook.com/tools/explorer/ with `instagram_manage_comments` + `pages_read_user_content` scopes
2. Store token in Make as an env var or in a Data Store
3. Replace `instagram-business:listMediaComments` with `http:ActionMakeAPICall` → `GET https://graph.facebook.com/v22.0/{ig-user-id}/media?access_token={token}`
4. Replace `instagram-business:CreateComment` with `http:ActionMakeAPICall` → `POST /{comment-id}/replies?message=...&access_token={token}`
5. Refresh token every 60 days (Meta long-lived token expiry)

Estimated v2 build effort: ~1-2 hours.

## TT comments — out of scope for v1

TikTok Comment API requires Business app approval (weeks). Manual TT comment review for now. Add as v2 if it becomes painful.

## v2 ideas (not built)
- Make Data Store for comment dedup (replaces 65-min time window)
- FB comment watcher (parallel scenario)
- Webhook trigger via `instagram-business:NewComment` instead of polling (instant, but needs Meta webhook subscription config)
- Loop sheet log of all classifications for auditing
- Tune classifier on real data after a month
