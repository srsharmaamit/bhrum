# ADR 002 — In-Memory Server-Side Cache

**Status:** Accepted  
**Date:** 2024-06  
**Deciders:** srsharmaamit

---

## Context

FMP free tier allows ~250 API calls/day. Without caching, a single user doing 10 ticker lookups + leaderboard refreshes would consume 42 calls (4 per ticker + 2 leaderboard). Multiple users or page refreshes would exhaust the quota in hours.

## Decision

Implement a **module-level in-memory `Map`** with TTL in `src/lib/cache.ts`. All FMP fetch calls check this cache first.

```typescript
const store = new Map<string, CacheEntry<unknown>>();
// TTL = 5 minutes (300,000ms)
```

Cache key = `endpoint path + "|" + URLSearchParams string`  
TTL = 5 minutes (matching the app's auto-refresh interval)

## Alternatives Considered

| Option | Why not chosen |
|--------|---------------|
| Vercel KV (Redis) | Adds paid dependency; overkill for free-tier use case |
| Next.js `fetch` cache + `revalidate` | Not fine-grained enough; can't share across endpoints |
| No cache | Would exhaust 250-call quota in minutes |
| LocalStorage (client-side) | API key would be exposed in client-side requests |
| Vercel Edge Config | Read-only; can't cache dynamic FMP responses |

## Consequences

**Positive:**
- Zero additional dependencies or cost
- Same cache instance serves all concurrent requests within one serverless instance
- Cache is tested explicitly (`src/__tests__/unit/cache.test.ts`)
- `cacheClear()` export enables clean test isolation

**Negative:**
- Cache is **per-serverless-instance** — cold starts have empty cache
- Vercel may spawn multiple instances under load — cache doesn't sync across instances
- Module-level state means test suites must call `cacheClear()` in `beforeEach`

**If traffic grows:**
Replace the in-memory Map with Vercel KV: change only `src/lib/cache.ts`. All callers use the same `cacheGet`/`cacheSet` interface.

## Implementation Note

The `runtime = 'nodejs'` directive on API routes is **required** for the cache to work. Edge runtime creates a new instance per request — the module-level Map would be useless.
