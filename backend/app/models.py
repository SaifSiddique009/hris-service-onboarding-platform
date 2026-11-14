"""Imports every model so that metadata is complete for migrations and tests."""

from app.modules.assistant import models as assistant  # noqa: F401
from app.modules.onboarding import models as onboarding  # noqa: F401
from app.modules.requests import models as requests  # noqa: F401
from app.modules.users import models as users  # noqa: F401
