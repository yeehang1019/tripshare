# N+1 batch read release

GET trips retains the original trip query, access rules, projection and ETag calculation. Owner check and trip read run concurrently. All selected-trip grants are read in one query and passed into the unchanged access decision. Unique member/email bindings are seeded in one INSERT OR IGNORE and canonical keys read once. JSON bound arrays avoid parameter-count limits; no interpolated user values. No schema, notification, 304 or loading changes.

Expected maximum: session1 + trips1 + owner1 + grants1 + link insert1 + link read1 =6 statements. Header authentication uses5; no bindings uses3. Concurrent first-use requests preserve existing identity keys via the primary key and INSERT OR IGNORE. Failed canonical lookup fails closed through existing error handling.

Validation:55 API tests passed, including full-response equality against frozen v79 for owner/admin/member/outsider and <=5 calls. TypeScript and production build passed. Production baseline captured in signed-in browser (5 groups). Production comparison and20 samples pending publication. First request after deployment will be labelled as such; the platform provides no guarantee that it reaches a fresh isolate, so it cannot honestly prove forced cold-start latency.

KEEP: permissions, immutable ledger, projection, identities and rollback v78. CHANGE NOW: serial N+1 only. IMPROVE LATER: independent304/loading/notification work only after approval. DO NOT ADD: indexes or migration without plans.
