import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { invoicesApi, paymentsApi } from '../services/api';
import { InvoicePrintView } from '../components/InvoicePrintView';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { DollarSign, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const invoiceId = Number(id);
  const navigate = useNavigate();
  const { role } = useAuth();

  // Payment modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CREDIT_CARD');
  const [payNotes, setPayNotes] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: async () => (await invoicesApi.get(invoiceId)).data,
    enabled: !!invoiceId,
  });

  const handleOpenPayment = () => {
    if (invoice) {
      setPayAmount(String(invoice.balance_due));
      setPayError(null);
      setIsPayModalOpen(true);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    setPayLoading(true);
    try {
      await paymentsApi.create({
        invoice_id: invoiceId,
        amount: Number(payAmount),
        method: payMethod,
        payment_date: new Date().toISOString().split('T')[0],
        transaction_notes: payNotes,
        reference_code: payRef,
      });
      setIsPayModalOpen(false);
      refetch();
    } catch (err: any) {
      setPayError(err.response?.data?.detail || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading invoice document...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-slate-300 mx-auto" />
        <div className="text-sm font-semibold text-slate-800">Invoice not found</div>
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="text-xs text-indigo-600 hover:underline"
        >
          Return to invoices
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Banner with payment action */}
      {Number(invoice.balance_due) > 0 && invoice.status !== 'CANCELLED' && (
        <div className="no-print bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-indigo-950">
              Outstanding Balance: ${Number(invoice.balance_due).toFixed(2)}
            </div>
            <p className="text-[11px] text-indigo-700">
              {role === 'CUSTOMER'
                ? 'You have an open balance due for this invoice.'
                : 'Supports full and partial payment recording.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenPayment}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      )}

      {/* Printable Invoice View Component */}
      <InvoicePrintView invoice={invoice} onBack={() => navigate('/invoices')} />

      {/* Payment Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={`Record Payment for ${invoice.invoice_number}`}
      >
        {payError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {payError}
          </div>
        )}

        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Amount ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={Number(invoice.balance_due)}
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 bg-white"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              Max balance: ${Number(invoice.balance_due).toFixed(2)} (Partial payments supported)
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
            >
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="STRIPE">Stripe Electronic</option>
              <option value="BANK_TRANSFER">Bank Wire / ACH</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Transaction Reference / Trace ID
            </label>
            <input
              type="text"
              placeholder="e.g. STRIPE-CH-9921, WIRE-TX-882"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Transaction Notes
            </label>
            <textarea
              rows={2}
              placeholder="Check number, cashier initials, receipt remarks..."
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPayModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={payLoading || !payAmount || Number(payAmount) <= 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {payLoading ? 'Recording...' : 'Confirm & Apply Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
