import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { plansApi } from '../services/api';
import { Plan, RecurrenceInterval } from '../types';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Layers, Plus, Check, X } from 'lucide-react';

export const Plans: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    interval: 'MONTHLY' as RecurrenceInterval,
    cost: '0.00',
    minimum_quantity: 1,
    auto_close_on_expiry: true,
    allow_pause: true,
    allow_early_close: true,
  });

  const { data: plans, isLoading, refetch } = useQuery({
    queryKey: ['plans-list-full'],
    queryFn: async () => (await plansApi.list()).data,
  });

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await plansApi.create({
        ...form,
        cost: Number(form.cost),
        minimum_quantity: Number(form.minimum_quantity),
      });
      setIsAddPlanOpen(false);
      setForm({
        name: '',
        code: '',
        description: '',
        interval: 'MONTHLY',
        cost: '0.00',
        minimum_quantity: 1,
        auto_close_on_expiry: true,
        allow_pause: true,
        allow_early_close: true,
      });
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create plan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscription Plans</h1>
          <p className="text-xs text-slate-500 mt-1">
            Define recurring billing intervals (Daily, Weekly, Monthly, Yearly) and lifecycle policies
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddPlanOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Plan</span>
          </button>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => (
          <div key={plan.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  <div className="text-[11px] text-slate-400 font-mono">{plan.code}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {plan.interval}
                </span>
              </div>

              {plan.description && <p className="text-xs text-slate-600 leading-relaxed">{plan.description}</p>}

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Minimum Quantity:</span>
                  <span className="font-semibold text-slate-900">{plan.minimum_quantity} items</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Base Plan Fee:</span>
                  <span className="font-semibold text-slate-900">${Number(plan.cost).toFixed(2)}</span>
                </div>
              </div>

              {/* Policy Badges */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">
                  Lifecycle Rules
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Pause Permitted:</span>
                  {plan.allow_pause ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <Check className="h-3.5 w-3.5" /> Allowed
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 font-medium">
                      <X className="h-3.5 w-3.5" /> Prohibited
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Early Termination:</span>
                  {plan.allow_early_close ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <Check className="h-3.5 w-3.5" /> Allowed
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 font-medium">
                      <X className="h-3.5 w-3.5" /> Prohibited
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Auto Close on Expiry:</span>
                  {plan.auto_close_on_expiry ? (
                    <span className="text-indigo-700 flex items-center gap-1 font-medium">
                      <Check className="h-3.5 w-3.5" /> Enabled
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">Disabled</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Plan Modal */}
      <Modal isOpen={isAddPlanOpen} onClose={() => setIsAddPlanOpen(false)} title="Create Subscription Plan">
        <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Plan Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              placeholder="e.g. Monthly Enterprise Plan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Plan Code *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono bg-white"
                placeholder="PLAN-ENT-M"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recurrence Interval *</label>
              <select
                value={form.interval}
                onChange={(e) => setForm({ ...form, interval: e.target.value as RecurrenceInterval })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Base Plan Cost ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Minimum Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={form.minimum_quantity}
                onChange={(e) => setForm({ ...form, minimum_quantity: parseInt(e.target.value) || 1 })}
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
              placeholder="Terms, cancellation flexibility, target tier..."
            />
          </div>

          <div className="pt-2 space-y-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="checkbox"
                checked={form.allow_pause}
                onChange={(e) => setForm({ ...form, allow_pause: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Allow customer or staff to pause subscription</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="checkbox"
                checked={form.allow_early_close}
                onChange={(e) => setForm({ ...form, allow_early_close: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Allow early cancellation before contract expiry</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="checkbox"
                checked={form.auto_close_on_expiry}
                onChange={(e) => setForm({ ...form, auto_close_on_expiry: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Automatically close subscription upon reaching expiry date</span>
            </label>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddPlanOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition cursor-pointer"
            >
              Save Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
