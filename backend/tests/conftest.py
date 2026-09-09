from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.services import RuleEngine
from backend.app.services.repository import InMemoryRepository


DEMO_LOCATION = {
    "country": "India",
    "state": "Karnataka",
    "city": "Bengaluru",
    "authority": "bengaluru-demo-authority",
    "authority_confirmed": True,
}


@pytest.fixture
def engine() -> RuleEngine:
    return RuleEngine()


@pytest.fixture
def repository() -> InMemoryRepository:
    return InMemoryRepository()


@pytest.fixture
def settings() -> Settings:
    return Settings(
        notifications_dry_run=True,
        sns_demo_email_recipient="demo@example.com",
        sms_test_allowlist=("+919999999999",),
    )


@pytest.fixture
def client(
    engine: RuleEngine,
    repository: InMemoryRepository,
    settings: Settings,
) -> TestClient:
    return TestClient(
        create_app(engine, repository=repository, settings=settings)
    )


def assessment_payload(
    permit_type: str,
    answers: dict[str, Any],
    *,
    location: dict[str, Any] | None = None,
    contradictions: list[str] | None = None,
    session_id: str | None = None,
    relevant_date: str = "2026-09-09",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "location": location or DEMO_LOCATION,
        "permit_type": permit_type,
        "applicant": {
            "answers": answers,
            "contradictions": contradictions or [],
            "evidence": {},
        },
        "relevant_date": relevant_date,
    }
    if session_id:
        payload["session_id"] = session_id
    return payload


def passing_event_answers() -> dict[str, Any]:
    return {
        "event_duration_days": 2,
        "expected_attendance": 100,
        "emergency_plan_status": "have",
        "venue_permission_status": "have",
        "uses_amplified_sound": False,
        "serves_food": False,
    }


def passing_food_answers() -> dict[str, Any]:
    return {
        "operating_days": 3,
        "food_handlers_trained": True,
        "handwashing_facility_available": True,
        "registration_proof_status": "have",
        "uses_lpg": False,
        "uses_open_flame": False,
        "serves_perishables": False,
    }
