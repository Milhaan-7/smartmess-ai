# SmartMess AI — Intelligent Institutional Dining & Food-Waste Prevention

SmartMess AI is an operational food-demand forecasting and pre-consumption waste reduction platform designed for university mess halls, institutional kitchens, and campus dining facilities. It bridges manager plan approvals, kitchen batch preparation execution, and student menu visibility to stop food surplus before cooking occurs.

> **Demonstration & Environment Declaration:**
> - **Data Source:** Operates with a reproducible 28-day synthetic baseline dataset (`createSeedState`).
> - **Forecasting Method:** Multi-factor deterministic rule-based calculation (`historical average × day factors × event adjustments × safety buffer`).
> - **AI Integration:** Server-side `@google/genai` SDK (`gemini-3.8-flash`) implemented for Forecast Insights (`POST /api/v1/forecast/ai-insights`) and Manager Copilot (`POST /api/v1/chat`). When `GEMINI_API_KEY` is unconfigured or invalid, both endpoints seamlessly operate in deterministic fallback mode.
> - **Database Status:** Cloud SQL / PostgreSQL environment variables (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`) are unconfigured in this preview environment. All backend API routes fall back gracefully to in-memory demo state without throwing errors.

---

## 1. Quick Start & Execution

```bash
npm install          # Install dependencies
npm run dev          # Launch full-stack Express + Vite server on http://localhost:3000
npm run build        # Run TypeScript typechecks and production Vite build
npm test             # Execute Vitest test suite (unit, API, and RBAC auth tests)
```

Requires Node.js LTS toolchain (Vite 6 / Vitest 3 / Express 4).

---

## 2. Demo Roles & Role-Based Access Control (RBAC)

SmartMess AI features three distinct operational personas accessible via the top navigation **Persona Switcher** or the **Login Page**:

1. **Mess Manager**:
   - Access to Manager Dashboard, Demand Forecasts, Menu Management, Kitchen Operations, Waste Analytics, Settings, and Manager-Only **AI Assistant**.
   - Authorized to approve kitchen preparation plans and modify institutional safety buffers.
2. **Kitchen Staff**:
   - Access to Kitchen Operations shift board, portion weights (kg), batch preparation targets, and leftover logging.
   - Restricted from manager settings, menu deletion, and AI Assistant analytics.
3. **Student / Diner**:
   - Access to published weekly dining menus, meal schedules, and notifications.
   - Strict read-only view; all manager and kitchen controls, AI Assistant navigation items, and backend modification endpoints are protected (returning HTTP 403 for unauthorized requests).

---

## 3. Application Workflow

1. **Menu Definition (`/menus`)**: Define daily dishes and portion weights (kg per portion).
2. **Demand Forecasting (`/forecasts`)**: Compute baseline attendance and apply campus event context and safety buffers (0–50%).
3. **Manager Plan Approval (`/`)**: Review predicted demand vs. baseline and click **Approve Kitchen Plan**.
4. **Kitchen Preparation (`/kitchen-operations`)**: Staff view authorized portion counts and batch kg targets, log actual prepared/consumed amounts, and finalize shift records.
5. **Student Notification (`/menus`)**: Published approved dining menus automatically update student views and notifications.
6. **Waste Analytics (`/waste-analytics`)**: Track recorded leftover kilograms, waste rates, and forecast error statistics (MAE, WAPE).

---

## 4. Key Rules Enforced

- **Menu Locking:** A menu with an approved or completed plan cannot be deleted or re-dated.
- **Whole Portion Targets:** Kitchen preparation quantities are rounded whole portions with exact kg targets.
- **Date-Restricted Actuals:** Operational actuals can only be recorded on or after the service date.
- **Manager-Only Copilot:** Direct navigation or POST requests to `/api/v1/chat` by non-managers return HTTP 403 Forbidden.

---

## 5. Known Limitations & Unconfigured Integrations

- **Persistence:** Local/in-memory state; refreshing restores baseline seed dataset when PostgreSQL is unconfigured.
- **Database:** PostgreSQL ORM schema (`src/db/schema.ts`) and Drizzle connection pool (`src/db/index.ts`) are fully implemented, but cloud DB environment variables remain unconfigured in this preview environment.
- **Gemini Key:** Server-side `process.env.GEMINI_API_KEY` uses a fallback configuration when an invalid key is present in environment secrets.
