# Runholix
> [!IMPORTANT]
> This project was developed with the help of AI (vibe coding). However, it was thoroughly reviewed by myself. It is not perfect or ideal but in my opinion it is acceptable and good enough for small production environment.<br><br>
> I have very little interest to maintain this code unless there are few issues. Frankly, I tried my best to make sure the code base is somewhat maintainable but my free time is very limited.<br><br>
> If you find any issues, feel free to report it or make a PR. Anything bellow this text is AI generated.

Runholix is a self-hosted race log and training tracker for runners. It stores race registrations, results, personal records, training notes, upload attachments, and calendar feed links. The stack is React + Vite on the frontend, Express on the backend, and PostgreSQL for persistence.

## Features

- Race log with event info, registration, distance/category, facility, RPC, result, condition/vitals, notes, and race report
- Race detail and race add/edit views with tabbed layout
- Dashboard with summary stats, yearly chart, and personal bests
- Race list filtering, search, sorting, and pagination
- Email and/or push notification reminder about race registration, race pack collection and race day
- Training plan CRUD
- Uploads for race routes, race results, attachments, and avatar images
- Public avatar display and public `.ics` calendar feed
- Passkey sign-in and passkey registration
- Email-based account activation, approval, password reset, and email change flows
- Cookie-based browser auth with CSRF protection
- PWA shell with service worker caching and install support

## Architecture

- Frontend auth uses an `HttpOnly` cookie for browser sessions
- Unsafe browser requests use CSRF tokens tied to the auth token
- The frontend no longer persists the bearer JWT in `localStorage`
- Private attachment files can be cached by the service worker for offline use and are cleared on logout or auth loss
- The frontend is route-split with lazy loading for the main pages

## Quick Start

### Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost` and register or sign in.

### Local development

Prerequisites:
- Node.js 20+
- PostgreSQL 16+

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

If you run the frontend outside Docker, make sure `VITE_API_URL` points to the backend API base, usually `/api` or `http://localhost:3001/api`.

## Environment Variables

The root `.env.example` is the best source of truth. The key variables are:

| Variable | Used by | Description |
|---|---|---|
| `APP_NAME` | backend, frontend | Display name used in UI, email content, and manifest metadata |
| `APP_URL` | backend | Public URL used in email links and WebAuthn origin defaults |
| `APP_TIMEZONE` | backend | Default timezone used by scheduler jobs |
| `POSTGRES_HOST` | Docker compose | PostgreSQL host and port, for example `db:5432` |
| `POSTGRES_USER` | backend, Docker compose | PostgreSQL username |
| `POSTGRES_PASSWORD` | backend, Docker compose | PostgreSQL password |
| `POSTGRES_DB` | backend, Docker compose | PostgreSQL database name |
| `DATABASE_URL` | backend | Direct database connection string when running outside Docker |
| `DATABASE_SSL` | backend | Set to `true` to enable SSL for the PostgreSQL connection |
| `PORT` | backend | API port, default `3001` |
| `JWT_SECRET` | backend | JWT signing secret |
| `CSRF_SECRET` | backend | CSRF signing secret; falls back to `JWT_SECRET` if unset |
| `CORS_ORIGIN` | backend | Allowed browser origin or comma-separated list of origins |
| `COOKIE_SECURE` | backend | Set to `true` when serving over HTTPS |
| `COOKIE_SAMESITE` | backend | Cookie `SameSite` policy, default `lax` |
| `WEBAUTHN_RP_ID` | backend | Optional WebAuthn relying party ID |
| `WEBAUTHN_ORIGIN` | backend | Optional WebAuthn expected origin |
| `ADMIN_EMAIL` | backend | Enables admin approval flow when set |
| `UPLOAD_DIR` | backend | Filesystem path for uploads, default `/uploads` |
| `VITE_API_URL` | frontend | Frontend API base URL, default `/api` |
| `VITE_APP_NAME` | frontend | Frontend display name used in the browser title and UI |
| `SMTP_HOST` | backend | Enables email delivery when set |
| `SMTP_PORT` | backend | SMTP port, default `587` |
| `SMTP_SECURE` | backend | SMTP transport mode: `plain`, `tls`, or `ssl` |
| `SMTP_USER` | backend | SMTP username |
| `SMTP_PASS` | backend | SMTP password |
| `SMTP_FROM` | backend | From address used for outgoing mail |
| `SMTP_POOL` | backend | Enable or disable SMTP connection pooling |
| `SMTP_POOL_MAX_CONNECTIONS` | backend | SMTP pool size |
| `SMTP_POOL_MAX_MESSAGES` | backend | Max messages per pooled SMTP connection |
| `VAPID_PUBLIC_KEY` | backend | Web push notification to encrypt the payload |
| `VAPID_PRIVATE_KEY` | backend | Web push notification to sign identity |
| `VAPID_SUBJECT` | backend | A contact URL or email to contact the server administrator if there are configuration issues or abuse |
| `STOP_REGISTRATION` | backend | Option to stop new account registration, default to false |

## API Endpoints

### Health

- `GET /api/health`

### Auth

Public:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/activate`
- `POST /api/auth/resend-activation`
- `POST /api/auth/forgot-password`
- `POST /api/auth/forgot-password/confirm`
- `POST /api/auth/admin-approve`
- `GET /api/auth/admin-approve`
- `POST /api/auth/passkeys/login/options`
- `POST /api/auth/passkeys/login/verify`
- `POST /api/auth/confirm-email`

Authenticated:
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PUT /api/auth/name`
- `PUT /api/auth/timezone`
- `PUT /api/auth/password`
- `GET /api/auth/passkeys`
- `POST /api/auth/passkeys/register/options`
- `POST /api/auth/passkeys/register/verify`
- `DELETE /api/auth/passkeys/:id`
- `PUT /api/auth/email`
- `GET /api/auth/email-reminder`
- `PUT /api/auth/email-reminder`
- `GET /api/auth/ical`
- `PUT /api/auth/ical`

CSRF:
- `GET /api/auth/csrf` returns a token for authenticated browser sessions
- Unsafe requests require `x-csrf-token`

### Races

- `GET /api/races`
- `GET /api/races/stats`
- `GET /api/races/dashboard`
- `GET /api/races/calendar`
- `GET /api/races/:id`
- `POST /api/races`
- `PUT /api/races/:id`
- `DELETE /api/races/:id`

Query parameters used by the list and dashboard routes include filtering by status, year, search, sort, order, page, and page size.

### Training

- `GET /api/training`
- `GET /api/training/:id`
- `POST /api/training`
- `PUT /api/training/:id`
- `DELETE /api/training/:id`

### Uploads

- `POST /api/upload/route`
- `POST /api/upload/result`
- `GET /api/upload/route-file/:userId/:filename`
- `DELETE /api/upload/route-file/:userId/:filename`
- `POST /api/upload/attachment`
- `GET /api/upload/attachment/:userId/:filename`
- `DELETE /api/upload/attachment/:userId/:filename`
- `GET /api/upload/parse/:userId/:filename`
- `POST /api/upload/avatar`
- `DELETE /api/upload/avatar`
- `GET /api/upload/avatar/:userId`

### Calendar Feed

- `GET /ical/:token.ics`

This feed is public and read-only.

## Project Structure

```text
runholix-app/
├── README.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── scheduler.js
│       ├── email.js
│       ├── db/
│       │   ├── pool.js
│       │   └── migrate.js
│       ├── middleware/
│       │   └── auth.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── races.js
│       │   ├── training.js
│       │   ├── upload.js
│       │   └── ical.js
│       └── utils/
│           ├── authCookies.js
│           └── activityParser.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── index.html
    ├── public/
    │   ├── sw.js
    │   ├── manifest.webmanifest
    │   ├── favicon-light.svg
    │   ├── favicon-dark.svg
    │   └── pwa-icon-light.svg
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── hooks/
        │   ├── useAuth.jsx
        │   ├── useTheme.jsx
        │   └── useWindowWidth.jsx
        ├── lib/
        │   ├── api.js
        │   ├── appName.js
        │   ├── utils.js
        │   └── version.js
        ├── components/
        │   ├── Layout.jsx
        │   ├── TabButton.jsx
        │   ├── PdfViewer.jsx
        │   ├── PdfUploader.jsx
        │   ├── ResultFileUploader.jsx
        │   ├── RouteUploader.jsx
        │   ├── ThemeToggle.jsx
        │   ├── TimezoneSelect.jsx
        │   └── ...
        └── pages/
            ├── DashboardPage.jsx
            ├── calendar/
            ├── public/
            ├── settings/
            └── races/
```

## Deployment Notes

- The frontend container serves the static app through Nginx and proxies `/api/` to the backend container
- PostgreSQL data is persisted in the `postgres_data` volume
- Upload files are persisted in the `uploads_data` volume
- Set `COOKIE_SECURE=true` when deploying behind HTTPS
- Set `CORS_ORIGIN` to your frontend origin in production
- If you use email features, configure the SMTP variables before starting the backend

## Notes

- The frontend uses a service worker for shell caching and offline support
- Private file caching is session-scoped and cleared on logout or auth failure
- The browser app uses cookie auth; the backend still accepts JWT-based auth for compatibility

