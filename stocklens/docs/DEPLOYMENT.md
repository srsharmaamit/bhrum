# Deployment Guide

## Prerequisites

- FMP API key (free at [financialmodelingprep.com/developer/docs](https://financialmodelingprep.com/developer/docs/))
- Vercel account (free hobby tier works)
- Repository pushed to `srsharmaamit/bhrum` on branch `claude/stocklens-dashboard-Ihr7V`

---

## Option A — Vercel Web UI (Recommended for First Deploy)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select `srsharmaamit/bhrum`
3. In **Configure Project**:
   - **Project Name:** `stocklens` (or anything)
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `stocklens` ← critical
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
4. Under **Environment Variables**:
   - Key: `FMP_API_KEY`
   - Value: `<your_key>`
   - Environment: Production + Preview + Development
5. Click **Deploy**
6. Wait ~2 minutes for build → get your live URL

---

## Option B — Vercel CLI

```bash
# Install CLI
npm install -g vercel

# From the stocklens directory
cd /path/to/bhrum/stocklens
vercel login

# Link to your team
vercel link --scope sramitsharmas-projects

# Add the env var
vercel env add FMP_API_KEY
# → Select: Production, Preview, Development
# → Paste your FMP API key

# Deploy to production
vercel --prod
```

---

## Environment Variable Reference

| Variable | Required | Environments |
|----------|----------|--------------|
| `FMP_API_KEY` | Yes | Production, Preview, Development |

No other environment variables are needed.

---

## Vercel Project Settings to Verify

| Setting | Correct value |
|---------|---------------|
| Root Directory | `stocklens` |
| Framework | Next.js |
| Node.js Version | 18.x or 20.x |
| Build Command | `npm run build` |
| Install Command | `npm install` |
| Output Directory | `.next` |

---

## Post-Deploy Verification Checklist

Run after every deploy:

- [ ] Home page loads at the live URL
- [ ] Search for `AAPL` → Confidence Factor appears, is a number between 0–100
- [ ] Search for `GME` → regime badge shows "Small-Cap" or "Mid-Cap"
- [ ] Search for `SNDL` or any sub-$5 stock → regime badge shows "Penny Stock"
- [ ] Leaderboard shows top movers
- [ ] Penny filter on leaderboard works (filters to price < $5)
- [ ] Clicking a leaderboard row loads that ticker in the analyzer
- [ ] Manual refresh button works
- [ ] Footer disclaimer is visible
- [ ] DevTools → Network → **No requests to `financialmodelingprep.com`** from the browser
- [ ] DevTools → Console → **No errors**

---

## Deployment from a PR Branch

Vercel automatically creates Preview deployments for every branch push. To preview `claude/stocklens-dashboard-Ihr7V`:

1. Push to the branch
2. Go to Vercel dashboard → your project → Deployments
3. Find the branch deployment → open preview URL

Preview deployments use the same `FMP_API_KEY` environment variable (if you enabled it for Preview environments during setup).

---

## Rollback

In Vercel dashboard → Deployments → find the last working deployment → **Promote to Production**.

---

## Known Limits

| Limit | Value | Mitigation |
|-------|-------|------------|
| FMP free tier | ~250 calls/day | 5-min server cache, batch leaderboard (2 calls) |
| Vercel hobby tier functions | 100GB-hrs/month | StockLens functions are tiny — not a concern |
| Cache persistence | Per serverless instance | Cold starts re-warm in < 5s |
| Simultaneous users | Unlimited (static + serverless) | Each request is independent |
