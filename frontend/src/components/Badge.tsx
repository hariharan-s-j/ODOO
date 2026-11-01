import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const norm = status?.toUpperCase() || '';
  let colorClasses = 'bg-slate-100 text-slate-800 border-slate-200';

  // Subscriptions & Invoices
  if (norm === 'ACTIVE' || norm === 'PAID') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (norm === 'CONFIRMED') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (norm === 'QUOTATION') {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (norm === 'PAUSED') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (norm === 'DRAFT') {
    colorClasses = 'bg-slate-100 text-slate-700 border-slate-300';
  } else if (norm === 'CLOSED' || norm === 'CANCELLED') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (norm === 'OVERDUE') {
    colorClasses = 'bg-red-100 text-red-800 border-red-300 font-semibold animate-pulse';
  }

  // Roles
  else if (norm === 'ADMIN') {
    colorClasses = 'bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold';
  } else if (norm === 'STAFF') {
    colorClasses = 'bg-teal-100 text-teal-800 border-teal-200 font-medium';
  } else if (norm === 'CUSTOMER') {
    colorClasses = 'bg-sky-100 text-sky-800 border-sky-200 font-medium';
  }

  // Product types
  else if (norm === 'SOFTWARE') {
    colorClasses = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (norm === 'SERVICE') {
    colorClasses = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (norm === 'ADD_ON') {
    colorClasses = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs tracking-wide';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium uppercase ${sizeClasses} ${colorClasses}`}
    >
      {status}
    </span>
  );
};
