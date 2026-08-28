import re
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional

WIZARD_NAME_REGEX = re.compile(r"^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'\-]+$")

class ParticipantCreate(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=40, description="Display name for the guest")
    preferred_lang: str = Field("en", pattern="^(en|de)$", description="Language: 'en' or 'de'")
    password: Optional[str] = Field(None, min_length=3, max_length=64, description="Secret spell/password for house scoring account")

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2 or len(cleaned) > 40:
            raise ValueError("Display name must be between 2 and 40 characters.")
        if not WIZARD_NAME_REGEX.match(cleaned):
            raise ValueError("Wizard name can only contain letters, spaces, hyphens, and apostrophes (no numbers or symbols).")
        letter_count = sum(1 for c in cleaned if c.isalpha())
        if letter_count < 2:
            raise ValueError("Wizard name must contain at least 2 alphabetic letters.")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 3:
                raise ValueError("Password must be at least 3 characters long.")
            return cleaned
        return v

class ParticipantLogin(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=40)
    password: str = Field(..., min_length=3, max_length=64)

class ParticipantResponse(BaseModel):
    id: int
    display_name: str
    session_token: str
    preferred_lang: str
    has_assignment: bool = False
    house_name: Optional[str] = None
    house_code: Optional[str] = None
    casts_used: int = 0
    casts_remaining: int = 2

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
    game_points: float = 0.0
    participants: List[Dict[str, Any]] = []

class HouseGamePlayResponse(BaseModel):
    status: str
    awarded_points: float
    total_game_points: float
    house_code: str
    house_name: str
    participant_name: str
    casts_used: int
    casts_remaining: int
    is_overpopulated: bool = False
    message: str

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

class AdminParticipantPointsUpdate(BaseModel):
    game_points: Optional[float] = Field(None, ge=0, description="House Cup Points contributed by this participant")
    sorting_score: Optional[int] = Field(None, ge=0, description="Sorting questionnaire total score")
    spells_cast: Optional[int] = Field(None, ge=0, le=2, description="Number of spells cast (0, 1, or 2)")

class AdminEventSettings(BaseModel):
    balancing_mode: bool

class OptionIn(BaseModel):
    id: Optional[int] = None
    text_en: str = Field(..., min_length=1, max_length=300, description="English option text")
    text_de: str = Field(..., min_length=1, max_length=300, description="German option text")
    position: Optional[int] = None
    scores: Dict[str, int] = Field(default_factory=dict, description="Points per house (GRY, RAV, HUF, SLY) between 0 and 10")

    @field_validator("scores")
    @classmethod
    def validate_scores(cls, v: Dict[str, int]) -> Dict[str, int]:
        valid_houses = {"GRY", "RAV", "HUF", "SLY"}
        for h, pts in v.items():
            if h not in valid_houses:
                raise ValueError(f"Invalid house code '{h}'. Must be one of {valid_houses}.")
            if not isinstance(pts, int) or pts < 0 or pts > 10:
                raise ValueError(f"Points for {h} must be an integer between 0 and 10.")
        return v

class QuestionIn(BaseModel):
    text_en: str = Field(..., min_length=3, max_length=500, description="English question text")
    text_de: str = Field(..., min_length=3, max_length=500, description="German question text")
    options: List[OptionIn] = Field(..., min_length=2, max_length=8, description="List of options with house score assignments")

class QuestionDetailOut(BaseModel):
    id: int
    text_en: str
    text_de: str
    position: int
    options: List[Dict[str, Any]]


