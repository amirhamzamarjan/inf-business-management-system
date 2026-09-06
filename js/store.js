/* ====================================================================
   INFORMIX BD — Data Storage & State Management Layer
   Supabase Database Adapter + Reactive Event Bus + Draft Management
   ==================================================================== */

const Store = (() => {
  'use strict';

  const DRAFT_KEYS = {
    invoice: 'ix_invoice_draft',
    receipt: 'ix_receipt_draft',
    theme: 'ix_theme',
  };

  // Event bus for reactive UI updates
  const listeners = {};
  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return () => {
      listeners[event] = listeners[event].filter(fn => fn !== callback);
    };
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (err) { console.error('Listener error for event', event, err); }
    });
  }

  /* ---- Temporary Drafts (Permitted in LocalStorage) ---- */
  function getInvoiceDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEYS.invoice)) || null; } catch { return null; }
  }
  function saveInvoiceDraft(data) {
    try { localStorage.setItem(DRAFT_KEYS.invoice, JSON.stringify(data)); } catch (_) {}
  }
  function clearInvoiceDraft() {
    try { localStorage.removeItem(DRAFT_KEYS.invoice); } catch (_) {}
  }

  function getReceiptDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEYS.receipt)) || null; } catch { return null; }
  }
  function saveReceiptDraft(data) {
    try { localStorage.setItem(DRAFT_KEYS.receipt, JSON.stringify(data)); } catch (_) {}
  }
  function clearReceiptDraft() {
    try { localStorage.removeItem(DRAFT_KEYS.receipt); } catch (_) {}
  }

  /* ---- Settings Bridge ---- */
  async function getSettings() {
    return SupabaseService.getSettings();
  }
  async function saveSettings(partial) {
    const updated = await SupabaseService.updateSettings(partial);
    emit('settings:updated', updated);
    return updated;
  }

  /* ---- Customers Bridge ---- */
  async function getCustomers(searchQuery = '') {
    return SupabaseService.getCustomers(searchQuery);
  }
  async function getCustomer(id) {
    return SupabaseService.getCustomer(id);
  }
  async function saveCustomer(customerData) {
    const saved = await SupabaseService.saveCustomer(customerData);
    emit('customers:updated', saved);
    return saved;
  }
  async function deleteCustomer(id) {
    const result = await SupabaseService.deleteCustomer(id);
    emit('customers:updated', { deletedId: id });
    return result;
  }

  /* ---- Invoices Bridge ---- */
  async function getInvoices(filters = {}) {
    return SupabaseService.getInvoices(filters);
  }
  async function getInvoice(id) {
    return SupabaseService.getInvoice(id);
  }
  async function generateInvoiceNumber() {
    return SupabaseService.getNextInvoiceNumber();
  }
  async function saveInvoice(invoiceData, items = []) {
    const saved = await SupabaseService.saveInvoice(invoiceData, items);
    emit('invoices:updated', saved);
    return saved;
  }
  async function deleteInvoice(id) {
    const result = await SupabaseService.deleteInvoice(id);
    emit('invoices:updated', { deletedId: id });
    return result;
  }

  /* ---- Money Receipts Bridge ---- */
  async function getReceipts(filters = {}) {
    return SupabaseService.getReceipts(filters);
  }
  async function getReceipt(id) {
    return SupabaseService.getReceipt(id);
  }
  async function generateReceiptNumber() {
    return SupabaseService.getNextReceiptNumber();
  }
  async function saveReceipt(receiptData, items = []) {
    const saved = await SupabaseService.saveReceipt(receiptData, items);
    emit('receipts:updated', saved);
    return saved;
  }
  async function deleteReceipt(id) {
    const result = await SupabaseService.deleteReceipt(id);
    emit('receipts:updated', { deletedId: id });
    return result;
  }

  /* ---- Users Bridge (Super Admin) ---- */
  async function getUsers() {
    return SupabaseService.listUsers();
  }
  async function createUser(email, password, fullName, role) {
    const user = await SupabaseService.createManagedUser(email, password, fullName, role);
    emit('users:updated', user);
    return user;
  }
  async function updateUser(userId, updates) {
    const updated = await SupabaseService.updateProfile(userId, updates);
    emit('users:updated', updated);
    return updated;
  }
  async function toggleUserStatus(userId, newStatus) {
    const updated = await SupabaseService.toggleUserStatus(userId, newStatus);
    emit('users:updated', updated);
    return updated;
  }
  async function deleteUser(userId) {
    const result = await SupabaseService.deleteUser(userId);
    emit('users:updated', { deletedId: userId });
    return result;
  }

  /* ---- Activities Bridge ---- */
  async function getActivities(limit = 20) {
    return SupabaseService.getActivities(limit);
  }

  /* ---- Search Bridge ---- */
  async function search(query) {
    return SupabaseService.searchAll(query);
  }

  /* ---- Analytics Helpers (Computed from Real DB Data) ---- */
  async function getMonthlyAnalytics(months = 6) {
    const invoices = await SupabaseService.getInvoices();
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date || inv.created_at);
        return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth();
      });

      const revenue = monthInvoices.reduce((s, r) => s + (Number(r.grand_total) || 0), 0);
      const paid = monthInvoices.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0);
      const count = monthInvoices.length;

      result.push({
        label,
        ym,
        revenue,
        paid,
        pending: Math.max(0, revenue - paid),
        count,
      });
    }

    return result;
  }

  async function getPaymentMethodDistribution() {
    const invoices = await SupabaseService.getInvoices();
    const map = {};
    invoices.forEach(r => {
      const pm = r.payment_method || 'Cash';
      map[pm] = (map[pm] || 0) + (Number(r.paid_amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }

  async function getServiceDistribution() {
    const receipts = await SupabaseService.getReceipts();
    const map = {};
    receipts.forEach(r => {
      const st = r.service_type || 'General Service';
      map[st] = (map[st] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }

  return {
    on,
    emit,
    // Drafts
    getInvoiceDraft,
    saveInvoiceDraft,
    clearInvoiceDraft,
    getReceiptDraft,
    saveReceiptDraft,
    clearReceiptDraft,
    // Settings
    getSettings,
    saveSettings,
    // Customers
    getCustomers,
    getCustomer,
    saveCustomer,
    deleteCustomer,
    // Invoices
    getInvoices,
    getInvoice,
    generateInvoiceNumber,
    saveInvoice,
    deleteInvoice,
    // Receipts
    getReceipts,
    getReceipt,
    generateReceiptNumber,
    saveReceipt,
    deleteReceipt,
    // Users
    getUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    // Activities
    getActivities,
    // Search
    search,
    // Analytics
    getMonthlyAnalytics,
    getPaymentMethodDistribution,
    getServiceDistribution,
  };
})();

if (typeof window !== 'undefined') {
  window.Store = Store;
}
