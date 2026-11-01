from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProductType:
    SERVICE = "SERVICE"
    SOFTWARE = "SOFTWARE"
    ADD_ON = "ADD_ON"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    type = Column(String(50), nullable=False, default=ProductType.SOFTWARE, index=True)
    sales_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    cost_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_name = Column(String(100), nullable=False)  # e.g. "Brand", "Tier", "Hosting"
    attribute_value = Column(String(100), nullable=False)  # e.g. "Odoo", "Enterprise", "Cloud"
    price_surcharge = Column(Numeric(12, 2), nullable=False, default=0.00)  # e.g. 560.00
    sku = Column(String(100), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationship
    product = relationship("Product", back_populates="variants")
