# Able brand design system

Single source of truth for anyone (human or AI) building visual assets for Able. Paste this whole file into a Claude conversation (or Claude Design) as the brand reference, then ask for the thing you want built. Output should match what's in here.

**Product in one line:** Able is a budgeting app for freelancers, creators, and business owners with inconsistent income.

---

## 1. Voice (strict)

Applies to every piece of customer-facing copy, inside and outside the app.

- **Short sentences.** One idea per sentence. Low cognitive load.
- **Warm, calm, specific.** Not hype. Not corporate. Not therapy-speak.
- **No em dashes** (`—`). Ever. Use periods, commas, or hyphens instead. Em dashes read as AI-generated.
- **No emojis** in product or marketing copy.
- **Money is energy** (when the emotional angle fits). Scarcity contracts you; abundance opens you up. Most of what you fear does not happen, or it happens and you survive it.
- **Empathy first, numbers second.** Acknowledge the feeling, then pivot to a concrete next action.
- **The reader is the hero. Able is the guide.** Never put Able in the spotlight.
- **Avoid corporate speak:** leverage, utilize, solution, seamless, empower, unlock potential, level up, game-changer.

### Able's signature phrases (use them, don't overuse them)

- "You don't need more discipline. You need a plan built for income like yours."
- "Money that sits, leaks."
- "Same foundation. Different clock."
- "Built for the paycheck that does not come every two weeks."
- "Unpredictable check to unpredictable check." (as counter to the classic "paycheck to paycheck")
- "Built for inconsistent income."

### Positioning rules

- **Not anti-Ramsey.** Classic personal finance is "the foundation most Americans still use" and works for steady paychecks. Able extends those principles to variable income. Never frame as replacing or rejecting classic advice.
- **Not anti-other apps.** Honest comparisons only. If a competitor wins at something (e.g., YNAB has bank sync and we don't), say so.
- **Secular.** Giving is a user-defined category, not a first line.

---

## 2. Color tokens

All hex values. Use the variable names in CSS and refer to them by name in design specs.

### Primary / brand

| Token | Hex | Use |
|---|---|---|
| `--ds-green` | `#2a7a4a` | Primary brand green. CTAs, headlines, key accents. |
| `--ds-green2` | `#1f6038` | Darker green, hover/press state for CTAs. |
| `--ds-green-l` | `#eaf5ee` | Pale green. Callout backgrounds, pills, highlight zones. |
| `--ds-green-m` | `#b8e0c8` | Mint green. Footer underline, subtle accents on dark. |

### Surface / neutrals

| Token | Hex | Use |
|---|---|---|
| `--ds-page` | `#f0f7f2` | Page background. Soft off-white with a green tint. |
| `--ds-card` | `#ffffff` | Card background. White. |
| `--ds-card2` | `#f7fbf8` | Secondary card surface. Same family, slightly darker. |
| `--ds-t1` | `#111c16` | Primary text. Near-black with a green undertone. |
| `--ds-t2` | `#4a5c52` | Secondary text. |
| `--ds-t3` | `#8ca898` | Tertiary text, labels, captions. |
| `--ds-t4` | `#c4d8cc` | Borders, dividers. |

### Functional

| Token | Hex | Use |
|---|---|---|
| `--ds-c2` | `#3d9e78` | Success / positive accent. Used alongside green. |
| `--ds-c3` | `#c97c0a` | Warm amber. Warning, attention. |
| `--ds-c4` | `#c04060` | Rose / alert. Errors, danger, negative accent. |
| `--ds-c5` | `#3570b8` | Cool blue. Informational, savings. |

**Gradients used throughout:**
- Hero card: `linear-gradient(145deg, #1f6038 0%, #2a7a4a 55%, #3d9e78 100%)`
- Callout / CTA card: `linear-gradient(135deg, #eaf5ee, #d9ecde)`

---

## 3. Typography

Single typeface: **Bricolage Grotesque**, loaded from Google Fonts.

```
https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800;12..96,900&display=swap
```

CSS variable: `--ds-f: 'Bricolage Grotesque', -apple-system, sans-serif;`

### Size + weight scale

| Role | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|
| Hero headline | `clamp(2rem, 4vw, 3rem)` | 900 | `-0.04em` | Landing hero, pillar H1 |
| Section headline | `clamp(1.9rem, 4vw, 2.6rem)` | 900 | `-0.03em` | Article H1 |
| Sub headline | `1.5rem` | 800 | `-0.02em` | Section H2 |
| Sub-sub | `1.15rem` | 800 | `-0.01em` | H3 |
| Body lead | `17–18px` | 500 | `-0.005em` | Dek, pull quotes |
| Body | `16–16.5px` | 500 | 0 | Paragraph text |
| Meta / label | `11px` | 800 | `0.14em` | UPPERCASE, eyebrows |
| Micro | `9–10px` | 800 | `0.1–0.14em` | UPPERCASE, chip labels |

**Rule:** Big text (24px+) gets tight letter-spacing (`-0.02em` or tighter). Small UPPERCASE labels get generous letter-spacing (`0.1em+`).

---

## 4. Radius system

Three radii, named by intent. Rule of continuity: elements in the same shape family share a radius.

| Token | Value | Use |
|---|---|---|
| `--ds-r1` | `12px` | Small chips, inputs, small buttons, inline pills |
| `--ds-r2` | `18px` | Cards, medium containers, most tags/badges |
| `--ds-r3` | `26px` | Hero cards, CTA cards, large containers |
| (pill) | `100px` | Progress bars, pill-shaped buttons ONLY |

**Important constraint:** Reserve full-pill (`100px` / `border-radius: 9999px`) for **progress bars and pill-shaped CTAs only.** Do not use pill radius on tags, badges, or chips. Those are `r2` (18px). This keeps the shape language coherent.

---

## 5. Logo

### Wordmark
Plain text "Able" in Bricolage Grotesque, weight 900, letter-spacing `-0.03em`, color `--ds-t1`.

### Sharpie underline
Always pair the wordmark with a hand-drawn, tapered green underline that sits flush under the baseline. Inline SVG, embedded as a CSS background on a `::after` pseudo-element:

```html
<span class="logo">Able</span>
```

```css
.logo {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 900;
  letter-spacing: -.03em;
  color: #111c16;
  line-height: 1;
  position: relative;
  display: inline-block;
  padding-bottom: 3px;
}
.logo::after {
  content: '';
  position: absolute;
  left: 0;
  right: -4%;
  bottom: -3px;
  height: 5px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='%232a7a4a'/></svg>") no-repeat center / 100% 100%;
}
```

Characteristics:
- Tapered (thin on left, thick on right)
- Rounded ends
- Slight smile curve — not a straight line, not a wavy line
- Green (`--ds-green` in nav; same green on dark backgrounds, never mint)

### Logo on dark
Same structure, same green. Do not lighten the underline on dark backgrounds. It reads fine at `#2a7a4a` on the dark hero.

### Don'ts
- No icon mark (just the wordmark + underline).
- No shadows on the wordmark.
- No italic variants.
- No tilted or skewed logo.

---

## 6. Component patterns

### Primary button (CTA)
```css
background: #2a7a4a;
color: white;
border-radius: 100px;   /* pill only on buttons */
padding: 14px 28px;
font-weight: 800;
font-size: 15px;
letter-spacing: -.01em;
```
Hover: `background: #1f6038`, `transform: translateY(-1px)`

### Secondary button (ghost)
Transparent background, green text, rounded-rect (18px), same sizing.

### Card
```css
background: #ffffff;
border-radius: 18px;
padding: 1.25rem 1.5rem;
box-shadow: 0 1px 4px rgba(0,0,0,.05), 0 2px 8px rgba(0,0,0,.04);
```

### Hero / CTA card (the green-gradient one)
```css
background: linear-gradient(145deg, #1f6038 0%, #2a7a4a 55%, #3d9e78 100%);
border-radius: 26px;
padding: 1.5rem 1.5rem 1.35rem;
color: white;
box-shadow: 0 12px 32px rgba(31,96,56,.22);
```

### Pull quote / callout (in articles)
```css
background: #eaf5ee;
border-left: 4px solid #2a7a4a;
border-radius: 18px;
padding: 1.25rem 1.5rem;
font-weight: 700;
line-height: 1.5;
letter-spacing: -.01em;
```

### Chip / tag
```css
background: rgba(255,255,255,.1);   /* on dark */
border: 1px solid rgba(255,255,255,.14);
border-radius: 18px;
padding: 6px 12px;
font-size: 11px;
font-weight: 800;
letter-spacing: .12em;
text-transform: uppercase;
```

### Check circle (allocation check-off)
Green filled circle with white checkmark inside. 22–30px diameter depending on context.

---

## 7. Iconography

- Line icons only, 2–2.2px stroke, rounded joins + caps.
- Usually 20–24px in UI, 14–18px in dense contexts.
- Color inherits from the parent (`currentColor`) in most places.
- Avoid filled or duotone icons. Keep it clean line work.
- When icons need a background plaque, use `--ds-green-l` with `--ds-green` icon.

---

## 8. Motion

- Easings: `cubic-bezier(.34,1.2,.64,1)` for playful pops; `cubic-bezier(.34,1.56,.64,1)` for the check-off pop; standard `ease` for anything subtle.
- Hover lift: `transform: translateY(-1px)` with `transition: transform .15s`.
- Entrance animations: fade + 4–8px translate-Y, 0.35s duration.
- No bouncing for bouncing's sake. Every motion serves a meaning.

---

## 9. Imagery

- Phone mockups are the main visual asset type. Frame is `#1a1a1a`, rounded ~44px, with a notch.
- Screen inside the phone uses `#f0f7f2` (same as page background) for continuity.
- No stock photography of smiling people at desks. No diverse-hands-around-a-laptop. No abstract 3D renders.
- When an image is needed, prefer product UI, hand-drawn marks, or the logo.

---

## 10. Social post templates

These are specs Claude Design (or any designer) can execute on. Brand-consistent sizing, colors, typography.

### Template A: Single-quote card (1080 × 1080, Instagram square)

```
Background: linear-gradient(135deg, #eaf5ee 0%, #d9ecde 100%)
Padding: 120px all sides
Logo (top-left): Able wordmark with green sharpie underline, 64px font
Body text (center): bold quote, max 16 words, #111c16, font-size 72px, weight 900, letter-spacing -0.03em, line-height 1.1
Attribution (bottom-left): "becomeable.app" in #4a5c52, 28px, weight 600, uppercase letter-spacing 0.14em
```

Example quote content:
- "Money that sits, leaks."
- "You don't need more discipline. You need a plan built for income like yours."
- "Same foundation. Different clock."
- "Built for the paycheck that does not come every two weeks."

### Template B: Tip / rule card (1080 × 1080)

```
Background: #ffffff, with a 4px left border in #2a7a4a (radius 18px card feel)
Eyebrow (top): "RULE" or "TIP" in #2a7a4a, 36px weight 800, letter-spacing 0.14em
Headline: one sentence, #111c16, font-size 56px, weight 900, letter-spacing -0.03em, line-height 1.15
Body: 2-3 sentences, #4a5c52, font-size 32px, weight 500, line-height 1.55
Logo (bottom-center): Able wordmark + underline, 48px
```

### Template C: Stat card (1080 × 1080)

```
Background: linear-gradient(145deg, #1f6038 0%, #2a7a4a 55%, #3d9e78 100%)
Eyebrow (top): "THE MATH" in white 70% opacity, 36px weight 800, letter-spacing 0.14em
Big number (center): white, font-size 220px, weight 900, letter-spacing -0.05em, line-height 1
Unit next to number: white 50% opacity, font-size 48px, weight 800
Caption: 1 short sentence, white 90% opacity, font-size 40px, weight 600, line-height 1.4
Logo (bottom-left): Able wordmark with mint underline, 48px
```

Example stat content:
- "72 /100 — your score on inconsistent-income budgeting."
- "25–35% — what most freelancers should set aside for taxes on every deposit."
- "6–12 months — emergency fund target for self-employed."

### Template D: Compare / then-vs-now card (1080 × 1080)

```
Background: #f0f7f2
Split vertically 50/50
Left half: "CLASSIC BUDGET" label, then a one-sentence description of the classic monthly cycle. Muted tone, #4a5c52 text.
Right half: "ABLE" label in #2a7a4a, then a one-sentence description of the per-deposit system.
Both sides use the same type scale for parity.
```

### Template E: Calculator / interactive teaser (1080 × 1350, Instagram portrait)

```
Top 60%: a mini phone mockup showing a calculator result (e.g., "Set aside 30%")
Bottom 40%: #ffffff card with title, subtitle, and a pill CTA with arrow.
Card title: "Find your tax set-aside rate." font-size 56px weight 900.
Subtitle: "Free. No email required." font-size 32px, #4a5c52.
CTA pill: "Try it →" white text on #2a7a4a, radius 100px, padding 18px 36px.
```

### Template F: Open-loop teaser / carousel slide 1 (1080 × 1080)

```
Background: #ffffff
Big question / hook, #111c16, 64px weight 900, max 8 words.
Visual cue bottom-right: thin arrow or "Swipe →" in #2a7a4a, 32px weight 800.
Logo bottom-left, 36px.
```

Example hooks:
- "Why do big months disappear?"
- "What should a freelancer set aside for taxes?"
- "Your paycheck isn't the problem."

---

## 11. Anti-patterns (never do)

- No em dashes. Not in text. Not in image copy.
- No emoji icons. Use SVG line icons instead.
- No "disruption" language. No "revolutionize." No "reimagine." No "AI-powered" as a selling point.
- No stock photos of generic professionals.
- No shiny gradients beyond the Able green or the pale-green → mint callout. No purple/blue/orange gradient effects.
- No pill shapes on tags, badges, or chips. 18px radius rectangles only.
- No corporate headline cadence ("Transform your financial future"). Use plain, specific language.
- No infographics with 6 stats crammed in. One stat per card. Restraint.

---

## 12. Tone-matched example outputs

When evaluating whether a proposed design or copy is on-brand, compare to these.

**On-brand copy:**
- "You get paid when the work finishes, when the client remembers, when the platform cuts checks."
- "Every deposit becomes a decision, not a question mark."
- "Big month, dry month, panic, repeat. The feast or famine cycle is the defining pattern of self-employed income."

**Off-brand copy (do not write):**
- "Unlock your financial potential with our AI-powered budgeting platform."
- "Say goodbye to money stress with Able's revolutionary approach!"
- "Transform your finances in 3 easy steps — join thousands of happy entrepreneurs!"

---

## 13. How to use this doc

**If you are Claude or Claude Design:** before generating any Able asset, scroll to sections 1 (voice), 2 (colors), 3 (typography), 5 (logo), and 10 (social templates). Match those specs exactly. If the request is ambiguous, default to the examples in section 12.

**If you are the founder or a human designer:** keep this doc synced with the live product. When you change a token, a radius, or a rule, update here first. The sitemap of Able's brand lives in this file.
