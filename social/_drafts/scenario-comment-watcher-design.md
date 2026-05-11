# Comment-watcher scenario — design

## Purpose

Watch IG + FB for new comments on Able's posts. Use Claude to classify each comment into auto-reply, escalate, or ignore. Auto-replies post directly. Escalations email Paul with a draft reply for him to approve.

## Architecture

```
1. IG:WatchComments  →  2. Aggregator
1b. FB:WatchComments  →  2. (same aggregator)

2. Aggregator  →  3. Filter (skip already-replied)  →  4. Claude API: classify  →  5. Router

5a. AUTO-REPLY route  →  6. Claude API: draft  →  7. IG/FB:CreateComment  →  8. Sheet:appendRow (log)
5b. ESCALATE route  →  9. Claude API: draft  →  10. Email Paul (with draft + Approve link)  →  11. Sheet:appendRow (log)
5c. IGNORE route   →  12. Sheet:appendRow (log only)
```

## Sub-modules

### Triggers (1 + 1b)
Two parallel poll triggers — one per platform. Both write to the same downstream flow via aggregator.
- IG: `instagram-business:WatchComments` (every 15 min)
- FB: `facebook-pages:WatchComments` (every 15 min)

### Classifier (Claude API call, module 4)
- HTTP module → POST to Anthropic API
- Model: `claude-haiku-4-5-20251001` (cheap, fast for classification)
- System prompt loads brand-script + capabilities (passed inline; small)
- User prompt: `Classify this comment into AUTO_REPLY, ESCALATE, or IGNORE. Return JSON: {"class": "X", "confidence": 0-1, "reason": "..."}`
- Output parsed via JSON.parse expression

### Decision tree (module 5 router)
- AUTO_REPLY: simple/factual/positive (price questions, thank-yous, "is this real", emoji-only positive)
- ESCALATE: anything matching banned patterns OR personal questions OR low-confidence classification
- IGNORE: spam, off-topic, emoji-only neutral

### Banned patterns (escalate, never auto-reply)
- "Will I owe X in taxes?" / specific tax advice
- "Should I take this loan?" / specific financial advice
- "I'm in debt and..." / personal financial situations
- Refund / billing / cancellation
- Bug reports / technical issues
- Anything with "you" + dollar amount over $100

### Auto-reply draft (Claude, module 6)
- Same Haiku model
- System prompt: brand voice + capabilities + "respond in 1-2 sentences, no em dashes, no emojis, no founder name, end with a soft CTA only if natural"
- User prompt: original comment + brand context

### Escalate email (module 10)
- Subject: `Able comment to review · {{platform}} · {{post_id}}`
- HTML body:
  - Original post slug + URL
  - User's comment + handle
  - Claude's suggested draft
  - Approve link (mailto: with subject "APPROVE {{comment_id}}") OR a Make form webhook for one-tap approval
  - Skip link
- Connection: 7727156 (Gmail)

### Sheet log (modules 8, 11, 12)
- New tab in master spreadsheet: "Comments"
- Columns: comment_id, platform, post_slug, user_handle, comment_text, class, confidence, our_reply, status (auto-replied / escalated / ignored / approved / declined), timestamp

## Schedule

- Every 15 min: `scheduling.type = "indefinitely"`, `interval = 15`

## Open questions before build

1. **Approve flow** — mailto: link works but is rough. Better UX: a Make form (https://www.make.com/en/help/tools/forms) that takes one POST → triggers a child scenario that posts the approved reply. Adds complexity but cleaner. Lean: mailto v1, form v2.
2. **TT comments** — TikTok Comment API requires a Business app + display approval (months). Skip for v1; manual TT comment review.
3. **Anthropic API connection** — need an API key in Make's env. Paul has `ANTHROPIC_API_KEY` in Supabase. Same key works for Make HTTP module.
4. **Rate limits** — IG/FB have rate limits on comment polling. 15 min should be safe. Comment posting limits: 60/hour, well below our volume.
5. **Loop prevention** — exclude comments where author == Able's own account so we don't reply to ourselves.

## Cost estimate

- Haiku classification: ~$0.001 per comment
- Haiku draft: ~$0.002 per comment
- 50 comments/day × 365 days × $0.003 = **~$55/year**

Negligible.
