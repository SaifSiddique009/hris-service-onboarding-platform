from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, Db, require_admin
from app.core.schemas import In
from app.modules.assistant import service

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[require_admin])


class Exchange(In):
    question: str = Field(max_length=500)
    answer: str = Field(max_length=8000)


class QuestionIn(In):
    question: str = Field(min_length=1, max_length=500)
    # Earlier turns of the same chat, so a follow-up such as "and in Cyprus?" makes sense.
    history: list[Exchange] = Field(default_factory=list, max_length=4)


class ToolUse(BaseModel):
    name: str
    label: str
    arguments: dict
    row_count: int
    total: int
    truncated: bool
    rows: list[dict]


class AnswerOut(BaseModel):
    answer: str
    tools_used: list[ToolUse]


@router.post("/query", response_model=AnswerOut)
def query(data: QuestionIn, db: Db, user: CurrentUser):
    history = [(turn.question, turn.answer) for turn in data.history]
    return service.answer(db, user, data.question, history)
