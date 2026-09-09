from fastapi import APIRouter, Request

from backend.app.models import CapabilitiesResponse


router = APIRouter(prefix="/api", tags=["system"])


@router.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities(request: Request) -> CapabilitiesResponse:
    settings = request.app.state.settings
    return CapabilitiesResponse(
        app_mode=settings.app_mode,
        bedrock={
            "configured": bool(settings.bedrock_model_id),
            "status": "live" if settings.bedrock_model_id else "unavailable",
            "provider": "bedrock_glm5" if settings.bedrock_model_id else None,
            "model_id": settings.bedrock_model_id or None,
        },
        places={
            "configured": settings.amazon_location_places_enabled,
            "status": "configured_not_probed" if settings.amazon_location_places_enabled else "local_synthetic",
        },
        notifications={
            "dry_run": settings.notifications_dry_run,
            "email_topic_configured": bool(settings.sns_demo_email_topic_arn),
            "email_destination": settings.sns_demo_email_recipient,
            "sms_allowlist_count": len(settings.sms_test_allowlist),
        },
        workflow={
            "mode": "local_synchronous" if not settings.state_machine_arn else "step_functions_configured",
            "state_machine_configured": bool(settings.state_machine_arn),
        },
    )
