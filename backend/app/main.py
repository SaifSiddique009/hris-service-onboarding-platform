from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.modules.assistant.router import router as assistant_router
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.onboarding.router import router as onboarding_router
from app.modules.requests.router import router as requests_router
from app.modules.users.router import router as users_router

app = FastAPI(title="Service Request & Onboarding Platform")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

api = APIRouter(prefix="/api/v1")


# HEAD as well as GET: uptime monitors check with HEAD.
@api.api_route("/health", methods=["GET", "HEAD"], tags=["health"])
def health():
    return {"status": "ok"}


api.include_router(auth_router)
api.include_router(users_router)
api.include_router(requests_router)
api.include_router(onboarding_router)
api.include_router(dashboard_router)
api.include_router(assistant_router)
app.include_router(api)
