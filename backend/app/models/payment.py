from datetime import datetime, timezone
from sqlalchemy import Column, Date, DateTime, Integer, Numeric, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class PaymentMethod:
    CREDIT_CARD = "CREDIT_CARD"
    STRIPE = "STRIPE"
    BANK_TRANSFER = "BANK_TRANSFER"
    CASH = "CASH"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String(100), unique=True, index=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    method = Column(String(50), nullable=False, default=PaymentMethod.CREDIT_CARD, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)
    transaction_notes = Column(Text, nullable=True)
    reference_code = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    customer = relationship("User", back_populates="payments")
