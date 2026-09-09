from fastapi import APIRouter, Request

from backend.app.models import PermitSummary


router = APIRouter(prefix="/api", tags=["permits"])


@router.get("/permits", response_model=list[PermitSummary])
def permits(request: Request) -> list[PermitSummary]:
    return request.app.state.rule_engine.list_permits()


@router.get("/scenarios")
def scenarios(request: Request) -> list[dict]:
    return request.app.state.rule_engine.list_scenarios()


@router.get("/sources")
def sources(request: Request) -> list[dict]:
    return request.app.state.rule_engine.sources_data["sources"]
