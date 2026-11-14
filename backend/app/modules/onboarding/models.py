import enum
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.modules.users.models import Department, User


class TaskOwnerKind(enum.StrEnum):
    DEPARTMENT = "DEPARTMENT"
    LINE_MANAGER = "LINE_MANAGER"


class DeadlineUnit(enum.StrEnum):
    DAY = "DAY"
    WEEK = "WEEK"


class TaskStatus(enum.StrEnum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


owner_kind_enum = Enum(TaskOwnerKind, name="task_owner_kind")
status_enum = Enum(TaskStatus, name="task_status")
OWNER_CHECK = "(owner_kind = 'DEPARTMENT') = (owner_department_id IS NOT NULL)"


class OnboardingTemplate(Base):
    __tablename__ = "onboarding_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    description: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    tasks: Mapped[list["OnboardingTemplateTask"]] = relationship(
        order_by="OnboardingTemplateTask.sort_order", back_populates="template"
    )


class OnboardingTemplateTask(Base):
    __tablename__ = "onboarding_template_tasks"
    __table_args__ = (
        UniqueConstraint("id", "template_id"),
        ForeignKeyConstraint(
            ["depends_on_task_id", "template_id"],
            ["onboarding_template_tasks.id", "onboarding_template_tasks.template_id"],
            name="fk_template_tasks_dependency_same_template",
        ),
        CheckConstraint(OWNER_CHECK, name="owner_matches_kind"),
        CheckConstraint("deadline_value >= 1", name="deadline_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("onboarding_templates.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    owner_kind: Mapped[TaskOwnerKind] = mapped_column(owner_kind_enum)
    owner_department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    deadline_unit: Mapped[DeadlineUnit] = mapped_column(Enum(DeadlineUnit, name="deadline_unit"))
    deadline_value: Mapped[int]
    depends_on_task_id: Mapped[int | None]
    sort_order: Mapped[int]

    template: Mapped[OnboardingTemplate] = relationship(back_populates="tasks")
    owner_department: Mapped[Department | None] = relationship()


class OnboardingChecklist(Base):
    __tablename__ = "onboarding_checklists"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("onboarding_templates.id"))
    start_date: Mapped[date]
    assigned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    employee: Mapped[User] = relationship(foreign_keys=[employee_id])
    template: Mapped[OnboardingTemplate] = relationship()
    tasks: Mapped[list["OnboardingTask"]] = relationship(
        order_by="OnboardingTask.sort_order", back_populates="checklist"
    )


class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"
    __table_args__ = (
        UniqueConstraint("id", "checklist_id"),
        ForeignKeyConstraint(
            ["depends_on_task_id", "checklist_id"],
            ["onboarding_tasks.id", "onboarding_tasks.checklist_id"],
            name="fk_tasks_dependency_same_checklist",
        ),
        CheckConstraint(OWNER_CHECK, name="owner_matches_kind"),
        Index("ix_onboarding_tasks_assignee_status", "assignee_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("onboarding_checklists.id"), index=True)
    template_task_id: Mapped[int | None] = mapped_column(
        ForeignKey("onboarding_template_tasks.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    owner_kind: Mapped[TaskOwnerKind] = mapped_column(owner_kind_enum)
    owner_department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    assignee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    due_date: Mapped[date] = mapped_column(index=True)
    depends_on_task_id: Mapped[int | None]
    status: Mapped[TaskStatus] = mapped_column(status_enum, default=TaskStatus.NOT_STARTED)
    started_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    sort_order: Mapped[int]

    checklist: Mapped[OnboardingChecklist] = relationship(back_populates="tasks")
    owner_department: Mapped[Department | None] = relationship()
    assignee: Mapped[User] = relationship(foreign_keys=[assignee_id])
    depends_on: Mapped["OnboardingTask | None"] = relationship(
        remote_side=[id],
        primaryjoin="OnboardingTask.depends_on_task_id == OnboardingTask.id",
        foreign_keys="OnboardingTask.depends_on_task_id",
        viewonly=True,
    )
    history: Mapped[list["OnboardingTaskEvent"]] = relationship(
        order_by="OnboardingTaskEvent.id", back_populates="task"
    )


class OnboardingTaskEvent(Base):
    __tablename__ = "onboarding_task_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("onboarding_tasks.id"), index=True)
    from_status: Mapped[TaskStatus | None] = mapped_column(status_enum)
    to_status: Mapped[TaskStatus] = mapped_column(status_enum)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    task: Mapped[OnboardingTask] = relationship(back_populates="history")
    actor: Mapped[User] = relationship()
