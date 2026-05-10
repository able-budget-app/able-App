# NotebookLM source bundles

Pre-bundled markdown files designed to be pasted into Google Docs once and linked as sources from every NotebookLM notebook you generate. Saves the "load 6 separate sources every time" tax.

## Files in this directory

| File | What's in it | Use it for |
|---|---|---|
| `00-able-brand-spine.md` | brand-script + floor-first-method + app-capabilities | **Every notebook.** This is the always-include bundle. |
| `budgeting-bundle.md` | budgeting/index.md + 10 supporting budgeting articles | Any video about budgeting (pillar or supporting article). |
| `taxes-bundle.md` | taxes/index.md + 7 supporting taxes articles | Any video about taxes. |
| `business-bundle.md` | business/index.md + emergency-fund article | Any video about business credit / loans / emergency funds. |
| `learn-bundle.md` | 5 learn sub-pillar index pages | Any video about pay-yourself-first / how money works / debt / funding / credit. |

## Workflow (per video)

1. **One-time setup:** create one Google Doc per bundle file above. Paste the markdown in, save, share with view access.
   - You'll end up with 5 Google Docs total.
   - Bookmark the URLs.
2. **Per video:** in NotebookLM, add 3 sources:
   - The brand spine doc (always)
   - The relevant cluster bundle doc
   - The specific article you're making a video about (paste markdown or link to the live article URL)
3. Generate the video overview with the prompt from `docs/notebooklm-youtube-spec.md`.

## Why bundles instead of individual sources

NotebookLM caps at 50 sources per notebook, but quality drops well before that. 3 well-chosen sources beats 30 noisy ones. Bundling means you give NotebookLM the whole brand context in one source instead of 11 small ones, and the AI doesn't have to stitch context across files.

## When to regenerate

If any underlying file changes (`docs/brand-script.md`, an article in `able-content/`, the capabilities skill), regenerate with:

```bash
./docs/notebooklm-sources/build-bundles.sh
```

Then re-paste the changed bundle into its Google Doc. Sources in active notebooks won't auto-update — you'll need to re-link or re-upload after a regeneration.

## File sizes (line count)

```
  681  00-able-brand-spine.md      ← always include
 2290  budgeting-bundle.md          ← biggest cluster
 1963  taxes-bundle.md
  543  business-bundle.md
  308  learn-bundle.md
```

All comfortably under Google Docs' practical limit. The brand spine's 681 lines is roughly 12 pages — fits in any single Google Doc cleanly.
