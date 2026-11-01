from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class DiscountRuleBase(BaseModel):
    code: str
    name: str
    discount_type: str = "PERCENTAGE"  # FIXED, PERCENTAGE
    value: Decimal = Decimal("0.00")
    scope: str = "ORDER"  # ORDER, PRODUCT
    product_id: Optional[int] = None
    min_spend: Decimal = Decimal("0.00")
    min_quantity: int = 0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_uses: Optional[int] = None
    is_active: bool = True


class DiscountRuleCreate(DiscountRuleBase):
    pass


class DiscountRuleUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    discount_type: Optional[str] = None
    value: Optional[Decimal] = None
    scope: Optional[str] = None
    product_id: Optional[int] = None
    min_spend: Optional[Decimal] = None
    min_quantity: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_uses: Optional[int] = None
    is_active: Optional[bool] = None


class DiscountRuleResponse(DiscountRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    current_uses: int
    created_at: datetime


class ValidateDiscountRequest(BaseModel):
    code: str
    subtotal: Decimal
    total_quantity: int = 1
    product_ids: Optional[List[int]] = None


class ValidateDiscountResponse(BaseModel):
    valid: bool
    discount_rule_id: Optional[int] = None
    code: str
    discount_type: Optional[str] = None
    value: Optional[Decimal] = None
    discount_amount: Decimal = Decimal("0.00")
    message: str
