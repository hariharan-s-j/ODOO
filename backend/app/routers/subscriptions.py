from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_any_authenticated_user, get_staff_or_admin
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus
from app.models.plan import Plan
from app.models.user import User, UserRole
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionTransitionRequest,
    SubscriptionUpdate,
)
from app.schemas.invoice import InvoiceResponse
from app.services.billing_engine import generate_invoice_for_subscription
from app.services.subscription_service import (
    create_subscription_from_template,
    generate_subscription_number,
    recalculate_subscription_totals,
    transition_subscription_state,
)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions Lifecycle FSM"])


@router.get("", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(Subscription)
        .options(
            selectinload(Subscription.lines).selectinload(SubscriptionLine.product),
            selectinload(Subscription.lines).selectinload(SubscriptionLine.variant),
            selectinload(Subscription.customer),
            selectinload(Subscription.plan),
        )
        .order_by(Subscription.id.desc())
    )

    # RBAC: Customers can ONLY see their own subscriptions
    if current_user.role == UserRole.CUSTOMER:
        stmt = stmt.where(Subscription.customer_id == current_user.id)
    elif customer_id:
        stmt = stmt.where(Subscription.customer_id == customer_id)

    if status:
        stmt = stmt.where(Subscription.status == status)

    subs = (await db.execute(stmt)).scalars().all()
    return subs


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    # Customer can only create for self
    target_customer_id = payload.customer_id
    if current_user.role == UserRole.CUSTOMER:
        target_customer_id = current_user.id

    # If created from template
    if payload.template_id:
        sub = await create_subscription_from_template(
            db=db,
            customer_id=target_customer_id,
            template_id=payload.template_id,
            start_date=payload.start_date,
            payment_terms=payload.payment_terms,
            notes=payload.notes,
            discount_code=payload.discount_code,
        )
        # Reload with all relations
        stmt_reload = (
            select(Subscription)
            .options(
                selectinload(Subscription.lines).selectinload(SubscriptionLine.product),
                selectinload(Subscription.lines).selectinload(SubscriptionLine.variant),
                selectinload(Subscription.customer),
                selectinload(Subscription.plan),
            )
            .where(Subscription.id == sub.id)
        )
        return (await db.execute(stmt_reload)).scalar_one()

    # Otherwise manual creation from lines
    stmt_plan = select(Plan).where(Plan.id == payload.plan_id)
    plan = (await db.execute(stmt_plan)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    sub_num = await generate_subscription_number(db)
    sub = Subscription(
        subscription_number=sub_num,
        customer_id=target_customer_id,
        plan_id=plan.id,
        status=SubscriptionStatus.DRAFT,
        start_date=payload.start_date,
        end_date=payload.end_date or plan.end_date,
        next_billing_date=payload.start_date,
        payment_terms=payload.payment_terms,
        notes=payload.notes,
        quotation_valid_until=payload.quotation_valid_until,
        auto_close_on_expiry=plan.auto_close_on_expiry,
        allow_pause=plan.allow_pause,
        allow_early_close=plan.allow_early_close,
        discount_code=payload.discount_code,
    )
    db.add(sub)
    await db.flush()

    if payload.lines:
        for line_in in payload.lines:
            line = SubscriptionLine(
                subscription_id=sub.id,
                product_id=line_in.product_id,
                variant_id=line_in.variant_id,
                quantity=line_in.quantity,
                unit_price=line_in.unit_price or Decimal("0.00"),
                tax_id=line_in.tax_id,
            )
            db.add(line)

    await db.commit()
    await recalculate_subscription_totals(db, sub.id)

    stmt_reload = (
        select(Subscription)
        .options(
            selectinload(Subscription.lines).selectinload(SubscriptionLine.product),
            selectinload(Subscription.lines).selectinload(SubscriptionLine.variant),
            selectinload(Subscription.customer),
            selectinload(Subscription.plan),
        )
        .where(Subscription.id == sub.id)
    )
    return (await db.execute(stmt_reload)).scalar_one()


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(Subscription)
        .options(
            selectinload(Subscription.lines).selectinload(SubscriptionLine.product),
            selectinload(Subscription.lines).selectinload(SubscriptionLine.variant),
            selectinload(Subscription.customer),
            selectinload(Subscription.plan),
        )
        .where(Subscription.id == subscription_id)
    )
    sub = (await db.execute(stmt)).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if current_user.role == UserRole.CUSTOMER and sub.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return sub


@router.post("/{subscription_id}/transition", response_model=SubscriptionResponse)
async def transition_subscription(
    subscription_id: int,
    payload: SubscriptionTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    FSM Transition Endpoint:
    DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED (or PAUSED)
    """
    stmt = select(Subscription).where(Subscription.id == subscription_id)
    sub = (await db.execute(stmt)).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    # Permissions: Customers can confirm quotes or request close/pause if allowed
    if current_user.role == UserRole.CUSTOMER:
        if sub.customer_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if payload.action not in ["confirm", "close", "pause", "resume"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer cannot perform this transition")

    try:
        updated_sub = await transition_subscription_state(
            db=db,
            subscription_id=subscription_id,
            action=payload.action,
            notes=payload.notes,
        )
        # Reload with relations
        stmt_reload = (
            select(Subscription)
            .options(
                selectinload(Subscription.lines).selectinload(SubscriptionLine.product),
                selectinload(Subscription.lines).selectinload(SubscriptionLine.variant),
                selectinload(Subscription.customer),
                selectinload(Subscription.plan),
            )
            .where(Subscription.id == updated_sub.id)
        )
        return (await db.execute(stmt_reload)).scalar_one()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{subscription_id}/bill-now", response_model=InvoiceResponse)
async def bill_subscription_now(
    subscription_id: int,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    """Triggers invoice generation for this subscription."""
    try:
        invoice = await generate_invoice_for_subscription(db, subscription_id=subscription_id, force=force)
        if not invoice:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice could not be generated.")

        # Reload invoice
        from app.models.invoice import Invoice
        stmt_inv = (
            select(Invoice)
            .options(
                selectinload(Invoice.lines),
                selectinload(Invoice.customer),
            )
            .where(Invoice.id == invoice.id)
        )
        return (await db.execute(stmt_inv)).scalar_one()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
