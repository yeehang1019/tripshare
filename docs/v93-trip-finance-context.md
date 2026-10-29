# v93 — Trip finance context and desktop navigation

## Problem and fix

v92 inferred the workspace from the page name, so shared financial pages implicitly changed Trip to Money. v93 stores workspace independently and preserves it for shared financial destinations. Explicit Trip/Money switches still change workspace. Trip Expenses/Settlement use exactly the existing financial render paths and canonical record data, not a copied ledger or planning estimate. Trip URLs now include tab=expenses/settle and secondary view routes; refresh/back use the same permission-filtered routing.

Desktop Trip lists Overview / Itinerary / Expenses / Settle up, divider, then permitted Checklist / Trip tools / Preview member view / My spending / People & Access / History / Settings. Money already exposes secondary pages directly; tested that neither desktop sidebar wraps them in More. Mobile More and five/four primary destinations remain.

## Changed files

- app/trip-app.tsx: separate workspace state, preserve context across finance navigation/editor/conflict flows, keep personal financial branch and permission checks, display existing management/history in Trip context.
- lib/trip-navigation.ts: financial/secondary Trip URL mappings and workspace transition helper.
- app/workspace-design.tsx: direct desktop secondary destinations and divider.
- tests/trip-navigation.test.mjs: context transitions, shared URLs, direct sidebar ordering/active state and permissions.
- AGENTS.md: latest authorized scope.

No ledger/API/schema/settlement component changes. No user data migration or edit.

## Verification

246 full-suite tests pass, zero failed/skipped. TypeScript and production build pass. Fixed KL House regression: food1640sen, toll0, offset32974eachway, ET→YH1640sen. Initial test extension exposed a test-runner lifecycle issue (Vite closed before a late module import); moved module loading before test registration, then reran the full suite successfully.

Production verification follows publication. Before deployment, same-account Thailand Trip Money shows YH→FZ RM482.93. No financial writes or messages used for QA.

## Rollback and limits

Retain v92 saved version appgprj_6a9f7a8cbf54819181bcd927d63bc32d~appgver_7ea8018110f88191b7872a4eeb225f48 and /workspace/tripshare-v92.tar.gz. No database rollback required.

Browser viewport resizing is unavailable. Capture actual online screenshots honestly, not simulated target-size images. Member-role filtering is unit/SSR tested; no second member account login assumed.

KEEP: canonical accounting/data and server authorization; existing financial UI reused.
CHANGE NOW: preserve Trip context and expose desktop secondary links directly.
IMPROVE LATER: System theme3b; header<=160px3c; separate copy-table review before3b. Existing monolithic TripApp warrants gradual extraction, not an incidental rewrite in this release.
DO NOT ADD: duplicate ledger, schema migration, new roles, unrelated redesign.

## Live publication and comparison

Published v93 successfully29Oct2026 17:01MYT; saved version `appgprj_6a9f7a8cbf54819181bcd927d63bc32d~appgver_9e5975b5a338819180256576806960e3`, production source `4a3db16c86092068854ae3e96d9f09218bb11355`.

Same-account, same Thailand Trip, same YH selection: Money settlement page text was captured before deployment; v93 Money matches it exactly. v93 Trip Settlement page text also matches it exactly (YH→FZ RM482.93). Trip and Money Expenses overviews match exactly (5records,RM5312.00); every currently rendered RM amount, including list totals and selected bill splits, matches in order. No balance edits, recordings, reminders or messages were made.

Trip sidebar Expenses and Settle up now retain `space=trip&tab=expenses/settle` with the same group ID. Both routes preserve Trip on refresh. Back/forward Expenses↔Settlement stays in Trip. Trip bottom-nav DOM retains all five entries with correct aria-current on Settle up; actual mobile viewport not emulated, so not claimed as mobile rendering verification. Desktop sidebar is240px, all11 permitted entries exist directly, no More wrapper; Money has eight direct entries. No horizontal document overflow observed. Sidebar scroll preserves access to Settings on shorter viewports. App-origin console error query returned[] (browser extension metadata errors are not app failures).

Real screenshots saved as v93-trip-settle-live.jpg and v93-trip-expenses-live.jpg; actual dimensions1348×926. No375×812 or1280×800 screenshot fabricated. User independently verified v92 at those sizes; v93 exact-size manual acceptance remains unperformed by this tool.

Completed and stopped. No3b/3c implementation; global copy rewrite table must be submitted separately before3b.
