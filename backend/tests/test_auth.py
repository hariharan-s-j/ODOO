import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login_success(client: AsyncClient):
    # Register customer
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "StrongPassword123!",
            "full_name": "New User",
            "company_name": "New Ventures Inc",
        },
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["role"] == "CUSTOMER"

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "newuser@example.com",
            "password": "StrongPassword123!",
        },
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "newuser@example.com"


@pytest.mark.asyncio
async def test_password_validation_rules(client: AsyncClient):
    # Too short (<8)
    r1 = await client.post(
        "/api/v1/auth/register",
        json={"email": "bad1@test.com", "password": "Short1!", "full_name": "Bad"},
    )
    assert r1.status_code == 422

    # No uppercase
    r2 = await client.post(
        "/api/v1/auth/register",
        json={"email": "bad2@test.com", "password": "nouppercase123!", "full_name": "Bad"},
    )
    assert r2.status_code == 422

    # No special character
    r3 = await client.post(
        "/api/v1/auth/register",
        json={"email": "bad3@test.com", "password": "NoSpecialChar123", "full_name": "Bad"},
    )
    assert r3.status_code == 422


@pytest.mark.asyncio
async def test_password_reset_flow(client: AsyncClient, customer_user):
    # Request reset
    forgot_resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": customer_user.email},
    )
    assert forgot_resp.status_code == 200
    data = forgot_resp.json()
    assert data["simulated_email_dispatched"] is True
    token = data["reset_token"]
    assert token is not None

    # Reset password with token
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewSecretPassword2026!"},
    )
    assert reset_resp.status_code == 200

    # Login with new password
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": customer_user.email, "password": "NewSecretPassword2026!"},
    )
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_rbac_restrictions(client: AsyncClient, customer_headers, staff_headers, admin_headers):
    # Customer cannot access users list
    r_cust = await client.get("/api/v1/users", headers=customer_headers)
    assert r_cust.status_code == 403

    # Staff cannot provision staff or admin accounts
    r_staff_create = await client.post(
        "/api/v1/users",
        headers=staff_headers,
        json={
            "email": "illegal_staff@brightloop.io",
            "password": "Password123!",
            "full_name": "Illegal Staff",
            "role": "STAFF",
        },
    )
    assert r_staff_create.status_code == 403

    # Admin CAN provision staff accounts
    r_admin_create = await client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={
            "email": "legal_staff@brightloop.io",
            "password": "Password123!",
            "full_name": "Legal Staff",
            "role": "STAFF",
        },
    )
    assert r_admin_create.status_code == 201
    assert r_admin_create.json()["role"] == "STAFF"
