import csv
import io
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header, Cookie, Response, status
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import (
    AdminLogin, AdminReassign, AdminEventSettings, AdminProfileOut,
    AdminParticipantPointsUpdate, QuestionIn, OptionIn, QuestionDetailOut
)
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

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.display_name, p.preferred_lang, p.created_at,
                   a.id as assignment_id, a.house_id, a.total_score, a.score_breakdown,
                   a.manual_override, a.assigned_at,
                   h.code as house_code,
                   CASE WHEN ? = 'de' THEN h.name_de ELSE h.name_en END as house_name,
                   h.color_hex,
                   (SELECT COUNT(*) FROM answer an WHERE an.participant_id = p.id) as answered_questions,
                   (SELECT COUNT(*) FROM house_game_point gp WHERE gp.participant_id = p.id AND gp.is_spell = 1) as spells_cast,
                   (SELECT COALESCE(SUM(points), 0) FROM house_game_point gp WHERE gp.participant_id = p.id) as spell_points_won
            FROM participant p
            LEFT JOIN assignment a ON a.participant_id = p.id
            LEFT JOIN house h ON h.id = a.house_id
            ORDER BY p.id DESC
        """, (lang,))
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
        cursor.execute("SELECT id, display_name, event_id FROM participant WHERE id = ?", (participant_id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Participant not found.")

        # Verify target house
        cursor.execute("SELECT id, code, name_en, name_de, color_hex, secondary_color, motto_en, motto_de, crest_icon FROM house WHERE id = ?", (data.house_id,))
        house = cursor.fetchone()
        if not house:
            raise HTTPException(status_code=404, detail="House not found.")

        # Check existing assignment
        cursor.execute("SELECT id, house_id FROM assignment WHERE participant_id = ?", (participant_id,))
        assign_row = cursor.fetchone()
        old_house_id = assign_row["house_id"] if assign_row else None

        # Upsert / Update assignment with manual_override = 1
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

        # If house has changed, old house loses this participant's points & participant's spell attempts are reset!
        old_house_info = None
        if old_house_id and old_house_id != data.house_id:
            # Delete previous points for this participant from old house
            cursor.execute("DELETE FROM house_game_point WHERE participant_id = ? AND event_id = ?", (participant_id, p["event_id"]))
            
            # Recalculate old house game_points
            cursor.execute("""
                UPDATE house
                SET game_points = (
                    SELECT COALESCE(SUM(points), 0)
                    FROM house_game_point
                    WHERE house_id = ?
                )
                WHERE id = ?
            """, (old_house_id, old_house_id))

            cursor.execute("SELECT id, code, name_en, game_points FROM house WHERE id = ?", (old_house_id,))
            old_house_info = cursor.fetchone()

        # Recalculate target house game_points
        cursor.execute("""
            UPDATE house
            SET game_points = (
                SELECT COALESCE(SUM(points), 0)
                FROM house_game_point
                WHERE house_id = ?
            )
            WHERE id = ?
        """, (data.house_id, data.house_id))

        cursor.execute("SELECT game_points FROM house WHERE id = ?", (data.house_id,))
        new_house_points = float(cursor.fetchone()["game_points"])

    # Broadcast old house points deduction to /screen via SSE
    if old_house_info:
        await sse_manager.broadcast_house_points({
            "house_id": old_house_info["id"],
            "house_code": old_house_info["code"],
            "house_name": old_house_info["name_en"],
            "participant_name": p["display_name"],
            "awarded_points": 0,
            "total_game_points": float(old_house_info["game_points"])
        })

    # Broadcast new house points update via SSE
    await sse_manager.broadcast_house_points({
        "house_id": house["id"],
        "house_code": house["code"],
        "house_name": house["name_en"],
        "participant_name": p["display_name"],
        "awarded_points": 0,
        "total_game_points": new_house_points
    })

    # Broadcast assignment update to public screen via SSE
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

    return {"status": "success", "message": f"Participant reassigned to {house['name_en']}. Previous house points removed and spells cast reset to 0/2."}

@router.patch("/participants/{participant_id}/points", dependencies=[Depends(verify_admin)])
async def update_participant_points(participant_id: int, data: AdminParticipantPointsUpdate):
    """
    Allows administrator to directly view and edit a participant's points:
    - House Cup Points (updates house_game_point transactions and recalibrates house total)
    - Sorting Ceremony Score (updates assignment total_score)
    - Spells Cast attempts (allows resetting or adjusting cast limits)
    - House Reassignment (reassigns house, removing points from old house)
    Broadcasts live updates to /screen via SSE.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Verify participant
        cursor.execute("""
            SELECT p.id, p.display_name, p.event_id, a.house_id, h.code as house_code, h.name_en as house_name
            FROM participant p
            LEFT JOIN assignment a ON a.participant_id = p.id
            LEFT JOIN house h ON h.id = a.house_id
            WHERE p.id = ?
        """, (participant_id,))
        participant = cursor.fetchone()
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found.")

        old_house_id = participant["house_id"]
        event_id = participant["event_id"]
        target_house_id = data.house_id if data.house_id is not None else old_house_id

        # 2. Check house change
        old_house_info = None
        new_house_assigned = False
        if data.house_id is not None and old_house_id and data.house_id != old_house_id:
            # Update assignment to new house
            cursor.execute("""
                UPDATE assignment
                SET house_id = ?, manual_override = 1, assigned_at = CURRENT_TIMESTAMP
                WHERE participant_id = ?
            """, (data.house_id, participant_id))

            # Delete old points so old house loses them
            cursor.execute("DELETE FROM house_game_point WHERE participant_id = ? AND event_id = ?", (participant_id, event_id))

            # Recalibrate old house
            cursor.execute("""
                UPDATE house
                SET game_points = (
                    SELECT COALESCE(SUM(points), 0)
                    FROM house_game_point
                    WHERE house_id = ?
                )
                WHERE id = ?
            """, (old_house_id, old_house_id))

            cursor.execute("SELECT id, code, name_en, game_points FROM house WHERE id = ?", (old_house_id,))
            old_house_info = cursor.fetchone()
            new_house_assigned = True

        active_house_id = target_house_id

        # 3. Update Sorting Ceremony Score
        if data.sorting_score is not None:
            if active_house_id:
                cursor.execute("""
                    UPDATE assignment
                    SET total_score = ?, manual_override = 1
                    WHERE participant_id = ?
                """, (data.sorting_score, participant_id))

        # 4. Update House Cup Points and Spells Cast for the active house
        new_house_points = 0.0
        if active_house_id is not None:
            # Check current stats for active house
            cursor.execute("""
                SELECT COUNT(*) as cnt
                FROM house_game_point
                WHERE participant_id = ? AND event_id = ? AND is_spell = 1
            """, (participant_id, event_id))
            current_casts = cursor.fetchone()["cnt"]

            cursor.execute("""
                SELECT COALESCE(SUM(points), 0) as total_pts
                FROM house_game_point
                WHERE participant_id = ? AND event_id = ?
            """, (participant_id, event_id))
            current_pts = float(cursor.fetchone()["total_pts"])

            target_pts = data.game_points if data.game_points is not None else current_pts
            target_casts = data.spells_cast if data.spells_cast is not None else current_casts

            # Re-record house_game_point entries for this participant
            cursor.execute("""
                DELETE FROM house_game_point
                WHERE participant_id = ? AND event_id = ?
            """, (participant_id, event_id))

            if target_casts == 0:
                if target_pts > 0:
                    cursor.execute("""
                        INSERT INTO house_game_point (event_id, participant_id, house_id, points, is_spell)
                        VALUES (?, ?, ?, ?, 0)
                    """, (event_id, participant_id, active_house_id, target_pts))
            else:
                pts_per_cast = round(target_pts / target_casts, 2)
                for i in range(target_casts):
                    pts = pts_per_cast if i < target_casts - 1 else round(target_pts - pts_per_cast * (target_casts - 1), 2)
                    cursor.execute("""
                        INSERT INTO house_game_point (event_id, participant_id, house_id, points, is_spell)
                        VALUES (?, ?, ?, ?, 1)
                    """, (event_id, participant_id, active_house_id, pts))

            # Recalibrate house total game_points
            cursor.execute("""
                UPDATE house
                SET game_points = (
                    SELECT COALESCE(SUM(points), 0)
                    FROM house_game_point
                    WHERE house_id = house.id
                )
                WHERE id = ?
            """, (active_house_id,))

            # Read new total for active house
            cursor.execute("SELECT id, code, name_en, name_de, color_hex, secondary_color, motto_en, motto_de, crest_icon, game_points FROM house WHERE id = ?", (active_house_id,))
            new_house_row = cursor.fetchone()
            new_house_points = float(new_house_row["game_points"])

    # 5. Broadcast SSE updates
    if old_house_info:
        await sse_manager.broadcast_house_points({
            "house_id": old_house_info["id"],
            "house_code": old_house_info["code"],
            "house_name": old_house_info["name_en"],
            "participant_name": participant["display_name"],
            "awarded_points": 0,
            "total_game_points": float(old_house_info["game_points"])
        })

    if active_house_id and new_house_row:
        await sse_manager.broadcast_house_points({
            "house_id": new_house_row["id"],
            "house_code": new_house_row["code"],
            "house_name": new_house_row["name_en"],
            "participant_name": participant["display_name"],
            "awarded_points": data.game_points if data.game_points is not None else 0,
            "total_game_points": new_house_points
        })

        if new_house_assigned:
            await sse_manager.broadcast_assignment({
                "participant_id": participant["id"],
                "display_name": participant["display_name"],
                "house_code": new_house_row["code"],
                "house_name_en": new_house_row["name_en"],
                "house_name_de": new_house_row["name_de"],
                "color_hex": new_house_row["color_hex"],
                "secondary_color": new_house_row["secondary_color"],
                "motto_en": new_house_row["motto_en"],
                "motto_de": new_house_row["motto_de"],
                "crest_icon": new_house_row["crest_icon"],
                "is_hesitant": False,
                "is_manual_override": True
            })

    return {
        "status": "success",
        "message": f"Points updated for {participant['display_name']}."
    }

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
        cursor.execute("DELETE FROM house_game_point")
        cursor.execute("DELETE FROM participant")
        cursor.execute("UPDATE house SET game_points = 0")

    # Broadcast reset to refresh all connected public screens
    await sse_manager.broadcast_reset()
    return {"status": "success", "message": "Event reset successfully. All assignments and house cup points cleared."}

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

        # 5. House Game Points & Spell Casting Statistics
        cursor.execute("SELECT COUNT(*) as cnt FROM house_game_point WHERE is_spell = 1")
        total_spells_cast = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COALESCE(SUM(points), 0) as total_pts FROM house_game_point")
        total_spell_points = float(cursor.fetchone()["total_pts"])

        # House Game Points breakdown by House
        cursor.execute("""
            SELECT h.id, h.code, h.name_en, h.name_de, h.color_hex, h.crest_icon, h.game_points,
                   (SELECT COUNT(*) FROM house_game_point gp WHERE gp.house_id = h.id AND gp.is_spell = 1) as spells_cast
            FROM house h
            ORDER BY h.game_points DESC
        """)
        house_spell_stats = [dict(r) for r in cursor.fetchall()]

    largest_house = houses[0] if houses and houses[0]["total"] > 0 else None

    return {
        "total_participants": total_participants,
        "total_assigned": total_assigned,
        "largest_house": largest_house,
        "house_distribution": houses,
        "incomplete_participants": incomplete_participants,
        "most_divisive_question": most_divisive,
        "total_spells_cast": total_spells_cast,
        "total_spell_points": total_spell_points,
        "house_spell_stats": house_spell_stats
    }

# --- Question Management Endpoints (CRUD) ---

@router.get("/questions", dependencies=[Depends(verify_admin)])
def admin_get_questions():
    """Returns all questions with options and house score breakdown for administration."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        event = cursor.fetchone()
        if not event:
            return []

        cursor.execute("""
            SELECT id, text_en, text_de, position
            FROM question
            WHERE event_id = ?
            ORDER BY position ASC, id ASC
        """, (event["id"],))
        questions = [dict(q) for q in cursor.fetchall()]

        cursor.execute("SELECT id, code FROM house")
        house_map = {row["id"]: row["code"] for row in cursor.fetchall()}

        for q in questions:
            cursor.execute("""
                SELECT id, text_en, text_de, position
                FROM option
                WHERE question_id = ?
                ORDER BY position ASC, id ASC
            """, (q["id"],))
            options = [dict(opt) for opt in cursor.fetchall()]

            for opt in options:
                cursor.execute("""
                    SELECT house_id, points
                    FROM option_score
                    WHERE option_id = ?
                """, (opt["id"],))
                scores = {"GRY": 0, "RAV": 0, "HUF": 0, "SLY": 0}
                for s in cursor.fetchall():
                    h_code = house_map.get(s["house_id"])
                    if h_code:
                        scores[h_code] = s["points"]
                opt["scores"] = scores

            q["options"] = options

    return questions

@router.post("/questions", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_admin)])
def admin_create_question(data: QuestionIn):
    """Creates a new question with options and validated scores (0 to 10 points)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM event WHERE active = 1 ORDER BY id DESC LIMIT 1")
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=400, detail="No active event found.")
        event_id = event["id"]

        cursor.execute("SELECT id, code FROM house")
        house_code_to_id = {row["code"]: row["id"] for row in cursor.fetchall()}

        cursor.execute("SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM question WHERE event_id = ?", (event_id,))
        next_pos = cursor.fetchone()["next_pos"]

        cursor.execute("""
            INSERT INTO question (event_id, text_en, text_de, position)
            VALUES (?, ?, ?, ?)
        """, (event_id, data.text_en.strip(), data.text_de.strip(), next_pos))
        question_id = cursor.lastrowid

        for idx, opt in enumerate(data.options, start=1):
            cursor.execute("""
                INSERT INTO option (question_id, text_en, text_de, position)
                VALUES (?, ?, ?, ?)
            """, (question_id, opt.text_en.strip(), opt.text_de.strip(), idx))
            option_id = cursor.lastrowid

            for house_code, points in opt.scores.items():
                if house_code in house_code_to_id:
                    cursor.execute("""
                        INSERT INTO option_score (option_id, house_id, points)
                        VALUES (?, ?, ?)
                    """, (option_id, house_code_to_id[house_code], max(0, min(10, points))))

    return {"status": "success", "question_id": question_id, "message": "Question created successfully."}

@router.put("/questions/{question_id}", dependencies=[Depends(verify_admin)])
def admin_update_question(question_id: int, data: QuestionIn):
    """Updates an existing question, replacing its options and scores."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, event_id FROM question WHERE id = ?", (question_id,))
        q_row = cursor.fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Question not found.")

        cursor.execute("SELECT id, code FROM house")
        house_code_to_id = {row["code"]: row["id"] for row in cursor.fetchall()}

        cursor.execute("""
            UPDATE question
            SET text_en = ?, text_de = ?
            WHERE id = ?
        """, (data.text_en.strip(), data.text_de.strip(), question_id))

        cursor.execute("DELETE FROM option WHERE question_id = ?", (question_id,))

        for idx, opt in enumerate(data.options, start=1):
            cursor.execute("""
                INSERT INTO option (question_id, text_en, text_de, position)
                VALUES (?, ?, ?, ?)
            """, (question_id, opt.text_en.strip(), opt.text_de.strip(), idx))
            option_id = cursor.lastrowid

            for house_code, points in opt.scores.items():
                if house_code in house_code_to_id:
                    cursor.execute("""
                        INSERT INTO option_score (option_id, house_id, points)
                        VALUES (?, ?, ?)
                    """, (option_id, house_code_to_id[house_code], max(0, min(10, points))))

    return {"status": "success", "question_id": question_id, "message": "Question updated successfully."}

@router.delete("/questions/{question_id}", dependencies=[Depends(verify_admin)])
def admin_delete_question(question_id: int):
    """Deletes a question, cascading to options, scores, and answers."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, event_id FROM question WHERE id = ?", (question_id,))
        q_row = cursor.fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Question not found.")

        cursor.execute("DELETE FROM question WHERE id = ?", (question_id,))

    return {"status": "success", "message": "Question deleted successfully."}

