// src/components/Sidebar.jsx
import React from "react";

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div style={{ width: 36, height: 36, background: "#fff", borderRadius: 6 }}></div>
        <div>
          <div>Grocery Store</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Management System</div>
        </div>
      </div>

      <div className={`nav-item ${active === "dashboard" ? "active" : ""}`} onClick={() => onNavigate("dashboard")}>📊 Dashboard</div>
      <div className={`nav-item ${active === "products" ? "active" : ""}`} onClick={() => onNavigate("products")}>🧾 Products</div>
      <div className={`nav-item ${active === "customers" ? "active" : ""}`} onClick={() => onNavigate("customers")}>👥 Customers</div>
      <div className={`nav-item ${active === "suppliers" ? "active" : ""}`} onClick={() => onNavigate("suppliers")}>🏷 Suppliers</div>
      <div className={`nav-item ${active === "purchases" ? "active" : ""}`} onClick={() => onNavigate("purchases")}>🛒 Purchases</div>
      <div className={`nav-item ${active === "sales" ? "active" : ""}`} onClick={() => onNavigate("sales")}>💳 Sales</div>
    </aside>
  );
}

