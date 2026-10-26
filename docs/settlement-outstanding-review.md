# Remaining settlement summary — 26 October 2026

## Current flow and correction

The previous popup combined consumption from all bills, even though the ledger's transfer list already deducted applicable source-bound repayments and reciprocal pair offsets. The user confirmed that the popup should only answer who still pays whom and how much. The active popup now uses that existing transfer list, scoped to Full/Mine or the server-authorized personal projection. One From / To / Remaining table feeds both the screen, CSV and isolated print document. Fully paid pairs disappear; partial payments leave only the remainder. No second payment subtraction or consumption-derived debt calculation occurs.

## Review and verdict

- KEEP: original expense/payer allocations, repayment history, pairwise Mode A ledger, server authorization and group isolation, revision/CAS and payment idempotency. No API, database, dependency, permission, audience or production-data changes. Reading/printing/exporting never writes financial records.
- CHANGE NOW: remove the active consumption matrix and collapsed duplicate final-payment section. Share the scoped remaining rows across table, print and CSV. Positive safe-integer non-self transfers only; empty rows say All settled only when no unapplied-payment review amount exists. Preserve review warnings instead of treating unmatched historical cash as settlement of a newer expense. Archived matrix/single-bill exports remain unmounted for compatibility.
- IMPROVE LATER: native print pagination and physical handset acceptance are unverified in this release. Existing source ledger replay remains the first likely bottleneck; this view performs a linear filter/sum of derived transfers and does not recalculate every bill. Extremely large transfer tables may eventually need measured pagination.
- DO NOT ADD: fabricated payment records, automatic confirmation, group-wide rerouting, another settlement mode, or rebuilding obligations from consumption totals.

## Verification

56 focused ledger integration/SSR and existing settlement/experience checks passed. New cases verify A100/B50 reciprocal offset, full-pair exclusion, a partial C→A payment leaving RM13 without double subtraction, all-settled then undo, Mine and redacted personal scope, HTML escaping and unmatched-payment warnings. TypeScript passed. Production build and built Worker smoke are packaging gates. No live bill/repayment, signed-in production interaction, browser/device or physical printer test was performed.
