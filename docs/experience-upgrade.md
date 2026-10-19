# Shared spending experience

TripShare remains a shared Trip/Daily ledger. It does not add AI, receipt OCR, voice recognition, or an independent personal bookkeeping system.

## Personal view

The overview uses the authenticated account's `grants.person` in each group. Owners without a binding can explicitly select a member, with excluded groups disclosed. Consumption uses expense dates. Payments never add consumption. Supplier postpaid bills, prepaid cash, amounts owed to friends, and amounts receivable remain separate.

Cross-group counterpart aggregation uses opaque account-link UUIDs for unambiguous email-bound grants. Names alone never merge. Each group settles independently. MYR overview conversion uses saved personal rates or the group's saved MYR rate; missing rates are disclosed and excluded. These estimates do not change original currency or ledger rates.

## Templates and appearance

`personal_workspace` stores per-account templates, overview rates, visual style and optional sound/haptics. Email is the existing application identity binding across signed-in devices; the server derives it from trusted authentication/session identity. Revision compare-and-swap rejects concurrent edits. Templates are data only, never bills. New expense IDs are generated for each use.

Arcade, Cosmic and Glass share the same functions and ten palettes. Full motion is the first-upgrade default, except an existing Battery setting. Users can subsequently choose Balanced or Minimal. System reduced-motion preferences override animation. Optional audio is generated locally after user interaction; haptics depend on browser support.

## Invitations and private payment details

Invitations grant personal Member access only. The owner selects a member and may restrict acceptance to an email. A random one-use link expires after seven days. Acceptance requires sign-in and cannot overwrite another member/account binding. Email entry restricts an invitation; no email service is configured and no mail is sent automatically. Invitations must be shared manually.

Payment details are not part of group JSON, public exports, or shared read links. Only the bound owner can edit. The owner chooses viewers; recipients must have confirmed accounts. Viewer email bindings are snapshotted server-side, so reassigning a member does not inherit access. Every read rechecks both owner and viewer membership. Optional external QR URLs have the privacy of their external hosting; bank/DuitNow text is protected by this application.

## Simplified settlement

`settlementPlan` routes claims through existing debt edges and returns fewer transfers only when possible. It is a deterministic reduction, not a globally optimal transfer-count solver. Residual cycles remain; no debts are silently cancelled.

Preview never mutates the ledger. The server recomputes the plan against the supplied current group revision when recording actual money paid. Client allocations are discarded. Indirect payments store allocations with original expense and debt-edge `from`/`to`. Partial payments clear each relevant edge by the same routed amount. Undo restores those claims. Editing/deleting an expense cannot credit unrelated new bills.

**Rollback:** after an indirect simplified payment is recorded, pre-upgrade ledger readers cannot interpret its edge allocations correctly. A visual rollback must retain the upgraded allocation reader. Do not deploy a pre-upgrade ledger implementation over data containing simplified payments. The additive database migration itself is backwards-compatible and does not modify existing bills.

## Trip album and funds

Private JPEG/PNG/WebP photos are stored in R2 with D1 metadata. Reads require membership in the trip; writes require owner or planning permission. Client-side resizing/re-encoding strips metadata. The server caps streamed request size, checks file signatures, restricts MIME types, and enforces a 100-photo group limit atomically. Photos do not book expenses. No public image URLs are generated.

Trip funding estimates compare active plan budgets with linked bills and recorded cash paid, including unpaid unlinked supplier bills once. Planning figures remain separate from actual expense debt.

## Validation

The API suite covers invitation takeover/replay, email restriction, workspace concurrency/isolation, private details, indirect partial payments and undo, new-expense isolation, and private image access/type checks. Ledger and planning regression suites remain. SSR tests cover the overview, templates, settlement preview and deposit/supplier funding calculations.

Managed browser QA was unavailable in this environment; responsive layouts and motion are not a substitute for actual device checks. Phone/desktop interaction, external OAuth invitation handoff, audio/vibration support and real uploaded-photo display should be checked in a signed-in production session.

## Trip Planner: clearer planning and shared Money records (2026-10-19)

- Planner surfaces and controls use the same theme tokens as Money in all three light/dark themes. No additional decorative gradients.
- Overview shows upcoming plans, unfinished preparation and schedule warnings. By-day and all-days itinerary views support search, status and traveller filters; booking type can be combined with those filters.
- Conflict hints use entered local times and intersecting participant lists. Hotels, cancelled plans, inferred travel durations and timezone conversions are excluded. At most 20 hints are computed; hints are advisory.
- `lib/trip-finance.ts` is the shared summary for Money's TravelFunding and Trip costs. It converts bills through the existing ledger calculator, excludes deleted bills and repayments, and distinguishes incurred spending, supplier unpaid amounts and unconsumed prepaid funds. Estimates never create debt. Cancelled plans retain their actual bills; bills without a current plan remain in totals.
- Trip expense entry uses the existing expense editor and API, preserving the expense ID on edits. Recording from Trip keeps its section and selected day; the same record appears in Money. Only the existing server permissions authorize financial writes. Restricted members do not receive or display full group costs.
- No storage migration or permission change. Existing revisions, audit entries and integration change cursors remain in use. A frontend rollback requires no data rollback.
- Validation: typecheck, planner/finance/render checks and existing API/ledger/settlement regressions. Browser interaction and visual verification are unavailable in the managed environment and remain unverified.

## Hybrid layout (2026-10-19)

The approved mixed design combines modular overview sections, a paged master/detail workbench and focused editing sheets. Money dashboards, member-only Money views, Trip overview and trip funding no longer stack every secondary view beneath the default overview. Itineraries, bookings, trip costs and expenses render six list rows per page and one selected detail, with total record counts always visible. On phones the workbench switches between list and detail with a Back action. Existing filters and financial totals still include every matching record.

`app/focus-workspace.tsx` owns the reusable section switcher and workbench. Inactive sections are unmounted, so expensive charts are rendered only when opened. Unsaved Quick Picks and trip basics lock local section switching until saved or cancelled. Modal expense/plan edits retain the background page, filters and selection. Save remains available in the editing header; existing edit confirmation and duplicate checks apply to both Save buttons. Failed saves display the server error inside the sheet.

No additional permissions, database migrations or financial write paths were introduced. API revision checks, original expense IDs, sync history and ledger calculations remain unchanged. Browser visual/device verification is still unavailable; automated checks cover bounded row rendering, selected-detail fallback after filtering, section laziness, draft switching locks and header-save validation in addition to the existing finance and access regressions.

## Existing-function corrections (2026-10-19)

- Repeat last now remaps item-specific discount references to the new item IDs. Previously the copied bill reset `discountItems` to an empty array, widening a targeted discount to every item and changing individual consumption while leaving the receipt total unchanged. The copy retains all-item discount semantics and rejects missing referenced items instead of silently widening them. The source bill is not modified.
- Cross-group settlement aggregation is memoized and only runs while Settlement is open. Changes to the authorized records or selected member invalidate the memo; typing unrelated filters or editing a draft no longer rebuilds every group's ledger. Financial formulas and original group boundaries are unchanged.
