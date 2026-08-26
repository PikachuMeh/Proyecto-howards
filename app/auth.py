import hashlib
import secrets
import time
from typing import Optional, Dict, Any

# In-memory active administrator sessions { token: { "admin_id": int, "username": str, "full_name": str, "role": str, "created_at": float } }
ACTIVE_ADMIN_SESSIONS: Dict[str, Dict[str, Any]] = {}

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hashes password using PBKDF2-HMAC-SHA256 with salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}:{hashed.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies a plaintext password against a stored PBKDF2 salt:hash string."""
    if not stored_hash or ":" not in stored_hash:
        return False
    try:
        salt, hash_val = stored_hash.split(":", 1)
        computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
        return secrets.compare_digest(computed, hash_val)
    except Exception:
        return False

def create_admin_session(admin_data: Dict[str, Any]) -> str:
    """Generates a secure random session token for the administrator."""
    token = f"hogwarts_adm_{secrets.token_urlsafe(32)}"
    ACTIVE_ADMIN_SESSIONS[token] = {
        "admin_id": admin_data["id"],
        "username": admin_data["username"],
        "full_name": admin_data["full_name"],
        "role": admin_data.get("role", "Headmaster"),
        "created_at": time.time()
    }
    return token

def get_admin_session(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """Retrieves session data for a given token."""
    if not token:
        return None
    # Check in active sessions
    return ACTIVE_ADMIN_SESSIONS.get(token)

def destroy_admin_session(token: Optional[str]):
    """Removes active session."""
    if token and token in ACTIVE_ADMIN_SESSIONS:
        del ACTIVE_ADMIN_SESSIONS[token]
