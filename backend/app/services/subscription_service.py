from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus
from app.models.plan import Plan, RecurrenceInterval
from app.models.quotation_template import QuotationTemplate, QuotationTemplateLine
from app.models.product import Product, ProductVariant
from app.models.tax import Tax
from app.services.pricing_engine import calculate_line_price
from app.services.discount_engine import evaluate_discount_rule, increment_discount_usage


async def generate_subscription_number(db: AsyncSession) -> str:
    """Generate sequential subscription number like SUB-2026-0001."""
    year = datetime.now().year
    prefix = f"SUB-{year}-"
    stmt = select(func.count(Subscription.id)).where(Subscription.subscription_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    return f"{prefix}{count + 1:04d}"


def calculate_next_billing_date(start_date: date, interval: str) -> date:
    """Computes the next billing date based on recurrence interval."""
    if interval == RecurrenceInterval.DAILY:
        return start_date + timedelta(days=1)
    elif interval == RecurrenceInterval.WEEKLY:
        return start_date + timedelta(weeks=1)
    elif interval == RecurrenceInterval.YEARLY:
        # Leap year safe
        try:
            return start_date.replace(year=start_date.year + 1)
        except ValueError:
            return start_date + timedelta(days=365)
    else:  # MONTHLY default
        # Add ~1 month
        month = start_date.month + 1
        year = start_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(start_date.day, 28)
        return date(year, month, day)


async def create_subscription_from_template(
    db: AsyncSession,
    customer_id: int,
    template_id: int,
    start_date: Optional[date] = None,
    payment_terms: str = "Immediate",
    notes: Optional[str] = None,
    discount_code: Optional[str] = None,
) -> Subscription:
    """Create a new subscription initialized from a Quotation Template."""
    stmt = (
        select(QuotationTemplate)
        .options(
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.product),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.variant),
            selectinload(QuotationTemplate.plan),
        )
        .where(QuotationTemplate.id == template_id)
    )
    res = await db.execute(stmt)
    template = res.scalar_one_or_none()
    if not template:
        raise ValueError(f"Quotation Template ID {template_id} not found")

    plan = template.plan
    if not plan:
        raise ValueError(f"Template {template.name} does not have an associated Plan")

    sub_start = start_date or date.today()
    valid_until = sub_start + timedelta(days=template.validity_days)
    sub_num = await generate_subscription_number(db)

    sub = Subscription(
        subscription_number=sub_num,
        customer_id=customer_id,
        plan_id=plan.id,
        status=SubscriptionStatus.QUOTATION,
        start_date=sub_start,
        end_date=plan.end_date,
        next_billing_date=sub_start,
        payment_terms=payment_terms,
        notes=notes or f"Created from template: {template.name}",
        quotation_valid_until=valid_until,
        auto_close_on_expiry=plan.auto_close_on_expiry,
        allow_pause=plan.allow_pause,
        allow_early_close=plan.allow_early_close,
        discount_code=discount_code,
    )
    db.add(sub)
    await db.flush()

    # Create lines
    subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")
    raw_lines = []

    for t_line in template.lines:
        line_calc = await calculate_line_price(
            db=db,
            product_id=t_line.product_id,
            variant_id=t_line.variant_id,
            quantity=t_line.quantity,
            unit_price_override=t_line.unit_price_override,
            discount_percent=t_line.discount_percent,
        )
        sub_line = SubscriptionLine(
            subscription_id=sub.id,
            product_id=t_line.product_id,
            variant_id=t_line.variant_id,
            quantity=t_line.quantity,
            unit_price=line_calc["unit_price"],
            tax_id=line_calc["tax_id"],
            tax_rate=line_calc["tax_rate"],
            subtotal=line_calc["subtotal"],
            tax_amount=line_calc["tax_amount"],
            discount_amount=line_calc["discount_amount"],
            total_amount=line_calc["total_amount"],
        )
        db.add(sub_line)
        subtotal += line_calc["subtotal"]
        total_tax += line_calc["tax_amount"]
        raw_lines.append(line_calc)

    # Apply global discount if any
    order_discount = Decimal("0.00")
    if discount_code:
        valid, rule, d_amt, msg = await evaluate_discount_rule(
            db=db,
            code=discount_code,
            order_subtotal=subtotal,
            total_quantity=sum(l.quantity for l in template.lines),
            line_items=raw_lines,
        )
        if valid:
            order_discount = d_amt

    sub.subtotal = subtotal
    sub.discount_amount = order_discount
    sub.tax_amount = total_tax
    sub.total_amount = max(Decimal("0.00"), subtotal - order_discount + total_tax)

    await db.commit()
    await db.refresh(sub)
    return sub


async def recalculate_subscription_totals(db: AsyncSession, subscription_id: int) -> Subscription:
    """Recalculate subscription lines and summary totals."""
    stmt = (
        select(Subscription)
        .options(
            selectinload(Subscription.lines),
            selectinload(Subscription.plan),
            selectinload(Subscription.customer),
        )
        .where(Subscription.id == subscription_id)
    )
    sub = (await db.execute(stmt)).scalar_one_or_none()
    if not sub:
        raise ValueError(f"Subscription {subscription_id} not found")

    subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")
    total_qty = 0
    raw_lines = []

    for line in sub.lines:
        line_calc = await calculate_line_price(
            db=db,
            product_id=line.product_id,
            variant_id=line.variant_id,
            quantity=line.quantity,
            unit_price_override=line.unit_price,
            tax_id=line.tax_id,
        )
        line.unit_price = line_calc["unit_price"]
        line.tax_rate = line_calc["tax_rate"]
        line.subtotal = line_calc["subtotal"]
        line.tax_amount = line_calc["tax_amount"]
        line.total_amount = line_calc["total_amount"]
        
        subtotal += line.subtotal
        total_tax += line.tax_amount
        total_qty += line.quantity
        raw_lines.append(line_calc)

    # Check discount
    discount_amount = Decimal("0.00")
    if sub.discount_code:
        valid, rule, d_amt, _ = await evaluate_discount_rule(
            db=db,
            code=sub.discount_code,
            order_subtotal=subtotal,
            total_quantity=total_qty,
            line_items=raw_lines,
        )
        if valid:
            discount_amount = d_amt

    sub.subtotal = subtotal
    sub.discount_amount = discount_amount
    sub.tax_amount = total_tax
    sub.total_amount = max(Decimal("0.00"), subtotal - discount_amount + total_tax)

    await db.commit()
    await db.refresh(sub)
    return sub


async def transition_subscription_state(
    db: AsyncSession,
    subscription_id: int,
    action: str,
    notes: Optional[str] = None,
) -> Subscription:
    """
    FSM Transition Engine for Subscriptions:
    DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED (or PAUSED)
    """
    stmt = (
        select(Subscription)
        .options(
            selectinload(Subscription.lines),
            selectinload(Subscription.plan),
            selectinload(Subscription.customer),
        )
        .where(Subscription.id == subscription_id)
    )
    sub = (await db.execute(stmt)).scalar_one_or_none()
    if not sub:
        raise ValueError(f"Subscription {subscription_id} not found")

    current_status = sub.status
    today = date.today()

    if action == "to_quotation":
        if current_status not in [SubscriptionStatus.DRAFT]:
            raise ValueError(f"Cannot transition to QUOTATION from state '{current_status}'. Allowed from DRAFT.")
        sub.status = SubscriptionStatus.QUOTATION
        if not sub.quotation_valid_until:
            sub.quotation_valid_until = today + timedelta(days=15)

    elif action == "confirm":
        if current_status not in [SubscriptionStatus.DRAFT, SubscriptionStatus.QUOTATION]:
            raise ValueError(f"Cannot confirm subscription in state '{current_status}'.")
        # Check minimum quantity against plan
        if sub.plan:
            total_qty = sum(l.quantity for l in sub.lines)
            if total_qty < sub.plan.minimum_quantity:
                raise ValueError(
                    f"Plan '{sub.plan.name}' requires a minimum quantity of {sub.plan.minimum_quantity} (current: {total_qty})."
                )
        sub.status = SubscriptionStatus.CONFIRMED

    elif action == "activate":
        if current_status not in [SubscriptionStatus.CONFIRMED, SubscriptionStatus.PAUSED]:
            raise ValueError(f"Cannot activate subscription in state '{current_status}'.")
        sub.status = SubscriptionStatus.ACTIVE
        if not sub.next_billing_date:
            sub.next_billing_date = sub.start_date or today

    elif action == "pause":
        if current_status != SubscriptionStatus.ACTIVE:
            raise ValueError(f"Only ACTIVE subscriptions can be paused (current: '{current_status}').")
        if not sub.allow_pause:
            raise ValueError("This subscription's plan does not allow pausing.")
        sub.status = SubscriptionStatus.PAUSED

    elif action == "resume":
        if current_status != SubscriptionStatus.PAUSED:
            raise ValueError(f"Only PAUSED subscriptions can be resumed (current: '{current_status}').")
        sub.status = SubscriptionStatus.ACTIVE

    elif action == "close":
        if current_status in [SubscriptionStatus.CLOSED]:
            raise ValueError("Subscription is already closed.")
        # Check early close permission if before end_date
        if sub.end_date and today < sub.end_date and not sub.allow_early_close:
            raise ValueError("Plan settings prohibit early closure before the expiry date.")
        sub.status = SubscriptionStatus.CLOSED

    else:
        raise ValueError(f"Unknown action: '{action}'")

    if notes:
        sub.notes = f"{sub.notes}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {notes}".strip() if sub.notes else notes

    await db.commit()
    await db.refresh(sub)
    return sub


async def check_and_auto_close_expired_subscriptions(db: AsyncSession) -> int:
    """Background check: auto close expired subscriptions where auto_close_on_expiry is true."""
    today = date.today()
    stmt = (
        select(Subscription)
        .where(
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED]),
            Subscription.auto_close_on_expiry == True,
            Subscription.end_date != None,
            Subscription.end_date <= today,
        )
    )
    subs = (await db.execute(stmt)).scalars().all()
    closed_count = 0
    for sub in subs:
        sub.status = SubscriptionStatus.CLOSED
        closed_count += 1
    if closed_count > 0:
        await db.commit()
    return closed_count
