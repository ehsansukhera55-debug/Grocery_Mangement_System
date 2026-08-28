// public/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  products: {
    get: () => ipcRenderer.invoke('products:get'),
    add: (product) => ipcRenderer.invoke('products:add', product),
    update: (product) => ipcRenderer.invoke('products:update', product),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
  },
  customers: {
    get: () => ipcRenderer.invoke('customers:get'),
    add: (c) => ipcRenderer.invoke('customers:add', c),
  },
  sales: {
    add: (sale) => ipcRenderer.invoke('sales:add', sale),
    get: (range) => ipcRenderer.invoke('sales:get', range),
    clear: () => ipcRenderer.invoke('sales:clear'),
  },
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
  },
  // convenience
  getProducts: () => ipcRenderer.invoke('products:get'),
  addProduct: (p) => ipcRenderer.invoke('products:add', p),
  updateProduct: (p) => ipcRenderer.invoke('products:update', p),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  getStats: () => ipcRenderer.invoke('stats:get'),
  clearSales: () => ipcRenderer.invoke('sales:clear'),
});
