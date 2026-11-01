from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PlanBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    interval: str = "MONTHLY"  # DAILY, WEEKLY, MONTHLY, YEARLY
    cost: Decimal = Decimal("0.00")
    minimum_quantity: int = 1
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    auto_close_on_expiry: bool = True
    allow_pause: bool = True
    allow_early_close: bool = True
    is_active: bool = True


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    interval: Optional[str] = None
    cost: Optional[Decimal] = None
    minimum_quantity: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    auto_close_on_expiry: Optional[bool] = None
    allow_pause: Optional[bool] = None
    allow_early_close: Optional[bool] = None
    is_active: Optional[bool] = None


class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
