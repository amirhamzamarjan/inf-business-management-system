/* ====================================================================
   INFORMIX BD — Data Storage & State Management Layer
   Supabase Database Adapter + Reactive Event Bus + Draft Management
   ==================================================================== */

const Store = (() => {
  'use strict';

  const DRAFT_KEYS = {
    invoice: 'ix_invoice_draft',
    quotation: 'ix_quotation_draft',
    receipt: 'ix_receipt_draft',
    company_pad: 'ix_company_pad_draft',
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

  function getQuotationDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEYS.quotation)) || null; } catch { return null; }
  }
  function saveQuotationDraft(data) {
    try { localStorage.setItem(DRAFT_KEYS.quotation, JSON.stringify(data)); } catch (_) {}
  }
  function clearQuotationDraft() {
    try { localStorage.removeItem(DRAFT_KEYS.quotation); } catch (_) {}
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

  function getCompanyPadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEYS.company_pad)) || null; } catch { return null; }
  }
  function saveCompanyPadDraft(data) {
    try { localStorage.setItem(DRAFT_KEYS.company_pad, JSON.stringify(data)); } catch (_) {}
  }
  function clearCompanyPadDraft() {
    try { localStorage.removeItem(DRAFT_KEYS.company_pad); } catch (_) {}
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

  /* ---- Quotations Bridge ---- */
  const LOCAL_QUOTATIONS_KEY = 'ix_local_quotations';
  function getLocalQuotations() {
    try { return JSON.parse(localStorage.getItem(LOCAL_QUOTATIONS_KEY)) || []; } catch { return []; }
  }
  function saveLocalQuotations(list) {
    try { localStorage.setItem(LOCAL_QUOTATIONS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  async function getQuotations(filters = {}) {
    try {
      const fromDb = await SupabaseService.getQuotations(filters);
      if (fromDb && fromDb.length) return fromDb;
    } catch (_) {}
    // Fallback to local storage if DB table not yet created
    let list = getLocalQuotations();
    if (filters.status && filters.status !== 'All') {
      list = list.filter(q => q.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.trim().toLowerCase();
      list = list.filter(q => 
        (q.quotation_number && q.quotation_number.toLowerCase().includes(s)) ||
        (q.customer_name && q.customer_name.toLowerCase().includes(s)) ||
        (q.customer_phone && q.customer_phone.includes(s))
      );
    }
    return list;
  }

  async function getQuotation(id) {
    try {
      const fromDb = await SupabaseService.getQuotation(id);
      if (fromDb) return fromDb;
    } catch (_) {}
    return getLocalQuotations().find(q => q.id === id) || null;
  }

  async function generateQuotationNumber() {
    try {
      const num = await SupabaseService.getNextQuotationNumber();
      if (num) return num;
    } catch (_) {}
    const year = new Date().getFullYear();
    const count = getLocalQuotations().length + 1;
    return `QT-${year}-${String(count).padStart(6, '0')}`;
  }

  async function saveQuotation(quotationData, items = []) {
    let saved = null;
    try {
      saved = await SupabaseService.saveQuotation(quotationData, items);
    } catch (err) {
      console.warn('Supabase save quotation failed, saving locally:', err);
      const list = getLocalQuotations();
      const existingIdx = list.findIndex(q => q.id === quotationData.id);
      const profile = await SupabaseService.getCurrentProfile();
      saved = {
        ...quotationData,
        id: quotationData.id || `local-qt-${Date.now()}`,
        quotation_items: items,
        items: items,
        prepared_by_name: quotationData.prepared_by_name || (profile ? profile.full_name : 'Staff'),
        created_at: quotationData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        list[existingIdx] = saved;
      } else {
        list.unshift(saved);
      }
      saveLocalQuotations(list);
    }
    emit('quotations:updated', saved);
    return saved;
  }

  async function deleteQuotation(id) {
    let result = false;
    try {
      result = await SupabaseService.deleteQuotation(id);
    } catch (_) {
      const list = getLocalQuotations().filter(q => q.id !== id);
      saveLocalQuotations(list);
      result = true;
    }
    emit('quotations:updated', { deletedId: id });
    return result;
  }

  async function convertQuotationToInvoice(quotationId) {
    let result = null;
    try {
      result = await SupabaseService.convertQuotationToInvoice(quotationId);
    } catch (err) {
      console.warn('Supabase conversion failed, using store fallback:', err);
      const q = await getQuotation(quotationId);
      if (!q) throw new Error('Quotation not found');
      if (q.converted_invoice_id) throw new Error(`Quotation already converted to invoice ${q.converted_invoice_number}`);
      
      const invNumber = await generateInvoiceNumber();
      const invPayload = {
        invoice_number: invNumber,
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customer_id: q.customer_id,
        customer_name: q.customer_name,
        customer_phone: q.customer_phone,
        customer_address: q.customer_address,
        customer_email: q.customer_email,
        subtotal: q.subtotal,
        discount: q.discount,
        tax_percent: q.tax_percent,
        tax_amount: q.tax_amount,
        other_charges: q.other_charges,
        grand_total: q.grand_total,
        paid_amount: 0,
        due_amount: q.grand_total,
        payment_method: 'Cash',
        payment_status: 'Due',
        notes: q.notes,
        terms: q.terms,
        project_name: q.project_name || null,
        source_quotation_id: q.id,
      };
      const items = (q.quotation_items || q.items || []).map(it => ({
        description: it.description,
        qty: it.qty,
        rate: it.rate,
      }));
      const savedInvoice = await saveInvoice(invPayload, items);
      
      // Update quotation locally
      q.status = 'Converted to Invoice';
      q.converted_invoice_id = savedInvoice.id;
      q.converted_invoice_number = savedInvoice.invoice_number;
      await saveQuotation(q, items);
      
      result = {
        success: true,
        invoice_id: savedInvoice.id,
        invoice_number: savedInvoice.invoice_number,
        quotation_id: q.id,
      };
    }
    emit('quotations:updated', { convertedId: quotationId });
    emit('invoices:updated', { id: result.invoice_id });
    return result;
  }

  /* ---- Company Pads Bridge (Official Corporate Letterheads) ---- */
  const LOCAL_COMPANY_PADS_KEY = 'ix_local_company_pads';
  function getLocalCompanyPads() {
    try { return JSON.parse(localStorage.getItem(LOCAL_COMPANY_PADS_KEY)) || []; } catch { return []; }
  }
  function saveLocalCompanyPads(list) {
    try { localStorage.setItem(LOCAL_COMPANY_PADS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  async function syncLocalCompanyPads() {
    const list = getLocalCompanyPads();
    const unsynced = list.filter(p => !p.id || String(p.id).startsWith('local-pad-'));
    if (!unsynced.length) return;

    for (const pad of unsynced) {
      try {
        const uploaded = await SupabaseService.saveCompanyPad(pad);
        if (uploaded && uploaded.id) {
          const currentList = getLocalCompanyPads();
          const idx = currentList.findIndex(p => p.id === pad.id || p.pad_number === pad.pad_number);
          if (idx >= 0) {
            currentList[idx] = uploaded;
          } else {
            currentList.unshift(uploaded);
          }
          saveLocalCompanyPads(currentList);
        }
      } catch (err) {
        console.warn('Could not sync local pad to Supabase:', pad.pad_number, err);
      }
    }
  }

  async function getCompanyPads(filters = {}) {
    let fromDb = null;
    try {
      fromDb = await SupabaseService.getCompanyPads(filters);
    } catch (_) {}

    // When Supabase successfully returns an array, sync local pads in background and return cloud records
    if (fromDb !== null && Array.isArray(fromDb)) {
      syncLocalCompanyPads().catch(() => {});
      return fromDb;
    }

    // Fallback to local storage only if DB table not yet created or connection offline
    let list = getLocalCompanyPads();
    if (filters.status && filters.status !== 'All') {
      list = list.filter(p => p.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.trim().toLowerCase();
      list = list.filter(p =>
        (p.pad_number && p.pad_number.toLowerCase().includes(s)) ||
        (p.topic && p.topic.toLowerCase().includes(s)) ||
        (p.recipient_name && p.recipient_name.toLowerCase().includes(s)) ||
        (p.reference_no && p.reference_no.toLowerCase().includes(s))
      );
    }
    return list;
  }

  async function getCompanyPad(id) {
    try {
      const fromDb = await SupabaseService.getCompanyPad(id);
      if (fromDb) return fromDb;
    } catch (_) {}
    return getLocalCompanyPads().find(p => p.id === id) || null;
  }

  async function generatePadNumber() {
    try {
      const num = await SupabaseService.getNextPadNumber();
      if (num) return num;
    } catch (_) {}
    const year = new Date().getFullYear();
    const count = getLocalCompanyPads().length + 1;
    return `PAD-${year}-${String(count).padStart(6, '0')}`;
  }

  async function saveCompanyPad(padData) {
    let saved = null;
    try {
      saved = await SupabaseService.saveCompanyPad(padData);
      // Clean up local storage cache to match cloud
      const list = getLocalCompanyPads();
      const existingIdx = list.findIndex(p => p.id === padData.id || p.pad_number === saved.pad_number);
      if (existingIdx >= 0) {
        list[existingIdx] = saved;
      } else {
        list.unshift(saved);
      }
      saveLocalCompanyPads(list);
    } catch (err) {
      console.warn('Supabase save company pad failed, saving locally:', err);
      const list = getLocalCompanyPads();
      const existingIdx = list.findIndex(p => p.id === padData.id);
      const profile = await SupabaseService.getCurrentProfile();
      saved = {
        ...padData,
        id: (padData.id && String(padData.id).startsWith('local-pad-')) ? padData.id : `local-pad-${Date.now()}`,
        prepared_by_name: padData.prepared_by_name || (profile ? profile.full_name : 'Staff'),
        created_at: padData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_local_only: true,
      };
      if (existingIdx >= 0) {
        list[existingIdx] = saved;
      } else {
        list.unshift(saved);
      }
      saveLocalCompanyPads(list);
    }
    emit('company_pads:updated', saved);
    return saved;
  }

  async function deleteCompanyPad(id) {
    let result = false;
    try {
      result = await SupabaseService.deleteCompanyPad(id);
    } catch (_) {
      const list = getLocalCompanyPads().filter(p => p.id !== id);
      saveLocalCompanyPads(list);
      result = true;
    }
    emit('company_pads:updated', { deletedId: id });
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
    getQuotationDraft,
    saveQuotationDraft,
    clearQuotationDraft,
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
    // Quotations
    getQuotations,
    getQuotation,
    generateQuotationNumber,
    saveQuotation,
    deleteQuotation,
    convertQuotationToInvoice,
    // Company Pads
    getCompanyPadDraft,
    saveCompanyPadDraft,
    clearCompanyPadDraft,
    getCompanyPads,
    getCompanyPad,
    generatePadNumber,
    saveCompanyPad,
    deleteCompanyPad,
    syncLocalCompanyPads,
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
