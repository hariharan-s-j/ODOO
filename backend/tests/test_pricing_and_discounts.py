from decimal import Decimal
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_product_variants_and_surcharge_calculation(client: AsyncClient, admin_headers):
    # Create Base Product: Brightloop ERP Core @ $499
    prod_resp = await client.post(
        "/api/v1/products",
        headers=admin_headers,
        json={
            "name": "Brightloop ERP Core",
            "code": "SW-ERP-TEST",
            "type": "SOFTWARE",
            "sales_price": "499.00",
            "cost_price": "120.00",
            "variants": [
                {
                    "attribute_name": "Brand",
                    "attribute_value": "Standard",
                    "price_surcharge": "0.00",
                    "sku": "SW-ERP-STD-TEST",
                },
                {
                    "attribute_name": "Brand",
                    "attribute_value": "Odoo",
                    "price_surcharge": "560.00",  # Surcharge of +$560
                    "sku": "SW-ERP-ODOO-TEST",
                },
            ],
        },
    )
    assert prod_resp.status_code == 201
    prod = prod_resp.json()
    assert len(prod["variants"]) == 2

    odoo_variant = next(v for v in prod["variants"] if v["attribute_value"] == "Odoo")
    std_variant = next(v for v in prod["variants"] if v["attribute_value"] == "Standard")

    # Dynamic price calculation for Standard variant
    calc_std = await client.post(
        "/api/v1/products/calculate-price",
        headers=admin_headers,
        json={
            "product_id": prod["id"],
            "variant_ids": [std_variant["id"]],
            "quantity": 1,
        },
    )
    assert calc_std.status_code == 200
    std_data = calc_std.json()
    assert float(std_data["unit_price"]) == 499.00
    assert float(std_data["subtotal"]) == 499.00

    # Dynamic price calculation for Odoo variant (499 + 560 = 1059)
    calc_odoo = await client.post(
        "/api/v1/products/calculate-price",
        headers=admin_headers,
        json={
            "product_id": prod["id"],
            "variant_ids": [odoo_variant["id"]],
            "quantity": 2,
        },
    )
    assert calc_odoo.status_code == 200
    odoo_data = calc_odoo.json()
    assert float(odoo_data["surcharges"]) == 560.00
    assert float(odoo_data["unit_price"]) == 1059.00
    assert float(odoo_data["subtotal"]) == 2118.00  # 1059 * 2


@pytest.mark.asyncio
async def test_dynamic_discount_rules(client: AsyncClient, admin_headers):
    # Create percentage discount with min spend $500
    disc_resp = await client.post(
        "/api/v1/discounts",
        headers=admin_headers,
        json={
            "code": "TESTPROMO20",
            "name": "20% Enterprise Discount",
            "discount_type": "PERCENTAGE",
            "value": "20.00",
            "scope": "ORDER",
            "min_spend": "500.00",
            "min_quantity": 2,
            "max_uses": 50,
        },
    )
    assert disc_resp.status_code == 201

    # Validate discount: Fails min spend constraint
    v_fail = await client.post(
        "/api/v1/discounts/validate",
        headers=admin_headers,
        json={
            "code": "TESTPROMO20",
            "subtotal": "300.00",
            "total_quantity": 2,
        },
    )
    assert v_fail.status_code == 200
    assert v_fail.json()["valid"] is False

    # Validate discount: Fails min quantity constraint
    v_fail_qty = await client.post(
        "/api/v1/discounts/validate",
        headers=admin_headers,
        json={
            "code": "TESTPROMO20",
            "subtotal": "800.00",
            "total_quantity": 1,
        },
    )
    assert v_fail_qty.status_code == 200
    assert v_fail_qty.json()["valid"] is False

    # Validate discount: Valid spend and quantity
    v_pass = await client.post(
        "/api/v1/discounts/validate",
        headers=admin_headers,
        json={
            "code": "TESTPROMO20",
            "subtotal": "1000.00",
            "total_quantity": 2,
        },
    )
    assert v_pass.status_code == 200
    pass_data = v_pass.json()
    assert pass_data["valid"] is True
    assert float(pass_data["discount_amount"]) == 200.00  # 20% of 1000
