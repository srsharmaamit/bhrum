Walk me through deploying StockLens to Vercel and verify the deployment is correct.

Pre-flight checks (run all before deploying):
1. Run `cd /home/user/bhrum/stocklens && npm run build 2>&1` — must have 0 errors.
2. Run `npm test -- --silent 2>&1 | tail -3` — must be 103 tests passing.
3. Check that `.env.local` is listed in `.gitignore` (it is — confirm).
4. Confirm `FMP_API_KEY` does NOT appear in any committed file:
   `git grep FMP_API_KEY -- ':(exclude).env*' ':(exclude).env.example'`
   (should return no results except the example file)

Deployment options — ask which the user prefers:

**Option A — Vercel Web Import (recommended for first deploy):**
1. Go to vercel.com/new → Import Git Repository → `srsharmaamit/bhrum`
2. Set Root Directory → `stocklens`
3. Framework: Next.js (auto-detected)
4. Add Environment Variable: `FMP_API_KEY` = (paste key)
5. Click Deploy

**Option B — Vercel CLI:**
```bash
cd stocklens
npm install -g vercel
vercel login
vercel           # follow prompts, set root dir = stocklens
vercel env add FMP_API_KEY production
vercel --prod
```

Post-deploy verification:
1. Visit the live URL → check home page loads.
2. Search for `AAPL` → verify Confidence Factor appears and is a number.
3. Search for `GME` → verify penny/small-cap regime is detected.
4. Check the leaderboard loads top 5 movers.
5. Open browser DevTools → Network tab → confirm NO requests go directly to `financialmodelingprep.com` from the browser.
6. Check the footer disclaimer is visible.

If $ARGUMENTS contains a URL, fetch it and verify the above checklist against the live deployment.

Arguments (optional): $ARGUMENTS — live Vercel URL to verify post-deploy.
