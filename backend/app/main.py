from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.modules.auth.router import router as auth_router
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


@api.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


api.include_router(auth_router)
api.include_router(users_router)
app.include_router(api)
