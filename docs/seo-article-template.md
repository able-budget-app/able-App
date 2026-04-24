# How to add a new SEO resource article

This documents the pattern used for Able's `/resources/*.html` pages so new articles drop in consistently.

## Voice + positioning guardrails

Before writing a word, read:
- `/docs/seo-content-brief.md` — brand voice (strict). Short sentences, no em dashes, no emojis, money-as-energy frame, empathy first, guide-not-hero.
- `~/.claude/projects/-Users-pauljohnson/memory/feedback_ramsey_positioning.md` — Ramsey is respected, not rejected. Never frame Able as anti-Ramsey.

## Steps to add an article

1. **Copy the flagship** `/resources/how-to-budget-when-your-income-is-different-every-month.html` as your starting template. It already has correct `<head>`, nav, footer, pullquote/CTA/related styles.

2. **Update every meta tag** in the `<head>`:
   - `<title>` — 50–70 chars, search-intent aligned
   - `<meta name="description">` — 150–160 chars, compelling
   - `<link rel="canonical">` — absolute URL at `https://becomeable.app/resources/<slug>.html`
   - All `og:*` tags to match
   - JSON-LD `Article` schema: headline, description, url, mainEntityOfPage

3. **Update the content:**
   - Breadcrumb: `Home / Resources / <topic>`
   - Eyebrow: the topic cluster (e.g. "Budgeting with irregular income")
   - H1: matches the `<title>` closely
   - Dek: a 1–2 sentence hook below the H1
   - H2 sections, H3 subsections, short paragraphs
   - At least one `.pullquote` block for scan-ability
   - Close with the `.cta-card` block linking to `/app.html`
   - `.related` block linking to other cluster pages (use `soon` span for unpublished)

4. **Add the article to `/sitemap.xml`** with `<changefreq>monthly</changefreq>` and `<priority>0.8</priority>` (pillar) or `0.7` (supporting).

5. **Update `/resources/index.html`** to list the new article. Move it from "Coming soon" (the `.hub-item-soon` block) to "Start here" (the regular `.hub-item` block with a real `href`).

6. **Cross-link from siblings.** In every other article in the same cluster, update the `.related` list so the new article is a live link, not a `soon` stub.

## Cluster structure

Each pillar page anchors a cluster of 4–6 supporting articles. The pillar is the comprehensive how-to; the supporting pages are deep dives on single sub-topics. Supporting pages link back to the pillar; pillar links to all supporting pages.

Current clusters (as of 2026-04-24):

- **Budgeting with irregular income** (pillar: `how-to-budget-when-your-income-is-different-every-month.html`)
  - Paycheck to paycheck as a freelancer (planned)
  - What to do with a big client deposit (planned)
  - Building a financial buffer on inconsistent income (planned)
  - Envelope vs zero-based budgeting for self-employed (planned)

- **Taxes for the self-employed** (pillar: TBD)
  - Self-employment tax explained
  - How much to save for taxes each month
  - Quarterly tax payments
  - Home office deduction
  - 1099-NEC and 1099-K

- **Retirement with variable income** (pillar: TBD)
  - Solo 401(k) vs SEP IRA (high-intent comparison gap)
  - How to invest when your income bounces
  - Contribution strategies for lumpy years

- **Persona pages** (no single pillar, each page is standalone)
  - Creator, designer, rideshare driver, coach, real estate agent, Etsy seller

## What not to do

- Do not invent new CSS. Reuse what's in the flagship.
- Do not add emojis, em dashes, or corporate-speak.
- Do not position Able against Ramsey. Frame as extending his principles to inconsistent income.
- Do not build lead-magnet captures or email forms without founder sign-off.
- Do not use AI-generated images without a human pass.
