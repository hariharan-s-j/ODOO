import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscriptionsApi, invoicesApi } from '../services/api';
import { Badge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Send,
  Zap,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

export const SubscriptionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const subId = Number(id);
  const { role } = useAuth();
  const navigate = useNavigate();

  const [transitionMsg, setTransitionMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch subscription
  const { data: sub, isLoading, refetch } = useQuery({
    queryKey: ['subscription-detail', subId],
    queryFn: async () => (await subscriptionsApi.get(subId)).data,
    enabled: !!subId,
  });

  // Fetch linked invoices for this subscription
  const { data: invoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['subscription-invoices', subId],
    queryFn: async () => (await invoicesApi.list({ subscription_id: subId })).data,
    enabled: !!subId,
  });

  const handleTransition = async (action: string) => {
    setIsProcessing(true);
    setTransitionMsg(null);
    try {
      await subscriptionsApi.transition(subId, action);
      setTransitionMsg({ success: true, text: `Subscription transitioned successfully (${action}).` });
      refetch();
    } catch (err: any) {
      setTransitionMsg({ success: false, text: err.response?.data?.detail || 'State transition failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBillNow = async () => {
    setIsProcessing(true);
    setTransitionMsg(null);
    try {
      const res = await subscriptionsApi.billNow(subId, true);
      setTransitionMsg({ success: true, text: `Invoice ${res.data.invoice_number} generated successfully!` });
      refetch();
      refetchInvoices();
    } catch (err: any) {
      setTransitionMsg({ success: false, text: err.response?.data?.detail || 'Billing generation failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading subscription record...</div>;
  }

  if (!sub) {
    return (
      <div className="p-12 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-slate-300 mx-auto" />
        <div className="text-sm font-semibold text-slate-800">Subscription not found</div>
        <Link to="/subscriptions" className="text-xs text-indigo-600 hover:underline">
          Return to subscriptions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/subscriptions"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {sub.subscription_number}
              </h1>
              <Badge status={sub.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: {sub.customer?.company_name || sub.customer?.full_name} | Plan: {sub.plan?.name}
            </p>
          </div>
        </div>

        {/* FSM Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {sub.status === 'DRAFT' && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTransition('to_quotation')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send Quotation</span>
            </button>
          )}

          {(sub.status === 'DRAFT' || sub.status === 'QUOTATION') && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTransition('confirm')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Confirm Order</span>
            </button>
          )}

          {(sub.status === 'CONFIRMED' || sub.status === 'PAUSED') && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTransition('activate')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              <span>Activate</span>
            </button>
          )}

          {sub.status === 'ACTIVE' && sub.allow_pause && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTransition('pause')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5 fill-white" />
              <span>Pause</span>
            </button>
          )}

          {sub.status === 'ACTIVE' && role !== 'CUSTOMER' && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBillNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Generate Invoice Now</span>
            </button>
          )}

          {sub.status !== 'CLOSED' && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTransition('close')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Close / Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Transition Feedback Alert */}
      {transitionMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            transitionMsg.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {transitionMsg.success ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          <span>{transitionMsg.text}</span>
        </div>
      )}

      {/* FSM Visual Stepper */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Subscription State Machine (FSM)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          {['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'].map((step, idx) => {
            const isCurrent = sub.status === step;
            const isPast =
              ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'].indexOf(sub.status) > idx;

            return (
              <div
                key={step}
                className={`p-2.5 rounded-xl border font-bold ${
                  isCurrent
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs'
                    : isPast
                    ? 'bg-slate-50 border-slate-200 text-slate-500'
                    : 'bg-slate-50/40 border-slate-200 text-slate-300'
                }`}
              >
                <div className="text-[10px] text-slate-400">Step {idx + 1}</div>
                <div>{step}</div>
              </div>
            );
          })}
        </div>
        {sub.status === 'PAUSED' && (
          <div className="mt-3 p-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs text-center font-semibold">
            Status: PAUSED (Billing paused per plan allowance)
          </div>
        )}
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
          <div className="font-bold text-slate-400 uppercase tracking-wider">Customer Profile</div>
          <div className="text-sm font-bold text-slate-900">
            {sub.customer?.company_name || sub.customer?.full_name}
          </div>
          <div className="text-slate-600">{sub.customer?.full_name}</div>
          <div className="text-slate-600">{sub.customer?.email}</div>
          {sub.customer?.phone && <div className="text-slate-600">{sub.customer?.phone}</div>}
        </div>

        {/* Plan Parameters */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
          <div className="font-bold text-slate-400 uppercase tracking-wider">Plan & Policies</div>
          <div className="text-sm font-bold text-slate-900">{sub.plan?.name}</div>
          <div className="flex justify-between">
            <span className="text-slate-500">Recurrence:</span>
            <span className="font-medium text-slate-900">{sub.plan?.interval}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Allow Pause:</span>
            <span className="font-medium text-slate-900">{sub.allow_pause ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Allow Early Close:</span>
            <span className="font-medium text-slate-900">{sub.allow_early_close ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Auto Close on Expiry:</span>
            <span className="font-medium text-slate-900">{sub.auto_close_on_expiry ? 'Yes' : 'No'}</span>
          </div>
        </div>

        {/* Dates & Payment Terms */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
          <div className="font-bold text-slate-400 uppercase tracking-wider">Dates & Terms</div>
          <div className="flex justify-between">
            <span className="text-slate-500">Start Date:</span>
            <span className="font-medium text-slate-900">{sub.start_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Expiry Date:</span>
            <span className="font-medium text-slate-900">{sub.end_date || 'Ongoing'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Next Billing Date:</span>
            <span className="font-bold text-indigo-600">{sub.next_billing_date || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Terms:</span>
            <span className="font-medium text-slate-900">{sub.payment_terms}</span>
          </div>
          {sub.quotation_valid_until && (
            <div className="flex justify-between text-purple-700 font-semibold">
              <span>Quote Valid Until:</span>
              <span>{sub.quotation_valid_until}</span>
            </div>
          )}
        </div>
      </div>

      {/* Itemized Lines */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Itemized Product Lines & Variants
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <th className="py-2.5 font-semibold">Product</th>
                <th className="py-2.5 font-semibold">Variant Attribute</th>
                <th className="py-2.5 font-semibold text-center w-16">Qty</th>
                <th className="py-2.5 font-semibold text-right w-24">Unit Price</th>
                <th className="py-2.5 font-semibold text-right w-20">Tax</th>
                <th className="py-2.5 font-semibold text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sub.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-3 font-medium text-slate-900">{line.product?.name}</td>
                  <td className="py-3 text-slate-600 font-mono text-[11px]">
                    {line.variant
                      ? `${line.variant.attribute_name}: ${line.variant.attribute_value} (+${line.variant.price_surcharge})`
                      : '—'}
                  </td>
                  <td className="py-3 text-center text-slate-700">{line.quantity}</td>
                  <td className="py-3 text-right text-slate-700">${Number(line.unit_price).toFixed(2)}</td>
                  <td className="py-3 text-right text-slate-500">
                    {Number(line.tax_rate) > 0 ? `${line.tax_rate}%` : '—'}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    ${Number(line.total_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="border-t border-slate-200 pt-4 flex justify-end">
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-medium">${Number(sub.subtotal).toFixed(2)}</span>
            </div>

            {Number(sub.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount ({sub.discount_code || 'Applied'}):</span>
                <span>-${Number(sub.discount_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Tax:</span>
              <span className="font-medium">${Number(sub.tax_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-2">
              <span>Recurring Cycle Total:</span>
              <span className="text-indigo-600">${Number(sub.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Invoices Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Generated Invoices ({invoices?.length || 0})
        </h2>

        {!invoices || invoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No recurring invoices generated yet. Invoices generate automatically on billing day.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                  <th className="py-2.5 font-semibold">Invoice #</th>
                  <th className="py-2.5 font-semibold">Issue Date</th>
                  <th className="py-2.5 font-semibold">Due Date</th>
                  <th className="py-2.5 font-semibold text-right">Total</th>
                  <th className="py-2.5 font-semibold text-right">Balance Due</th>
                  <th className="py-2.5 font-semibold text-center">Status</th>
                  <th className="py-2.5 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3 font-bold text-indigo-600 font-mono">{inv.invoice_number}</td>
                    <td className="py-3 text-slate-600">{inv.issue_date}</td>
                    <td className="py-3 text-slate-600">{inv.due_date}</td>
                    <td className="py-3 text-right font-medium text-slate-900">
                      ${Number(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      ${Number(inv.balance_due).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <Badge status={inv.status} size="sm" />
                    </td>
                    <td className="py-3 text-center">
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
