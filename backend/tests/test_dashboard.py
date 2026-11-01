import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_metrics_and_aging_report(client: AsyncClient, staff_headers):
    # Metrics endpoint
    m_resp = await client.get("/api/v1/dashboard/metrics", headers=staff_headers)
    assert m_resp.status_code == 200
    metrics = m_resp.json()
    assert "active_subscriptions" in metrics
    assert "mrr" in metrics
    assert "total_invoiced" in metrics
    assert "outstanding_receivables" in metrics
    assert "overdue_receivables" in metrics
    assert "total_collected" in metrics

    # Aging report endpoint
    aging_resp = await client.get("/api/v1/dashboard/aging-report", headers=staff_headers)
    assert aging_resp.status_code == 200
    aging_data = aging_resp.json()
    assert "buckets" in aging_data
    assert len(aging_data["buckets"]) == 4
    bucket_labels = [b["label"] for b in aging_data["buckets"]]
    assert "0 - 30 Days" in bucket_labels
    assert "31 - 60 Days" in bucket_labels
    assert "61 - 90 Days" in bucket_labels
    assert "90+ Days" in bucket_labels

    # Revenue trend endpoint
    trend_resp = await client.get("/api/v1/dashboard/revenue-trend", headers=staff_headers)
    assert trend_resp.status_code == 200
    trend_data = trend_resp.json()
    assert "trend" in trend_data
    assert len(trend_data["trend"]) == 6  # 6-month historical trend
