from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String
from app.core.database import Base


class TaxType:
    FLAT_PERCENT = "FLAT_PERCENT"
    COMPOUND = "COMPOUND"


class TaxScope:
    ALL = "ALL"
    SERVICE = "SERVICE"
    SOFTWARE = "SOFTWARE"
    ADD_ON = "ADD_ON"


class Tax(Base):
    __tablename__ = "taxes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    rate = Column(Numeric(5, 2), nullable=False, default=0.00)  # e.g. 10.00 for 10%
    tax_type = Column(String(50), nullable=False, default=TaxType.FLAT_PERCENT)
    scope = Column(String(50), nullable=False, default=TaxScope.ALL)  # ALL, SERVICE, SOFTWARE, ADD_ON
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
