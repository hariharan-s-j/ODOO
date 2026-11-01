import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../services/api';
import { Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const BillingLogs: React.FC = () => {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['billing-schedules'],
    queryFn: async () => (await billingApi.getSchedules()).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Billing Schedule & Idempotency Logs
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Cryptographic idempotency keys guaranteeing zero double-billing across distributed workers
        </p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-xs text-emerald-900">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold">Idempotency Guarantee Active: </span>
          <span>
            Every billing cycle enforces unique constraint hash locks. Subscriptions can never be billed twice for the same billing window.
          </span>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading billing logs...</div>
        ) : schedules?.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="h-10 w-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">No billing schedules logged yet</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Log ID</th>
                  <th className="py-3 px-4 font-semibold">Subscription ID</th>
                  <th className="py-3 px-4 font-semibold">Period Start</th>
                  <th className="py-3 px-4 font-semibold">Period End</th>
                  <th className="py-3 px-4 font-semibold">Generated Invoice ID</th>
                  <th className="py-3 px-4 font-semibold">Idempotency Key Hash Lock</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules?.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">#{s.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-indigo-600">Sub #{s.subscription_id}</td>
                    <td className="py-3.5 px-4 text-slate-700">{s.period_start}</td>
                    <td className="py-3.5 px-4 text-slate-700">{s.period_end}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      Invoice #{s.invoice_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                      {s.idempotency_key}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
