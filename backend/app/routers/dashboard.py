from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_staff_or_admin
from app.models.user import User
from app.schemas.dashboard import AgingReportResponse, DashboardMetrics, RevenueTrendResponse
from app.services.reporting_service import get_aging_report, get_dashboard_metrics, get_revenue_trends

router = APIRouter(prefix="/dashboard", tags=["Finance Dashboard & Reporting"])


@router.get("/metrics", response_model=DashboardMetrics)
async def get_metrics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    """
    High-performance aggregation (<2s response SLA):
    Active Subscriptions, MRR, Total Invoiced, Outstanding/Overdue Receivables.
    """
    return await get_dashboard_metrics(
        db=db,
        start_date=start_date,
        end_date=end_date,
        customer_id=customer_id,
    )


@router.get("/aging-report", response_model=AgingReportResponse)
async def get_aging(
    customer_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    """
    Accounts receivable aging report categorized by days past due:
    0-30 Days, 31-60 Days, 61-90 Days, 90+ Days.
    """
    return await get_aging_report(db=db, customer_id=customer_id)


@router.get("/revenue-trend", response_model=RevenueTrendResponse)
async def get_trend(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_or_admin),
):
    """Monthly revenue and collection trends for the last 6 months."""
    return await get_revenue_trends(db=db)
