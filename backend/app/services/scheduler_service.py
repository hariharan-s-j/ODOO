import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.billing_engine import run_automated_recurring_billing
from app.services.subscription_service import check_and_auto_close_expired_subscriptions

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_billing_and_lifecycle_job():
    logger.info("Executing scheduled recurring billing and subscription lifecycle job...")
    async with AsyncSessionLocal() as session:
        try:
            # 1. Auto-close expired subscriptions
            closed = await check_and_auto_close_expired_subscriptions(session)
            if closed > 0:
                logger.info(f"Auto-closed {closed} expired subscriptions")

            # 2. Run automated recurring billing
            invoices = await run_automated_recurring_billing(session)
            if invoices:
                logger.info(f"Generated {len(invoices)} recurring invoices")
        except Exception as e:
            logger.error(f"Error in scheduled billing job: {str(e)}", exc_info=True)


def start_scheduler():
    if not settings.ENABLE_SCHEDULER:
        logger.info("Background scheduler is disabled via configuration.")
        return

    if not scheduler.running:
        scheduler.add_job(
            scheduled_billing_and_lifecycle_job,
            "interval",
            seconds=settings.SCHEDULER_INTERVAL_SECONDS,
            id="recurring_billing_job",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(f"Background scheduler started with interval {settings.SCHEDULER_INTERVAL_SECONDS}s")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped.")
