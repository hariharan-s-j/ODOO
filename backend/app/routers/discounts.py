from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_any_authenticated_user, get_staff_or_admin
from app.models.discount import DiscountRule
from app.models.user import User
from app.schemas.discount import (
    DiscountRuleCreate,
    DiscountRuleResponse,
    DiscountRuleUpdate,
    ValidateDiscountRequest,
    ValidateDiscountResponse,
)
from app.services.discount_engine import evaluate_discount_rule

router = APIRouter(prefix="/discounts", tags=["Dynamic Discount Rules"])


@router.get("", response_model=List[DiscountRuleResponse])
async def list_discounts(
    scope: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    stmt = select(DiscountRule)
    if scope:
        stmt = stmt.where(DiscountRule.scope == scope)
    if is_active is not None:
        stmt = stmt.where(DiscountRule.is_active == is_active)

    rules = (await db.execute(stmt)).scalars().all()
    return rules


@router.post("", response_model=DiscountRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_discount_rule(
    payload: DiscountRuleCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DiscountRule).where(DiscountRule.code.ilike(payload.code.strip()))
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A discount rule with code '{payload.code}' already exists.",
        )

    rule = DiscountRule(
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        discount_type=payload.discount_type,
        value=payload.value,
        scope=payload.scope,
        product_id=payload.product_id,
        min_spend=payload.min_spend,
        min_quantity=payload.min_quantity,
        start_date=payload.start_date,
        end_date=payload.end_date,
        max_uses=payload.max_uses,
        is_active=payload.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=DiscountRuleResponse)
async def get_discount_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    stmt = select(DiscountRule).where(DiscountRule.id == rule_id)
    rule = (await db.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount rule not found")
    return rule


@router.put("/{rule_id}", response_model=DiscountRuleResponse)
async def update_discount_rule(
    rule_id: int,
    payload: DiscountRuleUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DiscountRule).where(DiscountRule.id == rule_id)
    rule = (await db.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount rule not found")

    if payload.code is not None:
        rule.code = payload.code.strip().upper()
    if payload.name is not None:
        rule.name = payload.name.strip()
    if payload.discount_type is not None:
        rule.discount_type = payload.discount_type
    if payload.value is not None:
        rule.value = payload.value
    if payload.scope is not None:
        rule.scope = payload.scope
    if payload.product_id is not None:
        rule.product_id = payload.product_id
    if payload.min_spend is not None:
        rule.min_spend = payload.min_spend
    if payload.min_quantity is not None:
        rule.min_quantity = payload.min_quantity
    if payload.start_date is not None:
        rule.start_date = payload.start_date
    if payload.end_date is not None:
        rule.end_date = payload.end_date
    if payload.max_uses is not None:
        rule.max_uses = payload.max_uses
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    await db.commit()
    await db.refresh(rule)
    return rule


@router.post("/validate", response_model=ValidateDiscountResponse)
async def validate_discount(
    payload: ValidateDiscountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Dynamically validates a discount code for real-time checkout feedback."""
    mock_line_items = None
    if payload.product_ids:
        mock_line_items = [{"product_id": pid, "subtotal": payload.subtotal} for pid in payload.product_ids]

    valid, rule, d_amount, message = await evaluate_discount_rule(
        db=db,
        code=payload.code,
        order_subtotal=payload.subtotal,
        total_quantity=payload.total_quantity,
        line_items=mock_line_items,
    )

    return ValidateDiscountResponse(
        valid=valid,
        discount_rule_id=rule.id if rule else None,
        code=payload.code,
        discount_type=rule.discount_type if rule else None,
        value=rule.value if rule else None,
        discount_amount=d_amount,
        message=message,
    )
