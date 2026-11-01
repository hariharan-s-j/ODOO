from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.products import router as products_router
from app.routers.plans import router as plans_router
from app.routers.quotation_templates import router as quotation_templates_router
from app.routers.taxes import router as taxes_router
from app.routers.discounts import router as discounts_router
from app.routers.subscriptions import router as subscriptions_router
from app.routers.invoices import router as invoices_router
from app.routers.payments import router as payments_router
from app.routers.billing import router as billing_router
from app.routers.dashboard import router as dashboard_router

__all__ = [
    "auth_router",
    "users_router",
    "products_router",
    "plans_router",
    "quotation_templates_router",
    "taxes_router",
    "discounts_router",
    "subscriptions_router",
    "invoices_router",
    "payments_router",
    "billing_router",
    "dashboard_router",
]
