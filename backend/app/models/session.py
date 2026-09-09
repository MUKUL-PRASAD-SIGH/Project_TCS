from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SessionCreated(BaseModel):
    session_id: str
    session_token: str
    created_at: datetime


class SessionContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: dict[str, Any] | None = None
    permit_type: str | None = Field(default=None, max_length=100)
    relevant_date: str | None = Field(default=None, max_length=10)


class SessionContextResponse(BaseModel):
    session_id: str
    result_invalidated: bool
    invalidated_assessment_ids: list[str]
