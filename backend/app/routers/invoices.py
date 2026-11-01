from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_any_authenticated_user, get_staff_or_admin
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.user import User, UserRole
from app.schemas.invoice import InvoiceResponse, InvoiceStatusUpdate
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["Invoices & Billing"])


@router.get("", response_model=List[InvoiceResponse])
async def list_invoices(
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    subscription_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.lines),
            selectinload(Invoice.customer),
        )
        .order_by(Invoice.id.desc())
    )

    # Customers only see their own invoices
    if current_user.role == UserRole.CUSTOMER:
        stmt = stmt.where(Invoice.customer_id == current_user.id)
    elif customer_id:
        stmt = stmt.where(Invoice.customer_id == customer_id)

    if subscription_id:
        stmt = stmt.where(Invoice.subscription_id == subscription_id)
    if status:
        stmt = stmt.where(Invoice.status == status)

    invoices = (await db.execute(stmt)).scalars().all()
    today = date.today()

    # Map overdue flag
    results = []
    for inv in invoices:
        inv_data = InvoiceResponse.model_validate(inv)
        inv_data.is_overdue = (
            inv.status in [InvoiceStatus.CONFIRMED, InvoiceStatus.DRAFT]
            and inv.balance_due > 0
            and inv.due_date < today
        )
        results.append(inv_data)

    return results


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.lines),
            selectinload(Invoice.customer),
        )
        .where(Invoice.id == invoice_id)
    )
    invoice = (await db.execute(stmt)).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if current_user.role == UserRole.CUSTOMER and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    inv_resp = InvoiceResponse.model_validate(invoice)
    inv_resp.is_overdue = (
        invoice.status in [InvoiceStatus.CONFIRMED, InvoiceStatus.DRAFT]
        and invoice.balance_due > 0
        and invoice.due_date < date.today()
    )
    return inv_resp


@router.put("/{invoice_id}/status", response_model=InvoiceResponse)
async def update_invoice_status(
    invoice_id: int,
    payload: InvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.lines),
            selectinload(Invoice.customer),
        )
        .where(Invoice.id == invoice_id)
    )
    invoice = (await db.execute(stmt)).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    new_status = payload.status.upper()
    if new_status not in [InvoiceStatus.CONFIRMED, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid invoice status: {new_status}")

    invoice.status = new_status
    if payload.notes:
        invoice.notes = f"{invoice.notes or ''}\nStatus changed to {new_status}: {payload.notes}".strip()

    await db.commit()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Generates and streams a professional PDF document for downloading and printing."""
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.lines),
            selectinload(Invoice.customer),
        )
        .where(Invoice.id == invoice_id)
    )
    invoice = (await db.execute(stmt)).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if current_user.role == UserRole.CUSTOMER and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    pdf_buffer = generate_invoice_pdf(invoice)
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{invoice.invoice_number}.pdf"',
        },
    )
