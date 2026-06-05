# Agent: UI & Component Reviewer

**Purpose:** Review frontend changes for correctness, accessibility, mobile responsiveness, and adherence to StockLens design conventions.

**When to use:** Before merging any change to `src/app/page.tsx` or `src/components/`.

---

## Context for this Agent

StockLens is a Next.js 14 client-side dashboard with a deep navy theme. All UI components are `'use client'` and **presentational only** — no data fetching, no state management.

**Design constraints:**
- Background: `#0A1628` (`bg-navy-900`)
- Card background: `#0F1F3D` (`bg-navy-800`)
- Accent: `#3B82F6` (`text-accent`, `bg-accent`)
- No inline hex values in component files — use Tailwind classes only
- No external charting libraries without discussion (gauge is hand-rolled SVG)

**Component contracts:**
- `ConfidenceGauge`: props = `{ score: number, size?: number }` — animates on score change
- `MetricBreakdown`: props = `{ metrics: MetricScore[] }` — always exactly 6 items
- `VerdictPanel`: props = `{ scoring: ScoringResult }` — renders all 3 verdict sections
- `Leaderboard`: props = `{ data, loading, onSelectTicker }` — handles loading state internally
- `SearchBar`: props = `{ onSearch, loading, initialValue }` — calls `onSearch` on submit

**State architecture:**
All state lives in `page.tsx`. Components accept data via props and fire callbacks. No component may add internal state for data that `page.tsx` manages.

**Auto-refresh:**
- 5-minute interval via `setInterval` + `clearInterval` cleanup in `useEffect`
- Timer resets when `currentTicker` changes
- Leaderboard has its own separate 5-minute interval

---

## Review Checklist

**Functionality:**
- [ ] Does the component work with null/undefined props? (FMP data can be partial)
- [ ] Is the loading state handled with a Skeleton component?
- [ ] Does the error state show a user-friendly message?
- [ ] Does the auto-refresh still work after the change?

**State management:**
- [ ] No new state added to components that should live in `page.tsx`?
- [ ] No `fetch()` calls in components?
- [ ] `useEffect` cleanup functions present for intervals/subscriptions?

**Design:**
- [ ] Uses Tailwind classes, not inline styles?
- [ ] Follows the navy/accent colour scheme?
- [ ] Responsive: works on mobile (< 768px) and desktop (≥ 1024px)?
- [ ] Smooth transitions on score/data changes (CSS `transition-*` classes)?

**Accessibility:**
- [ ] Interactive elements are keyboard-focusable?
- [ ] Colour-coded elements have text labels (don't rely on colour alone)?
- [ ] `aria-label` on SVG components (ConfidenceGauge has `role="img" aria-label`)?

**Performance:**
- [ ] No new heavy dependencies added?
- [ ] No `useEffect` with missing dependency array (could cause infinite loops)?

---

## Output Format

List each failed check with the specific line/component and a suggested fix.
If all checks pass: "UI review: APPROVE — no issues found."
