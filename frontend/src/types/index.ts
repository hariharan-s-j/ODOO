export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: number;
  email: string;
  full_name: string;
  company_name?: string | null;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  attribute_name: string;
  attribute_value: string;
  price_surcharge: string | number;
  sku?: string | null;
  is_active: boolean;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  type: 'SERVICE' | 'SOFTWARE' | 'ADD_ON';
  sales_price: string | number;
  cost_price: string | number;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
}

export type RecurrenceInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Plan {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  interval: RecurrenceInterval;
  cost: string | number;
  minimum_quantity: number;
  start_date?: string | null;
  end_date?: string | null;
  auto_close_on_expiry: boolean;
  allow_pause: boolean;
  allow_early_close: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuotationTemplateLine {
  id: number;
  template_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price_override?: string | number | null;
  discount_percent: string | number;
  product?: Product;
  variant?: ProductVariant;
}

export interface QuotationTemplate {
  id: number;
  name: string;
  description?: string | null;
  plan_id?: number | null;
  validity_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  plan?: Plan | null;
  lines: QuotationTemplateLine[];
}

export interface Tax {
  id: number;
  name: string;
  rate: string | number;
  tax_type: 'FLAT_PERCENT' | 'COMPOUND';
  scope: 'ALL' | 'SERVICE' | 'SOFTWARE' | 'ADD_ON';
  is_active: boolean;
  created_at: string;
}

export interface DiscountRule {
  id: number;
  code: string;
  name: string;
  discount_type: 'FIXED' | 'PERCENTAGE';
  value: string | number;
  scope: 'ORDER' | 'PRODUCT';
  product_id?: number | null;
  min_spend: string | number;
  min_quantity: number;
  start_date?: string | null;
  end_date?: string | null;
  max_uses?: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

export type SubscriptionStatus = 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'PAUSED' | 'CLOSED';

export interface SubscriptionLine {
  id: number;
  subscription_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: string | number;
  tax_id?: number | null;
  tax_rate: string | number;
  subtotal: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  product?: Product;
  variant?: ProductVariant;
}

export interface Subscription {
  id: number;
  subscription_number: string;
  customer_id: number;
  plan_id: number;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string | null;
  next_billing_date?: string | null;
  payment_terms: string;
  notes?: string | null;
  quotation_valid_until?: string | null;
  auto_close_on_expiry: boolean;
  allow_pause: boolean;
  allow_early_close: boolean;
  discount_code?: string | null;
  subtotal: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  created_at: string;
  updated_at: string;
  customer?: User;
  plan?: Plan;
  lines: SubscriptionLine[];
}

export type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  product_id?: number | null;
  variant_id?: number | null;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: string | number;
  subtotal: string | number;
  tax_id?: number | null;
  tax_rate: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  total_amount: string | number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  subscription_id?: number | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  period_start?: string | null;
  period_end?: string | null;
  subtotal: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  amount_paid: string | number;
  balance_due: string | number;
  payment_terms: string;
  notes?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
  customer?: User;
  lines: InvoiceLine[];
  is_overdue?: boolean;
}

export interface Payment {
  id: number;
  payment_number: string;
  invoice_id: number;
  customer_id: number;
  method: 'CREDIT_CARD' | 'STRIPE' | 'BANK_TRANSFER' | 'CASH';
  amount: string | number;
  payment_date: string;
  transaction_notes?: string | null;
  reference_code?: string | null;
  created_at: string;
  invoice_number?: string | null;
  customer?: User;
}

export interface DashboardMetrics {
  active_subscriptions: number;
  mrr: string | number;
  total_invoiced: string | number;
  outstanding_receivables: string | number;
  overdue_receivables: string | number;
  total_collected: string | number;
  total_customers: number;
  total_invoices_count: number;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: string | number;
}

export interface AgingReport {
  total_overdue: string | number;
  total_outstanding: string | number;
  buckets: AgingBucket[];
  overdue_invoices: Invoice[];
}

export interface RevenueTrendPoint {
  period: string;
  invoiced: string | number;
  collected: string | number;
  active_subs: number;
}
