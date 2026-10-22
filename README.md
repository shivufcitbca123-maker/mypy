# AI Campus 360°

AI Campus 360° is a local API-backed smart campus command center for monitoring academic health, explaining student support signals, and coordinating human interventions.

## Stack

- React + Vite
- React Router
- Recharts
- Framer Motion
- Lucide React
- Python local API with CSV persistence

## Run locally

Start the API in one terminal:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m backend.api
```

Then start the frontend in a second terminal:

```bash
npm install
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:8000`. Keep the API running while using the app. Open the local Vite URL and sign in at `/login`. The login form has four selectable roles. The **Fill account** buttons only populate the form; select **Sign in** to authenticate.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@aicampus360.com` | `Admin@360` |
| Faculty | `faculty@aicampus360.com` | `Faculty@360` |
| Student | `student@aicampus360.com` | `Student@360` |
| Parent / Guardian | `parent@aicampus360.com` | `Parent@360` |

The previous Admin demo login (`demo@aicampus360.com` / `Demo@360`) remains available as a compatibility alias.

## Role dashboards and demo permissions

- **Admin** lands at `/admin/dashboard` and can use the campus command center, student directory, campus and concern views, intelligence modules, interventions, guardian communication, analytics, reports, user/role overview, department overview, audit log, and settings.
- **Faculty** lands at `/faculty/dashboard` and sees the assigned demo roster (ST102, ST105, ST136), editable attendance/mark fields, feedback and risk review links, intervention/follow-up controls, and reports.
- **Student** lands at `/student/dashboard` and sees only the student record linked to the demo account (ST102), including marks, recommendations, support status, feedback submission/history, and notifications scoped to ST102.
- **Parent / Guardian** lands at `/parent/dashboard` and sees only the explicitly linked student (ST102), including attendance/academic alerts, support/intervention updates, and communication summaries.

Role-specific landing URLs are protected by client-side route guards and server-side role/student-scope checks. Trying another role's dashboard redirects to the signed-in user's own dashboard. Login creates a server-managed session in an HttpOnly cookie; logout invalidates it. The API backs the admin overview, users, department summaries, date-based trends, student directory and profiles, faculty roster/attendance/marks/intervention follow-up, student and guardian record summaries, feedback submission/history, reports, audit, settings, and scoped notifications. Admins can save a guardian-portal update for a linked guardian account; this does not send SMS or email. Changes persist in CSV files under `backend/data/`.

## Architecture

- `src/App.jsx` contains the role-aware route shell, dashboards, and demo pages.
- `src/api/client.js` sends same-origin requests to the Python API with session cookies and exposes API errors.
- `src/auth/demoAuth.js` contains the fictional demo account display data and client-side route-scope checks. Authentication and authorization are enforced by the API.
- `src/data/mock.js` retains legacy illustrative fixtures; connected dashboard and analysis views use API records instead.
- `src/styles.css` contains the responsive design system and visual language.
- `backend/api.py` exposes the local HTTP API; `backend/services.py` implements role-scoped campus operations; `backend/storage.py` stores data in validated CSV files.
- `test/` contains frontend auth/API-client tests; `backend/tests/` contains Python service and API authorization tests.

## Demo flow

Login → role-specific dashboard → authorized module links. The Admin command-center route is also available at `/dashboard` as a compatibility route.

## Security and limitations

This remains a **local demonstration mode**, not a production service. The demo passwords are intentionally fictional and displayed in the login page. Do not use real credentials or real student records.

The local API hashes seeded passwords, enforces role/student scopes, and stores session tokens in server memory. Its sessions are lost when the API process restarts. CSV persistence is intended only for a single-machine fictional demo; it is not a production database. Production use requires a hardened deployment, secure cookie settings over HTTPS, a durable session store, a production identity provider, database-backed storage, and operational safeguards. Department summaries are derived from student records rather than a separately managed department directory. Guardian updates are portal notifications only; no external messaging integration is configured. Risk scores are prototype rules for human review, and the scenario-planning screen does not project outcomes because no validated forecasting model is connected. Campus-area sensors and location telemetry are not available.

## Tests and production build

```bash
npm test
npm run build
```

Run the backend tests with the configured Python environment:

```powershell
python -m unittest discover -s backend\tests
```
