from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import (
    auth_router,
    billing_router,
    dashboard_router,
    discounts_router,
    invoices_router,
    payments_router,
    plans_router,
    products_router,
    quotation_templates_router,
    subscriptions_router,
    taxes_router,
    users_router,
)
from app.services.scheduler_service import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Start background scheduler
    start_scheduler()
    
    yield
    
    # Stop background scheduler
    stop_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Subscription Management System for Brightloop Software",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
api_v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1)
app.include_router(users_router, prefix=api_v1)
app.include_router(products_router, prefix=api_v1)
app.include_router(plans_router, prefix=api_v1)
app.include_router(quotation_templates_router, prefix=api_v1)
app.include_router(taxes_router, prefix=api_v1)
app.include_router(discounts_router, prefix=api_v1)
app.include_router(subscriptions_router, prefix=api_v1)
app.include_router(invoices_router, prefix=api_v1)
app.include_router(payments_router, prefix=api_v1)
app.include_router(billing_router, prefix=api_v1)
app.include_router(dashboard_router, prefix=api_v1)


@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }
