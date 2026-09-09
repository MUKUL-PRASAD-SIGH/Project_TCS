from fastapi import APIRouter, Header, HTTPException, Request

from backend.app.models import AssessmentRequest, AssessmentResponse


router = APIRouter(prefix="/api", tags=["assessments"])


@router.post("/assess", response_model=AssessmentResponse)
def assess(
    payload: AssessmentRequest,
    request: Request,
    x_session_token: str | None = Header(default=None),
) -> AssessmentResponse:
    result = request.app.state.rule_engine.assess(payload)
    if payload.session_id is None:
        return result
    repository = request.app.state.repository
    try:
        repository.update_context(
            payload.session_id,
            x_session_token,
            {
                "location": payload.location.model_dump(mode="json"),
                "permit_type": payload.permit_type,
                "relevant_date": payload.relevant_date.isoformat(),
            },
        )
        saved = repository.save_assessment(
            payload.session_id,
            x_session_token,
            result.model_dump(mode="json"),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Session access denied") from exc
    return AssessmentResponse.model_validate(saved)


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: str,
    request: Request,
    x_session_token: str | None = Header(default=None),
) -> AssessmentResponse:
    try:
        saved = request.app.state.repository.get_assessment(
            assessment_id, x_session_token
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Assessment not found") from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Assessment access denied") from exc
    return AssessmentResponse.model_validate(saved)
