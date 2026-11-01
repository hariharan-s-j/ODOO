import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api';
import { User, UserRole } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Shield, Search, Mail, Building, Phone } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [roleFilter, setRoleFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    phone: '',
    role: 'STAFF' as UserRole,
  });

  const { data: users, refetch } = useQuery({
    queryKey: ['users-list-page', roleFilter],
    queryFn: async () => (await usersApi.list(roleFilter || undefined)).data,
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await usersApi.create(form);
      setIsAddOpen(false);
      setForm({
        email: '',
        password: '',
        full_name: '',
        company_name: '',
        phone: '',
        role: 'STAFF',
      });
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create user');
    }
  };

  const filteredUsers = users?.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isAdmin ? 'Staff Provisioning & Customer Accounts' : 'Customer Directory'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'RBAC Administration: Provision internal staff members and manage registered clients'
              : 'Browse customer contacts and billing profiles'}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Provision User / Staff</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Filter Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admins Only</option>
              <option value="STAFF">Staff Only</option>
              <option value="CUSTOMER">Customers Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">User / Contact</th>
                <th className="py-3 px-4 font-semibold">Company</th>
                <th className="py-3 px-4 font-semibold">Email</th>
                <th className="py-3 px-4 font-semibold">Phone</th>
                <th className="py-3 px-4 font-semibold text-center">Role</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers?.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{u.full_name}</td>
                  <td className="py-3.5 px-4 text-slate-600">{u.company_name || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3.5 px-4 text-slate-500">{u.phone || '—'}</td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge status={u.role} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Provision New Account">
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="Dwight Schrute"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role Permission *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white font-semibold"
              >
                <option value="STAFF">STAFF (Operations / Quotes)</option>
                <option value="ADMIN">ADMIN (Full Governance)</option>
                <option value="CUSTOMER">CUSTOMER (Self-Service)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              placeholder="dwight@brightloop.io"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              placeholder="Min 8 chars, 1 upper, 1 lower, 1 special"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="Optional"
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
              Provision Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
