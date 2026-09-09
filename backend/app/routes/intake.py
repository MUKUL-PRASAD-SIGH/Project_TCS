from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from backend.app.models import (
    ApplicantSubmission,
    AssessmentRequest,
    IntakeRequest,
    IntakeResponse,
    QuestionsRequest,
    QuestionsResponse,
)


router = APIRouter(prefix="/api", tags=["intake"])


class ChatAssessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=3, max_length=2000)
    service_id: str | None = None
    existing_facts: dict[str, Any] = Field(default_factory=dict)
    existing_contradictions: list[str] = Field(default_factory=list)


@router.post("/intake", response_model=IntakeResponse)
def intake(payload: IntakeRequest, request: Request) -> IntakeResponse:
    return request.app.state.intake_service.understand(
        payload.message, payload.selected_service_id
    )


@router.post("/chat-assess")
def chat_assess(payload: ChatAssessRequest, request: Request) -> dict:
    intake_result = request.app.state.intake_service.understand(
        payload.message, payload.service_id
    )
    service_id = intake_result.service_id or payload.service_id
    allowed_fields = {
        question.field
        for question in request.app.state.rule_engine.get_questions(
            service_id or "unsupported", {}
        ).questions
    }
    answers = {
        field: value
        for field, value in payload.existing_facts.items()
        if field in allowed_fields and value is not None and value != "unknown"
    }
    contradictions = set(payload.existing_contradictions)
    for fact in intake_result.facts:
        if fact.field not in allowed_fields or fact.value is None or fact.value == "unknown":
            continue
        if fact.field in answers and answers[fact.field] != fact.value:
            contradictions.add(fact.field)
            continue
        answers[fact.field] = fact.value
    contradictions.update(intake_result.contradictions)
    evidence: dict[str, list[str]] = {
        fact.field: [fact.evidence] for fact in intake_result.facts
    }
    city_is_supported = any(
        name in payload.message.casefold() for name in ("bengaluru", "bangalore")
    ) or str(
        payload.existing_facts.get("event_location")
        or payload.existing_facts.get("location")
        or payload.existing_facts.get("city")
        or ""
    ).strip().casefold() in {"bengaluru", "bangalore"}
    provider = (
        "bedrock_glm5" if intake_result.provider == "bedrock" else "structured_fallback"
    )

    def abstention(status: str, message: str, missing_fields: list[str]) -> dict:
        return {
            "provider": provider,
            "extracted_facts": {
                "service_id": service_id,
                **answers,
            },
            "contradictions": sorted(contradictions),
            "assessment": {
                "overall_status": status,
                "passed": [],
                "failed": [],
                "unknown": [],
                "not_applicable": [],
                "missing_fields": missing_fields,
                "rule_version": None,
            },
            "explanation": message,
            "disclaimer": "Demonstration using synthetic rules. Not official permit advice.",
        }

    if service_id is None:
        return abstention(
            "UNSUPPORTED",
            "Verified rules are not currently available for this permit or jurisdiction.",
            [],
        )
    if not city_is_supported:
        supplied_location = next(
            (
                fact.value
                for fact in intake_result.facts
                if fact.field in {"location", "event_location", "city"}
            ),
            None,
        )
        if supplied_location:
            return abstention(
                "UNSUPPORTED",
                "Verified rules are not currently available for this jurisdiction.",
                [],
            )
        _, _, detail_fields = request.app.state.rule_engine.preflight(
            service_id,
            "in-ka-bengaluru-demo",
            answers,
        )
        field_labels = {
            "event_duration_days": "Event duration",
            "expected_attendance": "Expected attendance",
            "emergency_plan_status": "Emergency plan status",
            "venue_permission_status": "Venue permission status",
            "uses_amplified_sound": "Amplified sound usage",
            "serves_food": "Food service",
            "operating_days": "Operating duration",
            "food_handlers_trained": "Food-handler training",
            "handwashing_facility_available": "Handwashing facility",
            "registration_proof_status": "Registration proof",
            "uses_lpg": "LPG usage",
            "uses_open_flame": "Open-flame usage",
            "serves_perishables": "Perishable food service",
        }
        missing_labels = [
            "Location",
            *(field_labels.get(field, field) for field in detail_fields),
        ]
        return abstention(
            "MORE_INFORMATION_NEEDED",
            "I need a few more details before I can assess your eligibility: "
            + "; ".join(missing_labels)
            + ".",
            ["location", *detail_fields],
        )

    permit_type = service_id
    guard_status, guard_message, missing_fields = request.app.state.rule_engine.preflight(
        permit_type,
        "in-ka-bengaluru-demo",
        answers,
    )
    if guard_status != "SUPPORTED":
        return abstention(guard_status, guard_message, missing_fields)

    assessment = request.app.state.rule_engine.assess(
        AssessmentRequest(
            location={
                "country": "India",
                "state": "Karnataka",
                "city": "Bengaluru",
                "authority": "bengaluru-demo-authority",
                "authority_confirmed": True,
            },
            permit_type=permit_type,
            applicant=ApplicantSubmission(
                answers=answers,
                contradictions=sorted(contradictions),
                evidence=evidence,
            ),
        )
    )

    def checks(status: str) -> list[dict[str, str]]:
        return [
            {"rule_id": item.rule_id, "description": item.description}
            for item in assessment.rule_results
            if item.status.value == status
        ]

    return {
        "provider": provider,
        "extracted_facts": {
            "service_id": service_id,
            **answers,
        },
        "contradictions": sorted(contradictions),
        "assessment": {
            "overall_status": assessment.overall_status.value,
            "passed": checks("PASS"),
            "failed": checks("FAIL"),
            "unknown": checks("UNKNOWN"),
            "not_applicable": checks("NOT_APPLICABLE"),
            "rule_version": assessment.rule_version,
        },
        "explanation": assessment.message,
        "disclaimer": assessment.disclaimer,
    }


@router.post("/questions", response_model=QuestionsResponse)
def questions(payload: QuestionsRequest, request: Request) -> QuestionsResponse:
    result = request.app.state.rule_engine.get_questions(
        payload.permit_type, payload.answers
    )
    if not result.questions:
        raise HTTPException(status_code=404, detail="Unsupported permit type")
    return result
