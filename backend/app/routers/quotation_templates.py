from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_any_authenticated_user, get_staff_or_admin, get_admin_user
from app.models.quotation_template import QuotationTemplate, QuotationTemplateLine
from app.models.user import User
from app.schemas.quotation_template import (
    QuotationTemplateCreate,
    QuotationTemplateResponse,
    QuotationTemplateUpdate,
)

router = APIRouter(prefix="/quotation-templates", tags=["Quotation Templates"])


@router.get("", response_model=List[QuotationTemplateResponse])
async def list_quotation_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(QuotationTemplate)
        .options(
            selectinload(QuotationTemplate.plan),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.product),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.variant),
        )
    )
    templates = (await db.execute(stmt)).scalars().all()
    return templates


@router.post("", response_model=QuotationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation_template(
    payload: QuotationTemplateCreate,
    current_user: User = Depends(get_staff_or_admin),
    db: AsyncSession = Depends(get_db),
):
    template = QuotationTemplate(
        name=payload.name.strip(),
        description=payload.description,
        plan_id=payload.plan_id,
        validity_days=payload.validity_days,
        is_active=payload.is_active,
    )
    db.add(template)
    await db.flush()

    for line_in in payload.lines:
        line = QuotationTemplateLine(
            template_id=template.id,
            product_id=line_in.product_id,
            variant_id=line_in.variant_id,
            quantity=line_in.quantity,
            unit_price_override=line_in.unit_price_override,
            discount_percent=line_in.discount_percent,
        )
        db.add(line)

    await db.commit()
    await db.refresh(template)

    stmt_reload = (
        select(QuotationTemplate)
        .options(
            selectinload(QuotationTemplate.plan),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.product),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.variant),
        )
        .where(QuotationTemplate.id == template.id)
    )
    return (await db.execute(stmt_reload)).scalar_one()


@router.get("/{template_id}", response_model=QuotationTemplateResponse)
async def get_quotation_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = (
        select(QuotationTemplate)
        .options(
            selectinload(QuotationTemplate.plan),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.product),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.variant),
        )
        .where(QuotationTemplate.id == template_id)
    )
    template = (await db.execute(stmt)).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation template not found")
    return template


@router.delete("/{template_id}")
async def delete_quotation_template(
    template_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(QuotationTemplate).where(QuotationTemplate.id == template_id)
    template = (await db.execute(stmt)).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation template not found")
    await db.delete(template)
    await db.commit()
    return {"message": "Quotation template deleted successfully"}
