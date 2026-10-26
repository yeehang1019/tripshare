# Loading performance — measurement only

Scope: instrument GET /api/trips and GET /api/notifications before choosing optimizations. No data/schema migration, caching, query replacement, pagination, notification behavior, financial or visual changes in this release.

Request-local diagnostics record coarse identity/query/access/member-link/ETag/projection/serialization stages, query count and wall time by fixed query category, and available D1 engine duration/row metadata. Numeric source character count, response character count and group counts help distinguish I/O from payload processing. Logs correlate with the existing request ID. Server-Timing contains aggregate durations/count only. No SQL text, query bindings, email, group names/IDs, ledger data, tokens or payment values are logged. first() results do not expose D1 metadata, so engine/row metrics cover result metadata when available, not every query. Query wall time includes D1 transport; application elapsed time excludes dispatch/network/browser rendering.

Code findings: trips currently selects all authorized complete group JSON documents. Each group serially queries access and linked grants; each uniquely bound person performs an existing INSERT OR IGNORE and SELECT for account_links. Count is 2 + 2N + 2M, plus optional session lookup (N accessible groups, M uniquely bound people across groups). These legacy GET-side identity-link writes are unchanged; measurement adds no new writes. Conditional 304 still performs those queries before computing the ETag. Notifications selects all group JSON again, serially checks access and scans the latest 100 audit entries per group before returning up to 100 items; the client requests full notifications on mount and every 45 seconds. Main response caching is only a mounted useRef, so full reload has no persisted content cache. No external HTTP calls exist in either handler; identity may read the sessions table.

Declared schema includes trips(owner_email), grants(email), grants(trip), and primary keys. It lacks explicit trips(owner), members(user,trip) and grants(trip,email) composite indexes. Actual production query plans/index presence are not yet inspected; migration is explicitly deferred for user approval.

Validation: focused three request-timing unit tests, existing API integration regression suite, TypeScript, production build/Worker smoke. Runtime timing samples and limitations are reported in the handoff once observed. No desktop/mobile layout changes; viewport acceptance for a future skeleton/cache UI is deferred, not claimed.

KEEP: data, permissions, response shapes, conditional responses and current behavior.
CHANGE NOW: request-local timing only.
IMPROVE LATER: choose batching/current-group loading, notification count, scoped cache and skeleton after measured report and user confirmation. Cached financial data must not cross accounts or expose revoked access; suggestions must stay disabled pending refresh.
DO NOT ADD: schema migrations, automatic data edits, guessed benchmark results or premature performance claims.

## Approved measurement publication and rollback

User explicitly approved publishing measurement-only on 26 October, with a kill switch, negligible overhead, at least 20 samples per endpoint, no optimization/migration yet, and v74 rollback. Global switch TRIPSHARE_PERFORMANCE_TIMING=0 disables detailed profiling (apply environment revision by redeploying the saved version). Per-request ?timing=off disables it immediately for A/B; default is on for this measurement release. Off mode returns the original DB and response and emits no performance event/header. Existing general request logs remain. The measure adds no reads/writes or external calls and no extra JSON byte encoding.

CPU-only paired A/B benchmark: 100 pairs, 100 no-I/O mock queries per request, 30 warmup pairs; measured extra p50 0.139ms, p95 0.406ms, maximum 2.976ms. This local observation is below 20ms, not a guarantee for production log transport or CPU contention. Script scripts/benchmark-timing.mjs is reproducible and fails if p95 >=20ms.

Bill processing stage wraps existing normalize/payment replay. Itinerary stage wraps existing traveller projection when applicable. History stage wraps existing notification audit scanning. Owners' itinerary/history pass-through has no separate processing loop. JSON parse and DB group fetch include all three and must be reported as shared rather than adding their durations three times. Zero elapsed milliseconds means below the runtime clock resolution, not no work. first() has no D1 metadata; query wall time is the complete awaited call.

Rollback target confirmed saved with archive: v74, appgprj_6a9f7a8cbf54819181bcd927d63bc32d~appgver_5d7661323dfc8191b550cc9cf5cdcd00, source aea80d8acf1dfac1b95e29663e42303dc0a356d7. On errors or material regression deploy this exact saved version using Sites deploy_site_version (project unchanged); poll to terminal. No schema change means no database rollback/migration is needed. Production deployment propagation still takes time; do not promise zero-time rollback.
