// src/App.jsx
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import SalesPanel from './components/SalesPanel';
import Customers from './components/Customers';
import Suppliers from './components/Suppliers';
import Purchases from './components/Purchases';

export default function App() {
  // state to track which view is active
  const [view, setView] = useState('dashboard');
  console.log("🧭 App view =", view);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar controls navigation */}
      <Sidebar active={view} onNavigate={setView} />

      {/* Main area switches content */}
      <main style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'products' && <ProductList />}
        {view === 'customers' && <Customers />}
        {view === 'suppliers' && <Suppliers />}
        {view === 'purchases' && <Purchases />}
        {/* Keep SalesPanel mounted to preserve active multiple sales sessions and carts */}
        <div style={{ display: view === 'sales' ? 'block' : 'none' }}>
          <SalesPanel isActiveView={view === 'sales'} />
        </div>
      </main>
    </div>
  );
}
