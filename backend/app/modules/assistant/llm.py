import httpx

from app.core.config import settings
from app.core.errors import AppError

URL = "https://api.groq.com/openai/v1/chat/completions"


class AiUnavailable(AppError):
    status, code = 503, "AI_UNAVAILABLE"


def chat(messages: list[dict], tools: list[dict]) -> dict:
    """One round with the model. Returns its message, which may ask for tool calls."""
    if not settings.groq_api_key:
        raise AiUnavailable("The assistant is not configured.")
    body = {"messages": messages, "temperature": 0}
    if tools:
        body |= {"tools": tools, "tool_choice": "auto"}
    # Rate limits are per model, so a limited model hands over to the next one in the list.
    for model in settings.groq_model.split(","):
        try:
            response = httpx.post(
                URL,
                json=body | {"model": model.strip()},
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                timeout=40,
            )
        except httpx.HTTPError:
            raise AiUnavailable("The assistant could not be reached. Please try again.") from None
        if response.status_code != 429:
            break
    if response.status_code == 429:
        raise AiUnavailable("The assistant is busy. Please try again in a minute.")
    if response.status_code >= 400:
        raise AiUnavailable("The assistant could not answer just now. Please try again.")
    return response.json()["choices"][0]["message"]
