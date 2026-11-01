import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Badge } from './Badge';
import {
  LogOut,
  User as UserIcon,
  Zap,
  ChevronDown,
  Building,
  Shield,
  Layers,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout, quickLogin } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const demoAccounts = [
    { role: 'ADMIN', name: 'Admin (Sarah)', email: 'admin@brightloop.io', pass: 'Admin@Brightloop2026!' },
    { role: 'STAFF', name: 'Sales Staff (Michael)', email: 'staff@brightloop.io', pass: 'Staff@Brightloop2026!' },
    { role: 'CUSTOMER', name: 'Customer (Acme)', email: 'alice@acme.com', pass: 'Customer@1234!' },
    { role: 'CUSTOMER', name: 'Customer (Starlight)', email: 'bob@starlight.io', pass: 'Customer@1234!' },
  ];

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900">Brightloop</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Subscription Cloud
              </span>
            </div>
            <p className="text-xs text-slate-500">Enterprise Recurring Billing</p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* Demo Role Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-900 text-xs font-medium transition cursor-pointer"
            >
              <Shield className="h-3.5 w-3.5 text-indigo-600" />
              <span>Switch Demo Account</span>
              <ChevronDown className="h-3 w-3 text-indigo-500" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Demo Role
                </div>
                {demoAccounts.map((acc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={async () => {
                      setShowRoleMenu(false);
                      await quickLogin(acc.email, acc.pass);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition flex items-center justify-between ${
                      user?.email === acc.email ? 'bg-indigo-50/50 font-semibold text-indigo-900' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{acc.name}</div>
                      <div className="text-slate-400 text-[11px]">{acc.email}</div>
                    </div>
                    <Badge status={acc.role} size="sm" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile Card */}
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-900 flex items-center justify-end gap-1.5">
                  <span>{user.full_name}</span>
                  <Badge status={user.role} size="sm" />
                </div>
                <div className="text-xs text-slate-500 truncate max-w-[180px]">
                  {user.company_name || user.email}
                </div>
              </div>

              <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm">
                {user.full_name.charAt(0).toUpperCase()}
              </div>

              <button
                type="button"
                onClick={logout}
                title="Log Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
