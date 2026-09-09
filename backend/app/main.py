import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import Settings
from backend.app.routes import (
    assess_router,
    capabilities_router,
    health_router,
    intake_router,
    locations_router,
    notifications_router,
    permits_router,
    sessions_router,
)
from backend.app.services import RuleEngine
from backend.app.services.intake import IntakeService
from backend.app.services.location import LocationService
from backend.app.services.notification import NotificationService
from backend.app.services.repository import InMemoryRepository


MAX_REQUEST_BYTES = 64 * 1024


def _allowed_origins(settings: Settings) -> list[str]:
    configured = os.getenv("PERMITAI_ALLOWED_ORIGINS", settings.frontend_origin)
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def create_app(
    rule_engine: RuleEngine | None = None,
    *,
    settings: Settings | None = None,
    repository: InMemoryRepository | None = None,
    intake_service: IntakeService | None = None,
    location_service: LocationService | None = None,
    notification_service: NotificationService | None = None,
) -> FastAPI:
    app_settings = settings or Settings.from_env()
    engine = rule_engine or RuleEngine()
    repo = repository or InMemoryRepository()
    application = FastAPI(
        title="PermitAI API",
        version="0.2.0",
        description=(
            "Deterministic municipal permit pre-check using synthetic demo rules. "
            "Not official permit advice."
        ),
    )
    application.state.settings = app_settings
    application.state.rule_engine = engine
    application.state.repository = repo
    application.state.intake_service = intake_service or IntakeService(app_settings)
    application.state.location_service = location_service or LocationService(
        app_settings, engine.data_dir
    )
    application.state.notification_service = notification_service or NotificationService(
        app_settings, repo
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(app_settings),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "X-Session-Id", "X-Session-Token"],
    )

    @application.middleware("http")
    async def limit_request_size(request: Request, call_next: Any) -> Any:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
        return await call_next(request)

    for router in (
        health_router,
        capabilities_router,
        permits_router,
        locations_router,
        sessions_router,
        intake_router,
        assess_router,
        notifications_router,
    ):
        application.include_router(router)
    return application


app = create_app()
