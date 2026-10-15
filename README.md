# SmartMess AI — frontend demo

AI-assisted food-demand forecasting and food-waste reduction UI for hostel messes and institutional kitchens.

> **All data is synthetic demonstration data.** No machine-learning model is connected. The forecast is a
> deterministic, rule-based calculation that runs in the browser (historical average × explainable adjustments).
> Figures illustrate how the calculations and workflow behave; they say nothing about real-world accuracy or
> real food-waste reduction. The kitchen manager always makes the final preparation decision.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm test             # unit + UI tests (vitest, jsdom)
```

Requires a current Node.js LTS (the toolchain is Vite 6 / Vitest 3).

## Pages

Dashboard · Forecasts · Menus · Kitchen Operations · Waste Analytics · Settings (hash routing, e.g. `#/forecasts`).

Workflow: **Menus** → **Forecasts** (run, then send to Kitchen Operations) → **Kitchen Operations** (review each
quantity, confirm the plan, record actuals on or after the service date) → **Waste Analytics** / **Dashboard**.

## Structure

```
src/
  App.tsx, main.tsx, index.css     shell wiring, entry, Tailwind v4 theme (forest-green brand scale)
  types/index.ts                   shared types
  lib/                             dates, formatting, hash router, constants (DEMO_TODAY, meal metadata)
  data/mockData.ts                 deterministic synthetic dataset (no Math.random)
  services/
    baseline.ts                    the single definition of "history" and "baseline"
    mockForecastService.ts         computeForecast (pure) + runForecast (async seam → replace with API call)
    menuService.ts                 menu validation, ids, deletion policy
    operationsService.ts           plan approval, actuals, quantity validation
    planningService.ts             upcoming meals, today summary, notifications
    metrics.ts                     evaluation window, MAE / WAPE / baseline MAE, waste rate, daily series
  store/AppStore.tsx               in-memory state (menus, records, settings) via reducer; nothing persisted
  components/{layout,common,charts,dashboard,operations}
  pages/                           the six pages
  test/                            vitest + Testing Library (services, reducer rules, page flows)
scripts/check-overflow.py          optional real-browser check for horizontal overflow
```

## Rules the app enforces

- **Menus:** ids derive from date + meal. A menu whose plan is approved or completed cannot be deleted; deleting a
  menu with only an unapproved forecast also removes that forecast (after a warning). While a forecast/plan exists the
  menu's date and meal are locked.
- **Plans:** nothing is auto-approved; every item must be accepted or edited, quantities are whole, non-negative
  portions. A blank or invalid quantity shows the plan as *Incomplete* (never counted as zero).
- **Actuals:** results can only be recorded on or after the service date; a future-dated meal cannot become
  completed, so it cannot reach analytics or forecast history.

## Metric definitions

- **Evaluation window:** the 14 service days before the planning date. The Dashboard accuracy card, both Dashboard
  charts and the default Waste Analytics range use it, so they show the same numbers.
- **Baseline:** mean of the latest 14 completed diner counts for the same meal type before the service date (at least
  5 needed). Stored baselines, the forecaster and evaluation all use this one definition (`services/baseline.ts`).
- Forecast error = predicted − actual diners; MAE = mean |error|; WAPE = Σ|error| ÷ Σ actual; the accuracy card shows
  1 − WAPE. MAE and baseline MAE are computed over exactly the same meals; meals without a baseline are excluded from
  all of them and counted.
- **Stored forecasts** in the seed data are synthetic values generated with the dataset, not model output
  (`forecastSource: 'synthetic_seed'`). Forecasts produced in the app are `'rule_based'`.
- Leftover = prepared − consumed (portions); kg = portions × kg-per-portion; waste rate = leftover kg ÷ prepared kg.
  kg totals are shown to one decimal everywhere.
- Likely range = forecast ± 1.5 × recent MAE of stored forecasts (a heuristic band, not a statistical interval).

## Connecting a real forecaster later

Replace the body of `runForecast` in `services/mockForecastService.ts` with a call to the forecasting service and
return a `Forecast` (see `types/index.ts`; Settings → "Planned API contract" has a sketch). The demo is anchored to a
fixed planning date, `DEMO_TODAY` in `lib/constants.ts`; replace it with the real date when live data exists.

## Layout checks

jsdom cannot measure layout. To check that no page scrolls horizontally (390–1920 px), with Python Playwright
installed (not an app dependency):

```bash
npm run build && npx vite preview --port 4173 &
python3 scripts/check-overflow.py http://localhost:4173
```

## Known limitations

- State lives in memory; refreshing restores the seed data. One fictional institution.
- The synthetic data was generated with weekday and menu effects, so results here demonstrate mechanics only.
- The 7-column Kitchen Operations table scrolls inside its card on phone widths.
- Menus edited after a forecast was saved do not update that forecast; run the forecast again.
- Dialogs do not yet trap keyboard focus.
