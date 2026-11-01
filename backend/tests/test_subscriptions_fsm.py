from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_subscription_lifecycle_fsm(client: AsyncClient, admin_headers, customer_user):
    # 1. Create Product & Plan
    prod_resp = await client.post(
        "/api/v1/products",
        headers=admin_headers,
        json={
            "name": "Cloud Core",
            "code": "SW-CC-01",
            "type": "SOFTWARE",
            "sales_price": "200.00",
            "cost_price": "50.00",
        },
    )
    prod_id = prod_resp.json()["id"]

    plan_resp = await client.post(
        "/api/v1/plans",
        headers=admin_headers,
        json={
            "name": "Standard Monthly",
            "code": "PLAN-STD-MONTHLY",
            "interval": "MONTHLY",
            "cost": "0.00",
            "minimum_quantity": 1,
            "allow_pause": True,
            "allow_early_close": True,
            "auto_close_on_expiry": False,
        },
    )
    plan_id = plan_resp.json()["id"]

    # 2. Create Quotation Template
    tpl_resp = await client.post(
        "/api/v1/quotation-templates",
        headers=admin_headers,
        json={
            "name": "SaaS Starter Template",
            "plan_id": plan_id,
            "validity_days": 15,
            "lines": [
                {
                    "product_id": prod_id,
                    "quantity": 2,
                    "discount_percent": "0.00",
                }
            ],
        },
    )
    tpl_id = tpl_resp.json()["id"]

    # 3. Create Subscription from template (starts in QUOTATION state)
    sub_resp = await client.post(
        "/api/v1/subscriptions",
        headers=admin_headers,
        json={
            "customer_id": customer_user.id,
            "plan_id": plan_id,
            "template_id": tpl_id,
            "start_date": str(date.today()),
        },
    )
    assert sub_resp.status_code == 201
    sub = sub_resp.json()
    sub_id = sub["id"]
    assert sub["subscription_number"].startswith("SUB-")
    assert sub["status"] == "QUOTATION"
    assert float(sub["subtotal"]) == 400.00  # 2 * 200

    # 4. FSM Transition: QUOTATION -> CONFIRMED
    t_confirm = await client.post(
        f"/api/v1/subscriptions/{sub_id}/transition",
        headers=admin_headers,
        json={"action": "confirm"},
    )
    assert t_confirm.status_code == 200
    assert t_confirm.json()["status"] == "CONFIRMED"

    # 5. FSM Transition: CONFIRMED -> ACTIVE
    t_activate = await client.post(
        f"/api/v1/subscriptions/{sub_id}/transition",
        headers=admin_headers,
        json={"action": "activate"},
    )
    assert t_activate.status_code == 200
    assert t_activate.json()["status"] == "ACTIVE"

    # 6. FSM Transition: ACTIVE -> PAUSED
    t_pause = await client.post(
        f"/api/v1/subscriptions/{sub_id}/transition",
        headers=admin_headers,
        json={"action": "pause"},
    )
    assert t_pause.status_code == 200
    assert t_pause.json()["status"] == "PAUSED"

    # 7. FSM Transition: PAUSED -> ACTIVE
    t_resume = await client.post(
        f"/api/v1/subscriptions/{sub_id}/transition",
        headers=admin_headers,
        json={"action": "resume"},
    )
    assert t_resume.status_code == 200
    assert t_resume.json()["status"] == "ACTIVE"

    # 8. FSM Transition: ACTIVE -> CLOSED
    t_close = await client.post(
        f"/api/v1/subscriptions/{sub_id}/transition",
        headers=admin_headers,
        json={"action": "close"},
    )
    assert t_close.status_code == 200
    assert t_close.json()["status"] == "CLOSED"


@pytest.mark.asyncio
async def test_subscription_pause_forbidden_when_disallowed(client: AsyncClient, admin_headers, customer_user):
    # Plan that explicitly forbids pausing
    plan_resp = await client.post(
        "/api/v1/plans",
        headers=admin_headers,
        json={
            "name": "No Pause Plan",
            "code": "PLAN-NO-PAUSE",
            "interval": "DAILY",
            "allow_pause": False,
            "allow_early_close": True,
        },
    )
    plan_id = plan_resp.json()["id"]

    # Create product
    prod_resp = await client.post(
        "/api/v1/products",
        headers=admin_headers,
        json={"name": "Daily Core", "code": "SW-DC-01", "type": "SOFTWARE", "sales_price": "50.00", "cost_price": "10.00"},
    )
    prod_id = prod_resp.json()["id"]

    sub_resp = await client.post(
        "/api/v1/subscriptions",
        headers=admin_headers,
        json={
            "customer_id": customer_user.id,
            "plan_id": plan_id,
            "start_date": str(date.today()),
            "lines": [{"product_id": prod_id, "quantity": 1, "unit_price": "50.00"}],
        },
    )
    sub_id = sub_resp.json()["id"]

    # Transition to confirmed then active
    c_res = await client.post(f"/api/v1/subscriptions/{sub_id}/transition", headers=admin_headers, json={"action": "confirm"})
    assert c_res.status_code == 200
    a_res = await client.post(f"/api/v1/subscriptions/{sub_id}/transition", headers=admin_headers, json={"action": "activate"})
    assert a_res.status_code == 200

    # Attempt to pause should fail with 400
    pause_attempt = await client.post(
        f"/api/v1/subscriptions/{sub_id}/transition",
        headers=admin_headers,
        json={"action": "pause"},
    )
    assert pause_attempt.status_code == 400
    assert "does not allow pausing" in pause_attempt.json()["detail"]
