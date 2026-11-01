from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_any_authenticated_user
from app.models.tax import Tax
from app.models.user import User
from app.schemas.tax import TaxCreate, TaxResponse, TaxUpdate

router = APIRouter(prefix="/taxes", tags=["Tax Engine"])


@router.get("", response_model=List[TaxResponse])
async def list_taxes(
    scope: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = select(Tax)
    if scope:
        stmt = stmt.where(Tax.scope == scope)
    if is_active is not None:
        stmt = stmt.where(Tax.is_active == is_active)

    taxes = (await db.execute(stmt)).scalars().all()
    return taxes


@router.post("", response_model=TaxResponse, status_code=status.HTTP_201_CREATED)
async def create_tax(
    payload: TaxCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    tax = Tax(
        name=payload.name.strip(),
        rate=payload.rate,
        tax_type=payload.tax_type,
        scope=payload.scope,
        is_active=payload.is_active,
    )
    db.add(tax)
    await db.commit()
    await db.refresh(tax)
    return tax


@router.get("/{tax_id}", response_model=TaxResponse)
async def get_tax(
    tax_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = select(Tax).where(Tax.id == tax_id)
    tax = (await db.execute(stmt)).scalar_one_or_none()
    if not tax:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rule not found")
    return tax


@router.put("/{tax_id}", response_model=TaxResponse)
async def update_tax(
    tax_id: int,
    payload: TaxUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tax).where(Tax.id == tax_id)
    tax = (await db.execute(stmt)).scalar_one_or_none()
    if not tax:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rule not found")

    if payload.name is not None:
        tax.name = payload.name.strip()
    if payload.rate is not None:
        tax.rate = payload.rate
    if payload.tax_type is not None:
        tax.tax_type = payload.tax_type
    if payload.scope is not None:
        tax.scope = payload.scope
    if payload.is_active is not None:
        tax.is_active = payload.is_active

    await db.commit()
    await db.refresh(tax)
    return tax
