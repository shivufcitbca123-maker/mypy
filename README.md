# AI Campus 360°

AI Campus 360° is a frontend-only smart campus command center for monitoring academic health, explaining student support signals, and coordinating human interventions.

## Stack

- React + Vite
- React Router
- Recharts
- Framer Motion
- Lucide React

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL, then choose **Try demo account** on the login screen. The demo credentials are `demo@aicampus360.com` and `Demo@360`.

## Architecture

- `src/App.jsx` contains the route shell and focused demo pages.
- `src/data/mock.js` centralizes the Aarav Sharma storyline and campus data.
- `src/styles.css` contains the responsive design system and visual language.
- Authentication and assistant responses are local UI state, ready to be replaced by API calls later.

## Demo flow

Login → Command Center → Student Directory → Student 360° → Explainable Intelligence → Intervention Center → What-if Simulation → Campus Brain.

This project intentionally has no backend, database, authentication service, or external API.
