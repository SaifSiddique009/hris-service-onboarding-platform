import random
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.modules.onboarding import service
from app.modules.onboarding.models import OnboardingChecklist, TaskStatus
from app.modules.onboarding.schemas import TaskUpdate, TemplateTaskCreate
from app.modules.users.models import Department, User, UserRole

HR, IT, OPS, COMPLIANCE = "People & Culture", "IT", "Operations", "Compliance"
MANAGER = "LINE_MANAGER"

# (key, title, description, owner, deadline unit, deadline value, key of the task it waits for)
COMMON_START = [
    ("contract", "Sign employment contract and submit documents",
     "Collect the signed contract, ID copy, tax form and bank details.", HR, "DAY", 1, None),
    ("account", "Create email and directory account",
     "Create the mailbox and directory account and send the first sign-in details.",
     IT, "DAY", 1, None),
    ("welcome", "Welcome meeting and team introduction",
     "Walk through the team's work, introduce the team and agree the first week's plan.",
     MANAGER, "DAY", 1, None),
    ("laptop", "Issue laptop and peripherals",
     "Image the laptop, enrol it in device management and hand it over with a charger and "
     "headset.", IT, "DAY", 2, "account"),
    ("access_card", "Issue office access card",
     "Register the new hire at the front desk and issue an access card for their office.",
     OPS, "DAY", 2, None),
]  # fmt: skip
COMMON_END = [
    ("security_training", "Complete information security training",
     "Assign the security awareness course and confirm the pass mark.",
     COMPLIANCE, "WEEK", 1, "account"),
    ("payroll", "Enrol in payroll and benefits",
     "Add the new hire to payroll and enrol them in the health and pension plans.",
     HR, "WEEK", 1, "contract"),
    ("goals", "Agree 30-day goals",
     "Agree three to five goals for the first 30 days and record them.", MANAGER, "WEEK", 2, None),
    ("conduct", "Acknowledge code of conduct and data protection policy",
     "Confirm the signed acknowledgement of both policies is on file.",
     COMPLIANCE, "WEEK", 2, "security_training"),
    ("checkin", "30-day check-in",
     "Review the 30-day goals, give feedback and note any support needed.",
     MANAGER, "DAY", 30, "goals"),
]  # fmt: skip
TEMPLATES = {
    "Engineering Onboarding": (
        "For engineers and designers. Includes source control and development tools.",
        [
            *COMMON_START,
            ("dev_tools", "Grant access to source control and development tools",
             "Add to the GitHub organisation, the CI system and the team's cloud project.",
             IT, "DAY", 3, "laptop"),
            *COMMON_END,
        ],
    ),
    "General Onboarding": (
        "For all other departments. Includes the business applications for the role.",
        [
            *COMMON_START,
            ("business_apps", "Grant access to business applications",
             "Add to the shared drives and the applications the department uses.",
             IT, "DAY", 3, "laptop"),
            *COMMON_END,
        ],
    ),
}  # fmt: skip

# Tasks that are deliberately behind, keyed by days since the hire joined.
BEHIND = {
    47: {"checkin": TaskStatus.NOT_STARTED},
    35: {"checkin": TaskStatus.IN_PROGRESS},
    29: {"access_card": TaskStatus.IN_PROGRESS},
    18: {"security_training": TaskStatus.NOT_STARTED, "goals": TaskStatus.IN_PROGRESS},
    12: {"laptop": TaskStatus.IN_PROGRESS},
}


def seed_onboarding(db: Session, users: dict[str, User], today: date, rng: random.Random) -> int:
    admin = users["Nadia Rahman"]
    departments = {d.name: d for d in db.query(Department)}
    keys_by_title = {}
    templates = {}
    for name, (description, tasks) in TEMPLATES.items():
        template = service.create_template(db, admin, name, description)
        ids = {}
        for key, title, text, owner, unit, value, waits_for in tasks:
            data = TemplateTaskCreate(
                title=title,
                description=text,
                owner_kind=MANAGER if owner == MANAGER else "DEPARTMENT",
                owner_department_id=None if owner == MANAGER else departments[owner].id,
                deadline_unit=unit,
                deadline_value=value,
                depends_on_task_id=ids.get(waits_for),
            )
            ids[key] = service.add_template_task(db, template.id, data).id
            keys_by_title[title] = key
        templates[name] = template

    people = list(users.values())
    it_staff = [u for u in people if u.department.name == IT and u.role == UserRole.EMPLOYEE]
    hr_partners = [users["Tan Mei Ling"], users["Dilani Fernando"]]
    new_hires = sorted(
        (u for u in people if (today - u.joining_date).days < 60), key=lambda u: u.joining_date
    )
    now = datetime.now(UTC)

    def moment(day: date) -> datetime:
        value = datetime.combine(day, time(rng.randint(3, 9), rng.randint(0, 59)), UTC)
        return min(value, now - timedelta(hours=1))

    for index, hire in enumerate(new_hires):
        engineering = hire.department.name == "Engineering"
        template = templates["Engineering Onboarding" if engineering else "General Onboarding"]
        checklist, _ = service.assign_checklist(db, admin, hire.id, template.id, None)
        behind = BEHIND.get((today - hire.joining_date).days, {})

        # Department heads hand some of their tasks to their team.
        for task in checklist.tasks:
            delegate = None
            if task.assignee_id == departments[IT].head_id and index % 2 == 0:
                delegate = it_staff[(index + task.sort_order) % len(it_staff)]
            elif task.assignee_id == admin.id and index % 3:
                delegate = hr_partners[index % 2]
            if delegate:
                service.update_task(db, admin, task.id, TaskUpdate(assignee_id=delegate.id))

        done = set()
        for task in checklist.tasks:
            key = keys_by_title[task.title]
            target = behind.get(key)
            if target is None:
                target = TaskStatus.COMPLETED if task.due_date < today else TaskStatus.NOT_STARTED
            waiting = task.depends_on_task_id and task.depends_on_task_id not in done
            if target == TaskStatus.NOT_STARTED or waiting:
                continue
            service.transition(db, task.assignee, task.id, "start")
            if target == TaskStatus.COMPLETED:
                service.transition(db, task.assignee, task.id, "complete")
                done.add(task.id)

        _backdate(db, checklist, moment)
    db.commit()
    return len(new_hires)


def _backdate(db: Session, checklist: OnboardingChecklist, moment) -> None:
    """Give the checklist's history real-looking times around each task's due date."""
    db.refresh(checklist)
    created = moment(checklist.start_date - timedelta(days=4))
    checklist.created_at = created
    finished = {}
    for task in checklist.tasks:
        started = moment(max(checklist.start_date, task.due_date - timedelta(days=1)))
        # Work on a task never begins before the task it waits for was completed.
        waited_for = finished.get(task.depends_on_task_id)
        if waited_for:
            started = max(started, waited_for + timedelta(minutes=25))
        completed = max(started, moment(task.due_date)) + timedelta(minutes=40)
        if task.completed_at:
            finished[task.id] = completed
        if task.started_at:
            task.started_at = started
        if task.completed_at:
            task.completed_at = completed
        for event in task.history:
            if event.note:
                event.created_at = created + timedelta(hours=2)
            elif event.to_status == TaskStatus.IN_PROGRESS:
                event.created_at = started
            elif event.to_status == TaskStatus.COMPLETED:
                event.created_at = completed
            else:
                event.created_at = created
