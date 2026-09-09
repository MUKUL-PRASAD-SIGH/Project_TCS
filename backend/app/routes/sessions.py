from fastapi import APIRouter, Header, HTTPException, Request

from backend.app.models import (
    SessionContextRequest,
    SessionContextResponse,
    SessionCreated,
)


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionCreated)
def create_session(request: Request) -> SessionCreated:
    return SessionCreated.model_validate(request.app.state.repository.create_session())


@router.put("/{session_id}/context", response_model=SessionContextResponse)
def update_session_context(
    session_id: str,
    payload: SessionContextRequest,
    request: Request,
    x_session_token: str | None = Header(default=None),
) -> SessionContextResponse:
    try:
        invalidated = request.app.state.repository.update_context(
            session_id, x_session_token, payload.model_dump(mode="json")
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Session access denied") from exc
    return SessionContextResponse(
        session_id=session_id,
        result_invalidated=bool(invalidated),
        invalidated_assessment_ids=invalidated,
    )
