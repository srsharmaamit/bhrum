# Security

## API Key Protection

`FMP_API_KEY` is the only secret in this project. It must ONLY exist in:
- `.env.local` (local dev — gitignored)
- Vercel Environment Variables (production — never in source)
- `process.env.FMP_API_KEY` inside `src/lib/fmp.ts` (the one server-side reference)

**Audit command:** Run this before every PR to verify no key leak:
```bash
git grep -r "FMP_API_KEY" -- ':(exclude).env.example' ':(exclude)*.md' ':(exclude)src/lib/fmp.ts'
# Should return: no output
```

**What prevents client-side exposure:**
- `src/lib/fmp.ts` is only imported by `src/app/api/*/route.ts` files (server-only)
- Next.js API routes run exclusively on the server
- No FMP URLs appear in browser network traffic
- `runtime = 'nodejs'` on all API routes (not Edge, which has stricter module boundaries but also lacks the cache)

## Input Validation

All ticker inputs are validated with `/^[A-Z0-9.^-]{1,10}$/` in `src/app/api/analyze/route.ts`. This prevents:
- Path traversal in FMP URLs
- Overly long strings
- Special characters that could affect URL encoding

## Rate Limiting

No server-side rate limiting is implemented beyond the FMP API's own limits. The 5-minute cache reduces call frequency. For production hardening, consider adding:
- IP-based rate limiting via Vercel Edge Middleware
- Request deduplication for concurrent identical requests

## No Auth

StockLens has no user authentication — it is a public read-only tool. If auth is added in future, `ARCHITECTURE.md` should be updated to reflect the new trust boundary.

## Third-Party Data

All displayed data comes from FMP. StockLens does not validate the accuracy of FMP's market data beyond null-checking. The disclaimer footer explicitly states this is an educational tool.

## Dependency Scanning

Run `npm audit` before releases:
```bash
npm audit --audit-level=high
```
