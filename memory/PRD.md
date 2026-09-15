# ProjectHub — PRD & Build Log

## Original problem statement
Clean, minimal web app for a solo manager to track projects — tasks, team, files, activity, analytics — with Slack notifications. Notion/Linear inspired, indigo accent. Screens: Login, Dashboard, Projects (list + detail with tabs), Kanban, Team, Files, Reports, Notifications, Settings.

## User persona
Solo manager (single-tenant). Team members are records the manager manages (not users who log in).

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT Bearer auth via `Authorization: Bearer <token>` (localStorage `ph_token`).
- Frontend: React 19 (JS) + Tailwind + shadcn/ui + Recharts. React Query for server state, Sonner for toasts.
- File storage: Emergent Object Storage (proxy /objstore).
- Slack: Incoming Webhook posted per-event, toggleable per-trigger in Settings.

## Core requirements (static)
1. Manager JWT login (seeded from ADMIN_EMAIL/PASSWORD env).
2. Dashboard: KPIs, recent projects with progress, upcoming deadlines, activity feed.
3. Projects: create/edit/archive, milestones, team assignment, status, due date.
4. Tasks: CRUD, priority, assignee, due date; Kanban board with HTML5 drag & drop across `backlog/todo/in_progress/review/done`.
5. Team: CRUD with computed workload (active tasks).
6. Files: multipart upload → object storage, list, download (Bearer or ?auth=), soft delete.
7. Comments & Activity Log per project.
8. Reports: KPIs + area chart (weekly completions), pie (status), bar (workload), top projects table.
9. Notifications: in-app + optional Slack alerts for 6 event types.
10. Settings: Slack webhook URL + trigger toggles + test alert.

## What's been implemented (2026-02-XX)
- JWT auth (bcrypt, 7-day access token) with seeded manager `swathi.p@emergent.sh`.
- Demo seed: 3 projects, 4 team members, 13 tasks, activity feed.
- Full CRUD across projects/tasks/team/comments/files/notifications/settings.
- Kanban drag & drop with automatic activity log + Slack alerts on status change.
- Object storage upload with query-param-auth download for browser embedding.
- Reports summary endpoint with 8-week rollup.
- Full frontend: Login, Dashboard, Projects list+detail (tabs: Overview/Tasks/Files/Activity/Comments), Kanban, Team, Files, Reports, Notifications, Settings.
- 14/14 backend pytest checks green; frontend E2E verified.

## Prioritized backlog / next tasks (P0/P1/P2)
- P1: Deadline reminder cron (24h before due) firing Slack + in-app.
- P1: Task detail drawer with inline edit + comments per task.
- P2: File preview modal for images/PDF.
- P2: Gantt / timeline view for projects.
- P2: Recurring tasks & templates.
- P3: AI project summary + next-task suggestion (Emergent LLM key).
- P3: Read-only client share links per project.

## Known limitations
- Single manager account only; team members are records, not logins.
- Slack test with an invalid webhook is treated as a client error (400 with toast).
