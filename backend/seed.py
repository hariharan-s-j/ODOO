import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.discount import DiscountRule, DiscountScope, DiscountType
from app.models.invoice import BillingSchedule, Invoice, InvoiceLine, InvoiceStatus
from app.models.payment import Payment, PaymentMethod
from app.models.plan import Plan, RecurrenceInterval
from app.models.product import Product, ProductType, ProductVariant
from app.models.quotation_template import QuotationTemplate, QuotationTemplateLine
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus
from app.models.tax import Tax, TaxScope, TaxType
from app.models.user import User, UserRole


async def seed():
    print("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        print("Seeding Users...")
        # 1. Admin
        admin = User(
            email="admin@brightloop.io",
            hashed_password=get_password_hash("Admin@Brightloop2026!"),
            full_name="Sarah Connor (Admin)",
            company_name="Brightloop Software HQ",
            phone="+1-555-0100",
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin)

        # 2. Staff
        staff = User(
            email="staff@brightloop.io",
            hashed_password=get_password_hash("Staff@Brightloop2026!"),
            full_name="Michael Scott (Sales Rep)",
            company_name="Brightloop Operations",
            phone="+1-555-0101",
            role=UserRole.STAFF,
            is_active=True,
        )
        session.add(staff)

        # 3. Customers
        customer_acme = User(
            email="alice@acme.com",
            hashed_password=get_password_hash("Customer@1234!"),
            full_name="Alice Johnson",
            company_name="Acme Corporation",
            phone="+1-555-0201",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        customer_starlight = User(
            email="bob@starlight.io",
            hashed_password=get_password_hash("Customer@1234!"),
            full_name="Bob Miller",
            company_name="Starlight Retail Ltd.",
            phone="+1-555-0202",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        customer_apex = User(
            email="carol@apex.co",
            hashed_password=get_password_hash("Customer@1234!"),
            full_name="Carol Danvers",
            company_name="Apex Logistics & Freight",
            phone="+1-555-0203",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        session.add_all([customer_acme, customer_starlight, customer_apex])
        await session.flush()

        print("Seeding Taxes...")
        tax_sales = Tax(
            name="Standard Sales Tax",
            rate=Decimal("10.00"),
            tax_type=TaxType.FLAT_PERCENT,
            scope=TaxScope.ALL,
            is_active=True,
        )
        tax_software = Tax(
            name="Software Tech VAT",
            rate=Decimal("5.00"),
            tax_type=TaxType.FLAT_PERCENT,
            scope=TaxScope.SOFTWARE,
            is_active=True,
        )
        session.add_all([tax_sales, tax_software])
        await session.flush()

        print("Seeding Products and Variants...")
        # ERP Core Product with Odoo variant (+560 surcharge as required in prompt!)
        prod_erp = Product(
            name="Brightloop ERP Core",
            code="SW-ERP-CORE",
            type=ProductType.SOFTWARE,
            sales_price=Decimal("499.00"),
            cost_price=Decimal("120.00"),
            notes="Unified enterprise resource management platform",
            is_active=True,
        )
        session.add(prod_erp)
        await session.flush()

        var_odoo = ProductVariant(
            product_id=prod_erp.id,
            attribute_name="Brand",
            attribute_value="Odoo",
            price_surcharge=Decimal("560.00"),  # Explicit surcharge of +$560
            sku="SW-ERP-ODOO",
            is_active=True,
        )
        var_standard = ProductVariant(
            product_id=prod_erp.id,
            attribute_name="Brand",
            attribute_value="Standard",
            price_surcharge=Decimal("0.00"),
            sku="SW-ERP-STD",
            is_active=True,
        )
        var_enterprise = ProductVariant(
            product_id=prod_erp.id,
            attribute_name="Brand",
            attribute_value="Enterprise Cloud",
            price_surcharge=Decimal("850.00"),
            sku="SW-ERP-ENT",
            is_active=True,
        )
        session.add_all([var_odoo, var_standard, var_enterprise])

        # Priority Support Service
        prod_support = Product(
            name="Priority SLA & 24/7 On-Call Support",
            code="SRV-SLA-247",
            type=ProductType.SERVICE,
            sales_price=Decimal("199.00"),
            cost_price=Decimal("50.00"),
            notes="Guaranteed 15-minute response time with dedicated account engineer",
            is_active=True,
        )
        # Analytics Add-on
        prod_analytics = Product(
            name="Advanced BI & Predictive Analytics",
            code="ADD-ANALYTICS",
            type=ProductType.ADD_ON,
            sales_price=Decimal("149.00"),
            cost_price=Decimal("25.00"),
            notes="Real-time multi-dimensional data warehouse connector",
            is_active=True,
        )
        # Warehouse Sync Add-on
        prod_warehouse = Product(
            name="Multi-Warehouse Inventory Sync",
            code="ADD-WH-SYNC",
            type=ProductType.ADD_ON,
            sales_price=Decimal("99.00"),
            cost_price=Decimal("15.00"),
            notes="Automated stock reconciliation across multiple geographic locations",
            is_active=True,
        )
        session.add_all([prod_support, prod_analytics, prod_warehouse])
        await session.flush()

        print("Seeding Plans...")
        plan_monthly = Plan(
            name="Monthly Professional Plan",
            code="PLAN-MONTHLY-PRO",
            description="Billed monthly. Full flexibility with pause and cancellation anytime.",
            interval=RecurrenceInterval.MONTHLY,
            cost=Decimal("0.00"),
            minimum_quantity=1,
            start_date=date(2026, 1, 1),
            auto_close_on_expiry=False,
            allow_pause=True,
            allow_early_close=True,
            is_active=True,
        )
        plan_yearly = Plan(
            name="Yearly Enterprise Contract",
            code="PLAN-YEARLY-ENT",
            description="Annual commitment with volume discounting. Fixed 12-month lock-in.",
            interval=RecurrenceInterval.YEARLY,
            cost=Decimal("0.00"),
            minimum_quantity=3,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            auto_close_on_expiry=True,
            allow_pause=True,
            allow_early_close=False,  # Prohibits early close per contract
            is_active=True,
        )
        plan_daily = Plan(
            name="Daily Sandbox Test Plan",
            code="PLAN-DAILY-DEV",
            description="Daily metered compute sandbox for staging and integration tests.",
            interval=RecurrenceInterval.DAILY,
            cost=Decimal("0.00"),
            minimum_quantity=1,
            start_date=date(2026, 1, 1),
            auto_close_on_expiry=True,
            allow_pause=False,
            allow_early_close=True,
            is_active=True,
        )
        session.add_all([plan_monthly, plan_yearly, plan_daily])
        await session.flush()

        print("Seeding Dynamic Discounts...")
        disc_welcome = DiscountRule(
            code="WELCOME10",
            name="10% New Customer Welcome Discount",
            discount_type=DiscountType.PERCENTAGE,
            value=Decimal("10.00"),
            scope=DiscountScope.ORDER,
            min_spend=Decimal("100.00"),
            min_quantity=1,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 12, 31),
            max_uses=500,
            current_uses=12,
            is_active=True,
        )
        disc_volume = DiscountRule(
            code="VOLUME50",
            name="$50 High Seat Volume Discount",
            discount_type=DiscountType.FIXED,
            value=Decimal("50.00"),
            scope=DiscountScope.ORDER,
            min_spend=Decimal("500.00"),
            min_quantity=3,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 12, 31),
            max_uses=200,
            current_uses=5,
            is_active=True,
        )
        disc_odoo_promo = DiscountRule(
            code="ODOO15",
            name="15% Off Odoo Brand ERP",
            discount_type=DiscountType.PERCENTAGE,
            value=Decimal("15.00"),
            scope=DiscountScope.PRODUCT,
            product_id=prod_erp.id,
            min_spend=Decimal("400.00"),
            min_quantity=1,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 12, 31),
            max_uses=100,
            current_uses=8,
            is_active=True,
        )
        session.add_all([disc_welcome, disc_volume, disc_odoo_promo])
        await session.flush()

        print("Seeding Quotation Templates...")
        template_standard = QuotationTemplate(
            name="Standard ERP + Support Bundle",
            description="Core software paired with 24/7 SLA. Ready-made bundle for mid-market clients.",
            plan_id=plan_monthly.id,
            validity_days=15,
            is_active=True,
        )
        session.add(template_standard)
        await session.flush()

        t_line1 = QuotationTemplateLine(
            template_id=template_standard.id,
            product_id=prod_erp.id,
            variant_id=var_standard.id,
            quantity=1,
            unit_price_override=None,
            discount_percent=Decimal("0.00"),
        )
        t_line2 = QuotationTemplateLine(
            template_id=template_standard.id,
            product_id=prod_support.id,
            variant_id=None,
            quantity=1,
            unit_price_override=None,
            discount_percent=Decimal("0.00"),
        )
        session.add_all([t_line1, t_line2])

        template_odoo_suite = QuotationTemplate(
            name="Enterprise Odoo Transformation Suite",
            description="Full Odoo ERP deployment with multi-warehouse sync and BI reporting.",
            plan_id=plan_yearly.id,
            validity_days=30,
            is_active=True,
        )
        session.add(template_odoo_suite)
        await session.flush()

        o_line1 = QuotationTemplateLine(
            template_id=template_odoo_suite.id,
            product_id=prod_erp.id,
            variant_id=var_odoo.id,  # Includes +560 surcharge
            quantity=3,
            unit_price_override=None,
            discount_percent=Decimal("5.00"),
        )
        o_line2 = QuotationTemplateLine(
            template_id=template_odoo_suite.id,
            product_id=prod_warehouse.id,
            variant_id=None,
            quantity=2,
            unit_price_override=None,
            discount_percent=Decimal("0.00"),
        )
        session.add_all([o_line1, o_line2])
        await session.flush()

        print("Seeding Subscriptions and Lines...")
        # 1. Acme Corp ACTIVE Subscription (ERP Core with Odoo Variant: 499 + 560 = 1059)
        sub_acme = Subscription(
            subscription_number="SUB-2026-0001",
            customer_id=customer_acme.id,
            plan_id=plan_monthly.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=date(2026, 9, 1),
            end_date=None,
            next_billing_date=date(2026, 11, 1),
            payment_terms="Net 15",
            notes="Acme Corporation production instance with Odoo brand engine",
            auto_close_on_expiry=False,
            allow_pause=True,
            allow_early_close=True,
            subtotal=Decimal("1258.00"),  # 1059 (ERP Odoo) + 199 (Support)
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("125.80"),  # 10%
            total_amount=Decimal("1383.80"),
        )
        session.add(sub_acme)
        await session.flush()

        sub_acme_l1 = SubscriptionLine(
            subscription_id=sub_acme.id,
            product_id=prod_erp.id,
            variant_id=var_odoo.id,  # Odoo Brand Variant ($499 + $560 = $1059.00)
            quantity=1,
            unit_price=Decimal("1059.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            subtotal=Decimal("1059.00"),
            tax_amount=Decimal("105.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("1164.90"),
        )
        sub_acme_l2 = SubscriptionLine(
            subscription_id=sub_acme.id,
            product_id=prod_support.id,
            variant_id=None,
            quantity=1,
            unit_price=Decimal("199.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            subtotal=Decimal("199.00"),
            tax_amount=Decimal("19.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("218.90"),
        )
        session.add_all([sub_acme_l1, sub_acme_l2])

        # 2. Starlight Retail QUOTATION Subscription
        sub_starlight = Subscription(
            subscription_number="SUB-2026-0002",
            customer_id=customer_starlight.id,
            plan_id=plan_monthly.id,
            status=SubscriptionStatus.QUOTATION,
            start_date=date(2026, 10, 15),
            end_date=None,
            next_billing_date=date(2026, 11, 15),
            payment_terms="Immediate",
            quotation_valid_until=date(2026, 11, 15),
            notes="Formal quote sent to Bob Miller for retail automation",
            auto_close_on_expiry=False,
            allow_pause=True,
            allow_early_close=True,
            subtotal=Decimal("697.00"),  # 499 (ERP Std) + 198 (2x Warehouse)
            discount_amount=Decimal("50.00"),
            tax_amount=Decimal("64.70"),
            total_amount=Decimal("711.70"),
            discount_code="VOLUME50",
        )
        session.add(sub_starlight)
        await session.flush()

        sub_star_l1 = SubscriptionLine(
            subscription_id=sub_starlight.id,
            product_id=prod_erp.id,
            variant_id=var_standard.id,
            quantity=1,
            unit_price=Decimal("499.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            subtotal=Decimal("499.00"),
            tax_amount=Decimal("49.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("548.90"),
        )
        sub_star_l2 = SubscriptionLine(
            subscription_id=sub_starlight.id,
            product_id=prod_warehouse.id,
            variant_id=None,
            quantity=2,
            unit_price=Decimal("99.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            subtotal=Decimal("198.00"),
            tax_amount=Decimal("19.80"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("217.80"),
        )
        session.add_all([sub_star_l1, sub_star_l2])

        # 3. Apex Logistics CONFIRMED Subscription (Yearly Enterprise)
        sub_apex = Subscription(
            subscription_number="SUB-2026-0003",
            customer_id=customer_apex.id,
            plan_id=plan_yearly.id,
            status=SubscriptionStatus.CONFIRMED,
            start_date=date(2026, 11, 1),
            end_date=date(2027, 11, 1),
            next_billing_date=date(2026, 11, 1),
            payment_terms="Net 30",
            notes="Annual freight synchronization enterprise tier",
            auto_close_on_expiry=True,
            allow_pause=True,
            allow_early_close=False,
            subtotal=Decimal("4047.00"),
            discount_amount=Decimal("404.70"),
            tax_amount=Decimal("364.23"),
            total_amount=Decimal("4006.53"),
            discount_code="WELCOME10",
        )
        session.add(sub_apex)
        await session.flush()

        sub_apex_l1 = SubscriptionLine(
            subscription_id=sub_apex.id,
            product_id=prod_erp.id,
            variant_id=var_enterprise.id,  # 499 + 850 = 1349
            quantity=3,
            unit_price=Decimal("1349.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            subtotal=Decimal("4047.00"),
            tax_amount=Decimal("364.23"),
            discount_amount=Decimal("404.70"),
            total_amount=Decimal("4006.53"),
        )
        session.add(sub_apex_l1)
        await session.flush()

        print("Seeding Invoices and Payments...")
        # Invoice 1: Acme Corp PAID Invoice (for Sep 2026)
        inv1 = Invoice(
            invoice_number="INV-2026-0001",
            customer_id=customer_acme.id,
            subscription_id=sub_acme.id,
            status=InvoiceStatus.PAID,
            issue_date=date(2026, 9, 1),
            due_date=date(2026, 9, 16),
            period_start=date(2026, 9, 1),
            period_end=date(2026, 9, 30),
            subtotal=Decimal("1258.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("125.80"),
            total_amount=Decimal("1383.80"),
            amount_paid=Decimal("1383.80"),
            balance_due=Decimal("0.00"),
            payment_terms="Net 15",
            notes="Paid in full via Stripe Card",
            idempotency_key=f"BILLING:SUB-{sub_acme.id}:2026-09-01:2026-09-30",
        )
        session.add(inv1)
        await session.flush()

        inv1_l1 = InvoiceLine(
            invoice_id=inv1.id,
            product_id=prod_erp.id,
            variant_id=var_odoo.id,
            product_name="Brightloop ERP Core",
            variant_name="Brand: Odoo (+$560 Surcharge)",
            quantity=1,
            unit_price=Decimal("1059.00"),
            subtotal=Decimal("1059.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("105.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("1164.90"),
        )
        inv1_l2 = InvoiceLine(
            invoice_id=inv1.id,
            product_id=prod_support.id,
            variant_id=None,
            product_name="Priority SLA & 24/7 On-Call Support",
            variant_name=None,
            quantity=1,
            unit_price=Decimal("199.00"),
            subtotal=Decimal("199.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("19.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("218.90"),
        )
        session.add_all([inv1_l1, inv1_l2])

        # Record full payment for Invoice 1
        pay1 = Payment(
            payment_number="PAY-2026-0001",
            invoice_id=inv1.id,
            customer_id=customer_acme.id,
            method=PaymentMethod.STRIPE,
            amount=Decimal("1383.80"),
            payment_date=date(2026, 9, 5),
            transaction_notes="Stripe Charge ID: ch_3NqXyZ892Brightloop",
            reference_code="STRIPE-0905-ACME",
        )
        session.add(pay1)

        # Record billing schedule for idempotency
        sched1 = BillingSchedule(
            subscription_id=sub_acme.id,
            period_start=date(2026, 9, 1),
            period_end=date(2026, 9, 30),
            invoice_id=inv1.id,
            idempotency_key=inv1.idempotency_key,
        )
        session.add(sched1)

        # Invoice 2: Acme Corp October Invoice (PARTIALLY PAID / OUTSTANDING)
        inv2 = Invoice(
            invoice_number="INV-2026-0002",
            customer_id=customer_acme.id,
            subscription_id=sub_acme.id,
            status=InvoiceStatus.CONFIRMED,
            issue_date=date(2026, 10, 1),
            due_date=date(2026, 10, 16),  # Due in past -> Demonstrates Aging Report / Overdue!
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 31),
            subtotal=Decimal("1258.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("125.80"),
            total_amount=Decimal("1383.80"),
            amount_paid=Decimal("500.00"),  # Partial payment of $500
            balance_due=Decimal("883.80"),   # Remaining $883.80 overdue
            payment_terms="Net 15",
            notes="Partial payment received; balance overdue",
            idempotency_key=f"BILLING:SUB-{sub_acme.id}:2026-10-01:2026-10-31",
        )
        session.add(inv2)
        await session.flush()

        inv2_l1 = InvoiceLine(
            invoice_id=inv2.id,
            product_id=prod_erp.id,
            variant_id=var_odoo.id,
            product_name="Brightloop ERP Core",
            variant_name="Brand: Odoo (+$560 Surcharge)",
            quantity=1,
            unit_price=Decimal("1059.00"),
            subtotal=Decimal("1059.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("105.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("1164.90"),
        )
        session.add(inv2_l1)

        # Partial payment for Invoice 2
        pay2 = Payment(
            payment_number="PAY-2026-0002",
            invoice_id=inv2.id,
            customer_id=customer_acme.id,
            method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("500.00"),
            payment_date=date(2026, 10, 10),
            transaction_notes="Wire Transfer Ref #WT-9981-ACME",
            reference_code="WIRE-ACME-PARTIAL",
        )
        session.add(pay2)

        sched2 = BillingSchedule(
            subscription_id=sub_acme.id,
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 31),
            invoice_id=inv2.id,
            idempotency_key=inv2.idempotency_key,
        )
        session.add(sched2)

        # Invoice 3: Starlight Retail Overdue Invoice (60 days overdue)
        inv3 = Invoice(
            invoice_number="INV-2026-0003",
            customer_id=customer_starlight.id,
            subscription_id=None,
            status=InvoiceStatus.CONFIRMED,
            issue_date=date(2026, 8, 15),
            due_date=date(2026, 8, 30),  # > 60 days overdue!
            subtotal=Decimal("799.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("79.90"),
            total_amount=Decimal("878.90"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("878.90"),
            payment_terms="Net 15",
            notes="Initial onboarding and data migration invoice (past due)",
            idempotency_key="INV-MIGRATION-STARLIGHT-202608",
        )
        session.add(inv3)
        await session.flush()

        inv3_l = InvoiceLine(
            invoice_id=inv3.id,
            product_id=prod_support.id,
            variant_id=None,
            product_name="Data Migration & Deployment Service",
            variant_name=None,
            quantity=1,
            unit_price=Decimal("799.00"),
            subtotal=Decimal("799.00"),
            tax_id=tax_sales.id,
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("79.90"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("878.90"),
        )
        session.add(inv3_l)

        await session.commit()
        print("Database successfully seeded with realistic enterprise data!")
        print("\n=== Sample Login Accounts ===")
        print("1. Admin:    admin@brightloop.io     / Admin@Brightloop2026!")
        print("2. Staff:    staff@brightloop.io     / Staff@Brightloop2026!")
        print("3. Customer: alice@acme.com          / Customer@1234!")
        print("4. Customer: bob@starlight.io        / Customer@1234!")


if __name__ == "__main__":
    asyncio.run(seed())
