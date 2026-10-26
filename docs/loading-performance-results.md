# TripShare loading measurement — 26 October 2026

Measurement-only v75 is live. No financial, query-loading, cache, UI, data schema or index changes were shipped. Stop here for user review before optimization.

## Samples and scope

20 successful 200 responses per endpoint, same five-group dataset (60 expenses, six plans, 228 history entries, 370,825 source characters). Select the first 20 chronologically from captured performance events matching that dataset; deduplicate by request ID, exclude empty-account responses. The controlled cloud-browser run navigated through 21 Trips and 20 Notifications requests; existing background polls also generated matching events. Selection is not a statistically isolated load test. No parallel load generator or real payment actions.

Sampling windows: Trips 17:06:03–17:07:46 MYT, Notifications 17:06:02–17:08:09 MYT. These are application-handler elapsed durations, not browser time-to-content, dispatch time or download speed. Browser location and routing differ from the earlier Malaysia-origin slow requests. Do not attribute the lower current values to an optimization: none was performed.

| Endpoint | Samples | p50 | p95 | Range | DB operations/request |
|---|---:|---:|---:|---:|---:|
| /api/trips | 20 | 1,481ms | 1,944ms | 1,366–2,092ms | 22 |
| /api/notifications | 20 | 459ms | 846ms | 374–1,032ms | 6 |

Nearest-rank percentiles. The earlier production baseline had Trips p50 4,989ms (16 samples, 4,208–6,660ms) and Notifications p50 1,578ms (10 samples). These are different windows/network paths and must not be reported as before/after improvement.

## Category breakdown (median per-request aggregate)

| Category | Trips | Notifications | Query count and meaning |
|---|---:|---:|---|
| Group JSON shared read | 96ms | 112ms | 1 each; expenses/plans/history read together |
| Access permission queries | 302ms | 302ms | 5 each |
| Application owner check | 58ms | — | 1 / 0 |
| Member binding queries | 936ms | — | 15 / 0: five grants reads + five existing INSERT OR IGNORE + five identity-key reads |
| Bill normalization/payment replay | clock cannot resolve | clock cannot resolve | 0 separate DB queries; included in shared read and existing normalize |
| Itinerary | pass-through for owner | no itinerary projection | 0 separate DB queries; included in shared read |
| History | pass-through for owner | audit scan, clock cannot resolve | 0 separate DB queries; included in shared read |
| Serialization | clock cannot resolve | clock cannot resolve | 0 DB queries |

The three member binding subquery aggregates have medians 302 / 302 / 309ms. Do not add medians and expect exact total equality; each median may come from a different request. Cloudflare's clock does not advance normally during synchronous CPU execution. Zero CPU-stage elapsed values are therefore not evidence of zero work or sub-millisecond runtime. Native Worker CPU totals provide a combined CPU envelope, not per-feature CPU attribution: recent enabled samples had Trips CPU p50 29ms (17 invocations, 25–49ms) and Notifications CPU p50 19ms (15 invocations, 14–41ms). These auxiliary native samples are fewer than the main per-endpoint timing sample sets. D1 engine metadata exists for all()/run(), not first(); reported query wall times include the awaited D1 round trip.

## Overhead and disable switch

Reproducible local CPU A/B: 100 pairs, 100 mocked queries/request; extra p50 0.139ms, p95 0.406ms, observed maximum 2.976ms (<20ms). This supports negligible local instrumentation overhead but is not an every-request production guarantee including log transport/CPU contention. Do not infer overhead from unrelated total-request samples. The profiler performs no extra database operations, no repeated encoding, and logs fixed numeric aggregates only.

Global off: TRIPSHARE_PERFORMANCE_TIMING=0, applied by redeploying the saved version with that environment revision. Default on for this measurement release. Immediate per-request off: ?timing=off. Unit tests confirm off returns the original database/response and emits no performance log or header. Both production endpoints were also checked in off mode and returned valid 200 JSON (native CPU 25ms Trips / 18ms Notifications in those single checks; not enough for a production overhead comparison). Existing general request logging is retained.

## Recommended optimization order and expected benefit

1. **Batch permissions and identity links first.** Reuse a single access result set across groups; read identity keys in bulk; keep existing stable keys and generate only genuinely missing keys using existing storage. Target roughly 4–6 database round trips instead of 22 (exact count depends on missing links). Current serial access/binding stages account for about 1.2s in this dataset; modelled Trips p50 about 0.3–0.7s under this sampling route, roughly 50–80% lower. Estimates, not validated results, and not a promise for all regions.
2. **Early conditional response.** Query minimal version/access metadata before loading complete JSON, normalizing and serializing. Group revision alone is insufficient: include current grants, active-member status and binding changes, and recheck permission even for 304. Target 2–4 small queries on unchanged refreshes; expect fewer bytes and fewer waits. Existing ETag handling must also be checked against dispatch weak/strong ETag rewriting before claiming working 304s. No schema change authorized.
3. **Current-group initial load.** Fetch minimal group directory + selected group's payload, preserve cross-group totals as a separate demand-loaded request. Five group documents -> one on this account; actual byte reduction depends on which group is selected. Account-scoped stale-while-revalidate plus skeleton can reduce time-to-visible content; validate 1.5s separately and never enable stale financial writes before permissions/revision refresh.
4. **Notification count first.** Poll a permission-scoped unread count; fetch paginated details only when opened. Batch access checks too. A count-only response does not fix latency if the backend still reads/normalizes all five full JSONs, so avoid claiming that simply renaming the endpoint helps. Existing scoped change metadata may support this; if a new summary/index structure is needed, propose migration separately. Expected smaller payload and work, exact latency TBD.
5. **Indexes after plans.** Inspect production EXPLAIN QUERY PLAN and existing indexes before proposing any migration. Source declarations suggest reviewing trips(owner), grants(trip,email) and members(user,trip); do not create them from source inspection alone. D1 engine time in observed shared reads is small relative to network waits, so indexes are lower priority than removing round trips.

## Validation, rollback and limits

Three timing unit tests, existing API regression suite, TypeScript, whitespace check, production build and Worker smoke passed. UI unchanged; no desktop/mobile layout or cached-first-paint acceptance is claimed in this phase. No optimization p50<1s or cached-content<1.5s acceptance yet.

Saved rollback target: v74 / appgprj_6a9f7a8cbf54819181bcd927d63bc32d~appgver_5d7661323dfc8191b550cc9cf5cdcd00; source aea80d8acf1dfac1b95e29663e42303dc0a356d7. Deploy this exact saved version to restore pre-instrumentation code, with no data rollback/migration. The archive is confirmed present. This is prepared, not deliberately executed against production; publication propagation is not instantaneous.

KEEP: data, balances, authorization and existing functions.
CHANGE NOW: switchable measurement only, completed.
IMPROVE LATER: N+1, conditional metadata, selected-group loading, unread counts, scoped cache/skeleton, then plans-based indexes after review.
DO NOT ADD: unapproved migrations, performance claims based on mixed networks, fabricated per-feature database timings, or automatic financial changes.
