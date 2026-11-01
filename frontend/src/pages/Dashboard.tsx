import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, billingApi, usersApi } from '../services/api';
import { Badge } from '../components/Badge';
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  CreditCard,
  Users,
  Play,
  Calendar,
  Filter,
  CheckCircle,
  FileText,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [billingResult, setBillingResult] = useState<string | null>(null);
  const [isBillingRunning, setIsBillingRunning] = useState(false);

  // 1. Fetch metrics (<2s response SLA)
  const { data: metrics, isLoading: isMetricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['dashboard-metrics', startDate, endDate, customerId],
    queryFn: async () => {
      const res = await dashboardApi.getMetrics({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        customer_id: customerId,
      });
      return res.data;
    },
  });

  // 2. Fetch aging report
  const { data: agingReport, isLoading: isAgingLoading, refetch: refetchAging } = useQuery({
    queryKey: ['dashboard-aging', customerId],
    queryFn: async () => {
      const res = await dashboardApi.getAgingReport(customerId);
      return res.data;
    },
  });

  // 3. Fetch revenue trend
  const { data: trendData } = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: async () => {
      const res = await dashboardApi.getRevenueTrend();
      return res.data.trend;
    },
  });

  // 4. Fetch customers for filter
  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await usersApi.list('CUSTOMER');
      return res.data;
    },
  });

  const handleRunBilling = async () => {
    setIsBillingRunning(true);
    setBillingResult(null);
    try {
      const res = await billingApi.runNow();
      setBillingResult(`Automated billing run completed. ${res.data.length} recurring invoice(s) generated.`);
      refetchMetrics();
      refetchAging();
    } catch (e: any) {
      setBillingResult(`Billing execution error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setIsBillingRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Automated Billing Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Revenue Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time subscription metrics, monthly recurring revenue, and receivables aging (<span className="text-emerald-600 font-semibold">&lt;2s SLA</span>)
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunBilling}
          disabled={isBillingRunning}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>{isBillingRunning ? 'Processing Billing...' : 'Trigger Automated Billing Now'}</span>
        </button>
      </div>

      {/* Result alert */}
      {billingResult && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-xs text-indigo-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>{billingResult}</span>
          </div>
          <button type="button" onClick={() => setBillingResult(null)} className="text-indigo-400 hover:text-indigo-700 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Customer:</span>
          <select
            value={customerId || ''}
            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
          >
            <option value="">All Customers</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name ? `${c.company_name} (${c.full_name})` : c.full_name}
              </option>
            ))}
          </select>
        </div>

        {(startDate || endDate || customerId) && (
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setCustomerId(undefined);
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subscriptions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Subscriptions</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {isMetricsLoading ? '—' : metrics?.active_subscriptions}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Live recurring contracts</p>
        </div>

        {/* Monthly Recurring Revenue (MRR) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Monthly Recurring Revenue</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-indigo-600">
            {isMetricsLoading ? '—' : `$${Number(metrics?.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Normalized recurring revenue</p>
        </div>

        {/* Total Invoiced */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Invoiced</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {isMetricsLoading ? '—' : `$${Number(metrics?.total_invoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Across {metrics?.total_invoices_count || 0} invoices</p>
        </div>

        {/* Overdue Receivables */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Overdue Receivables</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-red-600">
            {isMetricsLoading ? '—' : `$${Number(metrics?.overdue_receivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Outstanding: ${Number(metrics?.outstanding_receivables || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Accounts Receivable Aging Report */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Accounts Receivable Aging Report</h2>
            <p className="text-xs text-slate-500">Unpaid balances bucketed by days past payment terms</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Total Unpaid Overdue: </span>
            <span className="text-sm font-bold text-red-600">
              ${Number(agingReport?.total_overdue || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Buckets Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          {agingReport?.buckets.map((bucket, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border ${
                idx === 0
                  ? 'bg-slate-50 border-slate-200'
                  : idx === 1
                  ? 'bg-amber-50/60 border-amber-200'
                  : idx === 2
                  ? 'bg-orange-50/60 border-orange-200'
                  : 'bg-red-50/70 border-red-200'
              }`}
            >
              <div className="text-xs font-bold text-slate-600">{bucket.label}</div>
              <div className="mt-2 text-xl font-extrabold text-slate-900">
                ${Number(bucket.amount).toFixed(2)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">
                {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Overdue Invoices Itemized List */}
        {agingReport?.overdue_invoices && agingReport.overdue_invoices.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Actionable Overdue Invoices Requiring Follow-Up:
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                    <th className="py-2.5 font-semibold">Invoice #</th>
                    <th className="py-2.5 font-semibold">Customer</th>
                    <th className="py-2.5 font-semibold">Due Date</th>
                    <th className="py-2.5 font-semibold text-right">Invoice Total</th>
                    <th className="py-2.5 font-semibold text-right">Balance Due</th>
                    <th className="py-2.5 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingReport.overdue_invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 font-semibold text-indigo-600">{inv.invoice_number}</td>
                      <td className="py-3 font-medium text-slate-900">
                        {inv.customer?.company_name || inv.customer?.full_name}
                      </td>
                      <td className="py-3 text-red-600 font-semibold">{inv.due_date}</td>
                      <td className="py-3 text-right text-slate-600">${Number(inv.total_amount).toFixed(2)}</td>
                      <td className="py-3 text-right font-bold text-red-700">${Number(inv.balance_due).toFixed(2)}</td>
                      <td className="py-3 text-center">
                        <Badge status="OVERDUE" size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6-Month Historical Revenue Trend */}
      {trendData && trendData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">6-Month Invoiced vs. Collected Revenue</h2>
              <p className="text-xs text-slate-500">Historical performance trend</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
            {trendData.map((pt, idx) => (
              <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-600 text-center mb-2 pb-1 border-b border-slate-200">
                  {pt.period}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoiced:</span>
                    <span className="font-semibold text-slate-900">${Number(pt.invoiced).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Collected:</span>
                    <span className="font-semibold text-emerald-600">${Number(pt.collected).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Subs:</span>
                    <span className="font-medium text-indigo-600">{pt.active_subs}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
