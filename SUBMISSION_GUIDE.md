# SmartMess AI — Hackathon Submission Guide

## 1. Project Overview & Problem Statement

### Problem Statement
Institutional dining halls, university cafeterias, and enterprise mess facilities struggle with significant pre-consumption food waste. Kitchen managers rely on static meal estimates, leading to over-preparation, financial loss, and avoidable organic waste. Conversely, under-preparation causes meal shortages and student dissatisfaction.

### Product Overview
**SmartMess AI** is an AI-assisted food demand forecasting and pre-consumption waste reduction platform built specifically for institutional dining operations. It balances deterministic student attendance predictions, historical uptake rates, weather/exam factors, and safety buffer preferences. By connecting Manager plan approvals with Kitchen Staff batch prep execution and Student menu visibility, SmartMess AI prevents food surplus before cooking occurs on the line.

*Note: This platform prototype operates with synthetic baseline data and local browser persistence for demonstration reliability.*

---

## 2. Timed 2-Minute Video Demo Script

**Target Duration**: 120 seconds (2:00)  
**Tone**: Clear, professional, operational focus.

| Time | Persona & Screen | Action & Voiceover Script |
| :--- | :--- | :--- |
| **0:00 – 0:30** | **Manager**<br>`/` (Dashboard) | **Action**: Show Manager Dashboard. Point to Next Service Decision Panel for upcoming Dinner.<br>**Script**: "SmartMess AI helps university mess managers prevent food waste before cooking starts. On the Manager Dashboard, we see real-time demand predictions for upcoming meals. The system analyzes historical attendance, day factors, and safety buffers. The manager reviews the predicted demand baseline and clicks **Approve Kitchen Plan** to authorize culinary preparation." |
| **0:30 – 1:00** | **Kitchen Staff**<br>`#/` & `#/kitchen-operations` | **Action**: Switch Header role dropdown to **Kitchen Staff**. Click `Kitchen Operations` in sidebar.<br>**Script**: "We switch to the Kitchen Staff persona. On their shift board, culinary staff immediately see today's authorized preparation targets in portion counts and exact kilograms per dish. Staff click **Fill prepared = approved**, log actual consumed portions and diners served (450), and click **Save results** to finalize the shift." |
| **1:00 – 1:30** | **Waste Analytics & Persistence**<br>`#/waste-analytics` | **Action**: Switch back to Manager role and navigate to `Waste Analytics`. Refresh the browser page (`F5` / `Cmd+R`).<br>**Script**: "Back in Manager view, the `Waste Analytics` dashboard instantly updates leftover kilograms, estimated waste rates, and forecast accuracy metrics like WAPE and MAE. All operational data persists locally across browser refreshes, guaranteeing robust state continuity." |
| **1:30 – 2:00** | **Student View & RBAC**<br>`#/menus` | **Action**: Switch Header dropdown to **Student**. Navigate to `Weekly Menus` (`#/menus`).<br>**Script**: "Finally, in the Student view, diners can check today's published menus, meal times, and portion details. Strict role-based access control automatically hides all managerial controls, forecast controls, and editing buttons, ensuring a clean, secure dining experience." |

---

## 3. Video Recording & Screenshot Checklist

### Recording Setup Checklist
- [ ] **Screen Resolution**: Set browser viewport to 1080p (1920x1080) at 100% display zoom.
- [ ] **Clean Browser Environment**: Hide browser bookmark bars, extensions, and unrelated tabs.
- [ ] **Audio Quality**: Use a clear microphone with minimal background noise.
- [ ] **Pacing**: Move cursor smoothly and hold on key screens for 2-3 seconds.
- [ ] **Persona Transitions**: Use the top-bar "Demo Persona Switcher" clearly during video transitions.

### Screenshots to Capture for Submission
1. **Manager Dashboard (`/`)**: Next Service Decision Panel with predicted vs. baseline demand and "Approve Kitchen Plan" CTA.
2. **Kitchen Operations (`#/kitchen-operations`)**: Active prep target checklist with kilogram batch weights and logged actuals.
3. **Waste Analytics (`#/waste-analytics`)**: Historical leftover metrics, waste rate estimates, and forecast error charts.
4. **Student Weekly Menus (`#/menus`)**: Clean published weekly dining view without editing controls.
5. **Determinism / Forecast Engine (`#/forecasts`)**: Factor breakdown showing attendance impact and safety buffer controls.

---

## 4. Google Drive Asset & Sharing Verification Checklist

- [ ] **Google Drive Folder**: Created a dedicated folder titled `SmartMess_AI_Hackathon_Submission`.
- [ ] **Video File**: Exported MP4 video (`smartmess_ai_demo_2min.mp4`), H.264 video codec, crisp 1080p audio/video.
- [ ] **Screenshots Sub-folder**: High-res PNG screenshots added (`01_manager_dashboard.png`, `02_kitchen_operations.png`, `03_waste_analytics.png`, `04_student_menu.png`, `05_forecast_engine.png`).
- [ ] **Link Sharing Permission**: Set link access explicitly to **"Anyone with the link can view"** (do NOT restrict to specific domain).
- [ ] **Incognito Verification**: Tested the shared Google Drive link in a private/Incognito browser window to confirm seamless public view access without login prompts.

---

## 5. Frequently Asked Judge Questions & Factual Answers

### Q1: How does SmartMess AI generate its demand forecasts?
**Answer**: SmartMess AI uses a deterministic multi-factor forecasting engine that takes historical baseline attendance and applies adjustments for day of week, university calendar events (exams, holidays), meal type, and manager safety buffer preferences (0–50%).

### Q2: How does the system handle persistence and multi-user roles in this demo?
**Answer**: The app implements a client-side `localStorage` state store (`smartmess_app_state_v1`) initialized with reproducible synthetic baseline data. Role switching (Manager, Kitchen Staff, Student) modifies active permissions instantly while sharing underlying menu, plan approval, and leftover log state.

### Q3: Is there a live PostgreSQL database connected to this deployment?
**Answer**: No. PostgreSQL / Cloud SQL integration is supported via Drizzle ORM in the backend code (`server.ts` & `src/db/schema.ts`), but live database credentials are unconfigured in this standalone AI Studio preview environment. The app gracefully falls back to client-side persistence.

### Q4: Have you measured real-world food waste reduction with this system?
**Answer**: No. This hackathon project is a prototype evaluated against synthetic baseline datasets and simulated operational scenarios. While the mathematical model tracks WAPE and leftover reduction algorithms, real-world deployment metrics have not yet been collected.

### Q5: How are role permissions enforced across different user types?
**Answer**: Role-Based Access Control (RBAC) is enforced both at the route navigation layer (`App.tsx` hash router) and at the component level. Student and Kitchen Staff roles cannot trigger plan approvals, edit institutional settings, or create/delete menus.

---

## 6. Technical Limitations & Environment Declaration

- **Environment**: Deployed in Google AI Studio preview environment.
- **Data Source**: Synthetic historical mess attendance, menu definitions, and residual waste logs.
- **Persistence Method**: Client-side `localStorage` caching (`smartmess_app_state_v1`).
- **Backend Database Status**: Cloud SQL / PostgreSQL environment variables (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`) are unconfigured. Server REST endpoints report degraded status and redirect state management to local storage.
- **Browser Compatibility**: Fully tested and verified in standard modern web browsers (Chrome, Edge, Firefox, Safari).

---

## 7. Final Submission Checklist

- [ ] **Applet URL**: Verified development applet URL (`https://ais-dev-uy4ihlqaz6udmmtvye4yty-794565525699.asia-southeast1.run.app`) loads cleanly.
- [ ] **Source Code**: Verified repository is clean with all 88 Vitest tests passing (`npx vitest run`) and zero build/typecheck errors (`npm run lint`, `npm run build`).
- [ ] **Demo Video**: MP4 file recorded, strictly under 2:00 minutes, following the timed script in Section 2.
- [ ] **Google Drive Assets**: Drive link verified in Incognito mode with "Anyone with link can view" permissions.
- [ ] **Screenshots**: Captured 5 high-resolution PNG screenshots illustrating core workflows.
- [ ] **LinkedIn Post**: Published hackathon project highlight post with hashtags and applet link.
- [ ] **Hackathon Form**: Submitted project form before deadline with all required links attached.
