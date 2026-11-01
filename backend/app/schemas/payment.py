from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserResponse


class PaymentBase(BaseModel):
    invoice_id: int
    method: str = "CREDIT_CARD"  # CREDIT_CARD, STRIPE, BANK_TRANSFER, CASH
    amount: Decimal
    payment_date: date
    transaction_notes: Optional[str] = None
    reference_code: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentResponse(PaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    payment_number: str
    customer_id: int
    created_at: datetime
    customer: Optional[UserResponse] = None
    invoice_number: Optional[str] = None
