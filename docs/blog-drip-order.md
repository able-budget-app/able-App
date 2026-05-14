# Blog Drip Order — Spine-First Weave (52 weeks)

52 newly drafted articles, ordered for weekly Monday drop after the launch date.

Order is locked. **Launch date TBD** — when set, run a backfill script to assign `publish_date: YYYY-MM-DD` (Mondays only) starting at the launch date. The three calendar-sensitive items below should be hand-slotted to their right calendar weeks; the rest shift accordingly.

## Calendar-sensitive — hand-slot these first

- `holiday-season-budgeting` → first Monday of **October** (post the article 60 days before December spending starts so readers actually pre-fund)
- `year-end-financial-routine` → first Monday of **November**
- `the-yearly-strategy-day` → first Monday of **January** (post launch year + 1, or the second January if launch is mid-year)

## The 52-week sequence

### Phase 1 — Spine (W1–W4)
Open with the methodology, then the counter-frame, then the two pillars new readers will look up first.
1. `budgeting/per-deposit-method-explained` — Floor-First method spine
2. `budgeting/why-monthly-budgets-fail-variable-income` — counter-frame
3. `business/setting-prices-variable-income` — pricing foundation
4. `business/building-a-business-reserve` — reserve foundation

### Phase 2 — Tactical mechanics (W5–W12)
Income / expense / cash-flow mechanics every solo operator hits in the first 90 days.
5. `budgeting/surviving-a-slow-month`
6. `budgeting/handling-a-windfall`
7. `business/cash-flow-basics-service-business`
8. `business/invoicing-101-for-freelancers`
9. `business/bookkeeping-basics-for-solo-operators`
10. `business/business-banking-101`
11. `budgeting/the-good-month-rules`
12. `budgeting/tracking-recurring-charges`

### Phase 3 — Structure expansion (W13–W20)
The systems that make the spine durable.
13. `learn/how-money-works/emergency-fund-vs-business-reserve`
14. `business/scope-creep-defense`
15. `business/profit-margins-for-service-businesses`
16. `business/the-deposit-up-front-conversation`
17. `budgeting/saving-for-irregular-expenses`
18. `budgeting/the-mid-month-financial-check`
19. `business/end-of-quarter-financial-checkup`
20. `learn/how-money-works/setting-financial-goals-on-variable-income`

### Phase 4 — Entity / tax / structure (W21–W28)
The "I'm starting to think about this seriously" cluster.
21. `business/llc-vs-sole-prop`
22. `business/owner-draws-vs-salary`
23. `business/business-deductions-overview`
24. `taxes/estimated-tax-penalties-explained`
25. `taxes/sales-tax-basics-for-service-businesses`
26. `business/business-credit-cards-for-self-employed`
27. `budgeting/personal-vs-business-spending-line`
28. `business/finding-an-accountant`

### Phase 5 — Debt + financial psychology (W29–W36)
Debt mechanics + decision-making + recovery.
29. `learn/how-money-works/the-true-cost-of-debt`
30. `learn/get-out-of-debt/avalanche-vs-snowball-variable-income`
31. `learn/get-out-of-debt/negotiating-with-creditors-when-self-employed`
32. `learn/how-money-works/the-cost-of-a-financial-decision`
33. `budgeting/the-30-day-trial-mindset`
34. `budgeting/what-to-do-with-an-unexpected-deposit`
35. `budgeting/how-to-recover-from-a-financial-setback`
36. `budgeting/managing-cash-income`

### Phase 6 — Growth / advanced (W37–W44)
Pricing power, hiring, scale, health insurance, retirement.
37. `business/when-to-raise-your-rates`
38. `business/firing-a-bad-client`
39. `business/hiring-your-first-contractor`
40. `business/diversifying-revenue-streams`
41. `business/scaling-from-solo-to-small-team`
42. `business/networking-on-variable-income`
43. `business/retirement-saving-variable-income`
44. `business/health-insurance-for-self-employed`

### Phase 7 — Life transitions + calendar slots (W45–W52)
Couples / transitions / rest. Hand-slot the three calendar items into the right Mondays inside this phase.
45. `budgeting/couples-on-variable-income`
46. `budgeting/teaching-your-partner-the-per-deposit-method`
47. `business/transitioning-from-w2-to-self-employed`
48. `business/first-90-days-self-employment`
49. `business/sabbatical-or-extended-time-off-self-employed`
50. `budgeting/holiday-season-budgeting` *(calendar-sensitive — slot into October)*
51. `business/year-end-financial-routine` *(calendar-sensitive — slot into November)*
52. `business/the-yearly-strategy-day` *(calendar-sensitive — slot into January)*

## Backfill script (TBD)

When launch date is set, a tiny script reads this file, walks the 52 markdowns, and writes `publish_date: YYYY-MM-DD` into each frontmatter. The three calendar-sensitive items get their absolute Mondays first; the others fill the remaining Mondays in sequence.

## Drip mechanism

`scripts/build-resources.py` was patched to skip articles where `publish_date > today.isoformat()`. Each Monday, a Netlify build trigger re-runs the builder, the day's article appears in `<cluster>/<slug>/index.html`, and the YouTube video (scheduled to public on the same date) embeds via `youtube_id:` in the frontmatter.
