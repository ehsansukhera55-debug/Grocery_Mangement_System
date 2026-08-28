// main.js — Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require(path.join(__dirname, 'public', 'db-main.js'));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });


 if (!app.isPackaged) {
    // In dev, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from dist folder
    const indexPath = path.join(__dirname, 'index.html');
    console.log('Loading index.html from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

}


app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ----------------------------
   IPC HANDLERS
-----------------------------*/
ipcMain.handle('products:get', () => db.getProducts());
ipcMain.handle('products:add', (_, product) => db.addProduct(product));
ipcMain.handle('products:update', (_, product) => db.updateProduct(product));
ipcMain.handle('products:delete', (_, id) => db.deleteProduct(id));

ipcMain.handle('customers:get', () => db.getCustomers());
ipcMain.handle('customers:add', (_, c) => db.addCustomer(c));

ipcMain.handle('sales:add', (_, sale) => db.addSale(sale));
ipcMain.handle('stats:get', () => db.getStats());
