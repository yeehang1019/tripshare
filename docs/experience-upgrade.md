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
