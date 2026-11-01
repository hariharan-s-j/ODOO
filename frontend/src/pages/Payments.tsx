import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '../services/api';
import { Badge } from '../components/Badge';
import { CreditCard, Search, DollarSign } from 'lucide-react';

export const Payments: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments-list-full'],
    queryFn: async () => (await paymentsApi.list()).data,
  });

  const filteredPayments = payments?.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.payment_number.toLowerCase().includes(q) ||
      p.invoice_number?.toLowerCase().includes(q) ||
      p.customer?.full_name.toLowerCase().includes(q) ||
      p.customer?.company_name?.toLowerCase().includes(q) ||
      p.reference_code?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments & Collections</h1>
        <p className="text-xs text-slate-500 mt-1">
          Historical payment transactions matched to invoices (Stripe, Card, Wire, Cash)
        </p>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search payments by PAY#, invoice, customer, or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading payment records...</div>
        ) : filteredPayments?.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CreditCard className="h-10 w-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">No payments found</div>
            <p className="text-xs text-slate-500">Payments recorded against invoices will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Payment #</th>
                  <th className="py-3 px-4 font-semibold">Linked Invoice</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Payment Method</th>
                  <th className="py-3 px-4 font-semibold">Payment Date</th>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments?.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-indigo-600 font-mono">{p.payment_number}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                      {p.invoice_number || `Invoice #${p.invoice_id}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {p.customer?.company_name || p.customer?.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{p.customer?.full_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {p.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{p.payment_date}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {p.reference_code || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                      ${Number(p.amount).toFixed(2)}
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
