// src/components/Customers.jsx
import React, { useEffect, useState, useRef } from 'react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Customer Details / History Drawer state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  // Sale Receipt Modal state
  const [inspectSale, setInspectSale] = useState(null);
  const [loadingSale, setLoadingSale] = useState(false);

  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const searchTimeoutRef = useRef(null);

  function showToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }

  useEffect(() => {
    loadCustomers();
  }, [filterActiveOnly]);

  function loadCustomers(query = searchQuery) {
    if (!window.api?.customers?.get) return;
    setLoading(true);
    window.api.customers.get({
      query: query,
      includeInactive: !filterActiveOnly
    })
      .then(res => {
        setCustomers(res || []);
      })
      .catch(err => {
        console.error('Error loading customers', err);
        showToast('Failed to load customers', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadCustomers(val);
    }, 250);
  }

  function openAddModal() {
    setModalMode('add');
    setFormData({
      id: null,
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(c) {
    setModalMode('edit');
    setFormData({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || ''
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Customer name is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (modalMode === 'add') {
        await window.api.customers.add(formData);
        showToast('Customer added successfully', 'success');
      } else {
        await window.api.customers.update(formData);
        showToast('Customer updated successfully', 'success');
      }
      setModalOpen(false);
      loadCustomers();
      if (selectedCustomer && selectedCustomer.id === formData.id) {
        viewCustomerDetails({ ...selectedCustomer, ...formData });
      }
    } catch (err) {
      console.error('Customer save error', err);
      setFormError(err.message || 'Error saving customer');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(c) {
    const newActiveState = c.is_active ? 0 : 1;
    const actionName = newActiveState ? 'activate' : 'deactivate';

    if (newActiveState === 0) {
      const confirmDeactivate = window.confirm(
        `Are you sure you want to deactivate "${c.name}"?\nInactive customers will not appear in the Sales selector, but all past purchase history will remain intact.`
      );
      if (!confirmDeactivate) return;
    }

    try {
      await window.api.customers.toggleActive(c.id, newActiveState);
      showToast(`Customer ${actionName}d successfully`, 'success');
      loadCustomers();
      if (selectedCustomer && selectedCustomer.id === c.id) {
        setSelectedCustomer(prev => ({ ...prev, is_active: newActiveState }));
      }
    } catch (err) {
      console.error('Error toggling customer status', err);
      showToast('Error changing customer status', 'error');
    }
  }

  async function viewCustomerDetails(c) {
    setSelectedCustomer(c);
    setLoadingPurchases(true);
    try {
      const history = await window.api.customers.getPurchases(c.id);
      setPurchases(history || []);
    } catch (err) {
      console.error('Error loading purchase history', err);
      showToast('Failed to load purchase history', 'error');
    } finally {
      setLoadingPurchases(false);
    }
  }

  async function handleOpenSaleReceipt(saleId) {
    setLoadingSale(true);
    try {
      const sale = await window.api.sales.getDetails(saleId);
      setInspectSale(sale);
    } catch (err) {
      console.error('Error inspecting sale', err);
      showToast('Failed to load sale details', 'error');
    } finally {
      setLoadingSale(false);
    }
  }

  function printSaleReceipt(sale) {
    if (!sale) return;
    const billWindow = window.open('', '', 'width=400,height=700');
    billWindow.document.write(`
      <html>
      <head>
        <title>Nirala Store Bill #${sale.id}</title>
        <style>
          body{ font-family: Arial, sans-serif; padding:15px; font-size:14px; }
          .center{ text-align:center; }
          hr{ border:none; border-top:1px dashed #000; margin:8px 0; }
          table{ width:100%; border-collapse:collapse; }
          td{ padding:4px 0; }
          .total{ font-size:18px; font-weight:bold; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>Nirala Store</h2>
          <div>0321-4874815</div>
          <div>Call & WhatsApp</div>
        </div>
        <hr>
        <div>Invoice: #${sale.id}</div>
        <div>Customer: ${sale.customer_name || 'Walk-in Customer'}</div>
        ${sale.customer_phone ? `<div>Phone: ${sale.customer_phone}</div>` : ''}
        <div>Date: ${new Date(sale.date).toLocaleString()}</div>
        <hr>
        <table>
          ${(sale.items || []).map(item => `
            <tr>
              <td>${item.product_name || 'Item'} x ${item.quantity}</td>
              <td style="text-align:right">Rs ${(item.quantity * item.unit_price).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        <hr>
        <div class="total">Total: Rs ${Number(sale.total_amount || 0).toFixed(2)}</div>
        <hr>
        <div class="center">Thank You For Shopping!</div>
      </body>
      </html>
    `);
    billWindow.document.close();
    billWindow.focus();
    billWindow.print();
    billWindow.close();
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
            zIndex: 10000,
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
      <div className="header">
        <div>
          <h2 style={{ margin: 0 }}>👥 Customers Management</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Manage registered store customers, track credit and purchase histories.
          </div>
        </div>
        <button className="btn" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>➕</span> Add Customer
        </button>
      </div>

      {/* Main Layout: Table + Details Panel */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {/* Left Column: Customer Directory Table */}
        <div style={{ flex: 1 }} className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                className="no-drag"
                placeholder="Search by customer name, phone, or email..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 14
                }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4b5563', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterActiveOnly}
                onChange={e => setFilterActiveOnly(e.target.checked)}
              />
              Active only
            </label>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Total Spent</th>
                  <th>Last Purchase</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                      Loading customers...
                    </td>
                  </tr>
                )}
                {!loading && customers.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                      No customers found. Click <strong>+ Add Customer</strong> to create one.
                    </td>
                  </tr>
                )}
                {!loading &&
                  customers.map(c => {
                    const isSelected = selectedCustomer?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        style={{
                          background: isSelected ? '#eff6ff' : undefined,
                          cursor: 'pointer'
                        }}
                        onClick={() => viewCustomerDetails(c)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{c.name}</div>
                          {c.email && <div style={{ fontSize: 12, color: '#6b7280' }}>{c.email}</div>}
                        </td>
                        <td>{c.phone || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.orders_count || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                          Rs {Number(c.total_spent || 0).toFixed(2)}
                        </td>
                        <td style={{ fontSize: 13, color: '#4b5563' }}>
                          {c.last_purchase_date
                            ? new Date(c.last_purchase_date).toLocaleDateString()
                            : <span style={{ color: '#9ca3af' }}>Never</span>}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: c.is_active ? '#dcfce7' : '#fee2e2',
                              color: c.is_active ? '#15803d' : '#b91c1c'
                            }}
                          >
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              className="btn secondary"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => viewCustomerDetails(c)}
                              title="View Customer Profile"
                            >
                              👁️ View
                            </button>
                            <button
                              className="btn secondary"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => openEditModal(c)}
                              title="Edit Customer"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn"
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                background: c.is_active ? '#ef4444' : '#10b981'
                              }}
                              onClick={() => handleToggleActive(c)}
                              title={c.is_active ? 'Deactivate Customer' : 'Reactivate Customer'}
                            >
                              {c.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Customer Details & Purchase History */}
        {selectedCustomer && (
          <div style={{ width: 380 }} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f0f2f5', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedCustomer.name}</h3>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Member since {new Date(selectedCustomer.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setSelectedCustomer(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Profile Overview */}
            <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f5', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#6b7280' }}>Phone:</span>
                <strong>{selectedCustomer.phone || '—'}</strong>
              </div>
              {selectedCustomer.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Email:</span>
                  <span>{selectedCustomer.email}</span>
                </div>
              )}
              {selectedCustomer.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Address:</span>
                  <span style={{ textAlign: 'right', maxWidth: '60%' }}>{selectedCustomer.address}</span>
                </div>
              )}
              {selectedCustomer.notes && (
                <div style={{ marginTop: 6, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}>
                  <strong>Notes:</strong> {selectedCustomer.notes}
                </div>
              )}
            </div>

            {/* Customer KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }}>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Total Orders</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                  {selectedCustomer.orders_count || purchases.length || 0}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Total Spent</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d', marginTop: 2 }}>
                  Rs {Number(selectedCustomer.total_spent || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Purchase History */}
            <h4 style={{ margin: '12px 0 8px' }}>📜 Purchase History</h4>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {loadingPurchases && (
                <div style={{ textAlign: 'center', padding: 16, color: '#6b7280', fontSize: 13 }}>
                  Loading purchases...
                </div>
              )}
              {!loadingPurchases && purchases.length === 0 && (
                <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13 }}>
                  No purchases recorded yet.
                </div>
              )}
              {!loadingPurchases && purchases.map(p => (
                <div
                  key={p.id}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  className="hover-row"
                  onClick={() => handleOpenSaleReceipt(p.id)}
                  title="Click to view full invoice"
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Sale #{p.id}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {new Date(p.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
                      Rs {Number(p.total_amount || 0).toFixed(2)}
                    </div>
                    <span style={{ fontSize: 11, color: '#2563eb' }}>View receipt 🔍</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
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
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: 440, maxWidth: '90%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                {modalMode === 'add' ? '➕ Add New Customer' : '✏️ Edit Customer'}
              </h3>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 14 }}
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Customer Name *
                  </label>
                  <input
                    className="no-drag"
                    required
                    placeholder="e.g. Ali Raza"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    className="no-drag"
                    placeholder="e.g. 03001234567"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Email
                  </label>
                  <input
                    className="no-drag"
                    type="email"
                    placeholder="e.g. ali@example.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Address
                  </label>
                  <input
                    className="no-drag"
                    placeholder="e.g. Street 4, Sector G-9"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Notes
                  </label>
                  <textarea
                    className="no-drag"
                    rows={2}
                    placeholder="e.g. Regular wholesale buyer, prefer WhatsApp bill"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
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
                    {saving ? 'Saving...' : modalMode === 'add' ? 'Save Customer' : 'Update Customer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Sale Receipt Modal */}
      {inspectSale && (
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
          onClick={() => setInspectSale(null)}
        >
          <div
            className="card"
            style={{ width: 420, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <h3 style={{ margin: 0 }}>🧾 Sale #{inspectSale.id}</h3>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px' }}
                onClick={() => setInspectSale(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 13, margin: '12px 0', color: '#4b5563' }}>
              <div><strong>Customer:</strong> {inspectSale.customer_name || 'Walk-in Customer'}</div>
              {inspectSale.customer_phone && <div><strong>Phone:</strong> {inspectSale.customer_phone}</div>}
              <div><strong>Date:</strong> {new Date(inspectSale.date).toLocaleString()}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '12px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '6px 0' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(inspectSale.items || []).map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 0' }}>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      {item.product_sku && <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.product_sku}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>Rs {Number(item.unit_price).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      Rs {(item.quantity * item.unit_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '2px solid #111827', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>Total:</span>
              <span>Rs {Number(inspectSale.total_amount || 0).toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn secondary"
                onClick={() => setInspectSale(null)}
              >
                Close
              </button>
              <button
                className="btn"
                onClick={() => printSaleReceipt(inspectSale)}
              >
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

