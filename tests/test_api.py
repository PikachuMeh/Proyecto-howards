import pytest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, init_db
from app.seed import seed_database
from app.routers.admin import ADMIN_STATIC_TOKEN

@pytest.fixture(scope="function", autouse=True)
def setup_test_db(monkeypatch):
    """Creates a temporary isolated SQLite DB for each test."""
    temp_dir = tempfile.TemporaryDirectory()
    temp_db_path = Path(temp_dir.name) / "test_sorting_hat.db"
    
    # Patch database path
    monkeypatch.setattr("app.database.get_db_path", lambda: temp_db_path)
    monkeypatch.setattr("app.database.DB_PATH", temp_db_path)
    
    # Seed test database
    seed_database(temp_db_path)
    
    yield temp_db_path
    temp_dir.cleanup()

@pytest.fixture
def client():
    return TestClient(app)

def test_full_guest_flow_english(client):
    """Section 11.2: Full flow: create participant -> answer everything -> assign -> read result."""
    # 1. Create participant
    resp = client.post("/api/participants", json={"display_name": "Harry Potter", "preferred_lang": "en"})
    assert resp.status_code == 201
    data = resp.json()
    token = data["session_token"]
    assert data["display_name"] == "Harry Potter"

    headers = {"X-Session-Token": token}

    # 2. Get questions in English
    q_resp = client.get("/api/questions?lang=en")
    assert q_resp.status_code == 200
    questions = q_resp.json()
    assert len(questions) == 6

    # 3. Answer questions (choose option 1 for Gryffindor-heavy choices)
    for q in questions:
        opt_id = q["options"][0]["id"]
        ans_resp = client.post("/api/answers", json={"question_id": q["id"], "option_id": opt_id}, headers=headers)
        assert ans_resp.status_code == 200

    # 4. Submit assignment
    assign_resp = client.post("/api/assignments?lang=en", headers=headers)
    assert assign_resp.status_code == 201
    assign_data = assign_resp.json()
    assert assign_data["house_code"] == "GRY"
    assert assign_data["house_name"] == "Gryffindor"

    # 5. Read my assignment
    my_resp = client.get("/api/my-assignment?lang=en", headers=headers)
    assert my_resp.status_code == 200
    assert my_resp.json()["house_code"] == "GRY"

def test_full_guest_flow_german(client):
    """Bilingual test: Questions and result in German."""
    resp = client.post("/api/participants", json={"display_name": "Hermine Granger", "preferred_lang": "de"})
    assert resp.status_code == 201
    token = resp.json()["session_token"]
    headers = {"X-Session-Token": token}

    # German questions
    q_resp = client.get("/api/questions?lang=de")
    assert q_resp.status_code == 200
    questions = q_resp.json()
    assert "Instinkt" in questions[0]["text"]

    # Choose Ravenclaw option (option 2)
    for q in questions:
        opt_id = q["options"][1]["id"]
        client.post("/api/answers", json={"question_id": q["id"], "option_id": opt_id}, headers=headers)

    assign_resp = client.post("/api/assignments?lang=de", headers=headers)
    assert assign_resp.status_code == 201
    assign_data = assign_resp.json()
    assert assign_data["house_code"] == "RAV"
    assert assign_data["house_name"] == "Ravenclaw"

def test_double_submission_prevented(client):
    """Section 11.2: Double submission returns 409."""
    resp = client.post("/api/participants", json={"display_name": "Ron Weasley", "preferred_lang": "en"})
    token = resp.json()["session_token"]
    headers = {"X-Session-Token": token}

    questions = client.get("/api/questions").json()
    for q in questions:
        client.post("/api/answers", json={"question_id": q["id"], "option_id": q["options"][0]["id"]}, headers=headers)

    # First assignment
    res1 = client.post("/api/assignments", headers=headers)
    assert res1.status_code == 201

    # Second assignment attempt
    res2 = client.post("/api/assignments", headers=headers)
    assert res2.status_code == 409

def test_incomplete_questionnaire_error(client):
    """Submitting before answering all questions returns 422."""
    resp = client.post("/api/participants", json={"display_name": "Neville Longbottom", "preferred_lang": "en"})
    token = resp.json()["session_token"]
    headers = {"X-Session-Token": token}

    questions = client.get("/api/questions").json()
    # Answer only 1 question
    client.post("/api/answers", json={"question_id": questions[0]["id"], "option_id": questions[0]["options"][0]["id"]}, headers=headers)

    res = client.post("/api/assignments", headers=headers)
    assert res.status_code == 422

def test_unauthorized_requests(client):
    """Section 11.2: Request without valid token returns 401."""
    res = client.post("/api/answers", json={"question_id": 1, "option_id": 1})
    assert res.status_code == 401

    res2 = client.get("/api/my-assignment")
    assert res2.status_code == 401

def test_admin_db_authentication(client):
    """Test admin authentication directly against database administrator table."""
    # 1. Invalid username
    bad_user = client.post("/api/admin/login", json={"username": "voldemort", "password": "alohomora"})
    assert bad_user.status_code == 401

    # 2. Invalid password
    bad_pwd = client.post("/api/admin/login", json={"username": "admin", "password": "wrong_password"})
    assert bad_pwd.status_code == 401

    # 3. Successful login with Dumbledore
    good_login = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    assert good_login.status_code == 200
    data = good_login.json()
    assert "token" in data
    assert data["admin"]["username"] == "admin"
    assert data["admin"]["full_name"] == "Prof. Albus Dumbledore"
    token = data["token"]
    headers = {"X-Admin-Token": token}

    # 4. Check /api/admin/me
    me_resp = client.get("/api/admin/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["full_name"] == "Prof. Albus Dumbledore"

    # 5. Logout
    logout_resp = client.post("/api/admin/logout", headers=headers)
    assert logout_resp.status_code == 200

    # 6. Post-logout access should fail
    after_logout = client.get("/api/admin/participants", headers=headers)
    assert after_logout.status_code == 401

def test_admin_flow_and_reset(client):
    """Test admin view participants, manual reassign, and event reset."""
    # 1. Admin login with credentials
    login_resp = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]
    admin_headers = {"X-Admin-Token": token}

    # 2. Register participant
    p_resp = client.post("/api/participants", json={"display_name": "Draco Malfoy", "preferred_lang": "en"})
    p_id = p_resp.json()["id"]

    # 3. Admin view participants (FR-14)
    parts = client.get("/api/admin/participants", headers=admin_headers).json()
    assert len(parts) >= 1
    assert any(p["display_name"] == "Draco Malfoy" for p in parts)

    # 4. Admin manual reassign (FR-15) (to Slytherin, house_id = 4)
    reassign_resp = client.patch(f"/api/admin/assignments/{p_id}", json={"house_id": 4}, headers=admin_headers)
    assert reassign_resp.status_code == 200

    # Verify house counts
    houses = client.get("/api/houses").json()
    slytherin = next(h for h in houses if h["code"] == "SLY")
    assert slytherin["total"] == 1

    # 5. Event reset (FR-16)
    reset_resp = client.post("/api/admin/event/reset", headers=admin_headers)
    assert reset_resp.status_code == 200

    # After reset, participants table is empty
    parts_after = client.get("/api/admin/participants", headers=admin_headers).json()
    assert len(parts_after) == 0

def test_html_page_rendering(client):
    """Verify that all Jinja2 HTML templates render with 200 OK."""
    for path in ["/", "/guest", "/screen", "/admin"]:
        res = client.get(path)
        assert res.status_code == 200
        assert "html" in res.headers.get("content-type", "").lower()

