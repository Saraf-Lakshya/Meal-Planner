# Tomorrow — meal planner

A minimal black-and-white meal suggestion engine. Suggests 3 meals for tomorrow, avoids
repeats from the previous day (unless a meal is marked "Repeat"), lets you lock picks, type
your own, resume unfinished picks on any device, and learns weekday patterns
("You usually have poha on Mondays") once history builds.

Data lives in **Supabase** (the same project as the Personal-Trainer app), so one login works
for both and nothing is lost if you clear a browser.

---

## One-time setup

You already did this once for the trainer app — same drill.

### 1. Create the database tables
Supabase → **SQL Editor** → paste [`supabase-schema.sql`](./supabase-schema.sql) → **Run**.
(Creates `meals` + `meal_days` with Row Level Security.) *— already done during setup.*

### 2. Add repo secrets
**Settings → Secrets and variables → Actions → New repository secret**, add the same two the
trainer uses (from Supabase → Project Settings → API):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Turn on GitHub Pages
**Settings → Pages → Source: GitHub Actions.**

### 4. Deploy
Auto-deploys on every push to `main`. To trigger manually: **Actions → Deploy → Run workflow.**
Live at:

**https://saraf-lakshya.github.io/Meal-Planner/**

Open on your phone → **Add to Home Screen**.

> Keep-alive: the trainer app already pings this Supabase project daily, keeping the free tier
> awake for this app too.

---

## Using it

1. Tap **Meals** (top right) and type your usual breakfast / lunch / dinner options.
   Mark any meal **Repeat** to allow it on back-to-back days.
2. Tap **Regenerate** for 3 suggestions.
3. **Tap a card** to lock it (tap again to unlock). Regenerate only changes unlocked cards.
4. Already know what you want? Tap **✎ Type it in**, type it, **Set**, then lock it. Newly typed
   meals join your list only when you **lock and confirm** them.
5. When all 3 are locked, the button becomes **Confirm Selections** → saves the day.
6. Close mid-way? Locked picks are saved; next time it asks to **Resume or Discard**.

---

## Local development

```bash
npm install
# create .env with your two VITE_SUPABASE_* values
npm run dev
```

## Architecture (mirrors the trainer app)

- **Vite + React**, deployed to GitHub Pages via `.github/workflows/deploy.yml`.
- **`src/lib/supabase.js`** — Supabase client from env vars.
- **`src/hooks/`** — `useAuth`, `useMeals` (the pool), `useMealDays` (history + draft/resume).
- **`src/engine.js`** — pure suggestion logic (no-repeat, weekday patterns).
- Draft/resume uses a `meal_days` row with `status='draft'`, the same idea as the trainer's
  in-progress workout draft.
