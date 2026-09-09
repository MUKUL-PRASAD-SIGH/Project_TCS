from fastapi import APIRouter, Header, HTTPException, Request

from backend.app.models import NotificationRequest, NotificationResponse
from backend.app.services.notification import NotificationError


router = APIRouter(prefix="/api/assessments", tags=["notifications"])


@router.post("/{assessment_id}/notifications", response_model=NotificationResponse)
def send_notification(
    assessment_id: str,
    payload: NotificationRequest,
    request: Request,
    x_session_id: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None),
) -> NotificationResponse:
    if not x_session_id:
        raise HTTPException(status_code=403, detail="Session access denied")
    try:
        return request.app.state.notification_service.send(
            assessment_id,
            x_session_id,
            x_session_token,
            payload,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Assessment not found") from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Assessment access denied") from exc
    except NotificationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
