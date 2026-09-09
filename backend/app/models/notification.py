from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class NotificationChannel(str, Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"


class NotificationStatus(str, Enum):
    REQUESTED = "REQUESTED"
    ACCEPTED_BY_PROVIDER = "ACCEPTED_BY_PROVIDER"
    DELIVERY_CONFIRMED = "DELIVERY_CONFIRMED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"
    DRY_RUN = "DRY_RUN"


class NotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: NotificationChannel
    destination: str = Field(min_length=3, max_length=254)
    consent: bool
    idempotency_key: str = Field(min_length=8, max_length=100)


class NotificationResponse(BaseModel):
    notification_id: str
    assessment_id: str
    channel: NotificationChannel
    status: NotificationStatus
    masked_destination: str
    provider_message_id: str | None = None
    duplicate: bool = False
    created_at: datetime
    message: str


class CapabilitiesResponse(BaseModel):
    app_mode: str
    bedrock: dict[str, object]
    places: dict[str, object]
    notifications: dict[str, object]
    workflow: dict[str, object]
