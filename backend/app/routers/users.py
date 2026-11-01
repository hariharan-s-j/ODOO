from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_staff_or_admin, get_current_user
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users & Staff Provisioning"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    role: Optional[str] = Query(None),
    current_user: User = Depends(get_staff_or_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User)
    if current_user.role == UserRole.STAFF:
        # STAFF can only view customers
        stmt = stmt.where(User.role == UserRole.CUSTOMER)
    elif role:
        stmt = stmt.where(User.role == role)

    users = (await db.execute(stmt)).scalars().all()
    return users


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(get_staff_or_admin),
    db: AsyncSession = Depends(get_db),
):
    # Rule: Only ADMIN can provision STAFF or ADMIN users
    if payload.role in [UserRole.ADMIN, UserRole.STAFF] and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff cannot provision other staff or admin accounts.",
        )

    # Check duplicate email
    email = payload.email.lower().strip()
    stmt = select(User).where(User.email == email)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    new_user = User(
        email=email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        company_name=payload.company_name.strip() if payload.company_name else None,
        phone=payload.phone.strip() if payload.phone else None,
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Customer can only view themselves
    if current_user.role == UserRole.CUSTOMER and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Permissions check
    if current_user.role == UserRole.CUSTOMER and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # If role is modified, only ADMIN can do it
    if payload.role and payload.role != user.role:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admins can modify user roles")
        user.role = payload.role

    if payload.email:
        user.email = payload.email.lower().strip()
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.company_name is not None:
        user.company_name = payload.company_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.is_active is not None and current_user.role in [UserRole.ADMIN, UserRole.STAFF]:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    await db.commit()
    await db.refresh(user)
    return user
