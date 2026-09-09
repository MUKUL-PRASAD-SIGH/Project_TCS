from fastapi.testclient import TestClient

from backend.tests.conftest import assessment_payload, passing_event_answers


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_permits_return_two_labelled_services(client: TestClient) -> None:
    response = client.get("/api/permits")
    assert response.status_code == 200
    assert {item["id"] for item in response.json()} == {
        "temporary_event",
        "temporary_food_stall",
    }
    assert all("SYNTHETIC DEMO" in item["disclaimer"] for item in response.json())


def test_capabilities_truthfully_report_local_integrations(client: TestClient) -> None:
    result = client.get("/api/capabilities").json()
    assert result["bedrock"]["status"] == "unavailable"
    assert result["places"]["status"] == "local_synthetic"
    assert result["notifications"]["dry_run"] is True
    assert result["workflow"]["mode"] == "local_synchronous"


def test_location_catalogue_has_no_invented_boundary(client: TestClient) -> None:
    result = client.get("/api/locations").json()
    assert result["boundary_metadata"]["coverage"] == "NO_VERIFIED_LOCAL_BOUNDARY_BUNDLED"
    assert result["jurisdictions"][0]["coverage"] == "SYNTHETIC_DEMO_COVERAGE"


def test_local_place_search_is_labelled_synthetic(client: TestClient) -> None:
    result = client.get("/api/locations/search", params={"q": "college"}).json()
    assert result["provider"] == "local_synthetic"
    assert result["provider_available"] is False
    assert result["results"][0]["result_is_jurisdiction_proof"] is False


def test_pin_resolution_never_claims_jurisdiction(client: TestClient) -> None:
    result = client.post(
        "/api/locations/resolve",
        json={"longitude": 77.6, "latitude": 12.97},
    ).json()
    assert result["authority_id"] is None
    assert result["requires_user_confirmation"] is True


def test_structured_intake_extracts_only_explicit_facts(client: TestClient) -> None:
    result = client.post(
        "/api/intake",
        json={"message": "A 2-day event for 250 people with no amplified sound"},
    ).json()
    assert result["provider"] == "structured_fallback"
    assert result["provider_available"] is False
    assert result["service_id"] == "temporary_event"
    assert {item["field"]: item["value"] for item in result["facts"]} == {
        "event_duration_days": 2,
        "expected_attendance": 250,
        "uses_amplified_sound": False,
    }


def test_intake_identifies_contradiction(client: TestClient) -> None:
    result = client.post(
        "/api/intake",
        json={"message": "A food stall with LPG but also no LPG"},
    ).json()
    assert "uses_lpg" in result["contradictions"]


def test_questions_hide_inactive_conditional_fields(client: TestClient) -> None:
    result = client.post(
        "/api/questions",
        json={
            "permit_type": "temporary_event",
            "answers": {"uses_amplified_sound": False, "serves_food": False},
        },
    ).json()
    fields = {question["field"] for question in result["questions"]}
    assert "amplified_sound_end_hour" not in fields
    assert "food_safety_plan_status" not in fields


def test_questions_show_activated_conditional_field(client: TestClient) -> None:
    result = client.post(
        "/api/questions",
        json={
            "permit_type": "temporary_event",
            "answers": {"uses_amplified_sound": True, "serves_food": False},
        },
    ).json()
    assert "amplified_sound_end_hour" in {
        question["field"] for question in result["questions"]
    }


def test_assessment_has_counts_sources_and_next_steps(client: TestClient) -> None:
    result = client.post(
        "/api/assess",
        json=assessment_payload("temporary_event", passing_event_answers()),
    ).json()
    assert result["overall_status"] == "MEETS_ASSESSED_REQUIREMENTS"
    assert result["counts"] == {
        "passed": 4,
        "failed": 0,
        "unknown": 0,
        "not_applicable": 2,
    }
    assert result["next_steps"]
    assert all(item["evidence"]["source_id"] for item in result["rule_results"])


def test_cors_allows_only_configured_vite_origin(client: TestClient) -> None:
    allowed = client.options(
        "/api/assess",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options(
        "/api/assess",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in denied.headers


def test_oversized_request_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/intake",
        content=b"x" * (65 * 1024),
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413
