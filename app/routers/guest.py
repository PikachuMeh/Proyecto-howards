import uuid
import json
import random
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Header, Cookie, HTTPException, Response, Depends, status
from app.database import get_db
from app.config import COOKIE_NAME, PORT, get_local_ip
from app.models import (
    ParticipantCreate, ParticipantResponse, QuestionOut, OptionOut,
    AnswerSubmit, AssignmentOut, HouseGamePlayResponse
)
from app.auth import hash_password, verify_password
from app.sorting import compute_house_assignment
from app.sse_manager import sse_manager

router = APIRouter(prefix="/api", tags=["Guest"])

@router.get("/server-info")
def get_server_info():
    """Returns local LAN IP and guest access URL for QR generation."""
    local_ip = get_local_ip()
    return {
        "local_ip": local_ip,
        "port": PORT,
        "guest_url": f"http://{local_ip}:{PORT}/"
    }

def get_current_participant(
    x_session_token: Optional[str] = Header(None),
    sorting_session: Optional[str] = Cookie(None)
) -> Dict[str, Any]:
    token = x_session_token or sorting_session
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token required."
        )
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.display_name, p.preferred_lang, p.session_token, p.event_id,
                   a.id as assignment_id, a.house_id
            FROM participant p
            LEFT JOIN assignment a ON a.participant_id = p.id
            WHERE p.session_token = ?
        """, (token,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token."
            )
        return dict(row)

@router.post("/participants", status_code=status.HTTP_201_CREATED, response_model=ParticipantResponse)
def create_participant(data: ParticipantCreate, response: Response):
    display_name = data.display_name.strip()
    if len(display_name) < 2 or len(display_name) > 40:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name must be between 2 and 40 characters."
        )

    with get_db() as conn:
        cursor = conn.cursor()
        # Find active event
        cursor.execute("SELECT id FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        event = cursor.fetchone()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active sorting event found."
            )
        event_id = event["id"]

        # Check for existing participant with this name in this event
        cursor.execute("""
            SELECT p.id, p.display_name, p.session_token, p.preferred_lang, p.password_hash,
                   a.id as assignment_id, h.name_en as house_name, h.code as house_code
            FROM participant p
            LEFT JOIN assignment a ON a.participant_id = p.id
            LEFT JOIN house h ON h.id = a.house_id
            WHERE p.event_id = ? AND LOWER(p.display_name) = LOWER(?)
        """, (event_id, display_name))
        existing = cursor.fetchone()

        if existing:
            # If user provided a password and existing user has password_hash
            if data.password and existing["password_hash"]:
                if verify_password(data.password, existing["password_hash"]):
                    # Valid returning wizard login!
                    token = existing["session_token"]
                    response.set_cookie(
                        key=COOKIE_NAME,
                        value=token,
                        httponly=False,
                        samesite="lax",
                        max_age=86400 * 7,
                        path="/"
                    )
                    return ParticipantResponse(
                        id=existing["id"],
                        display_name=existing["display_name"],
                        session_token=token,
                        preferred_lang=existing["preferred_lang"],
                        has_assignment=existing["assignment_id"] is not None,
                        house_name=existing["house_name"],
                        house_code=existing["house_code"]
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Incorrect password for this wizard name. Please enter the correct password."
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This wizard name is already registered for the event. Please choose another."
                )

        token = str(uuid.uuid4())
        password_hash = hash_password(data.password) if data.password else None
        cursor.execute("""
            INSERT INTO participant (event_id, display_name, session_token, preferred_lang, password_hash)
            VALUES (?, ?, ?, ?, ?)
        """, (event_id, display_name, token, data.preferred_lang, password_hash))
        participant_id = cursor.lastrowid

    # Set session cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=False,
        samesite="lax",
        max_age=86400 * 7,
        path="/"
    )

    return ParticipantResponse(
        id=participant_id,
        display_name=display_name,
        session_token=token,
        preferred_lang=data.preferred_lang,
        has_assignment=False
    )

@router.get("/me", response_model=ParticipantResponse)
def get_me(participant: Dict[str, Any] = Depends(get_current_participant)):
    return ParticipantResponse(
        id=participant["id"],
        display_name=participant["display_name"],
        session_token=participant["session_token"],
        preferred_lang=participant["preferred_lang"],
        has_assignment=participant["assignment_id"] is not None
    )

@router.get("/questions", response_model=List[QuestionOut])
def get_questions(lang: str = "en", randomize: bool = True):
    """Returns questions and options (randomized by default for guests)."""
    lang = "de" if lang.lower() == "de" else "en"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        event = cursor.fetchone()
        if not event:
            return []

        cursor.execute("""
            SELECT id,
                   CASE WHEN ? = 'de' THEN text_de ELSE text_en END as text,
                   position
            FROM question
            WHERE event_id = ?
            ORDER BY position ASC, id ASC
        """, (lang, event["id"]))
        questions = [dict(q) for q in cursor.fetchall()]

        for q in questions:
            cursor.execute("""
                SELECT id,
                       CASE WHEN ? = 'de' THEN text_de ELSE text_en END as text,
                       position
                FROM option
                WHERE question_id = ?
                ORDER BY position ASC, id ASC
            """, (lang, q["id"]))
            opts = [dict(opt) for opt in cursor.fetchall()]
            if randomize:
                random.shuffle(opts)
            q["options"] = opts

        if randomize:
            random.shuffle(questions)

    return questions

@router.post("/answers", status_code=status.HTTP_200_OK)
def submit_answer(data: AnswerSubmit, participant: Dict[str, Any] = Depends(get_current_participant)):
    if participant["assignment_id"] is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Participant already has an assignment and cannot modify answers."
        )

    with get_db() as conn:
        cursor = conn.cursor()
        # Validate option belongs to question
        cursor.execute("SELECT id FROM option WHERE id = ? AND question_id = ?", (data.option_id, data.question_id))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected option does not belong to the question."
            )

        # Upsert answer (SQLite 3.24+ syntax or delete then insert)
        cursor.execute("""
            INSERT INTO answer (participant_id, question_id, option_id, answered_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(participant_id, question_id) DO UPDATE SET
                option_id = excluded.option_id,
                answered_at = CURRENT_TIMESTAMP
        """, (participant["id"], data.question_id, data.option_id))

    return {"status": "success", "message": "Answer recorded."}

@router.get("/answers")
def get_user_answers(participant: Dict[str, Any] = Depends(get_current_participant)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT question_id, option_id
            FROM answer
            WHERE participant_id = ?
        """, (participant["id"],))
        answers = {row["question_id"]: row["option_id"] for row in cursor.fetchall()}
    return answers

@router.post("/assignments", status_code=status.HTTP_201_CREATED, response_model=AssignmentOut)
async def submit_assignment(lang: str = "en", participant: Dict[str, Any] = Depends(get_current_participant)):
    lang = "de" if lang.lower() == "de" else "en"
    if participant["assignment_id"] is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already been sorted into a house!"
        )

    with get_db() as conn:
        cursor = conn.cursor()
        event_id = participant["event_id"]

        # Check total questions count for event
        cursor.execute("SELECT COUNT(*) as total FROM question WHERE event_id = ?", (event_id,))
        total_questions = cursor.fetchone()["total"]

        # Check how many questions participant answered
        cursor.execute("SELECT COUNT(*) as answered FROM answer WHERE participant_id = ?", (participant["id"],))
        answered_count = cursor.fetchone()["answered"]

        if answered_count < total_questions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Please answer all questions ({answered_count}/{total_questions} answered)."
            )

        # Fetch event balancing_mode setting
        cursor.execute("SELECT balancing_mode FROM event WHERE id = ?", (event_id,))
        ev_row = cursor.fetchone()
        balancing_mode = bool(ev_row["balancing_mode"]) if ev_row else False

        # Query 1: All houses
        cursor.execute("SELECT id, code, name_en, name_de, color_hex, secondary_color, motto_en, motto_de, crest_icon FROM house")
        all_houses = {h["code"]: dict(h) for h in cursor.fetchall()}
        house_code_by_id = {h["id"]: code for code, h in all_houses.items()}

        # Query 2: Participant points per house
        cursor.execute("""
            SELECT os.house_id, SUM(os.points) AS total_points, COUNT(DISTINCT a.question_id) as q_count
            FROM answer a
            JOIN option_score os ON os.option_id = a.option_id
            WHERE a.participant_id = ?
            GROUP BY os.house_id
        """, (participant["id"],))
        score_rows = cursor.fetchall()

        house_scores = {code: 0 for code in all_houses.keys()}
        question_contributions = {code: 0 for code in all_houses.keys()}

        for row in score_rows:
            h_code = house_code_by_id.get(row["house_id"])
            if h_code:
                house_scores[h_code] = row["total_points"]
                question_contributions[h_code] = row["q_count"]

        # Query 3: Current house participant counts
        cursor.execute("""
            SELECT h.code, COUNT(a.id) AS total
            FROM house h
            LEFT JOIN assignment a ON a.house_id = h.id
            GROUP BY h.id, h.code
        """)
        house_counts = {row["code"]: row["total"] for row in cursor.fetchall()}

        # Run pure sorting algorithm
        sort_result = compute_house_assignment(
            house_scores=house_scores,
            question_contributions=question_contributions,
            house_participant_counts=house_counts,
            participant_id=participant["id"],
            balancing_mode=balancing_mode
        )

        winning_house_code = sort_result["winner"]
        winning_house = all_houses[winning_house_code]

        # Save assignment
        cursor.execute("""
            INSERT INTO assignment (participant_id, house_id, total_score, score_breakdown, manual_override, assigned_at)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        """, (
            participant["id"],
            winning_house["id"],
            sort_result["total_score"],
            json.dumps(sort_result["final_scores"])
        ))

    # Broadcast event to public screen via SSE
    await sse_manager.broadcast_assignment({
        "participant_id": participant["id"],
        "display_name": participant["display_name"],
        "house_code": winning_house_code,
        "house_name_en": winning_house["name_en"],
        "house_name_de": winning_house["name_de"],
        "color_hex": winning_house["color_hex"],
        "secondary_color": winning_house["secondary_color"],
        "motto_en": winning_house["motto_en"],
        "motto_de": winning_house["motto_de"],
        "crest_icon": winning_house["crest_icon"],
        "is_hesitant": sort_result["is_hesitant"]
    })

    return AssignmentOut(
        house_code=winning_house_code,
        house_name=winning_house["name_de"] if lang == "de" else winning_house["name_en"],
        color_hex=winning_house["color_hex"],
        secondary_color=winning_house["secondary_color"],
        motto=winning_house["motto_de"] if lang == "de" else winning_house["motto_en"],
        crest_icon=winning_house["crest_icon"],
        total_score=sort_result["total_score"],
        score_breakdown=sort_result["final_scores"],
        applied_tie_breaker=sort_result["applied_tie_breaker"],
        is_hesitant=sort_result["is_hesitant"],
        assigned_at="Just now"
    )

@router.get("/my-assignment", response_model=AssignmentOut)
def get_my_assignment(lang: str = "en", participant: Dict[str, Any] = Depends(get_current_participant)):
    lang = "de" if lang.lower() == "de" else "en"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.total_score, a.score_breakdown, a.assigned_at,
                   h.code, h.name_en, h.name_de, h.color_hex, h.secondary_color,
                   h.motto_en, h.motto_de, h.crest_icon
            FROM assignment a
            JOIN house h ON h.id = a.house_id
            WHERE a.participant_id = ?
        """, (participant["id"],))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No assignment found for this participant yet."
            )

        breakdown = json.loads(row["score_breakdown"]) if row["score_breakdown"] else {}
        return AssignmentOut(
            house_code=row["code"],
            house_name=row["name_de"] if lang == "de" else row["name_en"],
            color_hex=row["color_hex"],
            secondary_color=row["secondary_color"],
            motto=row["motto_de"] if lang == "de" else row["motto_en"],
            crest_icon=row["crest_icon"],
            total_score=row["total_score"],
            score_breakdown=breakdown,
            applied_tie_breaker=None,
            is_hesitant=False,
            assigned_at=str(row["assigned_at"])
        )

@router.get("/me", response_model=ParticipantResponse)
def get_me(participant: Dict[str, Any] = Depends(get_current_participant)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as casts_used
            FROM house_game_point
            WHERE participant_id = ? AND event_id = ? AND is_spell = 1
        """, (participant["id"], participant["event_id"]))
        row = cursor.fetchone()
        casts_used = row["casts_used"] if row else 0

        # Read house details if assigned
        house_name = None
        house_code = None
        if participant.get("house_id"):
            cursor.execute("SELECT code, name_en FROM house WHERE id = ?", (participant["house_id"],))
            h = cursor.fetchone()
            if h:
                house_code = h["code"]
                house_name = h["name_en"]

    return ParticipantResponse(
        id=participant["id"],
        display_name=participant["display_name"],
        session_token=participant["session_token"],
        preferred_lang=participant["preferred_lang"],
        has_assignment=participant["assignment_id"] is not None,
        house_name=house_name,
        house_code=house_code,
        casts_used=casts_used,
        casts_remaining=max(0, 2 - casts_used)
    )

@router.get("/questions", response_model=List[QuestionOut])
def get_questions(lang: str = "en", randomize: bool = True):
    """Returns questions and options (randomized by default for guests)."""
    lang = "de" if lang.lower() == "de" else "en"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        event = cursor.fetchone()
        if not event:
            return []

        cursor.execute("""
            SELECT id, position,
                   CASE WHEN ? = 'de' THEN text_de ELSE text_en END as text
            FROM question
            WHERE event_id = ?
            ORDER BY position ASC
        """, (lang, event["id"]))
        questions = [dict(q) for q in cursor.fetchall()]

        for q in questions:
            cursor.execute("""
                SELECT id, position,
                       CASE WHEN ? = 'de' THEN text_de ELSE text_en END as text
                FROM option
                WHERE question_id = ?
                ORDER BY position ASC
            """, (lang, q["id"]))
            opts = [dict(o) for o in cursor.fetchall()]
            if randomize:
                random.shuffle(opts)
            q["options"] = opts

    if randomize:
        random.shuffle(questions)

    return questions

# --- House Games & House Cup Points Endpoints ---

@router.post("/house-games/play", response_model=HouseGamePlayResponse)
async def play_house_game(participant: Dict[str, Any] = Depends(get_current_participant)):
    """
    Plays a House Game challenge and awards points (1-2 pts, or 0.5-1 pt if house is overpopulated).
    Maximum 2 spells per participant per event.
    Broadcasts real-time score updates to the public projection screen via SSE.
    """
    if not participant.get("assignment_id") or not participant.get("house_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must complete the Sorting Ceremony before playing House Games!"
        )

    house_id = participant["house_id"]
    event_id = participant["event_id"]

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Check max spells cast per participant (Max 2)
        cursor.execute("""
            SELECT COUNT(*) as casts_count
            FROM house_game_point
            WHERE participant_id = ? AND event_id = ? AND is_spell = 1
        """, (participant["id"], event_id))
        casts_count = cursor.fetchone()["casts_count"]
        if casts_count >= 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already cast your maximum spells (2/2) for this event!"
            )

        # 2. Check house population balance / overpopulation penalty (diff >= 3)
        cursor.execute("""
            SELECT house_id, COUNT(*) as member_count
            FROM assignment
            GROUP BY house_id
        """)
        counts_by_house = {row["house_id"]: row["member_count"] for row in cursor.fetchall()}

        cursor.execute("SELECT id FROM house")
        all_house_ids = [row["id"] for row in cursor.fetchall()]
        all_counts = [counts_by_house.get(hid, 0) for hid in all_house_ids]
        my_house_count = counts_by_house.get(house_id, 0)
        min_house_count = min(all_counts) if all_counts else 0

        diff = my_house_count - min_house_count
        is_overpopulated = diff >= 3

        if is_overpopulated:
            # Overpopulated house penalty: 0.5 or 1.0 point
            awarded_points = random.choice([0.5, 1.0])
        else:
            # Normal points: 1.0 or 2.0 points
            awarded_points = float(random.choice([1, 2]))

        # 3. Record point transaction
        cursor.execute("""
            INSERT INTO house_game_point (event_id, participant_id, house_id, points, is_spell)
            VALUES (?, ?, ?, ?, 1)
        """, (event_id, participant["id"], house_id, awarded_points))

        # 4. Update house total game points
        cursor.execute("""
            UPDATE house
            SET game_points = game_points + ?
            WHERE id = ?
        """, (awarded_points, house_id))

        # 5. Read updated house info
        cursor.execute("SELECT code, name_en, name_de, color_hex, game_points FROM house WHERE id = ?", (house_id,))
        house_info = cursor.fetchone()
        total_game_points = float(house_info["game_points"])
        house_code = house_info["code"]
        house_name_en = house_info["name_en"]

        casts_used = casts_count + 1
        casts_remaining = max(0, 2 - casts_used)

    # 6. Broadcast live update to /screen via SSE
    await sse_manager.broadcast_house_points({
        "house_id": house_id,
        "house_code": house_code,
        "house_name": house_name_en,
        "participant_name": participant["display_name"],
        "awarded_points": awarded_points,
        "total_game_points": total_game_points,
        "is_overpopulated": is_overpopulated
    })

    pts_str = f"{awarded_points:g}"
    penalty_msg = " (House population balance applied: half points)" if is_overpopulated else ""
    return HouseGamePlayResponse(
        status="success",
        awarded_points=awarded_points,
        total_game_points=total_game_points,
        house_code=house_code,
        house_name=house_name_en,
        participant_name=participant["display_name"],
        casts_used=casts_used,
        casts_remaining=casts_remaining,
        is_overpopulated=is_overpopulated,
        message=f"+{pts_str} points awarded to {house_name_en}!{penalty_msg}"
    )

@router.post("/participants/logout")
def logout_participant(response: Response):
    """Clears participant session cookie to allow another wizard to sort."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "success", "message": "Logged out successfully."}

