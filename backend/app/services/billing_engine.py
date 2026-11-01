from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus, BillingSchedule
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus
from app.models.plan import Plan, RecurrenceInterval
from app.services.discount_engine import evaluate_discount_rule, increment_discount_usage
from app.services.subscription_service import calculate_next_billing_date


async def generate_invoice_number(db: AsyncSession) -> str:
    """Generate sequential invoice number like INV-2026-0001."""
    year = datetime.now().year
    prefix = f"INV-{year}-"
    stmt = select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    return f"{prefix}{count + 1:04d}"


def calculate_due_date(issue_date: date, payment_terms: str) -> date:
    """Calculates invoice due date based on payment terms."""
    terms = payment_terms.lower()
    if "15" in terms:
        return issue_date + timedelta(days=15)
    elif "30" in terms:
        return issue_date + timedelta(days=30)
    elif "60" in terms:
        return issue_date + timedelta(days=60)
    elif "immediate" in terms or "due on receipt" in terms:
        return issue_date
    return issue_date + timedelta(days=14)  # default 14 days


def compute_billing_period(start_date: date, interval: str) -> Tuple[date, date]:
    """Calculates (period_start, period_end) for a recurring period."""
    if interval == RecurrenceInterval.DAILY:
        return start_date, start_date + timedelta(days=1)
    elif interval == RecurrenceInterval.WEEKLY:
        return start_date, start_date + timedelta(days=6)
    elif interval == RecurrenceInterval.YEARLY:
        try:
            end = start_date.replace(year=start_date.year + 1) - timedelta(days=1)
        except ValueError:
            end = start_date + timedelta(days=364)
        return start_date, end
    else:  # MONTHLY
        month = start_date.month + 1
        year = start_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(start_date.day, 28)
        next_month_date = date(year, month, day)
        return start_date, next_month_date - timedelta(days=1)


async def generate_invoice_for_subscription(
    db: AsyncSession,
    subscription_id: int,
    issue_date: Optional[date] = None,
    force: bool = False,
) -> Optional[Invoice]:
    """
    Idempotently creates an invoice for a subscription period.
    Guarantee: Checks both `BillingSchedule` and `Invoice.idempotency_key`
    to completely prevent double-billing.
    """
    today = issue_date or date.today()
    stmt = (
        select(Subscription)
        .options(
            selectinload(Subscription.lines).selectinload(SubscriptionLine.product),
            selectinload(Subscription.lines).selectinload(SubscriptionLine.variant),
            selectinload(Subscription.lines).selectinload(SubscriptionLine.tax),
            selectinload(Subscription.plan),
            selectinload(Subscription.customer),
        )
        .where(Subscription.id == subscription_id)
    )
    sub = (await db.execute(stmt)).scalar_one_or_none()
    if not sub:
        raise ValueError(f"Subscription {subscription_id} not found")

    if sub.status != SubscriptionStatus.ACTIVE and not force:
        raise ValueError(f"Cannot bill subscription in status '{sub.status}'. Must be ACTIVE.")

    # If not forcing billing and subscription is not due (already billed for current cycle), return existing invoice
    if not force and sub.next_billing_date and sub.next_billing_date > today:
        latest_inv_stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.lines),
                selectinload(Invoice.customer),
            )
            .where(Invoice.subscription_id == sub.id)
            .order_by(Invoice.id.desc())
        )
        latest_inv = (await db.execute(latest_inv_stmt)).scalars().first()
        if latest_inv:
            return latest_inv

    # Determine billing period
    period_start = sub.next_billing_date or sub.start_date or today
    interval = sub.plan.interval if sub.plan else RecurrenceInterval.MONTHLY
    _, period_end = compute_billing_period(period_start, interval)

    # Idempotency key uniquely represents the subscription + billing window
    idempotency_key = f"BILLING:SUB-{sub.id}:{period_start.isoformat()}:{period_end.isoformat()}"

    # Check if this exact period has already been billed
    sched_stmt = select(BillingSchedule).where(BillingSchedule.idempotency_key == idempotency_key)
    existing_sched = (await db.execute(sched_stmt)).scalar_one_or_none()
    if existing_sched and not force:
        # Already billed - retrieve existing invoice and return it safely (Idempotency)
        if existing_sched.invoice_id:
            inv_stmt = select(Invoice).where(Invoice.id == existing_sched.invoice_id)
            existing_inv = (await db.execute(inv_stmt)).scalar_one_or_none()
            if existing_inv:
                return existing_inv

    # Check directly on invoice table idempotency key as secondary safeguard
    inv_dup_stmt = select(Invoice).where(Invoice.idempotency_key == idempotency_key)
    existing_inv = (await db.execute(inv_dup_stmt)).scalar_one_or_none()
    if existing_inv and not force:
        return existing_inv

    # Generate new invoice
    inv_number = await generate_invoice_number(db)
    due_date = calculate_due_date(today, sub.payment_terms)

    invoice = Invoice(
        invoice_number=inv_number,
        customer_id=sub.customer_id,
        subscription_id=sub.id,
        status=InvoiceStatus.CONFIRMED,  # Automatically confirmed ready for payment
        issue_date=today,
        due_date=due_date,
        period_start=period_start,
        period_end=period_end,
        payment_terms=sub.payment_terms,
        notes=f"Automated recurring billing for {sub.subscription_number} ({period_start} to {period_end})",
        idempotency_key=idempotency_key,
    )
    db.add(invoice)
    await db.flush()

    subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")
    raw_lines = []

    for s_line in sub.lines:
        inv_line = InvoiceLine(
            invoice_id=invoice.id,
            product_id=s_line.product_id,
            variant_id=s_line.variant_id,
            product_name=s_line.product.name if s_line.product else "Service Item",
            variant_name=f"{s_line.variant.attribute_name}: {s_line.variant.attribute_value}" if s_line.variant else None,
            quantity=s_line.quantity,
            unit_price=s_line.unit_price,
            subtotal=s_line.subtotal,
            tax_id=s_line.tax_id,
            tax_rate=s_line.tax_rate,
            tax_amount=s_line.tax_amount,
            discount_amount=s_line.discount_amount,
            total_amount=s_line.total_amount,
        )
        db.add(inv_line)
        subtotal += s_line.subtotal
        total_tax += s_line.tax_amount
        raw_lines.append({
            "product_id": s_line.product_id,
            "subtotal": s_line.subtotal,
            "quantity": s_line.quantity,
        })

    # Apply discounts
    discount_amount = Decimal("0.00")
    if sub.discount_code:
        valid, rule, d_amt, _ = await evaluate_discount_rule(
            db=db,
            code=sub.discount_code,
            order_subtotal=subtotal,
            total_quantity=sum(l.quantity for l in sub.lines),
            line_items=raw_lines,
        )
        if valid and rule:
            discount_amount = d_amt
            # Increment discount usage
            await increment_discount_usage(db, rule.id)

    total_amount = max(Decimal("0.00"), subtotal - discount_amount + total_tax)

    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.tax_amount = total_tax
    invoice.total_amount = total_amount
    invoice.amount_paid = Decimal("0.00")
    invoice.balance_due = total_amount

    # Record BillingSchedule entry to lock idempotency
    schedule_entry = BillingSchedule(
        subscription_id=sub.id,
        period_start=period_start,
        period_end=period_end,
        invoice_id=invoice.id,
        idempotency_key=idempotency_key,
    )
    db.add(schedule_entry)

    # Advance subscription's next billing date
    next_date = calculate_next_billing_date(period_start, interval)
    sub.next_billing_date = next_date

    await db.commit()
    await db.refresh(invoice)
    return invoice


async def run_automated_recurring_billing(db: AsyncSession) -> List[Invoice]:
    """
    Scans all ACTIVE subscriptions whose next_billing_date <= today
    and generates invoices for them idempotently.
    """
    today = date.today()
    stmt = (
        select(Subscription.id)
        .where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.next_billing_date != None,
            Subscription.next_billing_date <= today,
        )
    )
    due_sub_ids = (await db.execute(stmt)).scalars().all()

    generated_invoices = []
    for sub_id in due_sub_ids:
        try:
            inv = await generate_invoice_for_subscription(db, sub_id, issue_date=today)
            if inv:
                generated_invoices.append(inv)
        except Exception as e:
            # Continue processing others without failing entire batch
            print(f"Error billing subscription {sub_id}: {str(e)}")

    return generated_invoices
