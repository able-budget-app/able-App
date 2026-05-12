# Able Roadmap — Locked Decisions
*Saved 2026-04-29 02:12 from ROADMAP.html — 7 of 7 decided*

> This file is the contract for Phase 1. Edit via ROADMAP.html (auto-saves to browser localStorage), then click **Save to file** to download a fresh copy.
> Claude reads this file at session start to pick up Paul's locked answers and notes.

---

## D1 — Plaid integration & onboarding intake
**Status:** ✅ Decided

- **D1.1** — Show live bank balance on the dashboard → `Yes`
- **D1.2** — Pull transaction history at signup so the Analyzer can detect recurring deposits + bills → `Yes`
- **D1.3** — Lookback windows to OFFER the user at signup (pick all that apply, max 24mo per Plaid) → `6 months, 12 months, 24 months` *(refined 2026-04-29: 3mo dropped, 24mo added — Plaid recommends ≥180 days for recurring detection)*
- **D1.4** — Default lookback (the option pre-selected on the screen) → `6 months`
- **D1.5** — Should our AI re-categorize transactions on top of Plaid’s labels (e.g. "Verizon" → "phone bill" not "utilities") → `Yes (v1)`
- **D1.6** — When Plaid sees a bill charge, auto-mark that bill paid? (B.3 — adds detection-error risk) → `Defer Q3`
- **D1.7** — Keep manual entry path after Plaid ships (for privacy-first users) → `Keep both paths`
- **D1.8** *(added 2026-04-29)* — Live balance refresh policy → `Cached only (no on-demand /balance/get) until Business plan` — pay-as-you-go bills per balance call

---

## D2 — Pricing direction
**Status:** ✅ Decided

- **D2.1** — What’s the price for the Plaid + Analyzer + Tax v1 launch → `Hold $14.99/mo + $129/yr`

---

## D3 — Tax bucket depth
**Status:** ✅ Decided

- **D3.1** — Tax bucket: keep simple savings bucket, or first-class with quarterly projections → `Elevate to first-class (quarterly projections, due dates, dashboard line)`

---

## D4 — Household / partner access
**Status:** ✅ Decided

- **D4.1** — Should two people on the same household be able to share an Able workspace → `Defer to Q3`

---

## D5 — Methodology name & rules
**Status:** ✅ Decided

- **D5.2** — If adopt — which name → `The Able Method`
- **D5.3** — Custom name (only if you picked Custom above) → `Floor-First Budgeting`
- **D5.4** — The 5 rules of the methodology (edit the straw man freely)
    >   1. Know your floor — bills + tax = the amount you can't miss                  
    >   2. Every deposit fills the floor first — not month by month, deposit by       
    >   deposit                                                                     
    >   3. Build your reserve before you spend — slow months get paid by the reserve,
    >   not by next month's panic *(updated 2026-04-29: was "Smooth before you spend")*
    >   4. One month ahead = Able — when you've reserved next month's floor, you've   
    >   arrived                                                                    
    >   5. Score reality, not the plan — the month is judged on what happened, not    
    >   what you intended   

**Notes:**
> What is Floor-First Budgeting?                                                
>                                                                               
>   Floor-First Budgeting is a money method for people whose income doesn't land  
>   on the 1st of the month. Freelancers. Creators. Business owners. Anyone paid  
>   in deposits instead of paychecks.                                             
>                                                                                 
>   The premise is simple: before any dollar gets to vote on dinner, it has to    
>   cover the floor — your bills and your taxes. That's the amount you can't miss.
>    Everything else is downstream.                                               
>                   
>   Most budgeting tools are built around a monthly cycle. You sit down on the    
>   1st, divide what you have, and hope the math holds. Floor-First doesn't work
>   that way. Every deposit — $400 or $4,000 — gets allocated the moment it lands.
>    The floor fills first. Smoothing fills next. Free spending is what's left.
>                                                                               
>   The five rules:
> 
>   1. Know your floor — bills + tax = the amount you can't miss
>   2. Every deposit fills the floor first — not month by month, deposit by
>   deposit                                                                       
>   3. Smooth before you spend — variable income gets averaged before free money
>   exists                                                                        
>   4. One month ahead = Able — when next month's floor is already reserved,
>   you've arrived                                                                
>   5. Score reality, not the plan — the month is judged on what happened, not
>   what you intended                                                             
>                   
>   Rule 4 is the destination. When next month's floor is reserved before next    
>   month begins, you're a month ahead of the panic. Most people call that moment
>   relief. We call it being Able.

---

## D6 — Analyzer scope
**Status:** ✅ Decided

- **D6.1** — How smart should v1 be → `LLM-suggested v1 (AI proposes, user accepts/edits)`

**Notes:**
> I think when the hit "tell me where it goes" the analyzier (which is the coach) looks at tendancies all around and says here where you hsold put it. suggests it all kinda how we have it laid out, then they can confirm the plan, when they do it prompts them to go account for those changes - move money, pay bills etc and comeback to mark thes off. the API call spend will be small and worht it cuz no one else does this.

---

## D7 — Brand revisions before lock
**Status:** ✅ Decided

- **D7.1** — Refine the brand before locking, or lock as-is → `Refine first (3-5 days), then lock`
- **D7.2** — If refining — what specifically? (wordmark variants, color shift, type, motion, photography rules…) → `We locked this in a claude code convo. `

---

_End of decisions. To update: open ROADMAP.html, edit, click Save to file._
