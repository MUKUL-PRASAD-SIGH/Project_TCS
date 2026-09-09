from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PlaceResult(BaseModel):
    id: str
    label: str
    longitude: float
    latitude: float
    provider: str
    result_is_jurisdiction_proof: bool = False


class PlaceSearchResponse(BaseModel):
    provider: Literal["amazon_location", "local_synthetic", "unavailable"]
    provider_available: bool
    results: list[PlaceResult]
    message: str


class ResolveLocationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)


class ResolveLocationResponse(BaseModel):
    coverage: str
    authority_id: str | None
    authority_name: str | None
    boundary_status: str
    requires_user_confirmation: bool = True
    message: str


class LocationCatalogue(BaseModel):
    administrative_directory: list[dict]
    jurisdictions: list[dict]
    boundary_metadata: dict
    map_style_url: str
