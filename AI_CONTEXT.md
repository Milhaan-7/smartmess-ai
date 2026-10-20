# AI_CONTEXT.md — SmartMess AI Architecture & Operational Guide

## 1. Project Purpose
**SmartMess AI** is an AI-assisted food demand forecasting and pre-consumption waste reduction platform designed for institutional dining halls and university kitchens. It balances student attendance predictions, menu item uptake history, safety buffer preferences, and kitchen batch tracking to minimize food surplus before cooking occurs.

---

## 2. System Architecture & Tech Stack

### Core Frameworks
- **Frontend SPA**: React 18.3, TypeScript 5.9, Vite 6.4.
- **Styling**: Tailwind CSS v4, custom forest-green brand scale (`--color-brand-50` through `900`), Plus Jakarta Sans (display/body), JetBrains Mono (metrics/tabular numerals).
- **Backend**: Express 5.3 mounted via `server.ts` with Vite middlewares in development mode (`npm run dev`) and static file serving in production (`npm run build` / `npm start`).
- **Database & ORM**: PostgreSQL / Cloud SQL via Drizzle ORM (`drizzle-orm`, `drizzle-kit`), schema located in `src/db/schema.ts`, connection pool in `src/db/index.ts`.
- **Testing**: Vitest 3.2 with React Testing Library and JSDOM (`npm test` / `npx vitest run`).

### API Architecture (`/api/v1`)
Mounted in `server.ts` via `src/api/routes.ts`:
- `GET /health`: Healthcheck reporting database connectivity status (`connected` or `degraded`).
- `GET /auth/me`: Verifies Bearer auth token and returns user profile and role.
- `POST /auth/session`: Demo token exchange and user sync.
- `GET /settings` & `PUT /settings`: Institutional preferences and forecasting buffer rules.
- `GET /menus` & `POST /menus`: Daily meal menu definitions and food item portion sizes.
- `GET /records` & `PUT /records`: Completed and in-progress meal records, actual diners, prepared quantities, and leftover logs.

### State Management & Fallback Persistence
- **State Store**: `src/store/AppStore.tsx` implements a React Context + `useReducer` architecture initialized with reproducible baseline seed data (`src/data/mockData.ts`).
- **Persistence Mechanism**: When PostgreSQL / Cloud SQL environment variables (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`) are not set, the application operates in **demo mode** using `localStorage` caching (`smartmess-state-v1`).
- User changes to menus, preparation plans, and settings persist across page reloads in the same browser session.

---

## 3. Role-Based Access Control (RBAC)

SmartMess AI defines three distinct personas with strict role enforcement across navigation, views, and mutation controls:

### A. Manager (`manager`)
- **Responsibilities**: Oversees institutional dining operations, demand forecasting, menu planning, and financial/waste analytics.
- **Accessible Pages**:
  - `Dashboard`: High-level operational KPIs, Next Service Decision panel, today's meal pipeline, upcoming meal schedule, demand vs. actual trends.
  - `Forecasts`: Demand modeling engine, parameter adjustments (normal, holiday, exam days), factor breakdown, and baseline comparison.
  - `Menus`: Full calendar view to create, edit, and delete daily breakfast, lunch, and dinner menus.
  - `Kitchen Operations`: Review and authorize preparation plans before culinary staff begins cooking.
  - `Waste Analytics`: Historical WAPE/MAE accuracy metrics, item-level waste breakdown, and meal audit records.
  - `Settings`: Institutional details, prep buffer percentage (0–50%), service capacity, and rounding steps.

### B. Kitchen Staff (`kitchen_staff`)
- **Responsibilities**: Executes daily food preparation on the line, tracks batches, and records actual servings and plate waste.
- **Accessible Pages**:
  - `Kitchen Board` (`Dashboard`): Focused today view showing approved preparation targets and service progression.
  - `Menus`: Read-only view of daily menus and portion weights.
  - `Kitchen Operations`: View approved preparation targets, fill actual prepared quantities, record actual diners served, and log residual leftovers.
- **Restrictions**: Cannot approve draft forecasts, modify institutional settings, or delete menus.

### C. Student (`student`)
- **Responsibilities**: Diners checking daily menus, service hours, and dish offerings.
- **Accessible Pages**:
  - `Today's Menu` (`Dashboard`): Clean, appetizing meal cards for Breakfast (07:30–09:30), Lunch (12:30–14:30), and Dinner (19:30–21:30) showing dish names and portion weights.
  - `Weekly Menus` (`Menus`): Interactive weekly calendar showing published menus across upcoming days.
- **Restrictions**: Restricted from all forecasting, operations, analytics, settings, and managerial controls.

---

## 4. Key Files & Directory Structure

```
.
├── server.ts                             # Express backend + Vite middleware server entry point
├── index.html                            # HTML entry point with Plus Jakarta Sans & JetBrains Mono fonts
├── metadata.json                         # AI Studio application metadata
├── src/
│   ├── App.tsx                           # Root component, hash routing, role gate
│   ├── main.tsx                          # React DOM client entry point
│   ├── index.css                         # Tailwind CSS v4 directives & brand color scale
│   ├── api/
│   │   └── routes.ts                     # Express REST endpoints (/health, /auth, /menus, etc.)
│   ├── middleware/
│   │   └── auth.ts                       # Token verification & role extraction middleware
│   ├── db/
│   │   ├── index.ts                      # Database pool & environment variable validation
│   │   ├── schema.ts                     # Drizzle PostgreSQL tables (menus, records, users, etc.)
│   │   └── seed.ts                       # Seed script for initial synthetic demo records
│   ├── store/
│   │   └── AppStore.tsx                  # Global state reducer, API sync, localStorage fallback
│   ├── services/
│   │   ├── mockForecastService.ts        # Deterministic demand forecasting & buffer logic
│   │   ├── planningService.ts            # Upcoming meal queries & review prioritization
│   │   ├── operationsService.ts          # State transition logic (draft -> approved -> completed)
│   │   ├── menuService.ts                # Menu validation & deletion guard rules
│   │   └── metrics.ts                    # WAPE, MAE, leftover kg, and trend series math
│   ├── components/
│   │   ├── layout/                       # AppShell, Header, Sidebar
│   │   ├── common/                       # Card, MetricCard, Button, Badge, DataTable, Modal
│   │   ├── dashboard/                    # NextMealDecisionPanel, UpcomingMealsTable
│   │   ├── operations/                   # PlanEditor (preparation & leftover logging table)
│   │   └── charts/                       # DemandTrendChart, WasteTrendChart, BaselineComparisonChart
│   └── pages/
│       ├── Dashboard.tsx                 # Role-aware dashboard (Manager/Staff/Student)
│       ├── Forecasts.tsx                 # Deterministic forecast run & factor analysis
│       ├── Menus.tsx                     # Menu management & calendar browser
│       ├── KitchenOperations.tsx         # Preparation & leftover execution interface
│       ├── WasteAnalytics.tsx            # Historical waste & model accuracy reporting
│       └── Settings.tsx                  # Mess facility preferences & configuration
└── src/test/                             # Vitest unit and integration test suite
```

---

## 5. Calculations & Math Formats

- **Leftover Quantity (kg)**:
  $$\text{Leftover (kg)} = \max(0, \text{Prepared} - \text{Consumed}) \times \text{kgPerPortion}$$
- **Waste Rate**:
  $$\text{Waste Rate} = \frac{\sum \text{Leftover (kg)}}{\sum \text{Prepared (kg)}}$$
- **Weighted Absolute Percentage Error (WAPE)**:
  $$\text{WAPE} = \frac{\sum |\text{Predicted Diners} - \text{Actual Diners}|}{\sum \text{Actual Diners}}$$
- **Accuracy**:
  $$\text{Accuracy} = 1 - \text{WAPE}$$
- **Portion Rounding**:
  $$\text{Suggested Prep} = \lceil \text{Predicted Demand} \times (1 + \text{Buffer\%}) \rceil_{\text{step}}$$

---

## 6. Execution Commands

- **Development Server**: `npm run dev` (starts on port 3000)
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Lint**: `npm run lint`
- **Unit & Component Tests**: `npx vitest run` or `npm test`
- **Production Build**: `npm run build`

---

## 7. Known Constraints & Invariants

1. **Database Fallback**: PostgreSQL is currently unconfigured in the AI Studio preview container (`SQL_HOST` missing). The application cleanly reports degraded health and persists state using client `localStorage`.
2. **Role Permission Invariant**: Never allow Student or Kitchen Staff roles to bypass menu editing or plan authorization guards.
3. **Selector Compatibility Invariant**: Metric cards must maintain the `div.rounded-xl.p-4` DOM structure to satisfy automated testing helpers (`src/test/phase3.test.tsx` and `src/test/phase4.test.tsx`).
4. **Deterministic Models**: Demand calculations must remain deterministic based on input historical records to ensure reproducible evaluation benchmarks.
