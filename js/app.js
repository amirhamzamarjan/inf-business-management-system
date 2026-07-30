/* ============================================================
   INFORMIX BD — Main Application Controller
   All modules: Navigation, Dashboard, Receipt, Customers,
   Analytics, Search, Settings, Charts, PDF, Dark Mode
   ============================================================ */
(function () {
  'use strict';

  /* ===========================================================
     1. INIT
     =========================================================== */
  Store.seedIfEmpty();
  const I = Utils.Icons;                    // shorthand
  let currentPage = 'dashboard';
  let editingReceiptId = null;
  let draftTimer = null;

  /* ===========================================================
     2. NAVIGATION
     =========================================================== */
  const sidebarLinks = document.querySelectorAll('.sidebar__link');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  const pageMeta = {
    dashboard: { title: 'Dashboard', subtitle: "Welcome back. Here's your business overview." },
    receipt: { title: 'Receipt Generator', subtitle: 'Create professional money receipts.' },
    customers: { title: 'Customers', subtitle: 'Manage and view customer history.' },
    analytics: { title: 'Analytics', subtitle: 'Business performance insights.' },
    search: { title: 'Search', subtitle: 'Find receipts, customers, and more.' },
    settings: { title: 'Settings', subtitle: 'Configure your company information.' },
  };

  function navigateTo(page) {
    currentPage = page;
    pages.forEach(p => p.classList.remove('page--active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('page--active');
    sidebarLinks.forEach(l => l.classList.toggle('active', l.dataset.page === page));
    const meta = pageMeta[page] || {};
    if (pageTitle) pageTitle.textContent = meta.title || '';
    if (pageSubtitle) pageSubtitle.textContent = meta.subtitle || '';
    closeMobileSidebar();

    // Refresh page data
    if (page === 'dashboard') DashboardModule.render();
    if (page === 'receipt') ReceiptModule.renderList();
    if (page === 'customers') CustomersModule.render();
    if (page === 'analytics') AnalyticsModule.render();
    if (page === 'settings') SettingsModule.render();

    window.location.hash = page;
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Handle hash navigation
  function handleHash() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigateTo(hash);
  }
  window.addEventListener('hashchange', handleHash);

  // Mobile sidebar
  function openMobileSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('show'); }
  function closeMobileSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

  /* ===========================================================
     3. THEME (Dark Mode)
     =========================================================== */
  const themeToggle = document.getElementById('themeToggle');
  const mobileThemeBtn = document.getElementById('mobileThemeBtn');

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Store.saveSettings({ theme });
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', toggleTheme);

  // Load saved theme
  const savedSettings = Store.getSettings();
  if (savedSettings.theme) setTheme(savedSettings.theme);

  /* ===========================================================
     4. DASHBOARD MODULE
     =========================================================== */
  const DashboardModule = (() => {
    function getStats() {
      const now = new Date();
      const receipts = Store.getReceipts();
      const customers = Store.getCustomers();
      const thisMonth = receipts.filter(r => {
        const d = new Date(r.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const lastMonth = receipts.filter(r => {
        const d = new Date(r.createdAt);
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      });
      const today = receipts.filter(r => {
        const d = new Date(r.createdAt);
        return d.toDateString() === now.toDateString();
      });

      const totalRevenue = thisMonth.reduce((s, r) => s + (r.totalAmount || 0), 0);
      const lastMonthRevenue = lastMonth.reduce((s, r) => s + (r.totalAmount || 0), 0);
      const pendingPayments = thisMonth.reduce((s, r) => s + Math.max(0, (r.totalAmount || 0) - (r.amountPaid || 0)), 0);
      const completedJobs = thisMonth.filter(r => r.paymentStatus === 'Paid').length;
      const avgValue = thisMonth.length ? Math.round(totalRevenue / thisMonth.length) : 0;
      const growth = lastMonthRevenue ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : (totalRevenue > 0 ? 100 : 0);

      return [
        { label: 'Total Jobs', value: thisMonth.length, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', color: 'primary' },
        { label: 'Revenue', value: totalRevenue, prefix: '৳', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', color: 'success' },
        { label: 'Pending', value: pendingPayments, prefix: '৳', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color: 'warning' },
        { label: 'Completed', value: completedJobs, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', color: 'success' },
        { label: 'Customers', value: customers.length, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', color: 'info' },
        { label: 'Avg Value', value: avgValue, prefix: '৳', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>', color: 'primary' },
        { label: "Today's Jobs", value: today.length, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', color: 'info' },
        { label: 'Growth', value: growth, suffix: '%', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>', color: growth >= 0 ? 'success' : 'danger' },
      ];
    }

    function render() {
      const grid = document.getElementById('statsGrid');
      if (!grid) return;
      const stats = getStats();
      grid.innerHTML = stats.map((s, i) => `
        <div class="stat-card" style="animation-delay:${i * 60}ms">
          <div class="stat-card__top">
            <div class="stat-card__icon stat-card__icon--${s.color}">${s.icon}</div>
          </div>
          <div class="stat-card__label">${s.label}</div>
          <div class="stat-card__value" data-target="${s.value}" data-prefix="${s.prefix || ''}" data-suffix="${s.suffix || ''}">${s.prefix || ''}0${s.suffix || ''}</div>
        </div>`).join('');

      // Animate counters
      grid.querySelectorAll('.stat-card__value').forEach(el => {
        const target = parseInt(el.dataset.target) || 0;
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 1000;
        const startTime = performance.now();
        function tick(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(target * ease);
          el.textContent = prefix + current.toLocaleString() + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });

      renderActivity();
      renderTopCustomers();
      renderRecentReceipts();
    }

    function renderActivity() {
      const container = document.getElementById('activityTimeline');
      const countEl = document.getElementById('activityCount');
      if (!container) return;
      const activities = Store.getActivities().slice(0, 15);
      if (countEl) countEl.textContent = activities.length;
      if (!activities.length) {
        container.innerHTML = '<div class="search-empty"><p>No activities yet</p></div>';
        return;
      }
      container.innerHTML = activities.map((a, i) => `
        <div class="activity-item" style="animation-delay:${i * 50}ms">
          <div class="activity-item__dot activity-item__dot--${a.type || 'receipt'}"></div>
          <div class="activity-item__content">
            <div class="activity-item__text">${Utils.esc(a.message)}</div>
            <div class="activity-item__meta">
              <span>${Utils.timeAgo(a.timestamp)}</span>
              ${a.amount ? `<span class="activity-item__amount">${Utils.formatCurrency(a.amount)}</span>` : ''}
            </div>
          </div>
        </div>`).join('');
    }

    function renderTopCustomers() {
      const container = document.getElementById('topCustomersList');
      if (!container) return;
      const receipts = Store.getReceipts();
      const map = {};
      receipts.forEach(r => {
        const key = r.customerId || r.customerName;
        if (!key) return;
        if (!map[key]) map[key] = { name: r.customerName, phone: r.customerPhone, total: 0, count: 0 };
        map[key].total += r.totalAmount || 0;
        map[key].count++;
      });
      const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
      if (!sorted.length) {
        container.innerHTML = '<div class="search-empty"><p>No customers yet</p></div>';
        return;
      }
      container.innerHTML = sorted.map((c, i) => `
        <div class="top-customer-item">
          <div class="top-customer-item__rank top-customer-item__rank--${i + 1}">${i + 1}</div>
          <div class="top-customer-item__info">
            <div class="top-customer-item__name">${Utils.esc(c.name)}</div>
            <div class="top-customer-item__detail">${c.count} jobs</div>
          </div>
          <div class="top-customer-item__value">${Utils.formatCurrency(c.total)}</div>
        </div>`).join('');
    }

    function renderRecentReceipts() {
      const container = document.getElementById('recentReceiptsList');
      if (!container) return;
      const receipts = Store.getReceipts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
      if (!receipts.length) {
        container.innerHTML = '<div class="search-empty"><p>No receipts yet. <a href="#receipt">Create one</a></p></div>';
        return;
      }
      container.innerHTML = receipts.map(r => `
        <div class="receipt-list-item" onclick="App.previewReceipt('${r.id}')">
          <div class="receipt-list-item__left">
            <div class="receipt-list-item__number">${Utils.esc(r.receiptNumber || '—')}</div>
            <div class="receipt-list-item__customer">${Utils.esc(r.customerName || 'Unknown')}</div>
          </div>
          <div class="receipt-list-item__right">
            <div class="receipt-list-item__amount">${Utils.formatCurrency(r.totalAmount || 0)}</div>
            <div class="receipt-list-item__date">${Utils.formatDate(r.createdAt)}</div>
          </div>
        </div>`).join('');
    }

    return { render };
  })();

  /* ===========================================================
     5. RECEIPT MODULE
     =========================================================== */
  const ReceiptModule = (() => {
    const fields = {
      receiptNumber: 'rReceiptNumber',
      date: 'rDate',
      customerName: 'rCustomerName',
      customerPhone: 'rCustomerPhone',
      customerAddress: 'rCustomerAddress',
      serviceType: 'rServiceType',
      deviceName: 'rDeviceName',
      deviceModel: 'rDeviceModel',
      deviceSerial: 'rDeviceSerial',
      problemDescription: 'rProblem',
      workPerformed: 'rWorkDone',
      totalAmount: 'rAmount',
      discount: 'rDiscount',
      amountPaid: 'rAmountPaid',
      paymentMethod: 'rPaymentMethod',
      paymentStatus: 'rPaymentStatus',
      receivedBy: 'rReceivedBy',
      notes: 'rNotes',
    };

    let itemsData = [];

    /* ---- Item Row Management ---- */
    function renderItemRows() {
      const tbody = document.getElementById('itemsTableBody');
      if (!tbody) return;
      if (!itemsData.length) itemsData = [{ name: '', qty: 1, unitPrice: 0 }];
      tbody.innerHTML = itemsData.map((item, i) => `
        <tr class="item-row" data-index="${i}">
          <td class="it-sl-cell">${i + 1}</td>
          <td><input type="text" class="it-input item-name" value="${Utils.esc(item.name || '')}" placeholder="Product/Service name" data-idx="${i}"></td>
          <td><input type="number" class="it-input it-input--num item-qty" value="${item.qty || 1}" min="1" step="1" data-idx="${i}"></td>
          <td><input type="number" class="it-input it-input--num item-price" value="${item.unitPrice || 0}" min="0" step="1" data-idx="${i}"></td>
          <td class="it-total-cell">${Utils.formatCurrency((item.qty || 0) * (item.unitPrice || 0))}</td>
          <td class="it-action-cell">${itemsData.length > 1 ? `<button type="button" class="it-remove-btn" data-idx="${i}" title="Remove item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}</td>
        </tr>`).join('');

      // Bind input events for auto-calc
      tbody.querySelectorAll('.item-name, .item-qty, .item-price').forEach(input => {
        input.addEventListener('input', Utils.debounce(recalcItemRow, 150));
      });
      tbody.querySelectorAll('.it-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeItemRow(parseInt(btn.dataset.idx)));
      });

      recalcItemRow();
    }

    function recalcItemRow() {
      const tbody = document.getElementById('itemsTableBody');
      if (!tbody) return;
      let total = 0;
      tbody.querySelectorAll('.item-row').forEach((row, idx) => {
        const name = row.querySelector('.item-name')?.value?.trim() || '';
        const qty = parseInt(row.querySelector('.item-qty')?.value) || 1;
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
        const lineTotal = qty * price;
        total += lineTotal;
        row.querySelector('.it-total-cell').textContent = Utils.formatCurrency(lineTotal);

        if (!itemsData[idx]) itemsData[idx] = {};
        itemsData[idx].name = name;
        itemsData[idx].qty = qty;
        itemsData[idx].unitPrice = price;
        itemsData[idx].total = lineTotal;
      });
      // Update total amount field
      const rAmount = document.getElementById('rAmount');
      if (rAmount) rAmount.value = total.toString();
    }

    function addItemRow(name, qty, unitPrice) {
      itemsData.push({ name: name || '', qty: qty || 1, unitPrice: unitPrice || 0 });
      renderItemRows();
    }

    function removeItemRow(index) {
      if (itemsData.length <= 1) return;
      itemsData.splice(index, 1);
      renderItemRows();
    }

    function generateNew() {
      editingReceiptId = null;
      itemsData = [{ name: '', qty: 1, unitPrice: 0 }];
      Object.entries(fields).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) {
          if (key === 'receiptNumber') el.value = Store.generateReceiptNumber();
          else if (key === 'date') el.value = new Date().toISOString().split('T')[0];
          else if (key === 'discount' || key === 'amountPaid' || key === 'totalAmount') el.value = '0';
          else el.value = '';
        }
      });
      renderItemRows();
      Store.clearDraft();
      document.getElementById('draftIndicator').style.display = 'none';
    }

    function getFormData() {
      const data = {};
      Object.entries(fields).forEach(([key, id]) => {
        const el = document.getElementById(id);
        data[key] = el ? el.value.trim() : '';
      });
      data.totalAmount = parseFloat(data.totalAmount) || 0;
      data.discount = parseFloat(data.discount) || 0;
      data.amountPaid = parseFloat(data.amountPaid) || 0;
      data.id = editingReceiptId || null;
      // Collect items
      recalcItemRow();
      data.items = itemsData.filter(item => item.name || item.unitPrice > 0);
      return data;
    }

    function setFormData(data) {
      Object.entries(fields).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el && data[key] !== undefined) el.value = data[key];
      });
      if (data.id) editingReceiptId = data.id;
      // Restore items
      if (data.items && data.items.length) {
        itemsData = data.items.map(it => ({ name: it.name || '', qty: it.qty || 1, unitPrice: it.unitPrice || 0, total: (it.qty || 0) * (it.unitPrice || 0) }));
      } else {
        itemsData = [{ name: '', qty: 1, unitPrice: 0 }];
      }
      renderItemRows();
    }

    function save() {
      const data = getFormData();
      if (!data.customerName) { Utils.notify('Please enter customer name', 'warning'); return; }
      if (!data.totalAmount && !data.serviceType) { Utils.notify('Please add at least one service item or select a service type', 'warning'); return; }

      const saved = Store.saveReceipt(data);
      Utils.notify(editingReceiptId ? 'Receipt updated successfully!' : 'Receipt saved successfully!', 'success');
      editingReceiptId = null;
      Store.clearDraft();
      generateNew();
      renderList();
      return saved;
    }

    function renderList() {
      const container = document.getElementById('receiptsList');
      if (!container) return;
      const receipts = Store.getReceipts().slice().reverse();
      if (!receipts.length) {
        container.innerHTML = '<div class="search-empty"><p>No receipts yet. Create your first receipt above.</p></div>';
        return;
      }
      container.innerHTML = receipts.map(r => `
        <div class="receipt-list-item">
          <div class="receipt-list-item__left" onclick="App.previewReceipt('${r.id}')">
            <div class="receipt-list-item__number">${Utils.esc(r.receiptNumber || '—')}</div>
            <div class="receipt-list-item__customer">${Utils.esc(r.customerName || 'Unknown')} &middot; ${Utils.esc(r.serviceType || (r.items && r.items.length ? r.items[0].name : '') || '')}</div>
          </div>
          <div class="receipt-list-item__right">
            <div class="receipt-list-item__amount">${Utils.formatCurrency(r.totalAmount || 0)}</div>
            <div class="receipt-list-item__date">
              <span style="color:${r.paymentStatus === 'Paid' ? 'var(--success)' : r.paymentStatus === 'Due' ? 'var(--danger)' : 'var(--warning)'}">${r.paymentStatus || '—'}</span>
              &middot; ${Utils.formatDate(r.createdAt)}
            </div>
            <div style="margin-top:4px;display:flex;gap:2px;flex-wrap:wrap;justify-content:flex-end">
              <button class="btn btn--ghost btn--sm" onclick="App.editReceipt('${r.id}')" title="Edit" style="padding:2px 6px;font-size:0.7rem">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn--ghost btn--sm" onclick="App.deleteReceipt('${r.id}')" title="Delete" style="padding:2px 6px;font-size:0.7rem;color:var(--danger)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              <button class="btn btn--ghost btn--sm" onclick="App.printReceipt('${r.id}')" title="Print" style="padding:2px 6px;font-size:0.7rem">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </button>
              <button class="btn btn--ghost btn--sm" onclick="App.downloadPDF('${r.id}')" title="Download PDF" style="padding:2px 6px;font-size:0.7rem;color:var(--primary)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </button>
            </div>
          </div>
        </div>`).join('');
    }

    // Auto-save draft
    function setupDraft() {
      Object.values(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', Utils.debounce(() => {
            const data = getFormData();
            data._editingId = editingReceiptId;
            Store.saveDraft(data);
            const indicator = document.getElementById('draftIndicator');
            if (indicator) { indicator.style.display = 'inline'; indicator.textContent = 'Draft saved'; }
          }, 2000));
        }
      });
      // Also listen to item table changes
      const itemsBody = document.getElementById('itemsTableBody');
      if (itemsBody) {
        itemsBody.addEventListener('input', Utils.debounce(() => {
          const data = getFormData();
          data._editingId = editingReceiptId;
          Store.saveDraft(data);
          const indicator = document.getElementById('draftIndicator');
          if (indicator) { indicator.style.display = 'inline'; indicator.textContent = 'Draft saved'; }
        }, 2000));
      }
    }

    // Auto-update payment status
    function setupAutoStatus() {
      const amt = document.getElementById('rAmount');
      const paid = document.getElementById('rAmountPaid');
      const status = document.getElementById('rPaymentStatus');
      function update() {
        const a = parseFloat(amt?.value) || 0;
        const p = parseFloat(paid?.value) || 0;
        if (status) {
          if (p >= a && a > 0) status.value = 'Paid';
          else if (p > 0) status.value = 'Partial';
          else status.value = 'Due';
        }
      }
      if (amt) amt.addEventListener('input', update);
      if (paid) paid.addEventListener('input', update);
    }

    // Load draft
    function loadDraft() {
      const draft = Store.getDraft();
      if (draft) {
        setFormData(draft);
        if (draft._editingId) editingReceiptId = draft._editingId;
        const indicator = document.getElementById('draftIndicator');
        if (indicator) { indicator.style.display = 'inline'; indicator.textContent = 'Draft restored'; }
      } else {
        generateNew();
      }
    }

    return { generateNew, getFormData, setFormData, save, renderList, setupDraft, setupAutoStatus, loadDraft, addItemRow, removeItemRow, renderItemRows };
  })();

  /* ===========================================================
     6. RECEIPT PREVIEW & PDF
     =========================================================== */
  function buildReceiptHTML(receipt, isPrint) {
    const s = Store.getSettings();
    const logoSrc = s.logo || 'assets/logo.svg';
    const terms = (s.terms || []).map(t => `<li>${Utils.esc(t)}</li>`).join('');
    const discount = receipt.discount || 0;
    const paid = receipt.amountPaid || 0;

    // Calculate totals from items if available, else from receipt fields
    const items = receipt.items && receipt.items.length ? receipt.items : null;
    const subtotal = items ? items.reduce((sum, it) => sum + ((it.qty || 0) * (it.unitPrice || 0)), 0) : (receipt.totalAmount || 0);
    const total = subtotal - discount;
    const due = Math.max(0, total - paid);

    // Build description block
    let descBlock = '';
    const descItems = [];
    if (receipt.deviceName) descItems.push(`<div class="print-receipt__desc-line"><span class="print-receipt__desc-label">Device:</span> ${Utils.esc(receipt.deviceName)}</div>`);
    if (receipt.deviceModel) descItems.push(`<div class="print-receipt__desc-line"><span class="print-receipt__desc-label">Model:</span> ${Utils.esc(receipt.deviceModel)}</div>`);
    if (receipt.deviceSerial) descItems.push(`<div class="print-receipt__desc-line"><span class="print-receipt__desc-label">Serial:</span> ${Utils.esc(receipt.deviceSerial)}</div>`);
    if (receipt.problemDescription) descItems.push(`<div class="print-receipt__desc-line"><span class="print-receipt__desc-label">Problem:</span> ${Utils.esc(receipt.problemDescription)}</div>`);
    if (receipt.workPerformed) descItems.push(`<div class="print-receipt__desc-line"><span class="print-receipt__desc-label">Work Done:</span> ${Utils.esc(receipt.workPerformed)}</div>`);
    if (descItems.length) {
      descBlock = `<div class="print-receipt__desc-block">${descItems.join('')}</div>`;
    }

    // Build item table rows (multi-item or single-item fallback)
    let tableRows = '';
    if (items) {
      tableRows = items.map((it, i) => {
        const lineTotal = (it.qty || 0) * (it.unitPrice || 0);
        return `<tr><td class="it-sl-cell">${i + 1}</td><td>${Utils.esc(it.name || 'Item ' + (i + 1))}</td><td class="it-qty-cell">${it.qty || 1}</td><td class="it-price-cell">${Utils.formatCurrency(it.unitPrice || 0)}</td><td class="it-total-cell">${Utils.formatCurrency(lineTotal)}</td></tr>`;
      }).join('');
    } else {
      // Backward compat: single service row
      tableRows = `<tr><td colspan="4">${Utils.esc(receipt.serviceType || 'Service Charge')}${receipt.workPerformed ? ' — ' + Utils.esc(receipt.workPerformed) : ''}</td><td class="it-total-cell">${Utils.formatCurrency(subtotal)}</td></tr>`;
    }

    const tableHeader = items
      ? '<thead><tr><th class="it-sl">#</th><th>Description</th><th class="it-qty">Qty</th><th class="it-price">Unit Price</th><th class="it-total">Total</th></tr></thead>'
      : '<thead><tr><th colspan="4">Description</th><th>Amount</th></tr></thead>';

    return `<div class="print-receipt ${isPrint ? '' : 'preview'}">
      <div class="print-receipt__header">
        <img src="${logoSrc}" alt="Logo" class="print-receipt__logo" onerror="this.style.display='none'">
        <div class="print-receipt__company">${Utils.esc(s.companyName || 'INFORMIX BD')}</div>
        <div class="print-receipt__tagline">${Utils.esc(s.tagline || 'Security & Surveillance Solutions')}</div>
        <div class="print-receipt__contact">
          ${Utils.esc(s.address || '')} ${s.phone ? '&middot; ' + Utils.esc(s.phone) : ''} ${s.email ? '<br>' + Utils.esc(s.email) : ''} ${s.website ? ' &middot; ' + Utils.esc(s.website) : ''}
        </div>
      </div>

      <div class="print-receipt__meta">
        <div class="print-receipt__meta-box">
          <p class="print-receipt__meta-label">Receipt To</p>
          <p class="print-receipt__meta-value">${Utils.esc(receipt.customerName || '—')}</p>
          ${receipt.customerPhone ? `<p style="margin:1px 0;font-size:9pt;color:#475569">${Utils.esc(receipt.customerPhone)}</p>` : ''}
          ${receipt.customerAddress ? `<p style="margin:1px 0;font-size:9pt;color:#64748b">${Utils.esc(receipt.customerAddress)}</p>` : ''}
        </div>
        <div class="print-receipt__meta-box print-receipt__receipt-num">
          <p class="print-receipt__meta-label">Receipt No.</p>
          <p class="print-receipt__meta-value">${Utils.esc(receipt.receiptNumber || '—')}</p>
          <p class="print-receipt__meta-label" style="margin-top:8pt">Date</p>
          <p class="print-receipt__meta-value">${Utils.formatDate(receipt.createdAt)}</p>
        </div>
      </div>

      <div class="print-receipt__section">
        <div class="print-receipt__section-title">Service Details</div>
        <div class="print-receipt__info-grid">
          <div class="print-receipt__info-row">
            <span class="print-receipt__info-label">Service:</span>
            <span class="print-receipt__info-value">${Utils.esc(receipt.serviceType || '—')}</span>
          </div>
          <div class="print-receipt__info-row">
            <span class="print-receipt__info-label">Received By:</span>
            <span class="print-receipt__info-value">${Utils.esc(receipt.receivedBy || '—')}</span>
          </div>
          <div class="print-receipt__info-row">
            <span class="print-receipt__info-label">Payment:</span>
            <span class="print-receipt__info-value">${Utils.esc(receipt.paymentMethod || 'Cash')}</span>
          </div>
          <div class="print-receipt__info-row">
            <span class="print-receipt__info-label">Status:</span>
            <span class="print-receipt__info-value" style="color:${receipt.paymentStatus === 'Paid' ? '#16a34a' : receipt.paymentStatus === 'Due' ? '#dc2626' : '#d97706'}">${Utils.esc(receipt.paymentStatus || '—')}</span>
          </div>
        </div>
        ${descBlock}
      </div>

      <table class="print-receipt__table">
        ${tableHeader}
        <tbody>${tableRows}</tbody>
      </table>

      <div class="print-receipt__totals">
        <div class="print-receipt__totals-table">
          <div class="print-receipt__totals-row">
            <span class="print-receipt__totals-label">Subtotal</span>
            <span class="print-receipt__totals-value">${Utils.formatCurrency(subtotal)}</span>
          </div>
          ${discount > 0 ? `<div class="print-receipt__totals-row">
            <span class="print-receipt__totals-label">Discount</span>
            <span class="print-receipt__totals-value">-${Utils.formatCurrency(discount)}</span>
          </div>` : ''}
          <div class="print-receipt__totals-row print-receipt__totals-row--total">
            <span>Total</span>
            <span>${Utils.formatCurrency(total)}</span>
          </div>
          <div class="print-receipt__totals-row print-receipt__totals-row--paid">
            <span class="print-receipt__totals-label">Amount Paid</span>
            <span class="print-receipt__totals-value">${Utils.formatCurrency(paid)}</span>
          </div>
          ${due > 0 ? `<div class="print-receipt__totals-row print-receipt__totals-row--due">
            <span class="print-receipt__totals-label">Due Amount</span>
            <span class="print-receipt__totals-value">${Utils.formatCurrency(due)}</span>
          </div>` : ''}
        </div>
      </div>

      ${receipt.notes ? `<div style="margin-top:14pt;font-size:9pt;color:#64748b"><strong>Notes:</strong> ${Utils.esc(receipt.notes)}</div>` : ''}

      <div class="print-receipt__signatures">
        <div class="print-receipt__signature">
          <div class="print-receipt__signature-line">Authorized Signature</div>
        </div>
        <div class="print-receipt__signature">
          <div class="print-receipt__signature-line">Customer Signature</div>
        </div>
      </div>

      ${terms ? `<div class="print-receipt__terms">
        <div class="print-receipt__terms-title">Terms & Conditions</div>
        <ol class="print-receipt__terms-list">${terms}</ol>
      </div>` : ''}

      <div class="print-receipt__footer">
        ${Utils.esc(s.companyName || 'INFORMIX BD')} &middot; ${Utils.esc(s.address || '')} &middot; ${Utils.esc(s.phone || '')} &middot; ${Utils.esc(s.email || '')}
      </div>
    </div>`;
  }

  function showPreview(receipt) {
    const modal = document.getElementById('receiptModal');
    const content = document.getElementById('receiptPreviewContent');
    if (!modal || !content) return;
    content.innerHTML = buildReceiptHTML(receipt, false);
    modal.style.display = 'flex';
  }

  function printReceipt(id) {
    const receipt = id ? Store.getReceipt(id) : null;
    if (!receipt) { Utils.notify('Receipt not found', 'error'); return; }
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = buildReceiptHTML(receipt, true);
    setTimeout(() => {
      window.print();
      setTimeout(() => { printArea.innerHTML = ''; }, 1000);
    }, 300);
  }

  // Download PDF (separate from Print — uses jsPDF + autoTable)
  // ---- PDF Generation (jsPDF + autoTable) ----

  // Convert number to Bengali Taka words
  function numberToWords(n) {
    if (n === 0) return 'Zero Taka Only';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
      'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function c(v) {
      if (v < 20) return ones[v];
      if (v < 100) return tens[Math.floor(v / 10)] + (v % 10 ? ' ' + ones[v % 10] : '');
      if (v < 1000) return ones[Math.floor(v / 100)] + ' Hundred' + (v % 100 ? ' ' + c(v % 100) : '');
      if (v < 100000) return c(Math.floor(v / 1000)) + ' Thousand' + (v % 1000 ? ' ' + c(v % 1000) : '');
      if (v < 10000000) return c(Math.floor(v / 100000)) + ' Lakh' + (v % 100000 ? ' ' + c(v % 100000) : '');
      return c(Math.floor(v / 10000000)) + ' Crore' + (v % 10000000 ? ' ' + c(v % 10000000) : '');
    }
    return c(Math.round(n)) + ' Taka Only';
  }

  // Get logo data URL synchronously
  function getLogoData() {
    const s = Store.getSettings();
    if (s.logo && s.logo.startsWith('data:')) return s.logo;
    try {
      const img = document.getElementById('sidebarLogo');
      if (img && img.complete && img.naturalHeight > 0) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/png');
      }
    } catch (_) {}
    return null;
  }

  // Generate premium A4 PDF using jsPDF + autoTable
  function generatePDFReceipt(receipt) {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      Utils.notify('PDF library is loading — please try again', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const s = Store.getSettings();

    // Layout constants
    const PW = 210, PH = 297, MG = 18, CW = PW - 2 * MG;
    const CLR = {
      cyan: [0, 204, 255],
      red: [255, 0, 4],
      dark: [0, 0, 0],
      muted: [107, 114, 128],
      lightBg: [248, 250, 252],
      border: [229, 231, 235],
      white: [255, 255, 255],
      signatureLine: [209, 213, 219],
    };
    const FONT = 'helvetica';

    // Currency helper
    const cur = (v) => '৳ ' + (Number(v) || 0).toLocaleString('en-BD');

    // Text splitter
    const split = (t, w) => doc.splitTextToSize(t || '', w || CW);

    const logo = getLogoData();

    // ===== DRAW PAGE HEADER (compact for subsequent pages) =====
    function drawCompactHeader(pg) {
      if (logo) { try { doc.addImage(logo, 'PNG', MG, MG, 22, 9); } catch (_) {} }
      doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...CLR.dark);
      doc.text(s.companyName || 'INFORMIX BD', PW - MG, MG + 4, { align: 'right' });
      doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...CLR.muted);
      let yy = MG + 8;
      if (s.phone) { doc.text(s.phone, PW - MG, yy, { align: 'right' }); yy += 3.5; }
      if (s.email) { doc.text(s.email, PW - MG, yy, { align: 'right' }); yy += 3.5; }

      doc.setDrawColor(...CLR.border); doc.setLineWidth(0.5);
      const divY = Math.max(MG + 14, MG + 28);
      doc.line(MG, divY, PW - MG, divY);

      if (pg > 1) {
        doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...CLR.dark);
        doc.text('MONEY RECEIPT', PW / 2, divY + 10, { align: 'center' });
        doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...CLR.muted);
        doc.text(receipt.receiptNumber || '', PW - MG, divY + 10, { align: 'right' });
        return divY + 18;
      }
      return divY;
    }

    // ===== FIRST PAGE — Full Header =====
    const hdrBottom = drawCompactHeader(1);

    // Watermark
    doc.setGState(new doc.GState({ opacity: 0.04 }));
    doc.setFont(FONT, 'bold'); doc.setFontSize(50); doc.setTextColor(...CLR.cyan);
    doc.text('INFORMIX BD', PW / 2, PH / 2, { align: 'center', angle: -25 });
    doc.setGState(new doc.GState({ opacity: 1 }));

    // Document title
    const tY = hdrBottom + 14;
    doc.setFont(FONT, 'bold'); doc.setFontSize(18); doc.setTextColor(...CLR.dark);
    doc.text('MONEY RECEIPT', PW / 2, tY, { align: 'center' });

    // Receipt number
    doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...CLR.muted);
    doc.text('Receipt No.', PW - MG, tY - 3, { align: 'right' });
    doc.setFont(FONT, 'bold'); doc.setFontSize(10); doc.setTextColor(...CLR.dark);
    doc.text(receipt.receiptNumber || '—', PW - MG, tY + 3, { align: 'right' });

    // Date & time
    const dtStr = receipt.createdAt
      ? Utils.formatDate(receipt.createdAt) + ' at ' + new Date(receipt.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '';
    doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...CLR.muted);
    doc.text('Date & Time', MG, tY + 10);
    doc.setFont(FONT, 'bold'); doc.setFontSize(9); doc.setTextColor(...CLR.dark);
    doc.text(dtStr || '—', MG, tY + 16);

    // ===== CUSTOMER SECTION (two cards) =====
    const cY = tY + 28;
    const cW = CW / 2 - 4;
    // Left card
    doc.setDrawColor(...CLR.border); doc.setFillColor(...CLR.lightBg);
    doc.roundedRect(MG, cY, cW, 28, 2, 2, 'FD');
    doc.setFont(FONT, 'bold'); doc.setFontSize(7); doc.setTextColor(...CLR.cyan);
    doc.text('CUSTOMER', MG + 8, cY + 8);
    doc.setFont(FONT, 'bold'); doc.setFontSize(10); doc.setTextColor(...CLR.dark);
    doc.text(receipt.customerName || '—', MG + 8, cY + 17);
    doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...CLR.muted);
    doc.text(receipt.customerPhone || '', MG + 8, cY + 24);

    // Right card
    const cX = PW / 2 + 4;
    doc.roundedRect(cX, cY, cW, 28, 2, 2, 'FD');
    doc.setFont(FONT, 'bold'); doc.setFontSize(7); doc.setTextColor(...CLR.cyan);
    doc.text('PAYMENT', cX + 8, cY + 8);
    doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...CLR.dark);
    const aLines = split(receipt.customerAddress, cW - 16);
    doc.text(aLines, cX + 8, cY + 17);
    doc.setFont(FONT, 'bold'); doc.setFontSize(8); doc.setTextColor(...CLR.dark);
    doc.text('Method:', cX + 8, cY + 24);
    doc.setFont(FONT, 'normal');
    doc.text(' ' + (receipt.paymentMethod || 'Cash'), cX + 18, cY + 24);

    // ===== ITEMS TABLE (autoTable with multi-page) =====
    const tblTop = cY + 36;

    const items = receipt.items && receipt.items.length
      ? receipt.items
      : [{ name: receipt.serviceType || 'Service Charge', qty: 1, unitPrice: receipt.totalAmount || 0 }];

    const bodyRows = items.map((it, i) => [
      String(i + 1),
      it.name || '',
      String(it.qty || 1),
      cur(it.unitPrice || 0),
      cur((it.qty || 1) * (it.unitPrice || 0)),
    ]);

    const subtotal = items.reduce((s, it) => s + ((it.qty || 1) * (it.unitPrice || 0)), 0);
    const discount = receipt.discount || 0;
    const grandTotal = subtotal - discount;
    const paid = receipt.amountPaid || 0;
    const due = Math.max(0, grandTotal - paid);

    // Header height for subsequent pages
    const SUB_HEADER = 38;

    doc.autoTable({
      startY: tblTop,
      tableWidth: CW,
      margin: { left: MG, right: MG, top: SUB_HEADER },
      head: [[
        { content: 'SL', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Description' },
        { content: 'Qty', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Unit Price', styles: { halign: 'right', cellWidth: 28 } },
        { content: 'Total', styles: { halign: 'right', cellWidth: 28 } },
      ]],
      body: bodyRows,
      headStyles: {
        fillColor: CLR.cyan, textColor: CLR.white, fontStyle: 'bold',
        fontSize: 7.5, lineColor: CLR.cyan,
      },
      bodyStyles: { fontSize: 8, textColor: CLR.dark, lineColor: CLR.border, lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
      },
      rowPageBreak: 'avoid',
      pageBreak: 'auto',
      didDrawPage: function (d) {
        // Compact header on every page
        drawCompactHeader(d.pageNumber);
        // Footer
        doc.setDrawColor(...CLR.border); doc.setLineWidth(0.3);
        doc.line(MG, PH - MG - 14, PW - MG, PH - MG - 14);
        doc.setFont(FONT, 'normal'); doc.setFontSize(6); doc.setTextColor(...CLR.muted);
        doc.text('Thank you for choosing ' + (s.companyName || 'INFORMIX BD'), PW / 2, PH - MG - 9, { align: 'center' });
        doc.text('Page ' + d.pageNumber + ' / {tp}', PW - MG, PH - MG - 3, { align: 'right' });
        if (s.website) doc.text(s.website, MG, PH - MG - 3);
        doc.text((s.phone || '') + '  |  ' + (s.email || ''), MG, PH - MG - 10);
      },
    });

    // Resolve total-pages placeholder
    let totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      const pg = doc.internal.pages[i];
      if (pg) {
        const str = (Array.isArray(pg) ? pg.join('\n') : pg);
        const replaced = str.replace(/\{tp\}/g, String(totalPages));
        doc.internal.pages[i] = replaced.split('\n');
      }
    }

    // ===== FINANCIAL SUMMARY (after table) =====
    let fy = doc.lastAutoTable.finalY || tblTop;
    const summaryH = 58;

    if (fy + summaryH + 15 > PH - MG - 18) {
      doc.addPage();
      totalPages = doc.internal.getNumberOfPages();
      drawCompactHeader(totalPages);
      fy = MG + 30;
    }

    const sw = 78;
    const sx = PW - MG - sw;
    fy += 6;

    // Summary card
    doc.setDrawColor(...CLR.border); doc.setFillColor(...CLR.lightBg);
    doc.roundedRect(sx, fy, sw, summaryH, 2, 2, 'FD');

    let sy = fy + 10;
    const sumItem = (label, val, clr, bold, sz) => {
      doc.setFont(FONT, bold ? 'bold' : 'normal');
      doc.setFontSize(sz || 9); doc.setTextColor(...(clr || CLR.muted));
      doc.text(label, sx + 10, sy);
      doc.text(val, sx + sw - 10, sy, { align: 'right' });
      sy += 7;
    };

    sumItem('Subtotal', cur(subtotal), CLR.muted);
    if (discount > 0) sumItem('Discount', '- ' + cur(discount), CLR.dark);
    sy += 1;
    doc.setDrawColor(...CLR.cyan); doc.setLineWidth(0.5);
    doc.line(sx + 10, sy - 2, sx + sw - 10, sy - 2);
    sumItem('Grand Total', cur(grandTotal), CLR.red, true, 11);
    sy += 1;
    sumItem('Paid', cur(paid), CLR.dark, true);
    if (due > 0) sumItem('Due', cur(due), CLR.red, true);

    // ===== AMOUNT IN WORDS =====
    const awY = fy + summaryH + 10;
    const words = numberToWords(grandTotal);

    doc.setDrawColor(...CLR.border); doc.setFillColor(255, 255, 255);
    doc.roundedRect(MG, awY, CW, 20, 2, 2, 'FD');
    doc.setFont(FONT, 'bold'); doc.setFontSize(7); doc.setTextColor(...CLR.cyan);
    doc.text('AMOUNT IN WORDS', MG + 10, awY + 8);
    doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...CLR.dark);
    doc.text(words, MG + 10, awY + 16);

    // ===== NOTES =====
    const nY = awY + 28;
    if (receipt.notes) {
      doc.setFont(FONT, 'bold'); doc.setFontSize(7); doc.setTextColor(...CLR.cyan);
      doc.text('NOTES', MG, nY);
      doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...CLR.dark);
      const noteLines = split(receipt.notes, CW);
      doc.text(noteLines, MG, nY + 8);
    }

    // ===== SIGNATURES =====
    const sigEstimate = receipt.notes ? nY + 16 + (split(receipt.notes, CW).length * 5 || 20) : nY + 10;
    const sigY = Math.max(sigEstimate, fy + summaryH + 72);

    const drawSignatures = (y) => {
      const colW = (CW - 40) / 3;
      const labels = ['Customer Signature', 'Prepared By', 'Authorized Signature'];
      labels.forEach((label, i) => {
        const x = MG + (colW + 20) * i;
        doc.setDrawColor(...CLR.signatureLine); doc.setLineWidth(0.5);
        doc.line(x, y + 20, x + colW, y + 20);
        doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(...CLR.muted);
        doc.text(label, x + colW / 2, y + 28, { align: 'center' });
      });
    };

    const checkSpace = (y, needed) => y + needed < PH - MG - 14;

    if (checkSpace(sigY, 40)) {
      drawSignatures(sigY);
    } else {
      doc.addPage();
      const newTotal = doc.internal.getNumberOfPages();
      drawCompactHeader(newTotal);
      drawSignatures(MG + 30);
    }

    // ===== GENERATED ON INFO =====
    const genStr = 'Generated on: ' + new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    doc.setFont(FONT, 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CLR.muted);
    doc.text(genStr, MG, PH - MG - 5);

    // ===== SAVE =====
    doc.save((receipt.receiptNumber || 'receipt') + '.pdf');
    Utils.notify('PDF downloaded successfully', 'success');
  }

  function downloadPDF(id) {
    const receipt = id ? Store.getReceipt(id) : null;
    if (!receipt) { Utils.notify('Receipt not found', 'error'); return; }
    generatePDFReceipt(receipt);
  }

  /* ===========================================================
     7. CUSTOMERS MODULE
     =========================================================== */
  const CustomersModule = (() => {
    let filterText = '';

    function render() {
      if (document.getElementById('customerDetailView').style.display !== 'none') return; // Don't re-render if detail is open
      const grid = document.getElementById('customersGrid');
      if (!grid) return;
      const customers = Store.getCustomers();
      const receipts = Store.getReceipts();

      let filtered = customers;
      if (filterText) {
        const q = filterText.toLowerCase();
        filtered = customers.filter(c => [c.name, c.phone, c.address].filter(Boolean).join(' ').toLowerCase().includes(q));
      }

      if (!filtered.length) {
        grid.innerHTML = '<div class="search-empty" style="grid-column:1/-1"><p>No customers found</p></div>';
        return;
      }

      grid.innerHTML = filtered.map(c => {
        const custReceipts = receipts.filter(r => r.customerId === c.id);
        const totalPayments = custReceipts.reduce((s, r) => s + (r.amountPaid || 0), 0);
        const totalDue = custReceipts.reduce((s, r) => s + Math.max(0, (r.totalAmount || 0) - (r.amountPaid || 0)), 0);
        const lastDate = custReceipts.length ? custReceipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt : null;

        return `<div class="customer-card" onclick="App.viewCustomer('${c.id}')">
          <div class="customer-card__name">${Utils.esc(c.name)}</div>
          <div class="customer-card__phone">${Utils.esc(c.phone || 'No phone')}</div>
          <div class="customer-card__address">${Utils.esc(c.address || '')}</div>
          <div class="customer-card__stats">
            <div><span class="customer-card__stat-label">Jobs</span><span class="customer-card__stat-value">${custReceipts.length}</span></div>
            <div><span class="customer-card__stat-label">Paid</span><span class="customer-card__stat-value">${Utils.formatCurrency(totalPayments)}</span></div>
            <div><span class="customer-card__stat-label">Due</span><span class="customer-card__stat-value" style="color:${totalDue > 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.formatCurrency(totalDue)}</span></div>
          </div>
          ${lastDate ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">Last service: ${Utils.formatDate(lastDate)}</div>` : ''}
        </div>`;
      }).join('');
    }

    function viewDetail(customerId) {
      const customer = Store.getCustomer(customerId);
      if (!customer) return;
      const receipts = Store.getReceiptsByCustomer(customerId);
      const totalPaid = receipts.reduce((s, r) => s + (r.amountPaid || 0), 0);
      const totalDue = receipts.reduce((s, r) => s + Math.max(0, (r.totalAmount || 0) - (r.amountPaid || 0)), 0);
      const totalAmount = receipts.reduce((s, r) => s + (r.totalAmount || 0), 0);

      document.getElementById('customerListView').style.display = 'none';
      const detailView = document.getElementById('customerDetailView');
      detailView.style.display = 'block';

      const initials = (customer.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

      document.getElementById('customerDetailContent').innerHTML = `
        <div class="customer-detail__header">
          <div class="customer-detail__avatar">${initials}</div>
          <div class="customer-detail__info">
            <h2>${Utils.esc(customer.name)}</h2>
            <p>${Utils.esc(customer.phone || '')}</p>
            <p>${Utils.esc(customer.address || '')}</p>
          </div>
        </div>
        <div class="customer-detail__stats">
          <div class="customer-stat-card"><div class="customer-stat-card__label">Total Jobs</div><div class="customer-stat-card__value">${receipts.length}</div></div>
          <div class="customer-stat-card"><div class="customer-stat-card__label">Total Amount</div><div class="customer-stat-card__value">${Utils.formatCurrency(totalAmount)}</div></div>
          <div class="customer-stat-card"><div class="customer-stat-card__label">Paid</div><div class="customer-stat-card__value" style="color:var(--success)">${Utils.formatCurrency(totalPaid)}</div></div>
          <div class="customer-stat-card"><div class="customer-stat-card__label">Pending Due</div><div class="customer-stat-card__value" style="color:var(--danger)">${Utils.formatCurrency(totalDue)}</div></div>
        </div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">Receipt History</h3></div>
          <div class="card__body card__body--scroll">
            ${receipts.length ? receipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(r => `
              <div class="receipt-list-item" onclick="App.previewReceipt('${r.id}')">
                <div class="receipt-list-item__left">
                  <div class="receipt-list-item__number">${Utils.esc(r.receiptNumber || '—')}</div>
                  <div class="receipt-list-item__customer">${Utils.esc(r.serviceType || '')} &middot; ${Utils.esc(r.deviceName || '')}</div>
                </div>
                <div class="receipt-list-item__right">
                  <div class="receipt-list-item__amount">${Utils.formatCurrency(r.totalAmount || 0)}</div>
                  <div class="receipt-list-item__date">${Utils.formatDate(r.createdAt)}</div>
                </div>
              </div>`).join('') : '<div class="search-empty"><p>No receipts found</p></div>'}
          </div>
        </div>`;
    }

    function backToList() {
      document.getElementById('customerListView').style.display = 'block';
      document.getElementById('customerDetailView').style.display = 'none';
      render();
    }

    return { render, viewDetail, backToList, setFilter: (t) => { filterText = t; render(); } };
  })();

  /* ===========================================================
     8. ANALYTICS MODULE (Canvas Charts)
     =========================================================== */
  const AnalyticsModule = (() => {
    let period = 6;

    function getCanvasCtx(id) {
      const canvas = document.getElementById(id);
      if (!canvas) return null;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 280 * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = '280px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      return { ctx, w: rect.width, h: 280 };
    }

    const colors = {
      primary: '#4f46e5',
      primaryLight: 'rgba(79,70,229,0.1)',
      success: '#10b981',
      successLight: 'rgba(16,185,129,0.1)',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#0ea5e9',
      purple: '#8b5cf6',
      pink: '#ec4899',
      gray: '#94a3b8',
      bg: '#f8fafc',
      text: '#64748b',
      line: '#e2e8f0',
      palette: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f97316', '#6366f1'],
    };

    function drawLineChart(canvasId, data, opts = {}) {
      const c = getCanvasCtx(canvasId);
      if (!c) return;
      const { ctx, w, h } = c;
      const pad = { top: 30, right: 20, bottom: 40, left: 55 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;

      const values = data.map(d => d.value);
      const maxVal = Math.max(...values, 1) * 1.15;

      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();

        // Y labels
        const val = Math.round(maxVal - (maxVal / 4) * i);
        ctx.fillStyle = colors.text;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(opts.prefix ? opts.prefix + val.toLocaleString() : val.toLocaleString(), pad.left - 8, y + 4);
      }

      // X labels
      ctx.fillStyle = colors.text;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      data.forEach((d, i) => {
        const x = pad.left + (chartW / (data.length - 1 || 1)) * i;
        ctx.fillText(d.label, x, h - 10);
      });

      if (values.length < 2) return;

      // Area fill
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = pad.left + (chartW / (data.length - 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(pad.left + chartW, pad.top + chartH);
      ctx.lineTo(pad.left, pad.top + chartH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      grad.addColorStop(0, opts.areaColor || 'rgba(79,70,229,0.12)');
      grad.addColorStop(1, 'rgba(79,70,229,0.01)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = pad.left + (chartW / (data.length - 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = opts.lineColor || colors.primary;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Dots
      data.forEach((d, i) => {
        const x = pad.left + (chartW / (data.length - 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = opts.lineColor || colors.primary;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    function drawBarChart(canvasId, data, opts = {}) {
      const c = getCanvasCtx(canvasId);
      if (!c) return;
      const { ctx, w, h } = c;
      const pad = { top: 30, right: 20, bottom: 40, left: 50 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;

      const values = data.map(d => d.value);
      const maxVal = Math.max(...values, 1) * 1.15;
      const barW = Math.min(30, (chartW / data.length) * 0.6);
      const gap = (chartW - barW * data.length) / (data.length + 1);

      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        const val = Math.round(maxVal - (maxVal / 4) * i);
        ctx.fillStyle = colors.text;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val.toLocaleString(), pad.left - 8, y + 4);
      }

      // Bars
      data.forEach((d, i) => {
        const x = pad.left + gap + (barW + gap) * i;
        const barH = (d.value / maxVal) * chartH;
        const y = pad.top + chartH - barH;
        const radius = 4;

        ctx.beginPath();
        ctx.moveTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
        ctx.lineTo(x + barW, pad.top + chartH);
        ctx.lineTo(x, pad.top + chartH);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, y, 0, pad.top + chartH);
        const color = opts.colors ? opts.colors[i % opts.colors.length] : colors.primary;
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + '40');
        ctx.fillStyle = grad;
        ctx.fill();

        // X label
        ctx.fillStyle = colors.text;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x + barW / 2, h - 10);
      });
    }

    function drawDonut(canvasId, data, opts = {}) {
      const c = getCanvasCtx(canvasId);
      if (!c) return;
      const { ctx, w, h } = c;
      const total = data.reduce((s, d) => s + d.value, 0) || 1;
      const cx = w / 2 - 40;
      const cy = h / 2;
      const outerR = Math.min(cx - 10, cy - 10, 90);
      const innerR = outerR * 0.6;

      ctx.clearRect(0, 0, w, h);

      let startAngle = -Math.PI / 2;
      data.forEach((d, i) => {
        const sliceAngle = (d.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors.palette[i % colors.palette.length];
        ctx.fill();
        startAngle += sliceAngle;
      });

      // Center text
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(total.toLocaleString(), cx, cy + 2);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = colors.text;
      ctx.fillText(opts.centerLabel || 'Total', cx, cy + 18);

      // Legend
      const legendX = w / 2 + 50;
      let legendY = 30;
      data.forEach((d, i) => {
        ctx.fillStyle = colors.palette[i % colors.palette.length];
        ctx.fillRect(legendX, legendY - 6, 10, 10);
        ctx.fillStyle = '#1e293b';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(d.name, legendX + 16, legendY + 3);
        ctx.fillStyle = colors.text;
        ctx.fillText(` (${d.value.toLocaleString()})`, legendX + 16 + ctx.measureText(d.name).width + 4, legendY + 3);
        legendY += 22;
      });
    }

    function drawHorizontalBar(canvasId, data) {
      const c = getCanvasCtx(canvasId);
      if (!c) return;
      const { ctx, w, h } = c;
      const pad = { top: 10, right: 60, bottom: 10, left: 120 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;
      const maxVal = Math.max(...data.map(d => d.value), 1);
      const barH = Math.min(28, (chartH / data.length) * 0.7);
      const gap = (chartH - barH * data.length) / (data.length + 1);

      ctx.clearRect(0, 0, w, h);

      data.slice(0, 8).forEach((d, i) => {
        const y = pad.top + gap + (barH + gap) * i;
        const barW = (d.value / maxVal) * chartW;

        // Label
        ctx.fillStyle = '#475569';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(d.name.length > 16 ? d.name.slice(0, 16) + '…' : d.name, pad.left - 8, y + barH / 2 + 4);

        // Bar
        const grad = ctx.createLinearGradient(pad.left, 0, pad.left + barW, 0);
        const color = colors.palette[i % colors.palette.length];
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + '80');
        ctx.beginPath();
        const r = 4;
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + barW - r, y);
        ctx.arcTo(pad.left + barW, y, pad.left + barW, y + r, r);
        ctx.arcTo(pad.left + barW, y + barH, pad.left + barW - r, y + barH, r);
        ctx.lineTo(pad.left, y + barH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Value
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(d.value, pad.left + barW + 6, y + barH / 2 + 4);
      });
    }

    function render() {
      const data = Store.getMonthlyRevenue(period);

      drawLineChart('revenueChart', data.map(d => ({ label: d.label, value: d.revenue })), { prefix: '৳', lineColor: colors.primary, areaColor: 'rgba(79,70,229,0.12)' });
      drawBarChart('jobsChart', data.map(d => ({ label: d.label, value: d.count })));
      drawDonut('paymentChart', Store.getPaymentMethodDistribution(), { centerLabel: 'Payments' });

      // Status chart
      const receipts = Store.getReceipts();
      const statusData = [
        { name: 'Paid', value: receipts.filter(r => r.paymentStatus === 'Paid').length },
        { name: 'Partial', value: receipts.filter(r => r.paymentStatus === 'Partial').length },
        { name: 'Due', value: receipts.filter(r => r.paymentStatus === 'Due').length },
      ].filter(d => d.value > 0);
      drawDonut('statusChart', statusData, { centerLabel: 'Receipts' });

      drawHorizontalBar('servicesChart', Store.getServiceDistribution());
    }

    return { render, setPeriod: (p) => { period = p; render(); } };
  })();

  /* ===========================================================
     9. SEARCH MODULE
     =========================================================== */
  const SearchModule = (() => {
    let filterType = 'all';
    function search(query) {
      const container = document.getElementById('searchResults');
      if (!container) return;
      if (!query.trim()) {
        container.innerHTML = `<div class="search-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p>Type to search across all receipts and customers</p>
          <span class="search-hint">Tip: Press Ctrl+K from anywhere to open search</span>
        </div>`;
        return;
      }
      const results = Store.search(query);
      const filtered = filterType === 'all' ? results : results.filter(r => r.type === filterType);

      if (!filtered.length) {
        container.innerHTML = `<div class="search-empty"><p>No results found for "${Utils.esc(query)}"</p></div>`;
        return;
      }

      const receipts = filtered.filter(r => r.type === 'receipt');
      const customers = filtered.filter(r => r.type === 'customer');

      let html = '';
      if (receipts.length) {
        html += '<div class="search-results__section-title">Receipts</div>';
        html += receipts.map(r => `
          <div class="search-results__item" onclick="App.previewReceipt('${r.data.id}')">
            <div class="search-results__item-header">
              <span class="search-results__item-number">${Utils.esc(r.data.receiptNumber || '—')}</span>
              <span class="search-results__item-type">${Utils.esc(r.data.serviceType || '')}</span>
            </div>
            <div class="search-results__item-name">${Utils.esc(r.data.customerName || 'Unknown')}</div>
            <div class="search-results__item-detail">${Utils.formatCurrency(r.data.totalAmount || 0)} &middot; ${Utils.formatDate(r.data.createdAt)} &middot; ${r.data.paymentStatus || ''}</div>
          </div>`).join('');
      }
      if (customers.length) {
        html += '<div class="search-results__section-title">Customers</div>';
        html += customers.map(r => `
          <div class="search-results__item" onclick="App.viewCustomer('${r.data.id}')">
            <div class="search-results__item-header">
              <span class="search-results__item-number">${Utils.esc(r.data.name)}</span>
              <span class="search-results__item-type">Customer</span>
            </div>
            <div class="search-results__item-detail">${Utils.esc(r.data.phone || '')} &middot; ${Utils.esc(r.data.address || '')}</div>
          </div>`).join('');
      }
      container.innerHTML = html;
    }
    return { search, setFilter: (t) => { filterType = t; } };
  })();

  /* ===========================================================
     10. SETTINGS MODULE
     =========================================================== */
  const SettingsModule = (() => {
    function render() {
      const s = Store.getSettings();
      document.getElementById('sCompanyName').value = s.companyName || '';
      document.getElementById('sTagline').value = s.tagline || '';
      document.getElementById('sAddress').value = s.address || '';
      document.getElementById('sPhone').value = s.phone || '';
      document.getElementById('sEmail').value = s.email || '';
      document.getElementById('sWebsite').value = s.website || '';
      document.getElementById('sReceiptPrefix').value = s.receiptPrefix || 'INF';
      document.getElementById('sTerms').value = (s.terms || []).join('\n');
      if (s.logo) document.getElementById('settingsLogoImg').src = s.logo;
    }

    function save() {
      const data = {
        companyName: document.getElementById('sCompanyName').value.trim(),
        tagline: document.getElementById('sTagline').value.trim(),
        address: document.getElementById('sAddress').value.trim(),
        phone: document.getElementById('sPhone').value.trim(),
        email: document.getElementById('sEmail').value.trim(),
        website: document.getElementById('sWebsite').value.trim(),
        receiptPrefix: document.getElementById('sReceiptPrefix').value.trim() || 'INF',
        terms: document.getElementById('sTerms').value.split('\n').map(l => l.trim()).filter(Boolean),
      };
      Store.saveSettings(data);
      Utils.notify('Settings saved successfully!', 'success');
    }

    function setupLogoUpload() {
      const fileInput = document.getElementById('logoFileInput');
      const uploadBtn = document.getElementById('uploadLogoBtn');
      if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
      if (fileInput) fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) { Utils.notify('Logo file too large (max 500KB)', 'warning'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          Store.saveSettings({ logo: dataUrl });
          document.getElementById('settingsLogoImg').src = dataUrl;
          Utils.notify('Logo updated!', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    return { render, save, setupLogoUpload };
  })();

  /* ===========================================================
     11. EXTRA FEATURES
     =========================================================== */

  // Export all receipts to ZIP
  function exportAllReceipts() {
    const receipts = Store.getReceipts();
    if (!receipts.length) { Utils.notify('No receipts to export', 'warning'); return; }
    const files = receipts.map(r => ({
      name: `${r.receiptNumber || r.id}.html`,
      content: buildReceiptHTML(r, true),
    }));
    files.push({ name: 'data.json', content: Store.exportAll() });
    const zip = Utils.createZip(files);
    Utils.downloadBlob(zip, `informix-receipts-${new Date().toISOString().split('T')[0]}.zip`);
    Utils.notify(`Exported ${receipts.length} receipts as ZIP`, 'success');
  }

  // Download monthly report
  function downloadMonthlyReport() {
    const data = Store.getMonthlyRevenue(12);
    let csv = 'Month,Revenue,Paid,Pending,Jobs\n';
    data.forEach(d => { csv += `${d.label},${d.revenue},${d.paid},${d.pending},${d.count}\n`; });
    Utils.downloadFile(csv, `informix-report-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    Utils.notify('Monthly report downloaded', 'success');
  }

  // Backup & Restore
  function exportBackup() {
    const data = Store.exportAll();
    Utils.downloadFile(data, `informix-backup-${new Date().toISOString().split('T')[0]}.json`);
    Utils.notify('Backup exported!', 'success');
  }
  function importBackup() { document.getElementById('importFileInput').click(); }
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (Store.importAll(ev.target.result)) {
        Utils.notify('Data restored successfully!', 'success');
        navigateTo(currentPage);
      } else {
        Utils.notify('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
  }
  function clearAllData() {
    if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
      localStorage.clear();
      Utils.notify('All data cleared', 'success');
      navigateTo('dashboard');
    }
  }

  /* ===========================================================
     12. EVENT BINDINGS
     =========================================================== */
  function initEvents() {
    // Receipt form
    const form = document.getElementById('receiptForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        ReceiptModule.save();
      });
    }

    const previewBtn = document.getElementById('receiptPreview');
    if (previewBtn) previewBtn.addEventListener('click', () => {
      const data = ReceiptModule.getFormData();
      data.createdAt = data.createdAt || new Date().toISOString();
      if (!data.receiptNumber) data.receiptNumber = Store.generateReceiptNumber();
      showPreview(data);
    });

    const resetBtn = document.getElementById('receiptReset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (confirm('Reset form? Unsaved changes will be lost.')) {
        ReceiptModule.generateNew();
        Utils.notify('Form reset', 'info');
      }
    });

    // Add item row button
    const addItemBtn = document.getElementById('addItemRow');
    if (addItemBtn) addItemBtn.addEventListener('click', () => ReceiptModule.addItemRow());

    // Modal
    const modalClose = document.getElementById('modalClose');
    const receiptModal = document.getElementById('receiptModal');
    if (modalClose) modalClose.addEventListener('click', () => { receiptModal.style.display = 'none'; });
    if (receiptModal) receiptModal.addEventListener('click', (e) => { if (e.target === receiptModal) receiptModal.style.display = 'none'; });

    const modalPrint = document.getElementById('modalPrint');
    if (modalPrint) modalPrint.addEventListener('click', () => {
      const printContent = document.querySelector('#receiptPreviewContent .print-receipt');
      if (!printContent) return;
      const printArea = document.getElementById('printArea');
      printArea.innerHTML = printContent.outerHTML;
      receiptModal.style.display = 'none';
      setTimeout(() => {
        window.print();
        setTimeout(() => { printArea.innerHTML = ''; }, 1000);
      }, 300);
    });

    const modalDownloadPDF = document.getElementById('modalDownloadPDF');
    if (modalDownloadPDF) modalDownloadPDF.addEventListener('click', () => {
      const receiptId = receiptModal.dataset.receiptId;
      if (receiptId) { receiptModal.style.display = 'none'; downloadPDF(receiptId); }
      else {
        // PDF from unsaved preview data
        const data = ReceiptModule.getFormData();
        data.createdAt = new Date().toISOString();
        if (!data.receiptNumber) data.receiptNumber = Store.generateReceiptNumber();
        receiptModal.style.display = 'none';
        generatePDFReceipt(data);
      }
    });

    // Customer search
    const custSearch = document.getElementById('customerSearchInput');
    if (custSearch) custSearch.addEventListener('input', Utils.debounce((e) => {
      CustomersModule.setFilter(e.target.value);
    }, 300));

    const custBack = document.getElementById('customerBackBtn');
    if (custBack) custBack.addEventListener('click', () => CustomersModule.backToList());

    // Search page
    const searchInput = document.getElementById('searchPageInput');
    if (searchInput) searchInput.addEventListener('input', Utils.debounce((e) => {
      SearchModule.search(e.target.value);
    }, 250));
    document.querySelectorAll('.search-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.search-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SearchModule.setFilter(btn.dataset.type);
        const input = document.getElementById('searchPageInput');
        if (input && input.value) SearchModule.search(input.value);
      });
    });

    // Global search
    const globalInput = document.getElementById('globalSearchInput');
    if (globalInput) {
      globalInput.addEventListener('focus', () => { navigateTo('search'); setTimeout(() => document.getElementById('searchPageInput')?.focus(), 100); });
    }

    // Analytics period
    document.querySelectorAll('.analytics-period .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.analytics-period .btn').forEach(b => { b.classList.remove('btn--active'); b.classList.add('btn--ghost'); });
        btn.classList.add('btn--active');
        btn.classList.remove('btn--ghost');
        AnalyticsModule.setPeriod(parseInt(btn.dataset.period) || 6);
      });
    });

    // Settings
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', (e) => { e.preventDefault(); SettingsModule.save(); });
    SettingsModule.setupLogoUpload();

    // Data management
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportBackup);
    const importBtn = document.getElementById('importDataBtn');
    if (importBtn) importBtn.addEventListener('click', importBackup);
    const importInput = document.getElementById('importFileInput');
    if (importInput) importInput.addEventListener('change', handleImport);
    const clearBtn = document.getElementById('clearDataBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllData);

    // Export ZIP
    const exportAllBtn = document.getElementById('exportAllReceipts');
    if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllReceipts);

    // Monthly report
    const reportBtn = document.getElementById('downloadMonthlyReport');
    if (reportBtn) reportBtn.addEventListener('click', downloadMonthlyReport);

    // Shortcuts modal
    const shortcutsBtn = document.getElementById('shortcutsBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const shortcutsClose = document.getElementById('shortcutsClose');
    if (shortcutsBtn) shortcutsBtn.addEventListener('click', () => { shortcutsModal.style.display = 'flex'; });
    if (shortcutsClose) shortcutsClose.addEventListener('click', () => { shortcutsModal.style.display = 'none'; });
    if (shortcutsModal) shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) shortcutsModal.style.display = 'none'; });

    // Backup button in sidebar
    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) backupBtn.addEventListener('click', exportBackup);

    // Keyboard shortcuts
    Utils.registerShortcut('Ctrl+1', () => navigateTo('dashboard'), 'Dashboard');
    Utils.registerShortcut('Ctrl+2', () => navigateTo('receipt'), 'Receipt Generator');
    Utils.registerShortcut('Ctrl+3', () => navigateTo('customers'), 'Customers');
    Utils.registerShortcut('Ctrl+4', () => navigateTo('analytics'), 'Analytics');
    Utils.registerShortcut('Ctrl+K', () => navigateTo('search'), 'Search');
    Utils.registerShortcut('Ctrl+,', () => navigateTo('settings'), 'Settings');
    Utils.registerShortcut('Ctrl+N', () => { navigateTo('receipt'); ReceiptModule.generateNew(); }, 'New Receipt');
    Utils.registerShortcut('Ctrl+S', () => { if (currentPage === 'receipt') { ReceiptModule.save(); } }, 'Save Receipt');
    Utils.registerShortcut('Ctrl+P', () => {
      if (currentPage === 'receipt') {
        const data = ReceiptModule.getFormData();
        if (!data.customerName || !data.totalAmount) { Utils.notify('Fill in receipt details first', 'warning'); return; }
        data.createdAt = data.createdAt || new Date().toISOString();
        if (!data.receiptNumber) data.receiptNumber = Store.generateReceiptNumber();
        const printArea = document.getElementById('printArea');
        printArea.innerHTML = buildReceiptHTML(data, true);
        setTimeout(() => { window.print(); setTimeout(() => { printArea.innerHTML = ''; }, 1000); }, 300);
      }
    }, 'Print Receipt');
    Utils.registerShortcut('Ctrl+B', () => toggleTheme(), 'Toggle Dark Mode');
    Utils.registerShortcut('Esc', () => {
      const receiptModal = document.getElementById('receiptModal');
      const shortcutsModal = document.getElementById('shortcutsModal');
      if (receiptModal && receiptModal.style.display !== 'none') receiptModal.style.display = 'none';
      else if (shortcutsModal && shortcutsModal.style.display !== 'none') shortcutsModal.style.display = 'none';
    }, 'Close Modal');
    Utils.initShortcuts();
  }

  /* ===========================================================
     13. INIT
     =========================================================== */
  function init() {
    initEvents();
    ReceiptModule.loadDraft();
    ReceiptModule.setupDraft();
    ReceiptModule.setupAutoStatus();
    handleHash();
    if (!window.location.hash) navigateTo('dashboard');
  }

  /* ===========================================================
     14. PUBLIC API (called from inline onclick)
     =========================================================== */
  window.App = {
    previewReceipt: (id) => {
      const receipt = Store.getReceipt(id);
      if (receipt) {
        const modal = document.getElementById('receiptModal');
        if (modal) modal.dataset.receiptId = id;
        showPreview(receipt);
      }
    },
    printReceipt: (id) => printReceipt(id),
    downloadPDF: (id) => downloadPDF(id),
    editReceipt: (id) => {
      const receipt = Store.getReceipt(id);
      if (!receipt) return;
      editingReceiptId = id;
      ReceiptModule.setFormData(receipt);
      navigateTo('receipt');
      Utils.notify('Editing receipt ' + (receipt.receiptNumber || ''), 'info');
    },
    deleteReceipt: (id) => {
      if (!confirm('Delete this receipt?')) return;
      Store.deleteReceipt(id);
      Utils.notify('Receipt deleted', 'success');
      ReceiptModule.renderList();
      if (currentPage === 'dashboard') DashboardModule.render();
    },
    viewCustomer: (id) => {
      navigateTo('customers');
      setTimeout(() => CustomersModule.viewDetail(id), 100);
    },
  };

  // Boot
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
