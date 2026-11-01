from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product, ProductVariant
from app.models.tax import Tax, TaxScope
from app.models.discount import DiscountRule, DiscountType, DiscountScope


async def calculate_line_price(
    db: AsyncSession,
    product_id: int,
    variant_id: Optional[int] = None,
    quantity: int = 1,
    unit_price_override: Optional[Decimal] = None,
    tax_id: Optional[int] = None,
    discount_percent: Decimal = Decimal("0.00"),
) -> dict:
    # 1. Fetch product
    prod_stmt = select(Product).where(Product.id == product_id)
    prod_res = await db.execute(prod_stmt)
    product = prod_res.scalar_one_or_none()
    if not product:
        raise ValueError(f"Product with ID {product_id} not found")

    base_price = Decimal(str(product.sales_price))
    surcharge = Decimal("0.00")

    # 2. Check variant surcharge (e.g. Odoo brand +$560)
    variant_obj = None
    if variant_id:
        var_stmt = select(ProductVariant).where(ProductVariant.id == variant_id, ProductVariant.product_id == product_id)
        var_res = await db.execute(var_stmt)
        variant_obj = var_res.scalar_one_or_none()
        if variant_obj:
            surcharge = Decimal(str(variant_obj.price_surcharge))

    # Unit price
    if unit_price_override is not None:
        unit_price = Decimal(str(unit_price_override))
    else:
        unit_price = base_price + surcharge

    subtotal = unit_price * Decimal(str(quantity))

    # Line discount
    line_discount = Decimal("0.00")
    if discount_percent > Decimal("0.00"):
        line_discount = (subtotal * discount_percent / Decimal("100.00")).quantize(Decimal("0.01"))

    taxable_amount = max(Decimal("0.00"), subtotal - line_discount)

    # Tax calculation
    tax_rate = Decimal("0.00")
    tax_amount = Decimal("0.00")
    if tax_id:
        tax_stmt = select(Tax).where(Tax.id == tax_id, Tax.is_active == True)
        tax_res = await db.execute(tax_stmt)
        tax_obj = tax_res.scalar_one_or_none()
        if tax_obj:
            tax_rate = Decimal(str(tax_obj.rate))
            tax_amount = (taxable_amount * tax_rate / Decimal("100.00")).quantize(Decimal("0.01"))

    total_amount = taxable_amount + tax_amount

    return {
        "product_id": product.id,
        "product_name": product.name,
        "product_type": product.type,
        "variant_id": variant_obj.id if variant_obj else None,
        "variant_name": f"{variant_obj.attribute_name}: {variant_obj.attribute_value}" if variant_obj else None,
        "base_price": base_price,
        "surcharges": surcharge,
        "unit_price": unit_price,
        "quantity": quantity,
        "subtotal": subtotal,
        "discount_amount": line_discount,
        "tax_id": tax_id,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
    }
