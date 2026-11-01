import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  CalendarCheck,
  CreditCard,
  FileText,
  Package,
  Layers,
  FileSpreadsheet,
  Percent,
  Receipt,
  Users,
  Clock,
  Sparkles,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();

  const isCustomer = role === 'CUSTOMER';
  const isAdmin = role === 'ADMIN';
  const isStaffOrAdmin = role === 'ADMIN' || role === 'STAFF';

  interface NavItem {
    label: string;
    to: string;
    icon: React.ElementType;
    badge?: string;
  }

  const customerNav: NavItem[] = [
    { label: 'My Subscriptions', to: '/subscriptions', icon: CalendarCheck },
    { label: 'My Invoices & Receipts', to: '/invoices', icon: FileText },
    { label: 'Payment History', to: '/payments', icon: CreditCard },
  ];

  const staffAdminNav: NavItem[] = [
    { label: 'Finance Dashboard', to: '/dashboard', icon: BarChart3 },
    { label: 'Subscriptions (FSM)', to: '/subscriptions', icon: CalendarCheck },
    { label: 'Invoices & Billing', to: '/invoices', icon: FileText },
    { label: 'Payments & Arrears', to: '/payments', icon: CreditCard },
    { label: 'Products & Variants', to: '/products', icon: Package },
    { label: 'Plans & Intervals', to: '/plans', icon: Layers },
    { label: 'Quotation Templates', to: '/quotation-templates', icon: FileSpreadsheet },
    { label: 'Customers', to: '/users', icon: Users },
  ];

  const adminOnlyNav: NavItem[] = [
    { label: 'Dynamic Discounts', to: '/discounts', icon: Percent },
    { label: 'Tax Engine Rules', to: '/taxes', icon: Receipt },
    { label: 'Staff & Provisioning', to: '/users', icon: Users },
    { label: 'Billing Schedule Logs', to: '/billing-logs', icon: Clock },
  ];

  return (
    <aside className="no-print w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        {/* Navigation list */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCustomer ? 'Customer Self-Service' : 'Operations & Revenue'}
          </div>
          <nav className="space-y-1">
            {(isCustomer ? customerNav : staffAdminNav).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Admin only configuration section */}
        {isAdmin && (
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Admin & Governance
            </div>
            <nav className="space-y-1">
              {adminOnlyNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Info card footer */}
      <div className="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
          <Sparkles className="h-4 w-4" />
          <span>Idempotent Billing</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Zero double-billing guarantee backed by billing schedules and hash locks.
        </p>
      </div>
    </aside>
  );
};
