from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ExtractedFact(BaseModel):
    field: str
    value: Any
    evidence: str


class IntakeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=3, max_length=2000)
    selected_service_id: str | None = Field(default=None, max_length=100)


class IntakeExtraction(BaseModel):
    service_id: str | None = None
    facts: list[ExtractedFact] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)


class IntakeResponse(IntakeExtraction):
    provider: Literal["bedrock", "structured_fallback"]
    provider_available: bool
    label: str
    status: Literal["SUPPORTED", "MORE_INFORMATION_NEEDED", "UNSUPPORTED"]
    message: str | None = None
    next_question: str | None = None


class Question(BaseModel):
    field: str
    label: str
    question: str
    help_text: str | None = None
    input_type: Literal["number", "boolean", "select", "date", "text"]
    options: list[dict[str, Any]] = Field(default_factory=list)
    show_when: dict[str, Any] | None = None
    document: bool = False


class QuestionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permit_type: str
    answers: dict[str, Any] = Field(default_factory=dict)


class QuestionsResponse(BaseModel):
    permit_type: str
    questions: list[Question]
    remaining_fields: list[str]
