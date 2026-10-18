// src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react';

export default function Dashboard({ onNavigate }) {
  // Period filter: 'today' | 'week' | 'month' | 'custom'
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [stats, setStats] = useState({
    // Period metrics
    periodSales: 0,
    periodProfit: 0,
    periodProductsSold: 0,
    periodTransactions: 0,
    lowStock: 0,

    // All-Time metrics
    totalSales: 0,
    totalProfit: 0,
    totalTransactions: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalSuppliers: 0
  });

  const [loading, setLoading] = useState(true);
  const [loadingClear, setLoadingClear] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate start and end ISO strings based on selected period
  function getDateRange(selectedPeriod, cStart, cEnd) {
    const now = new Date();

    if (selectedPeriod === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (selectedPeriod === 'week') {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (selectedPeriod === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (selectedPeriod === 'custom') {
      const s = cStart ? new Date(`${cStart}T00:00:00.000`) : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = cEnd ? new Date(`${cEnd}T23:59:59.999`) : now;
      return { startDate: s.toISOString(), endDate: e.toISOString() };
    }

    return { startDate: null, endDate: null };
  }

  async function loadDashboard(selectedPeriod = period, cStart = customStart, cEnd = customEnd) {
    try {
      setLoading(true);
      setErrorMsg('');
      const range = getDateRange(selectedPeriod, cStart, cEnd);

      if (window.api?.getDashboardStats) {
        const data = await window.api.getDashboardStats(range);
        setStats({
          periodSales: data.periodSales || 0,
          periodProfit: data.periodProfit || 0,
          periodProductsSold: data.periodProductsSold || 0,
          periodTransactions: data.periodTransactions || 0,
          lowStock: data.lowStock || 0,
          totalSales: data.totalSales || 0,
          totalProfit: data.totalProfit || 0,
          totalTransactions: data.totalTransactions || 0,
          totalProducts: data.totalProducts || 0,
          totalCustomers: data.totalCustomers || 0,
          totalSuppliers: data.totalSuppliers || 0
        });
      } else if (window.api?.getStats) {
        const s = await window.api.getStats();
        setStats(prev => ({
          ...prev,
          totalProducts: s.totalProducts || 0,
          lowStock: s.lowStock || 0,
          totalSales: s.totalSales || 0,
          totalProfit: s.totalProfit || 0,
          periodSales: s.totalSales || 0,
          periodProfit: s.totalProfit || 0
        }));
      }
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
      setErrorMsg('Failed to load dashboard statistics. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (period !== 'custom') {
      loadDashboard(period);
    }
  }, [period]);

  function handleApplyCustom() {
    loadDashboard('custom', customStart, customEnd);
  }

  async function handleClearSales() {
    const confirmed = window.confirm(
      'Are you sure you want to clear all sales records?\nThis will permanently delete all completed sales and items from the database.'
    );
    if (!confirmed) return;

    try {
      setLoadingClear(true);
      await window.api.clearSales();
      await loadDashboard(period);

      setTimeout(() => {
        window.focus();
        document.activeElement?.blur?.();
      }, 100);
    } catch (err) {
      console.error('Failed to clear sales', err);
      alert('Error clearing sales: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingClear(false);
    }
  }

  const periodLabel =
    period === 'today'
      ? "Today's Performance"
      : period === 'week'
      ? "This Week's Performance"
      : period === 'month'
      ? "This Month's Performance"
      : 'Custom Period Performance';

  const periodSalesTitle =
    period === 'today' ? "Today's Sales" : 'Period Sales';
  const periodProfitTitle =
    period === 'today' ? "Today's Profit" : 'Period Profit';

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header & Date / Period Filter Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 Store Dashboard
          </h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Monitor real-time sales, profitability, inventory status, and all-time store metrics.
          </div>
        </div>

        {/* Period Selector Controls */}
        <div
          className="card"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            background: '#fff'
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Period:</span>
          <select
            className="no-drag"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              background: '#f9fafb'
            }}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>From:</span>
              <input
                type="date"
                className="no-drag"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 12
                }}
              />
              <span style={{ fontSize: 12, color: '#6b7280' }}>To:</span>
              <input
                type="date"
                className="no-drag"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 12
                }}
              />
              <button
                className="btn"
                style={{ padding: '5px 12px', fontSize: 12 }}
                onClick={handleApplyCustom}
              >
                Apply
              </button>
            </div>
          )}

          <button
            className="btn secondary"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={() => loadDashboard(period, customStart, customEnd)}
            title="Refresh statistics"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: '#fee2e2',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. PERIOD OVERVIEW SECTION                                  */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📅</span> {periodLabel}
          </h3>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {period === 'today' && 'Based on completed sales recorded today'}
            {period === 'week' && 'Based on completed sales recorded this week'}
            {period === 'month' && 'Based on completed sales recorded this month'}
            {period === 'custom' && `From ${customStart} to ${customEnd}`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* Card: Period Sales */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderLeft: '4px solid #2563eb'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {periodSalesTitle}
              </div>
              <span style={{ fontSize: 18 }}>💰</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1e3a8a', marginTop: 8 }}>
              {loading ? '...' : `Rs ${Number(stats.periodSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              {stats.periodTransactions} completed {stats.periodTransactions === 1 ? 'sale' : 'sales'}
            </div>
          </div>

          {/* Card: Period Profit */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderLeft: `4px solid ${Number(stats.periodProfit || 0) >= 0 ? '#16a34a' : '#dc2626'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {periodProfitTitle}
              </div>
              <span style={{ fontSize: 18 }}>📈</span>
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: Number(stats.periodProfit || 0) >= 0 ? '#15803d' : '#b91c1c',
                marginTop: 8
              }}
            >
              {loading ? '...' : `Rs ${Number(stats.periodProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Gross profit from period sales
            </div>
          </div>

          {/* Card: Products Sold */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderLeft: '4px solid #0891b2'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Products Sold
              </div>
              <span style={{ fontSize: 18 }}>📦</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0e7490', marginTop: 8 }}>
              {loading ? '...' : stats.periodProductsSold}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Total units sold in period
            </div>
          </div>

          {/* Card: Low Stock (Current inventory status) */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderLeft: `4px solid ${stats.lowStock > 0 ? '#f59e0b' : '#10b981'}`,
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s ease'
            }}
            onClick={() => onNavigate && onNavigate('products')}
            title={onNavigate ? 'Click to view Products' : 'Current low stock products'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Low Stock
              </div>
              <span style={{ fontSize: 18 }}>⚠️</span>
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: stats.lowStock > 0 ? '#d97706' : '#15803d',
                marginTop: 8
              }}
            >
              {loading ? '...' : `${stats.lowStock} ${stats.lowStock === 1 ? 'Product' : 'Products'}`}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              {onNavigate ? 'Click to manage in Inventory →' : 'Products at or below reorder level'}
            </div>
          </div>

          {/* Card: Period Expenses (Placeholder for future Expenses module) */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#f8fafc',
              borderLeft: '4px solid #94a3b8'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Period Expenses
              </div>
              <span style={{ fontSize: 18 }}>🧾</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#64748b', marginTop: 12 }}>
              Not Available
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              Expenses module not configured
            </div>
          </div>

          {/* Card: Net Profit (Placeholder for future Expenses module) */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#f8fafc',
              borderLeft: '4px solid #94a3b8'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Net Profit
              </div>
              <span style={{ fontSize: 18 }}>⚖️</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#64748b', marginTop: 12 }}>
              Requires Expenses
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              Gross Profit − Expenses
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. ALL-TIME OVERVIEW SECTION                                 */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏛️</span> All-Time Store Overview
          </h3>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Cumulative lifetime metrics (unaffected by date filter)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* All-Time Sales */}
          <div className="card" style={{ padding: 16, background: '#fff', borderTop: '3px solid #1e40af' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Sales
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a', marginTop: 8 }}>
              {loading ? '...' : `Rs ${Number(stats.totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              All-time completed store revenue
            </div>
          </div>

          {/* All-Time Profit */}
          <div className="card" style={{ padding: 16, background: '#fff', borderTop: '3px solid #15803d' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Profit
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: Number(stats.totalProfit || 0) >= 0 ? '#15803d' : '#b91c1c',
                marginTop: 8
              }}
            >
              {loading ? '...' : `Rs ${Number(stats.totalProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              All-time gross store profit
            </div>
          </div>

          {/* All-Time Transactions */}
          <div className="card" style={{ padding: 16, background: '#fff', borderTop: '3px solid #6366f1' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Transactions
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4338ca', marginTop: 8 }}>
              {loading ? '...' : stats.totalTransactions}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Total completed sales receipts
            </div>
          </div>

          {/* Total Products */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderTop: '3px solid #0284c7',
              cursor: onNavigate ? 'pointer' : 'default'
            }}
            onClick={() => onNavigate && onNavigate('products')}
            title={onNavigate ? 'Click to view Products' : 'Total products'}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Products
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0369a1', marginTop: 8 }}>
              {loading ? '...' : stats.totalProducts}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Active items in catalog
            </div>
          </div>

          {/* Total Customers */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderTop: '3px solid #7c3aed',
              cursor: onNavigate ? 'pointer' : 'default'
            }}
            onClick={() => onNavigate && onNavigate('customers')}
            title={onNavigate ? 'Click to view Customers' : 'Total registered customers'}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Registered Customers
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#6d28d9', marginTop: 8 }}>
              {loading ? '...' : stats.totalCustomers}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Active customer profiles
            </div>
          </div>

          {/* Total Suppliers */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#fff',
              borderTop: '3px solid #059669',
              cursor: onNavigate ? 'pointer' : 'default'
            }}
            onClick={() => onNavigate && onNavigate('suppliers')}
            title={onNavigate ? 'Click to view Suppliers' : 'Total suppliers'}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Suppliers
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#047857', marginTop: 8 }}>
              {loading ? '...' : stats.totalSuppliers}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Registered vendors & suppliers
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. STORE ADMINISTRATION                                      */}
      {/* ============================================================ */}
      <div
        className="card"
        style={{
          padding: 16,
          background: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
            Store Data Administration
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Reset all completed sales records and transaction history from the database.
          </div>
        </div>

        <button
          className="btn"
          onClick={handleClearSales}
          disabled={loadingClear}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            cursor: loadingClear ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>🗑️</span>
          {loadingClear ? 'Clearing Records...' : 'Clear All Sales'}
        </button>
      </div>
    </div>
  );
}
