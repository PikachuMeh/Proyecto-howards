import uuid
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Header, Cookie, HTTPException, Response, Depends, status
from app.database import get_db
from app.config import COOKIE_NAME, PORT, get_local_ip
from app.models import (
    ParticipantCreate, ParticipantResponse, QuestionOut, OptionOut,
    AnswerSubmit, AssignmentOut
)
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
            detail="Session token missing. Please register first."
        )
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.event_id, p.display_name, p.session_token, p.preferred_lang,
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
                detail="No active event found."
            )
        event_id = event["id"]

        # Check for duplicate name
        cursor.execute("SELECT id FROM participant WHERE event_id = ? AND LOWER(display_name) = LOWER(?)", (event_id, display_name))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This name is already registered for this event. Please choose another."
            )

        token = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO participant (event_id, display_name, session_token, preferred_lang)
            VALUES (?, ?, ?, ?)
        """, (event_id, display_name, token, data.preferred_lang))
        participant_id = cursor.lastrowid

    # Set session cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=False,
        samesite="lax",
        max_age=86400 * 7
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
def get_questions(lang: str = "en"):
    lang = "de" if lang.lower() == "de" else "en"
    text_col = "text_de" if lang == "de" else "text_en"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        event = cursor.fetchone()
        if not event:
            return []

        cursor.execute(f"""
            SELECT id, {text_col} as text, position
            FROM question
            WHERE event_id = ?
            ORDER BY position ASC
        """, (event["id"],))
        questions = [dict(q) for q in cursor.fetchall()]

        for q in questions:
            cursor.execute(f"""
                SELECT id, {text_col} as text, position
                FROM option
                WHERE question_id = ?
                ORDER BY position ASC
            """, (q["id"],))
            q["options"] = [dict(opt) for opt in cursor.fetchall()]

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
