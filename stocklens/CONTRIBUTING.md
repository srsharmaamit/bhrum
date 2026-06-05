# Contributing to StockLens

## Before You Start

Read `CLAUDE.md` and `ARCHITECTURE.md` first — they contain the exact file map, constraints, and "what not to do" list. This guide covers the workflow; those files cover the context.

---

## Branch & Commit Convention

```bash
# Active development branch
git checkout claude/stocklens-dashboard-Ihr7V

# Commit format: type: short description
git commit -m "feat: add short-interest ratio metric"
git commit -m "fix: handle null beta in volatility scorer"
git commit -m "test: add unit tests for new short-interest scorer"
git commit -m "docs: update scoring engine ADR"
git commit -m "chore: bump Next.js to 14.3"
```

Types: `feat` | `fix` | `test` | `docs` | `chore` | `refactor` | `perf`

---

## Development Setup

```bash
cd stocklens
cp .env.example .env.local
# Edit .env.local → add your FMP_API_KEY
npm install
npm run dev          # http://localhost:3000
```

---

## Making Changes

### Changing Scoring Logic

1. Edit **only `src/lib/scoring/config.ts`** for weight/threshold changes.
2. Edit `src/lib/scoring/engine.ts` for logic changes.
3. Run `npm run test:unit` (fast, < 2s) after every edit.
4. Run `npm run test:backtest` to validate real-world scenario behaviour.
5. If backtest expected ranges shifted, update `src/__tests__/backtest/scenarios.ts` and document WHY in a comment.

### Adding a New API Endpoint

1. Create `src/app/api/your-endpoint/route.ts`.
2. Export `GET` (or `POST`) function, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
3. Use `fmp.ts` functions — never call `fetch(financialmodelingprep...)` directly in the route.
4. Add cache keys to `fmp.ts` fetch calls.
5. Add integration tests in `src/__tests__/integration/`.
6. Update `docs/API.md`.

### Changing the UI

1. Components live in `src/components/` — all are `'use client'`.
2. All state and data fetching is in `src/app/page.tsx` — keep components presentational.
3. Use Tailwind classes. Never add inline hex colours.
4. Run `npm run build` before committing to check for TS errors.

### Adding a New Metric

Use the `/add-metric` slash command in Claude Code — it walks through all 5 required changes.

---

## Before Every Commit

```bash
npm run build       # 0 TypeScript errors
npm test            # 103/103 (or more if you added tests) passing
```

Do not commit with a failing build or failing tests.

---

## Environment Variable Safety

- Never commit `.env.local` — it's in `.gitignore`.
- Never reference `process.env.FMP_API_KEY` outside of `src/lib/fmp.ts`.
- `grep -r "FMP_API_KEY" src/ --include="*.ts"` should only return `src/lib/fmp.ts`.

---

## Code Style

- TypeScript strict mode is on — no `any`, no `@ts-ignore` without a comment explaining why.
- Null-safety: always handle `null` and `undefined` from FMP responses. Use `?? default`.
- No `console.log` in production code. Use them in tests only, and only for backtest output.
- No comments that explain what the code does. Comments only for non-obvious WHY.
- Functions that are pure (no side effects, no I/O) go in `lib/`. Functions that touch React state go in components or `page.tsx`.

---

## Test Writing Guidelines

- Every new metric scorer needs at minimum: one "high score inputs" test and one "low score inputs" test.
- Integration tests mock `global.fetch` via `jest.fn()` and call `cacheClear()` in `beforeEach`.
- Backtest scenarios are in `src/__tests__/backtest/scenarios.ts` — if you add a new ticker fixture, document the market phase context in comments.
- See `docs/TESTING.md` for the full testing philosophy.
