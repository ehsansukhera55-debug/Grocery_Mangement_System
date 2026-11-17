// src/components/ProductList.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState('');

  // Modal State for Add / Edit Product
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form State (using strings so user can clear/overwrite values easily)
  const [form, setForm] = useState({
    id: null,
    name: '',
    sku: '',
    category: '',
    supplier_id: '',
    price: '',
    purchase_price: '',
    wholesale_price: '',
    stock_qty: '',
    reorder_level: ''
  });

  // Quick Add Supplier Modal state inside Product form
  const [quickSupplierModalOpen, setQuickSupplierModalOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierError, setQuickSupplierError] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const nameInputRef = useRef(null);
  const scanInputRef = useRef(null);
  const quickSupplierInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  function showToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    setTimeout(() => {
      if (!modalOpen) {
        try { scanInputRef.current?.focus?.(); } catch (_) {}
      }
    }, 120);
  }, []);

  function fetchProducts() {
    if (!window.api?.products?.get) return;
    window.api.products.get()
      .then(setProducts)
      .catch(err => {
        console.error('Error fetching products', err);
        setProducts([]);
      });
  }

  function fetchSuppliers() {
    if (!window.api?.suppliers?.get) return;
    window.api.suppliers.get({ includeInactive: false })
      .then(setSuppliers)
      .catch(err => {
        console.error('Error fetching suppliers', err);
        setSuppliers([]);
      });
  }

  function restoreFocus(elRef, delay = 50) {
    setTimeout(() => {
      try {
        elRef?.current?.focus?.();
      } catch (err) {
        console.error(err);
      }
    }, delay);
  }

  // Lifecycle focus: Whenever Add/Edit modal closes, automatically return focus to the search/barcode input
  const prevModalOpenRef = useRef(modalOpen);
  useEffect(() => {
    if (prevModalOpenRef.current && !modalOpen) {
      restoreFocus(scanInputRef, 60);
    }
    prevModalOpenRef.current = modalOpen;
  }, [modalOpen]);

  // Safe programmatic focus when Add/Edit Product modal opens
  useEffect(() => {
    if (modalOpen) {
      if (document.activeElement && document.activeElement !== nameInputRef.current) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      const timer = setTimeout(() => {
        try {
          nameInputRef.current?.focus?.();
          nameInputRef.current?.select?.();
        } catch (_) {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [modalOpen]);

  // Safe programmatic focus when Quick Add Supplier modal opens
  useEffect(() => {
    if (quickSupplierModalOpen) {
      if (document.activeElement && document.activeElement !== quickSupplierInputRef.current) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      const timer = setTimeout(() => {
        try {
          quickSupplierInputRef.current?.focus?.();
          quickSupplierInputRef.current?.select?.();
        } catch (_) {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [quickSupplierModalOpen]);

  // Open Add Product Modal
  function openAddModal(initialSku = '') {
    if (document.activeElement?.blur) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    setModalMode('add');
    setForm({
      id: null,
      name: '',
      sku: initialSku || '',
      category: '',
      supplier_id: '',
      price: '',
      purchase_price: '',
      wholesale_price: '',
      stock_qty: '',
      reorder_level: ''
    });
    setFormError('');
    setModalOpen(true);
  }

  // Open Edit Product Modal
  function openEditModal(p) {
    if (document.activeElement?.blur) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    setModalMode('edit');
    setForm({
      id: p.id,
      name: p.name || '',
      sku: p.sku || '',
      category: p.category || '',
      supplier_id: p.supplier_id ? String(p.supplier_id) : '',
      price: (p.price !== undefined && p.price !== null) ? String(p.price) : '',
      purchase_price: (p.purchase_price !== undefined && p.purchase_price !== null) ? String(p.purchase_price) : '',
      wholesale_price: (p.wholesale_price !== undefined && p.wholesale_price !== null) ? String(p.wholesale_price) : '',
      stock_qty: (p.stock_qty !== undefined && p.stock_qty !== null) ? String(p.stock_qty) : '',
      reorder_level: (p.reorder_level !== undefined && p.reorder_level !== null) ? String(p.reorder_level) : ''
    });
    setFormError('');
    setModalOpen(true);
  }

  // --- Scan handling (auto-search without Enter) ---
  function handleScanChange(e) {
    const val = e.target.value;
    setQuery(val);
    lastScanTimeRef.current = Date.now();
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastScanTimeRef.current;
      // Auto-open only if exact barcode/SKU matches or rapid scanner entry
      if (elapsed >= 120 && val.trim()) {
        const s = val.trim().toLowerCase();
        const exactSku = products.find(p => (p.sku || '').toLowerCase() === s);
        if (exactSku) {
          handleScanComplete(val);
        }
      }
    }, 140);
  }

  function handleScanKeyDown(e) {
    if (e.key === 'Enter') {
      if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
      handleScanComplete(query);
    }
  }

  function handleScanComplete(value) {
    const s = (value || '').trim().toLowerCase();
    setQuery('');
    if (!s) {
      restoreFocus(scanInputRef);
      return;
    }
    const found = products.find(p => (p.sku || '').toLowerCase() === s) ||
                  products.find(p => (p.name || '').toLowerCase() === s);
    if (found) {
      openEditModal(found);
    } else {
      // not found -> open Add modal prepopulated with scanned barcode
      openAddModal(value);
    }
  }

  const filtered = products.filter(p =>
    (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.supplier_name || '').toLowerCase().includes(query.toLowerCase())
  );

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Product name is required');
      return;
    }

    setSaving(true);
    setFormError('');

    // convert string inputs to numbers (with safe defaults)
    const payload = {
      id: form.id || undefined,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
      price: parseFloat(form.price) || 0,
      purchase_price: parseFloat(form.purchase_price) || 0,
      wholesale_price: parseFloat(form.wholesale_price) || 0,
      stock_qty: parseInt(form.stock_qty) || 0,
      reorder_level: parseInt(form.reorder_level) || 0
    };

    try {
      if (payload.id) {
        await window.api.products.update(payload);
        showToast(`Product "${payload.name}" updated successfully`, 'success');
      } else {
        await window.api.products.add(payload);
        showToast(`Product "${payload.name}" added successfully`, 'success');
      }
      fetchProducts();
      setModalOpen(false);
      restoreFocus(scanInputRef, 60);
    } catch (err) {
      console.error('Save error', err);
      const rawMsg = err.message || 'Error saving product';
      const cleanMsg = rawMsg
        .replace(/^Error invoking remote method '[^']+':\s*/i, '')
        .replace(/^SqliteError:\s*/i, '');
      setFormError(cleanMsg);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id, name) {
    const confirmed = window.confirm(`Are you sure you want to delete "${name || 'this product'}"?`);
    if (!confirmed) {
      restoreFocus(scanInputRef, 50);
      return;
    }

    try {
      await window.api.products.delete(id);
      showToast('Product deleted successfully', 'success');
      fetchProducts();
      restoreFocus(scanInputRef, 80);
    } catch (err) {
      console.error('Delete error', err);
      showToast('Error deleting product', 'error');
      restoreFocus(scanInputRef, 80);
    }
  }

  async function handleQuickAddSupplier(e) {
    e.preventDefault();
    if (!quickSupplierName.trim()) {
      setQuickSupplierError('Company name is required');
      return;
    }
    setSavingSupplier(true);
    setQuickSupplierError('');
    try {
      const created = await window.api.suppliers.add({
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim() || null
      });
      await fetchSuppliers();
      // Select newly created supplier in the current product form
      setForm(prev => ({ ...prev, supplier_id: String(created.id) }));
      setQuickSupplierModalOpen(false);
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      showToast(`Supplier "${created.name}" created and selected!`, 'success');
    } catch (err) {
      console.error(err);
      setQuickSupplierError(err.message || 'Failed to create supplier');
    } finally {
      setSavingSupplier(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Toast Notification */}
      {toast.show && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background:
              toast.type === 'success'
                ? '#22c55e'
                : toast.type === 'warning'
                ? '#f59e0b'
                : '#ef4444',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            zIndex: 10001,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            minWidth: '220px'
          }}
        >
          {toast.type === 'success' && '✅ '}
          {toast.type === 'warning' && '⚠️ '}
          {toast.type === 'error' && '❌ '}
          {toast.message}
        </div>
      )}

      {/* Page Header matching Customers module */}
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>📦 Products Management</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Manage your store products and inventory.
          </div>
        </div>
        <button
          className="btn"
          onClick={() => openAddModal()}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>➕</span> Add Product
        </button>
      </div>

      {/* Main Full-Width Product List Card */}
      <div className="card products-table" style={{ width: '100%' }}>
        <div className="search" style={{ marginBottom: 14 }}>
          <input
            ref={scanInputRef}
            className="no-drag"
            placeholder="Scan barcode or type to search (auto)..."
            value={query}
            onChange={handleScanChange}
            onKeyDown={handleScanKeyDown}
            disabled={modalOpen || quickSupplierModalOpen}
            tabIndex={modalOpen || quickSupplierModalOpen ? -1 : 0}
            onFocus={e => e.target.select?.()}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </div>

        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Stock</th>
              <th>Purchase Cost</th>
              <th>Wholesale Price</th>
              <th>Retail Price</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                  {query ? 'No products matching your search' : 'No products in catalog. Click "+ Add Product" to create one.'}
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{p.name}</div>
                    {p.sku && <div style={{ fontSize: 11, color: '#6b7280' }}>SKU: {p.sku}</div>}
                  </td>
                  <td>{p.category || '—'}</td>
                  <td>
                    {p.supplier_name ? (
                      <span style={{ fontWeight: 500, color: '#0369a1' }}>🏢 {p.supplier_name}</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>No Supplier</span>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        color: p.stock_qty <= (p.reorder_level || 0) ? '#dc2626' : '#111827'
                      }}
                    >
                      {p.stock_qty}
                    </span>
                    {p.stock_qty <= (p.reorder_level || 0) && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          background: '#fee2e2',
                          color: '#b91c1c',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontWeight: 700
                        }}
                      >
                        LOW
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 500, color: '#4b5563' }}>
                    Rs {Number(p.purchase_price || 0).toFixed(2)}
                  </td>
                  <td style={{ fontWeight: 500, color: p.wholesale_price ? '#1d4ed8' : '#9ca3af' }}>
                    {p.wholesale_price ? `Rs ${Number(p.wholesale_price).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ fontWeight: 600, color: '#111827' }}>
                    Rs {Number(p.price || 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        className="btn secondary"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => openEditModal(p)}
                        title="Edit Product"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: 12, background: '#ef4444' }}
                        onClick={() => remove(p.id, p.name)}
                        title="Delete Product"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop no-drag"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'auto'
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card no-drag"
            style={{
              width: 520,
              maxWidth: '92%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              pointerEvents: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#111827' }}>
                {modalMode === 'add' ? '➕ Add Product' : '✏️ Edit Product'}
              </h3>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 14 }}
                onClick={() => setModalOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Product Name */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Product Name *
                  </label>
                  <input
                    ref={nameInputRef}
                    className="no-drag"
                    required
                    placeholder="e.g. Olpers Milk 1L"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    onFocus={e => e.target.select?.()}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                {/* 2-Column: SKU & Category */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      SKU / Barcode
                    </label>
                    <input
                      className="no-drag"
                      placeholder="e.g. 896400012345"
                      value={form.sku}
                      onChange={e => setForm({ ...form, sku: e.target.value })}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      Category
                    </label>
                    <input
                      className="no-drag"
                      placeholder="e.g. Dairy, Beverages"
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>

                {/* Supplier Selector with Quick-Add button */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Supplier / Company
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      className="no-drag"
                      value={form.supplier_id}
                      onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        fontSize: 13
                      }}
                    >
                      <option value="">No Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setQuickSupplierError('');
                        setQuickSupplierModalOpen(true);
                      }}
                      title="Add new supplier company"
                    >
                      ➕ New
                    </button>
                  </div>
                </div>

                {/* 3-Column: Retail Price, Wholesale Price, and Purchase Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      Retail Price (Rs) *
                    </label>
                    <input
                      className="no-drag"
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      value={form.price}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setForm({ ...form, price: val });
                        }
                      }}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: 4 }}>
                      Wholesale Price (Rs)
                    </label>
                    <input
                      className="no-drag"
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      value={form.wholesale_price}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setForm({ ...form, wholesale_price: val });
                        }
                      }}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #93c5fd' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      Purchase Cost (Rs)
                    </label>
                    <input
                      className="no-drag"
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      value={form.purchase_price}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setForm({ ...form, purchase_price: val });
                        }
                      }}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>

                {/* 2-Column: Stock Quantity & Reorder Level */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      Current Stock
                    </label>
                    <input
                      className="no-drag"
                      placeholder="0"
                      type="text"
                      inputMode="numeric"
                      value={form.stock_qty}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          setForm({ ...form, stock_qty: val });
                        }
                      }}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      Reorder Level (Low Stock Alert)
                    </label>
                    <input
                      className="no-drag"
                      placeholder="0"
                      type="text"
                      inputMode="numeric"
                      value={form.reorder_level}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          setForm({ ...form, reorder_level: val });
                        }
                      }}
                      onFocus={e => e.target.select?.()}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : modalMode === 'add' ? 'Save Product' : 'Update Product'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal (Nested/Secondary modal) */}
      {quickSupplierModalOpen && (
        <div
          className="modal-backdrop no-drag"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            pointerEvents: 'auto'
          }}
          onClick={() => setQuickSupplierModalOpen(false)}
        >
          <div
            className="card no-drag"
            style={{ width: 380, maxWidth: '90%', padding: 20, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', pointerEvents: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>➕ Add New Supplier</h3>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 13 }}
                onClick={() => setQuickSupplierModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {quickSupplierError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                ⚠️ {quickSupplierError}
              </div>
            )}

            <form onSubmit={handleQuickAddSupplier}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
                    Company Name *
                  </label>
                  <input
                    ref={quickSupplierInputRef}
                    className="no-drag"
                    required
                    placeholder="e.g. Nestlé Pakistan"
                    value={quickSupplierName}
                    onChange={e => setQuickSupplierName(e.target.value)}
                    onFocus={e => e.target.select?.()}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
                    Phone Number
                  </label>
                  <input
                    className="no-drag"
                    placeholder="e.g. 03001234567"
                    value={quickSupplierPhone}
                    onChange={e => setQuickSupplierPhone(e.target.value)}
                    onFocus={e => e.target.select?.()}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setQuickSupplierModalOpen(false)}
                    disabled={savingSupplier}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={savingSupplier}
                  >
                    {savingSupplier ? 'Saving...' : 'Save & Select'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
