from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ParticipantCreate(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=40, description="Display name for the guest")
    preferred_lang: str = Field("en", pattern="^(en|de)$", description="Language: 'en' or 'de'")

class ParticipantResponse(BaseModel):
    id: int
    display_name: str
    session_token: str
    preferred_lang: str
    has_assignment: bool = False

class OptionOut(BaseModel):
    id: int
    text: str
    position: int

class QuestionOut(BaseModel):
    id: int
    text: str
    position: int
    options: List[OptionOut]

class AnswerSubmit(BaseModel):
    question_id: int
    option_id: int

class AssignmentOut(BaseModel):
    house_code: str
    house_name: str
    color_hex: str
    secondary_color: str
    motto: str
    crest_icon: str
    total_score: int
    score_breakdown: Dict[str, int]
    applied_tie_breaker: Optional[str] = None
    is_hesitant: bool = False
    assigned_at: str

class HouseOut(BaseModel):
    id: int
    code: str
    name: str
    color_hex: str
    secondary_color: str
    motto: str
    crest_icon: str
    total: int
    participants: List[Dict[str, Any]] = []

class AdminLogin(BaseModel):
    username: str = Field(default="admin", description="Admin username")
    password: str = Field(..., description="Admin password")

class AdminProfileOut(BaseModel):
    admin_id: int
    username: str
    full_name: str
    role: str

class AdminReassign(BaseModel):
    house_id: int

class AdminEventSettings(BaseModel):
    balancing_mode: bool

