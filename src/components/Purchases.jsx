// src/components/Purchases.jsx
import React, { useEffect, useState } from 'react';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // New Purchase Modal State
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);

  // Current Item Input state in New Purchase Modal
  const [currentItemProdId, setCurrentItemProdId] = useState('');
  const [currentItemQty, setCurrentItemQty] = useState('');
  const [currentItemCost, setCurrentItemCost] = useState('');

  // Validation / Saving state
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // View Purchase Details Modal State
  const [inspectPurchase, setInspectPurchase] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  function showToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }

  useEffect(() => {
    loadPurchases();
    loadSuppliersAndProducts();
  }, []);

  function loadPurchases(q = searchQuery) {
    if (!window.api?.purchases?.get) return;
    setLoading(true);
    window.api.purchases.get(q)
      .then(res => setPurchases(res || []))
      .catch(err => {
        console.error('Error loading purchases', err);
        showToast('Failed to load purchases', 'error');
      })
      .finally(() => setLoading(false));
  }

  function loadSuppliersAndProducts() {
    if (window.api?.suppliers?.get) {
      window.api.suppliers.get({ includeInactive: false })
        .then(data => setSuppliers(data || []))
        .catch(console.error);
    }
    if (window.api?.products?.get) {
      window.api.products.get()
        .then(data => setProducts(data || []))
        .catch(console.error);
    }
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    loadPurchases(val);
  }

  // Open New Purchase Modal
  function handleOpenNewPurchase() {
    setSelectedSupplierId('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseNotes('');
    setPurchaseItems([]);
    setCurrentItemProdId('');
    setCurrentItemQty('');
    setCurrentItemCost('');
    setFormError('');
    setNewModalOpen(true);
  }

  // Handle Product Selector Change in Item Input
  function handleProductSelectChange(prodId) {
    setCurrentItemProdId(prodId);
    if (!prodId) {
      setCurrentItemCost('');
      return;
    }
    const found = products.find(p => String(p.id) === String(prodId));
    if (found) {
      // Default cost to product's current purchase price if set, else empty
      setCurrentItemCost(found.purchase_price !== undefined && found.purchase_price !== null ? String(found.purchase_price) : '');
      if (!currentItemQty) setCurrentItemQty('1');
    }
  }

  // Add Item to Purchase Items list
  function handleAddItem() {
    setFormError('');
    if (!currentItemProdId) {
      setFormError('Please select a product to add');
      return;
    }

    const qty = parseInt(currentItemQty);
    const cost = parseFloat(currentItemCost);

    if (isNaN(qty) || qty <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setFormError('Purchase cost must be a valid non-negative number');
      return;
    }

    const prod = products.find(p => String(p.id) === String(currentItemProdId));
    if (!prod) return;

    // Check if product already exists in item list -> merge quantity or replace cost
    const existingIndex = purchaseItems.findIndex(i => String(i.product_id) === String(prod.id));
    if (existingIndex >= 0) {
      const updated = [...purchaseItems];
      const prev = updated[existingIndex];
      const mergedQty = prev.quantity + qty;
      updated[existingIndex] = {
        ...prev,
        quantity: mergedQty,
        unit_cost: cost,
        line_total: mergedQty * cost
      };
      setPurchaseItems(updated);
    } else {
      const newItem = {
        product_id: prod.id,
        product_name: prod.name,
        product_sku: prod.sku,
        current_stock: prod.stock_qty,
        quantity: qty,
        unit_cost: cost,
        line_total: qty * cost
      };
      setPurchaseItems(prev => [...prev, newItem]);
    }

    // Reset current item inputs
    setCurrentItemProdId('');
    setCurrentItemQty('');
    setCurrentItemCost('');
  }

  // Remove Item from list
  function handleRemoveItem(index) {
    setPurchaseItems(prev => prev.filter((_, idx) => idx !== index));
  }

  // Calculate Grand Total of current purchase items
  const grandTotal = purchaseItems.reduce((acc, item) => acc + item.line_total, 0);

  // Submit and Receive Purchase
  async function handleSubmitPurchase(e) {
    e.preventDefault();
    setFormError('');

    if (!selectedSupplierId) {
      setFormError('Please select a supplier');
      return;
    }
    if (purchaseItems.length === 0) {
      setFormError('Please add at least one product item to the purchase');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplier_id: parseInt(selectedSupplierId),
        purchase_date: purchaseDate ? `${purchaseDate}T12:00:00.000Z` : new Date().toISOString(),
        notes: purchaseNotes.trim() || null,
        items: purchaseItems.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          product_sku: i.product_sku,
          quantity: i.quantity,
          unit_cost: i.unit_cost
        }))
      };

      const result = await window.api.purchases.add(payload);
      showToast(`Purchase #${result.purchase_number} received successfully! Stock updated.`, 'success');
      setNewModalOpen(false);
      loadPurchases();
      // Reload products so updated stock/prices are cached
      loadSuppliersAndProducts();
    } catch (err) {
      console.error('Error saving purchase', err);
      setFormError(err.message || 'Error saving purchase');
    } finally {
      setSaving(false);
    }
  }

  // Handle Cancel New Purchase
  function handleCancelNewPurchase() {
    if (purchaseItems.length > 0) {
      const confirmCancel = window.confirm(
        'Are you sure you want to cancel this purchase?\nAll entered product items will be discarded and no stock will be updated.'
      );
      if (!confirmCancel) return;
    }
    setNewModalOpen(false);
  }

  // View Details
  async function handleViewDetails(purchaseId) {
    setLoadingDetails(true);
    try {
      const details = await window.api.purchases.getDetails(purchaseId);
      setInspectPurchase(details);
    } catch (err) {
      console.error('Error loading purchase details', err);
      showToast('Error loading purchase details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
            🛒 Purchases Management
          </h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Record supplier purchases, track incoming goods, and receive inventory stock.
          </div>
        </div>
        <button
          className="btn"
          onClick={handleOpenNewPurchase}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>➕</span> New Purchase
        </button>
      </div>

      {/* Purchases History Card */}
      <div className="card" style={{ width: '100%' }}>
        <div style={{ marginBottom: 14 }}>
          <input
            className="no-drag"
            placeholder="Search by Purchase # or Supplier name..."
            value={searchQuery}
            onChange={handleSearchChange}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </div>

        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Purchase #</th>
              <th>Supplier</th>
              <th>Date</th>
              <th style={{ textAlign: 'center' }}>Items</th>
              <th style={{ textAlign: 'center' }}>Units Received</th>
              <th style={{ textAlign: 'right' }}>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                  Loading purchases...
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 28, color: '#9ca3af' }}>
                  {searchQuery ? 'No purchases matching your search' : 'No purchases recorded yet. Click "+ New Purchase" to receive stock.'}
                </td>
              </tr>
            ) : (
              purchases.map(p => (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: '#1e40af' }}>
                      {p.purchase_number || `PUR-${String(p.id).padStart(4, '0')}`}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500, color: '#111827' }}>
                      🏢 {p.supplier_name || 'No Supplier'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, color: '#4b5563' }}>
                      {new Date(p.purchase_date || p.created_at).toLocaleDateString([], { dateStyle: 'medium' })}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{p.items_count || 0}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#059669' }}>+{p.total_quantity || 0}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                    Rs {Number(p.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleViewDetails(p.id)}
                    >
                      🔍 View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* NEW PURCHASE MODAL                                           */}
      {/* ============================================================ */}
      {newModalOpen && (
        <div
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
            zIndex: 9999
          }}
          onClick={handleCancelNewPurchase}
        >
          <div
            className="card"
            style={{
              width: 720,
              maxWidth: '95%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📦</span> New Stock Purchase
              </h3>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 14 }}
                onClick={handleCancelNewPurchase}
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

            <form onSubmit={handleSubmitPurchase}>
              {/* Header Info: Supplier & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Supplier *
                  </label>
                  <select
                    className="no-drag"
                    required
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                  >
                    <option value="">-- Select Active Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    className="no-drag"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Product Item Builder Section */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                  Add Products to Purchase
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                      Product
                    </label>
                    <select
                      className="no-drag"
                      value={currentItemProdId}
                      onChange={e => handleProductSelectChange(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.stock_qty})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      className="no-drag"
                      value={currentItemQty}
                      onChange={e => setCurrentItemQty(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                      Unit Cost (Rs)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Cost"
                      className="no-drag"
                      value={currentItemCost}
                      onChange={e => setCurrentItemCost(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={handleAddItem}
                      style={{ padding: '7px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
                    >
                      ➕ Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  Purchase Items ({purchaseItems.length})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Product</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Current Stock</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Purchased Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Cost</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Line Total</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 20, color: '#94a3b8', background: '#fafafa' }}>
                          No products added yet. Select a product and click "+ Add Item" above.
                        </td>
                      </tr>
                    ) : (
                      purchaseItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                            {item.product_sku && <div style={{ fontSize: 11, color: '#64748b' }}>SKU: {item.product_sku}</div>}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>
                            {item.current_stock}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                            +{item.quantity}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            Rs {Number(item.unit_cost).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                            Rs {Number(item.line_total).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Notes & Grand Total summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Notes / Invoice Reference
                  </label>
                  <input
                    className="no-drag"
                    placeholder="e.g. Invoice #N-8841, delivered by truck"
                    value={purchaseNotes}
                    onChange={e => setPurchaseNotes(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
                  />
                </div>

                <div style={{ textAlign: 'right', minWidth: 200 }}>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Purchase
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af', marginTop: 2 }}>
                    Rs {Number(grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleCancelNewPurchase}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={saving || purchaseItems.length === 0}
                  style={{ minWidth: 160 }}
                >
                  {saving ? 'Receiving Stock...' : '📥 Receive Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW PURCHASE DETAILS MODAL                                  */}
      {/* ============================================================ */}
      {inspectPurchase && (
        <div
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
            zIndex: 10000
          }}
          onClick={() => setInspectPurchase(null)}
        >
          <div
            className="card"
            style={{ width: 560, maxWidth: '92%', maxHeight: '88vh', overflowY: 'auto', padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e3a8a' }}>
                  📦 Purchase #{inspectPurchase.purchase_number || `PUR-${String(inspectPurchase.id).padStart(4, '0')}`}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Stock received on {new Date(inspectPurchase.purchase_date || inspectPurchase.created_at).toLocaleString()}
                </div>
              </div>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px' }}
                onClick={() => setInspectPurchase(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 13, margin: '14px 0', background: '#f8fafc', padding: 12, borderRadius: 6 }}>
              <div><strong>Supplier:</strong> {inspectPurchase.supplier_name}</div>
              {inspectPurchase.supplier_phone && <div><strong>Phone:</strong> {inspectPurchase.supplier_phone}</div>}
              {inspectPurchase.supplier_contact && <div><strong>Contact Person:</strong> {inspectPurchase.supplier_contact}</div>}
              {inspectPurchase.notes && <div><strong>Notes:</strong> {inspectPurchase.notes}</div>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '14px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', background: '#f1f5f9' }}>
                  <th style={{ padding: '6px 8px' }}>Product</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty Received</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cost / Unit</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(inspectPurchase.items || []).map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      {item.product_sku && <div style={{ fontSize: 11, color: '#94a3b8' }}>SKU: {item.product_sku}</div>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                      +{item.quantity}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      Rs {Number(item.unit_cost).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>
                      Rs {Number(item.line_total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '2px solid #111827', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>Total Purchase Amount:</span>
              <span style={{ color: '#1e40af' }}>
                Rs {Number(inspectPurchase.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn secondary"
                onClick={() => setInspectPurchase(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
