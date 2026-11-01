import React from 'react';
import { Invoice } from '../types';
import { Badge } from './Badge';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { invoicesApi } from '../services/api';

interface InvoicePrintViewProps {
  invoice: Invoice;
  onBack?: () => void;
}

export const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({ invoice, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await invoicesApi.downloadPdf(invoice.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Could not download PDF invoice.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar (hidden during print) */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Invoices</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Native PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Body */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">BRIGHTLOOP SOFTWARE</h1>
            <p className="text-xs text-slate-500 mt-1">Enterprise Subscription & Cloud Solutions</p>
            <p className="text-xs text-slate-500">100 Innovation Way, Suite 400 | billing@brightloop.io</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight text-indigo-600">{invoice.invoice_number}</div>
            <div className="mt-2">
              <Badge status={invoice.is_overdue ? 'OVERDUE' : invoice.status} />
            </div>
          </div>
        </div>

        {/* Customer & Dates Meta */}
        <div className="grid grid-cols-2 gap-8 py-8 border-b border-slate-200 text-xs">
          <div>
            <div className="font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</div>
            <div className="text-sm font-bold text-slate-900">
              {invoice.customer?.company_name || invoice.customer?.full_name}
            </div>
            <div className="text-slate-600 mt-1">{invoice.customer?.full_name}</div>
            <div className="text-slate-600">{invoice.customer?.email}</div>
            {invoice.customer?.phone && <div className="text-slate-600">{invoice.customer?.phone}</div>}
          </div>

          <div className="text-right space-y-1">
            <div className="font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Details</div>
            <div>
              <span className="text-slate-500">Issue Date: </span>
              <span className="font-semibold text-slate-900">{invoice.issue_date}</span>
            </div>
            <div>
              <span className="text-slate-500">Due Date: </span>
              <span className={`font-semibold ${invoice.is_overdue ? 'text-red-600' : 'text-slate-900'}`}>
                {invoice.due_date}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Payment Terms: </span>
              <span className="font-semibold text-slate-900">{invoice.payment_terms}</span>
            </div>
            {invoice.period_start && invoice.period_end && (
              <div>
                <span className="text-slate-500">Billing Period: </span>
                <span className="font-medium text-slate-700">
                  {invoice.period_start} to {invoice.period_end}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Lines Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 font-semibold">Description</th>
                <th className="py-3 font-semibold text-center w-16">Qty</th>
                <th className="py-3 font-semibold text-right w-28">Unit Price</th>
                <th className="py-3 font-semibold text-right w-24">Tax</th>
                <th className="py-3 font-semibold text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-3.5 pr-4">
                    <div className="font-medium text-slate-900">{line.product_name}</div>
                    {line.variant_name && (
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{line.variant_name}</div>
                    )}
                  </td>
                  <td className="py-3.5 text-center text-slate-700">{line.quantity}</td>
                  <td className="py-3.5 text-right text-slate-700">${Number(line.unit_price).toFixed(2)}</td>
                  <td className="py-3.5 text-right text-slate-500">
                    {Number(line.tax_rate) > 0 ? `${line.tax_rate}%` : '—'}
                  </td>
                  <td className="py-3.5 text-right font-medium text-slate-900">
                    ${Number(line.total_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="border-t border-slate-200 pt-6 flex justify-end">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">${Number(invoice.subtotal).toFixed(2)}</span>
            </div>

            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span className="font-medium">${Number(invoice.tax_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Total Amount</span>
              <span>${Number(invoice.total_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Amount Paid</span>
              <span className="font-medium text-emerald-600">${Number(invoice.amount_paid).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-2 text-slate-900">
              <span>Balance Due</span>
              <span className={Number(invoice.balance_due) > 0 ? 'text-indigo-600 font-extrabold' : 'text-slate-600'}>
                ${Number(invoice.balance_due).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Notes / Terms: </span>
            <span>{invoice.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
};
