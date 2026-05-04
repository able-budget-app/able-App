# Able — E2E Test Plan

Comprehensive test plan for end-to-end validation of a fresh new-user journey, plus regression coverage of recently shipped features and discovery prompts for surfacing new issues.

Use this list as a checklist or as ambient guidance while you walk through the app as a real user would. Treat each `□` as a checkbox.

---

## Pre-flight (5 min)

- □ Open dev tools, keep Console + Network tabs visible the whole session — write down anything red
- □ Confirm Supabase function logs accessible in another tab (you'll want them when match-detected-bills fires)
- □ Have your phone ready (you'll test iPhone Safari + PWA install)
- □ Pick the email you'll use — Stripe + Supabase will both bind to it; if you might want to re-test, use a Gmail+ alias (`pauljohnson912+test1@gmail.com`)

## 1. Account delete + clean signup

- □ Delete current account → confirm `plaid_items`, `push_subscriptions`, `profiles` rows actually gone in Supabase
- □ Sign up fresh → does the trial card capture work? ($14.99/mo or $129/yr)
- □ Stripe checkout return flow → escape hatch fires correctly if session stalls
- □ Email confirmation — does it land? (will tell us if the recent Resend webhook + email_status changes work for new users)
- □ First-load: any console errors before you've done anything?

## 2. Onboarding

- □ Persona multiselect ("what brought you here?") — pick 2-3, do they save?
- □ Goals step — saves correctly?
- □ **Plaid connect** — institution picker → account selection → exchange completes
- □ Onboarding messaging on Plaid step is clear ("Connect your bank to auto-fill your bills, income, and categories.")
- □ Tour-mode demo score shows on first dashboard view
- □ Tour exit returns real (zero) numbers
- □ First-bill modal flow — naturally guides you to add a bill?
- □ Enter key advances through onboarding inputs

## 3. Plaid analysis wait

- □ After Plaid connect, recurring detection kicks off async — Activity tab shows "Able is still mapping..." skeleton
- □ How long until streams populate? (Plaid usually says "within an hour")
- □ Initial transaction sync runs — Activity tab populates
- □ Categorization quality — are bills correctly tagged vs discretionary?

## 4. Home hero (NEW: Balance label + bank dropdown)

- □ Label reads `BALANCE` (not "In your accounts")
- □ Bank-balances line below it: "Bank balances: $X across N accounts ▾"
- □ Tap to expand → each account with institution + mask + balance
- □ Drift indicator: edit manual balance to differ by >$50 → drift appears as colored "+$X vs. yours" or "−$X vs. yours"
- □ Reset drift → indicator disappears
- □ Reserved for bills + breakdown still works (regression check)
- □ Available to spend math correct

## 5. Bills tab (NEW: detected-bills banner + AI matcher)

This is the deepest test surface tonight. Two states to test:

**State A — empty bills list:**
- □ Connect Plaid, do NOT add any bills, go to Bills tab
- □ Banner appears: "Able found N recurring charges"
- □ Open modal → all streams should appear (no AI call since `bills.length === 0`)
- □ Save 5 streams → bills appear in list with correct cadence/category
- □ Banner count drops by 5 (from N to N-5)

**State B — manually add bills with semantic-mismatch names, then test AI:**
- □ Add bill: "Life insurance" $250 monthly (matches your Northwestern Mutual stream)
- □ Add bill: "Google storage" $9.99 monthly (matches Google One stream)
- □ Add bill: "Phone" $85 monthly (matches Verizon stream — easier semantic gap)
- □ Reload Bills tab → banner reappears
- □ **AI matcher should now hide Northwestern Mutual, Google One, and Verizon** from the modal
- □ Check Supabase function logs for `match-detected-bills`: should see one POST, status 200
- □ Confirm `usage` in logs shows reasonable token count
- □ If a stream you'd expect to be matched DOES appear in the modal → that's the AI miss; capture stream + bill name for prompt-tuning

**Regression on the modal itself:**
- □ Two groups render (Confident matches pre-checked, Less certain unchecked)
- □ Save button label updates ("Save 8 bills" → 0 → "These aren't bills — skip all")
- □ Save → bills appear with mapped categories (LOAN_PAYMENTS → debt, RENT_AND_UTILITIES → utilities/housing)
- □ Skipped streams don't reappear on next banner load
- □ Cancel → no changes persist

## 6. Bills functionality (regressions)

- □ Manually add bill, edit, delete
- □ Mark paid / unmark — funded bar updates
- □ Past-due banner if any
- □ Due-today card on home
- □ Catch-up button visibility
- □ Bulk reclassify (in modal, not toast — recent change)
- □ Floor strip on home reflects bill changes

## 7. Coach

- □ Coach panel opens, scroll-to-top works
- □ Three-dot typing animation
- □ Coach knows about: leak streams, recurring outflows, income channels, balance state
- □ Tone: empathetic when you ask a stress question ("I can't pay all my bills")
- □ Per-deposit framing surfaces ("every dollar gets a job")
- □ Coach handles a question that needs context — does it pull from your real Plaid data?

## 8. Score / story

- □ Score calculates from real data (not tour demo)
- □ Achievements grid renders
- □ Compact view sort: closest-to-unlocking first
- □ Distance text reads "X to go"
- □ Within-your-income habit row label honest
- □ Glossary tooltips on Floor + habit rings

## 9. Plan tab

- □ What-if at position #2 in sub-nav
- □ Forecast math sane
- □ Plan refresh banner if forecast stale

## 10. Push notifications (NEW: VAPID + iOS Safari message)

**Desktop Chrome:**
- □ Settings → push opt-in card → "Enable push notifications" button
- □ Click → browser permission prompt → grant → "On — this browser will receive..."
- □ Smoke-test from terminal:
  ```
  curl -X POST https://<your-supabase-ref>.supabase.co/functions/v1/send-push \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"<your-user-id>","title":"Test","body":"hello"}'
  ```
- □ Notification appears, click → opens correct deep-link

**iPhone Safari (regular tab):**
- □ Push card shows install instructions, NOT "your browser doesn't support"
- □ Wording is clear and actionable

**iPhone PWA (home screen):**
- □ Add to home screen → open from icon
- □ Push card now shows "Enable push notifications" button
- □ Grant → subscribed
- □ Real-world test: wait for `bill_due_tomorrow` trigger, or smoke-test from terminal

## 11. Settings

- □ Connected accounts list shows institution + accounts
- □ Disconnect bank → clean removal (transactions, streams, items all gone)
- □ Reconnect / update mode if a bank is in error state (force one if you can — disconnect from the bank's website)
- □ Demo mode toggle → persistent banner appears
- □ Email preferences save
- □ Plan/billing section accurate
- □ Sign out → returns to auth, no orphan state

## 12. Email cron behavior

- □ Per-user timezone — does today's email go out at the right local hour?
- □ Bounce handling — if you bounce one (use a clearly invalid forwarding rule for an instant), `email_status` flags

## 13. Tax features

- □ Quarterly tax projection card on home (if month/quarter triggers it)
- □ Tax Export card seasonality (only shows in tax-relevant months)
- □ Tax-related bills categorize correctly

## 14. Multi-bank

- □ Connect a second bank — does the "Connect another bank" copy/button-label appear?
- □ Bank-balances dropdown sums across both
- □ Each appears separately in Settings
- □ Disconnect one → other survives

## 15. Demo mode

- □ Toggle on → demo data populates, banner shows
- □ Toggle off → real data returns
- □ No data leakage between modes

---

## Discovery — open-ended things to look for

These don't have a checkbox; just keep them in mind.

- **Surprises**: any place the UI does something you didn't expect? Animations, modals, copy, transitions?
- **Friction points**: any step where you found yourself thinking "I'd give up here as a real user"?
- **Coach quality**: do its responses feel canned or actually informed by your situation?
- **Categorization misses**: any Plaid transaction that's clearly miscategorized?
- **Cadence misses**: any bill where the detected cadence is wrong?
- **Copy nits**: any string that reads jargon-y or off-brand? (Floor-First voice, no em-dashes, faceless brand)
- **Empty states**: any tab/section that looks broken when it should look intentional?
- **Loading states**: any spinner or skeleton that sticks too long or appears too often?
- **Mobile**: anything that breaks on iPhone width?
- **Race conditions**: things that load in a weird order?
- **Performance**: any noticeable lag on tab switches or save operations?
