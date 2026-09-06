/* ====================================================================
   INFORMIX BD — Main Application Controller
   Modular Architecture: Auth, User Management, Fast Invoice Generator,
   Money Receipts, Customers, Analytics, Minimal Luxury PDF & Print Engine
   ==================================================================== */

(function () {
  'use strict';

  // Application Global State
  let currentUser = null;
  let currentProfile = null;
  let currentPage = 'dashboard';
  let editingInvoiceId = null;
  let editingReceiptId = null;

  /* ==================================================================
     1. AUTHENTICATION MODULE
     ================================================================== */
  const AuthModule = (() => {
    let isSetupMode = false;

    function init() {
      const authForm = document.getElementById('authForm');
      const authModeToggle = document.getElementById('authModeToggle');
      const togglePasswordBtn = document.getElementById('togglePasswordBtn');
      const logoutBtn = document.getElementById('logoutBtn');

      const authConfigToggle = document.getElementById('authConfigToggle');
      const authSaveConfigBtn = document.getElementById('authSaveConfigBtn');

      if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
      }

      if (authModeToggle) {
        authModeToggle.addEventListener('click', toggleSetupMode);
      }

      if (authConfigToggle) {
        authConfigToggle.addEventListener('click', toggleAuthConfigSection);
      }

      if (authSaveConfigBtn) {
        authSaveConfigBtn.addEventListener('click', saveInlineConfig);
      }

      if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
      }

      // Supabase Auth State Listener
      SupabaseService.onAuthStateChange((event, session, profile) => {
        if (session && profile) {
          onUserLoggedIn(session.user, profile);
        } else {
          onUserLoggedOut();
        }
      });

      // Initial session check
      checkInitialSession();
    }

    async function checkInitialSession() {
      try {
        const session = await SupabaseService.getSession();
        if (session && session.user) {
          const profile = await SupabaseService.getCurrentProfile();
          if (profile && profile.status !== 'inactive') {
            onUserLoggedIn(session.user, profile);
            return;
          }
        }
      } catch (err) {
        console.warn('Initial session check error:', err);
      }
      onUserLoggedOut();
    }

    async function handleAuthSubmit(e) {
      e.preventDefault();
      const emailInput = document.getElementById('authEmail');
      const passwordInput = document.getElementById('authPassword');
      const nameInput = document.getElementById('authFullName');
      const submitBtn = document.getElementById('authSubmitBtn');
      const alertBox = document.getElementById('authAlert');

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const fullName = nameInput ? nameInput.value.trim() : '';

      alertBox.style.display = 'none';
      setButtonLoading(submitBtn, true);

      try {
        if (isSetupMode) {
          if (!fullName) throw new Error('Please enter your full name');
          await SupabaseService.signUp(email, password, fullName, 'super_admin');
          Utils.notify('Super Admin account created successfully!', 'success');
          // Sign in directly
          await SupabaseService.signIn(email, password);
        } else {
          await SupabaseService.signIn(email, password);
          Utils.notify('Welcome back to INFORMIX BD', 'success');
        }
      } catch (err) {
        console.error('Auth error:', err);
        let msg = err.message || 'Authentication failed. Please verify credentials.';
        if (msg.includes('Failed to fetch')) {
          msg = 'Failed to connect to Supabase. Please verify your Project URL and Anon Key.';
          toggleAuthConfigSection(true);
        }
        alertBox.textContent = msg;
        alertBox.style.display = 'block';
      } finally {
        setButtonLoading(submitBtn, false);
      }
    }

    function toggleAuthConfigSection(show) {
      const sec = document.getElementById('authConfigSection');
      if (!sec) return;
      const isVisible = typeof show === 'boolean' ? show : sec.style.display !== 'none';
      sec.style.display = isVisible && typeof show !== 'boolean' ? 'none' : 'block';

      if (sec.style.display !== 'none') {
        const cfg = SupabaseService.getConfig();
        const urlInput = document.getElementById('authSupabaseUrl');
        const keyInput = document.getElementById('authSupabaseKey');
        if (urlInput) urlInput.value = cfg.url || '';
        if (keyInput) keyInput.value = cfg.anonKey || '';
      }
    }

    function saveInlineConfig() {
      const url = document.getElementById('authSupabaseUrl')?.value.trim();
      const key = document.getElementById('authSupabaseKey')?.value.trim();
      if (!url || !key) {
        Utils.notify('Please enter both Supabase URL and Anon Key', 'warning');
        return;
      }
      SupabaseService.saveConfig(url, key);
      Utils.notify('Supabase project connected successfully!', 'success');
      const sec = document.getElementById('authConfigSection');
      if (sec) sec.style.display = 'none';
      const alertBox = document.getElementById('authAlert');
      if (alertBox) alertBox.style.display = 'none';
    }

    function toggleSetupMode() {
      isSetupMode = !isSetupMode;
      const title = document.getElementById('authCardTitle');
      const subtitle = document.getElementById('authCardSubtitle');
      const nameGroup = document.getElementById('authNameGroup');
      const emailLabel = document.getElementById('authEmailLabel');
      const submitBtn = document.getElementById('authSubmitBtn');
      const toggleLink = document.getElementById('authModeToggle');
      const alertBox = document.getElementById('authAlert');

      alertBox.style.display = 'none';

      if (isSetupMode) {
        title.textContent = 'Initial Super Admin Setup';
        subtitle.textContent = 'Create the first Super Admin account for your company';
        nameGroup.style.display = 'block';
        emailLabel.innerHTML = 'Admin Email <span class="req">*</span>';
        submitBtn.querySelector('.btn-text').textContent = 'Create Admin Account';
        toggleLink.textContent = 'Already have an account? Sign in';
      } else {
        title.textContent = 'Sign In';
        subtitle.textContent = 'Access your business invoice & service dashboard';
        nameGroup.style.display = 'none';
        emailLabel.innerHTML = 'Email or Username <span class="req">*</span>';
        submitBtn.querySelector('.btn-text').textContent = 'Sign In';
        toggleLink.textContent = 'First time setup? Create initial Super Admin account';
      }
    }

    function togglePasswordVisibility() {
      const pwd = document.getElementById('authPassword');
      if (!pwd) return;
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    }

    async function handleLogout() {
      const confirmed = await Utils.confirmDialog({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out of your account?',
        confirmText: 'Sign Out',
        danger: false,
      });
      if (confirmed) {
        await SupabaseService.signOut();
        Utils.notify('Signed out successfully', 'info');
      }
    }

    function onUserLoggedIn(user, profile) {
      currentUser = user;
      currentProfile = profile || {
        full_name: user.email.split('@')[0],
        role: 'user',
        email: user.email,
      };

      // Hide auth overlay
      const overlay = document.getElementById('authOverlay');
      if (overlay) overlay.classList.add('auth-overlay--hidden');

      // Update sidebar profile widget
      const avatarEl = document.getElementById('sidebarUserAvatar');
      const nameEl = document.getElementById('sidebarUserName');
      const roleEl = document.getElementById('sidebarUserRole');
      const navUsersLink = document.getElementById('navUsersLink');

      const name = currentProfile.full_name || 'Staff User';
      const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

      if (avatarEl) avatarEl.textContent = initials || 'U';
      if (nameEl) nameEl.textContent = name;
      if (roleEl) {
        roleEl.textContent = currentProfile.role === 'super_admin' ? 'Super Admin' : 'Staff';
        roleEl.className = `sidebar__user-role ${currentProfile.role === 'super_admin' ? 'status-badge--admin' : ''}`;
      }

      // Toggle Super Admin Navigation
      if (navUsersLink) {
        navUsersLink.style.display = currentProfile.role === 'super_admin' ? 'flex' : 'none';
      }

      // Update "Prepared by" chips on generator screens
      updatePreparedByBadges();

      // Refresh current page
      NavigationModule.refreshCurrentPage();
    }

    function onUserLoggedOut() {
      currentUser = null;
      currentProfile = null;
      const overlay = document.getElementById('authOverlay');
      if (overlay) overlay.classList.remove('auth-overlay--hidden');
      const navUsersLink = document.getElementById('navUsersLink');
      if (navUsersLink) navUsersLink.style.display = 'none';
    }

    function updatePreparedByBadges() {
      const name = currentProfile ? currentProfile.full_name : 'Staff';
      const invBadge = document.getElementById('invPreparedByBadge');
      const recBadge = document.getElementById('recPreparedByBadge');
      if (invBadge) invBadge.textContent = `Prepared by: ${name}`;
      if (recBadge) recBadge.textContent = `Prepared by: ${name}`;
    }

    function setButtonLoading(btn, loading) {
      if (!btn) return;
      const text = btn.querySelector('.btn-text');
      const loader = btn.querySelector('.btn-loader');
      btn.disabled = loading;
      if (text) text.style.opacity = loading ? '0' : '1';
      if (loader) loader.style.display = loading ? 'inline-block' : 'none';
    }

    return { init, updatePreparedByBadges };
  })();

  /* ==================================================================
     2. NAVIGATION MODULE
     ================================================================== */
  const NavigationModule = (() => {
    const sidebarLinks = document.querySelectorAll('.sidebar__link');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    const pageMeta = {
      dashboard: { title: 'Dashboard', subtitle: "Welcome back. Here's your business overview." },
      invoices: { title: 'Invoices', subtitle: 'Create fast invoices and manage billing records.' },
      receipt: { title: 'Money Receipt Generator', subtitle: 'Generate and manage customer service receipts.' },
      customers: { title: 'Customer Management', subtitle: 'View client database and transaction history.' },
      analytics: { title: 'Analytics & Insights', subtitle: 'Revenue metrics, service trends, and performance.' },
      search: { title: 'Search Database', subtitle: 'Instant search across invoices, receipts, and customers.' },
      users: { title: 'User Management', subtitle: 'Super Admin access to team accounts and permissions.' },
      settings: { title: 'Business Profile & Settings', subtitle: 'Manage company branding, prefixes, and bank details.' },
    };

    function init() {
      sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          navigateTo(link.dataset.page);
        });
      });

      window.addEventListener('hashchange', handleHash);

      if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
          sidebar.classList.add('open');
          sidebarOverlay.classList.add('show');
        });
      }

      if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
          sidebar.classList.remove('open');
          sidebarOverlay.classList.remove('show');
        });
      }

      // Topbar quick invoice button
      const topbarNewInvBtn = document.getElementById('topbarNewInvoiceBtn');
      if (topbarNewInvBtn) {
        topbarNewInvBtn.addEventListener('click', () => {
          navigateTo('invoices');
          InvoiceModule.switchTab('invoice-generator');
          InvoiceModule.resetForm();
        });
      }

      handleHash();
      if (!window.location.hash) navigateTo('dashboard');
    }

    function navigateTo(page) {
      // Role Guard: Users page is Super Admin only
      if (page === 'users' && (!currentProfile || currentProfile.role !== 'super_admin')) {
        Utils.notify('Access restricted: Super Admin privileges required', 'warning');
        page = 'dashboard';
      }

      currentPage = page;
      pages.forEach(p => p.classList.remove('page--active'));
      const activeEl = document.getElementById(`page-${page}`);
      if (activeEl) activeEl.classList.add('page--active');

      sidebarLinks.forEach(l => l.classList.toggle('active', l.dataset.page === page));
      const meta = pageMeta[page] || {};
      if (pageTitle) pageTitle.textContent = meta.title || '';
      if (pageSubtitle) pageSubtitle.textContent = meta.subtitle || '';

      // Close mobile sidebar if open
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('show');

      refreshCurrentPage();
      window.location.hash = page;
    }

    function handleHash() {
      const hash = window.location.hash.slice(1) || 'dashboard';
      navigateTo(hash);
    }

    function refreshCurrentPage() {
      if (currentPage === 'dashboard') DashboardModule.render();
      if (currentPage === 'invoices') InvoiceModule.render();
      if (currentPage === 'receipt') ReceiptModule.render();
      if (currentPage === 'customers') CustomersModule.render();
      if (currentPage === 'analytics') AnalyticsModule.render();
      if (currentPage === 'users') UserManagementModule.render();
      if (currentPage === 'settings') SettingsModule.render();
    }

    return { init, navigateTo, refreshCurrentPage };
  })();

  /* ==================================================================
     3. FAST INVOICE GENERATOR & MANAGEMENT MODULE
     ================================================================== */
  const InvoiceModule = (() => {
    let itemsData = [{ description: '', qty: 1, rate: 0 }];
    let activeFilter = 'All';

    function init() {
      // Subnav Tabs
      const tabGen = document.getElementById('tabInvoiceGen');
      const tabHist = document.getElementById('tabInvoiceHist');
      if (tabGen) tabGen.addEventListener('click', () => switchTab('invoice-generator'));
      if (tabHist) tabHist.addEventListener('click', () => switchTab('invoice-history'));

      // Add item button
      const addItemBtn = document.getElementById('invAddItemBtn');
      if (addItemBtn) addItemBtn.addEventListener('click', () => addItemRow());

      // Financial calc input listeners
      ['invDiscount', 'invTaxPercent', 'invOtherCharges', 'invPaidAmount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', recalcTotals);
      });

      // Invoice form submission
      const form = document.getElementById('invoiceForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const saved = await saveInvoice();
          if (saved) {
            printInvoice(saved.id);
          }
        });
      }

      // Reset button
      const resetBtn = document.getElementById('invResetBtn');
      if (resetBtn) resetBtn.addEventListener('click', async () => {
        const confirmed = await Utils.confirmDialog({
          title: 'Reset Invoice',
          message: 'Clear all fields and start a fresh invoice?',
        });
        if (confirmed) resetForm();
      });

      // Live Preview Button
      const previewBtn = document.getElementById('invPreviewBtn');
      if (previewBtn) previewBtn.addEventListener('click', showLivePreview);

      // Save & PDF Button
      const savePDFBtn = document.getElementById('invSaveDownloadPDFBtn');
      if (savePDFBtn) savePDFBtn.addEventListener('click', async () => {
        const saved = await saveInvoice();
        if (saved) downloadInvoicePDF(saved.id);
      });

      // Status filter pills
      const statusPills = document.querySelectorAll('#invStatusPills .filter-pill');
      statusPills.forEach(pill => {
        pill.addEventListener('click', () => {
          statusPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          activeFilter = pill.dataset.status;
          renderHistory();
        });
      });

      // Search input
      const searchInput = document.getElementById('invHistSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(() => renderHistory(), 250));
      }

      // Export CSV
      const exportCSVBtn = document.getElementById('exportInvoicesCSVBtn');
      if (exportCSVBtn) exportCSVBtn.addEventListener('click', exportCSV);

      // Smart Autocomplete for Customer
      const custInput = document.getElementById('invCustomerName');
      if (custInput) {
        Utils.setupAutocomplete({
          inputEl: custInput,
          onSearch: async (query) => Store.getCustomers(query),
          onSelect: (cust) => {
            custInput.value = cust.name;
            const phoneEl = document.getElementById('invCustomerPhone');
            const emailEl = document.getElementById('invCustomerEmail');
            const addrEl = document.getElementById('invCustomerAddress');
            if (phoneEl) phoneEl.value = cust.phone || '';
            if (emailEl) emailEl.value = cust.email || '';
            if (addrEl) addrEl.value = cust.address || '';
            custInput.dataset.customerId = cust.id;
          },
          renderItem: (c) => `
            <div class="autocomplete-item__name">${Utils.esc(c.name)}</div>
            <div class="autocomplete-item__detail">${Utils.esc(c.phone || '')} &middot; ${Utils.esc(c.address || '')}</div>
          `,
        });
      }

      // Initial defaults
      resetForm();
    }

    function switchTab(tabId) {
      const tabGen = document.getElementById('tabInvoiceGen');
      const tabHist = document.getElementById('tabInvoiceHist');
      const contentGen = document.getElementById('tabContentInvoiceGen');
      const contentHist = document.getElementById('tabContentInvoiceHist');

      if (tabId === 'invoice-generator') {
        if (tabGen) tabGen.classList.add('active');
        if (tabHist) tabHist.classList.remove('active');
        if (contentGen) contentGen.classList.add('active');
        if (contentHist) contentHist.classList.remove('active');
      } else {
        if (tabGen) tabGen.classList.remove('active');
        if (tabHist) tabHist.classList.add('active');
        if (contentGen) contentGen.classList.remove('active');
        if (contentHist) contentHist.classList.add('active');
        renderHistory();
      }
    }

    async function resetForm() {
      editingInvoiceId = null;
      itemsData = [{ description: '', qty: 1, rate: 0 }];

      const numEl = document.getElementById('invNumber');
      const dateEl = document.getElementById('invDate');
      const dueEl = document.getElementById('invDueDate');
      const nameEl = document.getElementById('invCustomerName');
      const phoneEl = document.getElementById('invCustomerPhone');
      const emailEl = document.getElementById('invCustomerEmail');
      const addrEl = document.getElementById('invCustomerAddress');
      const discEl = document.getElementById('invDiscount');
      const taxEl = document.getElementById('invTaxPercent');
      const otherEl = document.getElementById('invOtherCharges');
      const paidEl = document.getElementById('invPaidAmount');
      const notesEl = document.getElementById('invNotes');

      if (numEl) numEl.value = await Store.generateInvoiceNumber();
      if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
      if (dueEl) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        dueEl.value = nextWeek.toISOString().split('T')[0];
      }
      if (nameEl) { nameEl.value = ''; delete nameEl.dataset.customerId; }
      if (phoneEl) phoneEl.value = '';
      if (emailEl) emailEl.value = '';
      if (addrEl) addrEl.value = '';
      if (discEl) discEl.value = '0';
      if (taxEl) taxEl.value = '0';
      if (otherEl) otherEl.value = '0';
      if (paidEl) paidEl.value = '0';
      if (notesEl) notesEl.value = '';

      renderItemRows();
      recalcTotals();
      AuthModule.updatePreparedByBadges();
    }

    function renderItemRows() {
      const tbody = document.getElementById('invItemsTableBody');
      if (!tbody) return;
      if (!itemsData.length) itemsData = [{ description: '', qty: 1, rate: 0 }];

      tbody.innerHTML = itemsData.map((it, i) => `
        <tr class="item-row" data-index="${i}">
          <td class="it-sl-cell">${i + 1}</td>
          <td><input type="text" class="it-input item-desc" value="${Utils.esc(it.description || '')}" placeholder="Item / Service description" data-idx="${i}"></td>
          <td><input type="number" class="it-input it-input--num item-qty" value="${it.qty || 1}" min="1" step="1" data-idx="${i}"></td>
          <td><input type="number" class="it-input it-input--num item-rate" value="${it.rate || 0}" min="0" step="1" data-idx="${i}"></td>
          <td class="it-total-cell">${Utils.formatCurrency((it.qty || 0) * (it.rate || 0))}</td>
          <td class="it-action-cell">
            ${itemsData.length > 1 ? `<button type="button" class="it-remove-btn" data-idx="${i}" title="Remove item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          </td>
        </tr>
      `).join('');

      // Input event bindings
      tbody.querySelectorAll('.item-desc, .item-qty, .item-rate').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.idx, 10);
          const row = tbody.querySelector(`.item-row[data-index="${idx}"]`);
          if (row && itemsData[idx]) {
            itemsData[idx].description = row.querySelector('.item-desc')?.value || '';
            itemsData[idx].qty = parseFloat(row.querySelector('.item-qty')?.value) || 1;
            itemsData[idx].rate = parseFloat(row.querySelector('.item-rate')?.value) || 0;
            const lineTotal = itemsData[idx].qty * itemsData[idx].rate;
            row.querySelector('.it-total-cell').textContent = Utils.formatCurrency(lineTotal);
          }
          recalcTotals();
        });

        // Fast item adding on Enter key in rate input
        if (input.classList.contains('item-rate')) {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItemRow();
              setTimeout(() => {
                const nextRow = tbody.querySelector('.item-row:last-child .item-desc');
                if (nextRow) nextRow.focus();
              }, 50);
            }
          });
        }
      });

      tbody.querySelectorAll('.it-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          removeItemRow(idx);
        });
      });
    }

    function addItemRow() {
      itemsData.push({ description: '', qty: 1, rate: 0 });
      renderItemRows();
      recalcTotals();
    }

    function removeItemRow(idx) {
      if (itemsData.length <= 1) return;
      itemsData.splice(idx, 1);
      renderItemRows();
      recalcTotals();
    }

    function recalcTotals() {
      let subtotal = 0;
      itemsData.forEach(it => {
        subtotal += (Number(it.qty) || 1) * (Number(it.rate) || 0);
      });

      const discount = parseFloat(document.getElementById('invDiscount')?.value) || 0;
      const taxPercent = parseFloat(document.getElementById('invTaxPercent')?.value) || 0;
      const otherCharges = parseFloat(document.getElementById('invOtherCharges')?.value) || 0;
      const paidAmount = parseFloat(document.getElementById('invPaidAmount')?.value) || 0;

      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = (taxableAmount * taxPercent) / 100;
      const grandTotal = taxableAmount + taxAmount + otherCharges;
      const dueAmount = Math.max(0, grandTotal - paidAmount);

      // Update UI Text
      const subtotalEl = document.getElementById('invSubtotalText');
      const grandTotalEl = document.getElementById('invGrandTotalText');
      const dueAmountEl = document.getElementById('invDueAmountText');
      const statusSelect = document.getElementById('invPaymentStatus');

      if (subtotalEl) subtotalEl.textContent = Utils.formatCurrency(subtotal);
      if (grandTotalEl) grandTotalEl.textContent = Utils.formatCurrency(grandTotal);
      if (dueAmountEl) dueAmountEl.textContent = Utils.formatCurrency(dueAmount);

      // Auto-update status dropdown
      if (statusSelect) {
        if (paidAmount >= grandTotal && grandTotal > 0) {
          statusSelect.value = 'Paid';
        } else if (paidAmount > 0) {
          statusSelect.value = 'Partial';
        } else {
          statusSelect.value = 'Due';
        }
      }

      return { subtotal, discount, taxPercent, taxAmount, otherCharges, grandTotal, paidAmount, dueAmount };
    }

    function getFormData() {
      const calc = recalcTotals();
      const nameEl = document.getElementById('invCustomerName');

      return {
        id: editingInvoiceId,
        invoice_number: document.getElementById('invNumber')?.value || 'INV-0001',
        date: document.getElementById('invDate')?.value || new Date().toISOString().split('T')[0],
        due_date: document.getElementById('invDueDate')?.value || null,
        customer_id: nameEl?.dataset?.customerId || null,
        customer_name: nameEl?.value?.trim() || '',
        customer_phone: document.getElementById('invCustomerPhone')?.value?.trim() || '',
        customer_email: document.getElementById('invCustomerEmail')?.value?.trim() || '',
        customer_address: document.getElementById('invCustomerAddress')?.value?.trim() || '',
        subtotal: calc.subtotal,
        discount: calc.discount,
        tax_percent: calc.taxPercent,
        tax_amount: calc.taxAmount,
        other_charges: calc.otherCharges,
        grand_total: calc.grandTotal,
        paid_amount: calc.paidAmount,
        due_amount: calc.dueAmount,
        payment_method: document.getElementById('invPaymentMethod')?.value || 'Cash',
        payment_status: document.getElementById('invPaymentStatus')?.value || 'Due',
        notes: document.getElementById('invNotes')?.value?.trim() || '',
        prepared_by_name: currentProfile ? currentProfile.full_name : 'Staff',
        items: itemsData.filter(it => it.description || it.rate > 0),
      };
    }

    async function saveInvoice() {
      const data = getFormData();
      if (!data.customer_name) {
        Utils.notify('Please enter a customer name', 'warning');
        return null;
      }
      if (!data.items.length) {
        Utils.notify('Please add at least one line item', 'warning');
        return null;
      }

      try {
        const saved = await Store.saveInvoice(data, data.items);
        Utils.notify(editingInvoiceId ? 'Invoice updated successfully!' : 'Invoice generated successfully!', 'success');
        resetForm();
        renderHistory();
        return saved;
      } catch (err) {
        console.error('Save invoice error:', err);
        Utils.notify(`Save failed: ${err.message}`, 'error');
        return null;
      }
    }

    function showLivePreview() {
      const data = getFormData();
      const settings = Store.getSettings();
      settings.then(s => {
        const modal = document.getElementById('invoiceModal');
        const content = document.getElementById('invoicePreviewContent');
        if (modal && content) {
          content.innerHTML = MinimalLuxuryRenderer.buildInvoiceHTML(data, s, false);
          modal.dataset.invoiceId = data.id || '';
          modal.style.display = 'flex';
        }
      });
    }

    async function renderHistory() {
      const tbody = document.getElementById('invoicesTableBody');
      const countEl = document.getElementById('invoiceHistoryCount');
      if (!tbody) return;

      const searchVal = document.getElementById('invHistSearchInput')?.value || '';
      const invoices = await Store.getInvoices({ status: activeFilter, search: searchVal });

      if (countEl) countEl.textContent = invoices.length;

      if (!invoices.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="search-empty"><p>No invoices found matching your criteria</p></td></tr>`;
        return;
      }

      tbody.innerHTML = invoices.map(inv => `
        <tr>
          <td><strong class="form-input--mono">${Utils.esc(inv.invoice_number)}</strong></td>
          <td>${Utils.formatDate(inv.date || inv.created_at)}</td>
          <td>
            <div style="font-weight:600">${Utils.esc(inv.customer_name)}</div>
            ${inv.customer_phone ? `<div style="font-size:0.75rem;color:var(--text-muted)">${Utils.esc(inv.customer_phone)}</div>` : ''}
          </td>
          <td><strong>${Utils.formatCurrency(inv.grand_total)}</strong></td>
          <td style="color:var(--success)">${Utils.formatCurrency(inv.paid_amount)}</td>
          <td style="color:${Number(inv.due_amount) > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${Utils.formatCurrency(inv.due_amount)}</td>
          <td><span class="status-badge status-badge--${(inv.payment_status || 'due').toLowerCase()}">${Utils.esc(inv.payment_status)}</span></td>
          <td><span style="font-size:0.8rem;color:var(--text-secondary)">${Utils.esc(inv.prepared_by_name || 'Staff')}</span></td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn--ghost btn--sm" onclick="App.previewInvoice('${inv.id}')" title="Preview">
              ${Utils.Icons.eye}
            </button>
            <button class="btn btn--ghost btn--sm" onclick="App.editInvoice('${inv.id}')" title="Edit">
              ${Utils.Icons.edit}
            </button>
            <button class="btn btn--ghost btn--sm" onclick="App.printInvoice('${inv.id}')" title="Print">
              ${Utils.Icons.printer}
            </button>
            <button class="btn btn--ghost btn--sm" onclick="App.downloadInvoicePDF('${inv.id}')" title="Download PDF" style="color:var(--accent-red)">
              ${Utils.Icons.pdf}
            </button>
            ${currentProfile?.role === 'super_admin' ? `
              <button class="btn btn--ghost btn--sm" onclick="App.deleteInvoice('${inv.id}')" title="Delete" style="color:var(--danger)">
                ${Utils.Icons.trash}
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');
    }

    async function editInvoice(id) {
      const inv = await Store.getInvoice(id);
      if (!inv) {
        Utils.notify('Invoice not found', 'error');
        return;
      }
      editingInvoiceId = inv.id;

      document.getElementById('invNumber').value = inv.invoice_number;
      document.getElementById('invDate').value = inv.date;
      document.getElementById('invDueDate').value = inv.due_date || '';

      const nameEl = document.getElementById('invCustomerName');
      if (nameEl) {
        nameEl.value = inv.customer_name;
        nameEl.dataset.customerId = inv.customer_id || '';
      }
      document.getElementById('invCustomerPhone').value = inv.customer_phone || '';
      document.getElementById('invCustomerEmail').value = inv.customer_email || '';
      document.getElementById('invCustomerAddress').value = inv.customer_address || '';
      document.getElementById('invDiscount').value = inv.discount || 0;
      document.getElementById('invTaxPercent').value = inv.tax_percent || 0;
      document.getElementById('invOtherCharges').value = inv.other_charges || 0;
      document.getElementById('invPaidAmount').value = inv.paid_amount || 0;
      document.getElementById('invPaymentMethod').value = inv.payment_method || 'Cash';
      document.getElementById('invPaymentStatus').value = inv.payment_status || 'Due';
      document.getElementById('invNotes').value = inv.notes || '';

      if (inv.invoice_items && inv.invoice_items.length) {
        itemsData = inv.invoice_items.map(it => ({
          description: it.description,
          qty: it.qty,
          rate: it.rate,
        }));
      } else {
        itemsData = [{ description: '', qty: 1, rate: 0 }];
      }

      renderItemRows();
      recalcTotals();
      switchTab('invoice-generator');
      Utils.notify(`Loaded invoice ${inv.invoice_number} for editing`, 'info');
    }

    async function deleteInvoice(id) {
      const confirmed = await Utils.confirmDialog({
        title: 'Delete Invoice',
        message: 'Are you sure you want to permanently delete this invoice? This action cannot be undone.',
        confirmText: 'Delete Permanently',
        danger: true,
      });

      if (confirmed) {
        try {
          await Store.deleteInvoice(id);
          Utils.notify('Invoice deleted permanently', 'success');
          renderHistory();
          if (currentPage === 'dashboard') DashboardModule.render();
        } catch (err) {
          Utils.notify(`Failed to delete: ${err.message}`, 'error');
        }
      }
    }

    async function exportCSV() {
      const invoices = await Store.getInvoices();
      if (!invoices.length) {
        Utils.notify('No invoices to export', 'warning');
        return;
      }
      let csv = 'Invoice Number,Date,Customer,Phone,Grand Total,Paid,Due,Status,Payment Method,Prepared By\n';
      invoices.forEach(inv => {
        csv += `"${inv.invoice_number}","${inv.date}","${inv.customer_name}","${inv.customer_phone || ''}",${inv.grand_total},${inv.paid_amount},${inv.due_amount},"${inv.payment_status}","${inv.payment_method}","${inv.prepared_by_name || ''}"\n`;
      });
      Utils.downloadFile(csv, `informix_invoices_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      Utils.notify('Invoices exported to CSV', 'success');
    }

    function render() {
      recalcTotals();
      renderHistory();
    }

    return {
      init,
      render,
      switchTab,
      resetForm,
      editInvoice,
      deleteInvoice,
      getFormData,
    };
  })();

  /* ==================================================================
     4. MONEY RECEIPT MODULE
     ================================================================== */
  const ReceiptModule = (() => {
    let itemsData = [{ name: '', qty: 1, unitPrice: 0 }];

    function init() {
      const addItemBtn = document.getElementById('addItemRow');
      if (addItemBtn) addItemBtn.addEventListener('click', () => addItemRow());

      const form = document.getElementById('receiptForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const saved = await saveReceipt();
          if (saved) printReceipt(saved.id);
        });
      }

      const resetBtn = document.getElementById('receiptReset');
      if (resetBtn) resetBtn.addEventListener('click', resetForm);

      const previewBtn = document.getElementById('receiptPreview');
      if (previewBtn) previewBtn.addEventListener('click', showPreview);

      const pdfBtn = document.getElementById('receiptDownloadPDFBtn');
      if (pdfBtn) pdfBtn.addEventListener('click', async () => {
        const saved = await saveReceipt();
        if (saved) downloadReceiptPDF(saved.id);
      });

      // Customer autocomplete
      const custInput = document.getElementById('rCustomerName');
      if (custInput) {
        Utils.setupAutocomplete({
          inputEl: custInput,
          onSearch: async (q) => Store.getCustomers(q),
          onSelect: (cust) => {
            custInput.value = cust.name;
            const phone = document.getElementById('rCustomerPhone');
            const addr = document.getElementById('rCustomerAddress');
            if (phone) phone.value = cust.phone || '';
            if (addr) addr.value = cust.address || '';
            custInput.dataset.customerId = cust.id;
          },
          renderItem: (c) => `
            <div class="autocomplete-item__name">${Utils.esc(c.name)}</div>
            <div class="autocomplete-item__detail">${Utils.esc(c.phone || '')} &middot; ${Utils.esc(c.address || '')}</div>
          `,
        });
      }

      resetForm();
    }

    async function resetForm() {
      editingReceiptId = null;
      itemsData = [{ name: '', qty: 1, unitPrice: 0 }];

      document.getElementById('rReceiptNumber').value = await Store.generateReceiptNumber();
      document.getElementById('rDate').value = new Date().toISOString().split('T')[0];
      const nameEl = document.getElementById('rCustomerName');
      if (nameEl) { nameEl.value = ''; delete nameEl.dataset.customerId; }
      document.getElementById('rCustomerPhone').value = '';
      document.getElementById('rCustomerAddress').value = '';
      document.getElementById('rServiceType').value = '';
      document.getElementById('rDeviceName').value = '';
      document.getElementById('rDeviceModel').value = '';
      document.getElementById('rDeviceSerial').value = '';
      document.getElementById('rProblem').value = '';
      document.getElementById('rWorkDone').value = '';
      document.getElementById('rDiscount').value = '0';
      document.getElementById('rAmountPaid').value = '0';
      document.getElementById('rNotes').value = '';

      renderItemRows();
      recalcItems();
      AuthModule.updatePreparedByBadges();
    }

    function renderItemRows() {
      const tbody = document.getElementById('itemsTableBody');
      if (!tbody) return;
      if (!itemsData.length) itemsData = [{ name: '', qty: 1, unitPrice: 0 }];

      tbody.innerHTML = itemsData.map((it, i) => `
        <tr class="item-row" data-index="${i}">
          <td class="it-sl-cell">${i + 1}</td>
          <td><input type="text" class="it-input item-name" value="${Utils.esc(it.name || '')}" placeholder="Service or replaced part" data-idx="${i}"></td>
          <td><input type="number" class="it-input it-input--num item-qty" value="${it.qty || 1}" min="1" step="1" data-idx="${i}"></td>
          <td><input type="number" class="it-input it-input--num item-price" value="${it.unitPrice || 0}" min="0" step="1" data-idx="${i}"></td>
          <td class="it-total-cell">${Utils.formatCurrency((it.qty || 0) * (it.unitPrice || 0))}</td>
          <td class="it-action-cell">
            ${itemsData.length > 1 ? `<button type="button" class="it-remove-btn" data-idx="${i}" title="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.item-name, .item-qty, .item-price').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.idx, 10);
          const row = tbody.querySelector(`.item-row[data-index="${idx}"]`);
          if (row && itemsData[idx]) {
            itemsData[idx].name = row.querySelector('.item-name')?.value || '';
            itemsData[idx].qty = parseFloat(row.querySelector('.item-qty')?.value) || 1;
            itemsData[idx].unitPrice = parseFloat(row.querySelector('.item-price')?.value) || 0;
            const lineTotal = itemsData[idx].qty * itemsData[idx].unitPrice;
            row.querySelector('.it-total-cell').textContent = Utils.formatCurrency(lineTotal);
          }
          recalcItems();
        });
      });

      tbody.querySelectorAll('.it-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          removeItemRow(idx);
        });
      });
    }

    function addItemRow() {
      itemsData.push({ name: '', qty: 1, unitPrice: 0 });
      renderItemRows();
      recalcItems();
    }

    function removeItemRow(idx) {
      if (itemsData.length <= 1) return;
      itemsData.splice(idx, 1);
      renderItemRows();
      recalcItems();
    }

    function recalcItems() {
      let total = 0;
      itemsData.forEach(it => { total += (Number(it.qty) || 1) * (Number(it.unitPrice) || 0); });
      const amtEl = document.getElementById('rAmount');
      if (amtEl) amtEl.value = total;
      return total;
    }

    function getFormData() {
      const total = recalcItems();
      const disc = parseFloat(document.getElementById('rDiscount')?.value) || 0;
      const paid = parseFloat(document.getElementById('rAmountPaid')?.value) || 0;
      const due = Math.max(0, total - disc - paid);
      const nameEl = document.getElementById('rCustomerName');

      return {
        id: editingReceiptId,
        receipt_number: document.getElementById('rReceiptNumber')?.value || 'INF-0001',
        date: document.getElementById('rDate')?.value || new Date().toISOString().split('T')[0],
        customer_id: nameEl?.dataset?.customerId || null,
        customer_name: nameEl?.value?.trim() || '',
        customer_phone: document.getElementById('rCustomerPhone')?.value?.trim() || '',
        customer_address: document.getElementById('rCustomerAddress')?.value?.trim() || '',
        service_type: document.getElementById('rServiceType')?.value || '',
        device_name: document.getElementById('rDeviceName')?.value?.trim() || '',
        device_model: document.getElementById('rDeviceModel')?.value?.trim() || '',
        device_serial: document.getElementById('rDeviceSerial')?.value?.trim() || '',
        problem_description: document.getElementById('rProblem')?.value?.trim() || '',
        work_performed: document.getElementById('rWorkDone')?.value?.trim() || '',
        total_amount: total,
        discount: disc,
        amount_paid: paid,
        due_amount: due,
        payment_method: document.getElementById('rPaymentMethod')?.value || 'Cash',
        payment_status: document.getElementById('rPaymentStatus')?.value || 'Paid',
        received_by: document.getElementById('rReceivedBy')?.value?.trim() || (currentProfile?.full_name || 'Staff'),
        notes: document.getElementById('rNotes')?.value?.trim() || '',
        prepared_by_name: currentProfile ? currentProfile.full_name : 'Staff',
        items: itemsData.filter(it => it.name || it.unitPrice > 0),
      };
    }

    async function saveReceipt() {
      const data = getFormData();
      if (!data.customer_name) {
        Utils.notify('Please enter customer name', 'warning');
        return null;
      }
      try {
        const saved = await Store.saveReceipt(data, data.items);
        Utils.notify('Receipt saved successfully!', 'success');
        resetForm();
        renderList();
        return saved;
      } catch (err) {
        console.error('Save receipt error:', err);
        Utils.notify(`Save failed: ${err.message}`, 'error');
        return null;
      }
    }

    function showPreview() {
      const data = getFormData();
      Store.getSettings().then(s => {
        const modal = document.getElementById('receiptModal');
        const content = document.getElementById('receiptPreviewContent');
        if (modal && content) {
          content.innerHTML = MinimalLuxuryRenderer.buildReceiptHTML(data, s, false);
          modal.dataset.receiptId = data.id || '';
          modal.style.display = 'flex';
        }
      });
    }

    async function renderList() {
      const container = document.getElementById('receiptsList');
      if (!container) return;

      const receipts = await Store.getReceipts();
      if (!receipts.length) {
        container.innerHTML = '<div class="search-empty"><p>No receipts generated yet</p></div>';
        return;
      }

      container.innerHTML = receipts.map(r => `
        <div class="receipt-list-item">
          <div class="receipt-list-item__left" onclick="App.previewReceipt('${r.id}')">
            <div class="receipt-list-item__number">${Utils.esc(r.receipt_number)}</div>
            <div class="receipt-list-item__customer">${Utils.esc(r.customer_name)} &middot; ${Utils.esc(r.service_type || '')}</div>
          </div>
          <div class="receipt-list-item__right">
            <div class="receipt-list-item__amount">${Utils.formatCurrency(r.total_amount)}</div>
            <div class="receipt-list-item__date">
              <span class="status-badge status-badge--${(r.payment_status || 'paid').toLowerCase()}">${r.payment_status}</span>
              &middot; ${Utils.formatDate(r.date || r.created_at)}
            </div>
            <div style="margin-top:4px;display:flex;gap:2px;justify-content:flex-end">
              <button class="btn btn--ghost btn--sm" onclick="App.editReceipt('${r.id}')" title="Edit">${Utils.Icons.edit}</button>
              <button class="btn btn--ghost btn--sm" onclick="App.printReceipt('${r.id}')" title="Print">${Utils.Icons.printer}</button>
              <button class="btn btn--ghost btn--sm" onclick="App.downloadReceiptPDF('${r.id}')" title="PDF">${Utils.Icons.pdf}</button>
              ${currentProfile?.role === 'super_admin' ? `
                <button class="btn btn--ghost btn--sm" onclick="App.deleteReceipt('${r.id}')" title="Delete" style="color:var(--danger)">${Utils.Icons.trash}</button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }

    async function editReceipt(id) {
      const r = await Store.getReceipt(id);
      if (!r) return;
      editingReceiptId = r.id;

      document.getElementById('rReceiptNumber').value = r.receipt_number;
      document.getElementById('rDate').value = r.date;
      const nameEl = document.getElementById('rCustomerName');
      if (nameEl) {
        nameEl.value = r.customer_name;
        nameEl.dataset.customerId = r.customer_id || '';
      }
      document.getElementById('rCustomerPhone').value = r.customer_phone || '';
      document.getElementById('rCustomerAddress').value = r.customer_address || '';
      document.getElementById('rServiceType').value = r.service_type || '';
      document.getElementById('rDeviceName').value = r.device_name || '';
      document.getElementById('rDeviceModel').value = r.device_model || '';
      document.getElementById('rDeviceSerial').value = r.device_serial || '';
      document.getElementById('rProblem').value = r.problem_description || '';
      document.getElementById('rWorkDone').value = r.work_performed || '';
      document.getElementById('rDiscount').value = r.discount || 0;
      document.getElementById('rAmountPaid').value = r.amount_paid || 0;
      document.getElementById('rPaymentMethod').value = r.payment_method || 'Cash';
      document.getElementById('rPaymentStatus').value = r.payment_status || 'Paid';
      document.getElementById('rReceivedBy').value = r.received_by || '';
      document.getElementById('rNotes').value = r.notes || '';

      if (r.receipt_items && r.receipt_items.length) {
        itemsData = r.receipt_items.map(it => ({
          name: it.description,
          qty: it.qty,
          unitPrice: it.unit_price,
        }));
      } else {
        itemsData = [{ name: '', qty: 1, unitPrice: 0 }];
      }

      renderItemRows();
      recalcItems();
      NavigationModule.navigateTo('receipt');
      Utils.notify(`Loaded receipt ${r.receipt_number}`, 'info');
    }

    async function deleteReceipt(id) {
      const confirmed = await Utils.confirmDialog({
        title: 'Delete Receipt',
        message: 'Are you sure you want to permanently delete this receipt record?',
        confirmText: 'Delete Permanently',
        danger: true,
      });

      if (confirmed) {
        try {
          await Store.deleteReceipt(id);
          Utils.notify('Receipt deleted', 'success');
          renderList();
          if (currentPage === 'dashboard') DashboardModule.render();
        } catch (err) {
          Utils.notify(`Failed to delete: ${err.message}`, 'error');
        }
      }
    }

    function render() {
      renderList();
    }

    return { init, render, editReceipt, deleteReceipt, getFormData };
  })();

  /* ==================================================================
     5. SUPER ADMIN USER MANAGEMENT MODULE
     ================================================================== */
  const UserManagementModule = (() => {
    function init() {
      const addBtn = document.getElementById('addNewUserBtn');
      const modal = document.getElementById('userModal');
      const closeBtn = document.getElementById('userModalClose');
      const cancelBtn = document.getElementById('userModalCancel');
      const form = document.getElementById('userForm');

      if (addBtn) {
        addBtn.addEventListener('click', () => {
          openUserModal();
        });
      }

      if (closeBtn) closeBtn.addEventListener('click', closeUserModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeUserModal);

      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await saveUser();
        });
      }
    }

    function openUserModal(user = null) {
      const modal = document.getElementById('userModal');
      const title = document.getElementById('userModalTitle');
      const idEl = document.getElementById('uUserId');
      const nameEl = document.getElementById('uFullName');
      const emailEl = document.getElementById('uEmail');
      const pwdEl = document.getElementById('uPassword');
      const pwdReq = document.getElementById('uPasswordReq');
      const pwdHint = document.getElementById('uPasswordHint');
      const roleEl = document.getElementById('uRole');
      const statusEl = document.getElementById('uStatus');

      if (user) {
        title.textContent = 'Edit User';
        idEl.value = user.id;
        nameEl.value = user.full_name || '';
        emailEl.value = user.email || '';
        emailEl.disabled = true;
        pwdEl.value = '';
        pwdReq.style.display = 'none';
        pwdHint.style.display = 'block';
        roleEl.value = user.role || 'user';
        statusEl.value = user.status || 'active';
      } else {
        title.textContent = 'Add New User';
        idEl.value = '';
        nameEl.value = '';
        emailEl.value = '';
        emailEl.disabled = false;
        pwdEl.value = '';
        pwdReq.style.display = 'inline';
        pwdHint.style.display = 'none';
        roleEl.value = 'user';
        statusEl.value = 'active';
      }

      if (modal) modal.style.display = 'flex';
    }

    function closeUserModal() {
      const modal = document.getElementById('userModal');
      if (modal) modal.style.display = 'none';
    }

    async function saveUser() {
      const id = document.getElementById('uUserId').value;
      const fullName = document.getElementById('uFullName').value.trim();
      const email = document.getElementById('uEmail').value.trim();
      const password = document.getElementById('uPassword').value;
      const role = document.getElementById('uRole').value;
      const status = document.getElementById('uStatus').value;

      try {
        if (id) {
          // Update profile
          await Store.updateUser(id, { full_name: fullName, role, status });
          Utils.notify('User updated successfully!', 'success');
        } else {
          // Create new user
          if (!password || password.length < 6) {
            Utils.notify('Password must be at least 6 characters', 'warning');
            return;
          }
          await Store.createUser(email, password, fullName, role);
          Utils.notify('New user registered successfully!', 'success');
        }
        closeUserModal();
        render();
      } catch (err) {
        Utils.notify(`User operation failed: ${err.message}`, 'error');
      }
    }

    async function render() {
      if (!currentProfile || currentProfile.role !== 'super_admin') return;

      const tbody = document.getElementById('usersTableBody');
      if (!tbody) return;

      const users = await Store.getUsers();
      if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="search-empty"><p>No users found</p></td></tr>`;
        return;
      }

      tbody.innerHTML = users.map(u => {
        const initials = (u.full_name || u.email).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        const isSelf = currentUser && currentUser.id === u.id;

        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div class="sidebar__user-avatar" style="width:30px;height:30px;font-size:0.75rem">${initials}</div>
                <div>
                  <div style="font-weight:600">${Utils.esc(u.full_name)} ${isSelf ? '<span style="font-size:0.7rem;color:var(--gold)">(You)</span>' : ''}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${Utils.esc(u.phone || '')}</div>
                </div>
              </div>
            </td>
            <td>${Utils.esc(u.email)}</td>
            <td><span class="status-badge status-badge--${u.role === 'super_admin' ? 'admin' : 'user'}">${u.role === 'super_admin' ? 'Super Admin' : 'User'}</span></td>
            <td><span class="status-badge status-badge--${u.status === 'active' ? 'active' : 'inactive'}">${u.status}</span></td>
            <td>${Utils.formatDate(u.created_at)}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn--ghost btn--sm" onclick="App.editUser('${u.id}')" title="Edit">${Utils.Icons.edit}</button>
              ${!isSelf ? `
                <button class="btn btn--ghost btn--sm" onclick="App.toggleUserStatus('${u.id}', '${u.status === 'active' ? 'inactive' : 'active'}')" title="${u.status === 'active' ? 'Disable Account' : 'Enable Account'}">
                  ${u.status === 'active' ? Utils.Icons.lock : Utils.Icons.check}
                </button>
                <button class="btn btn--ghost btn--sm" onclick="App.deleteUser('${u.id}')" title="Delete" style="color:var(--danger)">
                  ${Utils.Icons.trash}
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }

    return { init, render, openUserModal, closeUserModal };
  })();

  /* ==================================================================
     6. CUSTOMERS MODULE
     ================================================================== */
  const CustomersModule = (() => {
    let filterText = '';

    function init() {
      const searchInput = document.getElementById('customerSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce((e) => {
          filterText = e.target.value;
          render();
        }, 250));
      }

      const backBtn = document.getElementById('customerBackBtn');
      if (backBtn) backBtn.addEventListener('click', backToList);

      const addBtn = document.getElementById('addNewCustomerBtn');
      const modal = document.getElementById('customerModal');
      const closeBtn = document.getElementById('custModalClose');
      const cancelBtn = document.getElementById('custModalCancel');
      const form = document.getElementById('customerForm');

      if (addBtn) addBtn.addEventListener('click', () => openCustomerModal());
      if (closeBtn) closeBtn.addEventListener('click', closeCustomerModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeCustomerModal);

      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await saveCustomer();
        });
      }
    }

    function openCustomerModal(cust = null) {
      const modal = document.getElementById('customerModal');
      const idEl = document.getElementById('cCustomerId');
      const nameEl = document.getElementById('cName');
      const phoneEl = document.getElementById('cPhone');
      const emailEl = document.getElementById('cEmail');
      const addrEl = document.getElementById('cAddress');
      const notesEl = document.getElementById('cNotes');

      if (cust) {
        idEl.value = cust.id;
        nameEl.value = cust.name;
        phoneEl.value = cust.phone || '';
        emailEl.value = cust.email || '';
        addrEl.value = cust.address || '';
        notesEl.value = cust.notes || '';
      } else {
        idEl.value = '';
        nameEl.value = '';
        phoneEl.value = '';
        emailEl.value = '';
        addrEl.value = '';
        notesEl.value = '';
      }

      if (modal) modal.style.display = 'flex';
    }

    function closeCustomerModal() {
      const modal = document.getElementById('customerModal');
      if (modal) modal.style.display = 'none';
    }

    async function saveCustomer() {
      const id = document.getElementById('cCustomerId').value;
      const data = {
        id: id || undefined,
        name: document.getElementById('cName').value.trim(),
        phone: document.getElementById('cPhone').value.trim(),
        email: document.getElementById('cEmail').value.trim(),
        address: document.getElementById('cAddress').value.trim(),
        notes: document.getElementById('cNotes').value.trim(),
      };

      try {
        await Store.saveCustomer(data);
        Utils.notify('Customer saved successfully', 'success');
        closeCustomerModal();
        render();
      } catch (err) {
        Utils.notify(`Error: ${err.message}`, 'error');
      }
    }

    async function render() {
      const grid = document.getElementById('customersGrid');
      if (!grid) return;

      const customers = await Store.getCustomers(filterText);
      const invoices = await Store.getInvoices();

      if (!customers.length) {
        grid.innerHTML = '<div class="search-empty" style="grid-column:1/-1"><p>No customers found</p></div>';
        return;
      }

      grid.innerHTML = customers.map(c => {
        const custInvoices = invoices.filter(inv => inv.customer_id === c.id || inv.customer_name.toLowerCase() === c.name.toLowerCase());
        const totalPaid = custInvoices.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0);
        const totalDue = custInvoices.reduce((s, r) => s + (Number(r.due_amount) || 0), 0);

        return `
          <div class="customer-card" onclick="App.viewCustomer('${c.id}')">
            <div class="customer-card__name">${Utils.esc(c.name)}</div>
            <div class="customer-card__phone">${Utils.esc(c.phone || 'No phone recorded')}</div>
            <div class="customer-card__address">${Utils.esc(c.address || '—')}</div>
            <div class="customer-card__stats">
              <div><span class="customer-stat-card__label">Invoices</span><br><strong>${custInvoices.length}</strong></div>
              <div><span class="customer-stat-card__label">Paid</span><br><strong style="color:var(--success)">${Utils.formatCurrency(totalPaid)}</strong></div>
              <div><span class="customer-stat-card__label">Due</span><br><strong style="color:${totalDue > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${Utils.formatCurrency(totalDue)}</strong></div>
            </div>
          </div>
        `;
      }).join('');
    }

    async function viewDetail(customerId) {
      const customer = await Store.getCustomer(customerId);
      if (!customer) return;

      const [invoices, receipts] = await Promise.all([
        Store.getInvoices({ customerId }),
        Store.getReceipts({ customerId }),
      ]);

      document.getElementById('customerListView').style.display = 'none';
      const detailView = document.getElementById('customerDetailView');
      detailView.style.display = 'block';

      const totalPaid = invoices.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0);
      const totalDue = invoices.reduce((s, r) => s + (Number(r.due_amount) || 0), 0);
      const initials = customer.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

      document.getElementById('customerDetailContent').innerHTML = `
        <div class="customer-detail__header">
          <div class="customer-detail__avatar">${initials}</div>
          <div class="customer-detail__info">
            <h2>${Utils.esc(customer.name)}</h2>
            <p>${Utils.esc(customer.phone || '')} &middot; ${Utils.esc(customer.email || '')}</p>
            <p>${Utils.esc(customer.address || '')}</p>
          </div>
        </div>
        <div class="customer-detail__stats">
          <div class="customer-stat-card"><div class="customer-stat-card__label">Total Invoices</div><div class="customer-stat-card__value">${invoices.length}</div></div>
          <div class="customer-stat-card"><div class="customer-stat-card__label">Total Receipts</div><div class="customer-stat-card__value">${receipts.length}</div></div>
          <div class="customer-stat-card"><div class="customer-stat-card__label">Total Paid</div><div class="customer-stat-card__value" style="color:var(--success)">${Utils.formatCurrency(totalPaid)}</div></div>
          <div class="customer-stat-card"><div class="customer-stat-card__label">Outstanding Due</div><div class="customer-stat-card__value" style="color:var(--danger)">${Utils.formatCurrency(totalDue)}</div></div>
        </div>
      `;
    }

    function backToList() {
      document.getElementById('customerListView').style.display = 'block';
      document.getElementById('customerDetailView').style.display = 'none';
      render();
    }

    return { init, render, viewDetail, backToList, openCustomerModal };
  })();

  /* ==================================================================
     7. DASHBOARD MODULE
     ================================================================== */
  const DashboardModule = (() => {
    async function render() {
      const [invoices, receipts, customers, activities] = await Promise.all([
        Store.getInvoices(),
        Store.getReceipts(),
        Store.getCustomers(),
        Store.getActivities(10),
      ]);

      const totalRevenue = invoices.reduce((s, r) => s + (Number(r.grand_total) || 0), 0);
      const totalPaid = invoices.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0);
      const totalDue = invoices.reduce((s, r) => s + (Number(r.due_amount) || 0), 0);
      const completedJobs = invoices.filter(r => r.payment_status === 'Paid').length;

      // Render Stats Cards
      const grid = document.getElementById('statsGrid');
      if (grid) {
        const stats = [
          { label: 'Total Invoices', value: invoices.length, icon: Utils.Icons.invoice, color: 'primary' },
          { label: 'Total Revenue', value: totalRevenue, prefix: '৳', icon: Utils.Icons.analytics, color: 'success' },
          { label: 'Total Due', value: totalDue, prefix: '৳', icon: Utils.Icons.lock, color: 'danger' },
          { label: 'Paid Invoices', value: completedJobs, icon: Utils.Icons.check, color: 'success' },
          { label: 'Receipts', value: receipts.length, icon: Utils.Icons.receipt, color: 'info' },
          { label: 'Active Clients', value: customers.length, icon: Utils.Icons.customers, color: 'primary' },
        ];

        grid.innerHTML = stats.map((s, i) => `
          <div class="stat-card" style="animation-delay:${i * 50}ms">
            <div class="stat-card__top">
              <div class="stat-card__icon stat-card__icon--${s.color}">${s.icon}</div>
            </div>
            <div class="stat-card__label">${s.label}</div>
            <div class="stat-card__value">${s.prefix || ''}${s.value.toLocaleString()}</div>
          </div>
        `).join('');
      }

      // Render Activity Timeline
      const actContainer = document.getElementById('activityTimeline');
      const actCount = document.getElementById('activityCount');
      if (actContainer) {
        if (actCount) actCount.textContent = activities.length;
        if (!activities.length) {
          actContainer.innerHTML = '<div class="search-empty"><p>No recent activities</p></div>';
        } else {
          actContainer.innerHTML = activities.map(a => `
            <div class="activity-item">
              <div class="activity-item__dot activity-item__dot--${a.type || 'system'}"></div>
              <div class="activity-item__content">
                <div class="activity-item__text">${Utils.esc(a.message)}</div>
                <div class="activity-item__meta">
                  <span>${Utils.timeAgo(a.created_at)}</span>
                  ${a.amount ? `<span class="activity-item__amount">${Utils.formatCurrency(a.amount)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('');
        }
      }

      // Render Top Customers
      const topCustContainer = document.getElementById('topCustomersList');
      if (topCustContainer) {
        const map = {};
        invoices.forEach(inv => {
          const key = inv.customer_name || 'Unknown';
          if (!map[key]) map[key] = { name: key, total: 0, count: 0 };
          map[key].total += Number(inv.grand_total) || 0;
          map[key].count++;
        });
        const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);

        if (!sorted.length) {
          topCustContainer.innerHTML = '<div class="search-empty"><p>No customer transactions yet</p></div>';
        } else {
          topCustContainer.innerHTML = sorted.map((c, i) => `
            <div class="top-customer-item">
              <div class="top-customer-item__rank top-customer-item__rank--${i + 1}">${i + 1}</div>
              <div class="top-customer-item__info">
                <div class="top-customer-item__name">${Utils.esc(c.name)}</div>
                <div class="top-customer-item__detail">${c.count} invoices</div>
              </div>
              <div class="top-customer-item__value">${Utils.formatCurrency(c.total)}</div>
            </div>
          `).join('');
        }
      }

      // Render Recent Invoices
      const recentContainer = document.getElementById('recentReceiptsList');
      if (recentContainer) {
        const recent = invoices.slice(0, 6);
        if (!recent.length) {
          recentContainer.innerHTML = '<div class="search-empty"><p>No invoices created yet</p></div>';
        } else {
          recentContainer.innerHTML = recent.map(inv => `
            <div class="receipt-list-item" onclick="App.previewInvoice('${inv.id}')">
              <div class="receipt-list-item__left">
                <div class="receipt-list-item__number">${Utils.esc(inv.invoice_number)}</div>
                <div class="receipt-list-item__customer">${Utils.esc(inv.customer_name)}</div>
              </div>
              <div class="receipt-list-item__right">
                <div class="receipt-list-item__amount">${Utils.formatCurrency(inv.grand_total)}</div>
                <div class="receipt-list-item__date">
                  <span class="status-badge status-badge--${(inv.payment_status || 'due').toLowerCase()}">${inv.payment_status}</span>
                  &middot; ${Utils.formatDate(inv.date || inv.created_at)}
                </div>
              </div>
            </div>
          `).join('');
        }
      }
    }

    return { render };
  })();

  /* ==================================================================
     8. ANALYTICS MODULE (CANVAS CHARTS)
     ================================================================== */
  const AnalyticsModule = (() => {
    let period = 6;

    function getCanvasCtx(id) {
      const canvas = document.getElementById(id);
      if (!canvas) return null;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 240 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = '240px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      return { ctx, w: rect.width, h: 240 };
    }

    function drawLine(canvasId, data) {
      const c = getCanvasCtx(canvasId);
      if (!c) return;
      const { ctx, w, h } = c;
      const pad = { top: 20, right: 20, bottom: 30, left: 50 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;

      const values = data.map(d => d.value);
      const maxVal = Math.max(...values, 1000) * 1.15;

      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        const val = Math.round(maxVal - (maxVal / 4) * i);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`৳${val.toLocaleString()}`, pad.left - 6, y + 3);
      }

      if (data.length < 2) return;

      // Line
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = pad.left + (chartW / (data.length - 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Dots & Labels
      data.forEach((d, i) => {
        const x = pad.left + (chartW / (data.length - 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#d90429';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x, h - 8);
      });
    }

    async function render() {
      const data = await Store.getMonthlyAnalytics(period);
      drawLine('revenueChart', data.map(d => ({ label: d.label, value: d.revenue })));
    }

    return { render, setPeriod: (p) => { period = p; render(); } };
  })();

  /* ==================================================================
     9. SEARCH MODULE
     ================================================================== */
  const SearchModule = (() => {
    let filterType = 'all';

    function init() {
      const searchInput = document.getElementById('searchPageInput');
      if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce((e) => search(e.target.value), 250));
      }

      const filterBtns = document.querySelectorAll('.search-hero__filters .search-filter');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          filterType = btn.dataset.type;
          const input = document.getElementById('searchPageInput');
          if (input) search(input.value);
        });
      });
    }

    async function search(query) {
      const container = document.getElementById('searchResults');
      if (!container) return;

      const q = (query || '').trim();
      if (!q) {
        container.innerHTML = `
          <div class="search-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p>Type to search across all invoices, receipts, and customers</p>
            <span class="search-hint">Tip: Press Ctrl+K from anywhere to open search</span>
          </div>
        `;
        return;
      }

      const results = await Store.search(q);
      const filtered = filterType === 'all' ? results : results.filter(r => r.type === filterType);

      if (!filtered.length) {
        container.innerHTML = `<div class="search-empty"><p>No results found for "${Utils.esc(q)}"</p></div>`;
        return;
      }

      container.innerHTML = filtered.map(item => {
        if (item.type === 'invoice') {
          const inv = item.data;
          return `
            <div class="search-results__item" onclick="App.previewInvoice('${inv.id}')">
              <div class="search-results__item-header">
                <span class="search-results__item-number">${Utils.esc(inv.invoice_number)}</span>
                <span class="status-badge status-badge--${(inv.payment_status || 'due').toLowerCase()}">${inv.payment_status}</span>
              </div>
              <div class="search-results__item-name">${Utils.esc(inv.customer_name)}</div>
              <div class="search-results__item-detail">${Utils.formatCurrency(inv.grand_total)} &middot; ${Utils.formatDate(inv.date)} &middot; Prepared by ${Utils.esc(inv.prepared_by_name || 'Staff')}</div>
            </div>
          `;
        } else if (item.type === 'receipt') {
          const r = item.data;
          return `
            <div class="search-results__item" onclick="App.previewReceipt('${r.id}')">
              <div class="search-results__item-header">
                <span class="search-results__item-number">${Utils.esc(r.receipt_number)}</span>
                <span class="status-badge status-badge--paid">Receipt</span>
              </div>
              <div class="search-results__item-name">${Utils.esc(r.customer_name)} &middot; ${Utils.esc(r.service_type || '')}</div>
              <div class="search-results__item-detail">${Utils.formatCurrency(r.total_amount)} &middot; ${Utils.formatDate(r.date)}</div>
            </div>
          `;
        } else {
          const c = item.data;
          return `
            <div class="search-results__item" onclick="App.viewCustomer('${c.id}')">
              <div class="search-results__item-header">
                <span class="search-results__item-number">${Utils.esc(c.name)}</span>
                <span class="search-results__item-type">Customer</span>
              </div>
              <div class="search-results__item-detail">${Utils.esc(c.phone || '')} &middot; ${Utils.esc(c.address || '')}</div>
            </div>
          `;
        }
      }).join('');
    }

    return { init, search };
  })();

  /* ==================================================================
     10. SETTINGS MODULE
     ================================================================== */
  const SettingsModule = (() => {
    function init() {
      const form = document.getElementById('settingsForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await saveSettings();
        });
      }

      const cfgForm = document.getElementById('supabaseConfigForm');
      if (cfgForm) {
        cfgForm.addEventListener('submit', (e) => {
          e.preventDefault();
          saveSupabaseConfig();
        });
      }

      const uploadBtn = document.getElementById('uploadLogoBtn');
      const fileInput = document.getElementById('logoFileInput');
      if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleLogoUpload);
      }

      const exportBtn = document.getElementById('exportDataBtn');
      if (exportBtn) exportBtn.addEventListener('click', exportBackupJSON);

      const importBtn = document.getElementById('importDataBtn');
      const importInput = document.getElementById('importFileInput');
      if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', handleImportJSON);
      }
    }

    async function render() {
      const s = await Store.getSettings();
      document.getElementById('sCompanyName').value = s.company_name || '';
      document.getElementById('sTagline').value = s.tagline || '';
      document.getElementById('sAddress').value = s.address || '';
      document.getElementById('sPhone').value = s.phone || '';
      document.getElementById('sEmail').value = s.email || '';
      document.getElementById('sWebsite').value = s.website || '';
      document.getElementById('sInvoicePrefix').value = s.invoice_prefix || 'INV';
      document.getElementById('sReceiptPrefix').value = s.receipt_prefix || 'INF';
      document.getElementById('sTerms').value = (s.terms || []).join('\n');

      const bank = s.bank_details || {};
      document.getElementById('sBankName').value = bank.bank_name || '';
      document.getElementById('sAccountName').value = bank.account_name || '';
      document.getElementById('sAccountNumber').value = bank.account_number || '';
      document.getElementById('sBranch').value = bank.branch || '';
      document.getElementById('sBkash').value = bank.bkash_merchant || '';

      if (s.logo_url) {
        document.getElementById('settingsLogoImg').src = s.logo_url;
      }

      // Supabase connection display
      const cfg = SupabaseService.getConfig();
      document.getElementById('sSupabaseUrl').value = cfg.url || '';
      document.getElementById('sSupabaseAnonKey').value = cfg.anonKey || '';

      const dot = document.getElementById('supabaseStatusDot');
      const text = document.getElementById('supabaseStatusText');
      if (SupabaseService.isConfigured()) {
        dot.className = 'status-indicator-dot connected';
        text.textContent = 'Connected to Supabase PostgreSQL';
      } else {
        dot.className = 'status-indicator-dot';
        text.textContent = 'Connected (Default / Development)';
      }
    }

    async function saveSettings() {
      if (currentProfile?.role !== 'super_admin') {
        Utils.notify('Permission denied: Only Super Admin can modify business settings', 'warning');
        return;
      }

      const payload = {
        company_name: document.getElementById('sCompanyName').value.trim(),
        tagline: document.getElementById('sTagline').value.trim(),
        address: document.getElementById('sAddress').value.trim(),
        phone: document.getElementById('sPhone').value.trim(),
        email: document.getElementById('sEmail').value.trim(),
        website: document.getElementById('sWebsite').value.trim(),
        invoice_prefix: document.getElementById('sInvoicePrefix').value.trim() || 'INV',
        receipt_prefix: document.getElementById('sReceiptPrefix').value.trim() || 'INF',
        terms: document.getElementById('sTerms').value.split('\n').map(t => t.trim()).filter(Boolean),
        bank_details: {
          bank_name: document.getElementById('sBankName').value.trim(),
          account_name: document.getElementById('sAccountName').value.trim(),
          account_number: document.getElementById('sAccountNumber').value.trim(),
          branch: document.getElementById('sBranch').value.trim(),
          bkash_merchant: document.getElementById('sBkash').value.trim(),
        },
      };

      try {
        await Store.saveSettings(payload);
        Utils.notify('Settings saved successfully', 'success');
      } catch (err) {
        Utils.notify(`Save error: ${err.message}`, 'error');
      }
    }

    async function handleLogoUpload(e) {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const logoUrl = await SupabaseService.uploadLogoFile(file);
        await Store.saveSettings({ logo_url: logoUrl });
        document.getElementById('settingsLogoImg').src = logoUrl;
        document.getElementById('sidebarLogo').src = logoUrl;
        Utils.notify('Logo updated successfully', 'success');
      } catch (err) {
        Utils.notify(`Logo upload failed: ${err.message}`, 'error');
      }
    }

    function saveSupabaseConfig() {
      const url = document.getElementById('sSupabaseUrl').value.trim();
      const anonKey = document.getElementById('sSupabaseAnonKey').value.trim();
      if (!url || !anonKey) {
        Utils.notify('Please provide both URL and Anon Key', 'warning');
        return;
      }
      SupabaseService.saveConfig(url, anonKey);
      Utils.notify('Supabase credentials saved. Reloading session...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    }

    async function exportBackupJSON() {
      const [invoices, receipts, customers, settings] = await Promise.all([
        Store.getInvoices(),
        Store.getReceipts(),
        Store.getCustomers(),
        Store.getSettings(),
      ]);

      const backup = { invoices, receipts, customers, settings, exported_at: new Date().toISOString() };
      Utils.downloadFile(JSON.stringify(backup, null, 2), `informix_backup_${new Date().toISOString().split('T')[0]}.json`);
      Utils.notify('Backup exported successfully', 'success');
    }

    function handleImportJSON(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          Utils.notify('Backup parsed successfully', 'success');
        } catch (_) {
          Utils.notify('Invalid JSON backup file', 'error');
        }
      };
      reader.readAsText(file);
    }

    return { init, render };
  })();

  /* ==================================================================
     11. MINIMAL LUXURY HTML RENDERER (SCREEN PREVIEW & PRINT ENGINE)
     ================================================================== */
  const MinimalLuxuryRenderer = (() => {
    function buildInvoiceHTML(inv, settings, isPrint = false) {
      const logoUrl = settings?.logo_url || 'assets/logo.svg';
      const companyName = settings?.company_name || 'INFORMIX BD';
      const tagline = settings?.tagline || 'Security & Surveillance Solutions';
      const address = settings?.address || 'Dhaka, Bangladesh';
      const phone = settings?.phone || '+880 1XXXXXXXXX';
      const email = settings?.email || 'info@informixbd.com';
      const website = settings?.website || 'www.informixbd.com';
      const bank = settings?.bank_details || {};

      const items = inv.items || inv.invoice_items || [];
      const subtotal = Number(inv.subtotal) || 0;
      const discount = Number(inv.discount) || 0;
      const taxAmount = Number(inv.tax_amount) || 0;
      const otherCharges = Number(inv.other_charges) || 0;
      const grandTotal = Number(inv.grand_total) || 0;
      const paid = Number(inv.paid_amount) || 0;
      const due = Number(inv.due_amount) || 0;
      const words = Utils.numberToWords(grandTotal);

      return `
        <div class="luxury-document ${isPrint ? 'print-mode' : ''}">
          <!-- Business Header -->
          <div class="lx-header">
            <div class="lx-header__brand">
              <img src="${logoUrl}" alt="${companyName}" class="lx-header__logo" onerror="this.style.display='none'">
              <div class="lx-header__company">${Utils.esc(companyName)}</div>
              <div class="lx-header__tagline">${Utils.esc(tagline)}</div>
            </div>
            <div class="lx-header__contact">
              <div>${Utils.esc(address)}</div>
              <div>${Utils.esc(phone)} &middot; ${Utils.esc(email)}</div>
              <div>${Utils.esc(website)}</div>
            </div>
          </div>

          <!-- Document Title & Meta Bar -->
          <div class="lx-meta-bar">
            <div class="lx-title-group">
              <span class="lx-doc-type">INVOICE</span>
              <span class="lx-doc-number">${Utils.esc(inv.invoice_number || 'INV-000000')}</span>
            </div>
            <div class="lx-meta-details">
              <div class="lx-meta-row"><span class="lx-meta-label">Invoice Date:</span><span class="lx-meta-value">${Utils.formatDate(inv.date || inv.created_at)}</span></div>
              ${inv.due_date ? `<div class="lx-meta-row"><span class="lx-meta-label">Due Date:</span><span class="lx-meta-value">${Utils.formatDate(inv.due_date)}</span></div>` : ''}
              <div class="lx-meta-row" style="margin-top:4px">
                <span class="lx-meta-status lx-meta-status--${(inv.payment_status || 'due').toLowerCase()}">${Utils.esc(inv.payment_status || 'Due')}</span>
              </div>
            </div>
          </div>

          <!-- Bill To & Payment Method Info Grid -->
          <div class="lx-info-grid">
            <div class="lx-info-box">
              <div class="lx-info-box__title">Bill To</div>
              <div class="lx-info-box__name">${Utils.esc(inv.customer_name || 'Customer')}</div>
              ${inv.customer_phone ? `<div class="lx-info-box__line">${Utils.esc(inv.customer_phone)}</div>` : ''}
              ${inv.customer_email ? `<div class="lx-info-box__line">${Utils.esc(inv.customer_email)}</div>` : ''}
              ${inv.customer_address ? `<div class="lx-info-box__line">${Utils.esc(inv.customer_address)}</div>` : ''}
            </div>
            <div class="lx-info-box">
              <div class="lx-info-box__title">Payment Terms & Mode</div>
              <div class="lx-info-box__name">${Utils.esc(inv.payment_method || 'Cash')}</div>
              <div class="lx-info-box__line">Prepared by: <strong>${Utils.esc(inv.prepared_by_name || 'Staff')}</strong></div>
            </div>
          </div>

          <!-- Line Items Table -->
          <table class="lx-table">
            <thead>
              <tr>
                <th class="lx-center" style="width:30px">#</th>
                <th>Item / Service Description</th>
                <th class="lx-center" style="width:50px">Qty</th>
                <th class="lx-num" style="width:100px">Unit Rate</th>
                <th class="lx-num" style="width:110px">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.length ? items.map((it, idx) => `
                <tr>
                  <td class="lx-center">${idx + 1}</td>
                  <td>${Utils.esc(it.description || it.name || '')}</td>
                  <td class="lx-center">${it.qty || 1}</td>
                  <td class="lx-num">${Utils.formatCurrency(it.rate || it.unitPrice || 0)}</td>
                  <td class="lx-num"><strong>${Utils.formatCurrency((Number(it.qty) || 1) * (Number(it.rate || it.unitPrice) || 0))}</strong></td>
                </tr>
              `).join('') : `
                <tr>
                  <td class="lx-center">1</td>
                  <td>General Service</td>
                  <td class="lx-center">1</td>
                  <td class="lx-num">${Utils.formatCurrency(subtotal)}</td>
                  <td class="lx-num"><strong>${Utils.formatCurrency(subtotal)}</strong></td>
                </tr>
              `}
            </tbody>
          </table>

          <!-- Financial Breakdown & Notes -->
          <div class="lx-summary-wrap">
            <div class="lx-summary-left">
              <div class="lx-words-box">
                <div class="lx-words-title">Amount in Words</div>
                <div class="lx-words-text">${Utils.esc(words)}</div>
              </div>

              ${bank.bank_name || bank.account_number ? `
                <div class="lx-bank-box">
                  <div class="lx-bank-title">Bank & Payment Information</div>
                  <div><strong>Bank:</strong> ${Utils.esc(bank.bank_name || '')} (${Utils.esc(bank.branch || '')})</div>
                  <div><strong>A/C Name:</strong> ${Utils.esc(bank.account_name || '')} &middot; <strong>A/C No:</strong> ${Utils.esc(bank.account_number || '')}</div>
                  ${bank.bkash_merchant ? `<div><strong>bKash / Merchant:</strong> ${Utils.esc(bank.bkash_merchant)}</div>` : ''}
                </div>
              ` : ''}

              ${inv.notes ? `
                <div style="margin-top:10px;font-size:8pt;color:#6b7280">
                  <strong>Notes:</strong> ${Utils.esc(inv.notes)}
                </div>
              ` : ''}
            </div>

            <div class="lx-totals-stack">
              <div class="lx-total-row"><span>Subtotal:</span><span>${Utils.formatCurrency(subtotal)}</span></div>
              ${discount > 0 ? `<div class="lx-total-row"><span>Discount:</span><span>-${Utils.formatCurrency(discount)}</span></div>` : ''}
              ${taxAmount > 0 ? `<div class="lx-total-row"><span>Tax / VAT (${inv.tax_percent}%):</span><span>+${Utils.formatCurrency(taxAmount)}</span></div>` : ''}
              ${otherCharges > 0 ? `<div class="lx-total-row"><span>Other Charges:</span><span>+${Utils.formatCurrency(otherCharges)}</span></div>` : ''}
              <div class="lx-total-row lx-total-row--grand">
                <span>Grand Total:</span>
                <span>${Utils.formatCurrency(grandTotal)}</span>
              </div>
              <div class="lx-total-row"><span>Paid Amount:</span><span style="color:#15803d;font-weight:600">${Utils.formatCurrency(paid)}</span></div>
              ${due > 0 ? `<div class="lx-total-row lx-total-row--due"><span>Due Balance:</span><span>${Utils.formatCurrency(due)}</span></div>` : ''}
            </div>
          </div>

          <!-- Signatures -->
          <div class="lx-signatures">
            <div class="lx-sig-box">
              <div class="lx-sig-line">Prepared By</div>
              <div class="lx-sig-user">${Utils.esc(inv.prepared_by_name || 'Staff')}</div>
            </div>
            <div class="lx-sig-box">
              <div class="lx-sig-line">Customer Signature</div>
            </div>
            <div class="lx-sig-box">
              <div class="lx-sig-line">Authorized Signature</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="lx-footer">
            Thank you for choosing ${Utils.esc(companyName)}. For support, contact ${Utils.esc(phone)} or ${Utils.esc(email)}.
          </div>
        </div>
      `;
    }

    function buildReceiptHTML(r, settings, isPrint = false) {
      const logoUrl = settings?.logo_url || 'assets/logo.svg';
      const companyName = settings?.company_name || 'INFORMIX BD';
      const address = settings?.address || 'Dhaka, Bangladesh';
      const phone = settings?.phone || '+880 1XXXXXXXXX';
      const email = settings?.email || 'info@informixbd.com';

      const items = r.items || r.receipt_items || [];
      const total = Number(r.total_amount) || 0;
      const paid = Number(r.amount_paid) || 0;
      const due = Number(r.due_amount) || 0;
      const words = Utils.numberToWords(paid || total);

      return `
        <div class="luxury-document ${isPrint ? 'print-mode' : ''}">
          <div class="lx-header">
            <div class="lx-header__brand">
              <img src="${logoUrl}" alt="${companyName}" class="lx-header__logo" onerror="this.style.display='none'">
              <div class="lx-header__company">${Utils.esc(companyName)}</div>
              <div class="lx-header__tagline">${Utils.esc(settings?.tagline || 'Security & Surveillance Solutions')}</div>
            </div>
            <div class="lx-header__contact">
              <div>${Utils.esc(address)}</div>
              <div>${Utils.esc(phone)} &middot; ${Utils.esc(email)}</div>
            </div>
          </div>

          <div class="lx-meta-bar">
            <div class="lx-title-group">
              <span class="lx-doc-type">MONEY RECEIPT</span>
              <span class="lx-doc-number">${Utils.esc(r.receipt_number)}</span>
            </div>
            <div class="lx-meta-details">
              <div class="lx-meta-row"><span class="lx-meta-label">Date:</span><span class="lx-meta-value">${Utils.formatDate(r.date || r.created_at)}</span></div>
              <div class="lx-meta-row"><span class="lx-meta-status lx-meta-status--paid">${Utils.esc(r.payment_status || 'Paid')}</span></div>
            </div>
          </div>

          <div class="lx-info-grid">
            <div class="lx-info-box">
              <div class="lx-info-box__title">Received From</div>
              <div class="lx-info-box__name">${Utils.esc(r.customer_name)}</div>
              ${r.customer_phone ? `<div class="lx-info-box__line">${Utils.esc(r.customer_phone)}</div>` : ''}
              ${r.customer_address ? `<div class="lx-info-box__line">${Utils.esc(r.customer_address)}</div>` : ''}
            </div>
            <div class="lx-info-box">
              <div class="lx-info-box__title">Service / Device Details</div>
              <div class="lx-info-box__line"><strong>Service:</strong> ${Utils.esc(r.service_type || '—')}</div>
              ${r.device_name ? `<div class="lx-info-box__line"><strong>Device:</strong> ${Utils.esc(r.device_name)} (${Utils.esc(r.device_model || '')})</div>` : ''}
              ${r.device_serial ? `<div class="lx-info-box__line"><strong>S/N:</strong> ${Utils.esc(r.device_serial)}</div>` : ''}
            </div>
          </div>

          <table class="lx-table">
            <thead>
              <tr>
                <th class="lx-center" style="width:30px">#</th>
                <th>Service / Charge Description</th>
                <th class="lx-center" style="width:50px">Qty</th>
                <th class="lx-num" style="width:100px">Rate</th>
                <th class="lx-num" style="width:110px">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.length ? items.map((it, i) => `
                <tr>
                  <td class="lx-center">${i + 1}</td>
                  <td>${Utils.esc(it.description || it.name || '')}</td>
                  <td class="lx-center">${it.qty || 1}</td>
                  <td class="lx-num">${Utils.formatCurrency(it.unit_price || it.unitPrice || 0)}</td>
                  <td class="lx-num"><strong>${Utils.formatCurrency((it.qty || 1) * (it.unit_price || it.unitPrice || 0))}</strong></td>
                </tr>
              `).join('') : `
                <tr>
                  <td class="lx-center">1</td>
                  <td>${Utils.esc(r.service_type || 'Service Charge')}</td>
                  <td class="lx-center">1</td>
                  <td class="lx-num">${Utils.formatCurrency(total)}</td>
                  <td class="lx-num"><strong>${Utils.formatCurrency(total)}</strong></td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="lx-summary-wrap">
            <div class="lx-summary-left">
              <div class="lx-words-box">
                <div class="lx-words-title">Amount in Words</div>
                <div class="lx-words-text">${Utils.esc(words)}</div>
              </div>
              ${r.notes ? `<div style="margin-top:8px;font-size:8pt;color:#6b7280"><strong>Notes:</strong> ${Utils.esc(r.notes)}</div>` : ''}
            </div>
            <div class="lx-totals-stack">
              <div class="lx-total-row lx-total-row--grand">
                <span>Total Received:</span>
                <span>${Utils.formatCurrency(paid || total)}</span>
              </div>
              ${due > 0 ? `<div class="lx-total-row lx-total-row--due"><span>Due Balance:</span><span>${Utils.formatCurrency(due)}</span></div>` : ''}
            </div>
          </div>

          <div class="lx-signatures">
            <div class="lx-sig-box">
              <div class="lx-sig-line">Prepared By</div>
              <div class="lx-sig-user">${Utils.esc(r.prepared_by_name || 'Staff')}</div>
            </div>
            <div class="lx-sig-box">
              <div class="lx-sig-line">Customer Signature</div>
            </div>
            <div class="lx-sig-box">
              <div class="lx-sig-line">Authorized Sign</div>
            </div>
          </div>
        </div>
      `;
    }

    return { buildInvoiceHTML, buildReceiptHTML };
  })();

  /* ==================================================================
     12. PDF GENERATION ENGINE (VECTOR A4 VIA jsPDF + autoTable)
     ================================================================== */
  function generateInvoicePDF(inv, settings) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      Utils.notify('PDF library is loading — please try again', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const PW = 210, PH = 297, MG = 18, CW = PW - 2 * MG;
    const s = settings || {};

    const CLR = {
      dark: [17, 24, 39],
      muted: [107, 114, 128],
      border: [229, 231, 235],
      accentRed: [217, 4, 41],
    };

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...CLR.dark);
    doc.text(s.company_name || 'INFORMIX BD', MG, MG + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...CLR.muted);
    doc.text((s.tagline || 'Security & Surveillance Solutions').toUpperCase(), MG, MG + 9);

    // Right header contact
    doc.setFontSize(7.5);
    doc.text(s.address || 'Dhaka, Bangladesh', PW - MG, MG + 2, { align: 'right' });
    doc.text((s.phone || '') + '  |  ' + (s.email || ''), PW - MG, MG + 6, { align: 'right' });
    if (s.website) doc.text(s.website, PW - MG, MG + 10, { align: 'right' });

    // Divider
    doc.setDrawColor(...CLR.dark);
    doc.setLineWidth(0.5);
    doc.line(MG, MG + 16, PW - MG, MG + 16);

    // Title bar
    const titleY = MG + 26;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...CLR.accentRed);
    doc.text('INVOICE', MG, titleY);

    doc.setFontSize(18);
    doc.setTextColor(...CLR.dark);
    doc.text(inv.invoice_number || 'INV-000001', MG, titleY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...CLR.muted);
    doc.text('Invoice Date:', PW - MG - 30, titleY, { align: 'right' });
    doc.setTextColor(...CLR.dark);
    doc.text(Utils.formatDate(inv.date || inv.created_at), PW - MG, titleY, { align: 'right' });

    if (inv.due_date) {
      doc.setTextColor(...CLR.muted);
      doc.text('Due Date:', PW - MG - 30, titleY + 5, { align: 'right' });
      doc.setTextColor(...CLR.dark);
      doc.text(Utils.formatDate(inv.due_date), PW - MG, titleY + 5, { align: 'right' });
    }

    // Bill To box
    const billY = titleY + 16;
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(...CLR.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(MG, billY, CW, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...CLR.muted);
    doc.text('BILL TO', MG + 6, billY + 6);
    doc.text('PAYMENT DETAILS', PW - MG - 50, billY + 6);

    doc.setFontSize(9.5);
    doc.setTextColor(...CLR.dark);
    doc.text(inv.customer_name || 'Customer', MG + 6, billY + 12);
    doc.text(inv.payment_method || 'Cash', PW - MG - 50, billY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...CLR.muted);
    doc.text((inv.customer_phone || '') + (inv.customer_address ? '  |  ' + inv.customer_address : ''), MG + 6, billY + 17);
    doc.text('Prepared by: ' + (inv.prepared_by_name || 'Staff'), PW - MG - 50, billY + 17);

    // Items AutoTable
    const items = inv.items || inv.invoice_items || [];
    const tableRows = items.length ? items.map((it, i) => [
      String(i + 1),
      it.description || it.name || '',
      String(it.qty || 1),
      'Taka ' + (Number(it.rate || it.unitPrice) || 0).toLocaleString(),
      'Taka ' + ((Number(it.qty) || 1) * (Number(it.rate || it.unitPrice) || 0)).toLocaleString(),
    ]) : [['1', 'General Service', '1', 'Taka ' + (inv.subtotal || 0), 'Taka ' + (inv.grand_total || 0)]];

    doc.autoTable({
      startY: billY + 28,
      margin: { left: MG, right: MG },
      head: [['#', 'Item / Service Description', 'Qty', 'Unit Rate', 'Amount']],
      body: tableRows,
      theme: 'plain',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: CLR.dark,
        fontStyle: 'bold',
        fontSize: 7.5,
        lineColor: CLR.dark,
        lineWidth: 0.4,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: CLR.dark,
        lineColor: [240, 240, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 32 },
      },
    });

    let fy = doc.lastAutoTable.finalY + 8;

    // Financial summary on right
    const cur = (val) => 'Taka ' + (Number(val) || 0).toLocaleString();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', PW - MG - 35, fy, { align: 'right' });
    doc.text(cur(inv.subtotal), PW - MG, fy, { align: 'right' });

    if (Number(inv.discount) > 0) {
      fy += 5;
      doc.text('Discount:', PW - MG - 35, fy, { align: 'right' });
      doc.text('- ' + cur(inv.discount), PW - MG, fy, { align: 'right' });
    }

    if (Number(inv.tax_amount) > 0) {
      fy += 5;
      doc.text(`Tax (${inv.tax_percent}%):`, PW - MG - 35, fy, { align: 'right' });
      doc.text('+ ' + cur(inv.tax_amount), PW - MG, fy, { align: 'right' });
    }

    fy += 7;
    doc.setDrawColor(...CLR.dark);
    doc.setLineWidth(0.4);
    doc.line(PW - MG - 60, fy - 3, PW - MG, fy - 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...CLR.dark);
    doc.text('Grand Total:', PW - MG - 35, fy, { align: 'right' });
    doc.text(cur(inv.grand_total), PW - MG, fy, { align: 'right' });

    fy += 6;
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text('Paid Amount:', PW - MG - 35, fy, { align: 'right' });
    doc.text(cur(inv.paid_amount), PW - MG, fy, { align: 'right' });

    if (Number(inv.due_amount) > 0) {
      fy += 5;
      doc.setTextColor(...CLR.accentRed);
      doc.text('Due Balance:', PW - MG - 35, fy, { align: 'right' });
      doc.text(cur(inv.due_amount), PW - MG, fy, { align: 'right' });
    }

    // Words & Bank Details on Left
    const words = Utils.numberToWords(inv.grand_total);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...CLR.dark);
    doc.text('In Words: ' + words, MG, fy - 14);

    // Signatures
    const sigY = PH - MG - 16;
    const sigW = CW / 3;
    ['Prepared By', 'Customer Signature', 'Authorized Signature'].forEach((lbl, i) => {
      const sx = MG + sigW * i + 4;
      doc.setDrawColor(...CLR.muted);
      doc.setLineWidth(0.3);
      doc.line(sx, sigY, sx + sigW - 8, sigY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...CLR.muted);
      doc.text(lbl, sx + (sigW - 8) / 2, sigY + 4, { align: 'center' });
    });

    // Save
    const safeCust = (inv.customer_name || 'Client').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16);
    doc.save(`INFORMIXBD_${inv.invoice_number || 'INV'}_${safeCust}.pdf`);
    Utils.notify('Invoice PDF downloaded', 'success');
  }

  /* ==================================================================
     13. GLOBAL PUBLIC APP CONTROLLER (CALLED FROM HTML EVENTS)
     ================================================================== */
  window.App = {
    // Invoices
    previewInvoice: async (id) => {
      const inv = await Store.getInvoice(id);
      const settings = await Store.getSettings();
      if (!inv) return;
      const modal = document.getElementById('invoiceModal');
      const content = document.getElementById('invoicePreviewContent');
      if (modal && content) {
        content.innerHTML = MinimalLuxuryRenderer.buildInvoiceHTML(inv, settings, false);
        modal.dataset.invoiceId = id;
        modal.style.display = 'flex';
      }
    },
    printInvoice: async (id) => {
      const inv = id ? await Store.getInvoice(id) : InvoiceModule.getFormData();
      const settings = await Store.getSettings();
      if (!inv) return;
      const printArea = document.getElementById('printArea');
      printArea.innerHTML = MinimalLuxuryRenderer.buildInvoiceHTML(inv, settings, true);
      setTimeout(() => {
        window.print();
        setTimeout(() => { printArea.innerHTML = ''; }, 1000);
      }, 250);
    },
    downloadInvoicePDF: async (id) => {
      const inv = id ? await Store.getInvoice(id) : InvoiceModule.getFormData();
      const settings = await Store.getSettings();
      if (!inv) return;
      generateInvoicePDF(inv, settings);
    },
    editInvoice: (id) => InvoiceModule.editInvoice(id),
    deleteInvoice: (id) => InvoiceModule.deleteInvoice(id),

    // Receipts
    previewReceipt: async (id) => {
      const r = await Store.getReceipt(id);
      const settings = await Store.getSettings();
      if (!r) return;
      const modal = document.getElementById('receiptModal');
      const content = document.getElementById('receiptPreviewContent');
      if (modal && content) {
        content.innerHTML = MinimalLuxuryRenderer.buildReceiptHTML(r, settings, false);
        modal.dataset.receiptId = id;
        modal.style.display = 'flex';
      }
    },
    printReceipt: async (id) => {
      const r = id ? await Store.getReceipt(id) : ReceiptModule.getFormData();
      const settings = await Store.getSettings();
      if (!r) return;
      const printArea = document.getElementById('printArea');
      printArea.innerHTML = MinimalLuxuryRenderer.buildReceiptHTML(r, settings, true);
      setTimeout(() => {
        window.print();
        setTimeout(() => { printArea.innerHTML = ''; }, 1000);
      }, 250);
    },
    downloadReceiptPDF: async (id) => {
      const r = id ? await Store.getReceipt(id) : ReceiptModule.getFormData();
      const settings = await Store.getSettings();
      if (!r) return;
      generateInvoicePDF({
        invoice_number: r.receipt_number,
        date: r.date,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_address: r.customer_address,
        grand_total: r.total_amount,
        paid_amount: r.amount_paid,
        due_amount: r.due_amount,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        prepared_by_name: r.prepared_by_name,
        items: r.items || r.receipt_items,
      }, settings);
    },
    editReceipt: (id) => ReceiptModule.editReceipt(id),
    deleteReceipt: (id) => ReceiptModule.deleteReceipt(id),

    // Customers
    viewCustomer: (id) => CustomersModule.viewDetail(id),

    // Users (Super Admin)
    editUser: async (id) => {
      const users = await Store.getUsers();
      const user = users.find(u => u.id === id);
      if (user) UserManagementModule.openUserModal(user);
    },
    toggleUserStatus: async (id, newStatus) => {
      try {
        await Store.toggleUserStatus(id, newStatus);
        Utils.notify(`User status set to ${newStatus}`, 'success');
        UserManagementModule.render();
      } catch (err) {
        Utils.notify(`Error: ${err.message}`, 'error');
      }
    },
    deleteUser: async (id) => {
      const confirmed = await Utils.confirmDialog({
        title: 'Delete User Account',
        message: 'Are you sure you want to delete this user? Their login credentials will be revoked.',
        danger: true,
      });
      if (confirmed) {
        try {
          await Store.deleteUser(id);
          Utils.notify('User deleted', 'success');
          UserManagementModule.render();
        } catch (err) {
          Utils.notify(`Error: ${err.message}`, 'error');
        }
      }
    },
  };

  /* ==================================================================
     14. GLOBAL EVENT BINDINGS & KEYBOARD SHORTCUTS
     ================================================================== */
  function initGlobalEvents() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const mobileThemeBtn = document.getElementById('mobileThemeBtn');
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ix_theme', next);
    }
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', toggleTheme);
    const savedTheme = localStorage.getItem('ix_theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

    // Global Search focus
    const globalSearchInput = document.getElementById('globalSearchInput');
    if (globalSearchInput) {
      globalSearchInput.addEventListener('focus', () => {
        NavigationModule.navigateTo('search');
        setTimeout(() => document.getElementById('searchPageInput')?.focus(), 50);
      });
    }

    // Modal Close Buttons
    const invModal = document.getElementById('invoiceModal');
    const invModalClose = document.getElementById('invModalClose');
    const invModalPrint = document.getElementById('invModalPrint');
    const invModalPDF = document.getElementById('invModalDownloadPDF');

    if (invModalClose) invModalClose.addEventListener('click', () => { invModal.style.display = 'none'; });
    if (invModal) invModal.addEventListener('click', (e) => { if (e.target === invModal) invModal.style.display = 'none'; });
    if (invModalPrint) invModalPrint.addEventListener('click', () => {
      const id = invModal.dataset.invoiceId;
      App.printInvoice(id);
    });
    if (invModalPDF) invModalPDF.addEventListener('click', () => {
      const id = invModal.dataset.invoiceId;
      App.downloadInvoicePDF(id);
    });

    const recModal = document.getElementById('receiptModal');
    const recModalClose = document.getElementById('modalClose');
    const recModalPrint = document.getElementById('modalPrint');
    const recModalPDF = document.getElementById('modalDownloadPDF');

    if (recModalClose) recModalClose.addEventListener('click', () => { recModal.style.display = 'none'; });
    if (recModal) recModal.addEventListener('click', (e) => { if (e.target === recModal) recModal.style.display = 'none'; });
    if (recModalPrint) recModalPrint.addEventListener('click', () => {
      const id = recModal.dataset.receiptId;
      App.printReceipt(id);
    });
    if (recModalPDF) recModalPDF.addEventListener('click', () => {
      const id = recModal.dataset.receiptId;
      App.downloadReceiptPDF(id);
    });

    // Shortcuts modal
    const shortcutsBtn = document.getElementById('shortcutsBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const shortcutsClose = document.getElementById('shortcutsClose');
    if (shortcutsBtn) shortcutsBtn.addEventListener('click', () => { shortcutsModal.style.display = 'flex'; });
    if (shortcutsClose) shortcutsClose.addEventListener('click', () => { shortcutsModal.style.display = 'none'; });
    if (shortcutsModal) shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) shortcutsModal.style.display = 'none'; });

    // Keyboard Shortcuts Registration
    Utils.registerShortcut('Ctrl+1', () => NavigationModule.navigateTo('dashboard'), 'Dashboard');
    Utils.registerShortcut('Ctrl+2', () => NavigationModule.navigateTo('invoices'), 'Invoices');
    Utils.registerShortcut('Ctrl+3', () => NavigationModule.navigateTo('receipt'), 'Money Receipts');
    Utils.registerShortcut('Ctrl+4', () => NavigationModule.navigateTo('customers'), 'Customers');
    Utils.registerShortcut('Ctrl+5', () => NavigationModule.navigateTo('analytics'), 'Analytics');
    Utils.registerShortcut('Ctrl+K', () => NavigationModule.navigateTo('search'), 'Search');
    Utils.registerShortcut('Ctrl+U', () => NavigationModule.navigateTo('users'), 'Users (Super Admin)');
    Utils.registerShortcut('Ctrl+,', () => NavigationModule.navigateTo('settings'), 'Settings');
    Utils.registerShortcut('Ctrl+B', toggleTheme, 'Toggle Theme');
    Utils.registerShortcut('Esc', () => {
      [invModal, recModal, shortcutsModal].forEach(m => { if (m) m.style.display = 'none'; });
    }, 'Close Modal');

    Utils.initShortcuts();
  }

  /* ==================================================================
     15. INITIALIZATION BOOTSTRAP
     ================================================================== */
  function init() {
    AuthModule.init();
    NavigationModule.init();
    InvoiceModule.init();
    ReceiptModule.init();
    UserManagementModule.init();
    CustomersModule.init();
    SearchModule.init();
    SettingsModule.init();
    initGlobalEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
