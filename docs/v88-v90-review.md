# v88–v90 loading follow-up — 28 October 2026

All three phases were published separately. Final live release: **v90**. No schema migration, ledger rewrite, real payment, notification-read-state write or outgoing message was performed. The temporary browser transport interruption recovered; all production sampling below subsequently completed.

## What changed and why

**v88:** app/trip-app.tsx and lib/group-request.ts start the URL-selected group request before awaiting the directory. The directory still validates selection and chooses an accessible fallback. A discarded speculative failure is captured immediately. tests/group-request.test.mjs verifies immediate start and rejected/discarded reads. This removes the serial directory dependency; it does not reduce the work inside the group API. No claim of an independently measured400ms browser gain: the browser driver does not expose the Network waterfall.

**v89:** app/page.tsx passes the verified stable account ID; lib/group-cache.ts stores scoped data and its ETag together under account ID + email, never a session token. app/trip-app.tsx restores it before network completion and revalidates in parallel with directory.24-hour expiry,8-entry cap,1.5MB per-entry limit. Corrupt, blocked or full storage falls back to network. Account switch purges other-account snapshots. Directory removal/denial clears cached group;401 clears account cache. Cached view shows Checking latest data; central ledger save requests are blocked until successful validation. Mutation attempts clear persistent snapshots; successful full responses and valid304 refresh stored data/timestamp. The previous cache may briefly show stale, previously authorized data until revalidation; it never authorizes a server operation. Tests cover same-account reload, account isolation, expiry, invalid data, clear/remove and unavailable storage.

Previously304 could only occur on in-memory periodic/manual refresh or group revisit with an ETag. Whole-page reload lost that memory. v89 restores both snapshot and ETag, so unchanged reload sends If-None-Match and receives304. First visit, expired/evicted/blocked storage or changed bills/permissions/bindings still returns200. The first v89 cache fill returned200; subsequent production reloads returned304. Actual UI showed cached RM16.40 while Checking latest data was visible, then the same balance after validation.

**v90:** app/collaboration.tsx requests only /api/notifications?count=1 initially and during closed-panel45-second polling; opening the panel fetches the list. app/api/notifications/route.ts joins grants/active-member checks/history in one SQL snapshot, preserving original auditVisible rules and exclusion of the current actor. Limits remain last100 audit entries per group and latest100 visible notifications overall. Own workspace read timestamp determines unread count. Count response is only {"unread":44},13 UTF-8bytes; list still has44 unchanged notification items, with unread count added at response level. No full ledger JSON is returned to the Worker, normalized or replayed. tests/api-v2.test.mjs compares old visibility output across3groups/4roles and covers count/list parity, read timestamp, inactive/revoked access and1-query budgets.

## Production samples

Each set contains20 successful authenticated application requests on the cloud-browser path. Percentiles use nearest rank. Sanitized per-request evidence: [JSON samples](v88-v90-samples.json). No browser TTFB or Malaysia latency guarantee is inferred from these service timings.

| Set | Status | Total p50/p95 ms | DB wall p50/p95 ms | Calls/request | Body bytes |
|---|---|---:|---:|---:|---:|
| v88 scoped group | 200 | 144 / 419 | 144 / 419 | 1 | 171627 |
| v89 unchanged reload | 304 | 54 / 63 | 54 / 63 | 1 | 0 |
| Notifications before v90 | 200 | 446 / 487 | 446 / 487 | 6 | 9967 |
| v90 unread count | 200 | 85 / 92 | 85 / 92 | 1 | 13 |
| v90 panel list | 200 | 90 / 102 | 90 / 102 | 1 | 9979 |

| Server-Timing stage p50/p95 ms | v88 group | v89 reload | Old notifications | v90 count | v90 list |
|---|---:|---:|---:|---:|---:|
| session / identity | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| app_trip_query | 144 / 419 | skipped | 172 / 199 | merged | merged |
| app_access | merged | merged | 274 / 288 | merged | merged |
| app_version_query | n/a | 54 / 63 | n/a | n/a | n/a |
| app_unread_query | n/a | n/a | n/a | 85 / 92 | n/a |
| app_notification_query | n/a | n/a | n/a | n/a | 90 / 102 |
| render/projection/history CPU | 0 / 0 | skipped | 0 / 0 | skipped | skipped |
| serialize | 0 / 0 | skipped | 0 / 0 | 0 / 0 | 0 / 0 |

Zero synchronous CPU clock readings do not mean free work; Worker clock resolution does not resolve those spans. Identity uses platform headers in these samples; session fallback can add one DB lookup. DB counts are counts rather than milliseconds. Stage percentiles are not additive. Merged means authorization is evaluated in the same SQL snapshot, not removed. For counts/list the SQL engine does more JSON work per query (observed count engine roughly30–39ms), trading that for eliminating five serial network round trips; total wall time falls substantially.

## Verification and limits

v88 concurrency regression, v89 cache regressions,57 existing API tests, TypeScript/build/Worker smoke passed. v90 passed58 API tests plus TypeScript/build/Worker smoke. These are targeted checks, not a claimed full-suite run. Production browser verified unchanged44 unread/list count, panel loading, completed list, cached reload/304 and Settlement ET→YH RM16.40. No Mark all read, Record or Send action was used. [Actual live screenshot](v90-live.jpg) is the browser's1348×926 viewport, not a phone-device test. Layout/styles were not redesigned.

Audit is physically embedded in group JSON. SQLite still parses the needed JSON fields and iterates history; this is not a claim of zero database JSON scanning. Removing that work entirely requires a separately approved data-structure migration. No such migration or index change was attempted.

User matched HTML TTFB4870ms with application236ms:4634ms is outside app handling, again consistent with the platform ingress/auth/dispatch/startup boundary. Exact platform component remains unobservable. Application code cannot eliminate that delay. Retained gzip remains ineffective end-to-end; no further compression work.

## Recovery

All versions belong to appgprj_6a9f7a8cbf54819181bcd927d63bc32d. Saved versions and matching source/build archives are retained.

| Release | Saved version suffix | Source commit | Rollback |
|---|---|---|---|
| v88 | appgver_0b24bbb883408191aeaaa94bab8f39c3 | b94ba7a4d329375eb87940699160b42edeb8a74f | v87 |
| v89 | appgver_d072e85be0a48191b57e996c65bab06b | 2edd380141f15874ca1e99eca468c77d429e8f06 | v88 |
| v90 LIVE | appgver_958ecd75d30c81919550fc3f12b5ddfd | d5dd88b255e75620e1cb0c0c3a17fab82fce106b | v89 |

KEEP: permissions, ledger/payment history, existing functions and read state. CHANGE NOW: parallel initial reads, account-isolated data+ETag cache, count-only polling and one-query notification projection shipped. IMPROVE LATER: audit storage only after separate migration approval if scale measurements justify it. DO NOT ADD: unrelated changes, outgoing messages or schema migration. Work stops here for user review.
