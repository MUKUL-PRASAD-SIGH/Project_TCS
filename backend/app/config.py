import os
from dataclasses import dataclass


def _as_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().casefold() in {"1", "true", "yes", "on"}


def _csv(name: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(name, "").split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    app_mode: str = "local"
    aws_region: str = "ap-south-1"
    bedrock_model_id: str = ""
    rules_bucket: str = ""
    dynamodb_table: str = ""
    state_machine_arn: str = ""
    sns_demo_email_topic_arn: str = ""
    sns_demo_email_recipient: str = "demo@example.com"
    notifications_dry_run: bool = True
    sms_test_allowlist: tuple[str, ...] = ()
    frontend_origin: str = "http://localhost:5173"
    amazon_location_places_enabled: bool = False
    map_style_url: str = "https://demotiles.maplibre.org/style.json"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_mode=os.getenv("APP_MODE", "local"),
            aws_region=os.getenv("AWS_REGION", "ap-south-1"),
            bedrock_model_id=os.getenv("BEDROCK_MODEL_ID", ""),
            rules_bucket=os.getenv("RULES_BUCKET", ""),
            dynamodb_table=os.getenv("DYNAMODB_TABLE", ""),
            state_machine_arn=os.getenv("STATE_MACHINE_ARN", ""),
            sns_demo_email_topic_arn=os.getenv("SNS_DEMO_EMAIL_TOPIC_ARN", ""),
            sns_demo_email_recipient=os.getenv(
                "SNS_DEMO_EMAIL_RECIPIENT", "demo@example.com"
            ),
            notifications_dry_run=_as_bool("NOTIFICATIONS_DRY_RUN", True),
            sms_test_allowlist=_csv("SMS_TEST_ALLOWLIST"),
            frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
            amazon_location_places_enabled=_as_bool(
                "AMAZON_LOCATION_PLACES_ENABLED", False
            ),
            map_style_url=os.getenv(
                "MAP_STYLE_URL", "https://demotiles.maplibre.org/style.json"
            ),
        )
