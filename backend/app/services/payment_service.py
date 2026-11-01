from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentMethod


async def generate_payment_number(db: AsyncSession) -> str:
    """Generate sequential payment number like PAY-2026-0001."""
    year = datetime.now().year
    prefix = f"PAY-{year}-"
    stmt = select(func.count(Payment.id)).where(Payment.payment_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    return f"{prefix}{count + 1:04d}"


async def record_payment(
    db: AsyncSession,
    invoice_id: int,
    amount: Decimal,
    method: str = PaymentMethod.CREDIT_CARD,
    payment_date: Optional[date] = None,
    transaction_notes: Optional[str] = None,
    reference_code: Optional[str] = None,
) -> Tuple[Payment, Invoice]:
    """
    Records a payment against an invoice with support for partial payments.
    Updates the invoice amount_paid and balance_due.
    If balance_due <= 0, automatically flips invoice status to PAID.
    """
    if amount <= Decimal("0.00"):
        raise ValueError("Payment amount must be greater than zero")

    stmt = select(Invoice).where(Invoice.id == invoice_id)
    invoice = (await db.execute(stmt)).scalar_one_or_none()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValueError("Cannot record payment on a CANCELLED invoice")

    if invoice.status == InvoiceStatus.PAID and invoice.balance_due <= Decimal("0.00"):
        raise ValueError("Invoice is already fully paid")

    pay_date = payment_date or date.today()
    pay_number = await generate_payment_number(db)

    payment = Payment(
        payment_number=pay_number,
        invoice_id=invoice.id,
        customer_id=invoice.customer_id,
        method=method,
        amount=amount,
        payment_date=pay_date,
        transaction_notes=transaction_notes,
        reference_code=reference_code,
    )
    db.add(payment)
    await db.flush()

    # Calculate new amount_paid and balance_due
    new_amount_paid = Decimal(str(invoice.amount_paid)) + amount
    new_balance_due = max(Decimal("0.00"), Decimal(str(invoice.total_amount)) - new_amount_paid)

    invoice.amount_paid = new_amount_paid
    invoice.balance_due = new_balance_due

    # If completely paid off, update state to PAID
    if new_balance_due <= Decimal("0.00"):
        invoice.status = InvoiceStatus.PAID
    elif invoice.status == InvoiceStatus.DRAFT:
        # If paying a draft, confirm it
        invoice.status = InvoiceStatus.CONFIRMED

    await db.commit()
    await db.refresh(payment)
    await db.refresh(invoice)

    return payment, invoice
