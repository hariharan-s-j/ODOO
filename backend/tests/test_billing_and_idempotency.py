from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_recurring_billing_and_idempotency(client: AsyncClient, admin_headers, customer_user):
    # 1. Setup Product and Tax
    tax_resp = await client.post(
        "/api/v1/taxes",
        headers=admin_headers,
        json={"name": "VAT 10%", "rate": "10.00", "scope": "ALL"},
    )
    tax_id = tax_resp.json()["id"]

    prod_resp = await client.post(
        "/api/v1/products",
        headers=admin_headers,
        json={
            "name": "SaaS Platform",
            "code": "SW-SAAS-01",
            "type": "SOFTWARE",
            "sales_price": "500.00",
            "cost_price": "100.00",
        },
    )
    prod_id = prod_resp.json()["id"]

    plan_resp = await client.post(
        "/api/v1/plans",
        headers=admin_headers,
        json={
            "name": "Monthly Pro",
            "code": "PLAN-M-01",
            "interval": "MONTHLY",
            "allow_pause": True,
            "allow_early_close": True,
        },
    )
    plan_id = plan_resp.json()["id"]

    # 2. Create and Activate Subscription
    sub_resp = await client.post(
        "/api/v1/subscriptions",
        headers=admin_headers,
        json={
            "customer_id": customer_user.id,
            "plan_id": plan_id,
            "start_date": str(date.today()),
            "lines": [
                {
                    "product_id": prod_id,
                    "quantity": 1,
                    "unit_price": "500.00",
                    "tax_id": tax_id,
                }
            ],
        },
    )
    sub_id = sub_resp.json()["id"]
    await client.post(f"/api/v1/subscriptions/{sub_id}/transition", headers=admin_headers, json={"action": "confirm"})
    await client.post(f"/api/v1/subscriptions/{sub_id}/transition", headers=admin_headers, json={"action": "activate"})

    # 3. Bill the subscription (First time)
    bill_resp1 = await client.post(f"/api/v1/subscriptions/{sub_id}/bill-now", headers=admin_headers)
    assert bill_resp1.status_code == 200
    inv1 = bill_resp1.json()
    assert inv1["invoice_number"].startswith("INV-")
    assert inv1["status"] == "CONFIRMED"
    assert float(inv1["subtotal"]) == 500.00
    assert float(inv1["tax_amount"]) == 50.00
    assert float(inv1["total_amount"]) == 550.00
    assert inv1["idempotency_key"] is not None

    # 4. Idempotency test: Re-trigger billing for same subscription period
    # It must return the EXISTING invoice and NOT generate a duplicate invoice!
    bill_resp2 = await client.post(f"/api/v1/subscriptions/{sub_id}/bill-now", headers=admin_headers)
    assert bill_resp2.status_code == 200
    inv2 = bill_resp2.json()
    assert inv2["id"] == inv1["id"]
    assert inv2["invoice_number"] == inv1["invoice_number"]

    # Verify invoice list still contains only 1 invoice for this subscription
    invs_list = await client.get(f"/api/v1/invoices?subscription_id={sub_id}", headers=admin_headers)
    assert len(invs_list.json()) == 1

    # 5. Test PDF generation endpoint
    pdf_resp = await client.get(f"/api/v1/invoices/{inv1['id']}/pdf", headers=admin_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 500  # Valid binary PDF stream
