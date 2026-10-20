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
