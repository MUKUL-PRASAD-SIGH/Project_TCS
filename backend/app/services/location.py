import json
from pathlib import Path
from typing import Any, Callable

from backend.app.config import Settings
from backend.app.models import PlaceResult, PlaceSearchResponse, ResolveLocationResponse


class LocationService:
    def __init__(
        self,
        settings: Settings,
        data_dir: Path,
        places_client_factory: Callable[[], Any] | None = None,
    ) -> None:
        self.settings = settings
        self.data_dir = data_dir
        self._places_client_factory = places_client_factory
        self.venues = self._load("demo_venues.json")["venues"]

    def _load(self, name: str) -> dict[str, Any]:
        with (self.data_dir / name).open(encoding="utf-8") as file:
            return json.load(file)

    def catalogue(self) -> dict[str, Any]:
        return {
            "administrative_directory": self._load("administrative_directory.json")["entities"],
            "jurisdictions": self._load("authorities.json")["jurisdictions"],
            "boundary_metadata": self._load("boundaries.json")["metadata"],
            "map_style_url": self.settings.map_style_url,
        }

    def search(self, query: str) -> PlaceSearchResponse:
        if self.settings.amazon_location_places_enabled:
            try:
                return self._amazon_search(query)
            except Exception:
                return self._local_search(
                    query,
                    "Amazon Location is unavailable; showing synthetic demo venues.",
                )
        return self._local_search(
            query,
            "Amazon Location is not configured; showing synthetic demo venues.",
        )

    def _local_search(self, query: str, message: str) -> PlaceSearchResponse:
        normalised = query.strip().casefold()
        matches = [
            venue
            for venue in self.venues
            if not normalised or normalised in venue["label"].casefold()
        ]
        return PlaceSearchResponse(
            provider="local_synthetic",
            provider_available=False,
            results=[
                PlaceResult(
                    **venue,
                    provider="local_synthetic",
                    result_is_jurisdiction_proof=False,
                )
                for venue in matches[:5]
            ],
            message=message,
        )

    def _amazon_search(self, query: str) -> PlaceSearchResponse:
        client = (
            self._places_client_factory()
            if self._places_client_factory
            else self._default_places_client()
        )
        response = client.search_text(
            QueryText=query,
            MaxResults=5,
            BiasPosition=[77.5946, 12.9716],
            Filter={"IncludeCountries": ["IND"]},
            Language="en",
            IntendedUse="SingleUse",
        )
        results: list[PlaceResult] = []
        for item in response.get("ResultItems", []):
            position = item.get("Position") or item.get("Place", {}).get("Position")
            if not position or len(position) < 2:
                continue
            results.append(
                PlaceResult(
                    id=item.get("PlaceId", item.get("Title", "place")),
                    label=item.get("Title", item.get("Address", {}).get("Label", "Place")),
                    longitude=position[0],
                    latitude=position[1],
                    provider="amazon_location",
                    result_is_jurisdiction_proof=False,
                )
            )
        return PlaceSearchResponse(
            provider="amazon_location",
            provider_available=True,
            results=results,
            message="Place results require separate authority confirmation.",
        )

    def _default_places_client(self) -> Any:
        import boto3
        from botocore.config import Config

        return boto3.client(
            "geo-places",
            region_name=self.settings.aws_region,
            config=Config(connect_timeout=3, read_timeout=8, retries={"max_attempts": 2}),
        )

    @staticmethod
    def resolve() -> ResolveLocationResponse:
        return ResolveLocationResponse(
            coverage="BOUNDARY_NEEDS_CONFIRMATION",
            authority_id=None,
            authority_name=None,
            boundary_status="NO_VERIFIED_LOCAL_BOUNDARY_BUNDLED",
            requires_user_confirmation=True,
            message=(
                "The venue pin cannot establish jurisdiction. Confirm the demo authority "
                "from the reviewed coverage mapping."
            ),
        )
