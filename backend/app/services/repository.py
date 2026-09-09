import hashlib
import json
import secrets
import threading
from datetime import UTC, datetime
from typing import Any


class InMemoryRepository:
    """Local adapter; SAM uses the same service boundary with DynamoDB resources."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, dict[str, Any]] = {}
        self._assessments: dict[str, dict[str, Any]] = {}
        self._notifications: dict[tuple[str, str, str], dict[str, Any]] = {}
        self._assessment_counter = 1041
        self._notification_counter = 0

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def create_session(self) -> dict[str, Any]:
        session_id = "ses_" + secrets.token_urlsafe(12)
        token = secrets.token_urlsafe(32)
        created_at = datetime.now(UTC)
        with self._lock:
            self._sessions[session_id] = {
                "token_hash": self._token_hash(token),
                "created_at": created_at,
                "context_fingerprint": None,
                "assessment_ids": [],
            }
        return {"session_id": session_id, "session_token": token, "created_at": created_at}

    def authorise(self, session_id: str, token: str | None) -> dict[str, Any]:
        session = self._sessions.get(session_id)
        if not session or not token:
            raise PermissionError("Session access denied")
        supplied = self._token_hash(token)
        if not secrets.compare_digest(session["token_hash"], supplied):
            raise PermissionError("Session access denied")
        return session

    def update_context(
        self, session_id: str, token: str | None, context: dict[str, Any]
    ) -> list[str]:
        session = self.authorise(session_id, token)
        fingerprint = hashlib.sha256(
            json.dumps(context, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        invalidated: list[str] = []
        with self._lock:
            previous = session["context_fingerprint"]
            if previous and previous != fingerprint:
                for assessment_id in session["assessment_ids"]:
                    record = self._assessments[assessment_id]
                    if record["response"].get("result_valid", True):
                        record["response"]["result_valid"] = False
                        invalidated.append(assessment_id)
            session["context_fingerprint"] = fingerprint
        return invalidated

    def save_assessment(
        self,
        session_id: str,
        token: str | None,
        response: dict[str, Any],
    ) -> dict[str, Any]:
        session = self.authorise(session_id, token)
        with self._lock:
            self._assessment_counter += 1
            assessment_id = f"DEMO-{self._assessment_counter}"
            saved = {**response, "assessment_id": assessment_id, "result_valid": True}
            self._assessments[assessment_id] = {
                "session_id": session_id,
                "response": saved,
            }
            session["assessment_ids"].append(assessment_id)
        return saved

    def get_assessment(
        self, assessment_id: str, token: str | None
    ) -> dict[str, Any]:
        record = self._assessments.get(assessment_id)
        if not record:
            raise KeyError("Assessment not found")
        self.authorise(record["session_id"], token)
        return dict(record["response"])

    def notification_for_key(
        self, session_id: str, assessment_id: str, idempotency_key: str
    ) -> dict[str, Any] | None:
        existing = self._notifications.get(
            (session_id, assessment_id, idempotency_key)
        )
        return dict(existing) if existing else None

    def save_notification(
        self,
        session_id: str,
        assessment_id: str,
        idempotency_key: str,
        notification: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock:
            self._notification_counter += 1
            notification_id = f"note_{self._notification_counter:04d}"
            saved = {**notification, "notification_id": notification_id}
            self._notifications[(session_id, assessment_id, idempotency_key)] = saved
        return saved

    def notification_count(self, session_id: str, assessment_id: str) -> int:
        return sum(
            1
            for key in self._notifications
            if key[0] == session_id and key[1] == assessment_id
        )
