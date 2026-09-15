"""ProjectHub backend API tests"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workflow-hub-922.internal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "swathi.p@emergent.sh"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
def test_login_success():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "manager"


def test_login_wrong():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "bad"}, timeout=30)
    assert r.status_code == 401


def test_me_without_token():
    r = requests.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


def test_me_with_token(h):
    r = requests.get(f"{API}/auth/me", headers=h, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["name"] == "Swathi P"
    assert data["role"] == "manager"


# ---------- Dashboard ----------
def test_dashboard(h):
    r = requests.get(f"{API}/dashboard", headers=h, timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ["active_projects", "tasks_due", "team_size", "completion_rate"]:
        assert k in d["kpis"]
    assert isinstance(d["recent_projects"], list)
    assert isinstance(d["upcoming_deadlines"], list)
    assert isinstance(d["recent_activity"], list)
    if d["recent_projects"]:
        p = d["recent_projects"][0]
        for k in ["progress", "task_count", "completed_count"]:
            assert k in p


# ---------- Projects ----------
def test_list_projects(h):
    r = requests.get(f"{API}/projects", headers=h, timeout=30)
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) >= 3
    for p in projects:
        assert "progress" in p and "task_count" in p and "completed_count" in p


def test_project_crud_and_status_change(h):
    # create
    r = requests.post(f"{API}/projects", headers=h, json={"name": "TEST_Proj", "description": "d", "status": "planning"}, timeout=30)
    assert r.status_code == 200
    pid = r.json()["id"]
    # get
    r2 = requests.get(f"{API}/projects/{pid}", headers=h, timeout=30)
    assert r2.status_code == 200
    # update status
    r3 = requests.put(f"{API}/projects/{pid}", headers=h, json={"name": "TEST_Proj", "description": "d", "status": "in_progress"}, timeout=30)
    assert r3.status_code == 200
    assert r3.json()["status"] == "in_progress"
    # archive
    r4 = requests.delete(f"{API}/projects/{pid}", headers=h, timeout=30)
    assert r4.status_code == 200
    r5 = requests.get(f"{API}/projects/{pid}", headers=h, timeout=30)
    assert r5.json()["status"] == "archived"


# ---------- Tasks / Kanban ----------
def test_task_lifecycle_kanban(h):
    projects = requests.get(f"{API}/projects", headers=h, timeout=30).json()
    pid = projects[0]["id"]
    r = requests.post(f"{API}/tasks", headers=h, json={"project_id": pid, "title": "TEST_Task", "status": "todo", "priority": "medium"}, timeout=30)
    assert r.status_code == 200
    tid = r.json()["id"]
    for status in ["in_progress", "review", "done"]:
        rr = requests.put(f"{API}/tasks/{tid}", headers=h, json={"status": status}, timeout=30)
        assert rr.status_code == 200
        assert rr.json()["status"] == status
    # verify activity has task_status entries
    act = requests.get(f"{API}/activity", headers=h, timeout=30).json()
    kinds = [a["kind"] for a in act]
    assert "task_status" in kinds
    # delete
    rd = requests.delete(f"{API}/tasks/{tid}", headers=h, timeout=30)
    assert rd.status_code == 200


# ---------- Team ----------
def test_team_crud(h):
    r = requests.get(f"{API}/team", headers=h, timeout=30)
    assert r.status_code == 200
    team = r.json()
    assert len(team) >= 4
    for m in team:
        assert "active_tasks" in m
    # create
    r2 = requests.post(f"{API}/team", headers=h, json={"name": "TEST_User", "email": "test_user@x.co", "role": "Member"}, timeout=30)
    assert r2.status_code == 200
    mid = r2.json()["id"]
    # update
    r3 = requests.put(f"{API}/team/{mid}", headers=h, json={"name": "TEST_User2", "email": "test_user@x.co", "role": "Dev"}, timeout=30)
    assert r3.status_code == 200 and r3.json()["name"] == "TEST_User2"
    # delete
    r4 = requests.delete(f"{API}/team/{mid}", headers=h, timeout=30)
    assert r4.status_code == 200


# ---------- Comments ----------
def test_comments(h):
    projects = requests.get(f"{API}/projects", headers=h, timeout=30).json()
    pid = projects[0]["id"]
    r = requests.post(f"{API}/comments", headers=h, json={"project_id": pid, "body": "TEST comment"}, timeout=30)
    assert r.status_code == 200
    cid = r.json()["id"]
    r2 = requests.get(f"{API}/comments?project_id={pid}", headers=h, timeout=30)
    assert r2.status_code == 200
    assert any(c["id"] == cid for c in r2.json())
    r3 = requests.delete(f"{API}/comments/{cid}", headers=h, timeout=30)
    assert r3.status_code == 200


# ---------- Files ----------
def test_files_upload_download_delete(token, h):
    files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = requests.post(f"{API}/files/upload", headers=h, files=files, timeout=60)
    assert r.status_code == 200, r.text
    fid = r.json()["id"]
    # list
    r2 = requests.get(f"{API}/files", headers=h, timeout=30)
    assert r2.status_code == 200 and any(f["id"] == fid for f in r2.json())
    # download via query token
    r3 = requests.get(f"{API}/files/{fid}/download?auth={token}", timeout=60)
    assert r3.status_code == 200
    assert r3.content == b"hello world"
    # download via header
    r4 = requests.get(f"{API}/files/{fid}/download", headers=h, timeout=60)
    assert r4.status_code == 200
    # delete
    r5 = requests.delete(f"{API}/files/{fid}", headers=h, timeout=30)
    assert r5.status_code == 200


# ---------- Notifications ----------
def test_notifications(h):
    r = requests.get(f"{API}/notifications", headers=h, timeout=30)
    assert r.status_code == 200
    notifs = r.json()
    if notifs:
        nid = notifs[0]["id"]
        r2 = requests.post(f"{API}/notifications/{nid}/read", headers=h, timeout=30)
        assert r2.status_code == 200
    r3 = requests.post(f"{API}/notifications/read-all", headers=h, timeout=30)
    assert r3.status_code == 200


# ---------- Settings ----------
def test_settings_and_slack(h):
    r = requests.get(f"{API}/settings", headers=h, timeout=30)
    assert r.status_code == 200
    s = r.json()
    assert "slack_events" in s and "slack_webhook_url" in s
    # test-slack empty
    # first ensure empty
    requests.put(f"{API}/settings", headers=h, json={"slack_webhook_url": ""}, timeout=30)
    r2 = requests.post(f"{API}/settings/test-slack", headers=h, timeout=30)
    assert r2.status_code == 400
    # with fake url
    requests.put(f"{API}/settings", headers=h, json={"slack_webhook_url": "https://hooks.slack.com/services/FAKE/FAKE/FAKE"}, timeout=30)
    r3 = requests.post(f"{API}/settings/test-slack", headers=h, timeout=30)
    assert r3.status_code == 400, f"Expected 400 for fake URL, got {r3.status_code}: {r3.text}"
    # reset
    requests.put(f"{API}/settings", headers=h, json={"slack_webhook_url": ""}, timeout=30)


# ---------- Reports ----------
def test_reports_summary(h):
    r = requests.get(f"{API}/reports/summary", headers=h, timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ["kpis", "status_distribution", "weekly_completed", "top_projects", "workload"]:
        assert k in d
    assert len(d["weekly_completed"]) == 8
