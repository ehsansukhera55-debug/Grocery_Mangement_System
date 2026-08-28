// src/components/SalesPanel.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function SalesPanel() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [query, setQuery] = useState('');

  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  const scanInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    if (window.api?.products?.get) {
      window.api.products.get().then(setProducts).catch(console.error);
    }
    setTimeout(() => scanInputRef.current?.focus?.(), 120);
  }, []);

  function restoreFocusToScan(delay = 60) {
    function showToast(message, type = 'success') {
      setToast({
        show: true,
        message,
        type
      });

      setTimeout(() => {
        setToast({
          show: false,
          message: '',
          type: 'success'
        });
      }, 3000);
    }
    // small delay to allow any UI thread work to finish first
    setTimeout(() => {
      try { window.focus(); } catch (_) {}
      // blur then focus to reset potential stuck keyboard focus state
      try {
        scanInputRef.current?.blur?.();
        scanInputRef.current?.focus?.();
      } catch (e) {
        /* no-op */
      }
    }, delay);
  }

  function addToCart(prodId, qty = 1) {
    const p = products.find(x => x.id === prodId);
    if (!p) return;
    setCart(prev => {
      const found = prev.find(c => c.product_id === prodId);
      if (found) {
        return prev.map(c => c.product_id === prodId ? { ...c, quantity: c.quantity + qty } : c);
      } else {
        return [...prev, { product_id: prodId, name: p.name, quantity: qty, unit_price: Number(p.price || 0) }];
      }
    });
  }

  function removeFromCart(product_id) {
    setCart(prev => prev.filter(c => c.product_id !== product_id));
    restoreFocusToScan();
  }

  function updateQuantity(product_id, valueStr) {
    const n = parseInt(valueStr || '0');
    setCart(prev => prev.map(c => c.product_id === product_id ? { ...c, quantity: isNaN(n) ? 0 : n } : c));
  }

  function total() {
    return cart.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  }
  function printBill() {
    const billWindow = window.open('', '', 'width=400,height=700');

    billWindow.document.write(`
      <html>
      <head>
        <title>Nirala Store Bill</title>
        <style>
          body{
            font-family: Arial, sans-serif;
            padding:15px;
            font-size:14px;
          }

          .center{
            text-align:center;
          }

          hr{
            border:none;
            border-top:1px dashed #000;
            margin:8px 0;
          }

          table{
            width:100%;
            border-collapse:collapse;
          }

          td{
            padding:4px 0;
          }

          .total{
            font-size:18px;
            font-weight:bold;
          }
        </style>
      </head>
      <body>

        <div class="center">
          <h2>Nirala Store</h2>
          <div>0321-4874815</div>
          <div>Call & WhatsApp</div>
        </div>

        <hr>

        <div>
          Customer: ${customerName || 'Walk-in Customer'}
        </div>

        <div>
          Date: ${new Date().toLocaleString()}
        </div>

        <hr>

        <table>
          ${cart.map(item => `
            <tr>
              <td>${item.name} x ${item.quantity}</td>
              <td style="text-align:right">
                Rs ${(item.quantity * item.unit_price).toFixed(2)}
              </td>
            </tr>
          `).join('')}
        </table>

        <hr>

        <div class="total">
          Total: Rs ${total().toFixed(2)}
        </div>

        <hr>

        <div class="center">
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

  async function submitSale() {
    if (!cart.length) {
      restoreFocusToScan();
      showToast('Cart is empty', 'warning');
      return;
    }

    const sale = {
      customer_id: null,
      customer_name: (customerName || '').trim() || null,
      date: new Date().toISOString(),
      total_amount: Number(total() || 0),
      items: cart.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity || 0), unit_price: Number(i.unit_price || 0) }))
    };

    try {
      // call backend
      const saleId = await window.api.sales.add(sale);

      // clear cart & customer locally
      setCart([]);
      setCustomerName('');

      // refresh stats (best-effort)
      try { await window.api.stats.get(); } catch (_) {}

      // give the system a short moment then restore focus aggressively
      restoreFocusToScan(80);

      // show success message in a non-blocking way (optional alert)
      // using setTimeout so focus restore runs after the alert if user clicks it
      showToast(`Sale #${saleId} saved successfully`, 'success');
      restoreFocusToScan(60);

    } catch (err) {
      console.error('Error saving sale', err);
      // show error then re-focus
      showToast('Error saving sale', 'error');
      restoreFocusToScan(60);
    }
  }

  // Scanner / search input handlers (auto-complete on pause)
  function handleScanChange(e) {
    const val = e.target.value;
    setQuery(val);
    lastScanTimeRef.current = Date.now();

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastScanTimeRef.current;
      if (elapsed >= 120) {
        handleScanComplete(val);
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
      restoreFocusToScan();
      return;
    }

    const matched = products.find(p => (p.sku || '').toLowerCase() === s) ||
                    products.find(p => (p.name || '').toLowerCase() === s);

    if (matched) {
      addToCart(matched.id, 1);
      // small delay then re-focus input so scanner continues working
      restoreFocusToScan(30);
    } else {
      // not found — keep focus
      restoreFocusToScan(30);
    }
  }

  const filtered = products.filter(p =>
    (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
  <>
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
          zIndex: 9999,
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

      <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }} className="card">
        <h3>Products</h3>
        <input
          ref={scanInputRef}
          className="no-drag"
          placeholder="Scan barcode (auto) or type & pause to search..."
          value={query}
          onChange={handleScanChange}
          onKeyDown={handleScanKeyDown}
          style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #ddd' }}
          autoFocus
        />

        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ padding: 8, border: '1px solid #eef3fb', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{p.category || '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontWeight: 700 }}>Rs {Number(p.price || 0).toFixed(2)}</div>
                <button className="btn" onClick={() => addToCart(p.id, 1)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: 360 }} className="invoice card">
        <h3>Invoice</h3>

        <div style={{ marginBottom: 8 }}>
          <input
            className="no-drag"
            placeholder="Customer name (optional)"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {cart.length === 0 && <div style={{ color: '#94a3b8' }}>Cart is empty</div>}
          {cart.map(item => (
            <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Rs {Number(item.unit_price).toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  value={String(item.quantity)}
                  onChange={e => updateQuantity(item.product_id, e.target.value)}
                  style={{ width: 64, padding: 6, borderRadius: 6, border: '1px solid #ddd' }}
                />
                <div style={{ width: 100, textAlign: 'right', fontWeight: 700 }}>Rs {(item.unit_price * item.quantity).toFixed(2)}</div>
                <button className="btn secondary" onClick={() => removeFromCart(item.product_id)} style={{ marginLeft: 8 }}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <hr />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ fontWeight: 700 }}>Total</div>
          <div style={{ fontWeight: 700 }}>Rs {total().toFixed(2)}</div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={submitSale}>Complete Sale</button>
          <button className="btn secondary" onClick={printBill}>Print Bill</button>
        </div>
      </div>
  </div>
</>
);
}