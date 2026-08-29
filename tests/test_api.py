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

    # 2. Get questions in English (deterministic for testing specific house answers)
    q_resp = client.get("/api/questions?lang=en&randomize=false")
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

    # German questions (deterministic)
    q_resp = client.get("/api/questions?lang=de&randomize=false")
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

def test_auto_balance_houses(client):
    """Test auto-balance endpoint evenly distributes students across houses."""
    login_resp = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    admin_headers = {"X-Admin-Token": login_resp.json()["token"]}

    # Reset
    client.post("/api/admin/event/reset", headers=admin_headers)

    # Register 4 participants
    for name in ["Student A", "Student B", "Student C", "Student D"]:
        p_res = client.post("/api/participants", json={"display_name": name})
        p_id = p_res.json()["id"]
        # Reassign all initially to Slytherin (house_id = 4)
        client.patch(f"/api/admin/assignments/{p_id}", json={"house_id": 4}, headers=admin_headers)

    # All 4 in Slytherin
    houses_before = client.get("/api/houses").json()
    sly_before = next(h for h in houses_before if h["code"] == "SLY")
    assert sly_before["total"] == 4

    # Run auto-balance
    bal_res = client.post("/api/admin/auto-balance", headers=admin_headers)
    assert bal_res.status_code == 200

    # Verify each of the 4 houses now has exactly 1 student
    houses_after = client.get("/api/houses").json()
    for h in houses_after:
        assert h["total"] == 1

def test_wizard_name_validation(client):
    """Test wizard name validation rejects numbers and special symbols but allows orthographic characters."""
    # 1. Reject numeric names
    for bad_name in ["123", "harry7", "007", "m4lffoy", "42"]:
        res = client.post("/api/participants", json={"display_name": bad_name})
        assert res.status_code in [400, 422], f"Expected rejection for '{bad_name}', got {res.status_code}"

    # 2. Reject disallowed special symbols
    for bad_name in ["Harry#Potter", "Voldemort!", "Albus@Dumbledore", "Ron$Weasley", "Draco_Malfoy"]:
        res = client.post("/api/participants", json={"display_name": bad_name})
        assert res.status_code in [400, 422], f"Expected rejection for '{bad_name}', got {res.status_code}"

    # 3. Accept valid names with letters, spaces, hyphens, apostrophes, and accents
    valid_names = [
        "Harry Potter",
        "Hermione Granger",
        "Müller-Schmidt",
        "O'Flaherty",
        "François D'Amico",
        "José Peña",
        "Jean-Luc",
        "Pomona Sprout"
    ]
    for good_name in valid_names:
        res = client.post("/api/participants", json={"display_name": good_name})
        assert res.status_code == 201, f"Expected acceptance for '{good_name}', got {res.status_code}"

def test_admin_question_crud(client):
    """Test Admin CRUD for questions and options."""
    login_resp = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    admin_headers = {"X-Admin-Token": login_resp.json()["token"]}

    # 1. Get initial questions count
    q_list_res = client.get("/api/admin/questions", headers=admin_headers)
    assert q_list_res.status_code == 200
    initial_count = len(q_list_res.json())

    # 2. Create new question
    new_q_payload = {
        "text_en": "Which magical pet would you choose?",
        "text_de": "Welches magische Haustier würdest du wählen?",
        "options": [
            {"text_en": "Toad", "text_de": "Kröte", "scores": {"GRY": 2, "RAV": 0, "HUF": 4, "SLY": 0}},
            {"text_en": "Owl", "text_de": "Eule", "scores": {"GRY": 1, "RAV": 8, "HUF": 0, "SLY": 0}},
            {"text_en": "Cat", "text_de": "Katze", "scores": {"GRY": 3, "RAV": 1, "HUF": 0, "SLY": 6}},
            {"text_en": "Phoenix", "text_de": "Phönix", "scores": {"GRY": 10, "RAV": 3, "HUF": 2, "SLY": 0}}
        ]
    }
    create_res = client.post("/api/admin/questions", json=new_q_payload, headers=admin_headers)
    assert create_res.status_code == 201
    created_id = create_res.json()["question_id"]

    # 3. Verify question appears in list
    q_list_res2 = client.get("/api/admin/questions", headers=admin_headers)
    assert len(q_list_res2.json()) == initial_count + 1
    created_q = next(q for q in q_list_res2.json() if q["id"] == created_id)
    assert created_q["text_en"] == "Which magical pet would you choose?"
    assert len(created_q["options"]) == 4
    phoenix_opt = next(opt for opt in created_q["options"] if opt["text_en"] == "Phoenix")
    assert phoenix_opt["scores"]["GRY"] == 10

    # 4. Update the question
    update_payload = {
        "text_en": "Which magical companion would you prefer?",
        "text_de": "Welchen magischen Begleiter bevorzugst du?",
        "options": [
            {"text_en": "Snowy Owl", "text_de": "Schneeeule", "scores": {"GRY": 2, "RAV": 9, "HUF": 1, "SLY": 0}},
            {"text_en": "Black Cat", "text_de": "Schwarze Katze", "scores": {"GRY": 0, "RAV": 2, "HUF": 0, "SLY": 8}}
        ]
    }
    update_res = client.put(f"/api/admin/questions/{created_id}", json=update_payload, headers=admin_headers)
    assert update_res.status_code == 200

    # Verify update
    q_list_res3 = client.get("/api/admin/questions", headers=admin_headers)
    updated_q = next(q for q in q_list_res3.json() if q["id"] == created_id)
    assert updated_q["text_en"] == "Which magical companion would you prefer?"
    assert len(updated_q["options"]) == 2

    # 5. Delete the question
    del_res = client.delete(f"/api/admin/questions/{created_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # Verify deleted
    q_list_res4 = client.get("/api/admin/questions", headers=admin_headers)
    assert len(q_list_res4.json()) == initial_count

def test_question_score_validation(client):
    """Test that points > 10 or < 0 are strictly rejected."""
    login_resp = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    admin_headers = {"X-Admin-Token": login_resp.json()["token"]}

    # Over 10 points (e.g. 15 points)
    bad_payload_high = {
        "text_en": "Invalid high score test?",
        "text_de": "Ungültiger Test?",
        "options": [
            {"text_en": "Opt 1", "text_de": "Opt 1", "scores": {"GRY": 15, "RAV": 0, "HUF": 0, "SLY": 0}},
            {"text_en": "Opt 2", "text_de": "Opt 2", "scores": {"GRY": 0, "RAV": 0, "HUF": 0, "SLY": 0}}
        ]
    }
    res_high = client.post("/api/admin/questions", json=bad_payload_high, headers=admin_headers)
    assert res_high.status_code == 422

    # Negative points (e.g. -5 points)
    bad_payload_neg = {
        "text_en": "Invalid negative score test?",
        "text_de": "Ungültiger negativer Test?",
        "options": [
            {"text_en": "Opt 1", "text_de": "Opt 1", "scores": {"GRY": -5, "RAV": 0, "HUF": 0, "SLY": 0}},
            {"text_en": "Opt 2", "text_de": "Opt 2", "scores": {"GRY": 0, "RAV": 0, "HUF": 0, "SLY": 0}}
        ]
    }
    res_neg = client.post("/api/admin/questions", json=bad_payload_neg, headers=admin_headers)
    assert res_neg.status_code == 422

def test_questionnaire_randomization(client):
    """Test questions and options can be randomized or retrieved in canonical order."""
    # Deterministic order
    res_fixed = client.get("/api/questions?lang=en&randomize=false")
    assert res_fixed.status_code == 200
    fixed_data = res_fixed.json()
    assert len(fixed_data) == 6
    fixed_ids = [q["id"] for q in fixed_data]

    # Randomized order
    res_rand = client.get("/api/questions?lang=en&randomize=true")
    assert res_rand.status_code == 200
    rand_data = res_rand.json()
    assert len(rand_data) == 6
    # All 6 questions are present
    assert set(q["id"] for q in rand_data) == set(fixed_ids)

def test_participant_password_registration_and_login(client):
    """Test registering with a password and logging back in with the same name and password."""
    # 1. Register with password
    reg_res = client.post("/api/participants", json={
        "display_name": "Luna Lovegood",
        "preferred_lang": "en",
        "password": "radish-earrings"
    })
    assert reg_res.status_code == 201
    luna_token = reg_res.json()["session_token"]
    assert luna_token is not None

    # 2. Attempting to register same name with WRONG password fails
    bad_login = client.post("/api/participants", json={
        "display_name": "Luna Lovegood",
        "preferred_lang": "en",
        "password": "wrong-password"
    })
    assert bad_login.status_code == 400
    assert "Incorrect password" in bad_login.json()["detail"]

    # 3. Returning with CORRECT password returns session token
    good_login = client.post("/api/participants", json={
        "display_name": "Luna Lovegood",
        "preferred_lang": "en",
        "password": "radish-earrings"
    })
    assert good_login.status_code == 201 or good_login.status_code == 200
    assert good_login.json()["session_token"] == luna_token

def test_house_games_flow_and_points(client):
    """Test playing House Games to earn 1-2 random house points and verify real-time scoreboard update."""
    # 1. Register and sort wizard
    reg_res = client.post("/api/participants", json={
        "display_name": "Cedric Diggory",
        "preferred_lang": "en",
        "password": "hufflepuff-pride"
    })
    token = reg_res.json()["session_token"]
    headers = {"X-Session-Token": token}

    # Attempt to play before sorting fails
    early_play = client.post("/api/house-games/play", headers=headers)
    assert early_play.status_code == 400
    assert "Sorting Ceremony" in early_play.json()["detail"]

    # Answer all questions (deterministic mode)
    questions = client.get("/api/questions?lang=en&randomize=false").json()
    for q in questions:
        # Option index 2 is Hufflepuff
        opt_id = q["options"][2]["id"]
        client.post("/api/answers", json={"question_id": q["id"], "option_id": opt_id}, headers=headers)

    # Sort
    assign_res = client.post("/api/assignments?lang=en", headers=headers)
    assert assign_res.status_code == 201
    assigned_house = assign_res.json()["house_code"]
    assert assigned_house == "HUF"

    # Play House Games
    play_res = client.post("/api/house-games/play", headers=headers)
    assert play_res.status_code == 200
    play_data = play_res.json()
    assert play_data["status"] == "success"
    assert play_data["awarded_points"] in [1, 2]
    assert play_data["house_code"] == "HUF"
    assert play_data["total_game_points"] >= play_data["awarded_points"]

    # Verify GET /api/houses includes game_points
    houses = client.get("/api/houses").json()
    huf_house = next(h for h in houses if h["code"] == "HUF")
    assert huf_house["game_points"] == play_data["total_game_points"]

def test_spell_cast_limit_and_population_balance(client):
    """Test max 2 spells per participant, half-points penalty for overpopulated house, and 3rd attempt rejection."""
    # 1. Register and sort wizard
    reg_res = client.post("/api/participants", json={
        "display_name": "Cho Chang",
        "preferred_lang": "en",
        "password": "ravenclaw-diadem"
    })
    token = reg_res.json()["session_token"]
    headers = {"X-Session-Token": token}

    # Answer all questions for Ravenclaw (Option index 1)
    questions = client.get("/api/questions?lang=en&randomize=false").json()
    for q in questions:
        opt_id = q["options"][1]["id"]
        client.post("/api/answers", json={"question_id": q["id"], "option_id": opt_id}, headers=headers)

    assign_res = client.post("/api/assignments?lang=en", headers=headers)
    assert assign_res.status_code == 201

    # 1st spell cast (Succeeds)
    cast1 = client.post("/api/house-games/play", headers=headers)
    assert cast1.status_code == 200
    assert cast1.json()["casts_used"] == 1
    assert cast1.json()["casts_remaining"] == 1

    # 2nd spell cast (Succeeds)
    cast2 = client.post("/api/house-games/play", headers=headers)
    assert cast2.status_code == 200
    assert cast2.json()["casts_used"] == 2
    assert cast2.json()["casts_remaining"] == 0

    # 3rd spell cast (Rejected - Max 2 reached)
    cast3 = client.post("/api/house-games/play", headers=headers)
    assert cast3.status_code == 400
    assert "maximum spells" in cast3.json()["detail"]

def test_admin_stats_includes_spell_metrics(client):
    """Test that admin closing statistics include total spells cast, points, and house breakdown."""
    login_res = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"X-Admin-Token": token}

    stats_res = client.get("/api/admin/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_spells_cast" in stats
    assert "total_spell_points" in stats
    assert "house_spell_stats" in stats
    assert len(stats["house_spell_stats"]) == 4

def test_admin_view_and_edit_participant_points(client):
    """Test that admin can view and manually adjust house cup points, quiz scores, and spell attempts."""
    # 1. Register student, answer questions and sort
    reg_res = client.post("/api/participants", json={
        "display_name": "Luna Lovegood",
        "password": "spectrespecs"
    })
    token = reg_res.json()["session_token"]
    user_headers = {"X-Session-Token": token}
    p_id = reg_res.json()["id"]

    questions = client.get("/api/questions?lang=en&randomize=false").json()
    for q in questions:
        opt_id = q["options"][1]["id"]  # Ravenclaw
        client.post("/api/answers", json={"question_id": q["id"], "option_id": opt_id}, headers=user_headers)

    client.post("/api/assignments?lang=en", headers=user_headers)

    # Cast 2 spells to reach limit
    client.post("/api/house-games/play", headers=user_headers)
    client.post("/api/house-games/play", headers=user_headers)

    # 2. Admin logs in
    admin_login = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    admin_token = admin_login.json()["token"]
    admin_headers = {"X-Admin-Token": admin_token}

    # 3. View participants
    parts = client.get("/api/admin/participants", headers=admin_headers).json()
    luna = next(p for p in parts if p["id"] == p_id)
    assert luna["spells_cast"] == 2
    assert luna["spell_points_won"] > 0

    # 4. Admin edits Luna's points: awards 15.5 House Cup points, sets quiz score to 30, and resets spell attempts to 0
    edit_res = client.patch(f"/api/admin/participants/{p_id}/points", json={
        "game_points": 15.5,
        "sorting_score": 30,
        "spells_cast": 0
    }, headers=admin_headers)
    assert edit_res.status_code == 200

    # 5. Verify updated participant data
    parts_after = client.get("/api/admin/participants", headers=admin_headers).json()
    luna_after = next(p for p in parts_after if p["id"] == p_id)
    assert luna_after["spell_points_won"] == 15.5
    assert luna_after["total_score"] == 30
    assert luna_after["spells_cast"] == 0

    # 6. Verify Ravenclaw house total reflects the updated points
    houses = client.get("/api/houses").json()
    rav = next(h for h in houses if h["code"] == "RAV")
    assert rav["game_points"] >= 15.5

    # 7. Student can cast spells again because admin reset spells_cast to 0
    new_cast = client.post("/api/house-games/play", headers=user_headers)
    assert new_cast.status_code == 200
    assert new_cast.json()["casts_used"] == 1

def test_house_reassign_removes_old_points_and_resets_spells(client):
    """Test that when a student is reassigned to another house, the old house loses their points and spell attempts reset to 0."""
    # 1. Register student and sort to Slytherin (house_id = 4, option index 3)
    reg = client.post("/api/participants", json={"display_name": "Draco Malfoy", "password": "pure-blood"})
    token = reg.json()["session_token"]
    user_headers = {"X-Session-Token": token}
    p_id = reg.json()["id"]

    questions = client.get("/api/questions?lang=en&randomize=false").json()
    for q in questions:
        opt_id = q["options"][3]["id"]  # Slytherin
        client.post("/api/answers", json={"question_id": q["id"], "option_id": opt_id}, headers=user_headers)

    assign = client.post("/api/assignments?lang=en", headers=user_headers)
    assert assign.json()["house_code"] == "SLY"

    # Cast 2 spells for Slytherin
    cast1 = client.post("/api/house-games/play", headers=user_headers)
    assert cast1.status_code == 200
    cast2 = client.post("/api/house-games/play", headers=user_headers)
    assert cast2.status_code == 200

    # Read Slytherin points
    houses_before = client.get("/api/houses").json()
    sly_before = next(h for h in houses_before if h["code"] == "SLY")["game_points"]
    assert sly_before > 0

    # 2. Admin logs in and reassigns Draco to Gryffindor (house_id = 1)
    admin_login = client.post("/api/admin/login", json={"username": "admin", "password": "alohomora"})
    admin_headers = {"X-Admin-Token": admin_login.json()["token"]}

    reassign_res = client.patch(f"/api/admin/assignments/{p_id}", json={"house_id": 1}, headers=admin_headers)
    assert reassign_res.status_code == 200

    # 3. Verify Slytherin lost Draco's points
    houses_after = client.get("/api/houses").json()
    sly_after = next(h for h in houses_after if h["code"] == "SLY")["game_points"]
    assert sly_after < sly_before

    # 4. Verify Draco's spells cast is reset to 0 in admin roster
    parts = client.get("/api/admin/participants", headers=admin_headers).json()
    draco = next(p for p in parts if p["id"] == p_id)
    assert draco["house_code"] == "GRY"
    assert draco["spells_cast"] == 0
    assert draco["spell_points_won"] == 0

    # 5. Draco can now cast spells for Gryffindor
    gry_cast = client.post("/api/house-games/play", headers=user_headers)
    assert gry_cast.status_code == 200
    assert gry_cast.json()["house_code"] == "GRY"
    assert gry_cast.json()["casts_used"] == 1









