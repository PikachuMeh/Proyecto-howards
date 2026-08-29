import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager

DB_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DB_DIR / "sorting_hat.db"

def get_db_path() -> Path:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return DB_PATH

def get_db_connection(db_path: Path = None) -> sqlite3.Connection:
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(str(target_path), check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db(db_path: Path = None):
    conn = get_db_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

DDL_STATEMENTS = """
-- 1. Event Table
CREATE TABLE IF NOT EXISTS event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(120) NOT NULL,
    starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT 1,
    balancing_mode BOOLEAN NOT NULL DEFAULT 0
);

-- 2. House Table (Bilingual: EN / DE)
CREATE TABLE IF NOT EXISTS house (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name_en VARCHAR(60) NOT NULL,
    name_de VARCHAR(60) NOT NULL,
    color_hex CHAR(7) NOT NULL,
    secondary_color CHAR(7) NOT NULL DEFAULT '#D3A625',
    motto_en VARCHAR(160),
    motto_de VARCHAR(160),
    crest_icon VARCHAR(60),
    game_points INTEGER NOT NULL DEFAULT 0
);

-- 3. Question Table (Bilingual: EN / DE)
CREATE TABLE IF NOT EXISTS question (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    text_en TEXT NOT NULL,
    text_de TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (event_id, position)
);

-- 4. Option Table (Bilingual: EN / DE)
CREATE TABLE IF NOT EXISTS option (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    text_en TEXT NOT NULL,
    text_de TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (question_id, position)
);

-- 5. Option Score Bridge Table (N:M relation between Option and House)
CREATE TABLE IF NOT EXISTS option_score (
    option_id INTEGER NOT NULL REFERENCES option(id) ON DELETE CASCADE,
    house_id INTEGER NOT NULL REFERENCES house(id) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points BETWEEN 0 AND 10),
    PRIMARY KEY (option_id, house_id)
);

-- 6. Participant Table
CREATE TABLE IF NOT EXISTS participant (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    display_name VARCHAR(40) NOT NULL,
    session_token VARCHAR(36) NOT NULL UNIQUE,
    preferred_lang VARCHAR(5) NOT NULL DEFAULT 'en',
    password_hash VARCHAR(128) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, display_name)
);

-- 7. Answer Table
CREATE TABLE IF NOT EXISTS answer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES option(id) ON DELETE CASCADE,
    answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (participant_id, question_id)
);

-- 8. Assignment Table
CREATE TABLE IF NOT EXISTS assignment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL UNIQUE REFERENCES participant(id) ON DELETE CASCADE,
    house_id INTEGER NOT NULL REFERENCES house(id),
    total_score INTEGER NOT NULL,
    score_breakdown TEXT NOT NULL, -- JSON string
    manual_override BOOLEAN NOT NULL DEFAULT 0,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Administrator Table
CREATE TABLE IF NOT EXISTS administrator (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'Headmaster',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. House Game Point Transaction Table (House Cup)
CREATE TABLE IF NOT EXISTS house_game_point (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
    house_id INTEGER NOT NULL REFERENCES house(id) ON DELETE CASCADE,
    points REAL NOT NULL,
    is_spell INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and sorting queries
CREATE INDEX IF NOT EXISTS idx_assignment_house ON assignment(house_id);
CREATE INDEX IF NOT EXISTS idx_assignment_time ON assignment(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_answer_participant ON answer(participant_id);
CREATE INDEX IF NOT EXISTS idx_admin_username ON administrator(username);
CREATE INDEX IF NOT EXISTS idx_game_point_house ON house_game_point(house_id);
"""

def init_db(db_path: Path = None):
    """Initializes database tables, indexes, and runs non-destructive schema migrations."""
    with get_db(db_path) as conn:
        conn.executescript(DDL_STATEMENTS)
        
        cursor = conn.cursor()
        # Schema migration check: ensure password_hash column exists in participant table
        cursor.execute("PRAGMA table_info(participant)")
        p_cols = [row["name"] for row in cursor.fetchall()]
        if p_cols and "password_hash" not in p_cols:
            cursor.execute("ALTER TABLE participant ADD COLUMN password_hash VARCHAR(128) NULL")

        # Schema migration check: ensure game_points column exists in house table
        cursor.execute("PRAGMA table_info(house)")
        h_cols = [row["name"] for row in cursor.fetchall()]
        if h_cols and "game_points" not in h_cols:
            cursor.execute("ALTER TABLE house ADD COLUMN game_points REAL NOT NULL DEFAULT 0")

        # Schema migration check: ensure is_spell column exists in house_game_point table
        cursor.execute("PRAGMA table_info(house_game_point)")
        gp_cols = [row["name"] for row in cursor.fetchall()]
        if gp_cols and "is_spell" not in gp_cols:
            cursor.execute("ALTER TABLE house_game_point ADD COLUMN is_spell INTEGER NOT NULL DEFAULT 1")

