from copy import deepcopy
from datetime import date

from backend.app.models import AssessmentRequest
from backend.app.services import RuleEngine
from backend.tests.conftest import (
    DEMO_LOCATION,
    assessment_payload,
    passing_event_answers,
)


def event_rule_set(engine: RuleEngine) -> dict:
    return deepcopy(engine.rules_data["rule_sets"][0])


def test_empty_rule_set_never_means_eligible(engine: RuleEngine) -> None:
    rule_set = event_rule_set(engine)
    rule_set["rules"] = []
    result = engine.evaluate_rule_set(
        permit_type="temporary_event",
        jurisdiction_id="in-ka-bengaluru-demo",
        rule_set=rule_set,
        answers=passing_event_answers(),
        relevant_date=date(2026, 9, 9),
    )
    assert result.overall_status.value == "NEEDS_VERIFICATION"
    assert result.rule_results == []


def test_future_only_rule_bundle_requires_verification(engine: RuleEngine) -> None:
    rule_set = event_rule_set(engine)
    for rule in rule_set["rules"]:
        rule["effective_from"] = "2027-01-01"
    result = engine.evaluate_rule_set(
        permit_type="temporary_event",
        jurisdiction_id="in-ka-bengaluru-demo",
        rule_set=rule_set,
        answers=passing_event_answers(),
        relevant_date=date(2026, 9, 9),
    )
    assert result.overall_status.value == "NEEDS_VERIFICATION"


def test_expired_only_rule_bundle_requires_verification(engine: RuleEngine) -> None:
    rule_set = event_rule_set(engine)
    for rule in rule_set["rules"]:
        rule["effective_to"] = "2025-12-31"
    result = engine.evaluate_rule_set(
        permit_type="temporary_event",
        jurisdiction_id="in-ka-bengaluru-demo",
        rule_set=rule_set,
        answers=passing_event_answers(),
        relevant_date=date(2026, 9, 9),
    )
    assert result.overall_status.value == "NEEDS_VERIFICATION"


def test_unreviewed_effective_rule_prevents_eligible_result(engine: RuleEngine) -> None:
    rule_set = event_rule_set(engine)
    rule_set["rules"][0]["review_status"] = "CANDIDATE"
    result = engine.evaluate_rule_set(
        permit_type="temporary_event",
        jurisdiction_id="in-ka-bengaluru-demo",
        rule_set=rule_set,
        answers=passing_event_answers(),
        relevant_date=date(2026, 9, 9),
    )
    assert result.overall_status.value == "NEEDS_VERIFICATION"
    assert not result.rule_results


def test_unapproved_bundle_requires_verification(engine: RuleEngine) -> None:
    engine.rules_data["rule_sets"][0]["approval"]["status"] = "DRAFT"
    request = AssessmentRequest.model_validate(
        assessment_payload("temporary_event", passing_event_answers())
    )
    assert engine.assess(request).overall_status.value == "NEEDS_VERIFICATION"


def test_or_condition_true_when_one_branch_true(engine: RuleEngine) -> None:
    expression = {
        "any": [
            {"field": "a", "operator": "equals", "value": True},
            {"field": "b", "operator": "equals", "value": True},
        ]
    }
    assert engine._evaluate_expression(expression, {"a": False, "b": True}) is True


def test_or_condition_unknown_when_no_true_branch(engine: RuleEngine) -> None:
    expression = {
        "any": [
            {"field": "a", "operator": "equals", "value": True},
            {"field": "b", "operator": "equals", "value": True},
        ]
    }
    assert engine._evaluate_expression(expression, {"a": False}) is None


def test_and_condition_short_circuits_known_false(engine: RuleEngine) -> None:
    expression = {
        "all": [
            {"field": "a", "operator": "equals", "value": True},
            {"field": "b", "operator": "equals", "value": True},
        ]
    }
    assert engine._evaluate_expression(expression, {"a": False}) is False


def test_configured_exception_produces_not_applicable(engine: RuleEngine) -> None:
    rule_set = event_rule_set(engine)
    rule_set["rules"] = [rule_set["rules"][0]]
    rule_set["rules"][0]["exceptions"] = [
        {"field": "charitable", "operator": "equals", "value": True}
    ]
    rule_set["rules"][0]["required_fields"].append("charitable")
    result = engine.evaluate_rule_set(
        permit_type="temporary_event",
        jurisdiction_id="in-ka-bengaluru-demo",
        rule_set=rule_set,
        answers={"event_duration_days": 2, "charitable": True},
        relevant_date=date(2026, 9, 9),
    )
    assert result.rule_results[0].status.value == "NOT_APPLICABLE"


def test_rule_bundle_and_inputs_are_pinned_for_reproduction(engine: RuleEngine) -> None:
    request = AssessmentRequest.model_validate(
        assessment_payload("temporary_event", passing_event_answers())
    )
    result = engine.assess(request)
    assert result.rule_version == "temporary-event-synthetic-2026.09.1"
    assert result.input_snapshot["answers"] == passing_event_answers()
    assert result.relevant_date == date(2026, 9, 9)
    assert all(item.rule_version == result.rule_version for item in result.rule_results)


def test_documents_are_explicitly_self_reported(engine: RuleEngine) -> None:
    request = AssessmentRequest.model_validate(
        assessment_payload("temporary_event", passing_event_answers())
    )
    result = engine.assess(request)
    assert result.documents
    assert all(document.self_reported for document in result.documents)
    assert {document.status for document in result.documents} == {
        "HAVE_SELF_REPORTED",
        "NOT_APPLICABLE",
    }


def test_authority_confirmation_is_separate_from_city(engine: RuleEngine) -> None:
    unconfirmed = {**DEMO_LOCATION, "authority_confirmed": False}
    request = AssessmentRequest.model_validate(
        assessment_payload(
            "temporary_event", passing_event_answers(), location=unconfirmed
        )
    )
    assert engine.assess(request).overall_status.value == "NEEDS_VERIFICATION"
