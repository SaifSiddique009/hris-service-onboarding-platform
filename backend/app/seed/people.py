import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.requests.models import RequestCategory
from app.modules.users.models import Country, Department, EmploymentStatus, User, UserRole

EMAIL_DOMAIN = "northbridge.example"
DEMO_PASSWORD = "Welcome@2026"

COUNTRIES = [
    ("BD", "Bangladesh", "Asia/Dhaka"),
    ("MY", "Malaysia", "Asia/Kuala_Lumpur"),
    ("LK", "Sri Lanka", "Asia/Colombo"),
    ("CY", "Cyprus", "Asia/Nicosia"),
]

NAMES = {
    "BD": [
        "Tanvir Ahmed", "Nusrat Jahan", "Rakibul Islam", "Farhana Rahman", "Imran Hossain",
        "Sadia Chowdhury", "Mahmudul Hasan", "Tasnim Akter", "Shakil Khan", "Rumana Haque",
        "Ariful Karim", "Sharmin Sultana", "Nayeem Uddin", "Jannatul Ferdous", "Fahim Sarkar",
        "Maliha Kabir", "Rezaul Alam", "Sumaiya Begum", "Asif Mahmud", "Lamia Zaman",
        "Mehedi Mridha", "Tahmina Yasmin", "Sabbir Talukder", "Nadia Rahman", "Kamrul Bhuiyan",
        "Ishrat Nowrin", "Zahid Molla", "Afsana Mim", "Towhid Reza", "Priyanka Saha",
        "Sourav Das", "Anika Tabassum", "Mizanur Sheikh", "Rifat Biswas", "Shamima Nasrin",
        "Habibur Miah", "Tania Parvin", "Jubayer Faruk", "Mousumi Roy", "Saiful Azam",
    ],
    "MY": [
        "Aiman Hakim", "Nurul Aisyah", "Hafizuddin Ismail", "Siti Zulaikha", "Lim Wei Jie",
        "Tan Mei Ling", "Arjun Nair", "Priya Krishnan", "Farid Yusof", "Amirah Zainal",
        "Wong Jia Hao", "Lee Xin Yi", "Kavitha Pillai", "Daniel Ong", "Zulkifli Hamid",
        "Nor Azlina", "Chong Kah Yee", "Ravi Subramaniam", "Syafiq Roslan", "Goh Pei Shan",
        "Hakim Jamaluddin", "Farah Idris", "Teo Boon Keat", "Nabila Othman", "Vikram Menon",
    ],
    "LK": [
        "Kasun Perera", "Dilani Fernando", "Tharindu Silva", "Sanduni Jayawardena",
        "Nuwan Bandara", "Ishara Wickramasinghe", "Chamara Gunawardena", "Hiruni Dissanayake",
        "Lahiru Herath", "Nadeesha Ranasinghe", "Ruwan Karunaratne", "Thilini Amarasinghe",
        "Dinesh Kumarasinghe", "Sachini Weerasinghe", "Pradeep Ekanayake", "Amaya Gamage",
        "Suresh Sivakumar", "Kavindi Liyanage", "Roshan Pathirana", "Menaka Abeysekara",
    ],
    "CY": [
        "Andreas Georgiou", "Eleni Christodoulou", "Nikos Ioannou", "Maria Constantinou",
        "Christos Demetriou", "Sophia Nicolaou", "Panayiotis Charalambous", "Katerina Antoniou",
        "Stelios Kyriakou", "Anna Michaelidou", "Marios Hadjigeorgiou", "Despina Loizou",
        "Giorgos Stylianou", "Irene Pavlou", "Kyriakos Savva",
    ],
}  # fmt: skip

# (name, department, title, role, reports to). Order matters: a manager comes before reports.
LEADERSHIP = [
    ("Andreas Georgiou", "Operations", "Managing Director", UserRole.MANAGER, None),
    ("Nadia Rahman", "People & Culture", "Head of People & Culture", UserRole.HR_ADMIN,
     "Andreas Georgiou"),
    ("Tan Mei Ling", "People & Culture", "HR Business Partner", UserRole.HR_ADMIN, "Nadia Rahman"),
    ("Dilani Fernando", "People & Culture", "People Operations Lead", UserRole.HR_ADMIN,
     "Nadia Rahman"),
    ("Tanvir Ahmed", "Engineering", "Head of Engineering", UserRole.MANAGER, "Andreas Georgiou"),
    ("Lim Wei Jie", "Engineering", "Engineering Manager", UserRole.MANAGER, "Tanvir Ahmed"),
    ("Kasun Perera", "Engineering", "Engineering Manager", UserRole.MANAGER, "Tanvir Ahmed"),
    ("Farhana Rahman", "Engineering", "Engineering Manager", UserRole.MANAGER, "Tanvir Ahmed"),
    ("Maria Constantinou", "Finance", "Head of Finance", UserRole.MANAGER, "Andreas Georgiou"),
    ("Priya Krishnan", "Marketing", "Head of Marketing", UserRole.MANAGER, "Andreas Georgiou"),
    ("Sadia Chowdhury", "Marketing", "Marketing Manager", UserRole.MANAGER, "Priya Krishnan"),
    ("Imran Hossain", "IT", "Head of IT", UserRole.MANAGER, "Andreas Georgiou"),
    ("Nuwan Bandara", "IT", "IT Support Lead", UserRole.MANAGER, "Imran Hossain"),
    ("Zulkifli Hamid", "Operations", "Head of Operations", UserRole.MANAGER, "Andreas Georgiou"),
    ("Rumana Haque", "Operations", "Facilities Manager", UserRole.MANAGER, "Zulkifli Hamid"),
    ("Eleni Christodoulou", "Compliance", "Head of Compliance", UserRole.MANAGER,
     "Andreas Georgiou"),
]  # fmt: skip

DEPARTMENT_HEADS = {
    "Engineering": "Tanvir Ahmed",
    "People & Culture": "Nadia Rahman",
    "Finance": "Maria Constantinou",
    "Marketing": "Priya Krishnan",
    "IT": "Imran Hossain",
    "Operations": "Zulkifli Hamid",
    "Compliance": "Eleni Christodoulou",
}

# department -> (number of non-leadership staff, job titles)
STAFF = {
    "Engineering": (30, ["Software Engineer", "Senior Software Engineer", "QA Engineer",
                         "DevOps Engineer", "Data Engineer", "Product Designer"]),
    "People & Culture": (7, ["HR Generalist", "Talent Acquisition Specialist",
                             "Learning & Development Specialist", "Payroll Officer"]),
    "Finance": (9, ["Accountant", "Financial Analyst", "Accounts Payable Officer"]),
    "Marketing": (12, ["Content Strategist", "Performance Marketer", "Brand Designer",
                       "SEO Specialist"]),
    "IT": (10, ["IT Support Engineer", "Systems Administrator", "Network Engineer"]),
    "Operations": (9, ["Office Administrator", "Facilities Coordinator", "Procurement Officer"]),
    "Compliance": (7, ["Compliance Analyst", "Risk Officer", "Legal Counsel"]),
}  # fmt: skip

# Recent joiners, two per country, who later receive onboarding checklists.
# (department, days since joining, country)
NEW_HIRES = [
    ("Engineering", 12, "BD"),
    ("Engineering", 18, "MY"),
    ("Engineering", 24, "LK"),
    ("Engineering", 29, "CY"),
    ("Marketing", 35, "MY"),
    ("Finance", 41, "BD"),
    ("IT", 47, "LK"),
    ("Operations", 54, "CY"),
]

CATEGORIES = [
    ("IT Equipment", "Laptops, monitors, peripherals and repairs.", "IT", False),
    ("Software Access", "Licences, accounts and permissions for tools.", "IT", False),
    ("HR Query", "Pay, leave, benefits, policies and personal matters.", "People & Culture", True),
    ("Facilities", "Desks, access cards, office repairs and supplies.", "Operations", False),
    ("Other", "Anything that does not fit another category.", None, False),
]


def email_for(name: str) -> str:
    return f"{name.lower().replace(' ', '.')}@{EMAIL_DOMAIN}"


def seed_people(db: Session, today: date, rng: random.Random) -> dict[str, User]:
    db.add_all(Country(code=c, name=n, timezone=tz) for c, n, tz in COUNTRIES)
    departments = {name: Department(name=name) for name in DEPARTMENT_HEADS}
    db.add_all(departments.values())
    db.flush()

    country_of = {name: code for code, names in NAMES.items() for name in names}
    password_hash = hash_password(DEMO_PASSWORD)
    users: dict[str, User] = {}

    def add(name, department, title, role, manager, joined, status=EmploymentStatus.ACTIVE):
        user = User(
            full_name=name,
            email=email_for(name),
            password_hash=password_hash,
            job_title=title,
            role=role,
            country_code=country_of[name],
            department_id=departments[department].id,
            manager_id=manager.id if manager else None,
            status=status,
            joining_date=joined,
        )
        db.add(user)
        db.flush()
        users[name] = user
        return user

    for name, department, title, role, manager in LEADERSHIP:
        joined = today - timedelta(days=rng.randint(900, 2600))
        add(name, department, title, role, users.get(manager), joined)

    for name, head in DEPARTMENT_HEADS.items():
        departments[name].head_id = users[head].id

    leaders = {row[0] for row in LEADERSHIP}
    pool = [name for names in NAMES.values() for name in names if name not in leaders]
    rng.shuffle(pool)

    managing_director = LEADERSHIP[0][0]
    team_managers = {
        department: [
            users[name]
            for name, dept, _, role, _ in LEADERSHIP
            if dept == department and role == UserRole.MANAGER and name != managing_director
        ]
        or [users[DEPARTMENT_HEADS[department]]]
        for department in STAFF
    }
    remaining = {department: count for department, (count, _) in STAFF.items()}

    def add_staff(name, department, joined, status):
        managers = team_managers[department]
        manager = managers[remaining[department] % len(managers)]
        remaining[department] -= 1
        title = rng.choice(STAFF[department][1])
        add(name, department, title, UserRole.EMPLOYEE, manager, joined, status)

    for department, days_ago, country in NEW_HIRES:
        name = next(n for n in pool if country_of[n] == country)
        pool.remove(name)
        add_staff(name, department, today - timedelta(days=days_ago), EmploymentStatus.ON_PROBATION)

    for department in STAFF:
        while remaining[department]:
            joined = today - timedelta(days=rng.randint(75, 2400))
            recent = (today - joined).days < 180
            status = EmploymentStatus.ON_PROBATION if recent else EmploymentStatus.ACTIVE
            add_staff(pool.pop(), department, joined, status)

    tenured = [u for u in users.values()
               if u.role == UserRole.EMPLOYEE and u.status == EmploymentStatus.ACTIVE]  # fmt: skip
    for user in rng.sample(tenured, 4):
        user.status = EmploymentStatus.ON_NOTICE

    db.add_all(
        RequestCategory(
            name=name,
            description=description,
            owning_department_id=departments[owner].id if owner else None,
            is_confidential=confidential,
        )
        for name, description, owner, confidential in CATEGORIES
    )
    db.flush()
    return users
