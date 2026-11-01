from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class DiscountType:
    FIXED = "FIXED"
    PERCENTAGE = "PERCENTAGE"


class DiscountScope:
    ORDER = "ORDER"
    PRODUCT = "PRODUCT"


class DiscountRule(Base):
    __tablename__ = "discount_rules"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    discount_type = Column(String(50), nullable=False, default=DiscountType.PERCENTAGE)
    value = Column(Numeric(12, 2), nullable=False, default=0.00)  # e.g. 10% or $50.00
    scope = Column(String(50), nullable=False, default=DiscountScope.ORDER)  # ORDER or PRODUCT
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    min_spend = Column(Numeric(12, 2), nullable=False, default=0.00)
    min_quantity = Column(Integer, nullable=False, default=0)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    max_uses = Column(Integer, nullable=True)  # None = unlimited
    current_uses = Column(Integer, nullable=False, default=0)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    product = relationship("Product")
