from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_staff_or_admin
from app.models.invoice import BillingSchedule
from app.models.user import User
from app.schemas.invoice import InvoiceResponse
from app.services.billing_engine import run_automated_recurring_billing

router = APIRouter(prefix="/billing", tags=["Billing Engine Automation"])


@router.post("/run-now", response_model=List[InvoiceResponse])
async def trigger_billing_run(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    """Manually triggers the automated recurring billing engine run."""
    invoices = await run_automated_recurring_billing(db)
    return [InvoiceResponse.model_validate(inv) for inv in invoices]


@router.get("/schedules")
async def get_billing_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    """Inspects billing schedule logs and idempotency records."""
    stmt = select(BillingSchedule).order_by(BillingSchedule.id.desc()).limit(100)
    records = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "subscription_id": r.subscription_id,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "invoice_id": r.invoice_id,
            "idempotency_key": r.idempotency_key,
            "created_at": r.created_at,
        }
        for r in records
    ]
