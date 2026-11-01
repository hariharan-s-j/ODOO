import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Subscriptions } from './pages/Subscriptions';
import { NewSubscription } from './pages/NewSubscription';
import { SubscriptionDetail } from './pages/SubscriptionDetail';
import { Invoices } from './pages/Invoices';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Products } from './pages/Products';
import { Plans } from './pages/Plans';
import { QuotationTemplates } from './pages/QuotationTemplates';
import { Discounts } from './pages/Discounts';
import { Taxes } from './pages/Taxes';
import { Payments } from './pages/Payments';
import { UsersPage } from './pages/UsersPage';
import { BillingLogs } from './pages/BillingLogs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Authenticated Application Layout */}
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/subscriptions/new" element={<NewSubscription />} />
              <Route path="/subscriptions/:id" element={<SubscriptionDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/quotation-templates" element={<QuotationTemplates />} />
              <Route path="/discounts" element={<Discounts />} />
              <Route path="/taxes" element={<Taxes />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/billing-logs" element={<BillingLogs />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
