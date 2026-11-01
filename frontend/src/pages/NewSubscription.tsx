import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  productsApi,
  plansApi,
  quotationTemplatesApi,
  taxesApi,
  discountsApi,
  subscriptionsApi,
  usersApi,
} from '../services/api';
import { Product, ProductVariant, Plan, Tax, QuotationTemplate, User } from '../types';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Calculator,
  Layers,
} from 'lucide-react';

export const NewSubscription: React.FC = () => {
  const navigate = useNavigate();

  // Mode: Template or Custom
  const [useTemplate, setUseTemplate] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);

  // Form State
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [planId, setPlanId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<string>('Immediate');
  const [notes, setNotes] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');

  // Discount validation feedback
  const [discountMsg, setDiscountMsg] = useState<{ valid: boolean; text: string; amount: number } | null>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState<boolean>(false);

  // Line items
  interface LineItem {
    id: string;
    product_id: number;
    variant_id?: number;
    quantity: number;
    unit_price: number;
    tax_id?: number;
    subtotal: number;
  }
  const [lines, setLines] = useState<LineItem[]>([]);

  // Fetch reference data
  const { data: customers } = useQuery({ queryKey: ['customers-list'], queryFn: async () => (await usersApi.list('CUSTOMER')).data });
  const { data: plans } = useQuery({ queryKey: ['plans-list'], queryFn: async () => (await plansApi.list({ is_active: true })).data });
  const { data: products } = useQuery({ queryKey: ['products-list'], queryFn: async () => (await productsApi.list({ is_active: true })).data });
  const { data: taxes } = useQuery({ queryKey: ['taxes-list'], queryFn: async () => (await taxesApi.list({ is_active: true })).data });
  const { data: templates } = useQuery({ queryKey: ['templates-list'], queryFn: async () => (await quotationTemplatesApi.list()).data });

  // Handle template selection
  useEffect(() => {
    if (useTemplate && selectedTemplateId && templates) {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        if (tpl.plan_id) setPlanId(tpl.plan_id);
        const mappedLines: LineItem[] = tpl.lines.map((l) => {
          const prod = products?.find((p) => p.id === l.product_id);
          const variant = prod?.variants.find((v) => v.id === l.variant_id);
          const basePrice = Number(prod?.sales_price || 0);
          const surcharge = Number(variant?.price_surcharge || 0);
          const unitPrice = l.unit_price_override !== null && l.unit_price_override !== undefined ? Number(l.unit_price_override) : basePrice + surcharge;
          return {
            id: Math.random().toString(),
            product_id: l.product_id,
            variant_id: l.variant_id || undefined,
            quantity: l.quantity,
            unit_price: unitPrice,
            tax_id: taxes?.[0]?.id,
            subtotal: unitPrice * l.quantity,
          };
        });
        setLines(mappedLines);
      }
    }
  }, [useTemplate, selectedTemplateId, templates, products, taxes]);

  // Add blank line
  const handleAddLine = () => {
    if (!products || products.length === 0) return;
    const firstProd = products[0];
    const unitPrice = Number(firstProd.sales_price);
    const defaultTax = taxes && taxes.length > 0 ? taxes[0].id : undefined;

    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        product_id: firstProd.id,
        variant_id: undefined,
        quantity: 1,
        unit_price: unitPrice,
        tax_id: defaultTax,
        subtotal: unitPrice,
      },
    ]);
  };

  // Update line product
  const handleProductChange = (lineId: string, newProductId: number) => {
    const prod = products?.find((p) => p.id === newProductId);
    if (!prod) return;
    const basePrice = Number(prod.sales_price);

    setLines(
      lines.map((l) => {
        if (l.id === lineId) {
          return {
            ...l,
            product_id: newProductId,
            variant_id: undefined,
            unit_price: basePrice,
            subtotal: basePrice * l.quantity,
          };
        }
        return l;
      })
    );
  };

  // Update line variant (with dynamic surcharge calculation e.g. Odoo Brand +$560)
  const handleVariantChange = (lineId: string, variantIdStr: string) => {
    const vId = variantIdStr ? Number(variantIdStr) : undefined;
    setLines(
      lines.map((l) => {
        if (l.id === lineId) {
          const prod = products?.find((p) => p.id === l.product_id);
          const basePrice = Number(prod?.sales_price || 0);
          const variant = prod?.variants.find((v) => v.id === vId);
          const surcharge = Number(variant?.price_surcharge || 0);
          const unitPrice = basePrice + surcharge;
          return {
            ...l,
            variant_id: vId,
            unit_price: unitPrice,
            subtotal: unitPrice * l.quantity,
          };
        }
        return l;
      })
    );
  };

  // Update line quantity
  const handleQuantityChange = (lineId: string, qty: number) => {
    const validQty = Math.max(1, qty);
    setLines(
      lines.map((l) => {
        if (l.id === lineId) {
          return {
            ...l,
            quantity: validQty,
            subtotal: l.unit_price * validQty,
          };
        }
        return l;
      })
    );
  };

  // Remove line
  const handleRemoveLine = (lineId: string) => {
    setLines(lines.filter((l) => l.id !== lineId));
  };

  // Financial calculations
  const rawSubtotal = lines.reduce((acc, l) => acc + l.subtotal, 0);
  const totalQuantity = lines.reduce((acc, l) => acc + l.quantity, 0);

  // Validate discount code
  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) {
      setDiscountMsg(null);
      return;
    }
    setIsValidatingDiscount(true);
    try {
      const res = await discountsApi.validate({
        code: discountCode.trim(),
        subtotal: rawSubtotal,
        total_quantity: totalQuantity,
        product_ids: lines.map((l) => l.product_id),
      });
      setDiscountMsg({
        valid: res.data.valid,
        text: res.data.message,
        amount: Number(res.data.discount_amount || 0),
      });
    } catch (e: any) {
      setDiscountMsg({
        valid: false,
        text: e.response?.data?.detail || 'Invalid discount',
        amount: 0,
      });
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  // Taxes calculation
  const discountAmt = discountMsg?.valid ? discountMsg.amount : 0;
  const taxableAmount = Math.max(0, rawSubtotal - discountAmt);

  // Estimate taxes using lines tax
  const estimatedTax = lines.reduce((acc, l) => {
    const taxObj = taxes?.find((t) => t.id === l.tax_id);
    if (!taxObj) return acc;
    const rate = Number(taxObj.rate) / 100;
    return acc + l.subtotal * rate;
  }, 0);

  const grandTotal = taxableAmount + estimatedTax;

  // Submit subscription
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setSubmitError('Please select a customer.');
      return;
    }
    if (!planId) {
      setSubmitError('Please select a plan.');
      return;
    }
    if (lines.length === 0) {
      setSubmitError('Please add at least one line item.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        customer_id: customerId,
        plan_id: planId,
        start_date: startDate,
        payment_terms: paymentTerms,
        notes,
        discount_code: discountCode.trim() || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_id: l.tax_id,
        })),
      };

      if (useTemplate && selectedTemplateId) {
        payload.template_id = selectedTemplateId;
      }

      const res = await subscriptionsApi.create(payload);
      navigate(`/subscriptions/${res.data.id}`);
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || 'Failed to create subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Link
          to="/subscriptions"
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Subscription Offer</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create a custom subscription or initialize from a pre-configured Quotation Template
          </p>
        </div>
      </div>

      {submitError && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Mode Selection (Template vs Custom) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>1. Template or Custom Offer</span>
          </h2>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="creationMode"
                checked={!useTemplate}
                onChange={() => setUseTemplate(false)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span>Build Custom Offer from Catalog</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="creationMode"
                checked={useTemplate}
                onChange={() => setUseTemplate(true)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span>Start from Quotation Template</span>
            </label>
          </div>

          {useTemplate && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Quotation Template
              </label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="">Choose a pre-configured template...</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Valid {t.validity_days} days | Plan: {t.plan?.name || 'Standard'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Step 2: Customer & Plan Details */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            2. Customer & Plan Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer *</label>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="">Select Customer...</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} (${c.full_name})` : c.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Plan & Billing Interval *</label>
              <select
                required
                value={planId}
                onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="">Select Plan...</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.interval} | Min Qty: {p.minimum_quantity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="Immediate">Immediate / Due on Receipt</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 60">Net 60 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Itemized Product Lines with Variant Engine */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Products & Variant Selection
            </h2>
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Product Line</span>
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No product lines added. Click "Add Product Line" to select items from catalog.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                    <th className="py-2.5 font-semibold w-52">Product</th>
                    <th className="py-2.5 font-semibold w-56">Variant Attribute</th>
                    <th className="py-2.5 font-semibold w-20 text-center">Qty</th>
                    <th className="py-2.5 font-semibold w-24 text-right">Unit Price</th>
                    <th className="py-2.5 font-semibold w-32">Tax Rule</th>
                    <th className="py-2.5 font-semibold w-28 text-right">Subtotal</th>
                    <th className="py-2.5 font-semibold w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => {
                    const currentProd = products?.find((p) => p.id === line.product_id);
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        {/* Product selection */}
                        <td className="py-3 pr-2">
                          <select
                            value={line.product_id}
                            onChange={(e) => handleProductChange(line.id, Number(e.target.value))}
                            className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                          >
                            {products?.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (${Number(p.sales_price).toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Variant Selection (e.g. Brand: Odoo +$560) */}
                        <td className="py-3 px-2">
                          <select
                            value={line.variant_id || ''}
                            onChange={(e) => handleVariantChange(line.id, e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                          >
                            <option value="">Base Product (No Variant)</option>
                            {currentProd?.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.attribute_name}: {v.attribute_value}{' '}
                                {Number(v.price_surcharge) > 0 ? `(+${v.price_surcharge})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleQuantityChange(line.id, parseInt(e.target.value) || 1)}
                            className="w-16 border border-slate-300 rounded-lg p-2 text-center text-xs bg-white"
                          />
                        </td>

                        {/* Unit price (computed base + surcharge) */}
                        <td className="py-3 px-2 text-right font-medium text-slate-700">
                          ${line.unit_price.toFixed(2)}
                        </td>

                        {/* Tax selection */}
                        <td className="py-3 px-2">
                          <select
                            value={line.tax_id || ''}
                            onChange={(e) => {
                              const tId = e.target.value ? Number(e.target.value) : undefined;
                              setLines(lines.map((l) => (l.id === line.id ? { ...l, tax_id: tId } : l)));
                            }}
                            className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                          >
                            <option value="">No Tax (0%)</option>
                            {taxes?.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.rate}%)
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Line Subtotal */}
                        <td className="py-3 pl-2 text-right font-bold text-slate-900">
                          ${line.subtotal.toFixed(2)}
                        </td>

                        {/* Delete action */}
                        <td className="py-3 pl-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Step 4: Discounts & Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discount code section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-600" />
              <span>Dynamic Discount Code</span>
            </h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. WELCOME10, VOLUME50, ODOO15"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="flex-1 uppercase border border-slate-300 rounded-lg p-2.5 text-xs font-mono bg-white"
              />
              <button
                type="button"
                onClick={handleValidateDiscount}
                disabled={isValidatingDiscount || !discountCode.trim()}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
              >
                {isValidatingDiscount ? 'Checking...' : 'Apply Code'}
              </button>
            </div>

            {discountMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                  discountMsg.valid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {discountMsg.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span>{discountMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Offer Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Terms, custom concessions, client scope details..."
                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
              />
            </div>
          </div>

          {/* Pricing Totals Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calculator className="h-4 w-4 text-indigo-600" />
              <span>Offer Totals Breakdown</span>
            </h2>

            <div className="flex justify-between text-xs text-slate-600">
              <span>Lines Subtotal:</span>
              <span className="font-semibold text-slate-900">${rawSubtotal.toFixed(2)}</span>
            </div>

            {discountAmt > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Applied Discount:</span>
                <span>-${discountAmt.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-600">
              <span>Estimated Tax:</span>
              <span className="font-semibold text-slate-900">${estimatedTax.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t border-slate-200">
              <span>Grand Total per Cycle:</span>
              <span className="text-indigo-600">${grandTotal.toFixed(2)}</span>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || lines.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Creating Subscription...' : 'Generate & Confirm Subscription'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
