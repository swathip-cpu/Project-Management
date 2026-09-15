from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Header, Query, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("projecthub")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower().strip()
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Manager")
APP_NAME = os.environ.get("APP_NAME", "projecthub")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ProjectHub API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Utilities ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user

# ---------- Object Storage ----------
_storage_key: Optional[str] = None

def init_storage(force: bool = False) -> Optional[str]:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY missing; file uploads disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    r.raise_for_status()
    return r.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------- Slack ----------
async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"id": "app"})
    if not doc:
        doc = {"id": "app", "slack_webhook_url": "", "slack_events": {
            "task_created": True, "task_assigned": True, "task_completed": True,
            "deadline_approaching": True, "new_comment": True, "project_status_change": True,
        }}
        await db.settings.insert_one(doc)
    doc.pop("_id", None)
    return doc

async def slack_notify(event: str, text: str, blocks: Optional[list] = None):
    try:
        s = await get_settings_doc()
        url = (s.get("slack_webhook_url") or "").strip()
        events = s.get("slack_events") or {}
        if not url or not events.get(event, True):
            return
        payload = {"text": text}
        if blocks:
            payload["blocks"] = blocks
        r = requests.post(url, json=payload, timeout=10)
        logger.info(f"Slack {event} -> {r.status_code}")
    except Exception as e:
        logger.error(f"Slack error: {e}")

# ---------- Activity & Notifications ----------
async def log_activity(project_id: Optional[str], task_id: Optional[str], kind: str, message: str, meta: Optional[dict] = None):
    doc = {
        "id": new_id(),
        "project_id": project_id,
        "task_id": task_id,
        "kind": kind,
        "message": message,
        "meta": meta or {},
        "created_at": now_iso(),
    }
    await db.activity.insert_one(doc)

async def push_notification(title: str, message: str, kind: str = "info", link: Optional[str] = None, source: str = "system"):
    doc = {
        "id": new_id(),
        "title": title,
        "message": message,
        "kind": kind,
        "source": source,
        "link": link,
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)

def clean(d: dict) -> dict:
    d.pop("_id", None)
    return d

# ---------- Models ----------
class LoginBody(BaseModel):
    email: EmailStr
    password: str

class ProjectBody(BaseModel):
    name: str
    description: Optional[str] = ""
    status: str = "planning"  # planning | in_progress | on_hold | completed | archived
    cover_url: Optional[str] = None
    lead_member_id: Optional[str] = None
    member_ids: List[str] = []
    milestones: List[Dict[str, Any]] = []
    due_date: Optional[str] = None

class TaskBody(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = ""
    status: str = "todo"  # backlog | todo | in_progress | review | done
    priority: str = "medium"  # low | medium | high | urgent
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    tags: List[str] = []

class TaskUpdateBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None

class MemberBody(BaseModel):
    name: str
    email: EmailStr
    role: str = "Member"
    avatar_url: Optional[str] = None

class CommentBody(BaseModel):
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    body: str

class SettingsBody(BaseModel):
    slack_webhook_url: Optional[str] = None
    slack_events: Optional[Dict[str, bool]] = None

# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    user.pop("password_hash", None)
    return {"token": token, "user": clean(user)}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(user=Depends(get_current_user)):
    return {"ok": True}

# ---------- Team ----------
@api.get("/team")
async def list_team(user=Depends(get_current_user)):
    docs = await db.members.find({}).sort("created_at", -1).to_list(500)
    for d in docs:
        d.pop("_id", None)
        # Workload
        count = await db.tasks.count_documents({"assignee_id": d["id"], "status": {"$ne": "done"}})
        d["active_tasks"] = count
    return docs

@api.post("/team")
async def create_member(body: MemberBody, user=Depends(get_current_user)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    if not doc.get("avatar_url"):
        # Deterministic dicebear-style fallback via ui-avatars
        n = body.name.replace(" ", "+")
        doc["avatar_url"] = f"https://ui-avatars.com/api/?name={n}&background=4F46E5&color=fff"
    await db.members.insert_one(doc)
    await log_activity(None, None, "member_added", f"Added team member {body.name}")
    return clean(doc)

@api.put("/team/{mid}")
async def update_member(mid: str, body: MemberBody, user=Depends(get_current_user)):
    res = await db.members.update_one({"id": mid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.members.find_one({"id": mid})
    return clean(doc)

@api.delete("/team/{mid}")
async def delete_member(mid: str, user=Depends(get_current_user)):
    await db.members.delete_one({"id": mid})
    return {"ok": True}

# ---------- Projects ----------
@api.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    docs = await db.projects.find({}).sort("created_at", -1).to_list(500)
    result = []
    for d in docs:
        d.pop("_id", None)
        total = await db.tasks.count_documents({"project_id": d["id"]})
        done = await db.tasks.count_documents({"project_id": d["id"], "status": "done"})
        d["task_count"] = total
        d["completed_count"] = done
        d["progress"] = int((done / total) * 100) if total else 0
        result.append(d)
    return result

@api.post("/projects")
async def create_project(body: ProjectBody, user=Depends(get_current_user)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso(), "updated_at": now_iso()}
    await db.projects.insert_one(doc)
    await log_activity(doc["id"], None, "project_created", f"Project '{body.name}' created")
    await push_notification("Project created", f"'{body.name}' was created.", kind="success", link=f"/projects/{doc['id']}")
    return clean(doc)

@api.get("/projects/{pid}")
async def get_project(pid: str, user=Depends(get_current_user)):
    doc = await db.projects.find_one({"id": pid})
    if not doc:
        raise HTTPException(404, "Not found")
    return clean(doc)

@api.put("/projects/{pid}")
async def update_project(pid: str, body: ProjectBody, user=Depends(get_current_user)):
    existing = await db.projects.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Not found")
    update = body.model_dump()
    update["updated_at"] = now_iso()
    await db.projects.update_one({"id": pid}, {"$set": update})
    if existing.get("status") != body.status:
        await log_activity(pid, None, "project_status", f"Status changed to {body.status}")
        await slack_notify("project_status_change", f":rocket: Project *{body.name}* status → *{body.status}*")
        await push_notification("Project status changed", f"{body.name} is now {body.status}", kind="info", link=f"/projects/{pid}")
    doc = await db.projects.find_one({"id": pid})
    return clean(doc)

@api.delete("/projects/{pid}")
async def delete_project(pid: str, user=Depends(get_current_user)):
    await db.projects.update_one({"id": pid}, {"$set": {"status": "archived", "updated_at": now_iso()}})
    await log_activity(pid, None, "project_archived", "Project archived")
    return {"ok": True}

# ---------- Tasks ----------
@api.get("/tasks")
async def list_tasks(project_id: Optional[str] = None, assignee_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    if assignee_id:
        q["assignee_id"] = assignee_id
    docs = await db.tasks.find(q).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]

@api.post("/tasks")
async def create_task(body: TaskBody, user=Depends(get_current_user)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso(), "updated_at": now_iso()}
    await db.tasks.insert_one(doc)
    project = await db.projects.find_one({"id": body.project_id})
    pname = project["name"] if project else "Project"
    await log_activity(body.project_id, doc["id"], "task_created", f"Task '{body.title}' created")
    await slack_notify("task_created", f":sparkles: New task *{body.title}* in *{pname}*")
    await push_notification("Task created", body.title, kind="info", link=f"/projects/{body.project_id}")
    if body.assignee_id:
        m = await db.members.find_one({"id": body.assignee_id})
        if m:
            await slack_notify("task_assigned", f":bust_in_silhouette: *{body.title}* assigned to *{m['name']}*")
            await push_notification("Task assigned", f"{body.title} → {m['name']}", kind="info", link=f"/projects/{body.project_id}")
    return clean(doc)

@api.put("/tasks/{tid}")
async def update_task(tid: str, body: TaskUpdateBody, user=Depends(get_current_user)):
    existing = await db.tasks.find_one({"id": tid})
    if not existing:
        raise HTTPException(404, "Not found")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.tasks.update_one({"id": tid}, {"$set": update})
    # Notifications
    if "status" in update and update["status"] != existing.get("status"):
        await log_activity(existing["project_id"], tid, "task_status", f"Task '{existing['title']}' → {update['status']}")
        if update["status"] == "done":
            await slack_notify("task_completed", f":white_check_mark: Task *{existing['title']}* completed")
            await push_notification("Task completed", existing["title"], kind="success", link=f"/projects/{existing['project_id']}")
    if "assignee_id" in update and update["assignee_id"] != existing.get("assignee_id"):
        if update["assignee_id"]:
            m = await db.members.find_one({"id": update["assignee_id"]})
            if m:
                await slack_notify("task_assigned", f":bust_in_silhouette: *{existing['title']}* assigned to *{m['name']}*")
                await push_notification("Task assigned", f"{existing['title']} → {m['name']}", kind="info")
    doc = await db.tasks.find_one({"id": tid})
    return clean(doc)

@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user=Depends(get_current_user)):
    await db.tasks.delete_one({"id": tid})
    await db.comments.delete_many({"task_id": tid})
    return {"ok": True}

# ---------- Comments ----------
@api.get("/comments")
async def list_comments(project_id: Optional[str] = None, task_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    if task_id:
        q["task_id"] = task_id
    docs = await db.comments.find(q).sort("created_at", 1).to_list(1000)
    return [clean(d) for d in docs]

@api.post("/comments")
async def create_comment(body: CommentBody, user=Depends(get_current_user)):
    doc = {"id": new_id(), **body.model_dump(), "author": user.get("name") or user.get("email"), "created_at": now_iso()}
    await db.comments.insert_one(doc)
    if body.project_id:
        await log_activity(body.project_id, body.task_id, "comment_added", f"New comment on project")
        project = await db.projects.find_one({"id": body.project_id})
        if project:
            await slack_notify("new_comment", f":speech_balloon: New comment on *{project['name']}*: {body.body[:120]}")
            await push_notification("New comment", body.body[:80], kind="info", link=f"/projects/{body.project_id}")
    return clean(doc)

@api.delete("/comments/{cid}")
async def delete_comment(cid: str, user=Depends(get_current_user)):
    await db.comments.delete_one({"id": cid})
    return {"ok": True}

# ---------- Activity ----------
@api.get("/activity")
async def list_activity(project_id: Optional[str] = None, limit: int = 100, user=Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    docs = await db.activity.find(q).sort("created_at", -1).to_list(limit)
    return [clean(d) for d in docs]

# ---------- Notifications ----------
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    docs = await db.notifications.find({}).sort("created_at", -1).to_list(200)
    return [clean(d) for d in docs]

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_read_all(user=Depends(get_current_user)):
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}

@api.delete("/notifications/{nid}")
async def delete_notification(nid: str, user=Depends(get_current_user)):
    await db.notifications.delete_one({"id": nid})
    return {"ok": True}

# ---------- Files ----------
@api.get("/files")
async def list_files(project_id: Optional[str] = None, task_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {"is_deleted": False}
    if project_id:
        q["project_id"] = project_id
    if task_id:
        q["task_id"] = task_id
    docs = await db.files.find(q).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]

@api.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    task_id: Optional[str] = Form(None),
    user=Depends(get_current_user),
):
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, data, content_type)
    fid = new_id()
    doc = {
        "id": fid,
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": content_type,
        "extension": ext,
        "size": result.get("size", len(data)),
        "project_id": project_id,
        "task_id": task_id,
        "uploaded_by": user.get("name") or user.get("email"),
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    if project_id:
        await log_activity(project_id, task_id, "file_uploaded", f"Uploaded {filename}")
    return clean(doc)

@api.get("/files/{fid}/download")
async def download_file(fid: str, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    # Manual auth for img/src fallback
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(401, "Invalid token")
    rec = await db.files.find_one({"id": fid, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "Not found")
    data, ct = get_object(rec["storage_path"])
    return Response(
        content=data,
        media_type=rec.get("content_type", ct),
        headers={"Content-Disposition": f'inline; filename="{rec["original_filename"]}"'},
    )

@api.delete("/files/{fid}")
async def delete_file(fid: str, user=Depends(get_current_user)):
    await db.files.update_one({"id": fid}, {"$set": {"is_deleted": True}})
    return {"ok": True}

# ---------- Settings ----------
@api.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    return await get_settings_doc()

@api.put("/settings")
async def update_settings(body: SettingsBody, user=Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "app"}, {"$set": update}, upsert=True)
    return await get_settings_doc()

@api.post("/settings/test-slack")
async def test_slack(user=Depends(get_current_user)):
    s = await get_settings_doc()
    url = (s.get("slack_webhook_url") or "").strip()
    if not url:
        raise HTTPException(400, "No webhook configured")
    try:
        r = requests.post(url, json={"text": ":wave: ProjectHub test alert — Slack integration is working."}, timeout=10)
        r.raise_for_status()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"Slack request failed: {e}")

# ---------- Reports ----------
@api.get("/reports/summary")
async def report_summary(start: Optional[str] = None, end: Optional[str] = None, user=Depends(get_current_user)):
    projects = await db.projects.find({}).to_list(1000)
    tasks = await db.tasks.find({}).to_list(5000)
    members = await db.members.find({}).to_list(500)

    total_tasks = len(tasks)
    done_tasks = sum(1 for t in tasks if t.get("status") == "done")
    active_projects = sum(1 for p in projects if p.get("status") in ("planning", "in_progress"))

    # Tasks due (not done, due within 7 days)
    now = datetime.now(timezone.utc)
    upcoming = 0
    for t in tasks:
        if t.get("status") == "done":
            continue
        dd = t.get("due_date")
        if not dd:
            continue
        try:
            due = datetime.fromisoformat(dd.replace("Z", "+00:00"))
            if 0 <= (due - now).days <= 7:
                upcoming += 1
        except Exception:
            pass

    # Status distribution
    status_dist: Dict[str, int] = {}
    for p in projects:
        s = p.get("status", "planning")
        status_dist[s] = status_dist.get(s, 0) + 1

    # Completion per week (last 8 weeks)
    weekly = []
    for w in range(7, -1, -1):
        week_start = (now - timedelta(days=(w + 1) * 7)).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        count = 0
        for t in tasks:
            if t.get("status") != "done":
                continue
            ts = t.get("updated_at") or t.get("created_at")
            if not ts:
                continue
            try:
                d = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if week_start <= d < week_end:
                    count += 1
            except Exception:
                pass
        weekly.append({"week": week_start.strftime("%b %d"), "completed": count})

    # Top projects table (by progress)
    top = []
    for p in projects:
        pt = [t for t in tasks if t.get("project_id") == p["id"]]
        total = len(pt)
        done = sum(1 for t in pt if t.get("status") == "done")
        prog = int((done / total) * 100) if total else 0
        top.append({"id": p["id"], "name": p["name"], "status": p.get("status"), "total_tasks": total, "completed": done, "progress": prog})
    top.sort(key=lambda x: (-x["progress"], -x["total_tasks"]))

    # Team workload
    workload = []
    for m in members:
        active = sum(1 for t in tasks if t.get("assignee_id") == m["id"] and t.get("status") != "done")
        workload.append({"name": m["name"], "active": active})

    completion_rate = int((done_tasks / total_tasks) * 100) if total_tasks else 0

    return {
        "kpis": {
            "active_projects": active_projects,
            "total_projects": len(projects),
            "tasks_due": upcoming,
            "team_size": len(members),
            "completion_rate": completion_rate,
            "total_tasks": total_tasks,
            "done_tasks": done_tasks,
        },
        "status_distribution": [{"name": k, "value": v} for k, v in status_dist.items()],
        "weekly_completed": weekly,
        "top_projects": top[:8],
        "workload": workload,
    }

@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    projects = await db.projects.find({}).sort("updated_at", -1).to_list(50)
    tasks = await db.tasks.find({}).to_list(5000)
    members = await db.members.find({}).to_list(500)
    now = datetime.now(timezone.utc)

    recent_projects = []
    for p in projects[:5]:
        pt = [t for t in tasks if t.get("project_id") == p["id"]]
        total = len(pt)
        done = sum(1 for t in pt if t.get("status") == "done")
        prog = int((done / total) * 100) if total else 0
        recent_projects.append({**clean(p), "progress": prog, "task_count": total, "completed_count": done})

    upcoming = []
    for t in tasks:
        if t.get("status") == "done":
            continue
        dd = t.get("due_date")
        if not dd:
            continue
        try:
            due = datetime.fromisoformat(dd.replace("Z", "+00:00"))
            days = (due - now).days
            if -7 <= days <= 14:
                upcoming.append({**clean(t), "days_left": days})
        except Exception:
            pass
    upcoming.sort(key=lambda x: x["days_left"])

    active_projects = sum(1 for p in projects if p.get("status") in ("planning", "in_progress"))
    total_tasks = len(tasks)
    done_tasks = sum(1 for t in tasks if t.get("status") == "done")
    tasks_due = sum(1 for t in tasks if t.get("status") != "done" and t.get("due_date"))
    completion_rate = int((done_tasks / total_tasks) * 100) if total_tasks else 0

    recent_activity = await db.activity.find({}).sort("created_at", -1).to_list(8)
    return {
        "kpis": {
            "active_projects": active_projects,
            "tasks_due": tasks_due,
            "team_size": len(members),
            "completion_rate": completion_rate,
        },
        "recent_projects": recent_projects,
        "upcoming_deadlines": upcoming[:8],
        "recent_activity": [clean(a) for a in recent_activity],
    }

# ---------- Seed & Startup ----------
async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        doc = {
            "id": new_id(),
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "role": "manager",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "avatar_url": f"https://ui-avatars.com/api/?name={ADMIN_NAME.replace(' ', '+')}&background=4F46E5&color=fff",
            "created_at": now_iso(),
        }
        await db.users.insert_one(doc)
        logger.info(f"Seeded admin {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        logger.info(f"Updated admin password for {ADMIN_EMAIL}")

async def seed_demo():
    if await db.projects.count_documents({}) > 0:
        return
    logger.info("Seeding demo data...")

    # Team members
    members = [
        {"id": new_id(), "name": "Alex Mercer", "email": "alex.m@studio.co", "role": "Lead PM",
         "avatar_url": "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=srgb&fm=jpg&w=200",
         "created_at": now_iso()},
        {"id": new_id(), "name": "Elena Rostova", "email": "elena.r@studio.co", "role": "Senior UX/UI Designer",
         "avatar_url": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=srgb&fm=jpg&w=200",
         "created_at": now_iso()},
        {"id": new_id(), "name": "David Chen", "email": "david.c@studio.co", "role": "Principal Architect",
         "avatar_url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?crop=entropy&cs=srgb&fm=jpg&w=200",
         "created_at": now_iso()},
        {"id": new_id(), "name": "Marcus Vance", "email": "marcus.v@studio.co", "role": "Fullstack Tech Lead",
         "avatar_url": "https://images.unsplash.com/photo-1718209881007-c0ecdfc00f9d?crop=entropy&cs=srgb&fm=jpg&w=200",
         "created_at": now_iso()},
    ]
    await db.members.insert_many(members)
    mids = [m["id"] for m in members]

    now = datetime.now(timezone.utc)
    projects = [
        {"id": new_id(), "name": "Cloud Migration Architecture",
         "description": "Migrate legacy monolith to a multi-region Kubernetes-based stack with zero downtime.",
         "status": "in_progress",
         "cover_url": "https://images.unsplash.com/photo-1522404419647-18cb51cc5c7a?crop=entropy&cs=srgb&fm=jpg&w=800",
         "lead_member_id": mids[2], "member_ids": mids[1:4],
         "milestones": [{"title": "Assessment", "done": True}, {"title": "Pilot cluster", "done": True}, {"title": "Prod cutover", "done": False}],
         "due_date": (now + timedelta(days=30)).isoformat(),
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "name": "Fintech Mobile App Redesign",
         "description": "Refresh onboarding, statements, and card management screens with a Notion-clean aesthetic.",
         "status": "in_progress",
         "cover_url": "https://images.unsplash.com/photo-1548248823-ce16a73b6d49?crop=entropy&cs=srgb&fm=jpg&w=800",
         "lead_member_id": mids[1], "member_ids": mids[:3],
         "milestones": [{"title": "Research", "done": True}, {"title": "Wireframes", "done": True}, {"title": "Hi-fi", "done": False}, {"title": "Handoff", "done": False}],
         "due_date": (now + timedelta(days=18)).isoformat(),
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "name": "AI Knowledge Engine R&D",
         "description": "Prototype a RAG-based product knowledge assistant across support tickets and docs.",
         "status": "planning",
         "cover_url": "https://images.unsplash.com/photo-1527576539890-dfa815648363?crop=entropy&cs=srgb&fm=jpg&w=800",
         "lead_member_id": mids[3], "member_ids": [mids[0], mids[3]],
         "milestones": [{"title": "Scoping", "done": True}, {"title": "Prototype", "done": False}],
         "due_date": (now + timedelta(days=60)).isoformat(),
         "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.projects.insert_many(projects)

    demo_tasks = []
    task_defs = [
        (0, "Provision multi-region VPC", "in_progress", "high", 2, 4),
        (0, "Set up Argo CD & GitOps pipeline", "todo", "medium", 3, 8),
        (0, "Migrate identity service", "done", "high", 2, -3),
        (0, "Load-test staging cluster", "review", "medium", 3, 6),
        (0, "Draft rollback playbook", "backlog", "low", 2, 12),
        (1, "New onboarding wireframes", "done", "high", 1, -2),
        (1, "Card management hi-fi mocks", "in_progress", "urgent", 1, 3),
        (1, "Empty states illustrations", "todo", "medium", 1, 10),
        (1, "Design QA against tokens", "backlog", "low", 0, 14),
        (1, "Prototype for user testing", "review", "medium", 1, 5),
        (2, "Draft RFC — retrieval pipeline", "in_progress", "high", 3, 4),
        (2, "Evaluate vector databases", "todo", "medium", 3, 9),
        (2, "Data cleaning script", "backlog", "low", 0, 15),
    ]
    for pi, title, status, prio, ai, ddays in task_defs:
        demo_tasks.append({
            "id": new_id(),
            "project_id": projects[pi]["id"],
            "title": title,
            "description": "",
            "status": status,
            "priority": prio,
            "assignee_id": mids[ai],
            "due_date": (now + timedelta(days=ddays)).isoformat(),
            "tags": [],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
    await db.tasks.insert_many(demo_tasks)

    # Seed a few activities & notifications
    for p in projects:
        await log_activity(p["id"], None, "project_created", f"Project '{p['name']}' created")
    await push_notification("Welcome to ProjectHub", "Your workspace is ready. Explore the demo projects.", kind="success")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.projects.create_index("id")
    await db.tasks.create_index([("project_id", 1), ("status", 1)])
    await db.members.create_index("id")
    await db.files.create_index("id")
    await db.notifications.create_index([("created_at", -1)])
    await db.activity.create_index([("created_at", -1)])
    await seed_admin()
    await seed_demo()
    init_storage()

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)
