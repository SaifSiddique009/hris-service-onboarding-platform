from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, Db, require_admin
from app.modules.assistant import service

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[require_admin])


class QuestionIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class ToolUse(BaseModel):
    name: str
    arguments: dict
    row_count: int
    rows: list[dict]


class AnswerOut(BaseModel):
    answer: str
    tools_used: list[ToolUse]


@router.post("/query", response_model=AnswerOut)
def query(data: QuestionIn, db: Db, user: CurrentUser):
    return service.answer(db, user, data.question.strip())
