# 🏃 Race Tracker

A self-hosted web application to track all your running race registrations, results, and personal records. Built with React, Node.js/Express, PostgreSQL, and deployable with Docker Compose.

## Features

- **Full race log** — event name, date, location, bib number, confirmation number, registration fee
- **Results tracking** — chip time, gun time, pace, overall / gender / age group placement
- **Vitals** — heart rate, elevation gain, weather conditions
- **Dashboard** — stats overview, personal bests (10k / half / marathon), yearly chart
- **Filtering** — by status, year, search
- **Race report** — free-text notes and full race report field
- **Links** — race website, official results, finisher certificate URLs
- **Multi-user** — JWT auth, each user sees only their own races

---

## Quick start (Docker)

```bash
# 1. Clone & configure
git clone <your-repo>
cd race-tracker
cp .env.example .env
nano .env   # Set a strong JWT_SECRET and POSTGRES_PASSWORD

# 2. Start everything
docker compose up -d

# 3. Open http://localhost and register your account
```

## Development (local)

### Prerequisites
- Node.js 20+
- PostgreSQL 14+

### Backend
```bash
cd backend
npm install
# Create a .env file:
echo 'DATABASE_URL=postgres://racetracker:changeme@localhost:5432/racetracker
JWT_SECRET=devsecret
PORT=3001' > .env

npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # Vite dev server at http://localhost:5173
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `racetracker` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `changeme` | **Change in production** |
| `POSTGRES_DB` | `racetracker` | Database name |
| `JWT_SECRET` | `supersecretchangeme` | **Change in production** |
| `VITE_API_URL` | `/api` | Frontend API base URL |

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/races` | List races (filter: status, year, search) |
| GET | `/api/races/stats` | Aggregate stats & PBs |
| GET | `/api/races/:id` | Single race |
| POST | `/api/races` | Create race |
| PUT | `/api/races/:id` | Update race |
| DELETE | `/api/races/:id` | Delete race |

---

## Project structure

```
race-tracker/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js          # Express app + auto-migration
│       ├── db/pool.js        # pg Pool
│       ├── middleware/auth.js # JWT middleware
│       └── routes/
│           ├── auth.js
│           └── races.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── lib/api.js
        ├── hooks/useAuth.jsx
        ├── components/Layout.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── DashboardPage.jsx
            ├── RacesPage.jsx
            ├── RaceFormPage.jsx
            └── RaceDetailPage.jsx
```

---

## Deployment tips

- Put a reverse proxy (Caddy / Traefik / Nginx) in front for HTTPS
- The frontend container already includes Nginx and proxies `/api/` to the backend container
- PostgreSQL data persists in the `postgres_data` Docker volume
- Back up the volume regularly: `docker run --rm -v race-tracker_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data`
