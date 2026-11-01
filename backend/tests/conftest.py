import asyncio
import os
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Ensure test DB
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ENABLE_SCHEDULER"] = "false"

from app.core.config import settings
settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
settings.ENABLE_SCHEDULER = False

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.user import User, UserRole

# Test engine
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def admin_user(db_session: AsyncSession):
    user = User(
        email="admin_test@brightloop.io",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin Test",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def staff_user(db_session: AsyncSession):
    user = User(
        email="staff_test@brightloop.io",
        hashed_password=get_password_hash("StaffPass123!"),
        full_name="Staff Test",
        role=UserRole.STAFF,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def customer_user(db_session: AsyncSession):
    user = User(
        email="customer_test@client.com",
        hashed_password=get_password_hash("CustPass123!"),
        full_name="Customer Test",
        company_name="Test Client Corp",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def admin_headers(admin_user: User):
    token = create_access_token(admin_user.id, extra_claims={"role": admin_user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def staff_headers(staff_user: User):
    token = create_access_token(staff_user.id, extra_claims={"role": staff_user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def customer_headers(customer_user: User):
    token = create_access_token(customer_user.id, extra_claims={"role": customer_user.role})
    return {"Authorization": f"Bearer {token}"}
