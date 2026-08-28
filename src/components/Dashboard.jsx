// src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    totalSales: 0,
    totalProfit: 0
  });
  const [loadingClear, setLoadingClear] = useState(false);

  async function loadStats() {
    try {
      const s = await window.api.getStats();
      setStats({
        totalProducts: s.totalProducts || 0,
        lowStock: s.lowStock || 0,
        totalSales: s.totalSales || 0,
        totalProfit: s.totalProfit || 0
      });
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function handleClearSales() {
    try {
      setLoadingClear(true);

      await window.api.clearSales();
      await loadStats();

      setTimeout(() => {
        window.focus();
        document.activeElement?.blur?.();
      }, 100);

    } catch (err) {
      console.error('Failed to clear sales', err);
    } finally {
      setLoadingClear(false);
    }
  }
  return (
    <div style={{ padding: 20 }}>
      <h2>📊 Dashboard</h2>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 12, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Total Products</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.totalProducts}</div>
        </div>

        <div className="card" style={{ padding: 12, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Low Stock</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.lowStock}</div>
        </div>

        <div className="card" style={{ padding: 12, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Total Sales</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Rs {Number(stats.totalSales || 0).toFixed(2)}</div>
        </div>

        <div className="card" style={{ padding: 12, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Total Profit</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: (Number(stats.totalProfit || 0) >= 0) ? '#15803d' : '#b91c1c'
            }}
          >
            Rs {Number(stats.totalProfit || 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          className="btn"
          onClick={handleClearSales}
          disabled={loadingClear}
          style={{
            background: '#d9534f',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 6,
            cursor: loadingClear ? 'not-allowed' : 'pointer'
          }}
        >
          {loadingClear ? 'Clearing...' : '🗑️ Clear All Sales'}
        </button>
      </div>
    </div>
  );
}
