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
  // Table: suppliers
  db.prepare(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`).run();

  // Table: products
  db.prepare(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    category TEXT,
    price REAL NOT NULL DEFAULT 0,            -- selling price
    purchase_price REAL NOT NULL DEFAULT 0,   -- purchase/cost price
    stock_qty INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,
    supplier_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
  );`).run();

  // Table: customers
  db.prepare(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`).run();

  // Table: sales
  db.prepare(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );`).run();

  // Table: sales_items
  db.prepare(`CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );`).run();

  // Table: stock_history
  db.prepare(`CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    change_qty INTEGER,
    note TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );`).run();

  // Table: purchases
  db.prepare(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT UNIQUE,
    supplier_id INTEGER NOT NULL,
    supplier_name TEXT,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
  );`).run();

  // Table: purchase_items
  db.prepare(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT,
    product_sku TEXT,
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY(purchase_id) REFERENCES purchases(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );`).run();

  // Backwards compatibility: ensure columns exist on products
  const prodCols = db.prepare(`PRAGMA table_info(products);`).all().map(c => c.name);
  if (!prodCols.includes('purchase_price')) {
    db.prepare(`ALTER TABLE products ADD COLUMN purchase_price REAL DEFAULT 0;`).run();
  }
  if (!prodCols.includes('is_active')) {
    db.prepare(`ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;`).run();
  }
  if (!prodCols.includes('supplier_id')) {
    db.prepare(`ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);`).run();
  }

  // Backwards compatibility: ensure columns exist on customers
  const custCols = db.prepare(`PRAGMA table_info(customers);`).all().map(c => c.name);
  if (!custCols.includes('notes')) {
    db.prepare(`ALTER TABLE customers ADD COLUMN notes TEXT;`).run();
  }
  if (!custCols.includes('is_active')) {
    db.prepare(`ALTER TABLE customers ADD COLUMN is_active INTEGER DEFAULT 1;`).run();
  }

  // Backwards compatibility: ensure columns exist on suppliers
  const supCols = db.prepare(`PRAGMA table_info(suppliers);`).all().map(c => c.name);
  if (!supCols.includes('contact')) {
    db.prepare(`ALTER TABLE suppliers ADD COLUMN contact TEXT;`).run();
  }
  if (!supCols.includes('email')) {
    db.prepare(`ALTER TABLE suppliers ADD COLUMN email TEXT;`).run();
  }
  if (!supCols.includes('address')) {
    db.prepare(`ALTER TABLE suppliers ADD COLUMN address TEXT;`).run();
  }
  if (!supCols.includes('notes')) {
    db.prepare(`ALTER TABLE suppliers ADD COLUMN notes TEXT;`).run();
  }
  if (!supCols.includes('is_active')) {
    db.prepare(`ALTER TABLE suppliers ADD COLUMN is_active INTEGER DEFAULT 1;`).run();
  }
}
init();

/* --------------------------- Product functions --------------------------- */
function getProducts() {
  return db.prepare(`
    SELECT p.*, s.name AS supplier_name
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.is_active = 1
    ORDER BY p.name
  `).all();
}

function addProduct(p) {
  const stmt = db.prepare(`
    INSERT INTO products (name, sku, category, price, purchase_price, stock_qty, reorder_level, supplier_id, is_active)
    VALUES (@name, @sku, @category, @price, @purchase_price, @stock_qty, @reorder_level, @supplier_id, 1)
  `);
  const info = stmt.run({
    name: p.name,
    sku: p.sku || null,
    category: p.category || null,
    price: p.price || 0,
    purchase_price: p.purchase_price || 0,
    stock_qty: p.stock_qty || 0,
    reorder_level: p.reorder_level || 0,
    supplier_id: p.supplier_id ? Number(p.supplier_id) : null
  });
  return { id: info.lastInsertRowid, ...p };
}

function updateProduct(p) {
  const stmt = db.prepare(`
    UPDATE products 
    SET name=@name, sku=@sku, category=@category, price=@price, purchase_price=@purchase_price, stock_qty=@stock_qty, reorder_level=@reorder_level, supplier_id=@supplier_id 
    WHERE id=@id AND is_active = 1
  `);
  stmt.run({
    id: p.id,
    name: p.name,
    sku: p.sku || null,
    category: p.category || null,
    price: p.price || 0,
    purchase_price: p.purchase_price || 0,
    stock_qty: p.stock_qty || 0,
    reorder_level: p.reorder_level || 0,
    supplier_id: p.supplier_id ? Number(p.supplier_id) : null
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
function getCustomers(options = {}) {
  const query = options?.query || '';
  const includeInactive = options?.includeInactive || false;

  let sql = `
    SELECT c.*,
           COUNT(s.id) AS orders_count,
           IFNULL(SUM(s.total_amount), 0) AS total_spent,
           MAX(s.date) AS last_purchase_date
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id
  `;
  const conditions = [];
  const params = [];

  if (!includeInactive) {
    conditions.push(`c.is_active = 1`);
  }

  if (query && query.trim()) {
    conditions.push(`(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`);
    const q = `%${query.trim()}%`;
    params.push(q, q, q);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` GROUP BY c.id ORDER BY c.name COLLATE NOCASE ASC`;
  return db.prepare(sql).all(...params);
}

function getCustomerById(id) {
  const sql = `
    SELECT c.*,
           COUNT(s.id) AS orders_count,
           IFNULL(SUM(s.total_amount), 0) AS total_spent,
           MAX(s.date) AS last_purchase_date
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `;
  return db.prepare(sql).get(id) || null;
}

function getCustomerPurchases(customerId) {
  const sql = `
    SELECT s.id, s.date, s.total_amount,
           COUNT(si.id) AS total_items
    FROM sales s
    LEFT JOIN sales_items si ON si.sale_id = s.id
    WHERE s.customer_id = ?
    GROUP BY s.id
    ORDER BY s.date DESC
  `;
  return db.prepare(sql).all(customerId);
}

function addCustomer(c) {
  if (!c || !c.name || !c.name.trim()) {
    throw new Error('Customer name is required');
  }

  const cleanPhone = (c.phone || '').trim();
  if (cleanPhone) {
    const existing = db.prepare(`SELECT id, name FROM customers WHERE phone = ? AND is_active = 1`).get(cleanPhone);
    if (existing) {
      throw new Error(`Customer "${existing.name}" already exists with phone "${cleanPhone}".`);
    }
  }

  const insertStmt = db.prepare(`
    INSERT INTO customers (name, phone, email, address, notes, is_active) 
    VALUES (@name, @phone, @email, @address, @notes, 1)
  `);
  const info = insertStmt.run({
    name: c.name.trim(),
    phone: cleanPhone || null,
    email: (c.email || '').trim() || null,
    address: (c.address || '').trim() || null,
    notes: (c.notes || '').trim() || null
  });
  return getCustomerById(info.lastInsertRowid);
}

function updateCustomer(c) {
  if (!c || !c.id) throw new Error('Customer ID is required');
  if (!c.name || !c.name.trim()) throw new Error('Customer name is required');

  const cleanPhone = (c.phone || '').trim();
  if (cleanPhone) {
    const existing = db.prepare(`SELECT id, name FROM customers WHERE phone = ? AND id != ? AND is_active = 1`).get(cleanPhone, c.id);
    if (existing) {
      throw new Error(`Another customer "${existing.name}" is already registered with phone "${cleanPhone}".`);
    }
  }

  const updateStmt = db.prepare(`
    UPDATE customers 
    SET name = @name, phone = @phone, email = @email, address = @address, notes = @notes
    WHERE id = @id
  `);
  updateStmt.run({
    id: c.id,
    name: c.name.trim(),
    phone: cleanPhone || null,
    email: (c.email || '').trim() || null,
    address: (c.address || '').trim() || null,
    notes: (c.notes || '').trim() || null
  });
  return getCustomerById(c.id);
}

function deleteCustomer(id) {
  // Soft delete — deactivate customer so previous sales remain intact
  db.prepare(`UPDATE customers SET is_active = 0 WHERE id = ?`).run(id);
  return { id, is_active: 0 };
}

function toggleCustomerActive(id, isActive) {
  db.prepare(`UPDATE customers SET is_active = ? WHERE id = ?`).run(isActive ? 1 : 0, id);
  return { id, is_active: isActive ? 1 : 0 };
}

/* --------------------------- Supplier functions --------------------------- */
function getSuppliers(options = {}) {
  const query = options?.query || '';
  const includeInactive = options?.includeInactive || false;

  let sql = `
    SELECT s.*,
           COUNT(p.id) AS products_count
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = 1
  `;
  const conditions = [];
  const params = [];

  if (!includeInactive) {
    conditions.push(`s.is_active = 1`);
  }

  if (query && query.trim()) {
    conditions.push(`(s.name LIKE ? OR s.contact LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)`);
    const q = `%${query.trim()}%`;
    params.push(q, q, q, q);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` GROUP BY s.id ORDER BY s.name COLLATE NOCASE ASC`;
  return db.prepare(sql).all(...params);
}

function getSupplierById(id) {
  const sql = `
    SELECT s.*,
           COUNT(p.id) AS products_count
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = 1
    WHERE s.id = ?
    GROUP BY s.id
  `;
  return db.prepare(sql).get(id) || null;
}

function getSupplierProducts(supplierId) {
  return db.prepare(`
    SELECT id, name, sku, category, price, purchase_price, stock_qty, reorder_level
    FROM products
    WHERE supplier_id = ? AND is_active = 1
    ORDER BY name
  `).all(supplierId);
}

function addSupplier(s) {
  if (!s || !s.name || !s.name.trim()) {
    throw new Error('Supplier company name is required');
  }

  const cleanName = s.name.trim();
  const existing = db.prepare(`SELECT id, name FROM suppliers WHERE LOWER(TRIM(name)) = LOWER(?) AND is_active = 1`).get(cleanName);
  if (existing) {
    throw new Error(`Supplier company "${existing.name}" is already registered.`);
  }

  const insertStmt = db.prepare(`
    INSERT INTO suppliers (name, contact, phone, email, address, notes, is_active)
    VALUES (@name, @contact, @phone, @email, @address, @notes, 1)
  `);
  const info = insertStmt.run({
    name: cleanName,
    contact: (s.contact || s.contact_person || '').trim() || null,
    phone: (s.phone || '').trim() || null,
    email: (s.email || '').trim() || null,
    address: (s.address || '').trim() || null,
    notes: (s.notes || '').trim() || null
  });
  return getSupplierById(info.lastInsertRowid);
}

function updateSupplier(s) {
  if (!s || !s.id) throw new Error('Supplier ID is required');
  if (!s.name || !s.name.trim()) throw new Error('Supplier company name is required');

  const cleanName = s.name.trim();
  const existing = db.prepare(`SELECT id, name FROM suppliers WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND is_active = 1`).get(cleanName, s.id);
  if (existing) {
    throw new Error(`Another supplier company "${existing.name}" already uses this name.`);
  }

  const updateStmt = db.prepare(`
    UPDATE suppliers
    SET name = @name, contact = @contact, phone = @phone, email = @email, address = @address, notes = @notes
    WHERE id = @id
  `);
  updateStmt.run({
    id: s.id,
    name: cleanName,
    contact: (s.contact || s.contact_person || '').trim() || null,
    phone: (s.phone || '').trim() || null,
    email: (s.email || '').trim() || null,
    address: (s.address || '').trim() || null,
    notes: (s.notes || '').trim() || null
  });
  return getSupplierById(s.id);
}

function toggleSupplierActive(id, isActive) {
  db.prepare(`UPDATE suppliers SET is_active = ? WHERE id = ?`).run(isActive ? 1 : 0, id);
  return { id, is_active: isActive ? 1 : 0 };
}

function deleteSupplier(id) {
  // 1. Check if any ACTIVE products are associated with this supplier
  const activeProductsCount = db.prepare(`SELECT COUNT(*) AS cnt FROM products WHERE supplier_id = ? AND is_active = 1`).get(id);
  if (activeProductsCount && activeProductsCount.cnt > 0) {
    const err = new Error('This supplier is attached to active products and cannot be deleted. Please remove or reassign those products first.');
    err.hasProducts = true;
    throw err;
  }

  // 2. Check if any purchases reference this supplier
  const purchasesCount = db.prepare(`SELECT COUNT(*) AS cnt FROM purchases WHERE supplier_id = ?`).get(id);
  if (purchasesCount && purchasesCount.cnt > 0) {
    const err = new Error('This supplier has historical purchase records and cannot be permanently deleted. You can deactivate the supplier instead.');
    err.hasPurchases = true;
    throw err;
  }

  // 3. If only inactive/soft-deleted products reference this supplier,
  // safely set their supplier_id to NULL to preserve SQLite foreign key integrity,
  // then permanently delete the supplier.
  const updateInactive = db.prepare(`UPDATE products SET supplier_id = NULL WHERE supplier_id = ? AND is_active = 0`);
  const deleteSupplierStmt = db.prepare(`DELETE FROM suppliers WHERE id = ?`);

  const trx = db.transaction(() => {
    updateInactive.run(id);
    deleteSupplierStmt.run(id);
  });
  trx();

  return { id, deleted: true };
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

function getSales(start, end) {
  if (start && end) {
    return db.prepare('SELECT * FROM sales WHERE date BETWEEN ? AND ? ORDER BY date DESC').all(start, end);
  }
  return db.prepare('SELECT * FROM sales ORDER BY date DESC').all();
}

function getSaleDetails(saleId) {
  const sale = db.prepare(`
    SELECT s.*, c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(saleId);
  if (!sale) return null;

  const items = db.prepare(`
    SELECT si.*, p.name AS product_name, p.sku AS product_sku
    FROM sales_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
  `).all(saleId);

  return { ...sale, items };
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

function getDashboardStats(startDate, endDate) {
  // 1. All-time statistics (never affected by date filter)
  const totalSalesRow = db.prepare('SELECT IFNULL(SUM(total_amount), 0) as sum, COUNT(*) as cnt FROM sales').get();
  const totalSales = totalSalesRow ? totalSalesRow.sum : 0;
  const totalTransactions = totalSalesRow ? totalSalesRow.cnt : 0;

  const totalProfitRow = db.prepare(
    `SELECT IFNULL(SUM( (si.unit_price - p.purchase_price) * si.quantity ), 0) as profit
     FROM sales_items si
     JOIN products p ON p.id = si.product_id`
  ).get();
  const totalProfit = totalProfitRow ? totalProfitRow.profit : 0;

  const totalProducts = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1').get().cnt;
  const totalCustomers = db.prepare('SELECT COUNT(*) as cnt FROM customers WHERE is_active = 1').get().cnt;
  const totalSuppliers = db.prepare('SELECT COUNT(*) as cnt FROM suppliers WHERE is_active = 1').get().cnt;

  // 2. Current inventory status (current low stock, unaffected by sales date)
  const lowStock = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND stock_qty <= reorder_level').get().cnt;

  // 3. Period-based statistics (filtered by completed sales within date range)
  let periodSales = 0;
  let periodProfit = 0;
  let periodProductsSold = 0;
  let periodTransactions = 0;

  if (startDate && endDate) {
    const periodSalesRow = db.prepare(
      'SELECT IFNULL(SUM(total_amount), 0) as sum, COUNT(*) as cnt FROM sales WHERE date >= ? AND date <= ?'
    ).get(startDate, endDate);
    periodSales = periodSalesRow ? periodSalesRow.sum : 0;
    periodTransactions = periodSalesRow ? periodSalesRow.cnt : 0;

    const periodProfitRow = db.prepare(
      `SELECT IFNULL(SUM( (si.unit_price - p.purchase_price) * si.quantity ), 0) as profit,
              IFNULL(SUM(si.quantity), 0) as items_sold
       FROM sales_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.date >= ? AND s.date <= ?`
    ).get(startDate, endDate);
    periodProfit = periodProfitRow ? periodProfitRow.profit : 0;
    periodProductsSold = periodProfitRow ? periodProfitRow.items_sold : 0;
  } else {
    // If no range provided, default to all-time for the period values
    periodSales = totalSales;
    periodProfit = totalProfit;
    periodTransactions = totalTransactions;

    const itemsSoldRow = db.prepare('SELECT IFNULL(SUM(quantity), 0) as items_sold FROM sales_items').get();
    periodProductsSold = itemsSoldRow ? itemsSoldRow.items_sold : 0;
  }

  return {
    // Period Overview
    periodSales,
    periodProfit,
    periodProductsSold,
    periodTransactions,
    lowStock,

    // All-time Overview
    totalSales,
    totalProfit,
    totalTransactions,
    totalProducts,
    totalCustomers,
    totalSuppliers
  };
}

/* --------------------------- Purchases functions --------------------------- */
function addPurchase(purchase) {
  // Validate basic payload
  if (!purchase.supplier_id) {
    throw new Error('Supplier is required for purchase');
  }
  if (!purchase.items || !Array.isArray(purchase.items) || purchase.items.length === 0) {
    throw new Error('At least one product item is required for purchase');
  }

  // Generate sequential purchase number (e.g. PUR-0001)
  const maxRow = db.prepare('SELECT MAX(id) as maxId FROM purchases').get();
  const nextId = (maxRow && maxRow.maxId ? maxRow.maxId : 0) + 1;
  const purchaseNumber = `PUR-${String(nextId).padStart(4, '0')}`;

  // Fetch supplier name for snapshot
  const supplierRow = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(purchase.supplier_id);
  const supplierName = supplierRow ? supplierRow.name : 'Unknown Supplier';

  const insertPurchase = db.prepare(`
    INSERT INTO purchases (purchase_number, supplier_id, supplier_name, purchase_date, total_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO purchase_items (purchase_id, product_id, product_name, product_sku, quantity, unit_cost, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateProductStock = db.prepare(`
    UPDATE products
    SET stock_qty = stock_qty + ?, purchase_price = ?
    WHERE id = ?
  `);

  const insertStockHistory = db.prepare(`
    INSERT INTO stock_history (product_id, change_qty, note)
    VALUES (?, ?, ?)
  `);

  const trx = db.transaction((data) => {
    // 1. Calculate total and validate items
    let totalAmount = 0;
    for (const item of data.items) {
      const qty = parseInt(item.quantity);
      const cost = parseFloat(item.unit_cost);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid quantity ${item.quantity} for product ID ${item.product_id}. Must be > 0.`);
      }
      if (isNaN(cost) || cost < 0) {
        throw new Error(`Invalid unit cost ${item.unit_cost} for product ID ${item.product_id}. Must be >= 0.`);
      }
      totalAmount += qty * cost;
    }

    // 2. Insert main purchase header
    const pDate = data.purchase_date ? new Date(data.purchase_date).toISOString() : new Date().toISOString();
    const purchaseInfo = insertPurchase.run(
      purchaseNumber,
      data.supplier_id,
      supplierName,
      pDate,
      totalAmount,
      data.notes || null
    );
    const purchaseId = purchaseInfo.lastInsertRowid;

    // 3. Insert purchase items and update product inventory
    for (const item of data.items) {
      const qty = parseInt(item.quantity);
      const cost = parseFloat(item.unit_cost);
      const lineTotal = qty * cost;

      // Fetch product name/sku snapshot if not passed
      let prodName = item.product_name;
      let prodSku = item.product_sku;
      if (!prodName) {
        const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(item.product_id);
        if (prod) {
          prodName = prod.name;
          prodSku = prod.sku;
        }
      }

      insertItem.run(
        purchaseId,
        item.product_id,
        prodName || null,
        prodSku || null,
        qty,
        cost,
        lineTotal
      );

      // Increase stock and update purchase price
      updateProductStock.run(qty, cost, item.product_id);

      // Log stock change history
      insertStockHistory.run(item.product_id, qty, `Purchase #${purchaseNumber}`);
    }

    return { id: purchaseId, purchase_number: purchaseNumber, total_amount: totalAmount };
  });

  return trx(purchase);
}

function getPurchases(query = '') {
  const q = `%${query.trim()}%`;
  return db.prepare(`
    SELECT p.*,
           COUNT(pi.id) as items_count,
           IFNULL(SUM(pi.quantity), 0) as total_quantity
    FROM purchases p
    LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
    WHERE p.purchase_number LIKE ? OR p.supplier_name LIKE ?
    GROUP BY p.id
    ORDER BY p.id DESC
  `).all(q, q);
}

function getPurchaseDetails(purchaseId) {
  const purchase = db.prepare(`
    SELECT p.*, s.phone AS supplier_phone, s.contact AS supplier_contact
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ?
  `).get(purchaseId);

  if (!purchase) return null;

  const items = db.prepare(`
    SELECT pi.*, p.stock_qty as current_stock
    FROM purchase_items pi
    LEFT JOIN products p ON p.id = pi.product_id
    WHERE pi.purchase_id = ?
  `).all(purchaseId);

  return { ...purchase, items };
}

module.exports = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getCustomers,
  getCustomerById,
  getCustomerPurchases,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  toggleCustomerActive,
  getSuppliers,
  getSupplierById,
  getSupplierProducts,
  addSupplier,
  updateSupplier,
  toggleSupplierActive,
  deleteSupplier,
  addSale,
  getSales,
  getSaleDetails,
  addPurchase,
  getPurchases,
  getPurchaseDetails,
  getStats,
  getDashboardStats,
  clearSales,
  _db: db
};
