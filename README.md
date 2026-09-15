<div align="center">

# 📋 ProjectHub

**A clean, Notion-inspired project management workspace for a solo manager.**
Track projects, tasks, teammates, files, activity and analytics — with Slack alerts baked in.

<br />

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-6-47A248?logo=mongodb&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)
![Node](https://img.shields.io/badge/Node-22.x-3C873A?logo=node.js&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/license-Private-lightgrey)

</div>

---

## ✨ Highlights

- 🔐 **JWT manager login** — single-tenant, bcrypt hashed, seeded from `.env`
- 📊 **Live dashboard** — KPIs, recent projects with progress bars, upcoming deadlines, activity feed
- 🗂️ **Projects & milestones** — grid + list views, statuses, covers, due dates, archiving
- 🧩 **Kanban board** — HTML5 drag-and-drop across five columns with instant Slack + activity updates
- 👥 **Team members** — CRUD with auto-computed workload
- 📎 **Files & attachments** — multipart uploads to Emergent Object Storage, download & soft-delete
- 💬 **Comments & activity log** — threaded discussions and an auto-generated timeline
- 📈 **Analytics** — Recharts-powered area / pie / bar charts, top-projects table
- 🔔 **Notifications** — in-app inbox with an unread badge + Slack webhook alerts
- 🌱 **Demo data** — 3 sample projects, 4 members and 13 tasks seeded on first run

---

## 🛠 Tech Stack

<table>
<tr>
<td valign="top" width="50%">

**Frontend**
- React 19 (JavaScript)
- CRA + CRACO
- TailwindCSS 3 + shadcn/ui
- React Router 7
- TanStack Query
- Recharts, Sonner, Lucide

</td>
<td valign="top" width="50%">

**Backend**
- FastAPI (Python 3.11+)
- Motor (async MongoDB)
- PyJWT + bcrypt
- Pydantic v2
- Emergent Object Storage
- Slack Incoming Webhooks

</td>
</tr>
</table>

---

## 🚀 Quick Start

> Requires **Node 22** (or 20+), **Python 3.11+**, **MongoDB** running locally, and **Yarn 1.x**.

### 1. Clone

```bash
git clone <your-repo-url> projecthub && cd projecthub
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create backend/.env — see the table below
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The first startup automatically seeds the manager account **plus** 3 demo projects, 4 team members and 13 tasks.

### 3. Frontend

```bash
cd ../frontend
yarn install
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env
yarn start
```

Open **http://localhost:3000** and sign in with the credentials from your backend `.env`.

### 4. (Optional) Slack alerts

Go to **Settings → Slack integration**, paste an [Incoming Webhook URL](https://api.slack.com/messaging/webhooks), toggle events, and click **Send test alert**.

---

## 🔑 Environment Variables

### `backend/.env`

| Variable            | Required | Description                                                      |
|---------------------|:--------:|------------------------------------------------------------------|
| `MONGO_URL`         |    ✅    | Mongo connection string, e.g. `mongodb://localhost:27017`        |
| `DB_NAME`           |    ✅    | Mongo database name                                              |
| `JWT_SECRET`        |    ✅    | 32+ byte random hex, signs access tokens                         |
| `ADMIN_EMAIL`       |    ✅    | Seeded manager email (used to log in)                            |
| `ADMIN_PASSWORD`    |    ✅    | Seeded manager password                                          |
| `ADMIN_NAME`        |    —     | Display name for the manager                                     |
| `CORS_ORIGINS`      |    —     | Comma-separated allow-list, defaults to `*`                      |
| `EMERGENT_LLM_KEY`  |    —     | Enables Emergent Object Storage for file uploads                 |
| `APP_NAME`          |    —     | Storage namespace, defaults to `projecthub`                      |

### `frontend/.env`

| Variable                | Required | Description                                        |
|-------------------------|:--------:|----------------------------------------------------|
| `REACT_APP_BACKEND_URL` |    ✅    | Backend base URL, **no trailing slash**            |
| `WDS_SOCKET_PORT`       |    —     | Dev-server socket port behind a proxy (e.g. `443`) |

> All frontend requests go to `${REACT_APP_BACKEND_URL}/api/…`. All backend routes are prefixed with `/api`.

---

## 📁 Project Structure

```text
projecthub/
├── backend/
│   ├── server.py            # FastAPI app — routes, auth, seeding, storage, Slack
│   ├── requirements.txt
│   └── .env                 # secrets & config (git-ignored)
│
├── frontend/
│   ├── package.json         # engines.node = "22.x"
│   ├── craco.config.js      # webpack overrides
│   ├── vercel.json          # Vercel build config
│   ├── .nvmrc               # 22.11.0
│   ├── .yarnrc              # local ignore-engines for Node 20 dev containers
│   ├── tailwind.config.js
│   ├── public/
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── index.css
│       ├── lib/api.js               # axios + JWT interceptor
│       ├── context/AuthContext.js
│       ├── components/
│       │   ├── ui/                  # shadcn primitives
│       │   └── app/
│       │       ├── Layout.jsx       # sidebar + top bar
│       │       ├── KanbanBoard.jsx  # drag-and-drop board
│       │       └── FileList.jsx     # upload / list / download
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

---

## ☁️ Deployment — Vercel (frontend)

The frontend is Vercel-ready out of the box.

1. **Import** the repo in Vercel.
2. Set **Root Directory** → `frontend`.
3. Add the env var **`REACT_APP_BACKEND_URL`** pointing at your deployed backend.
4. **Deploy.** Vercel reads `engines.node = "22.x"` and `frontend/vercel.json` automatically:

```json
{
  "framework": "create-react-app",
  "installCommand": "yarn install --network-timeout 600000",
  "buildCommand": "yarn build",
  "outputDirectory": "build"
}
```

> **Why Node 22?** Node 20 is deprecated on Vercel, and Node 24 breaks CRA's bundled `fork-ts-checker-webpack-plugin`. 22.x is the sweet spot.

### Backend hosting

The API is a plain FastAPI app — deploy it wherever Python + Mongo are convenient (Emergent, Fly.io, Render, Railway, Heroku, a VM). Make sure:

- `MONGO_URL` reaches a running MongoDB
- `CORS_ORIGINS` includes your Vercel frontend origin (or leave `*`)

---

## 🧪 Test Credentials

```
Email:    <ADMIN_EMAIL   from backend/.env>   # default in this repo: swathi.p@emergent.sh
Password: <ADMIN_PASSWORD from backend/.env>  # default in this repo: admin123
```

**Rotate both before shipping to production.**

---

## 🗺️ Roadmap

- [ ] Task detail drawer with inline editing & per-task comments
- [ ] 24-hour deadline reminders (Slack + in-app)
- [ ] Weekly Monday-morning digest email
- [ ] AI project recap + next-task suggestions (Universal LLM key)
- [ ] Gantt / timeline view
- [ ] Recurring tasks & templates
- [ ] Read-only client share links

---

<div align="center">

Made with ☕ and shadcn/ui.

</div>
