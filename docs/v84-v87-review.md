# Read-path follow-up

v84: GET trips no longer seeds account links; identity keys are seeded on binding changes, accepted invitations and first session creation. Existing key values retained. Browser Server-Timing counts now use numeric dur fields as well as descriptions: db_calls/app_db_queries values are counts, not milliseconds. GET regression verifies SQLite total_changes does not increase.62 focused/API tests passed.

v85: lightweight authorized directory, scoped group response, session-local group memory and per-group ETags. Initial dashboard uses Group snapshot; My overview loads all groups on explicit request, Across my groups loads when opened, search loads its full authorized scope on demand. Existing unscoped API retained for these deferred views/compatibility. Failed/removed group clears cached display. Writes invalidate cross-group readiness. No false zero cross-group totals displayed before loading. 56 API tests/types/build/Worker smoke passed. Browser checked single-group171627-byte response, switching Jb and full overview receive16.40.

v86: metadata-first conditional GET includes revisions, ownership, current grants, active people, canonical account-link keys and creation permission. Unchanged request returns304 before full data retrieval/ledger replay/serialization. Full200 query rechecks all access/binding information with data in one SQL snapshot, avoiding stale preflight permissions.57 API tests passed including binding key, expense, payment, permission and inactive-member invalidation, same-account equivalence and a one-call304 budget.

Production UI QA caught incomplete schema2 directory placeholders in v86. Immediately rolled back to saved v85. v87 replaces placeholder normalization with a dedicated complete empty Event constructor. Regression test covers both Daily/Trip kinds and safe ledger consumption. v87 carries the v86 API change; version86 is not the final approved deployment. Previous saved versions and archives retained; rollback target for v87 is v85 because v86 is known bad.

Platform boundary: user matched HTML TTFB4739ms vs app226ms (~4513ms outside application); another304ms vs169ms. Application cannot remove intermittent pre-handler gateway/auth/dispatch/startup delay. Which platform component is responsible remains unobservable. Compression ineffective end-to-end: browser encodedBodySize=decodedBodySize372623 despite Worker gzip. Code retained; no further compression attempts or claims that a specific hop is confirmed stripping it.

Measurements (cloud-browser path,20 successful samples each): v84 total/db p50142ms p95383ms,4 calls. v85 scoped KL total/db p50119ms p95381ms,4 calls. Session/render/serialize clock readings0: header auth avoids session query, synchronous CPU unresolved. These do not promise identical Malaysia TTFB. v87 measurements pending production QA.

KEEP: financial data, authorization, ledger and full functions. CHANGE NOW: read-only binding lookup/scoped load/early304 and placeholder correctness. IMPROVE LATER: notifications only after user approval. DO NOT ADD: schema migrations or further compression work.

## Final production results — 28 October 2026
Final live release is **v87**. Twenty samples per set; nearest-rank percentiles. These are authenticated cloud-path application timings, not user-region browser TTFB. [Sanitized request evidence](v84-v87-samples.json).

| Set | Status | Total/DB p50 / p95 ms | Calls | JSON bytes |
|---|---|---:|---:|---:|
| v84 all groups | 200 | 142 / 383 | 4 | 372623 |
| v85 current group | 200 | 119 / 381 | 4 | 171627 |
| v87 current group | 200 | 71 / 320 | 1 | 171627 |
| v87 unchanged group | 304 | 32 / 83 | 1 | 0 body |

| Server-Timing stage | v84 p50/p95 ms | v85 p50/p95 ms | v87 200 p50/p95 ms | v87 304 p50/p95 ms |
|---|---:|---:|---:|---:|
| session | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| app_owner | 35 / 49 | 28 / 91 | merged | merged |
| app_trip_query | 82 / 316 | 61 / 312 | 71 / 320 | skipped |
| app_access | 29 / 39 | 27 / 36 | merged | merged |
| app_links | 29 / 33 | 31 / 43 | merged | merged |
| app_version_query | n/a | n/a | n/a | 32 / 83 |
| projection/render | 0 / 0 | 0 / 0 | 0 / 0 | skipped |
| serialize | 0 / 0 | 0 / 0 | 0 / 0 | skipped |

Percentiles are not additive; queries can run concurrently. Owner/access/links work is consolidated in trip_query/version_query in v87. Synchronous CPU clock readings of zero do not prove free work. One v84 session lookup was38ms, below p95. v87 unchanged304 and unconditional200 each use1call; changed conditional200 uses2. Session fallback may add1call, empty-directory ownership fallback may add1. Permissions are rechecked with full data in the same SQL snapshot on a miss.

v85 scoped body is54% smaller. Production browser verified group switching and deferred overview. v87 browser verification: Daily labels correct, Settlement net still RM16.40. No payments recorded or messages sent.

v87 deployed08:18:33UTC; all final samples after this. v86 rollback to v85 succeeded08:14:41UTC. Dedicated complete empty Event constructor is in lib/group-directory.ts; regression tests in tests/group-directory.test.mjs. API57 tests, TypeScript, directory regression, production build and Worker smoke passed before v87. No full-suite claim.

### Recovery references
All saved versions belong to appgprj_6a9f7a8cbf54819181bcd927d63bc32d.

| Release | Saved version suffix | Source commit | Rollback |
|---|---|---|---|
| v84 | appgver_4c7baa3a8ec08191a62aa1b362f39f64 | e2661f17e776e0fe5074a25a3b604186fb1a6cf1 | v83 |
| v85 | appgver_672111cc11b48191ab747242e9492f37 | 3c33db6d23561b7a5c349f3952f1c491d8fc7a48 | v84 |
| v86 rolled back | appgver_b1a74059565c8191b8093dbaedc69b2f | 5b738ae26c933362946924f5a7bb4e6657aa03a9 | v85 |
| v87 LIVE | appgver_b1cc64c4acb481919960bdb0a3c02a8e | cf78052f2823f017121ce28689057fd3d0771af6 | v85 |

Saved versions/source archives retained. Current rollback target is v85, never defective v86. No schema migration or user financial-data rewrite. Notification optimization deferred. Work stopped for review.

