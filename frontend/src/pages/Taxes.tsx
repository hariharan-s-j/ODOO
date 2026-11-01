import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taxesApi } from '../services/api';
import { Tax } from '../types';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Receipt, Plus } from 'lucide-react';
import { Badge } from '../components/Badge';

export const Taxes: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    rate: '',
    tax_type: 'FLAT_PERCENT',
    scope: 'ALL',
  });

  const { data: taxes, refetch } = useQuery({
    queryKey: ['taxes-list-full'],
    queryFn: async () => (await taxesApi.list()).data,
  });

  const handleCreateTax = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await taxesApi.create({
        ...form,
        rate: Number(form.rate),
      });
      setIsAddOpen(false);
      setForm({ name: '', rate: '', tax_type: 'FLAT_PERCENT', scope: 'ALL' });
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create tax rule');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tax Engine Rules</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure line-item taxes, regional rates, and product type scopes
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Tax Rule</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {taxes?.map((tax) => (
          <div key={tax.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{tax.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono uppercase mt-0.5 block">{tax.tax_type}</span>
              </div>
              <div className="text-xl font-black text-indigo-600">{tax.rate}%</div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Applicable Scope:</span>
              <Badge status={tax.scope} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Add Tax Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create Tax Rule">
        <form onSubmit={handleCreateTax} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tax Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              placeholder="e.g. State Sales Tax (8.25%)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax Rate (%) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 bg-white"
                placeholder="10.00"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax Type *</label>
              <select
                value={form.tax_type}
                onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="FLAT_PERCENT">Flat Percentage</option>
                <option value="COMPOUND">Compound Tax</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Applicable Product Scope *</label>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
            >
              <option value="ALL">All Products & Services</option>
              <option value="SOFTWARE">Software Products Only</option>
              <option value="SERVICE">Services & SLA Only</option>
              <option value="ADD_ON">Add-ons Only</option>
            </select>
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
              Save Tax Rule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
