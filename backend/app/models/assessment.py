from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


RULES_DISCLAIMER = "SYNTHETIC DEMO RULES — NOT GOVERNMENT REGULATIONS."
USER_DISCLAIMER = "Demonstration using synthetic rules. Not official permit advice."


class RuleStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class OverallStatus(str, Enum):
    MEETS_ASSESSED_REQUIREMENTS = "MEETS_ASSESSED_REQUIREMENTS"
    REQUIREMENTS_NOT_MET = "REQUIREMENTS_NOT_MET"
    MORE_INFORMATION_NEEDED = "MORE_INFORMATION_NEEDED"
    NEEDS_VERIFICATION = "NEEDS_VERIFICATION"
    UNSUPPORTED = "UNSUPPORTED"


class VenuePin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    label: str = Field(min_length=1, max_length=240)
    provider: str = Field(default="user_pin", max_length=50)


class Location(BaseModel):
    """Navigational location and separately confirmed authority."""

    model_config = ConfigDict(extra="forbid")

    country: str = Field(min_length=1, max_length=100, examples=["India"])
    state: str = Field(min_length=1, max_length=100, examples=["Karnataka"])
    city: str = Field(min_length=1, max_length=120, examples=["Bengaluru"])
    authority: str | None = Field(default=None, max_length=160)
    authority_confirmed: bool = False
    venue_pin: VenuePin | None = None
    ward_or_zone: str | None = Field(default=None, max_length=100)


class ApplicantSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: dict[str, Any] = Field(default_factory=dict)
    contradictions: list[str] = Field(default_factory=list)
    evidence: dict[str, list[str]] = Field(default_factory=dict)


class AssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: Location
    permit_type: str = Field(min_length=1, max_length=100)
    applicant: ApplicantSubmission
    relevant_date: date = Field(default_factory=date.today)
    session_id: str | None = Field(default=None, max_length=80)


class RuleEvidence(BaseModel):
    source_id: str
    source_section: str
    review_status: str
    data_classification: str
    last_reviewed_at: date
    effective_from: date
    effective_to: date | None = None


class RuleResult(BaseModel):
    rule_id: str
    description: str
    requirement_type: str = "eligibility"
    status: RuleStatus
    actual_value: Any | None = None
    expected: dict[str, Any] | None = None
    message: str
    rule_version: str
    evidence: RuleEvidence
    source_label: str = RULES_DISCLAIMER
    self_reported: bool = True


class AssessmentCounts(BaseModel):
    passed: int = 0
    failed: int = 0
    unknown: int = 0
    not_applicable: int = 0


class Completeness(BaseModel):
    required_fields: int = 0
    answered_fields: int = 0
    unanswered_fields: list[str] = Field(default_factory=list)
    contradictory_fields: list[str] = Field(default_factory=list)
    is_complete: bool = False


class DocumentResult(BaseModel):
    document_id: str
    name: str
    status: str
    rule_id: str
    self_reported: bool = True


class AssessmentResponse(BaseModel):
    permit_type: str
    jurisdiction_id: str | None
    overall_status: OverallStatus
    rule_version: str
    relevant_date: date
    assessed_at: datetime
    assessment_id: str | None = None
    result_valid: bool = True
    rule_results: list[RuleResult]
    counts: AssessmentCounts
    completeness: Completeness
    documents: list[DocumentResult] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    input_snapshot: dict[str, Any]
    message: str
    disclaimer: str = USER_DISCLAIMER

    @model_validator(mode="after")
    def empty_rules_cannot_pass(self) -> "AssessmentResponse":
        if (
            not self.rule_results
            and self.overall_status == OverallStatus.MEETS_ASSESSED_REQUIREMENTS
        ):
            raise ValueError("An empty rule result set cannot be eligible")
        return self
