from .assess import router as assess_router
from .capabilities import router as capabilities_router
from .health import router as health_router
from .intake import router as intake_router
from .locations import router as locations_router
from .notifications import router as notifications_router
from .permits import router as permits_router
from .sessions import router as sessions_router

__all__ = [
    "assess_router",
    "capabilities_router",
    "health_router",
    "intake_router",
    "locations_router",
    "notifications_router",
    "permits_router",
    "sessions_router",
]
