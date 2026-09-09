import json
from collections import Counter
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from backend.app.models import (
    AssessmentCounts,
    AssessmentRequest,
    AssessmentResponse,
    Completeness,
    DocumentResult,
    OverallStatus,
    PermitSummary,
    Question,
    QuestionsResponse,
    RuleEvidence,
    RuleResult,
    RuleStatus,
)


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
MISSING = object()
APPROVED_REVIEW_STATUS = "REVIEWED_FOR_SYNTHETIC_DEMO"
APPROVED_BUNDLE_STATUS = "APPROVED_FOR_DEMO"


class RuleEngine:
    """Safe deterministic evaluator for reviewed, versioned JSON expressions."""

    def __init__(self, data_dir: Path = DEFAULT_DATA_DIR) -> None:
        self.data_dir = data_dir
        self.authorities_data = self._load_json("authorities.json")
        self.permits_data = self._load_json("permits.json")
        self.rules_data = self._load_json("rules.json")
        self.sources_data = self._load_json("source_register.json")

    def _load_json(self, filename: str) -> dict[str, Any]:
        path = self.data_dir / filename
        try:
            with path.open(encoding="utf-8") as file:
                return json.load(file)
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Unable to load rule data from {path}: {exc}") from exc

    @property
    def dataset_version(self) -> str:
        return str(self.rules_data.get("version", "UNVERSIONED"))

    def list_permits(self) -> list[PermitSummary]:
        versions = {
            (item["jurisdiction_id"], item["permit_type"]): item.get(
                "version", self.dataset_version
            )
            for item in self.rules_data.get("rule_sets", [])
        }
        permits: list[PermitSummary] = []
        for permit in self.permits_data.get("permits", []):
            rule_version = next(
                (
                    versions[(jurisdiction_id, permit["id"])]
                    for jurisdiction_id in permit["jurisdiction_ids"]
                    if (jurisdiction_id, permit["id"]) in versions
                ),
                self.dataset_version,
            )
            permits.append(
                PermitSummary(
                    id=permit["id"],
                    name=permit["name"],
                    description=permit["description"],
                    jurisdiction_ids=permit["jurisdiction_ids"],
                    rule_version=rule_version,
                )
            )
        return permits

    def list_scenarios(self) -> list[dict[str, Any]]:
        scenarios = self._load_json("scenarios.json")["scenarios"]
        venues = {
            venue["id"]: venue
            for venue in self._load_json("demo_venues.json")["venues"]
        }
        return [
            {**scenario, "venue": venues.get(scenario["venue_id"])}
            for scenario in scenarios
        ]

    def get_questions(
        self, permit_type: str, answers: dict[str, Any]
    ) -> QuestionsResponse:
        questions = self.get_question_catalog(permit_type)
        if not questions:
            return QuestionsResponse(
                permit_type=permit_type, questions=[], remaining_fields=[]
            )
        applicable: list[Question] = []
        for question in questions:
            if question.show_when is None:
                applicable.append(question)
                continue
            visibility = self._evaluate_expression(question.show_when, answers)
            if visibility is True:
                applicable.append(question)
        remaining = [
            item.field
            for item in applicable
            if self._answer(answers, item.field) is MISSING
            or self._answer(answers, item.field) == "unknown"
        ]
        return QuestionsResponse(
            permit_type=permit_type,
            questions=applicable,
            remaining_fields=remaining,
        )

    def get_question_catalog(self, permit_type: str) -> list[Question]:
        """Return configured question metadata in its authoritative order."""
        permit = self._permit(permit_type)
        if permit is None:
            return []
        return [Question.model_validate(item) for item in permit.get("questions", [])]

    def preflight(
        self,
        permit_type: str,
        jurisdiction_id: str,
        answers: dict[str, Any],
        relevant_date: date | None = None,
    ) -> tuple[str, str, list[str]]:
        """Fail-closed gate used before model-originated facts reach evaluation."""
        permit = self._permit(permit_type, jurisdiction_id)
        if permit is None:
            return (
                "UNSUPPORTED",
                "Verified rules are not currently available for this permit or jurisdiction.",
                [],
            )
        rule_set = self._rule_set(jurisdiction_id, permit_type)
        if not rule_set or not rule_set.get("rules"):
            return (
                "NEEDS_VERIFICATION",
                "I don't have a reviewed rule set for this permit yet.",
                [],
            )
        if rule_set.get("approval", {}).get("status") != APPROVED_BUNDLE_STATUS:
            return (
                "NEEDS_VERIFICATION",
                "A rule set exists, but it is not approved for automated assessment.",
                [],
            )
        selected_date = relevant_date or date.today()
        active_rules = [
            rule for rule in rule_set["rules"] if self._active(rule, selected_date)
        ]
        if not active_rules or any(
            rule.get("review_status") != APPROVED_REVIEW_STATUS
            for rule in active_rules
        ):
            return (
                "NEEDS_VERIFICATION",
                "A rule set exists, but it is not currently effective and sufficiently reviewed.",
                [],
            )
        questions = self.get_questions(permit_type, answers)
        if questions.remaining_fields:
            labels = {
                question.field: question.label for question in questions.questions
            }
            missing = [labels.get(field, field) for field in questions.remaining_fields]
            return (
                "MORE_INFORMATION_NEEDED",
                "I need a few more details before I can assess your eligibility: "
                + "; ".join(missing)
                + ".",
                questions.remaining_fields,
            )
        return "SUPPORTED", "Deterministic assessment is allowed.", []

    def assess(self, request: AssessmentRequest) -> AssessmentResponse:
        jurisdiction = self._find_jurisdiction(request.location.model_dump())
        if jurisdiction is None:
            return self._empty_response(
                request,
                OverallStatus.UNSUPPORTED,
                "The supplied location is outside the supported demo jurisdiction.",
            )

        jurisdiction_id = str(jurisdiction["id"])
        permit = self._permit(request.permit_type, jurisdiction_id)
        if permit is None:
            return self._empty_response(
                request,
                OverallStatus.UNSUPPORTED,
                "The permit type is not supported in this demo jurisdiction.",
                jurisdiction_id,
            )

        if (
            not request.location.authority_confirmed
            or request.location.authority is None
        ):
            return self._empty_response(
                request,
                OverallStatus.NEEDS_VERIFICATION,
                "Confirm the displayed local authority before assessment.",
                jurisdiction_id,
            )

        rule_set = self._rule_set(jurisdiction_id, request.permit_type)
        if rule_set is None:
            return self._empty_response(
                request,
                OverallStatus.NEEDS_VERIFICATION,
                "No rule set is configured; manual verification is required.",
                jurisdiction_id,
            )
        if rule_set.get("approval", {}).get("status") != APPROVED_BUNDLE_STATUS:
            return self._empty_response(
                request,
                OverallStatus.NEEDS_VERIFICATION,
                "The configured rule bundle is not approved for this demo.",
                jurisdiction_id,
                str(rule_set.get("version", self.dataset_version)),
            )

        return self.evaluate_rule_set(
            permit_type=request.permit_type,
            jurisdiction_id=jurisdiction_id,
            rule_set=rule_set,
            answers=request.applicant.answers,
            contradictions=request.applicant.contradictions,
            relevant_date=request.relevant_date,
            input_snapshot=self._input_snapshot(request),
        )

    def evaluate_rule_set(
        self,
        *,
        permit_type: str,
        jurisdiction_id: str,
        rule_set: dict[str, Any],
        answers: dict[str, Any],
        contradictions: list[str] | None = None,
        relevant_date: date | None = None,
        input_snapshot: dict[str, Any] | None = None,
    ) -> AssessmentResponse:
        assessed_date = relevant_date or date.today()
        version = str(rule_set.get("version", self.dataset_version))
        all_rules = rule_set.get("rules", [])
        snapshot = input_snapshot or {
            "answers": answers,
            "contradictions": contradictions or [],
            "relevant_date": assessed_date.isoformat(),
        }
        if not all_rules:
            return self._manual_response(
                permit_type,
                jurisdiction_id,
                version,
                assessed_date,
                snapshot,
                "The rule set is empty; manual verification is required.",
            )

        active_rules = [rule for rule in all_rules if self._active(rule, assessed_date)]
        if not active_rules:
            return self._manual_response(
                permit_type,
                jurisdiction_id,
                version,
                assessed_date,
                snapshot,
                "No reviewed rule version is effective on the selected date.",
            )
        if any(rule.get("review_status") != APPROVED_REVIEW_STATUS for rule in active_rules):
            return self._manual_response(
                permit_type,
                jurisdiction_id,
                version,
                assessed_date,
                snapshot,
                "One or more effective rules have not been reviewed for the synthetic demo.",
            )

        contradiction_set = set(contradictions or [])
        results = [
            self._evaluate_rule(rule, answers, contradiction_set, version)
            for rule in active_rules
        ]
        overall_status, message = self._aggregate(results)
        completeness = self._completeness(active_rules, answers, contradiction_set)
        counts = self._counts(results)
        documents = self._documents(active_rules, results)
        return AssessmentResponse(
            permit_type=permit_type,
            jurisdiction_id=jurisdiction_id,
            overall_status=overall_status,
            rule_version=version,
            relevant_date=assessed_date,
            assessed_at=datetime.now(UTC),
            rule_results=results,
            counts=counts,
            completeness=completeness,
            documents=documents,
            next_steps=self._next_steps(results, documents, completeness),
            input_snapshot=snapshot,
            message=message,
        )

    def _evaluate_rule(
        self,
        rule: dict[str, Any],
        answers: dict[str, Any],
        contradictions: set[str],
        bundle_version: str,
    ) -> RuleResult:
        involved_fields = set(rule.get("required_fields", []))
        if involved_fields & contradictions:
            return self._rule_result(
                rule,
                RuleStatus.UNKNOWN,
                bundle_version,
                "Contradictory applicant answers must be resolved.",
                answers,
            )

        applicability = self._evaluate_expression(
            rule.get("applicability_condition", {"all": []}), answers
        )
        if applicability is None:
            return self._rule_result(
                rule,
                RuleStatus.UNKNOWN,
                bundle_version,
                "More information is needed to determine whether this rule applies.",
                answers,
            )
        if not applicability:
            return self._rule_result(
                rule,
                RuleStatus.NOT_APPLICABLE,
                bundle_version,
                "The condition that activates this requirement is not met.",
                answers,
            )

        exception_states = [
            self._evaluate_expression(exception, answers)
            for exception in rule.get("exceptions", [])
        ]
        if any(state is True for state in exception_states):
            return self._rule_result(
                rule,
                RuleStatus.NOT_APPLICABLE,
                bundle_version,
                "A configured exception applies.",
                answers,
            )
        if any(state is None for state in exception_states):
            return self._rule_result(
                rule,
                RuleStatus.UNKNOWN,
                bundle_version,
                "More information is needed to determine whether an exception applies.",
                answers,
            )

        passed = self._evaluate_expression(rule["requirement"], answers)
        if passed is None:
            status = RuleStatus.UNKNOWN
            message = "The requirement cannot be evaluated from the supplied information."
        elif passed:
            status = RuleStatus.PASS
            message = "Requirement met using self-reported information."
        else:
            status = RuleStatus.FAIL
            message = "Requirement not met."
        return self._rule_result(rule, status, bundle_version, message, answers)

    def _evaluate_expression(
        self, expression: dict[str, Any], answers: dict[str, Any]
    ) -> bool | None:
        if "all" in expression:
            states = [self._evaluate_expression(item, answers) for item in expression["all"]]
            if any(state is False for state in states):
                return False
            if any(state is None for state in states):
                return None
            return True
        if "any" in expression:
            states = [self._evaluate_expression(item, answers) for item in expression["any"]]
            if any(state is True for state in states):
                return True
            if any(state is None for state in states):
                return None
            return False
        if "not" in expression:
            state = self._evaluate_expression(expression["not"], answers)
            return None if state is None else not state

        field = expression.get("field")
        operator = expression.get("operator")
        if not isinstance(field, str):
            return None
        actual = self._answer(answers, field)
        if operator == "is_provided":
            return actual is not MISSING and actual is not None and actual != "unknown"
        if actual is MISSING or actual is None or actual == "unknown":
            return None
        return self._compare(actual, operator, expression.get("value"))

    @staticmethod
    def _compare(actual: Any, operator: str | None, expected: Any) -> bool | None:
        if operator == "equals":
            return actual == expected and type(actual) is type(expected)
        if operator == "not_equals":
            return actual != expected or type(actual) is not type(expected)
        if operator in {"gt", "gte", "lt", "lte", "minimum", "maximum"}:
            if isinstance(actual, bool) or not isinstance(actual, (int, float)):
                return None
            if isinstance(expected, bool) or not isinstance(expected, (int, float)):
                return None
            comparisons = {
                "gt": actual > expected,
                "gte": actual >= expected,
                "minimum": actual >= expected,
                "lt": actual < expected,
                "lte": actual <= expected,
                "maximum": actual <= expected,
            }
            return comparisons[operator]
        if operator == "in":
            return actual in expected if isinstance(expected, list) else None
        if operator == "contains":
            return expected in actual if isinstance(actual, (list, str)) else None
        return None

    def _rule_result(
        self,
        rule: dict[str, Any],
        status: RuleStatus,
        bundle_version: str,
        message: str,
        answers: dict[str, Any],
    ) -> RuleResult:
        requirement = rule["requirement"]
        return RuleResult(
            rule_id=rule["rule_id"],
            description=rule["description"],
            requirement_type=rule.get("requirement_type", "eligibility"),
            status=status,
            actual_value=self._expression_values(requirement, answers),
            expected=requirement,
            message=message,
            rule_version=bundle_version,
            evidence=RuleEvidence(
                source_id=rule["source_id"],
                source_section=rule["source_section"],
                review_status=rule["review_status"],
                data_classification=rule["data_classification"],
                last_reviewed_at=date.fromisoformat(rule["last_reviewed_at"]),
                effective_from=date.fromisoformat(rule["effective_from"]),
                effective_to=(
                    date.fromisoformat(rule["effective_to"])
                    if rule.get("effective_to")
                    else None
                ),
            ),
        )

    def _expression_values(
        self, expression: dict[str, Any], answers: dict[str, Any]
    ) -> Any:
        fields = self._expression_fields(expression)
        values = {
            field: self._answer(answers, field)
            for field in fields
            if self._answer(answers, field) is not MISSING
        }
        if len(fields) == 1:
            return values.get(next(iter(fields)))
        return values or None

    def _completeness(
        self,
        rules: list[dict[str, Any]],
        answers: dict[str, Any],
        contradictions: set[str],
    ) -> Completeness:
        required: set[str] = set()
        for rule in rules:
            applicability_expression = rule.get("applicability_condition", {"all": []})
            applicability_fields = self._expression_fields(applicability_expression)
            required.update(applicability_fields)
            applicability = self._evaluate_expression(applicability_expression, answers)
            if applicability is True:
                required.update(rule.get("required_fields", []))
                for exception in rule.get("exceptions", []):
                    required.update(self._expression_fields(exception))
        unanswered = sorted(
            field
            for field in required
            if self._answer(answers, field) is MISSING
            or self._answer(answers, field) is None
            or self._answer(answers, field) == "unknown"
        )
        contradictory = sorted(required & contradictions)
        answered = len(required) - len(set(unanswered) | set(contradictory))
        return Completeness(
            required_fields=len(required),
            answered_fields=max(answered, 0),
            unanswered_fields=unanswered,
            contradictory_fields=contradictory,
            is_complete=not unanswered and not contradictory,
        )

    @staticmethod
    def _counts(results: list[RuleResult]) -> AssessmentCounts:
        counts = Counter(result.status for result in results)
        return AssessmentCounts(
            passed=counts[RuleStatus.PASS],
            failed=counts[RuleStatus.FAIL],
            unknown=counts[RuleStatus.UNKNOWN],
            not_applicable=counts[RuleStatus.NOT_APPLICABLE],
        )

    @staticmethod
    def _documents(
        rules: list[dict[str, Any]], results: list[RuleResult]
    ) -> list[DocumentResult]:
        by_id = {result.rule_id: result for result in results}
        status_map = {
            RuleStatus.PASS: "HAVE_SELF_REPORTED",
            RuleStatus.FAIL: "MISSING",
            RuleStatus.UNKNOWN: "UNKNOWN",
            RuleStatus.NOT_APPLICABLE: "NOT_APPLICABLE",
        }
        documents: list[DocumentResult] = []
        for rule in rules:
            document = rule.get("document")
            result = by_id.get(rule["rule_id"])
            if document and result:
                documents.append(
                    DocumentResult(
                        document_id=document["id"],
                        name=document["name"],
                        status=status_map[result.status],
                        rule_id=rule["rule_id"],
                    )
                )
        return documents

    @staticmethod
    def _next_steps(
        results: list[RuleResult],
        documents: list[DocumentResult],
        completeness: Completeness,
    ) -> list[str]:
        steps: list[str] = []
        missing_documents = [item.name for item in documents if item.status == "MISSING"]
        if missing_documents:
            steps.append("Prepare missing self-reported documents: " + ", ".join(missing_documents) + ".")
        if completeness.unanswered_fields:
            steps.append("Answer the remaining questions before relying on this pre-check.")
        if completeness.contradictory_fields:
            steps.append("Resolve contradictory answers and run the assessment again.")
        if any(item.status == RuleStatus.FAIL for item in results):
            steps.append("Review each failed synthetic requirement and update the plan if appropriate.")
        steps.append("Verify current requirements with the relevant authority before applying.")
        return steps

    @staticmethod
    def _aggregate(results: list[RuleResult]) -> tuple[OverallStatus, str]:
        if not results:
            return OverallStatus.NEEDS_VERIFICATION, "Manual verification is required."
        statuses = {result.status for result in results}
        if RuleStatus.FAIL in statuses:
            suffix = " Unanswered checks remain." if RuleStatus.UNKNOWN in statuses else ""
            return (
                OverallStatus.REQUIREMENTS_NOT_MET,
                "One or more assessed requirements failed." + suffix,
            )
        if RuleStatus.UNKNOWN in statuses:
            return OverallStatus.MORE_INFORMATION_NEEDED, "More applicant information is required."
        if statuses == {RuleStatus.NOT_APPLICABLE}:
            return OverallStatus.NEEDS_VERIFICATION, "No configured rule was applicable."
        return (
            OverallStatus.MEETS_ASSESSED_REQUIREMENTS,
            "All applicable configured requirements were met.",
        )

    @staticmethod
    def _active(rule: dict[str, Any], relevant_date: date) -> bool:
        try:
            effective_from = date.fromisoformat(rule["effective_from"])
            effective_to = (
                date.fromisoformat(rule["effective_to"])
                if rule.get("effective_to")
                else None
            )
        except (KeyError, TypeError, ValueError):
            return False
        return effective_from <= relevant_date and (
            effective_to is None or relevant_date <= effective_to
        )

    def _find_jurisdiction(self, location: dict[str, Any]) -> dict[str, Any] | None:
        for jurisdiction in self.authorities_data.get("jurisdictions", []):
            if not self._matches_location_part(location["country"], jurisdiction["country"]):
                continue
            if not self._matches_location_part(location["state"], jurisdiction["state"]):
                continue
            city_names = [jurisdiction["city"]["name"], *jurisdiction["city"].get("aliases", [])]
            if self._normalise(location["city"]) not in map(self._normalise, city_names):
                continue
            requested_authority = location.get("authority")
            if requested_authority:
                authority_names = [
                    jurisdiction["authority"]["id"],
                    jurisdiction["authority"]["name"],
                ]
                if self._normalise(requested_authority) not in map(
                    self._normalise, authority_names
                ):
                    continue
            return jurisdiction
        return None

    def _permit(
        self, permit_type: str, jurisdiction_id: str | None = None
    ) -> dict[str, Any] | None:
        return next(
            (
                item
                for item in self.permits_data.get("permits", [])
                if item.get("id") == permit_type
                and (
                    jurisdiction_id is None
                    or jurisdiction_id in item.get("jurisdiction_ids", [])
                )
            ),
            None,
        )

    def _rule_set(
        self, jurisdiction_id: str, permit_type: str
    ) -> dict[str, Any] | None:
        return next(
            (
                item
                for item in self.rules_data.get("rule_sets", [])
                if item.get("jurisdiction_id") == jurisdiction_id
                and item.get("permit_type") == permit_type
            ),
            None,
        )

    @staticmethod
    def _answer(answers: dict[str, Any], field: str) -> Any:
        current: Any = answers
        for part in field.split("."):
            if not isinstance(current, dict) or part not in current:
                return MISSING
            current = current[part]
        return current

    @staticmethod
    def _expression_fields(expression: dict[str, Any]) -> set[str]:
        if "field" in expression and isinstance(expression["field"], str):
            return {expression["field"]}
        fields: set[str] = set()
        for key in ("all", "any"):
            for child in expression.get(key, []):
                fields.update(RuleEngine._expression_fields(child))
        if "not" in expression:
            fields.update(RuleEngine._expression_fields(expression["not"]))
        return fields

    @staticmethod
    def _normalise(value: Any) -> str:
        return str(value).strip().casefold()

    def _matches_location_part(self, supplied: str, configured: dict[str, str]) -> bool:
        return self._normalise(supplied) in {
            self._normalise(configured["code"]),
            self._normalise(configured["name"]),
        }

    @staticmethod
    def _input_snapshot(request: AssessmentRequest) -> dict[str, Any]:
        return {
            "location": request.location.model_dump(mode="json"),
            "permit_type": request.permit_type,
            "answers": request.applicant.answers,
            "contradictions": request.applicant.contradictions,
            "evidence": request.applicant.evidence,
            "relevant_date": request.relevant_date.isoformat(),
        }

    def _empty_response(
        self,
        request: AssessmentRequest,
        status: OverallStatus,
        message: str,
        jurisdiction_id: str | None = None,
        version: str | None = None,
    ) -> AssessmentResponse:
        return self._manual_response(
            request.permit_type,
            jurisdiction_id,
            version or self.dataset_version,
            request.relevant_date,
            self._input_snapshot(request),
            message,
            status,
        )

    @staticmethod
    def _manual_response(
        permit_type: str,
        jurisdiction_id: str | None,
        version: str,
        relevant_date: date,
        input_snapshot: dict[str, Any],
        message: str,
        status: OverallStatus = OverallStatus.NEEDS_VERIFICATION,
    ) -> AssessmentResponse:
        return AssessmentResponse(
            permit_type=permit_type,
            jurisdiction_id=jurisdiction_id,
            overall_status=status,
            rule_version=version,
            relevant_date=relevant_date,
            assessed_at=datetime.now(UTC),
            rule_results=[],
            counts=AssessmentCounts(),
            completeness=Completeness(),
            input_snapshot=input_snapshot,
            next_steps=["Confirm coverage and current requirements with the relevant authority."],
            message=message,
        )
