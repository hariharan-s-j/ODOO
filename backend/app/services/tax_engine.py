from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tax import Tax, TaxScope, TaxType
from app.models.product import Product


async def get_applicable_taxes_for_product(db: AsyncSession, product: Product) -> List[Tax]:
    """Find active taxes that apply to the product based on scope."""
    stmt = select(Tax).where(
        Tax.is_active == True,
        Tax.scope.in_([TaxScope.ALL, product.type])
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


def calculate_tax(amount: Decimal, tax: Tax) -> Decimal:
    """Calculate tax for a given base amount."""
    if not tax.is_active or tax.rate <= Decimal("0.00"):
        return Decimal("0.00")
    rate = Decimal(str(tax.rate))
    return (amount * rate / Decimal("100.00")).quantize(Decimal("0.01"))
