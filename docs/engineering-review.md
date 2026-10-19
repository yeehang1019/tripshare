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
