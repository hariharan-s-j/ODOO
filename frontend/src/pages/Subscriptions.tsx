import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '../services/api';
import { Badge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  CalendarCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const Subscriptions: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions-list', statusFilter],
    queryFn: async () => {
      const res = await subscriptionsApi.list({
        status: statusFilter || undefined,
      });
      return res.data;
    },
  });

  const filteredSubs = subscriptions?.filter((sub) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      sub.subscription_number.toLowerCase().includes(q) ||
      sub.customer?.full_name.toLowerCase().includes(q) ||
      sub.customer?.company_name?.toLowerCase().includes(q) ||
      sub.plan?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscriptions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage subscription lifecycles from Draft and Quotation to Active and Closed
          </p>
        </div>

        {role !== 'CUSTOMER' && (
          <Link
            to="/subscriptions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Subscription</span>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SUB#, customer name, company, or plan..."
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
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="QUOTATION">Quotation</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading subscriptions...</div>
        ) : filteredSubs?.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CalendarCheck className="h-10 w-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">No subscriptions found</div>
            <p className="text-xs text-slate-500">Create a quote or new subscription to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Subscription #</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Plan & Interval</th>
                  <th className="py-3 px-4 font-semibold">Start Date</th>
                  <th className="py-3 px-4 font-semibold">Next Billing</th>
                  <th className="py-3 px-4 font-semibold text-right">Recurring Total</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs?.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => navigate(`/subscriptions/${sub.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-bold text-indigo-600 font-mono">
                      {sub.subscription_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {sub.customer?.company_name || sub.customer?.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{sub.customer?.full_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{sub.plan?.name}</div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {sub.plan?.interval}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{sub.start_date}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {sub.next_billing_date || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ${Number(sub.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge status={sub.status} />
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
