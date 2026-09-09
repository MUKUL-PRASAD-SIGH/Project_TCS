from pydantic import BaseModel

from .assessment import RULES_DISCLAIMER


class PermitSummary(BaseModel):
    id: str
    name: str
    description: str
    jurisdiction_ids: list[str]
    rule_version: str
    disclaimer: str = RULES_DISCLAIMER
