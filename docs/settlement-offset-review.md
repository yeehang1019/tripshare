# Cash and dated offsets — 27 October 2026

The user explicitly approved cash-first, date-ordered pairwise offset explanations, separate post-payment and final balances, Partially offset status, dynamic reallocation notice, and final-due-only reminders/summaries. Ship this as a separate release, stop for review, then undertake the separately authorized N+1 work. No database migration or changes to existing user records.

## Behavior and files

- `lib/settlement-display.ts`: immutable derived rows keyed by bill/direction; Applied is nonnegative source-bound applied cash, afterPayment = share − Applied. Offset is the smaller directional afterPayment total, assigned independently on both sides oldest date first, then codepoint bill ID. Final due = afterPayment − Offset. Full offset -> Settled by offset, partial offset -> Partially offset; the underlying cash status remains separate. Check every derived total against canonical PairCalculation remaining values. Explicit supplier credits remain separate positive reverse credits rather than negative Applied; excess unmatched cash remains a review warning.
- `app/settlement-calculation.tsx`, `app/globals.css`: one pair net row at top, four bill metrics, accessible inline explanation of dynamic ordering, fully offset sources in a disclosure. Desktop table / mobile cards, paged at 30 source rows. Fully cash-paid history stays in existing payment history instead of reappearing as unpaid sources.
- `lib/settlement-recording.ts`, `app/settlement-payments.tsx`: selectable source amounts use the same date-derived final dues. The server independently recomputes them before existing atomic/CAS confirmation, preventing the screen from offering sources rejected by insertion-order claim allocation. This changes only derived source availability for future explicitly confirmed records, never existing allocations or canonical pair balances. Original source obligations bound actual cash; canonical ledger implementation unchanged. User-selected partial amounts continue to allocate in the displayed chronological order.
- `app/trip-app.tsx`: WhatsApp/reminder lines use final-due transfers. Copy list and bill-filtered Remind use the same date-derived final source sums, capped at canonical pair net. PersonalMoney, dashboard/Who pays whom, all-group and Settlement totals already use canonical final transfers and retain that source.
- `app/settlement-summary.tsx`, `lib/settlement-outstanding.ts`: existing bill-column matrix/Print/CSV and final totals retained. A signed internal net cash term is now presented as a Repayment adjustment, added to signed bill columns, instead of a misleading negative Paid. Active Paid/Applied fields never display negative amounts. Summary amounts remain final due; opening/printing/exporting records no cash.

## Regression evidence

227 tests passed across the full suite (`node --experimental-vm-modules --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`). TypeScript, whitespace and standalone production build passed; built Worker smoke is checked separately. The user explicitly approved publication on 27 October after reviewing the numbers. Retain saved v75 as rollback, then verify actual production Mine and source amounts plus generated reminder/WhatsApp text after deployment. Preview screenshot checks alone are not production acceptance. N+1 remains deferred until the next explicit phase confirmation.

The deidentified pair-only fixture in `tests/fixtures/kl-house-pair.mjs` preserves the 19 audited ET/YH directional source obligations and six payment/reversal records, with no account IDs/email or other pairs. It is a reproducible projection, not a production backup and not an assertion about unrelated members. `tests/settlement-display.test.mjs` verifies the real RM32.80 food split; toll RM33 split; RM346.14/RM329.74 directional residuals; RM16.40 canonical final net; partial/full/excess/undone cash; zero and partial offset; deterministic same-date ties independent of insertion; FX minor-unit rounding; explicit refund credit; reminders and summary totals. Adding a reverse RM20 source changes the net to YH→ET RM3.60, reassigns old offsets, and row final dues still sum to net. Server source-choice regression covers chronological vs insertion order, immutable preparation and safe source-bound confirmation. Existing permissions, isolation, concurrent CAS, idempotent retry/undo and transaction rollback tests continue to pass.

| Row | Applied | After payment | Offset | Final due | State |
|---|---:|---:|---:|---:|---|
| food · 20/10 | RM0.00 | RM16.40 | RM0.00 | RM16.40 | Unpaid |
| toll · 25/09 | RM15.58 | RM0.92 | RM0.92 | RM0.00 | Settled by offset; cash Partially paid |

Before: pair row mixed net applied cash from unfinished sources into Paid (net) RM−15.58, labelled Partially paid. After: pair row is solely ET→YH RM16.40; source cash/offset/final values reconcile separately.

## Browser checks and limits

Actual client components were rendered with the deidentified audited pair in temporary local routes. Browser iframe viewports 1280×800 and 375×812; document widths showed no horizontal overflow (desktop client1280/scroll1265; phone client360/scroll360 within 375 including scrollbar). Expanded food and offset-settled toll match the values above. A local callback verified Remind produces RM16.40; Record payment opens with food only and max RM16.40; cancelled without confirming. No real money/API writes or messages were made. Screenshots in `docs/screenshots/settlement-offset-{desktop,mobile,toll}.jpg` are exact 1280×800 / 375×812 previews, not physical handset tests or production screenshots. Temporary QA routes removed before build. Native device, live recording, system print dialog and browser WhatsApp send not tested.

## Review

Authorization: existing server/member projections unchanged; no new data access. Ledger corrections/undo and immutable original audit preserved. Concurrency/idempotency/atomicity stay under existing CAS/server validation. No schema migration, backfill, balances rewrite or fake repayment. Failure to reconcile disables source derivation instead of inventing attribution; unmatched cash warnings remain. First likely cost is repeated per-pair derived sorting and existing UI pair lookups; no speculative query/cache changes in this release. N+1 and cold/regional timing remain the next independent phase, not completed here.

KEEP: original data, canonical balances, permissions, detailed functions and themes.
CHANGE NOW: separate positive Applied, dated Offset and final due; consistent actions and statuses, completed.
IMPROVE LATER: independent N+1 phase and physical device review after user confirmation.
DO NOT ADD: migrations, global rerouting, automatic payments, or mixed performance changes.
