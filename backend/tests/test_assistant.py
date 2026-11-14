import json

import pytest
from conftest import auth
from sqlalchemy import select

from app.modules.assistant import llm, tools
from app.modules.assistant.models import AiQueryLog
from app.modules.requests import service as requests
from app.modules.requests.models import RequestCategory
from app.modules.requests.schemas import RequestCreate

URL = "/api/v1/ai/query"


def tool_call(name, **arguments):
    call = {"id": f"call_{name}", "function": {"name": name, "arguments": json.dumps(arguments)}}
    return {"role": "assistant", "content": None, "tool_calls": [call]}


def says(text):
    return {"role": "assistant", "content": text}


@pytest.fixture
def model(monkeypatch):
    """Replaces the LLM with a script of replies and records what it was sent."""
    script, sent = [], []

    def chat(messages, tool_schemas):
        sent.append({"messages": [dict(m) for m in messages], "tools": tool_schemas})
        reply = script.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm, "chat", chat)
    return script, sent


@pytest.fixture
def ask(client, world):
    def _ask(question, user=None):
        return client.post(URL, json={"question": question}, headers=auth(user or world.admin))

    return _ask


@pytest.fixture
def some_requests(db, world):
    it = RequestCategory(name="IT Equipment", description="Hardware")
    hr = RequestCategory(name="HR Query", description="Personal", is_confidential=True)
    db.add_all([it, hr])
    db.flush()
    for category, title in ((it, "Laptop not received"), (hr, "Question about my pay")):
        body = RequestCreate(
            title=title, description="Details", category_id=category.id, priority="HIGH"
        )
        requests.create_request(db, world.it_manager, body)


def test_assistant_is_for_hr_admin_only(ask, world, model):
    assert ask("How many employees?", world.manager).status_code == 403
    assert ask("How many employees?", world.employee).status_code == 403


def test_answer_comes_from_a_tool_run_against_live_data(ask, model, some_requests, db):
    script, sent = model
    script += [
        tool_call("count_service_requests", state="unresolved", country="Cyprus"),
        says("There are 2 unresolved requests in Cyprus."),
    ]
    body = ask("How many requests are unresolved in Cyprus?").json()

    assert body["answer"] == "There are 2 unresolved requests in Cyprus."
    assert body["tools_used"] == [
        {
            "name": "count_service_requests",
            "arguments": {"state": "unresolved", "country": "Cyprus"},
            "row_count": 1,
            "rows": [{"total": 2}],
        }
    ]
    # The model was given the real figure, not asked to guess.
    tool_message = sent[1]["messages"][-1]
    assert tool_message["role"] == "tool"
    assert json.loads(tool_message["content"]) == {"total": 2}

    log = db.scalar(select(AiQueryLog))
    assert log.question == "How many requests are unresolved in Cyprus?"
    assert log.tool_calls[0]["name"] == "count_service_requests"
    assert "rows" not in log.tool_calls[0]
    assert log.error is None


def test_confidential_titles_are_never_sent_to_the_model(ask, model, some_requests):
    script, sent = model
    script += [tool_call("list_service_requests", state="open"), says("Two open requests.")]
    body = ask("List the open requests").json()

    everything_sent = json.dumps(sent)
    assert "Laptop not received" in everything_sent
    assert "Question about my pay" not in everything_sent
    titles = {row["category"]: row["title"] for row in body["tools_used"][0]["rows"]}
    assert titles == {"IT Equipment": "Laptop not received", "HR Query": None}


def test_no_personal_contact_details_reach_the_model(ask, model, world, some_requests):
    script, sent = model
    script += [tool_call("list_service_requests"), says("Done.")]
    ask("List requests")
    everything_sent = json.dumps(sent)
    assert "@example.test" not in everything_sent
    assert "Details" not in everything_sent  # request descriptions stay inside the platform


def test_bad_arguments_are_returned_to_the_model_once(ask, model, some_requests):
    script, sent = model
    script += [
        tool_call("count_service_requests", state="pending"),
        tool_call("count_service_requests", state="unresolved"),
        says("2 unresolved requests."),
    ]
    body = ask("How many requests are pending?").json()
    assert body["answer"] == "2 unresolved requests."
    correction = json.loads(sent[1]["messages"][-1]["content"])
    assert "error" in correction
    assert [use["arguments"] for use in body["tools_used"]] == [{"state": "unresolved"}]


def test_second_bad_call_ends_with_a_clear_message(ask, model):
    script, _ = model
    script += [tool_call("delete_everything"), tool_call("count_employees", colour="blue")]
    body = ask("Delete all employees").json()
    assert body["answer"].startswith("I could not work that out")
    assert body["tools_used"] == []


def test_question_outside_the_data_is_declined_without_tools(ask, model):
    script, _ = model
    script += [says("I can only answer questions about headcount, requests and onboarding.")]
    body = ask("What is the weather in Dhaka?").json()
    assert body["tools_used"] == []
    assert "only answer" in body["answer"]


def test_tool_rounds_are_capped(ask, model, some_requests):
    script, sent = model
    script += [tool_call("count_employees")] * 3 + [says("100 employees.")]
    body = ask("Keep counting").json()
    assert body["answer"] == "100 employees."
    assert len(body["tools_used"]) == 3
    # The fourth call offers no tools, so the model has to answer.
    assert len(sent) == 4
    assert sent[3]["tools"] == []


def test_provider_failure_is_a_friendly_error_and_is_logged(ask, model, db):
    script, _ = model
    script += [llm.AiUnavailable("The assistant is busy. Please try again in a minute.")]
    response = ask("How many employees?")
    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "AI_UNAVAILABLE",
        "message": "The assistant is busy. Please try again in a minute.",
        "details": {},
    }
    assert db.scalar(select(AiQueryLog)).error.startswith("The assistant is busy")


def test_question_length_is_validated(ask, model):
    assert ask("").status_code == 422
    assert ask("x" * 501).status_code == 422


def test_tool_arguments_are_strict(db):
    with pytest.raises(tools.ToolError):
        tools.run(db, "list_onboarding_tasks", json.dumps({"state": "late"}))
    with pytest.raises(tools.ToolError):
        tools.run(db, "list_service_requests", json.dumps({"limit": 500}))
    with pytest.raises(tools.ToolError):
        tools.run(db, "count_employees", "not json")


class Reply:
    def __init__(self, status_code, content="ok"):
        self.status_code = status_code
        self._content = content

    def json(self):
        return {"choices": [{"message": {"role": "assistant", "content": self._content}}]}


def test_rate_limited_model_hands_over_to_the_next_one(monkeypatch):
    tried = []

    def post(url, json, **_):
        tried.append(json["model"])
        return Reply(429) if json["model"] == "first" else Reply(200, "from the second model")

    monkeypatch.setattr(llm.settings, "groq_api_key", "key")
    monkeypatch.setattr(llm.settings, "groq_model", "first, second")
    monkeypatch.setattr(llm.httpx, "post", post)
    assert llm.chat([{"role": "user", "content": "hi"}], [])["content"] == "from the second model"
    assert tried == ["first", "second"]

    monkeypatch.setattr(llm.httpx, "post", lambda url, json, **_: Reply(429))
    with pytest.raises(llm.AiUnavailable, match="busy"):
        llm.chat([{"role": "user", "content": "hi"}], [])


def test_tool_schemas_stay_small():
    # Sent on every model call, against a per-minute token budget.
    size = len(json.dumps(tools.SCHEMAS))
    assert size < 4500, size
    assert '"title"' not in json.dumps(tools.SCHEMAS)
    country = tools.SCHEMAS[0]["function"]["parameters"]["properties"]["country"]
    assert country == {"description": "Country name or two-letter code", "type": "string"}
