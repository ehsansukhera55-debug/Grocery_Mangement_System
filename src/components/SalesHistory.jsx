// src/components/SalesHistory.jsx
import React, { useEffect, useState, useMemo } from 'react';

export default function SalesHistory({ onNavigate }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month', 'custom'
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Inspect Bill Modal state
  const [inspectSale, setInspectSale] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  function showToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }

  // Calculate start & end ISO strings based on dateFilter
  const dateRange = useMemo(() => {
    const now = new Date();

    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (dateFilter === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (dateFilter === 'week') {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + 6, 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (dateFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (dateFilter === 'custom') {
      if (!customStart || !customEnd) return { start: null, end: null };
      const s = new Date(customStart + 'T00:00:00');
      const e = new Date(customEnd + 'T23:59:59.999');
      return { start: s.toISOString(), end: e.toISOString() };
    }

    return { start: null, end: null };
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    loadSales();
  }, [dateRange, searchQuery]);

  async function loadSales() {
    if (!window.api?.sales?.get) return;
    setLoading(true);
    try {
      const res = await window.api.sales.get({
        start: dateRange.start,
        end: dateRange.end,
        search: searchQuery.trim()
      });
      setSales(res || []);
    } catch (err) {
      console.error('Error loading sales history', err);
      showToast('Failed to load sales history', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Calculate summary metrics for the currently filtered sales
  const summary = useMemo(() => {
    const count = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const avgBill = count > 0 ? totalRevenue / count : 0;
    return { count, totalRevenue, avgBill };
  }, [sales]);

  async function handleOpenDetails(saleId) {
    setLoadingDetails(true);
    try {
      const details = await window.api.sales.getDetails(saleId);
      if (details) {
        setInspectSale(details);
      } else {
        showToast('Bill details not found', 'error');
      }
    } catch (err) {
      console.error('Error loading sale details', err);
      showToast('Failed to load bill details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  }

  // Format Bill as Text for WhatsApp / SMS copying
  function getBillAsText(s) {
    if (!s) return '';
    const dateFormatted = new Date(s.date).toLocaleString();
    const divider = '--------------------------------';
    const itemsList = (s.items || []).map(item => {
      const lineTotal = ((item.quantity || 0) * (item.unit_price || 0)).toFixed(2);
      return `${item.product_name} x ${item.quantity} = Rs ${lineTotal}`;
    }).join('\n');

    return [
      '🧾 *NIRALA STORE*',
      '0321-4874815 (Call & WhatsApp)',
      divider,
      `Bill #: #${s.id}`,
      `Date: ${dateFormatted}`,
      `Customer: ${s.customer_name || 'Walk-in Customer'}`,
      s.customer_phone ? `Phone: ${s.customer_phone}` : '',
      `Pricing: ${s.pricing_tier === 'wholesale' ? 'Wholesale' : 'Retail'}`,
      divider,
      itemsList,
      divider,
      `*TOTAL: Rs ${Number(s.total_amount || 0).toFixed(2)}*`,
      divider,
      'Thank you for shopping at Nirala Store!'
    ].filter(Boolean).join('\n');
  }

  function handleCopyText(s) {
    const text = getBillAsText(s);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Bill copied to clipboard! Ready to paste into WhatsApp/SMS.', 'success');
    }).catch(err => {
      console.error('Clipboard copy error', err);
      showToast('Failed to copy to clipboard', 'error');
    });
  }

  // Thermal / Paper Bill Printing (exact format matching SalesPanel)
  function handlePrintBill(s) {
    if (!s) return;
    const billWindow = window.open('', '', 'width=400,height=700');
    if (!billWindow) {
      showToast('Popup blocked by browser/system. Please allow popups.', 'error');
      return;
    }

    const items = s.items || [];
    const customerName = s.customer_name || 'Walk-in Customer';
    const dateFormatted = new Date(s.date).toLocaleString();

    billWindow.document.write(`
      <html>
      <head>
        <title>Nirala Store - Bill #${s.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 15px;
            font-size: 14px;
            color: #000;
          }
          .center { text-align: center; }
          hr {
            border: none;
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 4px 0; }
          .total {
            font-size: 18px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0 0 4px 0;">Nirala Store</h2>
          <div>0321-4874815</div>
          <div>Call & WhatsApp</div>
        </div>
        <hr>
        <div><strong>Bill #:</strong> #${s.id}</div>
        <div><strong>Customer:</strong> ${customerName}</div>
        ${s.customer_phone ? `<div><strong>Phone:</strong> ${s.customer_phone}</div>` : ''}
        <div><strong>Pricing:</strong> ${s.pricing_tier === 'wholesale' ? 'Wholesale' : 'Retail'}</div>
        <div><strong>Date:</strong> ${dateFormatted}</div>
        <hr>
        <table>
          ${items.map(item => `
            <tr>
              <td>${item.product_name || 'Product'} x ${item.quantity}</td>
              <td style="text-align: right;">
                Rs ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
              </td>
            </tr>
          `).join('')}
        </table>
        <hr>
        <div class="total">
          Total: Rs ${Number(s.total_amount || 0).toFixed(2)}
        </div>
        <hr>
        <div class="center" style="margin-top: 10px;">
          Thank You For Shopping!
        </div>
      </body>
      </html>
    `);

    billWindow.document.close();
    billWindow.focus();
    billWindow.print();
    billWindow.close();
  }

  // Quick helper to directly print from table row
  async function handleDirectRowPrint(saleId) {
    try {
      const details = await window.api.sales.getDetails(saleId);
      if (details) {
        handlePrintBill(details);
      } else {
        showToast('Bill details not found', 'error');
      }
    } catch (err) {
      console.error('Print load error', err);
      showToast('Error preparing bill for printing', 'error');
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

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
            📜 Sales History & Customer Bills
          </h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            View, search, filter, reprint, and copy past customer bills and receipts.
          </div>
        </div>
        {onNavigate && (
          <button
            className="btn"
            onClick={() => onNavigate('sales')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>💳</span> Open POS / New Sale
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Filtered Bills</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {summary.count.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Filtered Total Sales</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#166534', marginTop: 4 }}>
            Rs {summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Average Bill Value</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>
            Rs {summary.avgBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Customer / Bill Search Input */}
          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <input
              className="no-drag"
              placeholder="🔍 Search by Customer Name or Bill #..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            />
          </div>

          {/* Date Filter Presets */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                className={`btn ${dateFilter === p.id ? '' : 'secondary'}`}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: dateFilter === p.id ? 700 : 500
                }}
                onClick={() => setDateFilter(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Pickers (shown when Custom is selected) */}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>From:</span>
              <input
                className="no-drag"
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>To:</span>
              <input
                className="no-drag"
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sales History Table */}
      <div className="card" style={{ width: '100%', overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '90px' }}>Bill #</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Tier</th>
              <th style={{ textAlign: 'center' }}>Items</th>
              <th style={{ textAlign: 'right' }}>Total Amount</th>
              <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 28, color: '#6b7280' }}>
                  ⏳ Loading sales history...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                  {searchQuery || dateFilter !== 'all'
                    ? 'No bills matching your current filter criteria.'
                    : 'No sales recorded yet. Completed checkout orders will appear here.'}
                </td>
              </tr>
            ) : (
              sales.map(s => {
                const dateObj = new Date(s.date);
                const isWalkIn = !s.customer_name || s.customer_name === 'Walk-in Customer';

                return (
                  <tr key={s.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#1e3a8a', fontFamily: 'monospace', fontSize: 13 }}>
                        #{s.id}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: '#374151' }}>
                      {isNaN(dateObj.getTime()) ? s.date : dateObj.toLocaleString()}
                    </td>
                    <td>
                      {isWalkIn ? (
                        <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '3px 8px', borderRadius: 12 }}>
                          🚶 Walk-in Customer
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#111827' }}>
                          👤 {s.customer_name}
                        </span>
                      )}
                    </td>
                    <td>
                      {s.pricing_tier === 'wholesale' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: 12 }}>
                          📦 Wholesale
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 12 }}>
                          🛍️ Retail
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 13, color: '#4b5563' }}>
                      {s.items_count !== undefined ? `${s.items_count} items (${s.total_quantity || 0} units)` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: 14 }}>
                      Rs {Number(s.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          className="btn secondary"
                          style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleOpenDetails(s.id)}
                          title="View complete bill details"
                        >
                          👁️ View Bill
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleDirectRowPrint(s.id)}
                          title="Print physical receipt"
                        >
                          🖨️ Print
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bill Details / Thermal Receipt Modal */}
      {inspectSale && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002
          }}
          onClick={() => setInspectSale(null)}
        >
          <div
            className="card"
            style={{
              width: 440,
              maxWidth: '92%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              background: '#fff',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                Customer Bill #{inspectSale.id}
              </div>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 14 }}
                onClick={() => setInspectSale(null)}
              >
                ✕
              </button>
            </div>

            {/* Receipt Preview Box */}
            <div
              style={{
                background: '#fcfcfc',
                border: '1px dashed #9ca3af',
                borderRadius: 6,
                padding: '16px 14px',
                fontFamily: 'Courier New, monospace',
                fontSize: 13,
                color: '#111827',
                marginBottom: 16
              }}
            >
              {/* Receipt Header */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                  Nirala Store
                </h3>
                <div style={{ fontSize: 12, color: '#4b5563' }}>0321-4874815</div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Call & WhatsApp</div>
              </div>

              <div style={{ borderTop: '1px dashed #6b7280', margin: '8px 0' }} />

              {/* Bill Details */}
              <div style={{ lineHeight: 1.5, fontSize: 12 }}>
                <div><strong>Bill #:</strong> #{inspectSale.id}</div>
                <div><strong>Date:</strong> {new Date(inspectSale.date).toLocaleString()}</div>
                <div><strong>Customer:</strong> {inspectSale.customer_name || 'Walk-in Customer'}</div>
                {inspectSale.customer_phone && (
                  <div><strong>Phone:</strong> {inspectSale.customer_phone}</div>
                )}
                {inspectSale.customer_address && (
                  <div><strong>Address:</strong> {inspectSale.customer_address}</div>
                )}
                <div><strong>Pricing:</strong> {inspectSale.pricing_tier === 'wholesale' ? '📦 Wholesale' : '🛍️ Retail'}</div>
              </div>

              <div style={{ borderTop: '1px dashed #6b7280', margin: '8px 0' }} />

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #9ca3af' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inspectSale.items || []).map((item, idx) => {
                    const lineTotal = ((item.quantity || 0) * (item.unit_price || 0)).toFixed(2);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                        <td style={{ padding: '4px 0' }}>
                          <div>{item.product_name || 'Product'}</div>
                          {item.product_sku && (
                            <span style={{ fontSize: 10, color: '#6b7280' }}>({item.product_sku})</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{Number(item.unit_price || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>{lineTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #6b7280', margin: '8px 0' }} />

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, fontWeight: 700 }}>
                <span>TOTAL:</span>
                <span style={{ color: '#059669' }}>
                  Rs {Number(inspectSale.total_amount || 0).toFixed(2)}
                </span>
              </div>

              <div style={{ borderTop: '1px dashed #6b7280', margin: '8px 0' }} />

              <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                Thank You For Shopping!
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => handleCopyText(inspectSale)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                title="Copy bill in clean text format for WhatsApp / SMS"
              >
                📋 Copy Text Bill
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handlePrintBill(inspectSale)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                🖨️ Print Receipt
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setInspectSale(null)}
                style={{ fontSize: 12 }}
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

