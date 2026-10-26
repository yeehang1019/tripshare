# Settlement bill columns — 26 October 2026

## Behavior and data flow

The approved summary still displays only pending pairwise transfers. Each pending From→To row now has dynamic columns keyed by expense ID and labeled by bill name/date. Existing PairCalculation gross source obligations are oriented to that row: forward amounts are positive, reverse amounts negative. Applied repayments are shown in a separate Paid column when any visible row has a nonzero net payment. Thus signed bill values minus Paid equals the existing Remaining transfer amount. The ET/Reyes example is 35.40 − 27.46 − 5.00 = 2.94. If earlier applied cash runs in the reverse direction of a later outstanding balance, Paid is negative; the print note explains the resulting credit.

The summary never modifies transfers or records. Original source-bound cash application, pairwise netting and source-edit/deletion review behavior remain in the ledger. Full/Mine receives existing calculations; member mode uses only the server-authorized personal calculations and never falls back to a full expense ledger. Only source metadata from visible pending pairs supplies columns; duplicate titles retain separate IDs. Signed attribution is checked against the existing remaining amount. Missing/stale details show Unavailable and a warning rather than fabricated zeros. Unapplied cash is never represented as applied payment.

## Verdict

- KEEP: Mode A, integer money, full/partial/undo payment history, existing source-bound replay, authorization, group isolation, CAS/idempotency, themes and one popup entry. No schema, API, audience, permission, secret, live record or dependency change.
- CHANGE NOW: bill columns and conditional Paid column in table, Print and CSV, with identical scoped values. Fully paid rows stay excluded. Dates disambiguate bills; all values use settlement currency. Print continuations retain every column and label repeated Paid/Remaining totals. Local popup primary-button/date text token fixes ensure print and date labels remain readable outside inherited theme wrappers.
- IMPROVE LATER: physical device and native printer/PDF pagination acceptance remains unverified. For very large groups, the first new cost is a visible pending-row × bill-column matrix; source pair lookup is indexed and existing calculations are reused. Measure before virtualizing or splitting the table.
- DO NOT ADD: new payment allocations, paid-off rows, free group rerouting, a second ledger, another tab or bill selector.

## Verification

60 focused integration/SSR and existing settlement/experience checks cover reciprocal debts, exact ET/Reyes example, RM5 partial payment, fully paid exclusion, undo, direction reversal and signed prior cash, changed/deleted source review, duplicate titles, stale attribution, print escaping, wide continuations and scoped personal columns. TypeScript, whitespace, production build and built Worker smoke are release gates.

Browser fixture QA used invented records only and was removed before packaging. Desktop showed Hotbird 35.40, Karaoke −27.46, Paid 5.00 and Remaining 2.94. A 390px embedded viewport showed internal table scrolling (326px available / 601px content) with a bounded dialog and readable visible Print/CSV buttons. The isolated print document retained all three fixture bill columns and exact totals. No production bill/payment, signed-in live transaction, physical phone or native print action was performed.
