// public/electron-main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db-main'); // Database handler

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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const prodIndex = path.join(__dirname, '../dist/index.html');

  if (devServerUrl) {
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
ipcMain.handle('customers:get', () => db.getCustomers());
ipcMain.handle('customers:add', (_, customer) => db.addCustomer(customer));

// Sales / Purchases
ipcMain.handle('sales:add', (_, sale) => db.addSale(sale));
ipcMain.handle('sales:get', (_, { start, end }) => db.getSales(start, end));

// ✅ Clear all sales totals
ipcMain.handle('sales:clear', () => db.clearSales());

// Stats
ipcMain.handle('stats:get', () => db.getStats());
