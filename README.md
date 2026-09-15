# ProjectHub

A clean, Notion/Linear-inspired project management workspace for a solo manager. Track every project, task, teammate, file, comment and metric in one place — with Slack notifications baked in.

Login → Dashboard → Projects → Kanban → Reports, all under an indigo-accented, minimal UI.

## What the app does

- **Manager login** (JWT email + password, single-tenant)
- **Dashboard** — live KPIs (active projects, tasks due, team size, completion rate), recent projects with progress bars, upcoming deadlines, activity feed
- **Projects** — create / edit / archive, statuses, milestones, cover images, due dates; grid & list views
- **Project detail** — tabs for Overview, Tasks, Files, Activity, Comments
- **Tasks & Kanban** — HTML5 drag-and-drop across `Backlog → To Do → In Progress → In Review → Done`, priority, assignee, due date
- **Team members** — add / edit / remove members with auto-computed workload
- **Files & attachments** — multipart upload to Emergent Object Storage, type-aware icons, download and soft-delete
- **Comments & activity log** — threaded comments per project, auto-generated timeline of everything that happens
- **Reports & analytics** — area chart (weekly completions), pie (status mix), bar (team workload), top-projects table (Recharts)
- **Notifications center** — in-app inbox with unread badge, tab filters, mark-all-read
- **Slack integration** — Incoming Webhook + per-event toggles (task created / assigned / completed, new comment, project status change, deadline approaching)
- **Demo data** — 3 sample projects, 4 team members and 13 tasks are seeded on first run

## Tech stack

**Frontend**
- React 19 (JavaScript, CRA + CRACO)
- TailwindCSS 3 + shadcn/ui component library
- React Router 7
- TanStack Query (server state)
- Recharts (analytics charts)
- Sonner (toasts), Lucide React (icons)

**Backend**
- FastAPI (Python 3.11+)
- Motor (async MongoDB driver)
- PyJWT + bcrypt (auth)
- Pydantic (validation)
- Emergent Object Storage proxy (file uploads)
- Slack Incoming Webhooks (notifications)

**Data**
- MongoDB (single database, collections: `users`, `projects`, `tasks`, `members`, `comments`, `activity`, `notifications`, `files`, `settings`)

## Folder structure

```
/app
├── backend/
│   ├── server.py            # FastAPI app — all /api routes, auth, seeding, storage, Slack
│   ├── requirements.txt
│   └── .env                 # MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL/PASSWORD, EMERGENT_LLM_KEY
│
├── frontend/
│   ├── package.json         # engines: node 22.x
│   ├── craco.config.js      # webpack overrides (strips ForkTsCheckerWebpackPlugin)
│   ├── vercel.json          # framework=CRA, buildCommand=yarn build, outputDirectory=build
│   ├── .nvmrc               # 22.11.0
│   ├── .yarnrc              # ignore-engines for local dev
│   ├── tailwind.config.js
│   ├── public/
│   └── src/
│       ├── index.js         # React root, QueryClientProvider
│       ├── App.js           # Router + AuthProvider + Toaster
│       ├── index.css        # Tailwind + design tokens (Inter font, indigo palette)
│       ├── lib/api.js       # axios instance, JWT interceptor, file URL helper
│       ├── context/
│       │   └── AuthContext.js
│       ├── components/
│       │   ├── ui/          # shadcn primitives (Button, Card, Dialog, Select, …)
│       │   └── app/
│       │       ├── Layout.jsx         # Sidebar + top bar
│       │       ├── KanbanBoard.jsx    # drag-and-drop board
│       │       └── FileList.jsx       # upload / list / download
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Projects.jsx
│           ├── ProjectDetail.jsx
│           ├── Kanban.jsx
│           ├── Team.jsx
│           ├── Files.jsx
│           ├── Reports.jsx
│           ├── Notifications.jsx
│           └── Settings.jsx
│
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Environment variables

### `backend/.env`

| Variable            | Required | Description                                                                |
|---------------------|----------|----------------------------------------------------------------------------|
| `MONGO_URL`         | ✅       | Mongo connection string (e.g. `mongodb://localhost:27017`)                 |
| `DB_NAME`           | ✅       | Database name (e.g. `test_database`)                                       |
| `JWT_SECRET`        | ✅       | Random 32+ byte hex string used to sign access tokens                      |
| `ADMIN_EMAIL`       | ✅       | Seeded manager email (login)                                               |
| `ADMIN_PASSWORD`    | ✅       | Seeded manager password (login)                                            |
| `ADMIN_NAME`        | ⬜       | Display name for the manager                                               |
| `CORS_ORIGINS`      | ⬜       | Comma-separated origins allowed by CORS. Defaults to `*`                   |
| `EMERGENT_LLM_KEY`  | ⬜       | Enables file uploads via Emergent Object Storage. If absent, uploads 503   |
| `APP_NAME`          | ⬜       | Namespacing for stored files (defaults to `projecthub`)                    |

### `frontend/.env`

| Variable                  | Required | Description                                                    |
|---------------------------|----------|----------------------------------------------------------------|
| `REACT_APP_BACKEND_URL`   | ✅       | Base URL of the backend (without a trailing slash)             |
| `WDS_SOCKET_PORT`         | ⬜       | Dev-server socket port when behind a proxy (usually `443`)     |

> All API calls from the frontend are made to `${REACT_APP_BACKEND_URL}/api/…`. All backend routes are prefixed with `/api`.

## Setup — run locally

Prerequisites: Node 22 (recommended) or 20+, Python 3.11+, MongoDB running locally, Yarn 1.x.

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Fill in backend/.env — at minimum MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The first startup seeds the admin user plus 3 demo projects / 4 members / 13 tasks.

### 2. Frontend

```bash
cd frontend
yarn install
# Point the frontend at your backend
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env

yarn start
```

The app is now at `http://localhost:3000`. Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` values from your backend `.env`.

### 3. (Optional) Slack alerts

Open **Settings → Slack integration**, paste an [Incoming Webhook URL](https://api.slack.com/messaging/webhooks), toggle the events you want and click **Send test alert** to verify.

## Deployment notes — Vercel

The frontend is deployable to Vercel out of the box.

1. **Import the repo** in Vercel and set **Root Directory = `frontend`**.
2. Vercel will read `frontend/package.json` `engines.node = "22.x"` and pick Node 22 automatically (Node 20 is deprecated on Vercel and Node 24 breaks CRA's bundled `fork-ts-checker-webpack-plugin`).
3. `frontend/vercel.json` already specifies:
   - `framework: create-react-app`
   - `installCommand: yarn install --network-timeout 600000`
   - `buildCommand: yarn build`
   - `outputDirectory: build`
4. Add the environment variable **`REACT_APP_BACKEND_URL`** in the Vercel project (Settings → Environment Variables), pointing at your deployed backend.
5. Redeploy. That's it — no other tweaks required.

**Backend hosting.** The API is a plain FastAPI app; deploy it wherever Python + Mongo are convenient (Emergent one-click deploy, Fly.io, Render, Railway, Heroku, a VM, etc.). Make sure `MONGO_URL` points at a reachable MongoDB and that CORS allows the Vercel frontend origin (or leave `CORS_ORIGINS=*`).

### Local dev on Node 20

The engines pin is strict for Vercel but ignored locally via `frontend/.yarnrc` (`ignore-engines true`). Node 20+ works fine for development.

## Test credentials

```
Email:    <ADMIN_EMAIL from backend/.env>   (default in this repo: swathi.p@emergent.sh)
Password: <ADMIN_PASSWORD from backend/.env> (default in this repo: admin123)
```

Rotate both before shipping to production.

## License

Private / internal.
