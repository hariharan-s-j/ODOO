from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.discount import DiscountRule, DiscountType, DiscountScope


async def evaluate_discount_rule(
    db: AsyncSession,
    code: str,
    order_subtotal: Decimal,
    total_quantity: int = 1,
    line_items: Optional[List[dict]] = None,
) -> Tuple[bool, Optional[DiscountRule], Decimal, str]:
    """
    Validates a discount rule and returns (is_valid, discount_rule, calculated_discount, message).
    """
    if not code:
        return False, None, Decimal("0.00"), "No discount code provided"

    stmt = select(DiscountRule).where(
        DiscountRule.code.ilike(code.strip()),
        DiscountRule.is_active == True,
    )
    res = await db.execute(stmt)
    rule = res.scalar_one_or_none()

    if not rule:
        return False, None, Decimal("0.00"), f"Discount code '{code}' is invalid or inactive"

    today = date.today()

    # Check date window
    if rule.start_date and today < rule.start_date:
        return False, rule, Decimal("0.00"), f"Discount code '{code}' is not active yet (starts {rule.start_date})"
    if rule.end_date and today > rule.end_date:
        return False, rule, Decimal("0.00"), f"Discount code '{code}' has expired (ended {rule.end_date})"

    # Check max usage limit
    if rule.max_uses is not None and rule.current_uses >= rule.max_uses:
        return False, rule, Decimal("0.00"), f"Discount code '{code}' has reached its maximum usage limit ({rule.max_uses})"

    # Check minimum spend
    if order_subtotal < Decimal(str(rule.min_spend)):
        return (
            False,
            rule,
            Decimal("0.00"),
            f"Minimum spend of ${rule.min_spend:.2f} required for discount '{code}' (current: ${order_subtotal:.2f})",
        )

    # Check minimum quantity
    if total_quantity < rule.min_quantity:
        return (
            False,
            rule,
            Decimal("0.00"),
            f"Minimum quantity of {rule.min_quantity} items required for discount '{code}' (current: {total_quantity})",
        )

    # Calculate discount amount based on scope
    discount_val = Decimal(str(rule.value))
    calculated_discount = Decimal("0.00")

    if rule.scope == DiscountScope.PRODUCT:
        # Applies only to specific product SKU / ID
        if not rule.product_id:
            return False, rule, Decimal("0.00"), "Discount rule configured for PRODUCT scope but no product specified"

        applicable_subtotal = Decimal("0.00")
        if line_items:
            for item in line_items:
                if item.get("product_id") == rule.product_id:
                    applicable_subtotal += Decimal(str(item.get("subtotal", 0.00)))

        if applicable_subtotal <= Decimal("0.00"):
            return (
                False,
                rule,
                Decimal("0.00"),
                f"Discount '{code}' applies only to product ID {rule.product_id}, which is not in this order",
            )

        if rule.discount_type == DiscountType.PERCENTAGE:
            calculated_discount = (applicable_subtotal * discount_val / Decimal("100.00")).quantize(Decimal("0.01"))
        else:
            calculated_discount = min(discount_val, applicable_subtotal)

    else:
        # ORDER scope - applies to the entire order subtotal
        if rule.discount_type == DiscountType.PERCENTAGE:
            calculated_discount = (order_subtotal * discount_val / Decimal("100.00")).quantize(Decimal("0.01"))
        else:
            calculated_discount = min(discount_val, order_subtotal)

    calculated_discount = max(Decimal("0.00"), calculated_discount)

    return True, rule, calculated_discount, f"Discount '{code}' applied successfully: -${calculated_discount:.2f}"


async def increment_discount_usage(db: AsyncSession, rule_id: int) -> None:
    stmt = select(DiscountRule).where(DiscountRule.id == rule_id)
    res = await db.execute(stmt)
    rule = res.scalar_one_or_none()
    if rule:
        rule.current_uses += 1
        await db.commit()
