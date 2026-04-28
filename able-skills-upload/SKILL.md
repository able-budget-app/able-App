---
name: able-brand
description: Use when working on Able's UI, UX, visual design, landing page layout, design tokens, motion, or any visual/typographic/spacing decision for the Able product. Also covers Able's brand voice and the StoryBrand-correct framing where the customer is hero and Able is guide. Trigger on tasks involving index.html, app.html styling, new page sections, layout reviews, design system questions, or "make this look on-brand."
---

# able-brand

Able is a budgeting app for people with inconsistent income — freelancers, creators, business owners. Brand built around one promise: **From Unable → Able**. Every visual + copy decision should reinforce that arc.

## Voice and tone (the non-negotiables)

- **Short sentences. Plain language. No em dashes.** (Use periods or line breaks.)
- **Warm, calm, specific.** Not hype. Not corporate.
- **Customer is the hero. Able is the guide.** (StoryBrand.) Never make the tool the protagonist. "Tells you what to do next" is wrong. "You see what every dollar is for" is right.
- **Permission, not blame.** "The problem was never you. It was the advice you were handed."
- **Identity language.** "You are able to..." not "Able does X for you."
- **Real specifics over claims.** "$500–$1,000 leaks every month" beats "save more money."
- Use second person ("you"), not first-person plural ("we"). Founder POV is Paul.

## The page-level bookend pattern

Every long-form page should open and close on the same emotional axis. Pattern Able uses:

- **Hero opens with the breath metaphor:** "From holding your breath with bills → To finally able to breathe."
- **Final CTA closes with:** "From Unable → Able."
- The arc moves: paralysis → permission → system → outcome → identity shift.

When designing a new page (landing variant, comparison page, pillar post), pick a pain pair and bookend it. Don't break the loop with a generic "sign up today" close.

## The Day 1–31 narrative anchor

This is Able's signature problem-frame. Use it whenever the audience needs the pain made specific:

- Day 1: Money comes in. Just in time. Breathe a little.
- Day 7: A snack here, a subscription there.
- Day 14: The leak begins.
- Day 30: "Where did that $1,000 go?"
- Day 31: Shame. Guilt. Avoidance.

Don't paraphrase it loosely. The verbatim escalation is load-bearing. Reuse on social, video, ads, emails, content articles.

## Design tokens (verbatim from index.html)

**Colors:**
- Primary green: `#2a7a4a` / `#3d9e78` / `#1f6038`
- Page background: `#f0f7f2`
- Card backgrounds: `#ffffff`, `#f7fbf8`
- Text: `#111c16` (t1, body), `#4a5c52` (t2, secondary), `#8ca898` (t3, muted)
- Accents: `#c97c0a` (orange — warn/highlight), `#c04060` (red — debt/danger), `#3570b8` (blue — info/links)

**Typography:** Bricolage Grotesque, weights 400–900. System sans fallback. Do not introduce a second display face.

**Type scale:** Responsive `clamp()` — h1 `2.25rem–3.75rem`, h2 `2rem–3rem`. Body comfortable, not cramped.

**Radius scale:** `12px` (r1, inputs/small chips), `18px` (r2, cards), `26px` (r3, hero blocks/phones).

**Shadow scale:** Three levels (`sh1` light, `sh2` mid, `sh3` strongest for depth). Green-accent shadow on hover-lift CTAs only.

**Spacing:** `0–2rem` container padding; gap scale `0.6rem–3rem`. No arbitrary pixel paddings.

## Motion rules

- Scroll reveals: `.reveal` fade-up, `0.6s ease`, threshold `0.12`. Don't go faster — calm is the brand.
- Problem-beat progressive highlight: staggered `180ms` reveal as user scrolls. Do not loop or auto-play.
- Phone mockup float: `6s ease-in-out`, gentle. No bouncing, no parallax circus.
- Hover: subtle shadow + transform lift. No color flips, no rotations.
- Checkmark pop on completion is the one allowed celebration. Use sparingly.

## Visual identity primitives

- **Phone mockups in green-gradient cards** are Able's hero visual. The hero phone shows a forward-looking allocation; the Shift-section phone shows a "March recap / Nothing leaked" state. Use both as bookends — one phone alone breaks the rhythm.
- **Green check icons** for benefit bullets. Three bullets max in any benefit cluster.
- **The arrow.** "From X → To Y" arrow is rendered green via `.hero-arrow`. Use this construction for any "before → after" framing across the brand. Don't substitute em dashes or em-arrows.

## Layout rules

- Container max-width `~1160px` for marketing; `960px` for content-dense sections (features grid).
- Features grid is 2-col, with the AI Coach card as `grid-column: span 2` (full-width flagship). Don't go to 3-col — the bodies are problem→solution and need the width.
- Pricing is two-card 1fr 1fr with `760px` max-width. Annual is the featured card with "Save $41" badge. Monthly is the ghost CTA.
- Mobile breakpoint behavior is "stack and breathe" — never compress to keep desktop columns.

## Anti-patterns (do not ship)

- Em dashes anywhere in copy.
- "We" / "our team" voice.
- Tool-as-hero phrasing ("Able tells you what to do," "Able decides for you").
- Generic SaaS hero ("The all-in-one budgeting platform for modern creators").
- Stock-photo people. Use the phone mockups + abstract green gradients only.
- Multiple display faces. Bricolage Grotesque only.
- Bouncy motion / parallax / autoplaying carousels.
- Pricing without the "7-day free trial" line. It's load-bearing.
- Any pain framing that blames the user. Always pair pain with permission.

## When invoked: process

1. Read the relevant section of `index.html` or `app.html` first. Don't propose changes blind.
2. Identify which brand pillar the change touches: voice, visual tokens, motion, layout, or bookend pattern.
3. Match existing tokens. Never introduce a one-off color or radius — extend the scale instead.
4. Run the copy through the voice checklist: short? plain? no em dashes? customer-as-hero? specific?
5. If proposing a new section, bookend-check it against the surrounding sections — does the emotional arc hold?
6. For UI changes, name the affected design tokens explicitly so the user can review.
