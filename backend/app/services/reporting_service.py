from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from sqlalchemy import func, select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.plan import Plan, RecurrenceInterval
from app.models.user import User, UserRole
from app.schemas.dashboard import DashboardMetrics, AgingBucket, AgingReportResponse, RevenueTrendPoint, RevenueTrendResponse
from app.schemas.invoice import InvoiceResponse


async def get_dashboard_metrics(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    customer_id: Optional[int] = None,
) -> DashboardMetrics:
    today = date.today()

    # 1. Active Subscriptions query
    active_subs_stmt = select(Subscription).options(selectinload(Subscription.plan)).where(
        Subscription.status == SubscriptionStatus.ACTIVE
    )
    if customer_id:
        active_subs_stmt = active_subs_stmt.where(Subscription.customer_id == customer_id)
    active_subs = (await db.execute(active_subs_stmt)).scalars().all()
    active_subs_count = len(active_subs)

    # 2. MRR Calculation
    mrr = Decimal("0.00")
    for sub in active_subs:
        interval = sub.plan.interval if sub.plan else RecurrenceInterval.MONTHLY
        total = Decimal(str(sub.total_amount))
        if interval == RecurrenceInterval.DAILY:
            mrr += total * Decimal("30")
        elif interval == RecurrenceInterval.WEEKLY:
            mrr += (total * Decimal("52") / Decimal("12")).quantize(Decimal("0.01"))
        elif interval == RecurrenceInterval.YEARLY:
            mrr += (total / Decimal("12")).quantize(Decimal("0.01"))
        else:  # MONTHLY
            mrr += total

    # 3. Invoices query filter
    inv_conditions = [Invoice.status != InvoiceStatus.CANCELLED]
    if customer_id:
        inv_conditions.append(Invoice.customer_id == customer_id)
    if start_date:
        inv_conditions.append(Invoice.issue_date >= start_date)
    if end_date:
        inv_conditions.append(Invoice.issue_date <= end_date)

    inv_stmt = select(
        func.coalesce(func.sum(Invoice.total_amount), 0).label("total_invoiced"),
        func.coalesce(func.sum(Invoice.balance_due), 0).label("outstanding_receivables"),
        func.count(Invoice.id).label("total_invoices_count"),
    ).where(and_(*inv_conditions))

    inv_agg = (await db.execute(inv_stmt)).one()
    total_invoiced = Decimal(str(inv_agg.total_invoiced))
    outstanding = Decimal(str(inv_agg.outstanding_receivables))
    total_invoices_count = inv_agg.total_invoices_count

    # 4. Overdue Receivables (balance_due > 0 and due_date < today and not cancelled)
    overdue_stmt = select(func.coalesce(func.sum(Invoice.balance_due), 0)).where(
        Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.DRAFT]),
        Invoice.balance_due > 0,
        Invoice.due_date < today,
    )
    if customer_id:
        overdue_stmt = overdue_stmt.where(Invoice.customer_id == customer_id)
    overdue_receivables = Decimal(str((await db.execute(overdue_stmt)).scalar() or 0))

    # 5. Total Collected
    pay_conditions = []
    if customer_id:
        pay_conditions.append(Payment.customer_id == customer_id)
    if start_date:
        pay_conditions.append(Payment.payment_date >= start_date)
    if end_date:
        pay_conditions.append(Payment.payment_date <= end_date)

    pay_stmt = select(func.coalesce(func.sum(Payment.amount), 0))
    if pay_conditions:
        pay_stmt = pay_stmt.where(and_(*pay_conditions))
    total_collected = Decimal(str((await db.execute(pay_stmt)).scalar() or 0))

    # 6. Total Customers
    cust_stmt = select(func.count(User.id)).where(User.role == UserRole.CUSTOMER)
    total_customers = (await db.execute(cust_stmt)).scalar() or 0

    return DashboardMetrics(
        active_subscriptions=active_subs_count,
        mrr=mrr.quantize(Decimal("0.01")),
        total_invoiced=total_invoiced.quantize(Decimal("0.01")),
        outstanding_receivables=outstanding.quantize(Decimal("0.01")),
        overdue_receivables=overdue_receivables.quantize(Decimal("0.01")),
        total_collected=total_collected.quantize(Decimal("0.01")),
        total_customers=total_customers,
        total_invoices_count=total_invoices_count,
    )


async def get_aging_report(
    db: AsyncSession,
    customer_id: Optional[int] = None,
) -> AgingReportResponse:
    """
    Computes an accounts receivable aging report categorized by days past due:
    0-30 Days, 31-60 Days, 61-90 Days, 90+ Days.
    """
    today = date.today()

    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.customer),
            selectinload(Invoice.lines),
        )
        .where(
            Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.DRAFT]),
            Invoice.balance_due > 0,
        )
    )
    if customer_id:
        stmt = stmt.where(Invoice.customer_id == customer_id)

    invoices = (await db.execute(stmt)).scalars().all()

    bucket_0_30 = {"count": 0, "amount": Decimal("0.00")}
    bucket_31_60 = {"count": 0, "amount": Decimal("0.00")}
    bucket_61_90 = {"count": 0, "amount": Decimal("0.00")}
    bucket_90_plus = {"count": 0, "amount": Decimal("0.00")}

    total_outstanding = Decimal("0.00")
    total_overdue = Decimal("0.00")
    overdue_invoices_list = []

    for inv in invoices:
        balance = Decimal(str(inv.balance_due))
        total_outstanding += balance

        # Days overdue
        days_past_due = (today - inv.due_date).days
        is_overdue = days_past_due > 0

        if is_overdue:
            total_overdue += balance
            overdue_invoices_list.append(InvoiceResponse.model_validate(inv))

        if days_past_due <= 30:
            bucket_0_30["count"] += 1
            bucket_0_30["amount"] += balance
        elif 31 <= days_past_due <= 60:
            bucket_31_60["count"] += 1
            bucket_31_60["amount"] += balance
        elif 61 <= days_past_due <= 90:
            bucket_61_90["count"] += 1
            bucket_61_90["amount"] += balance
        else:
            bucket_90_plus["count"] += 1
            bucket_90_plus["amount"] += balance

    buckets = [
        AgingBucket(label="0 - 30 Days", count=bucket_0_30["count"], amount=bucket_0_30["amount"]),
        AgingBucket(label="31 - 60 Days", count=bucket_31_60["count"], amount=bucket_31_60["amount"]),
        AgingBucket(label="61 - 90 Days", count=bucket_61_90["count"], amount=bucket_61_90["amount"]),
        AgingBucket(label="90+ Days", count=bucket_90_plus["count"], amount=bucket_90_plus["amount"]),
    ]

    return AgingReportResponse(
        total_overdue=total_overdue,
        total_outstanding=total_outstanding,
        buckets=buckets,
        overdue_invoices=overdue_invoices_list,
    )


async def get_revenue_trends(db: AsyncSession) -> RevenueTrendResponse:
    """Returns monthly trend for the last 6 months."""
    today = date.today()
    points = []

    for i in range(5, -1, -1):
        # Month start and end
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1

        period_label = f"{year}-{month:02d}"
        start_of_month = date(year, month, 1)
        next_month = month + 1
        next_year = year
        if next_month > 12:
            next_month = 1
            next_year += 1
        end_of_month = date(next_year, next_month, 1) - timedelta(days=1)

        # Invoiced in month
        inv_stmt = select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            Invoice.status != InvoiceStatus.CANCELLED,
            Invoice.issue_date >= start_of_month,
            Invoice.issue_date <= end_of_month,
        )
        invoiced = Decimal(str((await db.execute(inv_stmt)).scalar() or 0))

        # Collected in month
        pay_stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.payment_date >= start_of_month,
            Payment.payment_date <= end_of_month,
        )
        collected = Decimal(str((await db.execute(pay_stmt)).scalar() or 0))

        # Active subscriptions at that point
        subs_stmt = select(func.count(Subscription.id)).where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.start_date <= end_of_month,
        )
        active_subs = (await db.execute(subs_stmt)).scalar() or 0

        points.append(
            RevenueTrendPoint(
                period=period_label,
                invoiced=invoiced,
                collected=collected,
                active_subs=active_subs,
            )
        )

    return RevenueTrendResponse(trend=points)
