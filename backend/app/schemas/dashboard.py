from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.invoice import InvoiceResponse


class DashboardMetrics(BaseModel):
    active_subscriptions: int
    mrr: Decimal
    total_invoiced: Decimal
    outstanding_receivables: Decimal
    overdue_receivables: Decimal
    total_collected: Decimal
    total_customers: int
    total_invoices_count: int


class AgingBucket(BaseModel):
    label: str  # "0 - 30 Days", "31 - 60 Days", "61 - 90 Days", "90+ Days"
    count: int
    amount: Decimal


class AgingReportResponse(BaseModel):
    total_overdue: Decimal
    total_outstanding: Decimal
    buckets: List[AgingBucket]
    overdue_invoices: List[InvoiceResponse]


class RevenueTrendPoint(BaseModel):
    period: str
    invoiced: Decimal
    collected: Decimal
    active_subs: int


class RevenueTrendResponse(BaseModel):
    trend: List[RevenueTrendPoint]
