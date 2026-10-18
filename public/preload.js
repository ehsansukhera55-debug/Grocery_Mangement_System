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
    get: (filter) => ipcRenderer.invoke('customers:get', filter),
    getById: (id) => ipcRenderer.invoke('customers:getById', id),
    getPurchases: (id) => ipcRenderer.invoke('customers:getPurchases', id),
    add: (c) => ipcRenderer.invoke('customers:add', c),
    update: (c) => ipcRenderer.invoke('customers:update', c),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
    toggleActive: (id, isActive) => ipcRenderer.invoke('customers:toggleActive', { id, isActive }),
  },
  suppliers: {
    get: (filter) => ipcRenderer.invoke('suppliers:get', filter),
    getById: (id) => ipcRenderer.invoke('suppliers:getById', id),
    getProducts: (id) => ipcRenderer.invoke('suppliers:getProducts', id),
    add: (s) => ipcRenderer.invoke('suppliers:add', s),
    update: (s) => ipcRenderer.invoke('suppliers:update', s),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
    toggleActive: (id, isActive) => ipcRenderer.invoke('suppliers:toggleActive', { id, isActive }),
  },
  sales: {
    add: (sale) => ipcRenderer.invoke('sales:add', sale),
    get: (range) => ipcRenderer.invoke('sales:get', range),
    getDetails: (id) => ipcRenderer.invoke('sales:getDetails', id),
    clear: () => ipcRenderer.invoke('sales:clear'),
  },
  purchases: {
    add: (purchase) => ipcRenderer.invoke('purchases:add', purchase),
    get: (query) => ipcRenderer.invoke('purchases:get', query),
    getDetails: (id) => ipcRenderer.invoke('purchases:getDetails', id),
  },
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
    getDashboard: (filter) => ipcRenderer.invoke('stats:getDashboard', filter),
  },
  // convenience aliases
  getProducts: () => ipcRenderer.invoke('products:get'),
  addProduct: (p) => ipcRenderer.invoke('products:add', p),
  updateProduct: (p) => ipcRenderer.invoke('products:update', p),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  getStats: () => ipcRenderer.invoke('stats:get'),
  getDashboardStats: (filter) => ipcRenderer.invoke('stats:getDashboard', filter),
  clearSales: () => ipcRenderer.invoke('sales:clear'),
});
