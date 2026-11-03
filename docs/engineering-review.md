# v93 — Trip finance stays in Trip

Separate workspace context from shared financial tab IDs; canonical financial data/rendering reused. Trip desktop secondary links expanded, Money direct links verified. 246tests + TypeScript + production build pass. v92 rollback retained, no ledger/API/schema edits. See v93-trip-finance-context.md for verification and KEEP/CHANGE NOW/IMPROVE LATER/DO NOT ADD verdict. Stop after this release; copy table before3b.

# v92 Trip outer navigation

Approved Trip five-entry navigation and permission-filtered More. Same-group Money destinations; no API, ledger, role or schema edits. TypeScript and full244 tests pass. Fixed snapshot food1640/toll0/offset32974eachway/ET→YH1640 remains unchanged. v91 saved version/archive retained for rollback. Actual live browser verification follows publication; exact viewport resizing unavailable. See phase3a-trip-v92.md. System lighting deferred3b; header<=160px deferred3c; copy table review before3b. KEEP existing data/roles/calculation; CHANGE NOW approved Trip navigation; IMPROVE LATER assigned later phases; DO NOT ADD unrelated features.

# Phase3a Money navigation — v91

See [review](phase3a-review.md) and [full242-test output](phase3a-tests.txt). Money outer navigation only, Dashboard5inner tabs retained.242tests/types/build pass. Live URL/back/tools checks pass. v90 rollback retained. Live revision108 contains a pre-deployment RM31.64 repayment, so ET→YH is now0 and YC→YH51.70; v90/v91 full ledger outputs on identical revision108 data are deep-equal. Historical1640sen fixture still passes. Real light/dark screenshots1348×926 only; exact375×812/1280×800 acceptance remains unverified due browser resize limitations. Trip proposal awaits confirmation. KEEP data/arithmetic/permissions; CHANGE NOW Money navigation; IMPROVE LATER exact viewport verification and separately approved Trip/copy work; DO NOT ADD3b/3c or migrate data.

# v90 loading follow-up — complete

See [v88–v90 report](v88-v90-review.md) and [20-sample evidence](v88-v90-samples.json). Three independently deployed phases completed. Current live v90; rollback v89. Actual refresh30454/63ms, unread count85/92ms and list90/102ms (p50/p95),1 DBcall each. Previous notifications446/487ms,6calls. Actual browser confirms44 updates and net RM16.40.58 API checks, types/build/Worker smoke passed; cache/concurrency regression tests passed. No financial-data writes, outgoing messages or schema migration. Embedded JSON parsing and platform HTML delay remain explicit limits. KEEP history/auth/features; CHANGE NOW scheduling/cache/query changes shipped; IMPROVE LATER audit storage only after approval; DO NOT ADD more scope. Stopped for review.

# v87 scoped read / early304 release

See [v84–v87 review](v84-v87-review.md) and [production samples](v84-v87-samples.json). Final live v87 fixes a directory-placeholder regression after immediate rollback to v85. Twenty samples per set: v84 142/383ms, v85 119/381ms, v87 normal71/320ms, v87 30432/83ms (p50/p95). Final normal and unchanged304 use one DB call. Current rollback target v85. Platform ingress delay and ineffective compression remain documented limits. No migration or notification work. Stopped for review.

# v80 N+1 release

See [N+1 review](nplus-review.md) and [20 production samples](nplus-samples.json).55 API tests, full response equality,5-call budget, TypeScript/build/Worker smoke passed. KEEP auth/data/projection; CHANGE NOW batching shipped; IMPROVE LATER further loading work; DO NOT ADD unrelated features. Guaranteed cold-isolate measurement remains unavailable.

# v78 pending-bill summary

KEEP: canonical pairwise balances, payment allocations/history, permission scope and v77 rollback. CHANGE NOW: summary uses reconciled pairSettlement finalDue only; nonpositive bills and adjustment columns excluded from UI/print/CSV/share/copy. Offset disclosure uses one-direction amount with each-way label; summary links to pair Details. IMPROVE LATER: N+1 remains separate pending review. DO NOT ADD: migrations or data edits.

Tests cover audited KL food-only RM16.40, offset14/329.74 each way, confirmed payment removal, personal isolation, stale attribution, source edits and nonnegative reconciliation. Browser exact viewport resizing remains unavailable; real production screenshots must report actual dimensions.

---
# Settlement display polish (v77)

English labels now match across calculation, recording, summary, print and CSV. Offset-cleared bills remain a native closed disclosure with their combined Offset amount; payable bills remain above it. Mobile settlement pages reserve 180px plus safe-area bottom clearance (53px add button sits 94px above viewport bottom). No ledger, API, storage or user data changes. v76 remains the saved rollback version.

KEEP: canonical balances, permissions, payment history, all functions and themes. CHANGE NOW: language, disclosure total and mobile clearance. IMPROVE LATER: N+1 in its independent approved phase, only after this review. DO NOT ADD: migrations or query changes in this patch.

Validation: focused settlement/UI tests, TypeScript, production build. Production viewport screenshots are limited by the current browser API, which has no resize capability; do not label cropped desktop captures as mobile screenshots.

---

# Settlement cash/offset display — 27 October 2026

The current release separates cash Applied, post-payment remaining, chronological dynamic Offset and Final due, with one pair net and consistent selection/reminders. See [offset review](settlement-offset-review.md) for arithmetic, test cases, changed files, preview screenshots and limits. N+1 remains a separate next phase.

# Loading performance measurement — 26 October 2026

v75 is published and both endpoints now have 20 deduplicated, matching five-group samples. See [measured results](loading-performance-results.md) and [numeric sample evidence](loading-performance-samples.json). This is measurement only; lower values across different network routes are not optimization gains. N+1 is the first proposed fix. Await user confirmation before optimization.

The current release only instruments the two read APIs; optimization and migrations await measured findings and user confirmation. See [loading performance review](loading-performance-review.md). No frontend, data or financial changes.

# Print summary — 26 October 2026

The latest three screenshots narrow the work to compact settlement presentation: collapsed cross-group overview, compact linked Trip/status/tools launchers and list-style payment rows with expandable Details. See [density review](settlement-density-review.md) for scope and browser/check results. Financial behavior from the recording release is unchanged.

The latest selected work adds current-only Calculation and selected-bill atomic batch recording, recipient grouping/bill filtering, explicit save/Undo receipts and a bounded mobile dialog. Search, additional personal-direction filters and remembered dates/methods were explicitly excluded. See [settlement recording review](settlement-recording-review.md) for architecture, authorization, concurrency, recovery, compatibility and verification limits.

The latest TRX correction removes fully repaid source cells and their matching Paid deductions from pending rows, hiding empty bill columns while preserving canonical Remaining amounts. Screen, Print and CSV share scoped values. See [cleared sources review](settlement-cleared-sources-review.md) for current checks and limits, and [bill columns review](settlement-bill-columns-review.md) for the retained signed-column behavior. The earlier [remaining settlement review](settlement-outstanding-review.md) and [combined popup review](settlement-popup-review.md) document superseded presentation stages.

See [print summary review](settlement-print-review.md) for this release's scope, checks, privacy and remaining verification.

# Planner expansion review — 2026-10-19

## Current behavior and flow

A signed-in request is resolved to the existing TripShare account and authorized against the selected group. Trip records remain revisioned JSON in D1. Plan changes, including template batches, validate on the server, update with a revision compare-and-swap, and enter the existing audit history. Money consumption and repayments are unchanged.

- Flight local date/time + explicit departure/arrival IANA zones → verified UTC instants → duration, overlap checks and calendar times. Daylight-saving gaps fail; repeated times require an explicit earlier/later choice. The local arrival date may precede departure across the date line if UTC chronology is valid. Existing flights without explicit zones remain editable; export/transfer comparison asks for the missing zones instead of guessing.
- Transfer source plan + its end time + entered travel/buffer minutes → advisory connection warning. Traveller lists must overlap for the comparison. Maps links open externally; the app does not fetch live traffic or bill for a routing API.
- Personal day/trip itinerary template → date-shifted preview → confirmed people → one atomic plan batch. Booking credentials, contacts, access, actual bills and waiting lists are excluded. The batch appends and never replaces existing plans. Stable preview IDs make an identical retry a no-op, including after an uncertain network response. A competing changed batch is rejected, with the preview retained.
- Capacity and ordered waiting list are organizer-managed planning fields. Promotion is explicit and is saved with the plan, not a self-service RSVP. No Money split changes automatically.
- Private preferences → account + group + current member binding → separate D1 row, own revision and API. Only the author and current trip owner can read. A planner/admin with full group viewing cannot read another member’s answers. Unlinked/revoked/inactive members are denied. Reassigned member identities do not inherit old answers.
- Calendar → manual Google add-event link per plan or Apple-compatible .ics selection. No OAuth, invitations or automatic external writes. No claim of subscription or two-way synchronization. Cancelled plans and booking references are excluded, UTC output handles independent flight zones, stable UIDs and RFC line folding protect file structure. Importers can still create duplicates; the UI discloses this.
- Offline pack → current trip access check + individually authorized selected booking downloads → local store-only ZIP. Includes the handbook and optionally a calendar file. Any file failure cancels the full pack. Ten booking files / 19.5 MB attachment selection / 20 MB total ZIP payload are enforced. No preferences or Money records are exported. Downloaded copies cannot be revoked.

## Challenge and corrections completed

| Priority | Problem → impact | Root cause → implemented fix |
| --- | --- | --- |
| HIGH | Airport clock strings can misorder a flight or a connection | Compare real instants with independently entered zones, validate date-line arrivals and handle DST ambiguity explicitly. Never infer missing flight zones. |
| HIGH | A template retry could duplicate the itinerary | Stable preview plan IDs, exact existing-batch detection before stale revision rejection, collision rejection and atomic CAS. A queued SQLite test harness models serialized D1 batches for concurrency tests. |
| HIGH | Private answers in shared trip data would leak to admins/exports | Separate permission-checked storage, author account binding, owner-only aggregate reads and negative tests covering group/shared APIs and identity reassignment. |
| MEDIUM | Adding all tools eagerly increases initial work and bundle size | Lazy-load tool panels. Fetch only template metadata for the list and fetch one template for preview. Paginate the owner’s private-answer view using the existing six-row workbench. |
| MEDIUM | Searching a calendar list could regenerate an entire calendar on every keystroke | Memoize selection and file generation independently from the search query. |
| MEDIUM | Repeated zone formatting and relationship scans increase save/render cost | Bounded timezone/day/instant caches and per-validation ID maps replace repeated Intl work and activity-array scans. |
| MEDIUM | Slow/partial downloads or large payloads can freeze or confuse a phone | File/byte limits, progress/cancel, a 60-second overall pack timeout, no compression, and whole-pack failure rather than silent omissions. |
| MEDIUM | Storage failure masquerading as bad user input obscures recovery | New APIs distinguish validation 400/413 from storage 503, preserve draft input, return an opaque request reference and log the failure without returning SQL or submitted answers. |

No new CRITICAL issue was identified in the inspected flows. This is not a claim of an exhaustive security audit.

## Validation

117 focused checks cover existing finance/permissions/sync behavior plus UTC conversion, DST gaps and ambiguity, date-line flights, transfer buffers, return creation, template stripping and shifting, member capacity, ICS/Google link encoding and boundaries, independently verified ZIP readability/checksums, API isolation, stale writes, batch concurrency/idempotency, preference reassignment/revocation, schema cascade behavior and traceable storage failures. TypeScript and the production build are required before publication.

Browser/device verification is UNKNOWN: actual Google/Apple account import behavior, iPhone browser file handling, modal focus/keyboard behavior and the real phone memory/performance profile have not been exercised in this managed environment. SSR checks are not end-to-end browser tests.

## Migration and recovery

Migration `0009_solid_shen.sql` adds only `plan_templates` and `trip_private_preferences` (the latter cascades on its own trip deletion). Existing tables and financial data are not rewritten. Keep both tables during rollback; dropping them would discard user-created data. Calendar and pack actions do not alter server financial records. Preferences and templates have independent optimistic revisions; financial sync keys/cursors are unchanged.

A rollback to v50 is not fully write-compatible once a local-arrival-before-departure flight has been saved: the older validator rejected those date-line flights. Preserve the new timezone/date validator in any rollback build, or inspect affected flight records first; never “repair” this by silently rewriting their dates. Existing audit restore may reject an old planning snapshot whose linked counterpart was removed; the error keeps current data unchanged, and links can be reviewed explicitly.

## Verdict

- **KEEP:** independent Trip/Money boundaries; server authorization; owner-only membership management; original expense identity, preserved incurred dates on payment-status updates and sync history; approved hybrid themed layout.
- **CHANGE NOW:** fixes above are implemented. Production publication waits for the full regression suite, TypeScript and build; unavailable browser checks remain explicitly disclosed.
- **IMPROVE LATER:** test real Google/Apple imports and a phone offline pack; profile initial authenticated group payloads and the existing large workspace bundle before adding server pagination or further code splitting. A full template editor, checklists inside templates, live traffic and automatic calendar synchronization require separate scope.
- **DO NOT ADD:** time polls/RSVP for now, AI/OCR/voice, commercial ticketing, automatic bill creation or calendar write permissions as side effects of this release.

## Official interoperability references

- https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events — pre-filled add-event URL and independent timezones; manual copy cannot be updated without calendar access.
- https://support.apple.com/en-my/guide/calendar/icl1023/mac — .ics import on Mac.
- https://support.google.com/calendar/answer/37118?hl=en — calendar import.
- https://developers.google.com/maps/documentation/urls/get-started — cross-platform Maps URLs, URL encoding/size limits, no API key needed.

# Workflow expansion — 2026-10-19 (v52)

## Shipped scope

The user approved the remaining nine suggestions and explicitly excluded repayment evidence / receipt confirmation. The three existing themes and independent Trip/Money navigation are retained. New panels extend the existing toolbar and focused sheets; no new overall design variant was introduced.

| Area | Entry point / resulting behavior |
| --- | --- |
| Browser draft recovery | Expense and itinerary editors debounce local draft saves, flush on pagehide/visibility loss/beforeunload, and offer a comparison with the latest loaded authorized record before recovery. Seven-day expiry, at most ten drafts per account/group, 250k-character record bound, visible storage-failure feedback and explicit deletion. No background upload, financial retry or permission bypass. Successful confirmed saves delete the browser copy. |
| Save state | Compact status reports saving / saved / failed / offline and last confirmed synchronization. API reads do not masquerade as writes. Requests have bounded timeouts; failed saves keep editor input. Check latest does not retry a write. Stale Trip drafts can load current data and explicitly review their change impact before saving again. |
| Deposit / balance | The original bill holds its full cost and optional dated supplier payments. Prepaid tracks actual funds advanced without consumption; Postpaid recognizes full incurred cost and only its remaining supplier liability; Paid requires complete supplier funding. Consumption and expense IDs/dates remain stable. |
| Money actions | Paged and searchable lists for supplier balances, prepaid recognition, unlinked trip costs and all bills. The editor opens the existing bill. Read-only group viewers open the existing bill detail. |
| Bulk Money edits | Preview up to 100 selected bills, then atomically change only category and/or linked plan. Amounts, payers, splits, FX and expense dates remain unchanged. Requires editAll and current group revision. Each changed bill produces its own sync-change record. |
| Today / Next | Trip-local day selector, upcoming verified instants, entered travel + buffer departure suggestions, navigation and practical details. No live traffic estimate, inferred flight zone or automatic schedule mutation. |
| Ticket wallet | Paged booking cards with independently zoned flight summaries, leg labels, references, copy, booking link, address/navigation and contact. Uploaded files remain in Files & photos / Offline pack. |
| Plan shift / change impact | Filter/select a day or up to 100 plans, preview local date/time shifts and warnings, then one CAS save. Individual schedule edits show before/after, new warnings and related transfers, linked flights, same-day/next-day plans and hotel stays to review. Other records are not rescheduled automatically. |
| Saved place details | Optional stay minutes, manually entered hours, parking and transport notes. Existing places can be edited. Practical details carry into itinerary notes and the offline handbook. |

## Financial boundary and compatibility

Supplier installments are separate from repayments between friends. A partially funded bill displays actual payments and outstanding supplier money, but friend settlement remains unavailable until the bill is fully paid and consumed, matching the previous Postpaid/Prepaid settlement boundary. Generating interim debt claims can incorrectly change creditors when another traveller pays the balance; this release deliberately avoids that problem. Changing recorded supplier payments after linked repayments requires undoing those repayments first. Existing Paid → Postpaid/Prepaid protection remains.

Installment amounts use the bill's source currency and its recorded whole-bill FX / actual converted charge. Converted actual payments and remaining liability round to exactly the converted bill total; this does not model different bank FX for each installment. Payment dates may precede the incurred date. Zero/negative payments, duplicate IDs, invalid calendar dates, unknown group payers, overpayment and an incompletely funded Paid bill are rejected. Repeating a bill clears its supplier payments and paidOn.

There is no SQL migration or automatic rewrite of existing records. Existing bills without supplierPayments retain their previous behavior. Pocket Ledger still receives expense/payment records with the original expense key and incurred date. Incremental edits, batch metadata updates and supplier-only-payer removal use the existing cursor/change stream, including tombstones; no cursor reset is required for this release.

Rollback must retain the new installment calculation/validation once users have saved installments. v51 would ignore the new funding list and could overstate payments or attribute them to the old default payer. The v51 date-line rollback caveat above also remains. Keep data intact and publish a compatible fix forward instead of deleting installment records.

## Review and corrections

- Server authorization and current-group identity checks cover both batch operations; invalid selection fails the whole operation. Revision CAS prevents duplicate shifts after an uncertain response. No automatic financial writes or retries were added.
- Money conflicts reached through a Trip cost editor switch to Money for the existing financial comparison; itinerary conflicts remain in the planner and require fresh-data review.
- Draft data is browser-local, account/group scoped and only offered when the current authorized editor permission allows it. It is not encrypted local storage or cross-device draft sync. Downloaded copies and local browser drafts cannot be revoked remotely. Browser quota/disabled storage is reported and never blocks ordinary server saves.
- Money action calculations run only when its panel opens; already-paid bills are excluded before calculating supplier balances. Bulk schedule validation runs only after Preview, not on every checkbox. Trip travel tools remain lazy-loaded, clock updates are 30-second intervals, and lists are paged. No measured phone-latency claim is made.
- Opening hours, traffic duration, ticket validity and booking changes are manually maintained. The impact list is a review aid, not a complete dependency model or a supplier notification system. Bulk shifts preserve local clocks/zones and require individual resolution of DST ambiguity rather than guessing.
- Real browser/device interaction, clipboard permissions, storage quota behavior, dialog focus, actual offline phone memory and external calendar imports remain unverified in this environment. No browser-control skill was available, so no preview server or substitute browser was used.

## Validation and verdict

The focused suite now contains 130 tests: prior finance/permissions/sync/planner checks plus installment accounting and FX rounding, overpayment/member/date rejection, repayment protection, stable expense sync keys and supplier-only-payer tombstones, multi-page delta retries after metadata batches, atomic authorized plan shifts, browser draft expiry/isolation, travel-clock ordering, change-impact immutability and SSR control output. TypeScript and the Sites production build are required before publication. These are code/API/SSR checks, not a claim of testing the user's live personal records.

- **KEEP:** original bill identities and incurred dates; independent Trip/Money; current account permissions; private preferences isolation; three approved light/dark themes.
- **CHANGE NOW:** the correctness, recovery and performance corrections described above are part of this release. Publish only after the final focused suite, TypeScript and production build pass.
- **IMPROVE LATER:** real-phone recovery/clipboard/modal checks, a realistic large-group performance profile, and actual calendar imports. Separate FX per supplier payment or cross-device draft storage needs an explicit accounting/privacy design.
- **DO NOT ADD:** repayment proof / recipient confirmation, time polls / RSVP for now, AI/OCR/voice, automatic calendar writes, automatic supplier updates or automatic bill creation from plans.

# Production workflow review — 2026-10-19 (v53)

## Current data / control flow

Authenticated account → current group authorization → revisioned D1 group record → server validation → conditional group update and related sync rows in one D1 batch. The supplier ledger and friend repayments remain distinct. Planning estimates / category budget targets / Plan B do not create bills. Private preferences, uploaded objects, account grants and templates remain outside group checkpoints.

The user approved eight improvements: mobile operation, loading/computation, bulk recovery, supplier refunds/cancellation, flight cards, category budgets, Plan B and recoverability/diagnostics. The current hybrid layout and three themes remain. No AI, RSVP, time polls, repayment evidence or receipt confirmation was introduced.

## Implemented behavior

- **Mobile:** reachable Today/Next, Tickets and Add Plan shortcuts; horizontally compact Trip tool controls; sticky day navigation and editor save actions; 44px touch targets, 16px editor inputs and safe-area spacing. These are implemented controls, not evidence of a real phone test.
- **Loading:** authenticated conditional GETs compute a user/scope-specific ETag after current permission checks. Unchanged reads return 304 and retain client state. Inactive/inaccessible records do not participate in the ETag. Grant changes invalidate it even when the financial group revision stays unchanged. Read requests are coalesced; the refresh after a successful mutation waits for an earlier in-flight read and then checks again. No persistent financial response cache was added. D1 still reads the group blobs and permission/member-key data: this optimization reduces transfer, repeated ledger work and rendering, not those database reads.
- **Computation:** reverse-debt queues are indexed by member pair while preserving FIFO expense attribution. The settlement planner obtains outstanding claims once instead of rebuilding them for each edge and again for fallback. Current-event display calculations use a WeakMap scoped to immutable server event references; mutable editor objects are not globally cached.
- **Bulk recovery:** refresh keeps selected IDs and proposed changes. Every preview captures a revision, and Apply is disabled after the group revision changes until another explicit preview. Missing selections require an explicit removal before a whole-batch retry. The submitted revision is the reviewed one, not silently replaced by the newest revision.
- **Refunds/cancellation:** positive, dated supplier refunds stay on the original bill and reduce its net cost and the actual payer's funding. A refund is limited to funds paid by its receiver; recorded installment chronology is checked. Cancellation records the final fee, replaces the original consumption amount with that fee, and separates supplier balance / refund due. Overpaid money awaiting supplier refund belongs to its payer and is not charged to friends. Refunds restate the original bill's spending period; refund dates are retained separately. Amounts use the bill's existing FX, including exact minor-unit allocation. Different FX per refund/payment is not modeled. Vouchers are not cash refunds. Earlier actual friend repayments are retained. If a supplier adjustment makes one excessive, the same expense derives a reverse credit; a real return payment can settle that credit. A server-retained adjustment-history marker preserves subsequent real cash movements even if an adjustment is later corrected or removed. Editing historical supplier funding still requires reviewing linked repayments first.
- **Flight cards:** departure/arrival terminals, gate, meeting point, baggage, seat and check-in instructions. These appear in the ticket card and offline handbook. Return creation and ordinary copying clear stale operational booking details. Fields are entered manually and are not live airline data.
- **Category budgets:** owner-edited targets per whole group or a specific month; separate incurred and prepaid/awaiting-refund figures. Targets are advisory, revision protected and isolated from planner-only projections. They never post spending. Up to 25 scopes, with explicit period-target clearing.
- **Plan B:** up to five optional activity/food/free-time/transport/note alternatives. A reviewed switch cancels the original planning entry and creates a fresh Planning entry, clearing booking credentials. Bills retain their original activity ID. Transfers from a cancelled source are flagged for review. A stable new ID plus source/alternative identity makes the same uncertain retry a no-op; a changed choice is rejected. This does not cancel a supplier booking, create refunds, or rewrite other plans.
- **Recovery:** owner-only group checkpoints are captured from the server's current data, checksum verified and retained at five revisions. Review shows proposed record changes and requires the current group name. In-place restore preserves the current member roster/groups and account access; it refuses a changed member-ID set or settlement currency. Later bills/payments remain as deleted historical records with sync tombstones; audit history is retained. A checkpoint of the pre-restore revision is captured in the same guarded batch. Restore operation IDs make retries safe. Verified downloaded envelopes can also use the existing separate-new-event import flow.
- **Diagnostics:** core group/checkpoint requests return X-Request-ID, and errors carry the same problem reference. Structured logs record route, method, action/group after authorization, status, duration and failure category, without logging submitted bills, credentials or private answers. Validation stays 400/413; storage/internal failures are safe 503s. Client timeouts retain input and never automatically repeat a financial mutation.

## Challenge → correction

| Priority | Problem → impact → root cause | Smallest implemented fix |
| --- | --- | --- |
| HIGH | A losing CAS writer could still insert sync rows if another writer had advanced to the expected next revision. A revision alone did not identify the writer. | Nullable per-mutation marker on the group update; every related sync/checkpoint side effect requires the same marker in the same batch. A concurrent-expense test asserts exactly the winning record enters sync history. |
| HIGH | Retrying a bulk change against a refreshed revision could apply a shift twice or overwrite a changed bill without review. | Keep selection but freeze the reviewed revision; require Preview again and submit that exact revision. |
| HIGH | Cancellation could count the whole booking or charge friends for funds still owed by the supplier. | Recognize the final fee, cap friend funding at that fee, and keep the payer's excess as awaiting refund. Preserve the original source identity. |
| HIGH | Generic API exceptions could expose database errors and misclassify outages as input errors. | Explicit controlled validation errors, safe internal/storage 503s and request references. |
| MEDIUM | Group payloads were checked by JS character count with a 3M limit although storage limits are byte based. | Bound stored UTF-8 group data and encoded sync change payloads to 1,900,000 bytes before writes. Existing data is not pruned or rewritten. Full groups can be exported/imported separately. |
| MEDIUM | Per-record restore sync statements could exceed request query budgets. | A bounded JSON change array is inserted with one prepared INSERT…SELECT over json_each, guarded by the mutation marker. |
| MEDIUM | Pair cancellation scanned unrelated claims; settlement rebuilt all claims for each edge. | Pair queues and one grouped claim lookup retain exact attribution with less repeated work. |
| MEDIUM | Old reads could complete around a successful write and leave the editor on an old revision. | Serialize a mandatory post-write refresh behind the previous read; retain server CAS as the authority. |

## Measured verification

`docs/performance-v53.json` contains local synthetic medians (3 timed runs), compared with pushed v52 source `28802dd01c7754fd1e380d41c2feb1aaf8972882`. Reproduce with `node scripts/benchmark-finance.mjs` in a checkout retaining that Git object. It uses middleware-only SSR module loading, not a browser preview server.

| Bills / members | v52 ledger | v53 ledger | v52 settlement planner | v53 settlement planner |
| --- | ---: | ---: | ---: | ---: |
| 100 / 8 | 12.28 ms | 7.04 ms | 49.00 ms | 9.69 ms |
| 500 / 8 | 33.13 ms | 20.70 ms | 445.06 ms | 36.28 ms |
| 1000 / 8 | 142.20 ms | 50.75 ms | 1603.70 ms | 83.41 ms |

All benchmark fixtures produced identical results to v52, including 20 deterministic mixed-creditor fixtures and original expense allocations after repayments. Timings vary between local runs; no blanket latency or phone-FPS claim is made. Network, rendering, actual D1 latency and simultaneous real users are not represented by this benchmark.

The full focused regression suite contains 149 tests at this point, covering prior behavior plus refunds/FX/chronology, cancelled deposits and pending refunds, post-repayment reverse credits and their return payments, original sync keys, budget permissions, Plan B authorization/retries, conditional-read authorization invalidation, winning-writer sync effects, checkpoint integrity/retention/roster changes/restore/tombstones and safe storage failures. TypeScript and the Sites production build must pass before publication. UI revisions also receive SSR checks; these do not establish real touch/focus behavior.

## Recovery coverage and unknowns

Live read-only database discovery confirmed DB and the existing application tables before implementation. No provider backup-management operation is exposed in the available Sites tools; provider Time Travel enrollment, retention for this exact deployed account and an actual provider recovery remain **UNKNOWN**. No live bill or personal permission was changed as a test.

Checkpoints share the primary storage failure domain, cascade with deletion of their group, and exclude uploaded R2 contents, private preferences, templates and permissions. They recover mistakes within an existing group; they are not a complete independent disaster backup. Downloaded copies provide a separate group-data copy and can be imported into a new owner-controlled group. Keep uploaded originals separately. Complete database/object-store recovery requires the hosting provider's supported recovery path; it was not exercised here.

Actual iPhone/Android interaction, clipboard permissions, keyboard/safe-area geometry, browser storage failures and external calendar imports remain **UNKNOWN** because no supported browser-control skill is available. Production schema presence can be checked read-only after publishing; this is not an authenticated live restore drill.

## Migration / rollback

Generated migration `0010_dapper_black_tarantula.sql` adds indexed trip_checkpoints with group-deletion cascade. `0011_chubby_guardian.sql` adds nullable trips.mutation_id. Neither rewrites existing financial data. Do not drop these structures during rollback. Old builds ignore refunds/cancellation and can misstate consumption/funding; rollback code must retain the new calculation, validation and mutation-marker guard, plus the previously documented timezone/installment compatibility. Prefer a fix forward. Existing Pocket Ledger cursors and keys remain valid; restore/refund/bulk updates enter the existing delta stream.

## Verdict

- **KEEP:** independent Trip/Money, owner control, server authorization/CAS, stable financial IDs, original incurred dates, separate friend repayments, private preferences isolation and current themes.
- **CHANGE NOW:** all release-blocking corrections above are implemented; publish after the final regression/type/build gates. Do not claim unperformed device or provider restore verification.
- **IMPROVE LATER:** real phone/browser acceptance, provider database + R2 restore exercise, and profiling many authorized groups. The next structural bottleneck is still whole-group JSON/audit size and per-group authorization queries; normalize/paginate only when measured usage justifies the migration.
- **DO NOT ADD:** AI, polls/RSVP for now, repayment evidence/recipient confirmation, automatic supplier/calendar writes, unreviewed financial retries or a large new distributed architecture.

Official implementation references: https://developers.cloudflare.com/d1/sql-api/query-json/ (JSON SQL functions) and https://developers.cloudflare.com/d1/platform/limits/ (2,000,000-byte row/string limit and per-invocation query limits). These document platform capability; they do not verify this Site's provider recovery configuration.


# Booking editor positioning review — 2026-10-20

- Scope: fix the existing right-anchored Hotel/plan editor position. Shared Money editors use the same sheet and receive the same correction. No data, API, permission, financial calculation or schema changes.
- Problem → impact → root cause → fix → priority: the shared Radix dialog includes Tailwind v4 individual `translate` centering, while `.workspace-editor-sheet` separately applies `transform: translateY(-50%)` and a right anchor. Both translations compose, shifting the sheet left by half its width and up by its full height in total; mobile inherits the same fault. Reset individual `translate` for this sheet and retain its one vertical centering transform, responsive gutters, bounded height and internal scrolling. MEDIUM usability defect.
- Validation: 44 existing UI/planner regressions passed. Initial production build passed, but inspecting the emitted stylesheet caught Lightning CSS dropping `translate:none` next to `transform`; use the equivalent `translate:initial` reset, which survives minification. Final production build passed; emitted sheet rule retains `translate:initial!important` and its single vertical centering transform. Plain TypeScript requires the generated Cloudflare runtime declarations; generated them from the current built Worker configuration and TypeScript passed. Supported browser-control skill unavailable; no browser geometry, keyboard, focus or actual-device verification claimed.
- KEEP: portal/focus management, right-side editor layout, responsive width/height, sticky actions and unsaved-draft handling.
- CHANGE NOW: remove the competing individual translate before publishing.
- IMPROVE LATER: verify the Hotel form at desktop/mobile widths and with the on-screen keyboard in a supported browser/device. Whole-group JSON remains the first known data-scale bottleneck; this CSS change adds no runtime work.
- DO NOT ADD: a replacement dialog system, new booking features, dependencies or schema changes for this positioning fix.


# Hotel checkout day review — 2026-10-20

- Scope: per-day itinerary master rows now show hotel check-in/check-out using the selected day and the corresponding time, or an explicit time-not-set label. Intermediate days say Staying overnight. Checkout remains a reminder on the departure day; the Tonight section already excludes checkout day. All-days and Bookings retain their original reservation start details. No dates/times are inferred or bookings duplicated.
- Problem → impact → root cause → fix → priority: checkout-day rows displayed the original check-in date/time, making a departing hotel look like a new stay. Generic reservation subtitles ignored the selected itinerary day. Use day-aware hotel subtitles and replace the ambiguous Check-out / end label. MEDIUM usability issue.
- Simple family itinerary: preview alternatives only; no new public share route or access-policy change shipped before design selection. Existing /view requires authentication and membership. Any future anonymous itinerary link must serve an allowlisted planning-only projection with revocation, excluding bills, booking credentials, private preferences and private group data.
- Validation: 45 focused SSR/planner tests passed, including day-specific check-in/stay/check-out and missing-time cases, end-exclusive Tonight and no mutation of saved booking data. TypeScript with current generated Worker declarations and production build passed. Browser/device geometry unavailable in this environment.
- KEEP: checkout reminders, end-exclusive Tonight stays, current layout/themes and all permission/financial boundaries.
- CHANGE NOW: day-aware checkout labels before publishing.
- IMPROVE LATER: user-selected accessible family itinerary page and actual phone acceptance; whole-group JSON remains the existing scale limit.
- DO NOT ADD: financial or personal information to anonymous share links, inferred hotel checkout times, or an unsolicited overall redesign.


# Simple itinerary and personal Money — 2026-10-20

## Shipped scope and flow

The user selected the second preview (simple timeline) and personal-only read access to Money for ordinary members. Linked signed-in members receive a date strip, tonight's hotel (checkout date excluded), timed daily plans, selected-day hotel check-in/checkout reminders, locations and shared plan notes. No booking manager, trip cost dashboard, bill-edit or access-management controls appear in their simplified shell. Managers can open Simple itinerary within the existing Trip workspace and copy a group-scoped link; sign-in retains its group/space/simple query parameters. No anonymous publication or new sharing policy is introduced.

Request identity → current group grant/member verification → server projection → member itinerary / personal Money. Manager permissions remain the existing explicit per-group grants: plan manages bookings; viewAll/editAll permits full group Money; the owner alone manages access. Delegated expense helpers retain existing explicit edit permissions and their own submitted records. A money-only administrator does not gain booking access. Ordinary membership with no management grants remains read-only for financial actions.

Personal Money shows own consumption, actual supplier funding, prepaid/unpaid shares, remaining payments to/from related members, the originating bill, own item shares, and own repayment history with recorded source allocations. All balances/claims reuse the existing ledger and stable member IDs; no settlement or financial-write rules change. Original item shares display in the bill currency; final personal amounts and repayments display in settlement currency, including existing FX/adjustment rules. Pagination bounds initial bill/history rendering.

## Review and corrections

- **CHANGE NOW / access policy:** hiding Bookings alone would leave its structured credentials in member JSON. Added an allowlist travel projection excluding booking URLs/references, room assignments, contacts, seats, estimates, roster, bill data and operational checklist/favorites. Shared travel notes and common meeting details retain their existing shared meaning; administrators should keep sensitive credentials in their dedicated booking fields. Authorized planners keep the full travel context.
- **CHANGE NOW / alternate paths:** enforce the same member projection in /api/view; validate active/current member binding there; restrict booking document list/download to planning administrators; hide travel audit payloads from non-planners. Album reads retain their existing shared-member scope; their upload remains plan-authorized. Inactive-member photo reads are denied.
- **CHANGE NOW / caches:** version the /api/trips representation ETag so a still-open client cannot receive a 304 for the previous broader member projection after deployment. Current grants and inactive membership continue participating in authorization/cache decisions.
- **CHANGE NOW / amounts:** never use display names as ledger identity; duplicate-name coverage verifies personal repayment direction by member ID. Item-line amounts use source currency rather than being mislabeled as settlement currency. Friend repayments and supplier funding stay separate.
- No financial records, grants, sharing audiences or live group data were changed to test the feature. No schema or storage binding change. Publishing can roll forward without a migration; rolling back application code would restore the older, broader member travel projection and is inappropriate if this policy must remain enforced.

## Verification and limits

154 focused API/ledger/planner/workflow/SSR regressions passed, including the added member boundary, related expense sources, partial repayment, sign-in member revocation, checkout labels and duplicate display names. TypeScript with generated current Cloudflare declarations and the Sites production build passed. Money-only-admin and original THB versus converted MYR rendering assertions also passed before publication. Browser-control skill unavailable: actual device layout, date-strip interaction, clipboard and the hosted sign-in round trip are not claimed as tested. Existing provider recovery limits remain unchanged.

- **KEEP:** current themes and management workspace, existing financial calculations, stable IDs/CAS, owner-only grants, separate per-group authorization, and authenticated access.
- **CHANGE NOW:** enforce the member read boundary on JSON, attachment APIs, historical travel records and cached representations; all implemented in this release.
- **IMPROVE LATER:** supported browser/phone acceptance, optional language preference, and a separately designed revocable itinerary-only anonymous link if explicitly needed. Whole-group JSON loading/authorization and ledger recomputation remain the first likely scale bottlenecks.
- **DO NOT ADD:** another role database, a second ledger, anonymous financial sharing, or changes to prepaid/postpaid settlement policy as incidental scope.

# Approved mist-violet workbench — 2026-10-20

## Scope and control flow

The user approved the recommended mist-violet direction after three concrete desktop/mobile samples. Trip now opens at the day itinerary. Planning administrators get four primary destinations: Itinerary, Bookings, Money and More. The selected trip's full Money workspace uses the same outer navigation, with Expenses / Settlement / Overview and a grouped secondary menu for authorized personal, team and history destinations. The owner's member-view picker remains available in More Money. Daily groups and money-only administrators keep their existing supported workspace. Existing account theme selections remain intact; the violet light palette is refined, and all three light/dark themes remain selectable.

The primary screen removes the repeated trip hero, permanent filter form, daily cost summary and seven-button tool strip. More groups the existing planning, travel/export, financial and team tools. Existing templates, bulk changes, Plan B, flight timezones/return legs, attendance/waitlists, booking files/photos, checklists, private preferences, calendar export, offline packs, budget/refund and recovery capabilities remain reachable. Estimates do not create bills. No ledger, API projection, permission grant, schema or hosting audience change is introduced.

Row activation → existing onBegin/revision capture → parent-owned Activity draft → desktop inline editor or mobile dialog → optional schedule-impact review → existing server-verified CAS write → saved list. New plans and drafts outside the current filtered selection retain the dialog fallback. Fields are progressively disclosed without clearing hidden values. A restored draft explicitly selects its own row; changing the draft date does not unmount the editor. Dates, filters, row actions and pagination stay locked while editing; plan inputs are also disabled during a save. Save errors leave the draft available with the existing review-latest and browser recovery actions.

Member itineraries show time, title and short meeting information, with long routes, addresses and notes inside Details & map. A hotel appears once as Tonight on intermediate stay days and as timed check-in/check-out entries on the boundary days. Tonight remains end-exclusive. Full private booking fields and group finances continue to be excluded by the existing server projection.

## Review

- **Correctness / recovery:** fixed the restored-draft selection case so an inline draft cannot be hidden behind a different default row. Inline eligibility uses the saved record's membership in the current day, allowing date edits without switching surfaces. Collapsing editor sections retains controlled values. Busy inputs cannot accept edits that would otherwise be cleared when an in-flight save finishes.
- **Concurrency / idempotency:** revision capture, CAS, immutable expense IDs and dirty navigation guards stay in the existing parent/server flow. Limited the local schedule-impact exception handler to preview calculation; an exception from committing a plan no longer causes an implicit second commit attempt. No new automatic retry path is added.
- **Authorization / isolation:** the four-page shell is enabled only for planning administrators; secondary links are filtered through existing allowed destinations. Owner access controls remain owner-only. Ordinary members and money-only administrators retain their existing separate navigation and server projections. Existing API tests exercise cross-group access, member revocation and stale writes.
- **Compatibility / operations:** existing routes, simple-itinerary sign-in links, three themes and original tool implementations are retained. No new dependency, external API call, storage binding or database migration. Deployment is an application-only roll-forward; the prior v56 version provides a compatible application rollback while retaining its member data protections.
- **Performance / maintenance:** bounded workbench pagination and lazy tool modules are retained. No duplicate editor is mounted for a selected plan. The existing whole-group JSON load/authorization and ledger recomputation remain the first likely scale bottlenecks; this design does not introduce a new query or polling loop. The older CSS cascade remains a non-blocking maintenance opportunity.

## Verification and limits

159 focused API, ledger, planner, workflow and SSR regressions passed. Coverage includes authorized secondary navigation, inline restored drafts/date edits, save-state input locking, all existing travel tools, long member details, hotel checkout, personal-only Money, original-currency amounts, stale writes and group isolation. TypeScript with generated current Cloudflare declarations passed. Production build is required in the source packaging workflow before publication. Source whitespace checks passed.

Browser-control skill is unavailable. No actual browser/phone visual acceptance, tap/drag/focus interaction, clipboard, print, hosted sign-in round trip or supplier/calendar interaction is claimed. These remain acceptance limits, rather than evidence of a known defect. Tests do not modify live trip records, financial records, account theme preferences or permissions.

- **KEEP:** the existing permission projections, separate Trip and Money records, CAS/draft recovery, theme preference identity, original supplier expense IDs and bounded/lazy rendering.
- **CHANGE NOW:** simplify primary navigation, remove repeated screen content, preserve all advanced functions, keep restored/date-edited drafts visible and prevent edits during save; implemented in this release. No known release blocker remains after automated checks.
- **IMPROVE LATER:** supported phone/browser acceptance, consolidation of superseded CSS rules and measured optimization of whole-group JSON/ledger recomputation if real group sizes warrant it.
- **DO NOT ADD:** new roles, a second ledger, a replacement design library, new dependencies, anonymous booking/financial links or speculative features as part of this visual change.

# Independent Trip / Money navigation correction — 2026-10-20

## User clarification and shipped scope

This section supersedes v57's mixed primary navigation. The user wants Trip to cover the complete journey, including its linked expense view, and Money to be an independent place for both trip expenses and ordinary meals/outings. The detailed administrative functions were liked; the problem was the number of competing entry points.

The global Trip / Money switch is visible again on desktop and phone. Each space owns its primary navigation: Trip has Itinerary / Bookings / More; Money has Expenses / Settlement / More. Trip's More contains journey overview/dates, checklists, booking files/photos, travel kit, templates, bulk moves, calendar/offline tools, private preferences and trip costs. Money's More contains existing supplier/prepaid/refund review and bulk tools, budgets, Quick Picks, spending overview, personal spending, authorized members/settings and history/recovery. Quick Picks no longer has another permanent dashboard-tab entry. Contextual bill and trip-expense links remain because they identify a particular record. Ordinary member and delegated personal-expense views keep their existing permission scope.

Money starts at Expenses for either a Trip or Daily Group. Its group chooser and sidebar can filter the group list to All / Trips / Daily without moving or copying any records. A list filter does not implicitly change the selected group. A daily-only account has no booking/planning destinations in Trip. Each space remembers its selected group for the current app session, with authorized-record fallback when a remembered group is unavailable. Explicit linked-plan/bill navigation overrides that memory and uses the originating trip, including when opening its entire ledger without a specific activity ID.

Admin plan details and editor sections are expanded by default again. All original fields and detailed financial calculations remain; mobile retains a single editor and desktop retains direct inline editing. The existing plan save lock, schedule-impact review, revision checks, error handling and draft recovery are preserved. Member itineraries remain concise with optional long details. No new visual theme, role, ledger, schema, storage binding, external integration or dependency.

## Data/control flow and review

Global switch or group choice → accepted dirty-navigation guard → select a currently authorized record for that space → render the space's three main pages → existing editor → original server-verified write. Trip expenses and Money still read/update the same expense IDs in the same group; estimates remain planning-only. There is no data synchronization job and no duplicated financial write.

- **MEDIUM / navigation:** v57 mixed Money into Trip's primary menu and removed the explicit space switch. Restored independent purposes and purpose-specific menus; secondary tools have a grouped home.
- **MEDIUM / record context:** a shared selected-group state could send a global return to the wrong purpose's last group. Added independent session selection. Conversely, an explicit linked expense must not restore an unrelated everyday group; contextual navigation deliberately selects its originating trip. Missing/revoked candidates fall back only within currently accessible records.
- **Correctness / concurrency:** financial/edit callbacks, original IDs, supplier-paid updates, repayments, CAS, imports, privacy projections and recovery remain on the existing implementation. No record, permission or account theme is modified as a test. Closing/running tools retain their existing behavior; this change does not create a second save or retry path.
- **Authorization / isolation:** menu destinations come from existing owner/grant decisions, with original API authorization as the security boundary. Money More filters its team/settings links by allowed destinations. Personal-only members do not gain Money tools or Bookings; money-only managers do not gain booking administration. No broadening of API fields or historical payloads.
- **Compatibility / operations:** existing deep links, activity links, three themes and daily-group creation remain supported. An application-only rollback is possible without database changes, although v57's confusing navigation would return. Production packaging runs the final checks and build before pushing/saving the version.
- **Performance / maintainability:** pure helpers centralize landing, primary-page and group-selection decisions; no new query or polling loop. Secondary financial components are mounted in their requested workspace page. Whole-group JSON reads and ledger recomputation remain the first scale bottlenecks; no new infrastructure is warranted.

## Verification and limits

161 focused API, ledger, planner, workflow and SSR regressions passed before packaging. Coverage includes independent per-space menus, daily-only accounts, remembered/revoked group fallback, explicit same-trip linking, daily/trip group filters, authorized financial tools, complete admin booking fields, personal member boundaries, financial amounts and stale writes. TypeScript with current generated Cloudflare declarations and source whitespace checks passed. The packaging workflow repeats the final relevant checks and requires a successful production build.

Browser-control skill is unavailable; actual browser/phone layout, touch/focus, modal interaction, clipboard, sign-in and external-calendar round trips remain unverified. SSR and API checks are not represented as real-device acceptance.

- **KEEP:** comprehensive admin pages/forms, the original ledger and expense identities, existing authorization/CAS/recovery, separate personal projections, and three saved theme choices.
- **CHANGE NOW:** restore top-level Trip / Money, remove mixed/duplicate navigation, group existing tools and preserve explicit linked-trip context; implemented.
- **IMPROVE LATER:** supported phone/browser acceptance and further legacy CSS consolidation; measure whole-group load costs before optimizing storage.
- **DO NOT ADD:** another ledger, an expense-copy/sync process, a new role system, a broader redesign or speculative features to solve a navigation problem.

# Restore full Admin baseline before incremental simplification — 2026-10-20

## User request and shipped scope

This decision supersedes the v57/v58 navigation redesigns. Restore the v56 full Admin interface first and stop, so later entry-point reductions can be reviewed one small area at a time. Trip and Money remain independent purposes. Trip restores Simple itinerary, Trip Plan, Itinerary, Bookings, Trip costs, Checklist, Travel kit and Files & photos, with the original direct travel-tool strip and mobile shortcuts. Money restores Dashboard, Expenses, Settlement and each authorized personal/access/settings/history destination, its original financial tools and Quick Picks. Full desktop sidebar and phone tab navigation use the same allowed destination list. Detailed plan forms return to the existing responsive dialog rather than the newer inline/More design. The prior theme palette/layout is restored, retaining all three saved theme identities and light/dark modes.

The concise ordinary-member itinerary improvements remain: optional long details, date layout, end-exclusive overnight stays and timed checkout. Personal Money and all server projections/permissions are unchanged. The restored Admin source is v56 plus two existing correctness protections: disabling editor inputs/Cancel during a save, and keeping commit failures outside the local schedule-preview exception handler so a failed save does not trigger an implicit second commit. The unused v58 Money More wrapper is removed; no user records or files are deleted.

## Engineering review

- **Correctness / compatibility:** source restoration is scoped to Admin UI and navigation, not a wholesale old deployment or database restore. Existing trip records, expense identities, original incurred dates, prepaid/postpaid accounting, supplier-paid behavior, estimates, checklists, files and exports remain on the same implementations. No migration, dependency, storage binding or audience change.
- **Authorization / isolation:** destinations still derive from the existing owner/grant checks; the server remains authoritative. Ordinary members retain only the concise trip/personal Money experience. Owner-only access management and private preferences keep their existing protection. Backend source is unchanged from v58 and matches the v56 protected member boundary.
- **Concurrency / recovery:** original revision/CAS, dirty-navigation guards, browser draft recovery and stable expense IDs are retained. Inputs cannot change during plan save. Preview failure may fall through to one server-validated commit; commit failure never invokes an automatic second save.
- **Performance:** pagination, selected-detail rendering and lazy travel-tool modules remain. Restoring more visible entry points intentionally increases visual density but adds no new API polling or background work. Whole-group JSON authorization/loading and ledger recomputation remain the first likely scale bottlenecks.
- **Process:** do not make another reduction in this release. Future changes should identify one repeated/confusing entry point, explain the proposed small adjustment, and obtain the user's confirmation while preserving detailed functions.

## Verification and limits

157 focused API, ledger, planner, workflow and SSR/source regressions passed. TypeScript with current generated Cloudflare declarations and source whitespace checks passed. Packaging requires the final Sites production build. New coverage checks every full Admin sidebar destination, the phone destination mapping, retained member collapsed details, the restored responsive plan dialog, busy locking and single-attempt save exception boundary. The existing suite covers checkout phases, personal financial sources, stale writes and cross-group isolation. Tests do not modify live user records or preferences.

Browser-control skill is unavailable. No actual browser/phone appearance, touch/focus, dialog placement, clipboard, hosted sign-in or external-calendar acceptance is claimed; supported device/browser acceptance remains outstanding.

- **KEEP:** full v56 Admin entry points/details, separate Trip and Money purposes, concise member views, current server privacy/CAS/recovery, stable ledger records and saved theme choices.
- **CHANGE NOW:** restore the prior complete Admin baseline while retaining save protections; no further entry-point reduction in this release.
- **IMPROVE LATER:** user-confirmed small navigation reductions and supported phone/browser acceptance; measure whole-group load costs before changing storage.
- **DO NOT ADD:** a new redesign, new role/ledger system, expense copying/synchronization, anonymous financial links or speculative functionality.

# First incremental Trip cleanup: tools, creation scope and phone layout — 2026-10-20

## Current flow and user-approved scope

The user identified the duplicate Today / Tickets rows and multiple unrelated plus buttons in the restored Admin screenshot. This release changes that bounded area, not the full destination structure. Every authorized Admin Trip/Money page and detailed editor stays available. The previously selected mist-violet light token palette returns; other theme modes and account theme preferences are unchanged.

Workspace-level New Trip (and Daily Group in Money) → unsaved-input confirmation when necessary → existing creation form → existing server-authorized create operation. These controls now sit above the current trip's selector/content. In the planner, one Add plan / Add booking button → choose the relevant plan type → existing detailed draft/dialog → schedule-impact review when applicable → original revision-checked activity save. Checklist keeps its Add task, not an unrelated activity-add button. The old Overview Quick add tab, repeated day-header add and booking-type row are consolidated into this one type chooser. Context-specific linked return flights, copying an existing plan, preparation checklist starters and linked expense actions retain their distinct functions.

Trip tools is a native collapsed disclosure, not a permanent row of tiles. Its descriptions explain Today & next stop, Booking references (formerly Ticket wallet), Shift plans, calendar exports, templates, private preferences and offline downloads. Opening a tool retains its original lazy module, authorization, dirty guard and recovery implementation. The duplicate floating Today / Tickets / + Plan dock and its obsolete CSS are removed entirely. No travel tool or plan type is removed.

Responsive layout is based on available CSS viewport width, not physical screen diagonal. Trip uses flexible, zero-minimum-width columns, a small-screen single-column tool/type chooser, readable full tab labels in a horizontal destination strip, safe-area-aware bottom clearance and bounded dynamic-viewport-height dialogs. Add and tools controls have readable labels, touch-size targets and mobile editor inputs stay at 16px to avoid iOS focus zoom. The duplicate trip-name hero is replaced by the current page heading. Existing full desktop navigation and detailed forms remain.

## Review: problems, impact, causes and fixes

- **MEDIUM / usability:** the same Today/Tickets controls appeared in both a tile strip and fixed dock, while new-trip and local-plan additions competed. This made action scope unclear and obscured phone content. Consolidated tool launchers and local additions, and moved whole-space creation above trip context. This is the only navigation reduction approved/shipped in this increment.
- **MEDIUM / creation recovery:** the old create buttons could replace current settings/input directly. The relocated handler now uses the existing unsaved-input confirmation/clear flow before opening a new form. No record is created by opening the form; existing validation and server create authorization remain authoritative.
- **MEDIUM / responsive layout:** old fixed-width/truncated bottom labels and stacked floating controls reduced readable area. The Trip strip now uses full labels, intrinsic button widths, contained horizontal scrolling, safe areas and a single persistent bottom layer. Small chooser grids become one column at 380 CSS pixels. Supported browser/device behavior remains an acceptance gap, not established by stylesheet assertions.
- **Correctness / concurrency:** estimates still never post Money consumption. Stable expense IDs, prepaid/postpaid, supplier-paid updates, original incurred dates, CAS, plan schedule review, in-flight input locking and browser draft recovery are unchanged. Choosing a type only creates a local draft; there is no new auto-save, retry, sync job or duplicated financial write.
- **Security / isolation:** no backend/auth/API projection/schema/binding changes. Existing server grant checks and member-only financial projection are retained. Tool choices still filter private preferences and bulk shifts by allowed scope. New workspace creation still requires the existing server-provided creation permission; ordinary member simplified shells are not broadened.
- **Performance / maintainability:** tool modules remain lazy and the disclosure adds no requests/timers until a tool mounts. Existing whole-group JSON loading/authorization and ledger recomputation remain the first scale bottlenecks. The legacy stylesheet cascade and long TripApp/TripPlanner components are non-blocking debt; avoid a broad rewrite in this UI increment.

## Verification and operational limits

161 focused API, ledger, planner, workflow, SSR and stylesheet/source regressions passed. TypeScript with current generated Cloudflare declarations and whitespace checks passed. Coverage checks one contextual planner add, all original tool choices with permission filters and disabled states, no floating dock, the global creation guard/location, unchanged ledger fixtures, full Admin destinations, member privacy, checkout, stale writes and cross-group isolation. Stylesheet rules are evaluated for representative 320, 360, 375, 390, 393, 412, 414, 430, 440 and 480 CSS-pixel widths; these are rule checks, not rendered-device screenshots. Final Sites production build is required by packaging.

Browser-control skill is unavailable. Real 5.9/6/6.9-inch phone layouts, large-text settings, notch/keyboard behavior, swipe/focus, nested modal focus and hosted sign-in remain UNKNOWN pending supported browser/device acceptance. No claim of all-phone or physical-device validation. Tests do not mutate live trip/billing records, theme preferences or permissions. Publication is an application-only roll-forward with no migration; v59 remains a compatible rollback baseline.

- **KEEP:** independent Trip/Money, complete Admin functions/forms and destinations, concise member view, existing ledger/security/revision/recovery boundaries and all six theme modes.
- **CHANGE NOW:** scoped duplicate tool/add cleanup, explained tool names, top-level creation with dirty-input protection and fluid phone rules; implemented and automated checks passed.
- **IMPROVE LATER:** supported real-device acceptance, user-selected next small cleanup, measured CSS/component consolidation and observed whole-group bottlenecks.
- **DO NOT ADD:** another broad navigation redesign, hardcoded per-phone models/inches, new roles/ledger, new dependencies, speculative tools or new financial synchronization.

# Second approved cleanup: duplicate Overview navigation — 2026-10-20

## Scope and flow

The user approved the screenshot review. Admin navigation now displays Trip Plan as Overview and Simple itinerary as Preview member view, consistently in the desktop sidebar, phone tabs and quick jump. Internal destination values remain unchanged so existing routing, dirty guards, focused records, simple-view links and member-only destinations retain their behavior. Ordinary member labels/routes are unchanged.

Removed the planner header's duplicate Trip costs link and the overview's Open itinerary shortcut. The main Trip costs/Itinerary destinations remain, and each Coming up row still opens its specific travel day. Overview no longer has a separate Money snapshot tab: its initial summary shows only Plan estimate and Recorded spending from the existing tripFinance calculation, guarded by showFinancial. Full prepaid/unpaid/deposit/bill management stays in Trip costs and Money. No financial write or duplicated ledger exists.

Trip details & days becomes Trip details. Removed its second daily itinerary list while retaining destination/date/timezone editing, member/group information, budget and filtered booking readiness. Read-only essentials now show saved dates, destination and timezone explicitly. Empty preparation metrics (0 / 0) and an empty Needs attention panel are omitted; active tasks/warnings remain actionable. The Coming up panel and metric grid fill the available space. Removed repeated Trip context captions and the now-empty desktop event-switch wrapper; phone trip selection remains available.

## Review and verification

- **Correctness / compatibility:** this is a display/entry cleanup. Existing destination IDs, planner sections, type chooser, detailed forms, linked return flights, booking/cost/checklist tools, selected-day routing and Money accounting are retained. No database, API, permission, theme preference, audience or dependency changes.
- **Authorization / isolation:** the short financial summary is conditional on the existing showFinancial boundary; renamed navigation does not grant access. All server grants and personal-member projections remain unchanged. Source review confirmed no authorization or tenant selection mutation.
- **Concurrency / recovery:** existing callbacks, revisions/CAS, stable expense IDs, unsaved-input guards and browser draft recovery are unchanged. A contextual Coming up click uses its original date-aware route. No added retry or write path.
- **Performance / maintenance:** the duplicate financial summary component and daily list no longer mount in Overview secondary tabs. Existing tripFinance memoization remains; no added network requests. Whole-group loading/authorization and ledger recomputation remain the first likely bottlenecks. Centralized display labels avoid changing internal routing keys; the legacy component/CSS size remains non-blocking debt.

73 relevant existing SSR, planner, workflow and trip-finance checks passed; the existing full-navigation expectation was updated for visible labels. TypeScript with current generated Cloudflare declarations and whitespace checks passed. No new tests mirroring this reversible UI cleanup were added. Packaging requires the Sites production build. Browser-control skill remains unavailable; actual desktop/phone layout, focus and swipe acceptance remain unverified. Tests did not change live trip/bill records, roles or preferences. Application-only rollback to v60 is compatible without migration.

- **KEEP:** detailed Admin capabilities, contextual record/day links, independent Trip/Money, current backend isolation, member view and stable routes.
- **CHANGE NOW:** the approved duplicate links, labels, overview/detail overlap and empty panels; implemented.
- **IMPROVE LATER:** supported browser/device acceptance and the next separately reviewed small cleanup.
- **DO NOT ADD:** another menu layer, route migration, broad redesign or new financial/state architecture for a UI duplication issue.

# Approved removal of optional pages and merged Itinerary — 2026-10-21

## Scope and data/control flow

The user selected: files/photos will be shared in their group, Travel kit is unnecessary, Trip costs is cancelled, and Bookings should merge with Itinerary. Trip's allowed Admin destinations now comprise member preview, Overview, Itinerary and Checklist. The same destination list drives desktop sidebar, phone navigation and quick jump. Retired page components no longer mount; their unused TripApp imports and Travel kit dirty-state plumbing are removed. Archived implementation modules remain in source for compatibility/recovery, and no stored travel notes, photos, files, plans or financial records are deleted or transferred externally.

Itinerary owns Daily itinerary and Booking list modes. Both render the original activity records: the day mode retains travel dates, checkout phases, ordering and detailed records; the booking mode retains the full-date list, booking type/status/traveller/search filters, detailed reservation fields and its contextual Add booking. Switching modes is disabled during a save or a local plan/details/task draft. Parent selection retains the chosen mode when Overview booking-readiness links enter Itinerary; the internal Bookings view is translated to the single Itinerary destination. Legacy component callers using section=Bookings still initialize the booking mode. A searched or linked activity retains its original date-aware daily focus behavior.

Existing expense actions on a specific plan still open the original Money bill flow, scoped to the same trip/activity. Trip costs is no longer a page; Money's expense records, linked-plan filtering, supplier/prepaid/refund tools, repayments and permissions retain their existing implementations. Overview and manual calendar exports remain unchanged because they were not selected for removal/upgrade. There is no new calendar subscription, external group connection or financial synchronization.

## Engineering review

- **Correctness / compatibility:** menu destinations and mounted pages agree; no empty retired page remains reachable from sidebar/phone/quick jump. Overview readiness links map to the merged booking mode, and day-specific/search links stay on daily mode. Removed the stale Files & photos instruction from booking-reference help and the photos promise in the Money-to-Trip banner.
- **Authorization / isolation:** UI removal grants no new access. Booking fields still require the existing planning/admin source projection; ordinary members retain their concise itinerary and personal Money. Server APIs, storage authorization and per-group grants are unchanged. Old upload/storage access is not made public to relocate documents.
- **Concurrency / recovery:** mode switching respects busy/local-draft locks; existing revision capture, CAS, single-attempt save, schedule-impact review and browser draft recovery remain. Two modes share IDs and callbacks rather than copying activities. No record or bill is created by switching views.
- **Operations:** application-only roll-forward with no schema, dependency, binding, runtime secret or audience change. Stored files/travel data remain recoverable through existing authorized storage/export paths and compatible v61 rollback. No external platform is contacted to move user files.
- **Performance / maintainability:** removed mounted optional pages and their file/photo fetches from the main app. The full booking list keeps existing bounded workbench pagination. Whole-group JSON loading/authorization and ledger recomputation remain the first likely scale bottlenecks. Optional archived modules/tests may be removed in a later explicitly scoped cleanup once recovery requirements are settled; do not undertake a broad rewrite here.

## Verification and limits

162 existing/new API, ledger, Money, planner, workflow and SSR regressions passed. One new meaningful regression covers same-record daily/booking modes, all-date booking visibility, contextual add labels, save locking and unchanged input records; navigation and delegated-manager expectations were updated. TypeScript with current generated Cloudflare declarations and source whitespace checks passed. Final Sites production build is required during packaging. Tests did not mutate live trip records, billing data, roles or theme preferences.

Browser-control skill remains unavailable. Actual phone/desktop appearance, touch/focus, switching within an open browser session, external group file sharing and hosted calendar/sign-in round trips remain unverified. SSR checks are not physical-device acceptance.

- **KEEP:** detailed shared plan/booking records, Checklist, independent Money, current privacy/auth/CAS/recovery boundaries, Overview, themes and manual calendar export.
- **CHANGE NOW:** retire selected optional pages, remove the separate Bookings destination and provide two modes inside Itinerary; implemented.
- **IMPROVE LATER:** supported browser/phone acceptance, optional archived-code cleanup and separately approved calendar subscription work.
- **DO NOT ADD:** a new group/files platform integration, file transfer/deletion, travel-data migration, another ledger, automatic accounting synchronization or incidental calendar permissions.

# Compact planner action and authenticated personal trip links — 2026-10-21

## Requested behavior and current flow

The screenshot's large Overview action card is reduced to a compact page-heading/Add plan row across desktop and phone. Share plan is removed from that row. Existing add/type selection, detailed editors, draft guards and saves retain their callbacks.

The member preview's Copy itinerary link control becomes Copy member link. It opens a member selector, then copies a stable /member URL containing the trip ID and immutable member ID, never a session token, email, amount or frozen financial snapshot. Clipboard failure leaves a selectable URL. Active roster members are selectable; sign-in/account binding requirements are stated in the picker. Existing generic itinerary URLs remain supported. Copying a link does not send a message, create an invitation, change a grant or grant anonymous access. The owner must bind the recipient's sign-in account in the existing People & Access workflow first.

Protected /member page → existing ChatGPT sign-in with the complete relative return path → existing per-user app session → GET /api/member-portal → fresh trip/grant authorization → personal projection + sanitized itinerary + aggregate trip spending → two read-only pages, Itinerary and My Money. The group total is a user-requested, scoped expansion of member visibility; other members' full bill details remain excluded. A trip owner can preview a selected member; other viewers must be bound to that exact active member, even if they have broader managerial grants elsewhere. The page has no member switcher, booking management, uploads, editing, grants or access to an unrelated group's records.

The personal page refreshes every 30 seconds while visible and when focus/visibility returns; Refresh is also available. Each request has a 15-second timeout, avoids overlap and is aborted on unmount. Conditional ETags are scoped to trip/revision/member/viewer. Authorization and active-member checks happen before 304 handling, so a cached revision cannot bypass revoked access. 401/403/404 clears the displayed snapshot before parsing an error body. Transient errors retain the last loaded snapshot with an error notice; successful refresh clears the notice. State is keyed by trip/member and updates preserve the selected itinerary day and Money filters.

## Correctness, privacy and operations review

- **HIGH / financial isolation:** trusting a person in a URL would expose another traveller's Money. The new endpoint checks existing server identity and current trip grants, requiring owner or an exact linked-member ID. Tests cover altered-member URLs, duplicate display names, a full-Money manager targeting another member, unbound accounts, anonymous requests, cross-trip requests and revocation with a previously valid ETag. Link possession alone authorizes nothing.
- **Correctness:** uses the existing personalView calculation for personal shares, sources, supplier balances and repayments; travellerContext strips shared ledger/roster, booking credentials and private planning fields. Only a number for aggregate trip recorded spending is added, calculated from the existing consumed totals of nondeleted bills. Planning budgets, prepaid-only amounts and friend repayments do not add spending. Tests verify unchanged total after repayment and the latest total after another member's bill changes, without exposing that bill's title/details.
- **Compatibility / recovery:** member and trip IDs keep the URL stable across display-name and plan changes. Removed/inactive members, revoked account grants or deleted trips become unavailable. Existing full-app member projections, share URLs, Money write APIs, session model, CAS and draft recovery are unchanged. The projection is read-only; there is no new retry/write path or schema migration. Account sign-in is deliberately retained from the established boundary rather than adding anonymous financial bearer links.
- **Security / delivery:** no financial/session values enter copied URLs. /member is dynamic, requires hosted sign-in, has noindex/no-referrer metadata and preserves query parameters through sign-in. API responses use private/no-store; the existing service worker keeps navigations and API data network-only. No external messaging, file transfer, new OAuth provider, secret, dependency, role or hosting audience change.
- **Performance / maintainability:** visible-only polling and ETags avoid repeating personal/aggregate calculations for an unchanged authorized revision. The existing whole-group JSON read/normalization remains the first likely bottleneck; full computation remains linear in recorded bills before ledger-specific work. No realtime infrastructure is warranted for this use. Shared itinerary and personal Money components are reused, rather than maintaining duplicate financial/UI implementations.

## Verification and limits

164 focused API, ledger, Money, planner, workflow and SSR regressions passed. New API coverage verifies exact-member authorization, conditional reads, updated itinerary and aggregate totals at the same endpoint, repayments, private-field stripping, cross-group isolation and revocation. New SSR/link coverage verifies a stable member-ID URL after renaming, encoded parameters, own Money and aggregate-only display with no admin actions. TypeScript with current generated Cloudflare declarations and whitespace checks passed. Packaging requires the final Sites production build.

Browser-control skill is unavailable. Actual device layout/compact-header height, clipboard permission, picker focus, hosted sign-in return, live browser polling and background/foreground behavior remain unverified; SSR/API checks are not represented as those interactions. Live account bindings, trips, bills and private preferences were not modified as tests. A code rollback to v62 preserves data, but newly shared /member URLs would stop working until the new route is restored, so a roll-forward fix is preferable once links are distributed.

- **KEEP:** existing hosted identity/account binding, current ledger/personal projection, sanitized itinerary, stable member IDs, CAS and established themes.
- **CHANGE NOW:** compact the primary action row; add selected-member stable links and a server-enforced, automatically refreshed personal portal with the approved aggregate total; implemented.
- **IMPROVE LATER:** supported phone/browser acceptance, optional account-binding guidance refinement and measured optimization of whole-trip reads if active readership warrants it.
- **DO NOT ADD:** anonymous financial URLs, automatic grants, outbound messages, another ledger, polling hidden tabs, a second identity stack or realtime infrastructure for this requirement.

# Screenshot cleanup: reservation classification and Remarks — 2026-10-21

The six screenshots select specific removals. Ordinary Activity/Food entries no longer appear automatically in Booking list. Hotel, Flight, Transport and Insurance remain reservation types. Activity/Food added through Add booking carries an optional validated boolean booking intent in the existing activity JSON and remains visible while Planning; Add plan creates ordinary entries. Older Activity/Food without the flag remains visible only when Booked or bearing a confirmation reference; a Maps URL alone does not qualify. Daily itinerary still contains both plans and reservations, using the same IDs. Overview counts use the same predicate. Creation intent does not fabricate a booking status or Money record.

Member itinerary drops the repeated Today/date heading and Details & map disclosure, including verbose From/To addresses. Short location labels, times, end-exclusive hotel nights and explicit checkout entries remain. Remarks display directly. Complete HTTP(S) links become anchors in member, planner and on-the-go notes; React escapes text, malformed/credential-bearing URLs stay plain text, and external anchors use noopener/noreferrer. Newlines, long-link wrapping and phone link touch targets are preserved.

The editor removes Booking & practical details, Capacity & waiting list and Travel time & arrival buffer. Joining, essential plan/flight fields and Remarks remain. Editing clones and patches the full saved activity, preserving old optional data. Legacy capacity no longer blocks participant changes; waiting-list structure, participant uniqueness and group membership validation remain. Hidden buffer data no longer generates planner warnings or departure suggestions. Genuine overlap, date and cancellation checks remain. Archived helper modules stay for compatibility.

- **KEEP / authorization, isolation and concurrency:** server planning permissions, exact-member portal authorization, sanitized projections, private preferences, account bindings, revision/CAS checks, conflict recovery and single-attempt saves remain unchanged. Rendering/filtering never writes. API regression verifies denied viewer writes, planner saves, old metadata round-trip and zero ledger effects.
- **CHANGE NOW / correctness:** replaced the type-only reservation predicate and removed the six selected UI blocks; no new interface section or broad redesign. Optional JSON intent needs no SQL migration, dependency, secret, binding or audience change. Stored records are not migrated/deleted. If participant counts are saved above legacy capacity, prefer roll-forward: the previous validator would re-enforce that historical limit on rollback.
- **IMPROVE LATER / performance and compatibility:** link parsing is linear in bounded note text; existing whole-trip reads, finance calculation and filter sorting remain the first likely bottlenecks. Optional archived helpers can be cleaned up separately. Templates still allowlist reusable fields and strip booking credentials.
- **DO NOT ADD:** replacement attendance/buffer controls, automatic transfer inference, calendar permissions, financial migrations, anonymous financial links, or copying private booking fields into shared Remarks.

167 API, ledger, Money, planner, workflow and SSR regressions passed. New coverage checks reservation classification/intent persistence and safe clickable Remarks; existing expectations were updated for retired capacity/timing. TypeScript and whitespace checks passed. Sites production build is the final packaging gate. The existing parallel Vite test harness emits a non-fatal HMR-port warning; all tests finish successfully.

Browser-control capability is unavailable. No actual phone/desktop, touch/focus, or external Maps application test was performed; SSR/API checks are not device acceptance. Tests did not modify live trips, roles, bookings or Money.

# Pairwise settlement, source-bound repayments and calculation detail — 25 October 2026

## Current flow and selected behavior

Paid/consumed expenses use the existing integer minor-unit allocation and deterministic remainder handling to produce obligations to their actual funders. Postpaid supplier balances and prepaid-only consumption remain outside friend settlement. The selected Mode A offsets only two opposite obligations between the same pair. It keeps B → A RM10 in the A100/B50 five-member example, and Reyes → ET RM7.94 in the supplied two-expense example. It does not reroute C's payment to A through B.

The old engine netted expenses before applying saved, expense-bound repayments. HIGH correctness defect: after B had paid A RM20, a later A → B RM10 expense could shrink the old claim before the payment was replayed; some actual cash was then ignored. The engine now builds gross source claims, replays each recorded allocation on that source, then nets remaining opposite claims. Source queues index expense/from/to, avoiding a full claim scan for every normal allocation. Cash, source expense and payer records remain unmodified by the calculation. A frozen empty legacy allocation stays empty instead of being reassigned to a new expense on the next read.

MEDIUM reconciliation issue: edits/deletes could leave a historical repayment larger than its current source debt. The source allocation stays in history; unapplied amounts are explicitly shown for review and never silently moved to newer bills. Existing explicit refund/cancellation adjustment behavior still derives a reverse credit from actual earlier cash. The distinction preserves the previously selected old-bill/new-bill policy. When no payable suggestion remains but review items exist, the full Settlement heading asks for review rather than claiming everyone is settled.

## Changes and boundaries

- **CHANGE NOW:** remove the mounted Simplify/indirect-payment preview and confirmation from Settlement. New payment requests with simplified routes are rejected server-side. Existing historical multi-edge allocations are still replayed and undoable; the archived algorithm remains for source compatibility, with no enabled new-payment entry point.
- **CHANGE NOW:** payment confirmation verifies current permission, pair amount and revision. Retrying an identical saved payment identity/details returns alreadyApplied before the stale revision check; reused identities with changed details or undone payments are rejected. Different concurrent confirmations still compete on the existing atomic revision check. Payment IDs, dates, amounts, allocation directions and duplicate direct allocations are validated; safe integer and conservation checks fail closed.
- **KEEP:** original expense/payer/item allocations, payment IDs/amounts/dates, audit before/after, soft-delete recovery, explicit supplier refunds, group-scoped API access, hosted identity and minor-unit arithmetic. No SQL migration, live record rewrite, dependency, secret, permission expansion or hosting audience change is required. This is a code-only roll-forward; reverting restores the old derived-balance defect and should not be used as a financial correction.
- **CHANGE NOW:** View Calculation shows each pair's gross directional debts, reciprocal offset, applied payment allocations, original source bills and remaining suggestion. Unapplied cash is separately labeled for review. Entries initially render 30 sources/payments with continuation. Personal Money and signed-in member links receive only calculation pairs involving their bound member; a third party's other obligations are excluded by the server projection. Existing personal claims/history remain available.
- **IMPROVE LATER:** whole-group JSON parsing, repeated per-member projection/calculation during sync and replay of large unallocated legacy histories remain the first likely scaling bottlenecks. Measure before changing storage. A dedicated reconciliation correction flow can be separately specified; do not automatically reinterpret unmatched cash as a repayment of another bill. Actual handset and live signed-in confirmation/refresh acceptance remains pending.
- **DO NOT ADD:** automatic group-wide rerouting, fabricated payment/expense entries, implicit payment completion, a second ledger, anonymous financial links or new settlement modes.

## Verification and limits

181 API, ledger, Money, planner, workflow, PayLater and SSR regressions passed, with TypeScript and whitespace checks. Five additional built Worker/catalog smoke tests passed. Added exact examples; zero reciprocal debt; payment-before-later-reverse-expense regression in both expense orders; partial/full/undo; changed/deleted/restored sources; frozen empty legacy allocations; invalid/duplicate/excessive amounts; deterministic rounding and 40 generated groups checked against an independent pairwise oracle. API tests cover permission denial, same-ID retry and altered-ID rejection, concurrent revision winners, group isolation and member-only calculation projections. SSR verifies the drill-down and bounded source rendering. Existing explicit-refund and historical simplified-payment regressions pass. Both full-group and member settlement sections show the review notice when no suggested transfer remains but unmatched recorded cash needs attention.

Browser QA used a temporary fictitious fixture, removed before packaging: desktop and a 390px iframe confirmed that RM4 recorded locally changes B → A from RM10 to RM6, that the open calculation shows RM20/RM10 gross debts and RM4 applied, and that removing the source produces a review item. The phone-width body and calculation had no horizontal overflow. This does not constitute a physical-device or live hosted transaction test; no actual bill, repayment, account or role was changed. HTTP-only preview UUID generation and new-file sync issues were isolated to the temporary fixture and resolved through server-seeded data and a supported preview restart. The existing parallel SSR harness emits non-fatal HMR port warnings. Production build and Worker/catalog smoke checks are final packaging gates.

## v88 URL group requests
Directory and URL-selected group now start together; directory still validates selection and chooses a fallback if inaccessible. Captured speculative failure cannot become an unhandled rejection. No ledger, API, permissions or persistence change. Group-request concurrency test and types/build/Worker smoke required. Rollback v87. KEEP balances/auth/features; CHANGE NOW parallel reads; IMPROVE LATER account cache then notifications; DO NOT ADD data migration. User observed HTML4870ms vs app236ms:4634ms outside app, platform boundary retained.

## v90 notifications and v89 refresh cache
See docs/v88-v90-review.md. v89 actual20 refresh304 samples54/63ms p50/p95,1call; retained v88 rollback. v90 preserves original history visibility while merging access/history into1SQL snapshot; count-only initial/poll requests and lazy panel list.58 API tests cover original list equality across roles/groups, read count, inactive/revoked access and one-call budgets. No full ledger transfer/normalize; JSON remains physically embedded and still parsed by SQLite. No schema/data migration or outgoing messages. KEEP permissions/history/financial results; CHANGE NOW query/request scheduling; IMPROVE LATER audit storage only after separate migration approval; DO NOT ADD further scope. Current next rollback v89.


## Phase 3b / v94 candidate — 2026-10-30
Approved A/B/C presentation copy, short statuses, Saved people terminology and Trip/Money selectors; owner-aware error messages preserve uncertain-save semantics. Quick picks no longer submits expenses through a second form. Single responsive add entry; labeled canonical form with dirty Discard and amount focus. Default Match device supports OS events and preserves manual choice; preference endpoint accepts system without a migration. No ledger, allocation, permission, account data or database schema changes.

Validation: full suite (251 tests), typecheck, production build; fixed KL House food1640/toll0/offset32974eachway/ET→YH1640. Live v93 baseline read-only: KL House YC→YH RM51.70 and 39 historical payments. Preview routing returns Not Found; use production read-only smoke after deployment. No local browser/device verification claimed. v93 remains rollback.

KEEP: ledger, original payees, permission/CAS/idempotency enforcement. CHANGE NOW: approved form and copy changes. IMPROVE LATER: user retest and phase3c. DO NOT ADD: duplicate ledgers, new copy-request features, migrations.


### 3b production smoke and final copy correction
Published v94 and verified the live Add expense control opens exactly one editor, focus starts at Amount, clean Escape closes, dirty Escape opens Discard, Keep editing retains entered amount, Discard removes only browser draft and focus returns to Add expense. Tested Dark→night and Match device→current OS light; restored prior manual Light. No expense/payment writes. KL House YC→YH remains RM51.70 and history39. Browser errors observed are extension metadata messages, not application errors. Actual OS appearance transitions are covered by subscription tests; no physical-device switch or target viewport claim.
Final patch pluralizes the dynamic per-payee payment count, simplifies payment-status help and derives new-expense Undo eligibility using the authenticated creator (server permission checks remain authoritative). Final version follows v94; v93 remains baseline rollback.


## Phase 3c release (2026-10-30)

Scope: Money Home now scrolls current-space balances, five recent expenses, monthly snapshot and collapsed charts. You owe and You're owed sum existing directed final transfers independently. Trip Overview integrates the same balance cards, real plan/readiness metrics, budget versus incurred actual consumption, coming-up/attention cards, recent expenses and collapsed charts; editable Trip details remain in a closed disclosure. Personal Money stays on the original My spending-only destinations and renderer. Owner-only upfront chart restored; non-owner uses category.

Recent expense headline and This month both use calculate(bill, settlement).total, the canonical incurred-consumption amount in settlement currency, not cashTotal. This excludes unused prepayments and includes consumed postpaid bills. Personal "You" amounts remain consumed[person]. No ledger, pair allocation, API writes, permissions, schema, migrations or stored bills/payments changed.

Settlement retains existing source selection, revision CAS, uncertain-result retry, actual-payment confirmation, export and history; each directed pair is a card with actual open-bill count and status badge. Batch actions are disclosed via ellipsis. Details and cancelled-out bills expand; Info is a click-driven dialog/bottom sheet. Linked Trip funding remains available after Money Home.

Notifications use existing authorized recent-100 audit events, one query, explicit action-derived kind and local Malaysia day. Actual IDs are deduplicated, then grouped by space/day/kind. Individual copy is the approved three messages; combined title is "{n} updates in {space name}". Empty Needs you is hidden: no new request/invitation data is fabricated. No actor/email is newly exposed. Mark all as read keeps its existing revision-isolated operation.

Validation: final production build via npm test, all262 tests passed (0failed/skipped), and npx tsc --noEmit passed. Tests cover owner/private upfront render gating, unchanged personal navigation/authorization, separate simultaneous owe/owed, incurred-consumption consistency including pre/postpaid/FX, recent-five limit, Trip Overview order/disclosures, skeleton shape, notification grouping/count/visibility and all existing integer/source-bound settlement regressions. Existing UI tests updated for explicitly approved card/Info/Overview behavior.

Mobile header CSS budgets owner normal state at160px to first balance card:44px top row,44px space switch,50px full-width Viewing row,18px metadata,4px separation. Selected names and dropdown contents wrap instead of ellipsizing; normal sync text shares metadata row. Offline/save failure/recovery warnings intentionally remain visible and may add necessary content. No /layout-check route is included. Screenshots delegated to user per latest instruction. Exact375 browser/device height and touch interaction are not claimed from CSS/SSR tests. Preview daemon reports running but browser URL returns Not Found; release browser smoke is performed on normal live viewport separately.

KEEP: canonical ledger and server-enforced personal scope, source-bound payments, v96 rollback, existing appearance and dirty guards.
CHANGE NOW: scope/role regressions and mixed consumption/cash headline fixed before release; no known arithmetic blocker.
IMPROVE LATER: actual375/1280 user retest and long-name layout confirmation; large legacy trip-app/globals files; notification recent100 window remains bounded as before.
DO NOT ADD: expanded member navigation, synthetic notification requests/counts, screenshot-only production routes, accounting/schema/data migrations.


## v97 retest corrections — 2026-11-02

Problem: mobile payment cards were pushed below the first viewport by secondary controls. Move cross-space summary, own payout details, exports and Share into a collapsed "More settlement options" section after the settlement list/history. Move bill filtering and batch actions after recipient cards, and recipient payout/copy/select controls after their cards. Mobile hides the recipient summary toggle and redundant list heading while keeping recipients open; summary combines count and remaining amount, then Mine/Everyone, then payment cards. Existing permissions, filters, recording, retry/CAS, history and outputs remain unchanged.

Root cause of uncoloured badges: status components referenced undefined positive/negative/warning semantic variables. Define light/dark tokens, and use specific selectors against legacy colour rules. Text/soft-background contrast: light positive4.60, negative4.96, warning4.77; dark8.03,7.82,8.17. Cancelled-out continues to use theme primary. Home positive receivables use green; zero amounts/direction labels use neutral text instead of the legacy owes destructive rule.

Home dates now dd/mm/yyyy; notification timestamp is en-GB date + hour/minute in Asia/Kuala_Lumpur. Combined updates body is only "{n} updates" under the existing space-name heading. Desktop sync status is explicitly static in document flow, with no absolute positioning into the balance card.

Validation: production build completed, TypeScript passed; final264 tests passed,0fail/skipped. New render regression verifies payment cards precede filtering, payout and batch controls without changing the ledger; zero-balance neutral state/date formatting and real notification ID counts covered. A pre-existing wide-print test became clock-sensitive after November1 because its base bills used today's date; fix the test's base dates to October26, preserving the original wide-source assertions and production algorithms. No accounting/amount/data/permission/schema changes, no real bills or payments created by QA. Source/outputs keep v97 as rollback. Mobile375 screenshot/position remains for user retest; CSS layout/order checks are not a claim of actual device measurement.

KEEP: ledger, source-bound payments, membership checks and accepted160px header.
CHANGE NOW: first-screen hierarchy, missing semantic tokens, zero/owed colours and formatting fixed.
IMPROVE LATER: user375/1280 light/dark retest; no new product features.
DO NOT ADD: new QA routes, member navigation or accounting migrations.


## Phase4 remaining items + phase5 regression — 2026-11-02

Feasibility: Sites identity-and-secrets reference explicitly allows anonymous requests to public Sites. Current audience public; previous root page enforced requireChatGPTUser itself. The public root now renders only product introduction and a normal platform Sign in anchor. Signed-in rendering and createTripShareSession remain unchanged. Anonymous financial API requests still401; no auth-route reimplementation or platform bypass. Shared app/chatgpt-auth-paths retains same-origin return sanitization and preserves route/hash through platform sign-in.

Invitation preview: same-origin POST, streamed1024byte request cap, strict72char token shape, parameterized lookup, unexpired/unaccepted token and active recipient required. Response contains only owner-bound display name and space name; no token, email, person list or financial data. Reads never grant access or consume invitations. If historical owner display-name binding is absent, say "The owner" instead of inventing a name. Revocation/expiry immediately removes preview. Existing invitation acceptance still independently verifies account and membership.

Animation: completion resolves to explicit opacity1/translateY0; effect interruption stops then commits the final state. Visibility listener cancels title/card animations and commits final state synchronously when hidden. Reduced-motion/hidden CSS forces final title rendering. Mobile sync status moves from recovery overlay into topline metadata grid in document flow, outside balance cards; summary inset12px. No ledger, data model, permissions, currency or settlement changes.

Validation: production build via npm test passed,267 tests passed0fail/skip; npx tsc --noEmit passed. Anonymous production Worker test confirms200 introductory page plus401 trips and fail-closed unconfigured integration. Valid/invalid/expired/cross-origin invitation previews and unchanged DB record tested. Sign-in safe-return/fragment and landing SSR tests added. Existing multi-currency, itemized allocation, prepaid/postpaid, source-bound payments/undo, WhatsApp/export summary, personal authorization and Trip funding suites pass.

Browser QA: actual viewport1363x936, not375 or1280. Created QA Test (QA A/QA B); RM100 QA meal preview splits50/50; settlement B->A50; payment recorded50; Undo reversed it; due restored50; History contains create/expense/paymentBatch/undoPaymentBatch. Untouched Esc closes with0dialogs/confirmations; dirty Esc opens Discard, Keep editing retains data. Writes only QA Test, never KL House or Thailand. Space cleanup and final production smoke recorded in final response. These functional steps ran on v98 before deploying the non-accounting phase4 changes; final release smoke separately checks titles/status/baselines.

Limits: browser advertises no viewport resize or reduced-motion/background emulation. Therefore exact375/1280 two-pass workflow and hidden/reduced browser scenarios are not complete; do not claim phase5 fully device-accepted. Browser screenshot capture timed out. No fake responsive route or new /layout-check added. Platform anonymous landing verified in production Worker harness; signed browser cannot impersonate anonymous identity. Do not claim external WhatsApp message delivery or real-device checks. Console findings and baseline follow-up go in final report.

KEEP: trusted platform identity, server financial authorization, original ledger algorithms and purple/theme preferences; rollback v98.
CHANGE NOW: finished entrance states, bounded invitation metadata preview and two accepted layout fixes.
IMPROVE LATER: exact viewport/media-state user retest and historical owner display-name binding where missing.
DO NOT ADD: auth bypass, another login provider, synthetic invite names, broad ledger migration or live writes outside QA Test.

## Glass × Neon 4a — 2026-11-02

KEEP: ledger.ts, settlement, financial records, schema, all authorization, account-bound invitation acceptance/PIN, existing section destinations, URL tabs/back, unique expense entry, full editor, integration and advanced tools. Real groups remain read-only; rollback v98 and v99 retained.
CHANGE NOW: common semantic Glass/Neon tokens replace the selectable old looks. Legacy persisted style IDs remain accepted for compatibility, not exposed as themes. Unmarked lighting now resolves to Light without rewriting stored values; explicit Light/Dark/system survive unchanged. Two look previews, lighting, animations, touch feedback and advanced Sound remain available. Native spring press/page/nav animations replace heavy legacy MotionLayer; background/reduced-motion finish synchronously. Header space picker contains searchable current-space list and existing Trip/Money selection/new-space callbacks; profile contains unchanged Viewing and Appearance. Desktop240px sidebar/320px context rail, mobile capsule with separate56px unique FAB. Opaque amount surfaces and row cards limit blur to header/nav/one dialog; transparency fallback and reduced mode. System font fallback avoids external font fetches; monospaced amounts/time. Deterministic8-gradient member avatars. Summary inset12px and sync metadata outside cards retained.

Additional approved mapping: invitation acceptance and PIN appear in one invitation region, after the v99 public invitation preview/sign-in; no additional access grant or merged token/PIN authority. More/Advanced includes exact Edge/iPhone install instructions. Pocket Ledger is an existing protected read-only integration API; the editor sentence is informational. Advanced exposes an explanation only, never a fabricated sync/connect action or integration secret. Desktop header search shows Cmd/Ctrl K and existing shortcut implementation remains intact.

Validation: full production build and all269 tests passed, including amount/source/undo, privacy, multi-currency, itemization, prepaid/PayLater, WhatsApp formatters and Trip planning. New contrast tests composite both overlapping blobs at maximum opacity under translucent Glass/Neon surfaces, verifying body/secondary>=4.5:1; semantic positive/warning text uses accessible darker light variants. TypeScript and diff checks pass. Client JS gzip totals are compared file-by-file with independently built v98; final exact measurement reported at release. No new package or schema migration. Browser verification and actual production baselines are reported separately after deployment; no375/1280 or real-device claim without observed capability.

IMPROVE LATER:4b core workflow redesign, Face ID success, gestures/digit rolling;4c Trip/notification/shared-element/background motion. Do not implement these in4a. Font family uses installed/system fallbacks rather than downloading Inter/JetBrains; actual rendering depends on availability. Exact device/emulation, reduced transparency/media switches, hardware60fps and LCP/CLS need a supported browser/device; report limitations honestly. Existing Pocket integration configuration/remote sync are not modified or invoked.

v99 vs v98: anonymous public introduction and platform Sign in; invitation preview limited to valid inviter/space metadata with no financial access; entrance animations commit their final state on interruption/hidden/reduced motion; summary12px inset and sync status moved into metadata flow. These remain preserved by4a.

4a post-deployment QA follow-up: actual browser viewport1363x936; both Glass/Neon final root/background/text verified; no horizontal overflow. QA Test create -> RM100 meal split50/50 -> QA B pays QA A50 -> Undo restores50 -> History confirms create/expense/paymentBatch/undoPaymentBatch. Untouched focused-input Esc closes without dialog; dirty focused-input Esc opens Discard, Keep editing retains fields. Exact Edge/iPhone instructions and Pocket integration explanation verified in More/Advanced. Corrected desktop direct More entry while retaining direct secondary destinations and one active sidebar item; prevent install description changing during its closing animation. Final baseline/cleanup/console checks reported at handoff. Final269-test suite passes after the sidebar update.

## v101 retest corrections — phase4a follow-up, 2026-11-03

KEEP: financial algorithms, schema, permissions, server projections and current records unchanged.5 bounded fixes: vendored Fontsource JetBrains Mono5.3.0 Latin normal400/600/700 (OFL, swap, preload700); exact requested fallback stack. Header compact search icon remains available on phones; label/hint only desktop>=1024+hover. Permanent320px desktop context rail renders scope-safe current-space summary or empty state even when no selection, independent of legacy rail preference; center content max720px plus48px padding. Loading bottom navigation retains4/5 disabled structural destinations, then reverts to original allowed destinations on resolution. Secondary captions/metadata use semantic secondary tokens in both themes. Closed/underlying modals disable blur to retain the layer budget. No new dependency or font service request.

QA gate: original account-bound API/ledger/privacy suites and type/build must pass before4a publication; then read-only verify KL House51.70/39 and Thailand5312/482.93 before proceeding4b. Any financial or permission failure is a stop condition, per latest explicit user authorization. Tests added for loading skeleton navigation versus resolved personal scope.4b will be a distinct publication;4c remains deferred.

## Phase4b implementation review — 2026-11-03

Current flow: group permissions and revisioned server projections -> unchanged ledger -> Home/list/card presentation -> canonical ExpenseEditor or source-bound payment batch -> existing authenticated mutation -> authoritative refresh. UI gesture alternatives dispatch the same existing edit/duplicate/confirmed-Trash/record-review callbacks. No gesture saves or deletes directly. Home's two directions filter only the already-authorized transfers. Monthly/recent totals remain canonical incurred consumption; graphs/next-trip use real accessible records, not invented metrics. Home loads the existing authorized across-group endpoint in the background to obtain upcoming Trip metadata after first paint.4a corrections were deployed independently asv102; live verified51.70/39 and5312/482.93 before4b began.

CHANGE NOW implemented: one balance hero with separate owe/owed and neutral All clear, next Trip within30days, month+7day actual bars/meaningful prior-month comparison, recent5, collapsed Charts. Expense search/chips/date groups and original-currency rows with settlement-currency day totals, my share, visible actions and scoped previews; desktop selected context uses original detail renderer. Canonical editor now one amount-first full-screen panel with one pinned Save, visible labels, payer avatars, split avatar amounts from canonical allocation, Everyone/Just me, retained presets, and existing currency/itemized/advance/PayLater/refund/tax/discount/multiple-payer controls under More options. Existing dirty/duplicate/edit-confirmation and server validation remain authoritative. Live side preview retained. Settlement adds real source progress, avatars, full/part amount choice, existing details/reminder/batch/export/payout/history preserved. Partial choice requests user input, never invents a payment amount. Native damped spring interactions and amount glyph changes only format existing integers. Success ring/check only follows confirmed writes; full confirmed pair uses enhanced ring, Undo separate. Failure/uncertain paths emit no success. Haptics limited to success/settled/threshold/refresh/invalid-field and respect existing Touch feedback. Unsupported vibrate fails silently. Pointer following left-swipe/long-preview and right-swipe open existing actions/review; delete always asks, drag-close uses existing guard. Pull refresh uses existing loader and lock.

Verification: API/ledger/privacy regression suites stay unchanged; new actual React DOM tests use Happy DOM as a development-only dependency for edit review, guarded Escape, 403/409/500 failures/no success, confirmed full-payment feedback/skip and explicit partial input preserving sources. Original top Save snapshot now checks the one pinned footer instead. Test data in tests are synthetic in-memory QA Test; live data writes only the disposable QA Test workflow. No ledger.ts/API/schema/permission implementation changed. Full tests, TypeScript, production build, cumulative client JS againstv98 and post-deployment browser QA remain release gates. Retainv102 for rollback.4c Trip/date gestures/shared transitions/notification redesign/background motion remain separate and are not included.

Risks to verify: CSS responsive layouts and native pointer behavior in actual mobile viewport, real-device touch/haptics/reduced-motion, browser console and rendering performance. Do not claim exact375/1280, real-device60fps/LCP/CLS or unsupported media emulation without observation. The user explicitly authorized proceeding4b after4a publication, but a financial or permission regression requires immediate stop.

Final pre-publication gate:279 tests passed, TypeScript passed, production build passed; no changes to ledger.ts, settlement-recording, API, database or permission implementations.8 new DOM/feedback tests include explicit partial input and authoritative refreshed-ledger proof before enhanced pair-settled feedback; equal old amounts/retries/new obligations/unapplied cash cannot fabricate settlement. Existing personal-page filter layout remains open and unchanged; new search/chips/date stream apply only to Expenses. Stream renders40 at a time with Show more and caches canonical bill calculations; actual whole-day totals are labelled if only part of the day is rendered. Save footer remains visible with error banners. Current browser explicitly blocks DevTools, so exact responsive emulation is unavailable; do not bypass that policy. Actual desktop1363x936/live QA and final baseline/cleanup/console status reported after publication.4c remains paused.

Final CSS review: legacy glass IDs cannot add blur to editor/preview cards outside the app root. Settlement's inner layout is one column now that the global320px context rail is permanent; balance/history stay below its payment cards. No functionality or arithmetic changes. FinalJS byte count and native publication version recorded in the handoff report.

Live4b QA found and corrected two CSS collisions before handoff: legacy entry-grid align-items:start constrained the footer/drag zone to intrinsic width, and the Field>span rule overrode the hidden alternate payer picker. Explicit scoped stretch/width and hidden picker rules fix both. Untouched Esc closed directly; dirty Esc opened the approved Discard dialog; live preview100 split50/50 correct. These are presentation issues, not amount/permission failures. Continue the same4b QA after the corrective publication; do not begin4c.


## 2026-11-03 approved HTML direction — UNPUBLISHED 4b draft

Source reference: user attachment TripShare-全功能设计.html. Read source and opened in browser; inspected Phone Glass, Desktop Neon, Trip, expense and profile controls. Sample records not copied. Live version checked via Sites: v104, source879f2089b0d0361e454c19877c0a5d5917b4253b.

Implemented draft: final semantic neutral Glass / restrained purple dark tokens, panel/border/radius/spacing overrides, 240/720-content/320 layout, original 4a font/shortcut/loading-nav/secondary-copy corrections retained; Home dominant-direction hero plus both gross owed/owing cards (never netted);600ms cubic visual amount counter with final aria value and reduced/hidden finish;350ms8px main entrance; restrained pointer highlight; .98 press. No schema/API/ledger/permission edits.

BLOCKERS: official dependency install failed downloading integrity-pinned Vinext0.0.50 (curl connection timeout15s). Existing other-project packages contain Vinext1.0.0-beta.5 and no motion/happy-dom; not substituted for build. A temporary symlink used for diagnostic TypeScript only returned missing motion module and its inferred-type error in unchanged experience.tsx; this is NOT a successful typecheck. No production build, full tests, JSgzip budget measurement or app rendering QA completed. Browser signed out; current live app shows public intro then OpenAI sign-in. User handoff requested. Baseline financial and permissions checks NOT rerun. No real-group writes or QA writes made.

Data-supported mapping: departure countdown uses Event.start/end; budget uses Event.budget and canonical tripFinance; checklist uses Event.checklist; payment method can use existing payment.note as text only (no structured method field; no backend classification/filter/statistics promised); activity stream has permission-scoped notifications, generic grouped records may lack typed per-update detail so a reliable Expenses/Payments/Members filter is not yet established. Quick add can prefill the existing canonical form but adding visible extra add-entry conflicts with retained unique+ requirement; not implemented pending clarification. No default-account-currency or short invite-code persistence added; mock examples are not capabilities.

4c NOT STARTED: await successful4b build/QA/publication, then implement Trip chronology/notifications/restyled supporting pages separately. KEEP existing financial and access boundaries; CHANGE NOW restore exact dependency install and authenticated baseline/QA before publication; IMPROVE LATER measure actual viewport/performance; DO NOT ADD backend methods/invite-code APIs or mock records.


## Approved HTML 4b — release gate update
Locked npm install recovered and passed with unchanged lockfile. Full TypeScript passed, production build passed and279 tests passed before final payment-note preset refinement; final gate is repeated at packaging. First matching v98 client gzip reference316363bytes; current built output280140bytes, delta−36223bytes (measure final package again). Removed the remaining full Motion import from AnimatedMoney in favour of the shared native counter, no new runtime dependency. Method presets Cash/Bank/DuitNow write only existing note text, preserve custom note, no method column/backend filter added. Quick add remains within canonical editor presets/categories; unique+ preserved.
Authenticated read-only before release: KL House YC→YH51.70 and Past payments39; Thailand Money Home spending5312.00 and YH owesFZ482.93. No live writes made this turn. 4a5 corrections retained in source at v104. Browser actual1363×936, no375/1280 claim yet. 4c deferred to a separate release after4b financial and permission verification.


## Approved HTML4b v105 verified;4c implementation
4b published independently v105 c56a4f427e11dde5ec75b7fbed4ef5542e3ef72b. Live1363×936 Light and Dark inspected. Font loaded true; sidebar240,right320,nohorizontaloverflow; Dark background#0B0918/secondary#A8A3C2; one visible blur plane on desktop. QA Test created in prior authorized QA workflow was reused: added QA4bglass20 split10each; unchanged Esc closes; dirty Esc confirmation onlytitle,Keepediting resumes. Recorded full60 for2bills after checking Paypart0 disablesconfirm; DuitNow fills existingnote. Undo receipt reversed60,remaining60 restored;History contains expense/paymentBatch/undoPaymentBatch. All live financial writes confined toQA Test;cleanup follows4c QA. Read-only KL stillYC→YH51.70/Pastpayments39; Thailandconsumed5312/YHowesFZ482.93.
4c: actual-date Trip departure/travelling/completed hero, real consumed/plans/booked/preparation counts and actualbudgetprogress;Itinerary action retained. Four-item Trip phone pill per newHTML,Itinerary in Overview andMore;desktopdirectdestinations andexistingURL routes retained. Native grouped notificationfilters only for server-supplied actual kinds; unclassifiedupdates stayAll;noMembersfilter/inventedcounts. Notificationdrawer/profile/More/History/People/Itinerary glass styling and skeletonsweep;reducedmotion disables sweeps and active successanimation. No backend/schema/ledger/access changes. Unsupported accountwide defaultcurrency,shortinvitecodes and structuredpaymentmethod remain omitted. Quickadd stayswithin canonicalform to preserve unique+ requirement.
Added3 displaytests for actualTrip data,overbudgettrack andinvaliddates. UpdatedoldOverview-order expectation to latestTriphero-first design andphoneTripnav expectation5→4,retaining access/route checks. Initial4c suite281/282;onlyfailure was supersededOverview-order assertion,not accounting/access. Finalgate repeated after correction. No375/1280exactbrowser verification orreal-deviceperformance/haptics claim.

## v106 live regression correction
Trip View itinerary click revealed a pre-existing4b absolute .balance-go hit area covering main (788×2051px) when showSnapshot=false omitted balance-hero. Corrected the containing block on every home-balance; no ledger/data/permissions change. v106 not marked complete; publish corrective4c after build and verify actual hit rectangles and itinerary navigation. Amounts after counter finishes:Trip5312.00,owes482.93,zeroowed. Live QA notification/source and final cleanup still pending.

4c v107 hit-area fix verified live:each balancehit344×168.5 within346×170.5 card;Viewitinerary now opens tab=itinerary and retains daily/bookingmodes,all6days,3firstdayplans andexistingdetails/actions. Final form alignment promotes Category fromMoreoptions to visible iconchoices using exactly existing7categories;Bills frommock is not added/mapped. No backend change. Final checks repeated before publishing this alignment.

## Final semantic text verification
Live computed descendant colours exposed a retained legacy alias cycle:workspace --text-secondary→--muted-foreground→--text-secondary. Root tokens were correct but child values became invalid, leaving some descriptions in inherited primary/negative colours. Added a concrete approved semantic source and resolved workspace/dialog aliases against it;verify descendantRGB(110,110,115)Light/RGB(168,163,194)Dark after release. This is a CSS-only4a-followthrough correction, no data/math/access edit. v108 final QA saved10Transport, recorded65/undid65,History verifiedboth;all writesQAonly. Final appearance preference restoredLight. Screenshotcaptures beforethiscorrection are internal only,replaceafter finalverification.
