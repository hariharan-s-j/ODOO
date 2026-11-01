from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_any_authenticated_user, get_staff_or_admin
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.user import User, UserRole
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import record_payment

router = APIRouter(prefix="/payments", tags=["Payments & Collections"])


@router.get("", response_model=List[PaymentResponse])
async def list_payments(
    customer_id: Optional[int] = Query(None),
    invoice_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(Payment)
        .options(
            selectinload(Payment.customer),
            selectinload(Payment.invoice),
        )
        .order_by(Payment.id.desc())
    )

    if current_user.role == UserRole.CUSTOMER:
        stmt = stmt.where(Payment.customer_id == current_user.id)
    elif customer_id:
        stmt = stmt.where(Payment.customer_id == customer_id)

    if invoice_id:
        stmt = stmt.where(Payment.invoice_id == invoice_id)

    payments = (await db.execute(stmt)).scalars().all()

    results = []
    for p in payments:
        resp = PaymentResponse.model_validate(p)
        if p.invoice:
            resp.invoice_number = p.invoice.invoice_number
        results.append(resp)

    return results


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    # Check invoice access
    stmt = select(Invoice).where(Invoice.id == payload.invoice_id)
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if current_user.role == UserRole.CUSTOMER and inv.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        payment, updated_invoice = await record_payment(
            db=db,
            invoice_id=payload.invoice_id,
            amount=payload.amount,
            method=payload.method,
            payment_date=payload.payment_date,
            transaction_notes=payload.transaction_notes,
            reference_code=payload.reference_code,
        )

        stmt_reload = (
            select(Payment)
            .options(
                selectinload(Payment.customer),
                selectinload(Payment.invoice),
            )
            .where(Payment.id == payment.id)
        )
        p = (await db.execute(stmt_reload)).scalar_one()
        resp = PaymentResponse.model_validate(p)
        resp.invoice_number = updated_invoice.invoice_number
        return resp
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(Payment)
        .options(
            selectinload(Payment.customer),
            selectinload(Payment.invoice),
        )
        .where(Payment.id == payment_id)
    )
    p = (await db.execute(stmt)).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if current_user.role == UserRole.CUSTOMER and p.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    resp = PaymentResponse.model_validate(p)
    if p.invoice:
        resp.invoice_number = p.invoice.invoice_number
    return resp
