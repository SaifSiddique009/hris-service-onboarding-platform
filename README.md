# PeopleDesk: Service Requests & Employee Onboarding

An internal platform for a 100-person company working across Bangladesh, Malaysia, Sri Lanka and Cyprus. It replaces two things that were being run over email and spreadsheets:

- **Service requests.** Employees ask for IT equipment, software access, HR help or facilities work. Requests are routed, tracked through a fixed lifecycle and resolved by the right team.
- **Employee onboarding.** HR builds reusable checklists. Each new hire gets a personal copy with real dates and named owners, and HR and managers can see who is behind.

Both modules share one login, one set of roles and one dashboard. An AI assistant lets HR Admin ask questions about the live data in plain English.

| | |
|---|---|
| **Live app** | https://hris-platform-nine.vercel.app |
| **Live API** | https://hris-platform-api.onrender.com/api/v1 (interactive docs at [`/docs`](https://hris-platform-api.onrender.com/docs)) |
| **Design** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Debugging log** | [DEBUG_LOG.md](DEBUG_LOG.md) |

> The API runs on a free instance that sleeps when idle. The first sign-in after a quiet period can take up to a minute while it wakes; after that it is fast.

## Sign in

The database is seeded on first start, so there is nothing to create. Every seeded account uses the password **`Welcome@2026`**.

| Role | Email | Who this is | What to look at |
|---|---|---|---|
| HR Admin | `nadia.rahman@northbridge.example` | Head of People & Culture | Dashboard, all requests with filters, every onboarding checklist, templates, People, Assistant |
| Manager | `lim.wei.jie@northbridge.example` | Engineering Manager with 8 direct reports, one of them a new hire | "My team" requests, Team onboarding for the new hire, tasks assigned to him as line manager |
| Manager (resolving team) | `imran.hossain@northbridge.example` | Head of IT | "Department queue" of IT requests from every team, and "My tasks": IT onboarding tasks across new hires, one of them blocked |
| Employee | `lee.xin.yi@northbridge.example` | QA Engineer who joined recently | Own requests only, and "My onboarding" with overdue and blocked tasks |
| Employee | `jubayer.faruk@northbridge.example` | Marketing employee | Own requests, including a confidential HR query his manager cannot see |

Any of the 100 seeded people can sign in the same way: `first.last@northbridge.example`.

### Things worth trying

- **Access control.** Open a request as HR Admin, copy its URL, then sign in as an employee who is not involved and paste it. It shows "not found", the same as a request that does not exist.
- **Request lifecycle.** As `lim.wei.jie`, open a Submitted request from "My team" and assign it. Sign in as the assignee to start and resolve it, then as the requester to close or reopen it. Each page shows only the buttons that person is allowed to use.
- **Confidential requests.** `jubayer.faruk` has an HR query. His manager `sadia.chowdhury@northbridge.example` does not see it under "My team".
- **Dependencies.** As `imran.hossain`, complete "Issue laptop and peripherals" in "My tasks". The task that was Blocked behind it becomes available at once.
- **Assistant.** As HR Admin, ask "Which new hires are still waiting on IT equipment?" or "How many IT Equipment requests are unresolved in Cyprus?". Each answer shows the query that was run and the rows it returned.

## What is in the platform

**Service requests**
- Five categories and four priorities; lifecycle Submitted, Assigned, In Progress, Resolved, Closed.
- Each action has a rule for who may take it: a manager or HR Admin assigns, only the assignee starts and resolves, the requester confirms or reopens.
- A request can also end early: withdrawn by the requester or rejected with a reason. Closed requests record why they closed.
- Comment threads, a full status history, and an assignment history.
- Views: my requests, assigned to me, my team, my department's queue, and (HR Admin) all, filterable by status, category, priority and country.

**Onboarding**
- Templates with tasks that have an owning department or the line manager, a relative deadline ("Day 1", "Week 1", "Day 30") and an optional dependency.
- Assigning a template to a new hire copies it into a personal checklist with real due dates and a named owner per task.
- Task owners see their tasks across all new hires. A task is shown Blocked until the task it waits for is completed, and Overdue once its date has passed in the new hire's own country.
- Progress per new hire: done, pending, overdue, blocked.

**Shared**
- Email and password sign-in, three roles, and scopes enforced on the server for every list and every record.
- HR Admin dashboard: headcount by country and department, open requests by status and category, onboarding progress, and a cross-module view of new hires who are still waiting on a service request.
- People directory with filters, adding an employee, and deactivating an account.

**AI assistant** (the "Smart Query Assistant" option)
- The model never writes SQL. It chooses from six typed, read-only queries, the same functions that feed the dashboard, so "open" or "overdue" means the same thing in both places.
- Only the fields needed are sent to the model. Emails, descriptions and comments never are, and titles of confidential requests are withheld.
- Questions outside the data are declined. The rows behind every answer are shown next to it.
- It uses Groq's free tier (8,000 tokens per minute and 1,000 requests per day for each model). The backend moves to a second model when the first is rate limited; if both are, it says so and asks you to retry in a minute.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts (hosted on Vercel) |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 (hosted on Render) |
| Database | PostgreSQL (hosted on Neon) |
| AI | Groq chat completions with tool calling |
| Tests | pytest against PostgreSQL: 111 tests |

The reasons for these choices, the data model, every endpoint, the access rules and both state machines are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it locally

You need Python 3.11+, Node 22+ and PostgreSQL 14+.

### 1. Database

```bash
createdb hris_dev
createdb hris_test   # only needed to run the tests
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then edit the values below
alembic upgrade head               # create the tables
python -m app.seed                 # load the demo data
uvicorn app.main:app --reload      # http://localhost:8000/docs
```

`backend/.env`:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL address, for example `postgresql://postgres:password@localhost:5432/hris_dev` |
| `JWT_SECRET` | Any long random string; signs the login tokens |
| `CORS_ORIGINS` | Comma-separated frontend origins, `http://localhost:5173` for local work |
| `GROQ_API_KEY` | A key from https://console.groq.com. Without it everything works except the Assistant |
| `GROQ_MODEL` | Models to use, in order of preference |

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env               # VITE_API_URL=http://localhost:8000/api/v1
npm run dev                        # http://localhost:5173
```

### Seed data

`python -m app.seed` loads the data once and does nothing if the database already has users. `python -m app.seed --reset` wipes everything and loads it again.

The script is in [backend/app/seed](backend/app/seed). It uses a fixed random seed, so every run produces the same people and requests, while dates are relative to the day it runs so "overdue" stays meaningful. Requests and onboarding tasks are moved through their states by the same service functions the API uses, so the seeded history is real history.

| Data | Seeded |
|---|---|
| Employees | 100: Bangladesh 40, Malaysia 25, Sri Lanka 20, Cyprus 15; 7 departments; 3 HR Admins, 13 Managers, 84 Employees; active, on probation and on notice |
| Service requests | 37 across all 5 categories, 5 statuses and 4 priorities; 9 with comment threads; some withdrawn, rejected and reopened |
| Onboarding | 2 templates of 11 tasks; 8 new hires (2 per country) who joined in the last 60 days, with completed, in-progress, not-started, overdue and blocked tasks |

### Tests and checks

```bash
cd backend
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/hris_test pytest -q
ruff check . && ruff format --check .

cd ../frontend
npm run build && npm run lint
```

The tests run against PostgreSQL because the rules depend on enum types, check constraints, row locks and time zones. They cover every access scope per role, every state-machine action from allowed and disallowed statuses, the derived Blocked and Overdue states, a two-connection test of the checklist lock, a check that the migrations produce exactly the schema the models describe, and the seed data itself.

## Project layout

```
backend/
  app/
    core/            config, database session, security, auth and role dependencies,
                     state machine helper, errors
    modules/
      auth/          login, logout, current user
      users/         directory, departments, countries
      requests/      categories, requests, assignments, comments
      onboarding/    templates, checklists, tasks
      dashboard/     reports across both modules
      assistant/     LLM client, tool catalogue, query endpoint
    seed/            seed script
  alembic/           migrations
  tests/
frontend/
  src/
    api/             typed API client and types
    features/        one folder per domain, mirroring the backend modules
    components/      shared UI
    lib/             formatting helpers
```
