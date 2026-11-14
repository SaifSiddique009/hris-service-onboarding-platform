import random
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.requests import service
from app.modules.requests.models import RequestCategory, RequestStatus, ServiceRequest
from app.modules.requests.schemas import RequestCreate
from app.modules.users.models import User, UserRole

# Actions that take a request from Submitted to each seeded end state.
PATHS = {
    "SUBMITTED": [],
    "ASSIGNED": ["assign"],
    "IN_PROGRESS": ["assign", "start"],
    "REOPENED": ["assign", "start", "resolve", "reopen"],
    "RESOLVED": ["assign", "start", "resolve"],
    "CLOSED": ["assign", "start", "resolve", "close"],
    "REJECTED": ["reject"],
    "WITHDRAWN": ["withdraw"],
}
RESOLVING_DEPARTMENT = {
    "IT Equipment": "IT",
    "Software Access": "IT",
    "HR Query": "People & Culture",
    "Facilities": "Operations",
    "Other": "Operations",
}


def R(category, priority, title, description, stage, days_ago, **extra):
    return {
        "category": category,
        "priority": priority,
        "title": title,
        "description": description,
        "stage": stage,
        "days_ago": days_ago,
        **extra,
    }


# In "comments", r = requester, a = assignee, t = the person who triaged.
REQUESTS = [
    R("IT Equipment", "HIGH", "Laptop screen flickers after docking",
      "Since Monday my laptop screen flickers for a few seconds every time I connect it to the "
      "docking station. It happens with two different docks.",
      "IN_PROGRESS", 6, comments=[
          ("r", "It also happened in the meeting room today, on the HDMI cable."),
          ("a", "Thanks, that points to the graphics driver and not the dock. I am rolling the "
                "driver back this afternoon."),
          ("r", "The older driver has been stable so far. I will confirm tomorrow."),
      ]),
    R("IT Equipment", "URGENT", "Laptop will not power on",
      "My laptop shut down during a client call and does not turn on any more. There is no "
      "charging light. I have a release on Thursday.",
      "ASSIGNED", 1),
    R("IT Equipment", "MEDIUM", "Request for a second monitor",
      "I review designs side by side for most of the day. A second 24-inch monitor would help.",
      "CLOSED", 34, resolution="Monitor delivered and set up at your desk.", comments=[
          ("a", "We have 24-inch and 27-inch units in stock. Is 24 still fine?"),
          ("r", "Yes, 24 is fine. Thank you."),
      ]),
    R("IT Equipment", "LOW", "Replacement keyboard, several keys sticking",
      "The E and space keys on my laptop stick. An external keyboard would be enough.",
      "RESOLVED", 9, resolution="Left a new external keyboard at your desk. Please confirm."),
    R("IT Equipment", "HIGH", "Still on a loan laptop after my first week",
      "I joined last week and I am still using a loan laptop. It has 8 GB of memory and cannot "
      "run the local build, so I cannot finish my setup tasks.",
      "IN_PROGRESS", 5, new_hire=True, comments=[
          ("a", "Your laptop arrived from the supplier yesterday. Imaging takes about a day."),
          ("r", "Thanks. Can I collect it on Thursday morning?"),
      ]),
    R("IT Equipment", "MEDIUM", "Headset for client calls",
      "I will join client calls from next week and need a headset with a microphone.",
      "SUBMITTED", 2, new_hire=True),
    R("IT Equipment", "MEDIUM", "Docking station for the hot desk row",
      "The hot desks near the window have no docking stations, so we plug in three cables "
      "every morning.",
      "REJECTED", 20,
      reason="Duplicate of the request already raised for the whole row. Tracking it there."),
    R("IT Equipment", "HIGH", "Battery drains within an hour",
      "My laptop battery goes from full to empty in about an hour, even with only email open.",
      "CLOSED", 48, resolution="Battery replaced under warranty. Health now reads 100%."),
    R("Software Access", "HIGH", "Access to the production logs dashboard",
      "I am on call from next sprint and need read access to the production logs dashboard.",
      "IN_PROGRESS", 3, comments=[
          ("a", "Read access needs approval from the service owner. I have asked them."),
          ("r", "Understood. My on-call shift starts on Monday."),
      ]),
    R("Software Access", "MEDIUM", "Figma editor licence",
      "I have view access only. I need an editor seat to update the campaign templates.",
      "RESOLVED", 4, resolution="Editor seat assigned. You may need to sign out and back in."),
    R("Software Access", "HIGH", "GitHub organisation invite not received",
      "I have not received the invite to the GitHub organisation, so I cannot clone the "
      "repositories for my onboarding tasks.",
      "ASSIGNED", 3, new_hire=True),
    R("Software Access", "MEDIUM", "VPN account for remote work",
      "I work remotely two days a week and need a VPN account to reach the internal tools.",
      "SUBMITTED", 1, new_hire=True),
    R("Software Access", "LOW", "Upgrade my analytics seat to full access",
      "My analytics seat only allows saved reports. I need to build my own for the monthly "
      "review.",
      "SUBMITTED", 4),
    R("Software Access", "URGENT", "Locked out of email after password reset",
      "I reset my password this morning and now every device says the password is wrong. "
      "I cannot read email or join meetings.",
      "CLOSED", 15, resolution="Account unlocked and sync restored on all devices.", comments=[
          ("a", "The reset did not sync to the mail server. Fixing it now."),
          ("r", "Laptop works again. The phone still asks for the password."),
          ("a", "Remove the account on the phone and add it again. That clears the old token."),
      ]),
    R("Software Access", "MEDIUM", "Jira admin rights for the new project board",
      "I am setting up the board for the payments project and need project admin rights.",
      "CLOSED", 27, resolution="Project admin role granted on the payments board."),
    R("Software Access", "MEDIUM", "Access to the finance reporting workspace",
      "I need read access to the finance reporting workspace to prepare the quarterly numbers.",
      "ASSIGNED", 2),
    R("Software Access", "LOW", "Remove my access to the old CRM",
      "I moved teams and no longer need access to the old CRM.",
      "WITHDRAWN", 12),
    R("HR Query", "MEDIUM", "Question about carrying over annual leave",
      "I have six days of leave left this year. How many can I carry over, and until when?",
      "RESOLVED", 5,
      resolution="Up to five days carry over and must be used by 31 March. Details sent by "
                 "email."),
    R("HR Query", "HIGH", "Payslip shows the wrong tax deduction",
      "My October payslip shows a higher tax deduction than September although my salary did "
      "not change.",
      "IN_PROGRESS", 4, comments=[
          ("a", "I can see the difference. I am checking with payroll whether your tax code "
                "changed."),
          ("r", "Thank you. I did not receive any notice about a new tax code."),
      ]),
    R("HR Query", "MEDIUM", "Letter of employment for a visa application",
      "I need a letter confirming my employment and salary for a visa application. The "
      "embassy appointment is in three weeks.",
      "CLOSED", 22, resolution="Signed letter sent to your email and a paper copy left at "
                               "reception."),
    R("HR Query", "HIGH", "Concern about feedback from my manager",
      "I would like to talk to someone in confidence about how feedback was given in my last "
      "one-to-one.",
      "ASSIGNED", 2),
    R("HR Query", "LOW", "Updating my emergency contact",
      "My emergency contact has a new phone number. Where do I update it?",
      "CLOSED", 40, resolution="Updated in your record. Please check it on your profile."),
    R("HR Query", "MEDIUM", "When does my probation review happen?",
      "I would like to know when my probation review takes place and what it covers.",
      "SUBMITTED", 1, new_hire=True),
    R("HR Query", "MEDIUM", "Parental leave policy for adoptive parents",
      "We are in the process of adopting. Does the parental leave policy apply, and how much "
      "notice is needed?",
      "IN_PROGRESS", 7),
    R("Facilities", "MEDIUM", "Air conditioning too cold on the third floor",
      "The area near the east windows on the third floor is very cold in the afternoon. "
      "Several of us work in jackets.",
      "REOPENED", 10, resolution="Thermostat raised by two degrees.",
      reopen_note="It was fine for two days and is cold again since Monday.", comments=[
          ("a", "The vent above your row was stuck fully open. A technician is booked."),
          ("r", "Thank you. It is the vent right above desk 3E-14."),
      ]),
    R("Facilities", "LOW", "Desk chair armrest is broken",
      "The left armrest of my chair has come loose and no longer locks.",
      "RESOLVED", 6, resolution="Chair swapped for a new one from storage."),
    R("Facilities", "HIGH", "Access card stopped working at the main door",
      "My access card is not accepted at the main door since this morning. It still works on "
      "the lift.",
      "CLOSED", 18, resolution="Card re-encoded. The door reader had dropped your profile.",
      comments=[
          ("a", "Please bring the card to the front desk. Re-encoding takes two minutes."),
          ("r", "Done, it works again. Thanks."),
      ]),
    R("Facilities", "MEDIUM", "Meeting room display has no sound",
      "The display in the large meeting room on the second floor shows the picture but plays "
      "no sound on video calls.",
      "ASSIGNED", 3),
    R("Facilities", "LOW", "More whiteboard markers for the workshop room",
      "Most markers in the workshop room are dry. We have a planning day next week.",
      "CLOSED", 30, resolution="Two new sets placed in the workshop room cabinet."),
    R("Facilities", "URGENT", "Water leak near the server room corridor",
      "Water is dripping from the ceiling in the corridor outside the server room. I put a "
      "bin under it.",
      "CLOSED", 25, resolution="Leaking condensate pipe replaced. Ceiling tile changed.",
      comments=[
          ("a", "On my way. Please keep people away from the wet floor."),
          ("r", "The drip is getting faster. It is about two metres from the server room door."),
          ("a", "Building maintenance has shut the valve. No water reached the server room."),
      ]),
    R("Facilities", "MEDIUM", "No access card issued yet",
      "I joined recently and still sign in at reception every morning because I have no "
      "access card.",
      "ASSIGNED", 4, new_hire=True),
    R("Facilities", "LOW", "Standing desk request",
      "I would like a standing desk. I have back pain when I sit for long periods.",
      "REJECTED", 16,
      reason="Standing desks are provided on medical recommendation. Please send the note to "
             "People & Culture as an HR query."),
    R("Other", "LOW", "Business cards for the Colombo conference",
      "I am speaking at a conference in Colombo next month and need 100 business cards.",
      "SUBMITTED", 3),
    R("Other", "MEDIUM", "Courier pickup for signed contracts",
      "Three signed supplier contracts need to go to the Kuala Lumpur office by courier this "
      "week.",
      "IN_PROGRESS", 2),
    R("Other", "LOW", "Suggestion: recycling bins on each floor",
      "There is only one recycling bin, on the ground floor. Could we have one on each floor?",
      "SUBMITTED", 6),
    R("Other", "MEDIUM", "Parking permit for a client visit",
      "A client is visiting on Friday with two cars and will need parking permits.",
      "WITHDRAWN", 8),
    R("Other", "MEDIUM", "Team lunch budget for the sprint review",
      "We would like to hold the sprint review over a team lunch for nine people.",
      "RESOLVED", 3, resolution="Approved up to the standard per-person limit. Keep the "
                                "receipt."),
]  # fmt: skip


def seed_requests(db: Session, users: dict[str, User], today: date, rng: random.Random) -> int:
    categories = {c.name: c for c in db.scalars(select(RequestCategory))}
    people = list(users.values())
    new_hires = sorted(
        (u for u in people if (today - u.joining_date).days < 60), key=lambda u: u.joining_date
    )
    employees = [u for u in people if u.role == UserRole.EMPLOYEE and u not in new_hires]
    hr_admin = users["Nadia Rahman"]
    now = datetime.now(UTC)

    for index, spec in enumerate(REQUESTS):
        category = categories[spec["category"]]
        new_hire = new_hires[index % len(new_hires)]
        requester = new_hire if spec.get("new_hire") else rng.choice(employees)
        triager = hr_admin if category.is_confidential else requester.manager
        resolvers = [
            u
            for u in employees
            if u.department.name == RESOLVING_DEPARTMENT[spec["category"]]
            and u.id not in (requester.id, requester.manager_id)
        ]
        assignee = rng.choice(resolvers)
        actors = {"r": requester, "a": assignee, "t": triager}

        data = RequestCreate(
            title=spec["title"],
            description=spec["description"],
            category_id=category.id,
            priority=spec["priority"],
        )
        request = service.create_request(db, requester, data)
        steps = PATHS[spec["stage"]]
        for position, action in enumerate(steps):
            if action == "assign":
                service.assign(db, triager, request.id, assignee.id, None, "assign")
            elif action == "start":
                service.act(db, assignee, request.id, action, None)
            elif action == "resolve":
                service.act(db, assignee, request.id, action, spec["resolution"])
            elif action == "reject":
                service.act(db, triager, request.id, action, spec["reason"])
            else:
                service.act(db, requester, request.id, action, spec.get("reopen_note"))
            # The thread happens while the work is in progress.
            if action == "start" and position == 1:
                for who, body in spec.get("comments", []):
                    service.add_comment(db, actors[who], request.id, body)

        _backdate(db, request, now - timedelta(days=spec["days_ago"]), now, rng)
    db.commit()
    return len(REQUESTS)


def _next_working_moment(moment: datetime, now: datetime, rng) -> datetime:
    """Move a time outside 03:00-11:00 UTC, the offices' shared day, to the next morning."""
    if 3 <= moment.hour < 11:
        return moment
    day = moment if moment.hour < 3 else moment + timedelta(days=1)
    moved = day.replace(hour=rng.randint(3, 5), minute=rng.randint(0, 59))
    return moved if moved < now else moment


def _backdate(db: Session, request: ServiceRequest, start: datetime, now: datetime, rng) -> None:
    """Spread the request's events and comments over real-looking times since it was raised."""
    db.refresh(request)
    start = start.replace(hour=rng.randint(3, 9), minute=rng.randint(0, 59))
    timeline = sorted([*request.history, *request.comments], key=lambda item: item.created_at)
    moment = start
    for remaining, item in zip(range(len(timeline), 0, -1), timeline, strict=True):
        item.created_at = moment
        gap = min(timedelta(hours=rng.uniform(0.5, 6)), (now - moment) / (remaining + 1))
        moment = _next_working_moment(moment + gap, now, rng)

    events = request.history
    request.created_at = start
    request.updated_at = timeline[-1].created_at
    assigned = [e.created_at for e in events if e.to_status == RequestStatus.ASSIGNED]
    for assignment, moment in zip(request.assignments, assigned, strict=True):
        assignment.created_at = moment
    if request.resolved_at:
        request.resolved_at = next(
            e.created_at for e in reversed(events) if e.to_status == RequestStatus.RESOLVED
        )
    if request.closed_at:
        request.closed_at = events[-1].created_at
