from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TaxBase(BaseModel):
    name: str
    rate: Decimal = Decimal("0.00")
    tax_type: str = "FLAT_PERCENT"  # FLAT_PERCENT, COMPOUND
    scope: str = "ALL"  # ALL, SERVICE, SOFTWARE, ADD_ON
    is_active: bool = True


class TaxCreate(TaxBase):
    pass


class TaxUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    tax_type: Optional[str] = None
    scope: Optional[str] = None
    is_active: Optional[bool] = None


class TaxResponse(TaxBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
