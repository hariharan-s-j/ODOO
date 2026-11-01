from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_partial_and_full_payments(client: AsyncClient, admin_headers, customer_user):
    # Create product and subscription to bill
    prod_resp = await client.post(
        "/api/v1/products",
        headers=admin_headers,
        json={"name": "API Service", "code": "SRV-API-01", "type": "SERVICE", "sales_price": "1000.00", "cost_price": "200.00"},
    )
    prod_id = prod_resp.json()["id"]

    plan_resp = await client.post(
        "/api/v1/plans",
        headers=admin_headers,
        json={"name": "Monthly", "code": "PLAN-M-PAY", "interval": "MONTHLY"},
    )
    plan_id = plan_resp.json()["id"]

    sub_resp = await client.post(
        "/api/v1/subscriptions",
        headers=admin_headers,
        json={
            "customer_id": customer_user.id,
            "plan_id": plan_id,
            "start_date": str(date.today()),
            "lines": [{"product_id": prod_id, "quantity": 1, "unit_price": "1000.00"}],
        },
    )
    sub_id = sub_resp.json()["id"]
    await client.post(f"/api/v1/subscriptions/{sub_id}/transition", headers=admin_headers, json={"action": "confirm"})
    await client.post(f"/api/v1/subscriptions/{sub_id}/transition", headers=admin_headers, json={"action": "activate"})

    # Bill now -> $1000 invoice
    inv_resp = await client.post(f"/api/v1/subscriptions/{sub_id}/bill-now", headers=admin_headers)
    inv = inv_resp.json()
    inv_id = inv["id"]
    assert float(inv["total_amount"]) == 1000.00
    assert float(inv["balance_due"]) == 1000.00
    assert inv["status"] == "CONFIRMED"

    # 1. Partial Payment of $400
    p1_resp = await client.post(
        "/api/v1/payments",
        headers=admin_headers,
        json={
            "invoice_id": inv_id,
            "amount": "400.00",
            "method": "CREDIT_CARD",
            "payment_date": str(date.today()),
            "transaction_notes": "First installment",
        },
    )
    assert p1_resp.status_code == 201
    pay1 = p1_resp.json()
    assert pay1["payment_number"].startswith("PAY-")

    # Check invoice status after partial payment
    inv_check1 = (await client.get(f"/api/v1/invoices/{inv_id}", headers=admin_headers)).json()
    assert float(inv_check1["amount_paid"]) == 400.00
    assert float(inv_check1["balance_due"]) == 600.00
    assert inv_check1["status"] == "CONFIRMED"  # Still confirmed because balance remains

    # 2. Final Payment of remaining $600
    p2_resp = await client.post(
        "/api/v1/payments",
        headers=admin_headers,
        json={
            "invoice_id": inv_id,
            "amount": "600.00",
            "method": "BANK_TRANSFER",
            "payment_date": str(date.today()),
            "transaction_notes": "Final settlement",
        },
    )
    assert p2_resp.status_code == 201

    # Check invoice status after full payment
    inv_check2 = (await client.get(f"/api/v1/invoices/{inv_id}", headers=admin_headers)).json()
    assert float(inv_check2["amount_paid"]) == 1000.00
    assert float(inv_check2["balance_due"]) == 0.00
    assert inv_check2["status"] == "PAID"  # Auto-transitioned to PAID
