// public/db-main.js
console.log("✅ db-main.js loaded successfully");

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const dbDir = app ? app.getPath('userData') : path.join(__dirname, '..', 'database');
const dbPath = path.join(dbDir, 'grocery.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

function init() {
  // products: added purchase_price and is_active
  db.prepare(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    category TEXT,
    price REAL NOT NULL DEFAULT 0,            -- selling price
    purchase_price REAL NOT NULL DEFAULT 0,   -- purchase/cost price
    stock_qty INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    change_qty INTEGER,
    note TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );`).run();

  // Backwards compatibility: ensure purchase_price and is_active columns exist
  const cols = db.prepare(`PRAGMA table_info(products);`).all().map(c => c.name);
  if (!cols.includes('purchase_price')) {
    db.prepare(`ALTER TABLE products ADD COLUMN purchase_price REAL DEFAULT 0;`).run();
  }
  if (!cols.includes('is_active')) {
    db.prepare(`ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;`).run();
  }
}
init();

/* --------------------------- Product functions --------------------------- */
function getProducts() {
  return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
}

function addProduct(p) {
  const stmt = db.prepare(`INSERT INTO products (name, sku, category, price, purchase_price, stock_qty, reorder_level, is_active)
   VALUES (@name, @sku, @category, @price, @purchase_price, @stock_qty, @reorder_level, 1)`);
  const info = stmt.run({
    name: p.name,
    sku: p.sku,
    category: p.category,
    price: p.price || 0,
    purchase_price: p.purchase_price || 0,
    stock_qty: p.stock_qty || 0,
    reorder_level: p.reorder_level || 0
  });
  return { id: info.lastInsertRowid, ...p };
}

function updateProduct(p) {
  const stmt = db.prepare(`UPDATE products 
    SET name=@name, sku=@sku, category=@category, price=@price, purchase_price=@purchase_price, stock_qty=@stock_qty, reorder_level=@reorder_level 
    WHERE id=@id AND is_active = 1`);
  stmt.run({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    price: p.price || 0,
    purchase_price: p.purchase_price || 0,
    stock_qty: p.stock_qty || 0,
    reorder_level: p.reorder_level || 0
  });
  return p;
}

// Soft delete (mark as inactive)
function deleteProduct(id) {
  const stmt = db.prepare('UPDATE products SET is_active = 0 WHERE id = ?');
  stmt.run(id);
  return { deleted: true };
}

/* --------------------------- Customer functions --------------------------- */
function getCustomers() {
  return db.prepare('SELECT * FROM customers ORDER BY name').all();
}

function addCustomer(c) {
  const stmt = db.prepare(`INSERT INTO customers (name, phone, email, address) 
                           VALUES (@name,@phone,@email,@address)`);
  const info = stmt.run(c);
  return { id: info.lastInsertRowid, ...c };
}

/* --------------------------- Sales functions --------------------------- */
function addSale(sale) {
  const insertSale = db.prepare('INSERT INTO sales (customer_id, customer_name, date, total_amount) VALUES (?,?,?,?)');
  const insertItem = db.prepare('INSERT INTO sales_items (sale_id, product_id, quantity, unit_price) VALUES (?,?,?,?)');
  const updateStock = db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?');
  const insertHistory = db.prepare('INSERT INTO stock_history (product_id, change_qty, note) VALUES (?,?,?)');

  const trx = db.transaction((sale) => {
    const info = insertSale.run(sale.customer_id || null, sale.customer_name || null, sale.date || new Date().toISOString(), sale.total_amount || 0);
    const saleId = info.lastInsertRowid;
    for (const item of sale.items) {
      insertItem.run(saleId, item.product_id, item.quantity, item.unit_price);
      updateStock.run(item.quantity, item.product_id);
      insertHistory.run(item.product_id, -item.quantity, `Sale #${saleId}`);
    }
    return saleId;
  });

  return trx(sale);
}

/* Clear sales (delete sales and sales_items) */
function clearSales() {
  db.prepare('DELETE FROM sales_items').run();
  db.prepare('DELETE FROM sales').run();
  return true;
}

/* --------------------------- Stats --------------------------- */
function getStats() {
  const totalProducts = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1').get().cnt;
  const lowStock = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND stock_qty <= reorder_level').get().cnt;
  const totalSales = db.prepare('SELECT IFNULL(SUM(total_amount),0) as sum FROM sales').get().sum;

  // totalProfit: sum over sales_items (unit_price - purchase_price) * quantity
  const totalProfitRow = db.prepare(
    `SELECT IFNULL(SUM( (si.unit_price - p.purchase_price) * si.quantity ), 0) as profit
     FROM sales_items si
     JOIN products p ON p.id = si.product_id`
  ).get();
  const totalProfit = totalProfitRow ? totalProfitRow.profit : 0;

  return { totalProducts, lowStock, totalSales, totalProfit };
}

module.exports = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getCustomers,
  addCustomer,
  addSale,
  getStats,
  clearSales
};
