import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { invoicesApi } from '../services/api';
import { Badge } from '../components/Badge';
import { Search, Filter, FileText, ChevronRight } from 'lucide-react';

export const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices-list', statusFilter],
    queryFn: async () => {
      const res = await invoicesApi.list({
        status: statusFilter === 'OVERDUE' ? undefined : statusFilter || undefined,
      });
      return res.data;
    },
  });

  const filteredInvoices = invoices?.filter((inv) => {
    // If overdue filter selected
    if (statusFilter === 'OVERDUE' && !inv.is_overdue) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer?.full_name.toLowerCase().includes(q) ||
      inv.customer?.company_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices & Billing</h1>
        <p className="text-xs text-slate-500 mt-1">
          Automated recurring invoices, payment tracking, and arrears management
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice #, customer name or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
          >
            <option value="">All Invoices</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed (Unpaid)</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="OVERDUE">Overdue Only</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading invoices...</div>
        ) : filteredInvoices?.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">No invoices found</div>
            <p className="text-xs text-slate-500">Invoices will appear here when generated or billed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Invoice #</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Issue Date</th>
                  <th className="py-3 px-4 font-semibold">Due Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount Paid</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices?.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-bold text-indigo-600 font-mono">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {inv.customer?.company_name || inv.customer?.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{inv.customer?.full_name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{inv.issue_date}</td>
                    <td className="py-3.5 px-4">
                      <span className={inv.is_overdue ? 'text-red-600 font-bold' : 'text-slate-600'}>
                        {inv.due_date}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      ${Number(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                      ${Number(inv.amount_paid).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      <span className={Number(inv.balance_due) > 0 ? 'text-indigo-600' : 'text-slate-500'}>
                        ${Number(inv.balance_due).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge status={inv.is_overdue ? 'OVERDUE' : inv.status} />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <ChevronRight className="h-4 w-4 text-slate-400 inline" />
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
