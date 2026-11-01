from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserResponse


class InvoiceLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: int
    product_id: Optional[int] = None
    variant_id: Optional[int] = None
    product_name: str
    variant_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    tax_id: Optional[int] = None
    tax_rate: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal


class InvoiceBase(BaseModel):
    customer_id: int
    subscription_id: Optional[int] = None
    issue_date: date
    due_date: date
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    payment_terms: str = "Immediate"
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceStatusUpdate(BaseModel):
    status: str  # "CONFIRMED", "CANCELLED", "PAID"
    notes: Optional[str] = None


class InvoiceResponse(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_number: str
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    idempotency_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    customer: Optional[UserResponse] = None
    lines: List[InvoiceLineResponse] = []
    is_overdue: bool = False
