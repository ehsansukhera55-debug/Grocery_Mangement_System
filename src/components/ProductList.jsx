// src/components/ProductList.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    id: null,
    name: '',
    sku: '',
    category: '',
    price: '',           // keep as string so user can clear/overwrite
    purchase_price: '',  // keep as string
    stock_qty: '',       // keep as string
    reorder_level: ''    // keep as string
  });

  const nameInputRef = useRef(null);
  const scanInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    fetchProducts();
    setTimeout(() => scanInputRef.current?.focus(), 120);
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

  function restoreFocus(elRef) {
    setTimeout(() => {
      try {
        window.focus();
        document.activeElement?.blur?.();
        elRef?.current?.focus?.();
      } catch (err) {
        console.error(err);
      }
    }, 60);
  }

  // --- Scan handling (auto-search without Enter) ---
  function handleScanChange(e) {
    const val = e.target.value;
    setQuery(val);
    lastScanTimeRef.current = Date.now();
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastScanTimeRef.current;
      if (elapsed >= 120) handleScanComplete(val);
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
      // populate form using strings (so inputs remain editable)
      setForm({
        id: found.id,
        name: found.name || '',
        sku: found.sku || '',
        category: found.category || '',
        price: (found.price !== undefined && found.price !== null) ? String(found.price) : '',
        purchase_price: (found.purchase_price !== undefined && found.purchase_price !== null) ? String(found.purchase_price) : '',
        stock_qty: (found.stock_qty !== undefined && found.stock_qty !== null) ? String(found.stock_qty) : '',
        reorder_level: (found.reorder_level !== undefined && found.reorder_level !== null) ? String(found.reorder_level) : ''
      });
      restoreFocus(nameInputRef);
    } else {
      // not found -> prepare new product with scanned SKU
      setForm(prev => ({ ...prev, sku: value }));
      restoreFocus(nameInputRef);
    }
  }

  const filtered = products.filter(p =>
    (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(query.toLowerCase())
  );

  async function save() {
    if (!form.name.trim()) return;

    // convert string inputs to numbers (with safe defaults)
    const payload = {
      id: form.id || undefined,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      price: parseFloat(form.price) || 0,
      purchase_price: parseFloat(form.purchase_price) || 0,
      stock_qty: parseInt(form.stock_qty) || 0,
      reorder_level: parseInt(form.reorder_level) || 0
    };

    try {
      if (payload.id) {
        await window.api.products.update(payload);
      } else {
        await window.api.products.add(payload);
      }
      fetchProducts();
      // clear form (strings)
      setForm({ id: null, name: '', sku: '', category: '', price: '', purchase_price: '', stock_qty: '', reorder_level: '' });
      restoreFocus(scanInputRef);
    } catch (err) {
      console.error('Save error', err);
      console.error('Error saving product');
      restoreFocus(scanInputRef);
    }
  }

  async function remove(id) {
    try {
      await window.api.products.delete(id);

      fetchProducts();

      setForm({
        id: null,
        name: '',
        sku: '',
        category: '',
        price: '',
        purchase_price: '',
        stock_qty: '',
        reorder_level: ''
      });

      restoreFocus(scanInputRef);

      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);

    } catch (err) {
      console.error('Delete error', err);
      restoreFocus(scanInputRef);
    }
  }

  function edit(p) {
    setForm({
      id: p.id,
      name: p.name || '',
      sku: p.sku || '',
      category: p.category || '',
      price: (p.price !== undefined && p.price !== null) ? String(p.price) : '',
      purchase_price: (p.purchase_price !== undefined && p.purchase_price !== null) ? String(p.purchase_price) : '',
      stock_qty: (p.stock_qty !== undefined && p.stock_qty !== null) ? String(p.stock_qty) : '',
      reorder_level: (p.reorder_level !== undefined && p.reorder_level !== null) ? String(p.reorder_level) : ''
    });
    restoreFocus(nameInputRef);
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }} className="products-table card">
        <h3>Product List</h3>

        <div className="search">
          <input
            ref={scanInputRef}
            className="no-drag"
            placeholder="Scan barcode or type to search (auto)"
            value={query}
            onChange={handleScanChange}
            onKeyDown={handleScanKeyDown}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            autoFocus
          />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{p.stock_qty}</td>
                <td>Rs {Number(p.price || 0).toFixed(2)}</td>
                <td>
                  <button className="btn secondary" onClick={() => edit(p)}>Edit</button>
                  <button className="btn" style={{ marginLeft: 8, background: '#ef4444' }} onClick={() => remove(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ width: 340 }} className="card">
        <h3>Add / Edit Product</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={nameInputRef}
            className="no-drag"
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />

          <input
            className="no-drag"
            placeholder="SKU"
            value={form.sku}
            onChange={e => setForm({ ...form, sku: e.target.value })}
          />

          <input
            className="no-drag"
            placeholder="Category"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
          />

          <input
            className="no-drag"
            placeholder="Price (selling)"
            type="number"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
          />

          <input
            className="no-drag"
            placeholder="Purchase price (cost)"
            type="number"
            value={form.purchase_price}
            onChange={e => setForm({ ...form, purchase_price: e.target.value })}
          />

          <input
            className="no-drag"
            placeholder="Stock"
            type="number"
            value={form.stock_qty}
            onChange={e => setForm({ ...form, stock_qty: e.target.value })}
          />

          <input
            className="no-drag"
            placeholder="Reorder level"
            type="number"
            value={form.reorder_level}
            onChange={e => setForm({ ...form, reorder_level: e.target.value })}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={save}>Save</button>
            <button
              className="btn secondary"
              onClick={() => {
                setForm({ id: null, name: '', sku: '', category: '', price: '', purchase_price: '', stock_qty: '', reorder_level: '' });
                restoreFocus(scanInputRef);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
