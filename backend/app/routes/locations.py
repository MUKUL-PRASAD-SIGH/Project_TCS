from fastapi import APIRouter, Query, Request

from backend.app.models import (
    LocationCatalogue,
    PlaceSearchResponse,
    ResolveLocationRequest,
    ResolveLocationResponse,
)


router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=LocationCatalogue)
def locations(request: Request) -> LocationCatalogue:
    return LocationCatalogue.model_validate(request.app.state.location_service.catalogue())


@router.get("/search", response_model=PlaceSearchResponse)
def search_locations(
    request: Request,
    q: str = Query(min_length=2, max_length=200),
) -> PlaceSearchResponse:
    return request.app.state.location_service.search(q)


@router.post("/resolve", response_model=ResolveLocationResponse)
def resolve_location(
    payload: ResolveLocationRequest, request: Request
) -> ResolveLocationResponse:
    del payload
    return request.app.state.location_service.resolve()
