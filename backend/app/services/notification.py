import re
from datetime import UTC, datetime
from typing import Any, Callable

from backend.app.config import Settings
from backend.app.models import (
    NotificationChannel,
    NotificationRequest,
    NotificationResponse,
    NotificationStatus,
)
from backend.app.services.repository import InMemoryRepository


class NotificationError(ValueError):
    pass


class NotificationService:
    def __init__(
        self,
        settings: Settings,
        repository: InMemoryRepository,
        sns_client_factory: Callable[[], Any] | None = None,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self._sns_client_factory = sns_client_factory

    def send(
        self,
        assessment_id: str,
        session_id: str,
        token: str | None,
        request: NotificationRequest,
    ) -> NotificationResponse:
        assessment = self.repository.get_assessment(assessment_id, token)
        if not assessment.get("result_valid", False):
            raise NotificationError("Reassess before sending an invalidated result.")
        if not request.consent:
            raise NotificationError("Explicit consent is required for this message.")

        existing = self.repository.notification_for_key(
            session_id, assessment_id, request.idempotency_key
        )
        if existing:
            return NotificationResponse.model_validate({**existing, "duplicate": True})
        if self.repository.notification_count(session_id, assessment_id) >= 3:
            raise NotificationError("Notification rate limit reached for this assessment.")

        self._validate_destination(request.channel, request.destination)
        created_at = datetime.now(UTC)
        masked = self._mask(request.channel, request.destination)
        message = (
            f"PermitAI: assessment {assessment_id} is ready. Open PermitAI to view "
            "requirements and next steps. This is not permit approval."
        )
        status = NotificationStatus.DRY_RUN
        provider_message_id: str | None = None
        status_message = "Dry run recorded; no message was sent."
        if not self.settings.notifications_dry_run:
            try:
                provider_message_id = self._publish(
                    request.channel, request.destination, message
                )
                status = NotificationStatus.ACCEPTED_BY_PROVIDER
                status_message = (
                    "SNS accepted the publish request; this is not delivery confirmation."
                )
            except Exception:
                status = NotificationStatus.FAILED
                status_message = "The provider request failed; the assessment remains saved."

        saved = self.repository.save_notification(
            session_id,
            assessment_id,
            request.idempotency_key,
            {
                "assessment_id": assessment_id,
                "channel": request.channel,
                "status": status,
                "masked_destination": masked,
                "provider_message_id": provider_message_id,
                "duplicate": False,
                "created_at": created_at,
                "message": status_message,
            },
        )
        return NotificationResponse.model_validate(saved)

    def _validate_destination(
        self, channel: NotificationChannel, destination: str
    ) -> None:
        if channel == NotificationChannel.EMAIL:
            if destination.casefold() != self.settings.sns_demo_email_recipient.casefold():
                raise NotificationError(
                    "Email demo can send only to the configured confirmed inbox."
                )
            if not self.settings.notifications_dry_run and not self.settings.sns_demo_email_topic_arn:
                raise NotificationError("The SNS email topic is not configured.")
            return
        if not re.fullmatch(r"\+[1-9]\d{7,14}", destination):
            raise NotificationError("SMS destination must use E.164 format.")
        if destination not in self.settings.sms_test_allowlist:
            raise NotificationError("SMS destination is not in the verified test allowlist.")

    def _publish(
        self, channel: NotificationChannel, destination: str, message: str
    ) -> str:
        client = (
            self._sns_client_factory()
            if self._sns_client_factory
            else self._default_sns_client()
        )
        if channel == NotificationChannel.EMAIL:
            response = client.publish(
                TopicArn=self.settings.sns_demo_email_topic_arn,
                Subject="PermitAI assessment ready",
                Message=message,
            )
        else:
            response = client.publish(
                PhoneNumber=destination,
                Message=message,
                MessageAttributes={
                    "AWS.SNS.SMS.SMSType": {
                        "DataType": "String",
                        "StringValue": "Transactional",
                    }
                },
            )
        return str(response["MessageId"])

    def _default_sns_client(self) -> Any:
        import boto3
        from botocore.config import Config

        return boto3.client(
            "sns",
            region_name=self.settings.aws_region,
            config=Config(connect_timeout=3, read_timeout=8, retries={"max_attempts": 2}),
        )

    @staticmethod
    def _mask(channel: NotificationChannel, destination: str) -> str:
        if channel == NotificationChannel.EMAIL:
            local, _, domain = destination.partition("@")
            return f"{local[:1]}***@{domain}"
        return f"{destination[:3]}******{destination[-2:]}"
