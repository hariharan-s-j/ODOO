import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Plus,
  Calculator,
  Tag,
  Layers,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

export const Products: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  // Modal state: Add Product
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    code: '',
    type: 'SOFTWARE',
    sales_price: '',
    cost_price: '',
    notes: '',
  });

  // Modal state: Add Variant
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState({
    attribute_name: 'Brand',
    attribute_value: '',
    price_surcharge: '0.00',
    sku: '',
  });

  // Dynamic Pricing Simulator Widget State
  const [simProduct, setSimProduct] = useState<number | ''>('');
  const [simVariant, setSimVariant] = useState<number | ''>('');
  const [simQty, setSimQty] = useState<number>(1);
  const [simDiscount, setSimDiscount] = useState<string>('');
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Fetch products
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => (await productsApi.list()).data,
  });

  // Handle Dynamic Price Calculator
  const handleCalculatePrice = async () => {
    if (!simProduct) return;
    setSimLoading(true);
    try {
      const res = await productsApi.calculatePrice({
        product_id: Number(simProduct),
        variant_ids: simVariant ? [Number(simVariant)] : undefined,
        quantity: simQty,
        discount_code: simDiscount || undefined,
      });
      setSimResult(res.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Calculation error');
    } finally {
      setSimLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productsApi.create({
        ...productForm,
        sales_price: Number(productForm.sales_price),
        cost_price: Number(productForm.cost_price || 0),
      });
      setIsAddProductOpen(false);
      setProductForm({ name: '', code: '', type: 'SOFTWARE', sales_price: '', cost_price: '', notes: '' });
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create product');
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    try {
      await productsApi.addVariant(selectedProductId, {
        ...variantForm,
        price_surcharge: Number(variantForm.price_surcharge),
      });
      setIsAddVariantOpen(false);
      setVariantForm({ attribute_name: 'Brand', attribute_value: '', price_surcharge: '0.00', sku: '' });
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to add variant');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog & Variant Engine</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure software, services, add-ons, and dynamic price surcharges (e.g. Odoo brand +$560)
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddProductOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Product</span>
          </button>
        )}
      </div>

      {/* Interactive Dynamic Price Calculation Simulator */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-200">
            Live Pricing Engine & Surcharge Simulator
          </h2>
          <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
            POST /api/v1/products/calculate-price
          </span>
        </div>
        <p className="text-xs text-slate-300">
          Test real-time base price + variant surcharge calculations (e.g., Selecting "Odoo" adds an explicit surcharge like +$560 to base price).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
          {/* Select Product */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold uppercase">Product</label>
            <select
              value={simProduct}
              onChange={(e) => {
                setSimProduct(e.target.value ? Number(e.target.value) : '');
                setSimVariant('');
                setSimResult(null);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs"
            >
              <option value="">Select product...</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Base: ${Number(p.sales_price).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Select Variant */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold uppercase">Variant (Surcharge)</label>
            <select
              disabled={!simProduct}
              value={simVariant}
              onChange={(e) => {
                setSimVariant(e.target.value ? Number(e.target.value) : '');
                setSimResult(null);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs disabled:opacity-50"
            >
              <option value="">Base Product (No Surcharge)</option>
              {products
                ?.find((p) => p.id === Number(simProduct))
                ?.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.attribute_name}: {v.attribute_value} (+${Number(v.price_surcharge).toFixed(2)})
                  </option>
                ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold uppercase">Quantity</label>
            <input
              type="number"
              min="1"
              value={simQty}
              onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs"
            />
          </div>

          {/* Compute Button */}
          <div className="flex items-end">
            <button
              type="button"
              disabled={!simProduct || simLoading}
              onClick={handleCalculatePrice}
              className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              {simLoading ? 'Calculating...' : 'Compute Dynamic Price'}
            </button>
          </div>
        </div>

        {/* Simulator Results Output */}
        {simResult && (
          <div className="mt-3 p-4 bg-slate-800/90 rounded-xl border border-indigo-500/40 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Base Price</span>
              <span className="font-bold text-white">${Number(simResult.base_price).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-indigo-400 block text-[11px]">Variant Surcharge</span>
              <span className="font-bold text-indigo-300">+${Number(simResult.surcharges).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Effective Unit Price</span>
              <span className="font-bold text-white">${Number(simResult.unit_price).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Line Subtotal ({simResult.quantity}x)</span>
              <span className="font-bold text-white">${Number(simResult.subtotal).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-emerald-400 block text-[11px]">Estimated Line Total</span>
              <span className="font-extrabold text-emerald-400 text-sm">
                ${Number(simResult.estimated_total).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Products Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {products?.map((prod) => (
          <div key={prod.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{prod.name}</h3>
                  <Badge status={prod.type} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">SKU: {prod.code}</div>
              </div>

              <div className="text-right">
                <div className="text-lg font-extrabold text-slate-900">
                  ${Number(prod.sales_price).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">Cost: ${Number(prod.cost_price).toFixed(2)}</div>
              </div>
            </div>

            {prod.notes && <p className="text-xs text-slate-600">{prod.notes}</p>}

            {/* Variants list */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Configured Variants ({prod.variants.length})
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId(prod.id);
                      setIsAddVariantOpen(true);
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Variant
                  </button>
                )}
              </div>

              {prod.variants.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No variants configured. Base price applies.</div>
              ) : (
                <div className="space-y-1.5">
                  {prod.variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">
                          {v.attribute_name}: {v.attribute_value}
                        </span>
                        {v.sku && <span className="text-[10px] text-slate-400 font-mono ml-2">({v.sku})</span>}
                      </div>
                      <div className="font-bold text-indigo-600">
                        {Number(v.price_surcharge) > 0 ? `+$${Number(v.price_surcharge).toFixed(2)}` : '$0.00'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Product Modal */}
      <Modal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} title="Add Product to Catalog">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              placeholder="e.g. Brightloop ERP Core"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Code / SKU *</label>
              <input
                type="text"
                required
                value={productForm.code}
                onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono bg-white"
                placeholder="SW-CORE-01"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Type *</label>
              <select
                value={productForm.type}
                onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
              >
                <option value="SOFTWARE">Software License</option>
                <option value="SERVICE">Professional Service / SLA</option>
                <option value="ADD_ON">Add-on Module</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Base Sales Price ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={productForm.sales_price}
                onChange={(e) => setProductForm({ ...productForm, sales_price: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="499.00"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={productForm.cost_price}
                onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="120.00"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Notes</label>
            <textarea
              rows={2}
              value={productForm.notes}
              onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
              placeholder="Description, licensing terms, SLA specifications..."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddProductOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition cursor-pointer"
            >
              Save Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Variant Modal */}
      <Modal isOpen={isAddVariantOpen} onClose={() => setIsAddVariantOpen(false)} title="Add Product Variant">
        <form onSubmit={handleCreateVariant} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Attribute Name *</label>
              <input
                type="text"
                required
                value={variantForm.attribute_name}
                onChange={(e) => setVariantForm({ ...variantForm, attribute_name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="e.g. Brand, Edition, Tier"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Attribute Value *</label>
              <input
                type="text"
                required
                value={variantForm.attribute_value}
                onChange={(e) => setVariantForm({ ...variantForm, attribute_value: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                placeholder="e.g. Odoo, Enterprise"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Price Surcharge ($) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={variantForm.price_surcharge}
                onChange={(e) => setVariantForm({ ...variantForm, price_surcharge: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 bg-white"
                placeholder="560.00"
              />
              <span className="text-[10px] text-slate-500">Amount added to base product price</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Variant SKU</label>
              <input
                type="text"
                value={variantForm.sku}
                onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono bg-white"
                placeholder="SW-ERP-ODOO"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddVariantOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition cursor-pointer"
            >
              Add Variant
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
