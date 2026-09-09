import json

import pytest

from backend.app.models import AssessmentRequest
from backend.app.services import RuleEngine
from backend.tests.conftest import assessment_payload


with (RuleEngine().data_dir / "test_cases.json").open(encoding="utf-8") as file:
    CASE_DATA = json.load(file)


@pytest.mark.parametrize("case", CASE_DATA["cases"], ids=lambda case: case["id"])
def test_independently_specified_synthetic_case(
    engine: RuleEngine, case: dict
) -> None:
    request = AssessmentRequest.model_validate(
        assessment_payload(
            case["permit_type"],
            case["answers"],
            location=case.get("location", CASE_DATA["location_defaults"]),
            contradictions=case.get("contradictions"),
        )
    )
    result = engine.assess(request)
    assert result.overall_status.value == case["expected_status"]
    if "expected_counts" in case:
        assert result.counts.model_dump() == case["expected_counts"]


def test_case_catalogue_has_at_least_twenty_cases() -> None:
    assert len(CASE_DATA["cases"]) >= 20
    assert len({case["id"] for case in CASE_DATA["cases"]}) == len(CASE_DATA["cases"])
