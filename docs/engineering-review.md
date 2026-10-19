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
