from typing import Any

from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.services import RuleEngine
from backend.app.services.notification import NotificationService
from backend.app.services.repository import InMemoryRepository
from backend.tests.conftest import assessment_payload, passing_event_answers


def create_session(client: TestClient) -> tuple[str, str]:
    session = client.post("/api/sessions").json()
    return session["session_id"], session["session_token"]


def save_assessment(client: TestClient, session_id: str, token: str) -> dict[str, Any]:
    response = client.post(
        "/api/assess",
        json=assessment_payload(
            "temporary_event", passing_event_answers(), session_id=session_id
        ),
        headers={"X-Session-Token": token},
    )
    assert response.status_code == 200
    return response.json()


def test_saved_assessment_requires_session_token(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    assert client.get(f"/api/assessments/{assessment['assessment_id']}").status_code == 403
    assert (
        client.get(
            f"/api/assessments/{assessment['assessment_id']}",
            headers={"X-Session-Token": token},
        ).status_code
        == 200
    )


def test_cross_session_access_is_rejected(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    _, other_token = create_session(client)
    response = client.get(
        f"/api/assessments/{assessment['assessment_id']}",
        headers={"X-Session-Token": other_token},
    )
    assert response.status_code == 403


def test_location_change_invalidates_previous_result(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    response = client.put(
        f"/api/sessions/{session_id}/context",
        json={
            "location": {"country": "India", "state": "Karnataka", "city": "Mysuru"},
            "permit_type": "temporary_event",
            "relevant_date": "2026-09-09",
        },
        headers={"X-Session-Token": token},
    ).json()
    assert response["result_invalidated"] is True
    saved = client.get(
        f"/api/assessments/{assessment['assessment_id']}",
        headers={"X-Session-Token": token},
    ).json()
    assert saved["result_valid"] is False


def test_service_change_invalidates_previous_result(client: TestClient) -> None:
    session_id, token = create_session(client)
    save_assessment(client, session_id, token)
    response = client.put(
        f"/api/sessions/{session_id}/context",
        json={"permit_type": "temporary_food_stall"},
        headers={"X-Session-Token": token},
    ).json()
    assert response["result_invalidated"] is True


def test_notification_defaults_to_dry_run(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    response = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json={
            "channel": "EMAIL",
            "destination": "demo@example.com",
            "consent": True,
            "idempotency_key": "email-demo-0001",
        },
        headers={"X-Session-Id": session_id, "X-Session-Token": token},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "DRY_RUN"
    assert response.json()["masked_destination"] == "d***@example.com"


def test_duplicate_notification_request_is_idempotent(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    request = {
        "channel": "EMAIL",
        "destination": "demo@example.com",
        "consent": True,
        "idempotency_key": "email-demo-duplicate",
    }
    headers = {"X-Session-Id": session_id, "X-Session-Token": token}
    first = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json=request,
        headers=headers,
    ).json()
    second = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json=request,
        headers=headers,
    ).json()
    assert second["notification_id"] == first["notification_id"]
    assert second["duplicate"] is True


def test_notification_requires_explicit_consent(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    response = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json={
            "channel": "EMAIL",
            "destination": "demo@example.com",
            "consent": False,
            "idempotency_key": "email-no-consent",
        },
        headers={"X-Session-Id": session_id, "X-Session-Token": token},
    )
    assert response.status_code == 400


def test_arbitrary_email_destination_is_rejected(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    response = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json={
            "channel": "EMAIL",
            "destination": "other@example.com",
            "consent": True,
            "idempotency_key": "wrong-email-destination",
        },
        headers={"X-Session-Id": session_id, "X-Session-Token": token},
    )
    assert response.status_code == 400


def test_non_allowlisted_sms_is_rejected(client: TestClient) -> None:
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    response = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json={
            "channel": "SMS",
            "destination": "+918888888888",
            "consent": True,
            "idempotency_key": "sms-not-allowlisted",
        },
        headers={"X-Session-Id": session_id, "X-Session-Token": token},
    )
    assert response.status_code == 400


def test_provider_failure_preserves_saved_assessment() -> None:
    class FailingSns:
        def publish(self, **_: Any) -> dict:
            raise RuntimeError("provider unavailable")

    repository = InMemoryRepository()
    settings = Settings(
        notifications_dry_run=False,
        sns_demo_email_topic_arn="arn:aws:sns:ap-south-1:123456789012:demo",
        sns_demo_email_recipient="demo@example.com",
    )
    notifier = NotificationService(settings, repository, lambda: FailingSns())
    client = TestClient(
        create_app(
            RuleEngine(),
            settings=settings,
            repository=repository,
            notification_service=notifier,
        )
    )
    session_id, token = create_session(client)
    assessment = save_assessment(client, session_id, token)
    response = client.post(
        f"/api/assessments/{assessment['assessment_id']}/notifications",
        json={
            "channel": "EMAIL",
            "destination": "demo@example.com",
            "consent": True,
            "idempotency_key": "provider-failure-01",
        },
        headers={"X-Session-Id": session_id, "X-Session-Token": token},
    )
    assert response.json()["status"] == "FAILED"
    saved = client.get(
        f"/api/assessments/{assessment['assessment_id']}",
        headers={"X-Session-Token": token},
    ).json()
    assert saved["overall_status"] == "MEETS_ASSESSED_REQUIREMENTS"
    assert saved["result_valid"] is True
