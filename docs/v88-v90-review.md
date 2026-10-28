# v88–v90 loading follow-up

v88: URL group starts before directory completes; fallback selection remains authorized by directory, discarded speculative errors are handled. Production20 scoped200 samples p50 144ms / p95 419ms,1 DBcall. API work is unchanged; concurrency removes the directory serial dependency, not per-API cost. Unit test asserts immediate group start and safe discarded failure. Types/build/Worker smoke passed. Rollback v87.

v89: persist scoped group response plus ETag under stable server-provided account ID + email, never the session token. On reload restore cache and immediately revalidate conditionally in parallel with directory.24-hour expiry,8-entry cap,1.5MB per-entry limit; storage disabled/full/corrupt falls back. Switch accounts purges other-account caches. Directory removal/denial clears cached record;401 clears account cache. Cached view is labelled refreshing; save requests blocked until validation. Mutations clear persistent snapshots before saving. Full responses and valid304 refresh stored timestamp. Cache may briefly show stale data until revalidation, including previously authorized snapshots; it is not authorization. Server permission checks remain authoritative. No database/schema migration.

304 contract: previously only in-memory refresh, group revisits and periodic refresh with an ETag could trigger it. Full page refresh lost that memory. New disk-backed data+ETag enables it across reloads. First visit, expired/evicted/blocked storage, or changed bills/permissions/bindings still returns200.

User HTML sample4870ms TTFB vs236ms app:4634ms outside app, retained as platform ingress limitation. No further compression work. Notification optimization is a separate next release.
