# N+1 batch read release

GET trips retains the original trip query, access rules, projection and ETag calculation. Owner check and trip read run concurrently. All selected-trip grants are read in one query and passed into the unchanged access decision. Unique member/email bindings are seeded in one INSERT OR IGNORE and canonical keys read once. JSON bound arrays avoid parameter-count limits; no interpolated user values. No schema, notification, 304 or loading changes.

Expected maximum: session1 + trips1 + owner1 + grants1 + link insert1 + link read1 =6 statements. Header authentication uses5; no bindings uses3. Concurrent first-use requests preserve existing identity keys via the primary key and INSERT OR IGNORE. Failed canonical lookup fails closed through existing error handling.

Validation:55 API tests passed, including full-response equality against frozen v79 for owner/admin/member/outsider and <=5 calls. TypeScript and production build passed. Production baseline captured in signed-in browser (5 groups). Production full JSON response matched the same-account predeployment snapshot exactly, including all20 reloads (5groups/370825 source chars). Twenty post-first samples: p50 356ms, p95 362ms, range256–564ms;5 DB statements each. v75: p50 1481ms/p95 1944ms/22 statements. First controlled request after deploy: handler347ms,5 statements; browser reload+read operation1032ms. Subsequent browser operations20 samples:463–926ms; these include automation overhead and are not navigation timing or first-content measurements. Raw numeric evidence: nplus-samples.json. First request after deployment will be labelled as such; the platform provides no guarantee that it reaches a fresh isolate, so it cannot honestly prove forced cold-start latency.

KEEP: permissions, immutable ledger, projection, identities and rollback v78. CHANGE NOW: serial N+1 only. IMPROVE LATER: independent304/loading/notification work only after approval. DO NOT ADD: indexes or migration without plans.


The earlier Malaysia-origin v75 measurements (~5s) and later cloud-browser baseline (~1.5s) were different windows/paths. The same code was running, so this difference was not a code optimization. No controlled region/cache/isolate experiment was performed; attributing the entire difference to cold starts, region or caching would be unsupported. Platform does not expose isolate reset: first-after-deployment measured, guaranteed cold-start remains UNKNOWN.

Category medians after batching: owner59ms/1, shared JSON192ms/1, grants54ms/1, identity insert54ms/1, identity read55ms/1. Owner and trip read overlap; category medians must not be added to claim total latency. Expenses/itinerary/history still share the single JSON query; no independent DB queries. Synchronous CPU categories remain unresolved by the Worker clock.

Rollback: exact saved v78 appgprj_6a9f7a8cbf54819181bcd927d63bc32d~appgver_0f780feac59c8191b4e9efdaff7ec6cd; /workspace/tripshare-pending-summary-v78.tar.gz retained. v79 also remains saved. No schema or ledger rollback is necessary.
