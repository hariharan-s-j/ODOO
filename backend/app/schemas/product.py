from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ProductVariantBase(BaseModel):
    attribute_name: str
    attribute_value: str
    price_surcharge: Decimal = Decimal("0.00")
    sku: Optional[str] = None
    is_active: bool = True


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantUpdate(BaseModel):
    attribute_name: Optional[str] = None
    attribute_value: Optional[str] = None
    price_surcharge: Optional[Decimal] = None
    sku: Optional[str] = None
    is_active: Optional[bool] = None


class ProductVariantResponse(ProductVariantBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int


class ProductBase(BaseModel):
    name: str
    code: str
    type: str = "SOFTWARE"  # SERVICE, SOFTWARE, ADD_ON
    sales_price: Decimal = Decimal("0.00")
    cost_price: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    is_active: bool = True


class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    sales_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ProductBriefResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    variants: List[ProductVariantResponse] = []


class PriceCalculateRequest(BaseModel):
    product_id: int
    variant_ids: Optional[List[int]] = None
    quantity: int = 1
    discount_code: Optional[str] = None


class PriceCalculateResponse(BaseModel):
    product_id: int
    product_name: str
    base_price: Decimal
    surcharges: Decimal
    unit_price: Decimal
    quantity: int
    subtotal: Decimal
    discount_amount: Decimal
    tax_estimate: Decimal
    estimated_total: Decimal
