// src/components/Suppliers.jsx
import React, { useEffect, useState, useRef } from 'react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    contact: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Supplier Details & Products Supplied Drawer state
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Delete Blocking Notice Modal state
  const [deleteNotice, setDeleteNotice] = useState({ show: false, message: '' });

  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const searchTimeoutRef = useRef(null);

  function showToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message, type: 'success' });
    }, 3000);
  }

  useEffect(() => {
    loadSuppliers();
  }, [filterActiveOnly]);

  function loadSuppliers(query = searchQuery) {
    if (!window.api?.suppliers?.get) return;
    setLoading(true);
    window.api.suppliers.get({
      query: query,
      includeInactive: !filterActiveOnly
    })
      .then(res => {
        setSuppliers(res || []);
      })
      .catch(err => {
        console.error('Error loading suppliers', err);
        showToast('Failed to load suppliers', 'error');
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
      loadSuppliers(val);
    }, 250);
  }

  function openAddModal() {
    setModalMode('add');
    setFormData({
      id: null,
      name: '',
      contact: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(s) {
    setModalMode('edit');
    setFormData({
      id: s.id,
      name: s.name || '',
      contact: s.contact || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || ''
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Company name is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (modalMode === 'add') {
        await window.api.suppliers.add(formData);
        showToast('Supplier added successfully', 'success');
      } else {
        await window.api.suppliers.update(formData);
        showToast('Supplier updated successfully', 'success');
      }
      setModalOpen(false);
      loadSuppliers();
      if (selectedSupplier && selectedSupplier.id === formData.id) {
        viewSupplierDetails({ ...selectedSupplier, ...formData });
      }
    } catch (err) {
      console.error('Supplier save error', err);
      setFormError(err.message || 'Error saving supplier');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s) {
    const newActiveState = s.is_active ? 0 : 1;
    const actionName = newActiveState ? 'activate' : 'deactivate';

    if (newActiveState === 0) {
      const confirmDeactivate = window.confirm(
        `Are you sure you want to deactivate "${s.name}"?\nInactive suppliers will not appear in the Product supplier selector, but all existing product associations will remain intact.`
      );
      if (!confirmDeactivate) return;
    }

    try {
      await window.api.suppliers.toggleActive(s.id, newActiveState);
      showToast(`Supplier ${actionName}d successfully`, 'success');
      loadSuppliers();
      if (selectedSupplier && selectedSupplier.id === s.id) {
        setSelectedSupplier(prev => ({ ...prev, is_active: newActiveState }));
      }
    } catch (err) {
      console.error('Error toggling supplier status', err);
      showToast('Error changing supplier status', 'error');
    }
  }

  async function handleDeleteSupplier(s) {
    // If supplier has active products according to frontend count
    if (s.products_count > 0) {
      setDeleteNotice({
        show: true,
        message: 'This supplier is attached to active products and cannot be deleted. Please remove or reassign those products first.'
      });
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${s.name}"?\nThis supplier has no active products.`
    );
    if (!confirmDelete) return;

    try {
      await window.api.suppliers.delete(s.id);
      showToast('Supplier deleted permanently', 'success');
      loadSuppliers();
      if (selectedSupplier && selectedSupplier.id === s.id) {
        setSelectedSupplier(null);
      }
    } catch (err) {
      console.error('Error deleting supplier', err);
      if (err.hasProducts || err.hasPurchases || (err.message && (err.message.includes('cannot be permanently deleted') || err.message.includes('attached to active products') || err.message.includes('cannot be deleted')))) {
        setDeleteNotice({
          show: true,
          message: err.message || 'This supplier is attached to active products or purchases and cannot be deleted.'
        });
      } else {
        showToast(err.message || 'Failed to delete supplier', 'error');
      }
    }
  }

  async function viewSupplierDetails(s) {
    setSelectedSupplier(s);
    setLoadingProducts(true);
    try {
      const prods = await window.api.suppliers.getProducts(s.id);
      setSupplierProducts(prods || []);
    } catch (err) {
      console.error('Error loading supplier products', err);
      showToast('Failed to load supplier products', 'error');
    } finally {
      setLoadingProducts(false);
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

      {/* Delete Notice Modal (Protected deletion message) */}
      {deleteNotice.show && (
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
            zIndex: 10001
          }}
          onClick={() => setDeleteNotice({ show: false, message: '' })}
        >
          <div
            className="card"
            style={{ width: 440, maxWidth: '90%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#b91c1c' }}>Cannot Delete Supplier</h3>
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, margin: '12px 0 20px' }}>
              {deleteNotice.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => setDeleteNotice({ show: false, message: '' })}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div>
          <h2 style={{ margin: 0 }}>🏷️ Suppliers Management</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Manage product vendors, distributors, and supplier catalogs.
          </div>
        </div>
        <button className="btn" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>➕</span> Add Supplier
        </button>
      </div>

      {/* Main Layout: Table + Details Panel */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {/* Left Column: Suppliers Table */}
        <div style={{ flex: 1 }} className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                className="no-drag"
                placeholder="Search by company name, contact person, phone, or email..."
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
                  <th>Company</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'center' }}>Products</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                      Loading suppliers...
                    </td>
                  </tr>
                )}
                {!loading && suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                      No suppliers found. Click <strong>+ Add Supplier</strong> to create one.
                    </td>
                  </tr>
                )}
                {!loading &&
                  suppliers.map(s => {
                    const isSelected = selectedSupplier?.id === s.id;
                    return (
                      <tr
                        key={s.id}
                        style={{
                          background: isSelected ? '#eff6ff' : undefined,
                          cursor: 'pointer'
                        }}
                        onClick={() => viewSupplierDetails(s)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{s.name}</div>
                          {s.email && <div style={{ fontSize: 12, color: '#6b7280' }}>{s.email}</div>}
                        </td>
                        <td>{s.contact || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                        <td>{s.phone || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              background: s.products_count > 0 ? '#e0f2fe' : '#f3f4f6',
                              color: s.products_count > 0 ? '#0369a1' : '#6b7280',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            {s.products_count || 0}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: s.is_active ? '#dcfce7' : '#fee2e2',
                              color: s.is_active ? '#15803d' : '#b91c1c'
                            }}
                          >
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              className="btn secondary"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => viewSupplierDetails(s)}
                              title="View Supplier Details"
                            >
                              👁️ View
                            </button>
                            <button
                              className="btn secondary"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => openEditModal(s)}
                              title="Edit Supplier"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn secondary"
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                color: s.is_active ? '#b45309' : '#15803d'
                              }}
                              onClick={() => handleToggleActive(s)}
                              title={s.is_active ? 'Deactivate Supplier' : 'Reactivate Supplier'}
                            >
                              {s.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              className="btn"
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                background: '#ef4444'
                              }}
                              onClick={() => handleDeleteSupplier(s)}
                              title="Delete Supplier"
                            >
                              🗑️ Delete
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

        {/* Right Column: Supplier Details & Products Supplied Drawer */}
        {selectedSupplier && (
          <div style={{ width: 400 }} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f0f2f5', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedSupplier.name}</h3>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Vendor since {new Date(selectedSupplier.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setSelectedCustomer ? setSelectedSupplier(null) : setSelectedSupplier(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Profile Overview */}
            <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f5', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#6b7280' }}>Contact Person:</span>
                <strong>{selectedSupplier.contact || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#6b7280' }}>Phone:</span>
                <strong>{selectedSupplier.phone || '—'}</strong>
              </div>
              {selectedSupplier.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Email:</span>
                  <span>{selectedSupplier.email}</span>
                </div>
              )}
              {selectedSupplier.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#6b7280' }}>Address:</span>
                  <span style={{ textAlign: 'right', maxWidth: '60%' }}>{selectedSupplier.address}</span>
                </div>
              )}
              {selectedSupplier.notes && (
                <div style={{ marginTop: 6, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}>
                  <strong>Notes:</strong> {selectedSupplier.notes}
                </div>
              )}
            </div>

            {/* Products Count Indicator */}
            <div style={{ background: '#f0f9ff', border: '1px solid #e0f2fe', padding: 10, borderRadius: 8, textAlign: 'center', margin: '14px 0' }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600 }}>Associated Products</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>
                {supplierProducts.length}
              </div>
            </div>

            {/* Products Supplied List */}
            <h4 style={{ margin: '12px 0 8px' }}>📦 Products Supplied</h4>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {loadingProducts && (
                <div style={{ textAlign: 'center', padding: 16, color: '#6b7280', fontSize: 13 }}>
                  Loading products...
                </div>
              )}
              {!loadingProducts && supplierProducts.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>
                  No products currently linked to this supplier.
                </div>
              )}
              {!loadingProducts && supplierProducts.map(p => (
                <div
                  key={p.id}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: 6
                  }}
                  className="hover-row"
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {p.category || 'General'} {p.sku ? `• SKU: ${p.sku}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Cost: <strong>Rs {Number(p.purchase_price || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                      Price: Rs {Number(p.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
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
                {modalMode === 'add' ? '➕ Add New Supplier' : '✏️ Edit Supplier'}
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
                    Company Name *
                  </label>
                  <input
                    className="no-drag"
                    required
                    placeholder="e.g. Nestlé Pakistan"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Contact Person
                  </label>
                  <input
                    className="no-drag"
                    placeholder="e.g. Ahmed Khan"
                    value={formData.contact}
                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
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
                    placeholder="e.g. sales@nestle.com.pk"
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
                    placeholder="e.g. Industrial Area, Lahore"
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
                    placeholder="e.g. Main distributor for milk and dairy products"
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
                    {saving ? 'Saving...' : modalMode === 'add' ? 'Save Supplier' : 'Update Supplier'}
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

