import axios from 'axios';
import {
  AgingReport,
  DashboardMetrics,
  DiscountRule,
  Invoice,
  Payment,
  Plan,
  Product,
  QuotationTemplate,
  RevenueTrendPoint,
  Subscription,
  Tax,
  User,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(originalRequest);
        } catch (e) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string; company_name?: string; phone?: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password', { token, new_password }),
};

export const usersApi = {
  list: (role?: string) => api.get<User[]>('/users', { params: { role } }),
  get: (id: number) => api.get<User>(`/users/${id}`),
  create: (data: any) => api.post<User>('/users', data),
  update: (id: number, data: any) => api.put<User>(`/users/${id}`, data),
};

export const productsApi = {
  list: (params?: { type?: string; is_active?: boolean }) => api.get<Product[]>('/products', { params }),
  get: (id: number) => api.get<Product>(`/products/${id}`),
  create: (data: any) => api.post<Product>('/products', data),
  update: (id: number, data: any) => api.put<Product>(`/products/${id}`, data),
  addVariant: (productId: number, data: any) => api.post(`/products/${productId}/variants`, data),
  deleteVariant: (variantId: number) => api.delete(`/products/variants/${variantId}`),
  calculatePrice: (data: { product_id: number; variant_ids?: number[]; quantity: number; discount_code?: string }) =>
    api.post('/products/calculate-price', data),
};

export const plansApi = {
  list: (params?: { interval?: string; is_active?: boolean }) => api.get<Plan[]>('/plans', { params }),
  get: (id: number) => api.get<Plan>(`/plans/${id}`),
  create: (data: any) => api.post<Plan>('/plans', data),
  update: (id: number, data: any) => api.put<Plan>(`/plans/${id}`, data),
};

export const quotationTemplatesApi = {
  list: () => api.get<QuotationTemplate[]>('/quotation-templates'),
  get: (id: number) => api.get<QuotationTemplate>(`/quotation-templates/${id}`),
  create: (data: any) => api.post<QuotationTemplate>('/quotation-templates', data),
  delete: (id: number) => api.delete(`/quotation-templates/${id}`),
};

export const subscriptionsApi = {
  list: (params?: { status?: string; customer_id?: number }) => api.get<Subscription[]>('/subscriptions', { params }),
  get: (id: number) => api.get<Subscription>(`/subscriptions/${id}`),
  create: (data: any) => api.post<Subscription>('/subscriptions', data),
  transition: (id: number, action: string, notes?: string) =>
    api.post<Subscription>(`/subscriptions/${id}/transition`, { action, notes }),
  billNow: (id: number, force: boolean = false) =>
    api.post<Invoice>(`/subscriptions/${id}/bill-now`, null, { params: { force } }),
};

export const invoicesApi = {
  list: (params?: { status?: string; customer_id?: number; subscription_id?: number }) =>
    api.get<Invoice[]>('/invoices', { params }),
  get: (id: number) => api.get<Invoice>(`/invoices/${id}`),
  updateStatus: (id: number, status: string, notes?: string) =>
    api.put<Invoice>(`/invoices/${id}/status`, { status, notes }),
  downloadPdf: (id: number) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
};

export const paymentsApi = {
  list: (params?: { customer_id?: number; invoice_id?: number }) => api.get<Payment[]>('/payments', { params }),
  create: (data: {
    invoice_id: number;
    amount: string | number;
    method: string;
    payment_date: string;
    transaction_notes?: string;
    reference_code?: string;
  }) => api.post<Payment>('/payments', data),
  get: (id: number) => api.get<Payment>(`/payments/${id}`),
};

export const taxesApi = {
  list: (params?: { scope?: string; is_active?: boolean }) => api.get<Tax[]>('/taxes', { params }),
  create: (data: any) => api.post<Tax>('/taxes', data),
  update: (id: number, data: any) => api.put<Tax>(`/taxes/${id}`, data),
};

export const discountsApi = {
  list: (params?: { scope?: string; is_active?: boolean }) => api.get<DiscountRule[]>('/discounts', { params }),
  create: (data: any) => api.post<DiscountRule>('/discounts', data),
  update: (id: number, data: any) => api.put<DiscountRule>(`/discounts/${id}`, data),
  validate: (data: { code: string; subtotal: number; total_quantity: number; product_ids?: number[] }) =>
    api.post('/discounts/validate', data),
};

export const billingApi = {
  runNow: () => api.post<Invoice[]>('/billing/run-now'),
  getSchedules: () => api.get<any[]>('/billing/schedules'),
};

export const dashboardApi = {
  getMetrics: (params?: { start_date?: string; end_date?: string; customer_id?: number }) =>
    api.get<DashboardMetrics>('/dashboard/metrics', { params }),
  getAgingReport: (customerId?: number) =>
    api.get<AgingReport>('/dashboard/aging-report', { params: { customer_id: customerId } }),
  getRevenueTrend: () => api.get<{ trend: RevenueTrendPoint[] }>('/dashboard/revenue-trend'),
};

export default api;
