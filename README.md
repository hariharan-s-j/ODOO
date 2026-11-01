# Brightloop Subscription Management System

Enterprise-grade, modular, end-to-end Subscription Management and Recurring Billing System for **Brightloop Software**, built strictly to specification.

---

## 1. System Architecture & Tech Stack

### Backend
- **Framework**: Python 3.11+, FastAPI (REST API v1)
- **Database & ORM**: SQLAlchemy 2.0 (asyncio), aiosqlite (default zero-config local testing) with direct PostgreSQL support via `DATABASE_URL`
- **Validation**: Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)` and strict email/password validators
- **Database Migrations**: Alembic async migrations
- **Authentication**: JWT access & refresh tokens (PyJWT), bcrypt password hashing
- **PDF Generation**: ReportLab native binary PDF generator for printable customer and staff receipts
- **Background Scheduler**: APScheduler running recurring automated billing checks and auto-close on expired contracts
- **Testing**: Pytest with `pytest-asyncio` test suite (11 unit & integration tests)

### Frontend
- **Framework**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS v4, Lucide React icons
- **State & Data Fetching**: TanStack React Query v5, Axios with automatic token refresh interceptor
- **Routing**: React Router DOM v7
- **Testing**: Vitest + React Testing Library (JSDOM)

---

## 2. Core Functional Modules & Business Rules

### A. Authentication & RBAC
- **Roles**: `ADMIN`, `STAFF`, `CUSTOMER`.
- **Validation**:
  - Email: Unique, strict email format.
  - Password: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 special character.
- **Password Reset**: Secure tokenized reset endpoint with email dispatch simulation.
- **RBAC Matrix**:
  - `ADMIN`: Full system CRUD (staff provisioning, plans, products, taxes, global discounts, billing automation).
  - `STAFF`: Day-to-day operations (manage customers, build quotes, confirm subscriptions, record payments, view invoices). Cannot add new staff or alter core tax/discount rules.
  - `CUSTOMER`: Read-only / self-service portal (own subscriptions, history, invoices; view / download / print invoice PDFs).

### B. Product Catalog & Variant Engine
- **Products**: `name`, `type` (`SERVICE`, `SOFTWARE`, `ADD_ON`), `sales_price`, `cost_price`, `notes`, `is_active`.
- **Variants**: E.g., Brand attribute (Selecting **"Odoo"** adds an explicit surcharge like **+$560** to base price: $499 + $560 = $1,059).
- **Dynamic Price Calculation**: `POST /api/v1/products/calculate-price` dynamically calculates unit prices, surcharges, quantity multiples, and tax/discount estimates.

### C. Plans & Subscription Lifecycle
- **Plans**:
  - Recurrence intervals: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.
  - Parameters: `cost`, `minimum_quantity`, `start_date`, `end_date`, `auto_close_on_expiry` (bool), `allow_pause` (bool), `allow_early_close` (bool).
- **Quotation Templates**: Pre-configured bundles of products and plans with preset validity windows (e.g., valid for 15 days).
- **Subscription Lifecycle FSM**:
  - `DRAFT` ➔ `QUOTATION` ➔ `CONFIRMED` ➔ `ACTIVE` ➔ `CLOSED` (or `PAUSED`).
  - Serialized subscription numbers: `SUB-YYYY-NNNN` (e.g. `SUB-2026-0001`).
  - Strict policy enforcement: Pausing is blocked if plan disallows it; early closing before expiry is blocked if plan disallows it; auto-close runs for expired plans.

### D. Automated Recurring Billing & Tax Engine
- **Tax Engine**: Tax rules configured by Admin (percentage, scope: `ALL`, `SOFTWARE`, `SERVICE`, `ADD_ON`, type: `FLAT_PERCENT`, `COMPOUND`). Line-item calculation.
- **Billing Engine**:
  - Idempotently creates invoices from subscriptions when due.
  - **Idempotency Guarantee**: Subscriptions are never double-billed for the same period. Protected by `BillingSchedule` and cryptographic idempotency key locks (`BILLING:SUB-{id}:{start}:{end}`).
  - **Invoice FSM**: `DRAFT` ➔ `CONFIRMED` ➔ `PAID` (or `CANCELLED`).
  - Dual export: Downloadable native PDF binary (`/invoices/:id/pdf`) and clean printable view (`window.print()`).

### E. Dynamic Discounts Engine
- Rules: `FIXED` amount or `PERCENTAGE`.
- Constraints: Minimum spend, minimum quantity, valid date windows (`start_date`, `end_date`), usage limits (`max_uses`, `current_uses`).
- Scopes: Entire subscription order (`ORDER`) or specific product SKUs (`PRODUCT`).
- Attached automatically to quotes and invoices; usage count atomically incremented on confirmation.

### F. Payments & Arrears Management
- Methods: `CREDIT_CARD`, `STRIPE`, `BANK_TRANSFER`, `CASH`.
- Partial payments support: Mark invoice as `PAID` only when total paid >= invoice total; otherwise balance remains outstanding.
- Overdue tracking: Automatically flags invoices past their payment terms.

### G. Finance Dashboard & Reporting (<2s Response SLA)
- Fast aggregation endpoints leveraging database indexes:
  - Metric Cards: Active Subscriptions, Monthly Recurring Revenue (MRR), Total Invoiced, Outstanding/Overdue Receivables, Total Collected.
  - Accounts Receivable Aging Report: Buckets for `0 - 30 Days`, `31 - 60 Days`, `61 - 90 Days`, `90+ Days` past due.
  - 6-Month Invoiced vs. Collected revenue trends.
  - Filterable by date range and customer.

---

## 3. Demo Credentials

| Role | Name | Email | Password | Permissions |
|------|------|-------|----------|-------------|
| **ADMIN** | Sarah Connor | `admin@brightloop.io` | `Admin@Brightloop2026!` | Full system CRUD, staff provisioning, tax & discount rules |
| **STAFF** | Michael Scott | `staff@brightloop.io` | `Staff@Brightloop2026!` | Operations, customers, quotes, subscriptions, payments |
| **CUSTOMER** | Alice Johnson (Acme Corp) | `alice@acme.com` | `Customer@1234!` | Self-service portal: own subscriptions, invoices, print receipts |
| **CUSTOMER** | Bob Miller (Starlight) | `bob@starlight.io` | `Customer@1234!` | Self-service portal: review quotes, view invoices |

> *Quick Login*: The frontend header includes a **"Switch Demo Account"** dropdown to switch between roles with 1 click!

---

## 4. Quickstart Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup & Seeding
```bash
# In project root:
cd backend

# Activate virtual environment (Windows):
..\venv\Scripts\activate
# (or on Unix/macOS: source ../venv/bin/activate)

# Install dependencies:
pip install -r requirements.txt

# Seed database with sample data (products, Odoo +$560 variant, plans, quotes, subscriptions, invoices, payments):
python seed.py

# Run FastAPI backend server:
uvicorn app.main:app --reload --port 8000
```
- Swagger Interactive Documentation: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 2. Frontend Setup
```bash
# In project root:
cd frontend

# Install packages:
npm install

# Start Vite development server:
npm run dev
```
- Open browser at: `http://localhost:5173`

---

## 5. Automated Tests

### Backend Tests (Pytest)
```bash
cd backend
..\venv\Scripts\pytest -v
```
**Results**:
- `tests/test_auth.py`: Registration, strict password validation, password reset token simulation, RBAC restrictions.
- `tests/test_pricing_and_discounts.py`: Dynamic product variant surcharge (Odoo brand +$560), price calculation endpoint, discount rules evaluation.
- `tests/test_subscriptions_fsm.py`: FSM state transitions (`DRAFT` ➔ `QUOTATION` ➔ `CONFIRMED` ➔ `ACTIVE` ➔ `PAUSED` ➔ `CLOSED`), plan policy enforcement.
- `tests/test_billing_and_idempotency.py`: Recurring invoice generation, idempotency guarantee (zero double billing), PDF generation.
- `tests/test_payments.py`: Partial payments, balance due calculation, automatic transition to `PAID`.
- `tests/test_dashboard.py`: Finance metrics aggregation, Accounts Receivable aging report (0-30, 31-60, 61-90, 90+ days), revenue trends.

### Frontend Tests (Vitest)
```bash
cd frontend
npm test
```
**Results**:
- `src/components/__tests__/Badge.test.tsx`: Role badges, status color coding, and overdue badges.
