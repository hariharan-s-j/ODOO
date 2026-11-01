from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.product import ProductBriefResponse, ProductVariantResponse
from app.schemas.plan import PlanResponse
from app.schemas.user import UserResponse


class SubscriptionLineBase(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = 1
    unit_price: Optional[Decimal] = None
    tax_id: Optional[int] = None


class SubscriptionLineCreate(SubscriptionLineBase):
    pass


class SubscriptionLineResponse(SubscriptionLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subscription_id: int
    unit_price: Decimal
    tax_rate: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    product: Optional[ProductBriefResponse] = None
    variant: Optional[ProductVariantResponse] = None


class SubscriptionBase(BaseModel):
    customer_id: int
    plan_id: int
    start_date: date
    end_date: Optional[date] = None
    payment_terms: str = "Immediate"
    notes: Optional[str] = None
    quotation_valid_until: Optional[date] = None
    discount_code: Optional[str] = None


class SubscriptionCreate(SubscriptionBase):
    template_id: Optional[int] = None
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    quotation_valid_until: Optional[date] = None
    discount_code: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionTransitionRequest(BaseModel):
    action: str  # "to_quotation", "confirm", "activate", "pause", "resume", "close"
    notes: Optional[str] = None


class SubscriptionResponse(SubscriptionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subscription_number: str
    status: str
    next_billing_date: Optional[date] = None
    auto_close_on_expiry: bool
    allow_pause: bool
    allow_early_close: bool
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime

    customer: Optional[UserResponse] = None
    plan: Optional[PlanResponse] = None
    lines: List[SubscriptionLineResponse] = []
