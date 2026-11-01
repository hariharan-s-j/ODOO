from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_any_authenticated_user
from app.models.plan import Plan
from app.models.user import User
from app.schemas.plan import PlanCreate, PlanResponse, PlanUpdate

router = APIRouter(prefix="/plans", tags=["Subscription Plans"])


@router.get("", response_model=List[PlanResponse])
async def list_plans(
    interval: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = select(Plan)
    if interval:
        stmt = stmt.where(Plan.interval == interval)
    if is_active is not None:
        stmt = stmt.where(Plan.is_active == is_active)

    plans = (await db.execute(stmt)).scalars().all()
    return plans


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Plan).where(Plan.code == payload.code.strip())
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A plan with code '{payload.code}' already exists.",
        )

    plan = Plan(
        name=payload.name.strip(),
        code=payload.code.strip(),
        description=payload.description,
        interval=payload.interval,
        cost=payload.cost,
        minimum_quantity=payload.minimum_quantity,
        start_date=payload.start_date,
        end_date=payload.end_date,
        auto_close_on_expiry=payload.auto_close_on_expiry,
        allow_pause=payload.allow_pause,
        allow_early_close=payload.allow_early_close,
        is_active=payload.is_active,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = select(Plan).where(Plan.id == plan_id)
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Plan).where(Plan.id == plan_id)
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if payload.name is not None:
        plan.name = payload.name.strip()
    if payload.code is not None:
        plan.code = payload.code.strip()
    if payload.description is not None:
        plan.description = payload.description
    if payload.interval is not None:
        plan.interval = payload.interval
    if payload.cost is not None:
        plan.cost = payload.cost
    if payload.minimum_quantity is not None:
        plan.minimum_quantity = payload.minimum_quantity
    if payload.start_date is not None:
        plan.start_date = payload.start_date
    if payload.end_date is not None:
        plan.end_date = payload.end_date
    if payload.auto_close_on_expiry is not None:
        plan.auto_close_on_expiry = payload.auto_close_on_expiry
    if payload.allow_pause is not None:
        plan.allow_pause = payload.allow_pause
    if payload.allow_early_close is not None:
        plan.allow_early_close = payload.allow_early_close
    if payload.is_active is not None:
        plan.is_active = payload.is_active

    await db.commit()
    await db.refresh(plan)
    return plan
