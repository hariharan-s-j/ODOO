from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_any_authenticated_user
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.schemas.product import (
    PriceCalculateRequest,
    PriceCalculateResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
    ProductVariantUpdate,
)
from app.services.pricing_engine import calculate_line_price

router = APIRouter(prefix="/products", tags=["Product Catalog & Variants"])


@router.get("", response_model=List[ProductResponse])
async def list_products(
    type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = select(Product).options(selectinload(Product.variants))
    if type:
        stmt = stmt.where(Product.type == type)
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)

    products = (await db.execute(stmt)).scalars().all()
    return products


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate code
    stmt = select(Product).where(Product.code == payload.code.strip())
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A product with code '{payload.code}' already exists.",
        )

    product = Product(
        name=payload.name.strip(),
        code=payload.code.strip(),
        type=payload.type,
        sales_price=payload.sales_price,
        cost_price=payload.cost_price,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(product)
    await db.flush()

    if payload.variants:
        for v in payload.variants:
            variant = ProductVariant(
                product_id=product.id,
                attribute_name=v.attribute_name.strip(),
                attribute_value=v.attribute_value.strip(),
                price_surcharge=v.price_surcharge,
                sku=v.sku.strip() if v.sku else None,
                is_active=v.is_active,
            )
            db.add(variant)

    await db.commit()
    await db.refresh(product)
    # Reload with variants
    stmt_load = select(Product).options(selectinload(Product.variants)).where(Product.id == product.id)
    return (await db.execute(stmt_load)).scalar_one()


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    stmt = select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.code is not None:
        product.code = payload.code.strip()
    if payload.type is not None:
        product.type = payload.type
    if payload.sales_price is not None:
        product.sales_price = payload.sales_price
    if payload.cost_price is not None:
        product.cost_price = payload.cost_price
    if payload.notes is not None:
        product.notes = payload.notes
    if payload.is_active is not None:
        product.is_active = payload.is_active

    await db.commit()
    await db.refresh(product)
    return product


@router.post("/{product_id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
async def add_product_variant(
    product_id: int,
    payload: ProductVariantCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).where(Product.id == product_id)
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    variant = ProductVariant(
        product_id=product.id,
        attribute_name=payload.attribute_name.strip(),
        attribute_value=payload.attribute_value.strip(),
        price_surcharge=payload.price_surcharge,
        sku=payload.sku.strip() if payload.sku else None,
        is_active=payload.is_active,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.delete("/variants/{variant_id}")
async def delete_product_variant(
    variant_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductVariant).where(ProductVariant.id == variant_id)
    variant = (await db.execute(stmt)).scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")
    await db.delete(variant)
    await db.commit()
    return {"message": "Variant deleted successfully"}


@router.post("/calculate-price", response_model=PriceCalculateResponse)
async def calculate_dynamic_price(
    payload: PriceCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Dynamic pricing engine endpoint:
    Calculates base price, variant surcharges (e.g. Odoo brand +$560),
    quantity multiples, and tax & discount estimates.
    """
    try:
        # If variant_ids passed, select primary variant
        primary_var_id = payload.variant_ids[0] if payload.variant_ids else None
        calc = await calculate_line_price(
            db=db,
            product_id=payload.product_id,
            variant_id=primary_var_id,
            quantity=payload.quantity,
        )

        return PriceCalculateResponse(
            product_id=calc["product_id"],
            product_name=calc["product_name"],
            base_price=calc["base_price"],
            surcharges=calc["surcharges"],
            unit_price=calc["unit_price"],
            quantity=calc["quantity"],
            subtotal=calc["subtotal"],
            discount_amount=calc["discount_amount"],
            tax_estimate=calc["tax_amount"],
            estimated_total=calc["total_amount"],
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
