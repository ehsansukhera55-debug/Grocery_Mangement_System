// public/electron-main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db-main'); // Database handler

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  const prodIndex = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    // 👉 Development mode (served by Vite)
    win.loadURL(devServerUrl);
    win.webContents.openDevTools();
  } else {
    // 👉 Production mode
    if (fs.existsSync(prodIndex)) {
      win.loadFile(prodIndex);
    } else {
      console.error('❌ index.html not found at:', prodIndex);
      win.loadURL('data:text/html,<h2>Build not found. Run npm run build first.</h2>');
    }
  }
}

// App ready
app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit on all windows closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ──────────────────────────────
   IPC ROUTES (Backend Handlers)
────────────────────────────────*/

// Products
ipcMain.handle('products:get', () => db.getProducts());
ipcMain.handle('products:add', (_, product) => db.addProduct(product));
ipcMain.handle('products:update', (_, product) => db.updateProduct(product));
ipcMain.handle('products:delete', (_, id) => db.deleteProduct(id));

// Customers
ipcMain.handle('customers:get', (_, filter) => db.getCustomers(filter));
ipcMain.handle('customers:getById', (_, id) => db.getCustomerById(id));
ipcMain.handle('customers:getPurchases', (_, id) => db.getCustomerPurchases(id));
ipcMain.handle('customers:add', (_, customer) => db.addCustomer(customer));
ipcMain.handle('customers:update', (_, customer) => db.updateCustomer(customer));
ipcMain.handle('customers:delete', (_, id) => db.deleteCustomer(id));
ipcMain.handle('customers:toggleActive', (_, { id, isActive }) => db.toggleCustomerActive(id, isActive));

// Suppliers
ipcMain.handle('suppliers:get', (_, filter) => db.getSuppliers(filter));
ipcMain.handle('suppliers:getById', (_, id) => db.getSupplierById(id));
ipcMain.handle('suppliers:getProducts', (_, id) => db.getSupplierProducts(id));
ipcMain.handle('suppliers:add', (_, supplier) => db.addSupplier(supplier));
ipcMain.handle('suppliers:update', (_, supplier) => db.updateSupplier(supplier));
ipcMain.handle('suppliers:delete', (_, id) => db.deleteSupplier(id));
ipcMain.handle('suppliers:toggleActive', (_, { id, isActive }) => db.toggleSupplierActive(id, isActive));

// Sales
ipcMain.handle('sales:add', (_, sale) => db.addSale(sale));
ipcMain.handle('sales:get', (_, range) => db.getSales(range));
ipcMain.handle('sales:getDetails', (_, id) => db.getSaleDetails(id));

// ✅ Clear all sales totals
ipcMain.handle('sales:clear', () => db.clearSales());

// Purchases
ipcMain.handle('purchases:add', (_, purchase) => db.addPurchase(purchase));
ipcMain.handle('purchases:get', (_, query) => db.getPurchases(query));
ipcMain.handle('purchases:getDetails', (_, id) => db.getPurchaseDetails(id));

// Stats
ipcMain.handle('stats:get', () => db.getStats());
ipcMain.handle('stats:getDashboard', (_, filter) => db.getDashboardStats(filter?.startDate, filter?.endDate));
