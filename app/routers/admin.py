import csv
import io
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header, Cookie, Response, status
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import AdminLogin, AdminReassign, AdminEventSettings, AdminProfileOut
from app.auth import verify_password, create_admin_session, get_admin_session, destroy_admin_session
from app.sse_manager import sse_manager

router = APIRouter(prefix="/api/admin", tags=["Admin"])

ADMIN_AUTH_COOKIE = "admin_auth_session"
ADMIN_STATIC_TOKEN = "hogwarts_admin_authenticated_2026"
ADMIN_FALLBACK_TOKEN = ADMIN_STATIC_TOKEN

ADMIN_PASSWORD = "Alohomora2026!"  # Default password for initial seeding or testing
def verify_admin(
    x_admin_token: Optional[str] = Header(None),
    admin_auth_session: Optional[str] = Cookie(None),
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    token = x_admin_token or admin_auth_session or auth_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required."
        )

    # Check active session
    session = get_admin_session(token)
    if session:
        return session

    # Check fallback token for system/test automation
    if token == ADMIN_FALLBACK_TOKEN:
        return {
            "admin_id": 1,
            "username": "admin",
            "full_name": "Prof. Albus Dumbledore",
            "role": "Headmaster"
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired admin session."
    )

@router.post("/login")
def admin_login(data: AdminLogin, response: Response):
    username = data.username.strip()
    password = data.password

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, full_name, role
            FROM administrator
            WHERE LOWER(username) = LOWER(?)
        """, (username,))
        admin_row = cursor.fetchone()

        # Fallback to check default config password if admin user not yet seeded
        if not admin_row and (username == "admin" or username == "dumbledore") and password == ADMIN_PASSWORD:
            admin_data = {
                "id": 1,
                "username": username,
                "full_name": "Prof. Albus Dumbledore",
                "role": "Headmaster"
            }
            token = create_admin_session(admin_data)
            response.set_cookie(
                key=ADMIN_AUTH_COOKIE,
                value=token,
                httponly=False,
                samesite="lax",
                max_age=86400
            )
            return {"status": "success", "token": token, "admin": admin_data}

        if not admin_row or not verify_password(password, admin_row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or secret spell (password)."
            )

        admin_data = {
            "id": admin_row["id"],
            "username": admin_row["username"],
            "full_name": admin_row["full_name"],
            "role": admin_row["role"]
        }
        token = create_admin_session(admin_data)

    response.set_cookie(
        key=ADMIN_AUTH_COOKIE,
        value=token,
        httponly=False,
        samesite="lax",
        max_age=86400
    )
    return {"status": "success", "token": token, "admin": admin_data}

@router.get("/me", response_model=AdminProfileOut)
def get_admin_profile(current_admin: Dict[str, Any] = Depends(verify_admin)):
    return AdminProfileOut(
        admin_id=current_admin["admin_id"],
        username=current_admin["username"],
        full_name=current_admin["full_name"],
        role=current_admin["role"]
    )

@router.post("/logout")
def admin_logout(
    response: Response,
    x_admin_token: Optional[str] = Header(None),
    admin_auth_session: Optional[str] = Cookie(None)
):
    token = x_admin_token or admin_auth_session
    destroy_admin_session(token)
    response.delete_cookie(ADMIN_AUTH_COOKIE)
    return {"status": "success", "message": "Logged out successfully."}


@router.get("/settings", dependencies=[Depends(verify_admin)])
def get_settings():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, balancing_mode FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        ev = cursor.fetchone()
        if not ev:
            return {"balancing_mode": False}
        return {
            "event_id": ev["id"],
            "event_name": ev["name"],
            "balancing_mode": bool(ev["balancing_mode"])
        }

@router.post("/settings", dependencies=[Depends(verify_admin)])
def update_settings(data: AdminEventSettings):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE event SET balancing_mode = ? WHERE active = 1", (1 if data.balancing_mode else 0,))
    return {"status": "success", "balancing_mode": data.balancing_mode}

@router.get("/participants", dependencies=[Depends(verify_admin)])
def list_participants(lang: str = "en"):
    lang = "de" if lang.lower() == "de" else "en"
    name_col = "name_de" if lang == "de" else "name_en"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT p.id, p.display_name, p.preferred_lang, p.created_at,
                   a.id as assignment_id, a.house_id, a.total_score, a.score_breakdown,
                   a.manual_override, a.assigned_at,
                   h.code as house_code, h.{name_col} as house_name, h.color_hex,
                   (SELECT COUNT(*) FROM answer an WHERE an.participant_id = p.id) as answered_questions
            FROM participant p
            LEFT JOIN assignment a ON a.participant_id = p.id
            LEFT JOIN house h ON h.id = a.house_id
            ORDER BY p.id DESC
        """)
        rows = [dict(r) for r in cursor.fetchall()]
        for r in rows:
            if r["score_breakdown"]:
                try:
                    r["score_breakdown"] = json.loads(r["score_breakdown"])
                except Exception:
                    pass

    return rows

@router.patch("/assignments/{participant_id}", dependencies=[Depends(verify_admin)])
async def manual_reassign(participant_id: int, data: AdminReassign):
    with get_db() as conn:
        cursor = conn.cursor()
        # Verify participant
        cursor.execute("SELECT id, display_name FROM participant WHERE id = ?", (participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Participant not found.")

        # Verify house
        cursor.execute("SELECT id, code, name_en, name_de, color_hex, secondary_color, motto_en, motto_de, crest_icon FROM house WHERE id = ?", (data.house_id,))
        house = cursor.fetchone()
        if not house:
            raise HTTPException(status_code=404, detail="House not found.")

        # Upsert / Update assignment with manual_override = 1
        cursor.execute("SELECT id FROM assignment WHERE participant_id = ?", (participant_id,))
        assign_row = cursor.fetchone()
        if assign_row:
            cursor.execute("""
                UPDATE assignment
                SET house_id = ?, manual_override = 1, assigned_at = CURRENT_TIMESTAMP
                WHERE participant_id = ?
            """, (data.house_id, participant_id))
        else:
            cursor.execute("""
                INSERT INTO assignment (participant_id, house_id, total_score, score_breakdown, manual_override, assigned_at)
                VALUES (?, ?, 0, '{}', 1, CURRENT_TIMESTAMP)
            """, (participant_id, data.house_id))

    # Broadcast update to public screen via SSE
    await sse_manager.broadcast_assignment({
        "participant_id": p["id"],
        "display_name": p["display_name"],
        "house_code": house["code"],
        "house_name_en": house["name_en"],
        "house_name_de": house["name_de"],
        "color_hex": house["color_hex"],
        "secondary_color": house["secondary_color"],
        "motto_en": house["motto_en"],
        "motto_de": house["motto_de"],
        "crest_icon": house["crest_icon"],
        "is_hesitant": False,
        "is_manual_override": True
    })

    return {"status": "success", "message": f"Participant reassigned to {house['name_en']}."}

@router.delete("/participants/{participant_id}", dependencies=[Depends(verify_admin)])
async def delete_participant(participant_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM participant WHERE id = ?", (participant_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Participant not found.")

    await sse_manager.broadcast_reset()
    return {"status": "success", "message": "Participant deleted."}

@router.delete("/event/reset", dependencies=[Depends(verify_admin)])
@router.post("/event/reset", dependencies=[Depends(verify_admin)])
async def reset_event():
    """
    Clears all assignments, answers, and participants (FR-16).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM assignment")
        cursor.execute("DELETE FROM answer")
        cursor.execute("DELETE FROM participant")

    # Broadcast reset to refresh all connected public screens
    await sse_manager.broadcast_reset()
    return {"status": "success", "message": "Event reset successfully. All assignments cleared."}

@router.post("/auto-balance", dependencies=[Depends(verify_admin)])
async def auto_balance_houses():
    """
    Evenly redistributes sorted participants across all 4 houses (FR-18).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, code, name_en, name_de FROM house ORDER BY id ASC")
        houses = [dict(h) for h in cursor.fetchall()]
        if not houses:
            raise HTTPException(status_code=400, detail="No houses found.")

        cursor.execute("""
            SELECT a.id, a.participant_id, a.house_id, a.score_breakdown, p.display_name
            FROM assignment a
            JOIN participant p ON p.id = a.participant_id
            ORDER BY a.id ASC
        """)
        assignments = [dict(r) for r in cursor.fetchall()]
        if not assignments:
            return {"status": "success", "message": "No assignments to balance."}

        house_codes = [h["code"] for h in houses]
        house_id_by_code = {h["code"]: h["id"] for h in houses}
        house_assigned_count = {code: 0 for code in house_codes}

        for item in assignments:
            breakdown = {}
            if item["score_breakdown"]:
                try:
                    breakdown = json.loads(item["score_breakdown"])
                except Exception:
                    breakdown = {}

            # Sort candidate houses by participant's score descending, then least populated
            sorted_candidates = sorted(
                house_codes,
                key=lambda code: (
                    -breakdown.get(code, 0),
                    house_assigned_count[code]
                )
            )

            # Pick candidate with lowest occupancy
            min_occupancy = min(house_assigned_count.values())
            min_candidates = [c for c in sorted_candidates if house_assigned_count[c] == min_occupancy]
            chosen_code = min_candidates[0] if min_candidates else sorted_candidates[0]

            house_assigned_count[chosen_code] += 1
            new_house_id = house_id_by_code[chosen_code]

            cursor.execute("""
                UPDATE assignment
                SET house_id = ?, manual_override = 1, assigned_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (new_house_id, item["id"]))

    # Broadcast reset to synchronize all connected public screens immediately
    await sse_manager.broadcast_reset()
    return {
        "status": "success",
        "message": "Houses have been automatically balanced.",
        "distribution": house_assigned_count
    }

@router.get("/export/csv", dependencies=[Depends(verify_admin)])
def export_csv():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.display_name, p.preferred_lang,
                   h.name_en as house_en, h.name_de as house_de, h.code as house_code,
                   a.total_score, a.manual_override, a.assigned_at
            FROM participant p
            LEFT JOIN assignment a ON a.participant_id = p.id
            LEFT JOIN house h ON h.id = a.house_id
            ORDER BY a.assigned_at DESC
        """)
        rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Display Name", "Language", "House (EN)", "House (DE)", "House Code", "Total Score", "Manual Override", "Assigned At"])
    for r in rows:
        writer.writerow([
            r["id"],
            r["display_name"],
            r["preferred_lang"],
            r["house_en"] or "Not Sorted",
            r["house_de"] or "Nicht zugeordnet",
            r["house_code"] or "",
            r["total_score"] if r["total_score"] is not None else "",
            "Yes" if r["manual_override"] else "No",
            r["assigned_at"] or ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sorting_hat_results.csv"}
    )

@router.get("/stats", dependencies=[Depends(verify_admin)])
def get_closing_stats():
    """Returns closing stats: largest house, house distribution, divisive question, and incomplete participants."""
    with get_db() as conn:
        cursor = conn.cursor()
        # 1. House distribution
        cursor.execute("""
            SELECT h.id, h.code, h.name_en, h.name_de, h.color_hex, h.crest_icon, COUNT(a.id) as total
            FROM house h
            LEFT JOIN assignment a ON a.house_id = h.id
            GROUP BY h.id, h.code, h.name_en, h.name_de, h.color_hex, h.crest_icon
            ORDER BY total DESC
        """)
        houses = [dict(h) for h in cursor.fetchall()]

        # 2. Total participants & sorted count
        cursor.execute("SELECT COUNT(*) as cnt FROM participant")
        total_participants = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM assignment")
        total_assigned = cursor.fetchone()["cnt"]

        # 3. Query 4 from PDF section 7.4: Participants who started but never finished
        cursor.execute("""
            SELECT p.id, p.display_name, COUNT(an.id) AS answered_count
            FROM participant p
            LEFT JOIN answer an ON an.participant_id = p.id
            LEFT JOIN assignment a ON a.participant_id = p.id
            WHERE a.id IS NULL
            GROUP BY p.id, p.display_name
        """)
        incomplete_participants = [dict(r) for r in cursor.fetchall()]

        # 4. Most divisive question (Section 15: question with highest distribution entropy/spread across options)
        cursor.execute("""
            SELECT q.id, q.text_en, q.text_de, an.option_id, COUNT(an.id) as opt_count
            FROM question q
            JOIN answer an ON an.question_id = q.id
            GROUP BY q.id, q.text_en, q.text_de, an.option_id
        """)
        answer_spreads = cursor.fetchall()
        
        q_options = {}
        q_texts = {}
        for row in answer_spreads:
            qid = row["id"]
            if qid not in q_options:
                q_options[qid] = []
                q_texts[qid] = {"text_en": row["text_en"], "text_de": row["text_de"]}
            q_options[qid].append(row["opt_count"])

        most_divisive = None
        min_variance = float('inf')
        for qid, counts in q_options.items():
            if len(counts) >= 2:
                # Lower standard deviation / variance among chosen options = more evenly divided / divisive
                avg = sum(counts) / len(counts)
                var = sum((c - avg) ** 2 for c in counts) / len(counts)
                if var < min_variance:
                    min_variance = var
                    most_divisive = {
                        "id": qid,
                        "text_en": q_texts[qid]["text_en"],
                        "text_de": q_texts[qid]["text_de"],
                        "options_chosen": len(counts)
                    }

    largest_house = houses[0] if houses and houses[0]["total"] > 0 else None

    return {
        "total_participants": total_participants,
        "total_assigned": total_assigned,
        "largest_house": largest_house,
        "house_distribution": houses,
        "incomplete_participants": incomplete_participants,
        "most_divisive_question": most_divisive
    }
