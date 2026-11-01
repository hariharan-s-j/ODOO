from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.product import ProductBriefResponse, ProductVariantResponse
from app.schemas.plan import PlanResponse


class QuotationTemplateLineBase(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = 1
    unit_price_override: Optional[Decimal] = None
    discount_percent: Decimal = Decimal("0.00")


class QuotationTemplateLineCreate(QuotationTemplateLineBase):
    pass


class QuotationTemplateLineResponse(QuotationTemplateLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    template_id: int
    product: Optional[ProductBriefResponse] = None
    variant: Optional[ProductVariantResponse] = None


class QuotationTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    plan_id: Optional[int] = None
    validity_days: int = 15
    is_active: bool = True


class QuotationTemplateCreate(QuotationTemplateBase):
    lines: List[QuotationTemplateLineCreate] = []


class QuotationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    plan_id: Optional[int] = None
    validity_days: Optional[int] = None
    is_active: Optional[bool] = None
    lines: Optional[List[QuotationTemplateLineCreate]] = None


class QuotationTemplateResponse(QuotationTemplateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    plan: Optional[PlanResponse] = None
    lines: List[QuotationTemplateLineResponse] = []
