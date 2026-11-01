import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { quotationTemplatesApi, plansApi, productsApi } from '../services/api';
import { QuotationTemplate } from '../types';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { FileSpreadsheet, Plus, Clock, Trash2, Layers } from 'lucide-react';

export const QuotationTemplates: React.FC = () => {
  const { role } = useAuth();
  const isStaffOrAdmin = role === 'ADMIN' || role === 'STAFF';

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    plan_id: '' as number | '',
    validity_days: 15,
  });

  interface LineState {
    product_id: number;
    variant_id?: number;
    quantity: number;
    discount_percent: number;
  }
  const [lines, setLines] = useState<LineState[]>([]);

  const { data: templates, refetch } = useQuery({
    queryKey: ['quotation-templates-full'],
    queryFn: async () => (await quotationTemplatesApi.list()).data,
  });
  const { data: plans } = useQuery({ queryKey: ['plans-list'], queryFn: async () => (await plansApi.list()).data });
  const { data: products } = useQuery({ queryKey: ['products-list'], queryFn: async () => (await productsApi.list()).data });

  const handleAddLine = () => {
    if (!products || products.length === 0) return;
    setLines([...lines, { product_id: products[0].id, quantity: 1, discount_percent: 0 }]);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await quotationTemplatesApi.create({
        ...form,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
        validity_days: Number(form.validity_days),
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id || undefined,
          quantity: l.quantity,
          discount_percent: l.discount_percent,
        })),
      });
      setIsAddOpen(false);
      setForm({ name: '', description: '', plan_id: '', validity_days: 15 });
      setLines([]);
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quotation Templates</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pre-configured bundles of products and plans with preset validity windows (e.g. valid for 15 days)
          </p>
        </div>

        {isStaffOrAdmin && (
          <button
            type="button"
            onClick={() => {
              if (products && products.length > 0) {
                setLines([{ product_id: products[0].id, quantity: 1, discount_percent: 0 }]);
              }
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Template</span>
          </button>
        )}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates?.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    <Clock className="h-3 w-3" /> Valid for {t.validity_days} days
                  </span>
                  <span>Plan: {t.plan?.name || 'Any'}</span>
                </div>
              </div>
            </div>

            {t.description && <p className="text-xs text-slate-600">{t.description}</p>}

            {/* Bundled Lines */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Bundled Products ({t.lines.length})
              </div>
              <div className="space-y-1.5">
                {t.lines.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{l.product?.name}</span>
                      {l.variant && (
                        <span className="text-[11px] text-slate-500 font-mono ml-2">
                          ({l.variant.attribute_name}: {l.variant.attribute_value})
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-700">
                      Qty: {l.quantity}
                      {Number(l.discount_percent) > 0 && (
                        <span className="text-emerald-600 font-semibold ml-2">
                          (-{l.discount_percent}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Template Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create Quotation Template" maxWidth="xl">
        <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Template Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              placeholder="e.g. Standard ERP + Support Bundle"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Associated Plan</label>
              <select
                value={form.plan_id}
                onChange={(e) => setForm({ ...form, plan_id: e.target.value ? Number(e.target.value) : '' })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="">Any Plan</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.interval})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Preset Validity Window (Days) *</label>
              <input
                type="number"
                min="1"
                required
                value={form.validity_days}
                onChange={(e) => setForm({ ...form, validity_days: parseInt(e.target.value) || 15 })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
              placeholder="Bundle description for sales reps..."
            />
          </div>

          {/* Bundled Lines */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Product Bundle Lines
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const prod = products?.find((p) => p.id === line.product_id);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <select
                      value={line.product_id}
                      onChange={(e) => {
                        const newPid = Number(e.target.value);
                        setLines(lines.map((l, i) => (i === idx ? { ...l, product_id: newPid, variant_id: undefined } : l)));
                      }}
                      className="flex-1 border border-slate-300 rounded p-1.5 text-xs bg-white"
                    >
                      {products?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={line.variant_id || ''}
                      onChange={(e) => {
                        const vId = e.target.value ? Number(e.target.value) : undefined;
                        setLines(lines.map((l, i) => (i === idx ? { ...l, variant_id: vId } : l)));
                      }}
                      className="flex-1 border border-slate-300 rounded p-1.5 text-xs bg-white"
                    >
                      <option value="">No Variant</option>
                      {prod?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attribute_name}: {v.attribute_value}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const q = parseInt(e.target.value) || 1;
                        setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: q } : l)));
                      }}
                      className="w-16 border border-slate-300 rounded p-1.5 text-center text-xs bg-white"
                    />

                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition cursor-pointer"
            >
              Save Template
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
