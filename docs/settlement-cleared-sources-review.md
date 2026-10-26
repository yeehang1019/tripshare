# Hide cleared source bills — 26 October 2026

## Current behavior and correction

The bill-column summary excluded fully settled pairs, but still displayed older gross bill amounts and their matching Paid deductions when the pair owed for a newer bill. The TRX screenshot showed those historical values canceling correctly, so Remaining was accurate, but the paid bill column was redundant.

The summary now indexes signed applied cash by source expense ID within each visible pair. When that source's signed gross amount exactly equals its signed applied cash, it removes both the bill cell and that cash deduction from the presentation. Empty bill columns disappear. A column remains if another visible member still owes for that bill. Partial-source values and deductions remain, and opposite debts paid by reciprocal offset alone still appear as signed columns. Original ledger transfers, expenses, allocations and repayment history are unchanged. Print and CSV share this model.

## Verdict

- KEEP: canonical Remaining transfers, Mode A, source-bound payment replay, minor-unit arithmetic, history, undo and review warnings. Member projections remain authoritative; no full-data fallback. No server write, API/schema/dependency/audience/permission change or live data migration.
- CHANGE NOW: remove fully cash-cleared source cells together with their matching Paid amounts, rather than hiding a column while leaving its deduction. This preserves visible bill values minus visible Paid equals Remaining and avoids double subtraction.
- IMPROVE LATER: real account acceptance and native print/physical device verification are unavailable for this model-only change. Complexity remains linear over visible pair source/payment traces followed by the existing table matrix; no new database or network work.
- DO NOT ADD: expense deletion, fabricated repayments, supplier Paid-status shortcuts, global payment subtraction, or automatic creditor rerouting. Supplier payment and member repayment are distinct.

## Verification

54 focused settlement integration/SSR and experience checks passed, including screenshot-shaped TRX 31.32 already repaid plus song 35.40 and reverse Hotbird 27.46 leaving 7.94; omission in print/CSV and server-redacted member mode; another member retaining an unpaid source; undo restoring TRX; and one cleared source plus another partially paid source retaining only its applicable deduction. Prior partial/fully paid pair, reciprocal, direction-reversal, stale details, escaping and privacy cases pass. TypeScript and whitespace checks passed. Production build and built Worker smoke are packaging gates. No browser, live transaction, physical device or native print test was performed for this change.
