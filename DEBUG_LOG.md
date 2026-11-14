# Debugging log

The three most significant bugs found while building the platform, in the order they appeared. Each one passed silently at first: no exception reached a user, and the existing tests were green. A short list of the other bugs is at the end.

---

## Bug 1: Timestamps were stored and returned without a time zone

**Layer:** database schema, surfaced in the frontend.

### Symptom

While the request screens were being built against the local API, every timestamp came back like this:

```
"created_at": "2026-11-14T18:47:19.492093"
```

There is no `Z` and no offset. A browser reads such a value as local time. The frontend code had worked around it by appending `Z` before parsing, on the assumption that the API "sends UTC without a suffix".

For a user this would have meant that every "created", "resolved" and comment time was shifted by their distance from UTC: six hours in Dhaka, eight in Kuala Lumpur. A request raised five minutes ago could show as raised this afternoon.

### Investigation

**The assumption already in the code.** The frontend workaround rested on a belief: the values are UTC and only the suffix is missing, so this is a formatting detail of the API. The design document supported that, since it says all timestamps are `timestamptz` stored in UTC.

**What did not fit.** The sample value read 18:47. I was looking at it at about 12:48 UTC, which is 18:48 in Dhaka. A UTC value should not match my wall clock. That pointed away from formatting and towards the stored data, so I checked the data before touching the serialiser.

**Check 1: compare the API with the database for the same row.**

```
API:   2026-11-14T18:47:19.492093
SQL:   select created_at from service_requests where id = 1;
       2026-11-14 18:47:19.492093
```

The same naive value is in the database. Nothing is being dropped on the way out, so this is not a formatting problem in the API.

**Check 2: is the stored value even UTC?**

```
select now(), now() at time zone 'utc';
2026-11-14 18:48:13+06   |   2026-11-14 12:48:13
```

The stored value (18:47) is Dhaka wall-clock time, not UTC (12:47). The "it is UTC" assumption was wrong too, and the workaround was off by six hours on this machine.

**Check 3: what type are the columns?**

```
select data_type, count(*) from information_schema.columns
where table_schema = 'public' and data_type like 'timestamp%' group by 1;

timestamp without time zone | 16
```

All sixteen timestamp columns had the wrong type. `show timezone` on the local server returned `Asia/Dhaka`.

**Check 4: where did the type come from?** The generated migration had `sa.Column('created_at', sa.DateTime(), ...)`, and the models declared `created_at: Mapped[datetime]`.

### Root cause

In SQLAlchemy 2 a bare `Mapped[datetime]` maps to `DateTime()`, which PostgreSQL creates as `TIMESTAMP WITHOUT TIME ZONE`. Nothing in the models asked for `timezone=True`, the migration generator copied the type faithfully, and I did not read the generated column types against the data model in the design.

With a naive column, both `now()` and a timezone-aware Python value are converted to the wall clock of the database session and the zone is discarded. So the same column meant different things in different places: Dhaka time on the local server, UTC on the hosted database, whose sessions run in UTC.

That is also why it stayed hidden. Every test compared values inside one database session, so they were consistent with each other. In production the "append Z" workaround would have produced correct times by accident, while the schema contradicted the design document.

A second defect surfaced during this investigation. When I generated the migration for the fix, the tool also proposed creating a foreign key I had not touched:

```python
op.create_foreign_key('fk_departments_head_id_users', 'departments', 'users', ['head_id'], ['id'])
```

My suspicion was that the first migration had never created it. `pg_constraint` for the `departments` table confirmed that: only the primary key and the unique name were there. The first migration had declared this foreign key with `use_alter=True` (needed because `departments` and `users` point at each other), and it had never actually been created. A department could have pointed at a head who did not exist. The tests had not noticed because they built their schema with `create_all()`, which does issue that statement, so the tests were validating a schema that production did not have.

### Fix

One line on the declarative base, so every `datetime` column is timezone-aware:

```diff
 class Base(DeclarativeBase):
+    # Without this a bare Mapped[datetime] becomes TIMESTAMP WITHOUT TIME ZONE.
+    type_annotation_map = {datetime: DateTime(timezone=True)}
```

A second migration that converts the sixteen columns and adds the missing foreign key:

```python
op.alter_column('service_requests', 'created_at',
                existing_type=postgresql.TIMESTAMP(),
                type_=sa.DateTime(timezone=True), ...)
# ... fifteen more columns ...
op.create_foreign_key('fk_departments_head_id_users', 'departments', 'users', ['head_id'], ['id'])
```

The conversion has no `USING ... AT TIME ZONE` clause on purpose. A plain cast reads each naive value in the session's time zone, which is the zone the value was written in on that server, so the instants come out right both locally and on the hosted database. Forcing `'UTC'` would have been correct in production and six hours wrong locally.

The frontend workaround was removed, since the API now sends an offset:

```diff
-// The API sends UTC timestamps without a zone suffix.
-const parse = (iso: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
-export const formatDateTime = (iso: string) => dateTimeFmt.format(parse(iso))
+export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))
```

### Prevention

- **A test that the migrations build the schema the models describe.** It creates an empty database, runs every migration, and asks Alembic to diff the result against the models. Run against the database as it was after the first migration only, it reports 17 differences (16 column types and 1 foreign key). After the fix it reports none. This closes the gap between the schema the tests use and the schema production gets.
- **A test that fails if any `DateTime` column in the models is not timezone-aware.**
- **Reading generated migrations against the data model** before committing them, treating the generator's output as a draft.
- A working rule that came out of this: a client-side workaround for odd server data is a bug report, and the server gets fixed.

---

## Bug 2: Copied onboarding checklists silently lost every dependency

**Layer:** ORM and business logic.

### Symptom

The onboarding seed finished and reported success:

```
Seeded 100 employees, 37 service requests, 8 onboardings.
```

with one warning in the middle of the output:

```
SAWarning: Object of type <OnboardingTask> not in session, add operation along
'OnboardingChecklist.tasks' will not proceed
  db.flush()
```

No error, and the checklists looked complete. What a user would have seen is checklists in which nothing is ever Blocked: "Grant access to source control" could be started before the laptop it depends on had been issued. The dependency rule, one of the core requirements, would have been quietly absent for every new hire.

### Investigation

I recognised the warning as SQLAlchemy 2.0's change to how new objects join a session. What I did not know was how much damage it had done. **The first worry was that the copied tasks had never been saved** and the checklists were empty.

**Check 1:**

```
select count(*) from onboarding_checklists;   -- 8
select count(*) from onboarding_tasks;        -- 88
```

The tasks were saved, so that was not it. But a flush that skipped them should have left a trace somewhere.

**Check 2: are the dependencies there?** Each template has six tasks that wait for another, so 48 dependencies were expected.

```
select count(*) filter (where depends_on_task_id is not null) from onboarding_tasks;   -- 0
```

All 48 were missing.

**Check 3: read the function in the order it runs.** `assign_checklist` did this:

1. Build each copy with `OnboardingTask(checklist=checklist, ...)`.
2. `db.flush()` to obtain the new ids.
3. Set `task.depends_on_task_id = copies[source.depends_on_task_id].id`.
4. Add a history row for each task, then commit.

If step 2 did not insert the tasks, the ids in step 3 would be `None`.

**Check 4: confirm it in isolation.** A short experiment in a transaction that was rolled back afterwards, printing the state after each step:

```
task in session after setting task.checklist:   False
after flush:          task id = None | rows in database: 0
task in session after adding its history row:   True
after second flush:   task id = 89   | rows in database: 1
```

Setting the relationship does not put the task in the session, the first flush inserts nothing, and it is the history row that later drags the task in.

### Root cause

In SQLAlchemy 2.0, setting `task.checklist = checklist` on a new object no longer places that object in the session. That behaviour, cascading through a back-reference, was removed in 2.0. So at the `flush()` the copied tasks were not in the session, were not inserted, and had `id = None`. The next line copied `None` into every `depends_on_task_id`.

The tasks did get saved moments later, but through a side door: `db.add(OnboardingTaskEvent(task=task))` cascades from the history row to its task. By then the dependency had already been set to nothing.

Nothing stopped it, for three reasons. A `NULL` dependency is valid data. The seed's own check, "has the task I wait for been completed?", passed trivially because there was no task to wait for. And the warning that described the problem exactly was only a warning.

### Fix

```diff
+    # Setting task.checklist does not add the task to the session; without this the ids are None.
+    db.add_all(copies.values())
     db.flush()
     for source in template.tasks:
         task = copies[source.id]
         if source.depends_on_task_id:
             task.depends_on_task_id = copies[source.depends_on_task_id].id
```

After the fix: `48` dependencies across `88` tasks, and four tasks correctly shown as Blocked.

### Prevention

- **ORM warnings now fail the test run:** `filterwarnings = ["error::sqlalchemy.exc.SAWarning"]` in the pytest configuration. This warning would have stopped the build.
- **A test for the behaviour:** assigning a checklist must make each copied task wait for the copy of the right task in the same checklist, and the dependent task must be reported Blocked.
- **The seed test asserts the mix it is meant to produce,** including at least two Blocked tasks and at least five dependencies per checklist, so a seed that "succeeds" with the interesting states missing fails.
- The composite foreign key `(depends_on_task_id, checklist_id)` already prevents a wrong dependency. It cannot prevent a missing one, which is why the behaviour needs a test.

---

## Bug 3: The AI assistant answered a few questions, then failed every one

**Layer:** AI integration.

### Symptom

Against the real model, the first seven questions were answered correctly in about four seconds each. I checked two of them against SQL, and "1 IT Equipment request unresolved in Cyprus" and the probation count for each department both matched exactly. Then:

```
POST /api/v1/ai/query  ->  503
{"error": {"code": "AI_UNAVAILABLE",
           "message": "The assistant is busy. Please try again in a minute."}}
```

for every following question. The error handling worked as designed and the rest of the platform was unaffected, but anyone trying five or six questions in a row would have seen the feature stop working.

### Investigation

The failures came after a burst of questions, and every call carries the full tool schemas, so I suspected a per-minute limit from the start. What I did not know was which limit, how large it was, or what it was counted against. The other candidate was the free tier's daily request quota, since the test runs had also called the API. The provider's response headers could settle both.

**Check 1: read the rate-limit headers on a minimal call.**

```
x-ratelimit-limit-requests:      1000      (per day)
x-ratelimit-limit-tokens:        8000      (per minute)
x-ratelimit-remaining-tokens:    3705
x-ratelimit-reset-tokens:        32.2s
```

The daily request quota was nowhere near reached, which ruled that out. The limit being hit was tokens per minute, and it was small.

**Check 2: what does one question cost?** I measured what was being sent. The tool schemas alone were 5,759 characters of JSON, included in every call, and each question makes two calls: one in which the model chooses a query and one in which it writes the answer. Thousands of tokens per question against a budget of 8,000 per minute leaves room for only a few questions.

**Check 3: is the limit per account or per model?** The same minimal call to two other models on the account:

```
openai/gpt-oss-120b   remaining tokens 3705
openai/gpt-oss-20b    remaining tokens 7922
qwen/qwen3.8-27b      remaining tokens 7981
```

Each model has its own budget. This was the part I had not expected, and it shaped the fix.

### Root cause

Two things, neither of them a crash.

The request was much heavier than it needed to be. The schemas were generated straight from the Pydantic argument models, and that output repeats a `title` for every field and wraps every optional field in `anyOf: [{...}, {"type": "null"}]`. The model needs neither.

And the client treated the first `429` as final, although two other models with untouched budgets were available on the same key.

### Fix

The model setting became an ordered list, and a rate-limited model hands over to the next:

```diff
-    groq_model: str = "openai/gpt-oss-120b"
+    # Tried in order; the next one is used when a model is rate limited.
+    groq_model: str = "openai/gpt-oss-120b,openai/gpt-oss-20b"
```

```diff
+    # Rate limits are per model, so a limited model hands over to the next one in the list.
+    for model in settings.groq_model.split(","):
+        try:
+            response = httpx.post(URL, json=body | {"model": model.strip()}, ...)
+        except httpx.HTTPError:
+            raise AiUnavailable("The assistant could not be reached. Please try again.") from None
+        if response.status_code != 429:
+            break
     if response.status_code == 429:
         raise AiUnavailable("The assistant is busy. Please try again in a minute.")
```

The schemas are trimmed before they are sent:

```python
def _compact(schema):
    """Drop what the model does not need: titles, and the null half of optional fields."""
    if isinstance(schema, list):
        return [_compact(item) for item in schema]
    if not isinstance(schema, dict):
        return schema
    options = [o for o in schema.get("anyOf", []) if o != {"type": "null"}]
    if len(options) == 1:
        schema = {k: v for k, v in schema.items() if k not in ("anyOf", "default")} | options[0]
    return {key: _compact(value) for key, value in schema.items() if key != "title"}
```

Measured result: schemas went from 5,759 to 4,126 characters, and a run of eight questions in a row was answered eight out of eight.

One detail from writing the prevention test is worth recording. I first set the size limit in the test to 3,500 characters, a number I had guessed. The test failed at 4,126. The limit is now 4,500, taken from the measurement.

### Prevention

- **A test that the client falls through to the second model on a 429,** and reports "busy" only when every model is limited.
- **A test that pins the schema size,** so the payload sent on every call cannot grow unnoticed as tools are added.
- **The limits are written in the README,** so the behaviour under load is documented and not discovered.
- Every question is recorded in `ai_query_logs` with its latency and any error, which is where a recurrence would show first.
- If the assistant were used heavily, the next steps would be to cache the tool-choice step for repeated questions and to move to a paid tier; the handover only multiplies a small budget.

---

## Other bugs worth a line

- **A lock that read stale data.** Adding a template task that waits for another task was refused with "a task can only depend on a task in the same template", although both were in the same template. A small reproduction script showed why: the session's copy of the template had an empty task list while the database had the task. `SELECT ... FOR UPDATE` took the lock and handed back the object the session already held, without reloading it. In the API each request has a fresh session, so this only showed in the seed script, but a lock followed by a read of stale memory protects nothing. Every lock helper now re-reads what it locked (`populate_existing`).
- **A negative control that failed for the wrong reason.** To prove the two-connection lock test could detect a missing lock, I ran it with the lock switched off and it failed, as hoped. It had also failed with the lock on. The real cause was a one-letter task title in the test's own setup, rejected by validation before the race was ever reached. With that fixed, the test passes with the lock and fails without it, with both actions succeeding (`{'start': 'ok', 'reopen': 'ok'}`). A failing control proves nothing unless it fails for the expected reason.
- **Dashboard ran off the screen on a phone.** Measuring every screen at 375px showed the dashboard overflowing by 338px. My first fix, `min-w-0` on the chart card, changed nothing. Printing the width of each ancestor showed the card (697px) wider than its own grid (328px): below the large breakpoint the grid had no column template, so its implicit `auto` column grew to fit the chart. Declaring `grid-cols-1`, a track with a zero minimum, fixed it, and the first change was reverted.
- **Login crashed for a real account when the password was longer than 72 bytes.** Found by an independent review of the backend. bcrypt raises on input over 72 bytes, which became a 500 for an existing account and a 401 for an unknown one, so the difference revealed which emails exist. An over-long password is now simply wrong, and an unknown email is checked against a dummy hash so both paths cost the same.
- **A reply that showed the old manager.** A test written for the fix above removed a user's manager and got 200, with the previous manager still in the response. The row was right and the reply was wrong: the `manager` object had been loaded before its id changed, and the session keeps loaded objects after a commit. The update now refreshes the user before returning. Together with the stale lock above and Bug 2, this is one theme: in-memory ORM state was trusted where the database should have been re-read.
- **Python 3.12 syntax on a 3.11 runtime.** `class Page[T](BaseModel)` is a syntax error on the Python version the service is pinned to. Fixed with `Generic[T]`; the guard is running tests on the same version as production.
