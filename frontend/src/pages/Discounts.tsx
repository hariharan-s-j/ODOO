import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { discountsApi, productsApi } from '../services/api';
import { DiscountRule } from '../types';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Percent, Plus, Tag, Check, X } from 'lucide-react';

export const Discounts: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    discount_type: 'PERCENTAGE',
    value: '',
    scope: 'ORDER',
    product_id: '' as number | '',
    min_spend: '0.00',
    min_quantity: 0,
    max_uses: '',
  });

  const { data: discounts, refetch } = useQuery({
    queryKey: ['discounts-list-full'],
    queryFn: async () => (await discountsApi.list()).data,
  });

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => (await productsApi.list()).data,
  });

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await discountsApi.create({
        ...form,
        code: form.code.trim().toUpperCase(),
        value: Number(form.value),
        min_spend: Number(form.min_spend || 0),
        min_quantity: Number(form.min_quantity || 0),
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
        product_id: form.scope === 'PRODUCT' && form.product_id ? Number(form.product_id) : undefined,
      });
      setIsAddOpen(false);
      setForm({
        code: '',
        name: '',
        discount_type: 'PERCENTAGE',
        value: '',
        scope: 'ORDER',
        product_id: '',
        min_spend: '0.00',
        min_quantity: 0,
        max_uses: '',
      });
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create discount rule');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dynamic Discount Rules</h1>
          <p className="text-xs text-slate-500 mt-1">
            Admin-defined promotional codes and volume discounts attached automatically to orders & invoices
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Discount Rule</span>
          </button>
        )}
      </div>

      {/* Discounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {discounts?.map((d) => (
          <div key={d.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-sm font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md inline-block">
                    {d.code}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{d.name}</h3>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-slate-900">
                    {d.discount_type === 'PERCENTAGE' ? `${d.value}%` : `$${Number(d.value).toFixed(2)}`}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase">{d.discount_type}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Scope:</span>
                  <span className="font-semibold text-slate-900">
                    {d.scope === 'ORDER' ? 'Entire Order' : `Product #${d.product_id}`}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Minimum Spend:</span>
                  <span className="font-medium text-slate-900">${Number(d.min_spend).toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Minimum Quantity:</span>
                  <span className="font-medium text-slate-900">{d.min_quantity} items</span>
                </div>

                <div className="flex justify-between">
                  <span>Usage Count:</span>
                  <span className="font-bold text-indigo-600">
                    {d.current_uses} {d.max_uses ? `/ ${d.max_uses}` : '(Unlimited)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Discount Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create Dynamic Discount Rule">
        <form onSubmit={handleCreateDiscount} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Coupon / Promo Code *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono uppercase bg-white"
                placeholder="PROMO20"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rule Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="e.g. 20% Off Launch Deal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Discount Type *</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount ($)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Value *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 bg-white"
                placeholder={form.discount_type === 'PERCENTAGE' ? '15.00' : '50.00'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Application Scope *</label>
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="ORDER">Entire Order Subtotal</option>
                <option value="PRODUCT">Specific Product SKU</option>
              </select>
            </div>

            {form.scope === 'PRODUCT' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
                <select
                  required={form.scope === 'PRODUCT'}
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                >
                  <option value="">Select Target Product...</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Spend ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.min_spend}
                onChange={(e) => setForm({ ...form, min_spend: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Quantity</label>
              <input
                type="number"
                min="0"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Uses</label>
              <input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="Unlimited"
              />
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
              Save Rule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
