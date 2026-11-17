# Expense clarity and release review — 17 November 2026

## Scope and flow

Current flow: new ordinary expense → amount, description/date, business payer, category and consumers → preview showing who will owe whom → save → canonical settlement → select one or multiple payment pairs → source bills and amount/date → confirm → refresh/undo. The amount and entry mode stay in the sticky header. Selected bills default to full outstanding amount; unchecking recalculates that amount; direct partial entry needs no mode toggle. Switching payment groups retains edits. No new navigation or nested financial card design was added.

Corrected the actual misleading display: a postpaid expense previously said “Paid by ET” even when ET had not paid the merchant. The list now distinguishes business unpaid, partial business payment, advance payment, PayLater and cancellation. Existing status and balances are retained. Ordinary new expenses already defaulted to paid; this release moves special timing behind an advanced disclosure with explicit business-payment labels. It does not automatically change the user's existing breakfast record. Also fixed “1 people”.

## Verification

- Complete existing suite plus regression additions:296/296,0 failures,0 skips. Includes canonical arithmetic/rounding, allocations, permissions/tenant isolation, APIs, payable projection/retry, supplier instalments, refunds, PayLater, payment failures403/409/500, partial payment, undo and production Worker anonymous/API smoke.
- Production build and TypeScript passed. `git diff --check` passed. Ledger, canonical settlement recording, personal projection, API and DB source unchanged.
- Browser: real components with synthetic QA Test data only, embedded375×812/1280×812 layout viewports in Light/Night. Expenses, editor and settlement each: horizontal overflow false; visible text below12px0; clickable targets below44px0. This is desktop-browser responsive layout QA, not physical iPhone testing.
-26-bill fixture:20 initial rows;23 eligible ET sources plus another recipient. Selecting both gives52.70; unchecking6.70 gives46.00 overall and44.00 for ET. Switching to YC and back retains unchecked source and44.00. No real or preview payment submitted. Merchant-unpaid and advance bills remain excluded from friend settlement as before.
- Desktop payment dialog computed backdrop32px, no overflow. No new blur layer or animation added; previous material/fallback and reduced-motion logic retained. Phone expanded-bill long-list and actual touch-device scrolling remain hardware verification limits.
- Client JS gzip sum283789bytes; no runtime dependency added. Added/changed runtime source lines including unchanged surrounding one-line JSX total7673bytes, below40KB even before compression. This is a source upper-bound check, not a claimed exact v125-to-new production gzip delta.

## CI and lint debt

No remote GitHub Actions/hosted CI configuration exists in this repository. Local reproducible gate is `npm run verify`: production build, full tests (concurrency2), types and lint-regression check. Sites packaging/publication is the CD step. Do not describe local execution as an external CI run.

Strict ESLint has330 pre-existing errors:237 explicit-any,45 JSX text escaping,36 compiler set-state-in-effect diagnostics, and12 remaining const/compiler/link diagnostics. Existing debt is real and strict `npm run lint` still fails. Current changes add0 errors. Baseline was independently generated from pushed v125 source. The separate comparison gate retains strict rule configuration, checks diagnostic counts per file/rule/message, rejects new errors and always rejects fatal parses. Probe with a new explicit-any file was rejected, then removed. This count-based gate cannot prove that a same-kind error was not exchanged for another within the same file; code review and tests remain necessary. Baseline is not a waiver of runtime correctness, access or financial tests. Remediation should be incremental rather than a broad backend rewrite in this UI release.

## Findings and verdict

- **MEDIUM — misleading merchant payment label →** user interprets merchant-unpaid as friend-unpaid → unconditional stream label → fixed with presentation-only helper using existing calculated status.
- **MEDIUM — confusing ordinary entry →** unnecessary merchant timing decision → merchant and friend concepts shared vague “Payment status” copy → advanced disclosure and explicit labels; historical states preserved.
- **MEDIUM — unreliable test infrastructure →** watcher exhaustion/stale UI failures obscure regressions → each test starts a watching Vite server and old controls were still asserted → disable test watchers, bound concurrency and assert current selected UI. Financial assertions retained.
- **MEDIUM — historical strict lint debt →** weaker maintainability/type confidence → legacy source predates compiler lint rules → retained strict report, baseline comparison with zero new errors, targeted future cleanup. No runtime/security/financial regression found by this release's tests; lint debt is not claimed fixed.

**KEEP:** canonical calculations, server permissions, one expense form, sticky amount, selected-source default full amount, direct partial input, group edit persistence and undo/error recovery.

**CHANGE NOW:** misleading paid label and ordinary business-timing presentation; failing/stale test harness. Implemented and checked.

**IMPROVE LATER:** strict lint cleanup; physical iPhone VoiceOver/keyboard/touch-scroll review; wire the same verify command to external CI if a remote CI provider is adopted. First likely UI performance issue remains full expense collection/projection work before20-row rendering; don't add virtualization without measuring it.

**DO NOT ADD:** automatic conversion of historical merchant-unpaid bills; repayment-generated duplicate spending; new payment schema; backend changes or guessed member identity; new OCR/AI flows incidental to this fix.

## Optional product suggestions (not implemented)

1. Contextual “Why isn't this in Settle up?” beside business-unpaid/advance status, explaining the exact existing reason without changing it.
2. Before batch confirmation, concise per-recipient payable total with retained selections (further polish of existing review, not another competing payment entry).
3. Sync-health link from Pocket Ledger to a read-only reconciliation view with retry/error details; reuse existing sync events rather than adding a second source of truth.
