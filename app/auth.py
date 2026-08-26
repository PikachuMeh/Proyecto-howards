import hashlib
import hmac
import base64
import json
import secrets
import time
from typing import Optional, Dict, Any
from app.config import SECRET_KEY

# In-memory active administrator sessions cache / blacklist for revoked tokens
REVOKED_TOKENS = set()
ACTIVE_ADMIN_SESSIONS: Dict[str, Dict[str, Any]] = {}

SESSION_DURATION = 86400 * 7  # 7 days

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
    """Generates a secure cryptographically signed session token for the administrator."""
    payload = {
        "admin_id": admin_data["id"] if "id" in admin_data else admin_data.get("admin_id", 1),
        "username": admin_data["username"],
        "full_name": admin_data.get("full_name", admin_data["username"]),
        "role": admin_data.get("role", "Headmaster"),
        "exp": time.time() + SESSION_DURATION,
        "nonce": secrets.token_hex(8)
    }
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode('utf-8').rstrip('=')
    
    signature = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).hexdigest()
    token = f"hogwarts_adm_{payload_b64}.{signature}"
    
    ACTIVE_ADMIN_SESSIONS[token] = payload
    return token

def get_admin_session(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """Retrieves and cryptographically validates session data for a given token."""
    if not token or token in REVOKED_TOKENS:
        return None
    
    # 1. Check in-memory cache
    if token in ACTIVE_ADMIN_SESSIONS:
        sess = ACTIVE_ADMIN_SESSIONS[token]
        if sess.get("exp", 0) > time.time():
            return sess
        else:
            del ACTIVE_ADMIN_SESSIONS[token]
            return None

    # 2. Cryptographically verify signed HMAC token
    if token.startswith("hogwarts_adm_") and "." in token:
        try:
            core = token[len("hogwarts_adm_"):]
            payload_b64, signature = core.rsplit(".", 1)
            expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).hexdigest()
            if secrets.compare_digest(signature, expected_sig):
                # Add padding back if necessary
                padded_b64 = payload_b64 + '=' * (-len(payload_b64) % 4)
                payload_json = base64.urlsafe_b64decode(padded_b64).decode('utf-8')
                payload = json.loads(payload_json)
                if payload.get("exp", 0) > time.time():
                    # Cache in memory
                    ACTIVE_ADMIN_SESSIONS[token] = payload
                    return payload
        except Exception:
            pass

    return None

def destroy_admin_session(token: Optional[str]):
    """Revokes active session."""
    if token:
        REVOKED_TOKENS.add(token)
        if token in ACTIVE_ADMIN_SESSIONS:
            del ACTIVE_ADMIN_SESSIONS[token]

