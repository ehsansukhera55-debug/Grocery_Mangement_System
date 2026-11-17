// src/components/SalesPanel.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function SalesPanel({ isActiveView = true }) {
  const [products, setProducts] = useState([]);
  // Active Sale Sessions state
  const nextSessionNumRef = useRef(2);
  const [sessions, setSessions] = useState([
    {
      id: 'session-1',
      sessionNumber: 1,
      customer: null, // null = Walk-in Customer
      pricingTier: 'retail', // 'retail' or 'wholesale'
      cart: [],
      isHeld: false
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState('session-1');
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  // Cancel sale confirmation modal state
  const [cancelModal, setCancelModal] = useState({ show: false, sessionId: null });

  // Active session and derived state
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const cart = activeSession ? activeSession.cart : [];
  const selectedCustomer = activeSession ? activeSession.customer : null;

  // Helper setters that mutate only the current active session
  function setCart(updater) {
    const curId = activeSessionIdRef.current;
    setSessions(prevSessions =>
      prevSessions.map(s => {
        if (s.id !== curId) return s;
        const newCart = typeof updater === 'function' ? updater(s.cart) : updater;
        return { ...s, cart: newCart };
      })
    );
  }

  function setSelectedCustomer(cust) {
    const curId = activeSessionIdRef.current;
    setSessions(prevSessions =>
      prevSessions.map(s => {
        if (s.id !== curId) return s;
        return { ...s, customer: cust };
      })
    );
  }

  async function togglePricingTier(newTier) {
    const curId = activeSessionIdRef.current;
    let prods = products;
    try {
      const fresh = await fetchProducts();
      if (fresh && fresh.length > 0) {
        prods = fresh;
      }
    } catch (_) {}

    setSessions(prevSessions =>
      prevSessions.map(s => {
        if (s.id !== curId) return s;
        // Recalculate unit price for all items in the active cart
        const updatedCart = (s.cart || []).map(item => {
          const prod = prods.find(p => p.id === item.product_id);
          if (!prod) return item;
          const unit_price = newTier === 'wholesale'
            ? (Number(prod.wholesale_price) > 0 ? Number(prod.wholesale_price) : Number(prod.price || 0))
            : Number(prod.price || 0);
          return { ...item, unit_price };
        });
        return { ...s, pricingTier: newTier, cart: updatedCart };
      })
    );
    restoreFocusToScan(40);
  }

  // Session Management handlers
  function handleCreateNewSale() {
    if (sessions.length >= 10) {
      showToast('Maximum of 10 active sales reached. Please complete or cancel a sale first.', 'warning');
      return;
    }
    const newNum = nextSessionNumRef.current++;
    const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newSession = {
      id: newId,
      sessionNumber: newNum,
      customer: null,
      pricingTier: 'retail',
      cart: [],
      isHeld: false
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newId);
    restoreFocusToScan(50);
  }

  function handleSwitchSession(sessionId) {
    setActiveSessionId(sessionId);
    restoreFocusToScan(50);
  }

  function handleHoldCurrentSale() {
    if (!activeSession) return;
    setSessions(prev =>
      prev.map(s => s.id === activeSessionId ? { ...s, isHeld: true } : s)
    );

    // Look for an existing empty unheld session to switch to, otherwise create a new one
    const otherSession = sessions.find(s => s.id !== activeSessionId && s.cart.length === 0 && !s.isHeld);
    if (otherSession) {
      setActiveSessionId(otherSession.id);
    } else {
      handleCreateNewSale();
    }
    showToast(`Sale #${activeSession.sessionNumber} placed on hold`, 'warning');
    restoreFocusToScan(50);
  }

  function handleResumeSale(sessionId) {
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, isHeld: false } : s)
    );
    setActiveSessionId(sessionId);
    restoreFocusToScan(50);
  }

  function handlePromptCancelSale(sessionId = activeSessionId) {
    const sessionToCancel = sessions.find(s => s.id === sessionId);
    if (!sessionToCancel) return;

    if (sessionToCancel.cart.length === 0) {
      // Empty cart can be removed directly without confirmation
      closeSession(sessionId);
    } else {
      setCancelModal({ show: true, sessionId });
    }
  }

  function closeSession(sessionId) {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      if (remaining.length === 0) {
        // Always keep at least one session active
        const newNum = nextSessionNumRef.current++;
        const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const fresh = {
          id: newId,
          sessionNumber: newNum,
          customer: null,
          pricingTier: 'retail',
          cart: [],
          isHeld: false
        };
        setActiveSessionId(newId);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
    setCancelModal({ show: false, sessionId: null });
    restoreFocusToScan(50);
  }

  const [query, setQuery] = useState('');

  // Customer selection & management state
  const [customers, setCustomers] = useState([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Quick Add Customer modal state
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    customer_type: 'retail'
  });
  const [newCustomerError, setNewCustomerError] = useState('');
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  const scanInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const dropdownRef = useRef(null);

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

  const quickCustNameInputRef = useRef(null);

  function restoreFocusToScan(delay = 50) {
    if (!isActiveView) return;
    setTimeout(() => {
      if (!isActiveView) return;
      try {
        scanInputRef.current?.focus?.();
      } catch (e) {
        /* no-op */
      }
    }, delay);
  }

  // Whenever the user navigates into the Sales tab in App.jsx, re-fetch products & customers and restore focus
  useEffect(() => {
    if (isActiveView) {
      fetchProducts();
      fetchCustomers();
      restoreFocusToScan(60);
    }
  }, [isActiveView]);

  // Focus scan input on activeSessionId switch
  useEffect(() => {
    if (isActiveView) {
      restoreFocusToScan(50);
    }
  }, [activeSessionId]);

  // Focus scan input when cancel modal closes
  const prevCancelModalRef = useRef(cancelModal.show);
  useEffect(() => {
    if (prevCancelModalRef.current && !cancelModal.show) {
      restoreFocusToScan(50);
    }
    prevCancelModalRef.current = cancelModal.show;
  }, [cancelModal.show]);

  // Focus scan input when quick add customer modal closes
  const prevCustModalRef = useRef(addCustomerModalOpen);
  useEffect(() => {
    if (addCustomerModalOpen) {
      if (document.activeElement && document.activeElement !== quickCustNameInputRef.current) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      const t = setTimeout(() => {
        try { quickCustNameInputRef.current?.focus?.(); } catch (_) {}
      }, 50);
      return () => clearTimeout(t);
    } else if (prevCustModalRef.current && !addCustomerModalOpen) {
      restoreFocusToScan(50);
    }
    prevCustModalRef.current = addCustomerModalOpen;
  }, [addCustomerModalOpen]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    if (isActiveView) {
      restoreFocusToScan(100);
    }

    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function fetchProducts() {
    if (window.api?.products?.get) {
      return window.api.products.get().then(data => {
        setProducts(data || []);
        return data || [];
      }).catch(err => {
        console.error('Error fetching products', err);
        return [];
      });
    }
    return Promise.resolve([]);
  }

  function fetchCustomers() {
    if (window.api?.customers?.get) {
      return window.api.customers.get({ includeInactive: false })
        .then(data => {
          setCustomers(data || []);
          return data || [];
        })
        .catch(err => {
          console.error('Error fetching customers', err);
          return [];
        });
    }
    return Promise.resolve([]);
  }

  function addToCart(prodId, qty = 1) {
    const p = products.find(x => x.id === prodId);
    if (!p) return;
    const tier = activeSession?.pricingTier || 'retail';
    const effectivePrice = tier === 'wholesale'
      ? (Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.price || 0))
      : Number(p.price || 0);

    setCart(prev => {
      const found = prev.find(c => c.product_id === prodId);
      if (found) {
        return prev.map(c => c.product_id === prodId ? { ...c, quantity: c.quantity + qty } : c);
      } else {
        return [...prev, { product_id: prodId, name: p.name, quantity: qty, unit_price: effectivePrice }];
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
          Customer: ${selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
        </div>
        ${selectedCustomer && selectedCustomer.phone ? `<div>Phone: ${selectedCustomer.phone}</div>` : ''}
        <div>
          Pricing: ${activeSession?.pricingTier === 'wholesale' ? 'Wholesale' : 'Retail'}
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
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      customer_name: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
      date: new Date().toISOString(),
      total_amount: Number(total() || 0),
      pricing_tier: activeSession?.pricingTier || 'retail',
      items: cart.map(i => ({
        product_id: i.product_id,
        quantity: Number(i.quantity || 0),
        unit_price: Number(i.unit_price || 0)
      }))
    };

    try {
      const saleId = await window.api.sales.add(sale);

      // Remove completed sale session and switch to next available (or create a fresh one)
      closeSession(activeSessionId);

      // refresh products and stats (best-effort)
      fetchProducts();
      try { await window.api.stats.get(); } catch (_) {}

      showToast(`Sale #${saleId} saved successfully`, 'success');
      restoreFocusToScan(60);

    } catch (err) {
      console.error('Error saving sale', err);
      const cleanMsg = err.message
        ? err.message.replace(/^Error invoking remote method '[^']+':\s*/i, '').replace(/^SqliteError:\s*/i, '')
        : 'Error saving sale';
      showToast(cleanMsg, 'error');
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
      // Auto-complete only if exact SKU/barcode match on elapsed pause
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
      restoreFocusToScan();
      return;
    }

    const matched = products.find(p => (p.sku || '').toLowerCase() === s) ||
                    products.find(p => (p.name || '').toLowerCase() === s);

    if (matched) {
      addToCart(matched.id, 1);
      restoreFocusToScan(30);
    } else {
      restoreFocusToScan(30);
    }
  }

  async function handleQuickAddCustomer(e) {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      setNewCustomerError('Customer name is required');
      return;
    }

    setSavingNewCustomer(true);
    setNewCustomerError('');

    try {
      const created = await window.api.customers.add(newCustomerForm);
      // Refresh active customers list
      await fetchCustomers();
      // Automatically select the new customer for this sale
      setSelectedCustomer(created);
      if (created?.customer_type === 'wholesale') {
        togglePricingTier('wholesale');
      }
      // Close modal and reset form
      setAddCustomerModalOpen(false);
      setNewCustomerForm({ name: '', phone: '', email: '', address: '', notes: '', customer_type: 'retail' });
      showToast(`Customer "${created.name}" created and selected!`, 'success');
      // DO NOT touch or clear the current cart!
      restoreFocusToScan(60);
    } catch (err) {
      console.error('Failed to create customer', err);
      setNewCustomerError(err.message || 'Error creating customer');
    } finally {
      setSavingNewCustomer(false);
    }
  }

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(query.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });

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

      {/* Cancel Sale Confirmation Modal */}
      {cancelModal.show && (
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
          onClick={() => setCancelModal({ show: false, sessionId: null })}
        >
          <div
            className="card"
            style={{ width: 420, maxWidth: '90%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🗑️</span>
              <h3 style={{ margin: 0, color: '#b91c1c' }}>Cancel Sale?</h3>
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, margin: '12px 0 20px' }}>
              All items currently in this cart will be removed. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn secondary"
                onClick={() => setCancelModal({ show: false, sessionId: null })}
              >
                Keep Sale
              </button>
              <button
                className="btn"
                style={{ background: '#ef4444' }}
                onClick={() => closeSession(cancelModal.sessionId)}
              >
                Cancel Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Sales / Open Carts Switcher Bar */}
      <div
        className="card"
        style={{
          padding: '10px 14px',
          marginBottom: 14,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          overflowX: 'auto'
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
          Active Sales ({sessions.length}/10):
        </div>

        <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto', alignItems: 'center' }}>
          {sessions.map(s => {
            const isActive = s.id === activeSessionId;
            const itemCount = s.cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const saleTotal = s.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
            const custName = s.customer ? s.customer.name : 'Walk-in';

            return (
              <div
                key={s.id}
                onClick={() => handleSwitchSession(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isActive ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  background: isActive ? '#eff6ff' : s.isHeld ? '#fef3c7' : '#f9fafb',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  minWidth: 150
                }}
                title={s.isHeld ? 'Held Sale — click to resume' : `Switch to Sale #${s.sessionNumber}`}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>{s.customer ? '👤' : '🛒'}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? '#1d4ed8' : '#1f2937',
                        maxWidth: 130,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={s.customer ? `${s.customer.name} (Sale #${s.sessionNumber})` : `Walk-in Customer (Sale #${s.sessionNumber})`}
                    >
                      {custName}
                    </span>
                    {s.isHeld && (
                      <span
                        style={{
                          fontSize: 10,
                          background: '#f59e0b',
                          color: '#fff',
                          padding: '1px 4px',
                          borderRadius: 4,
                          fontWeight: 700
                        }}
                      >
                        HELD
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} • Rs {saleTotal.toFixed(0)} • {s.pricingTier === 'wholesale' ? '📦 Wholesale' : '🛍️ Retail'}
                  </div>
                </div>

                {/* Close / Abandon Tab button */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handlePromptCancelSale(s.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 4,
                    lineHeight: 1
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                  title="Close / Cancel this sale"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <button
          className="btn"
          onClick={handleCreateNewSale}
          disabled={sessions.length >= 10}
          style={{
            whiteSpace: 'nowrap',
            padding: '6px 14px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          title={sessions.length >= 10 ? 'Maximum 10 active sales reached' : 'Create new customer sale session'}
        >
          <span>➕</span> New Sale
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left: Products catalog & scanner */}
        <div style={{ flex: 1 }} className="card">
          <h3>Products</h3>
          <input
            ref={scanInputRef}
            className="no-drag"
            placeholder="Scan barcode (auto) or type & pause to search..."
            value={query}
            onChange={handleScanChange}
            onKeyDown={handleScanKeyDown}
            disabled={!isActiveView || addCustomerModalOpen || cancelModal.show}
            tabIndex={!isActiveView ? -1 : 0}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #ddd' }}
          />

          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {filteredProducts.map(p => {
              const isWholesale = activeSession?.pricingTier === 'wholesale';
              const effectivePrice = isWholesale
                ? (Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.price || 0))
                : Number(p.price || 0);

              return (
                <div key={p.id} style={{ padding: 8, border: '1px solid #eef3fb', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{p.category || '—'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: isWholesale ? '#7c3aed' : '#111827' }}>
                        Rs {effectivePrice.toFixed(2)}
                      </div>
                      {isWholesale && (
                        <div style={{ fontSize: 10, color: Number(p.wholesale_price) > 0 ? '#7c3aed' : '#9ca3af', fontWeight: 600 }}>
                          {Number(p.wholesale_price) > 0 ? '📦 Wholesale' : 'Retail price (no W.S)'}
                        </div>
                      )}
                    </div>
                    <button className="btn" onClick={() => addToCart(p.id, 1)}>Add</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Invoice & Cart panel */}
        <div style={{ width: 380 }} className="invoice card">
          <h3>Invoice</h3>

          {/* Customer Selector Section */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Customer</label>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                onClick={() => {
                  setNewCustomerError('');
                  setAddCustomerModalOpen(true);
                }}
              >
                ➕ Add Customer
              </button>
            </div>

            {selectedCustomer ? (
              /* Selected Registered Customer Card */
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>
                      👤 {selectedCustomer.name}
                    </span>
                    {selectedCustomer.customer_type === 'wholesale' ? (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: 8 }}>
                        📦 Wholesale
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 8 }}>
                        🛍️ Retail
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>
                    {selectedCustomer.phone ? `📞 ${selectedCustomer.phone}` : 'No phone number'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => setSelectedCustomer(null)}
                  title="Switch back to Walk-in Customer"
                >
                  Walk-in
                </button>
              </div>
            ) : (
              /* Customer Dropdown / Search Selector */
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="no-drag"
                  onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    textAlign: 'left',
                    fontSize: 13,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontWeight: 500, color: '#374151' }}>🛒 Walk-in Customer</span>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>▼</span>
                </button>

                {customerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      zIndex: 50,
                      marginTop: 4,
                      maxHeight: 220,
                      overflowY: 'auto'
                    }}
                  >
                    <div style={{ padding: 6, borderBottom: '1px solid #f1f5f9' }}>
                      <input
                        className="no-drag"
                        placeholder="Search by name or phone..."
                        value={customerSearchQuery}
                        onChange={e => setCustomerSearchQuery(e.target.value)}
                        onFocus={e => e.target.select?.()}
                        style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
                      />
                    </div>
                    <div
                      style={{
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontSize: 13,
                        borderBottom: '1px solid #f8fafc',
                        fontWeight: 600,
                        background: '#f8fafc'
                      }}
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerDropdownOpen(false);
                        setCustomerSearchQuery('');
                      }}
                    >
                      🛒 Walk-in Customer (Default)
                    </div>
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        style={{
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: '1px solid #f8fafc'
                        }}
                        className="hover-row"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerDropdownOpen(false);
                          setCustomerSearchQuery('');
                          if (c.customer_type === 'wholesale') {
                            togglePricingTier('wholesale');
                            showToast(`Wholesale customer selected: Pricing switched to Wholesale`, 'info');
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{c.name}</span>
                          {c.customer_type === 'wholesale' ? (
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: 8 }}>
                              📦 Wholesale
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 8 }}>
                              🛍️ Retail
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {c.phone || c.email || 'Registered customer'}
                        </div>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div style={{ padding: 10, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                        No matching customer
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pricing Tier Selector (Retail vs Wholesale) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              marginBottom: 12,
              background: activeSession?.pricingTier === 'wholesale' ? '#faf5ff' : '#f8fafc',
              borderRadius: 6,
              border: activeSession?.pricingTier === 'wholesale' ? '1px solid #e9d5ff' : '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{activeSession?.pricingTier === 'wholesale' ? '📦' : '🏷️'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: activeSession?.pricingTier === 'wholesale' ? '#6b21a8' : '#334155' }}>
                Pricing: {activeSession?.pricingTier === 'wholesale' ? 'Wholesale' : 'Retail'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn"
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: activeSession?.pricingTier !== 'wholesale' ? '#2563eb' : '#f1f5f9',
                  color: activeSession?.pricingTier !== 'wholesale' ? '#fff' : '#475569',
                  border: activeSession?.pricingTier !== 'wholesale' ? 'none' : '1px solid #cbd5e1'
                }}
                onClick={() => togglePricingTier('retail')}
                title="Sell at regular Retail prices"
              >
                🛍️ Retail
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: activeSession?.pricingTier === 'wholesale' ? '#7c3aed' : '#f1f5f9',
                  color: activeSession?.pricingTier === 'wholesale' ? '#fff' : '#475569',
                  border: activeSession?.pricingTier === 'wholesale' ? 'none' : '1px solid #cbd5e1'
                }}
                onClick={() => togglePricingTier('wholesale')}
                title="Sell at bulk Wholesale prices"
              >
                📦 Wholesale
              </button>
            </div>
          </div>

          {/* Cart items */}
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {cart.length === 0 && <div style={{ color: '#94a3b8', padding: '12px 0' }}>Cart is empty</div>}
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

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={submitSale}>Complete Sale</button>
              <button className="btn secondary" onClick={printBill}>Print Bill</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn secondary"
                style={{ flex: 1, color: activeSession?.isHeld ? '#15803d' : '#b45309' }}
                onClick={() => {
                  if (activeSession?.isHeld) {
                    handleResumeSale(activeSessionId);
                  } else {
                    handleHoldCurrentSale();
                  }
                }}
                title={activeSession?.isHeld ? 'Resume this sale' : 'Put this sale on hold and open another'}
              >
                {activeSession?.isHeld ? '▶️ Resume Sale' : '⏸️ Hold Sale'}
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ color: '#ef4444' }}
                onClick={() => handlePromptCancelSale(activeSessionId)}
                title="Discard this sale session"
              >
                ✕ Cancel Sale
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add Customer Directly from Sales */}
      {addCustomerModalOpen && (
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
          onClick={() => setAddCustomerModalOpen(false)}
        >
          <div
            className="card no-drag"
            style={{ width: 420, maxWidth: '90%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', pointerEvents: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>➕ Add Customer to Sale</h3>
              <button
                className="btn secondary"
                style={{ padding: '2px 8px', fontSize: 14 }}
                onClick={() => setAddCustomerModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {newCustomerError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                ⚠️ {newCustomerError}
              </div>
            )}

            <form onSubmit={handleQuickAddCustomer}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Customer Name *
                  </label>
                  <input
                    ref={quickCustNameInputRef}
                    className="no-drag"
                    required
                    placeholder="e.g. Ali Raza"
                    value={newCustomerForm.name}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    onFocus={e => e.target.select?.()}
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
                    value={newCustomerForm.phone}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    onFocus={e => e.target.select?.()}
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
                    value={newCustomerForm.email}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    onFocus={e => e.target.select?.()}
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
                    value={newCustomerForm.address}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Customer Type
                  </label>
                  <select
                    className="no-drag"
                    value={newCustomerForm.customer_type || 'retail'}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, customer_type: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
                  >
                    <option value="retail">🛍️ Retail Customer</option>
                    <option value="wholesale">📦 Wholesale Customer</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Notes
                  </label>
                  <textarea
                    className="no-drag"
                    rows={2}
                    placeholder="e.g. Regular wholesale customer"
                    value={newCustomerForm.notes}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setAddCustomerModalOpen(false)}
                    disabled={savingNewCustomer}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={savingNewCustomer}
                  >
                    {savingNewCustomer ? 'Saving...' : 'Save & Select'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}