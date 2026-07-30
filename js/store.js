/* ============================================================
   INFORMIX BD — Data Storage Layer (LocalStorage + API-ready)
   ============================================================ */
const Store = (() => {
  const KEYS = {
    customers: 'ix_customers',
    receipts: 'ix_receipts',
    settings: 'ix_settings',
    activities: 'ix_activities',
    drafts: 'ix_drafts',
  };

  const DEFAULT_SETTINGS = {
    companyName: 'INFORMIX BD',
    tagline: 'Security & Surveillance Solutions',
    address: 'Dhaka, Bangladesh',
    phone: '+880 1XXXXXXXXX',
    email: 'info@informixbd.com',
    website: 'www.informixbd.com',
    logo: '',
    terms: [
      'Service charges are non-refundable.',
      'Warranty applies only to specified parts.',
      'Keep this receipt for future support.',
    ],
    currency: '৳',
    receiptPrefix: 'INF',
    theme: 'light',
  };

  /* ---- helpers ---- */
  function _read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  }
  function _write(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    _emit(key, data);
  }
  function _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---- event bus ---- */
  const listeners = {};
  function _emit(key, data) {
    (listeners[key] || []).forEach(fn => fn(data));
  }
  function on(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return () => { listeners[key] = listeners[key].filter(f => f !== fn); };
  }

  /* ---- settings ---- */
  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...(_read(KEYS.settings) || {}) };
  }
  function saveSettings(partial) {
    const current = getSettings();
    const updated = { ...current, ...partial };
    _write(KEYS.settings, updated);
    return updated;
  }

  /* ---- customers ---- */
  function getCustomers() { return _read(KEYS.customers) || []; }
  function getCustomer(id) { return getCustomers().find(c => c.id === id); }
  function getCustomerByPhone(phone) { return getCustomers().find(c => c.phone === phone); }
  function saveCustomer(customer) {
    const list = getCustomers();
    if (customer.id) {
      const idx = list.findIndex(c => c.id === customer.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...customer, updatedAt: new Date().toISOString() };
      else list.push({ ...customer, createdAt: new Date().toISOString() });
    } else {
      customer.id = _id();
      customer.createdAt = new Date().toISOString();
      list.push(customer);
    }
    _write(KEYS.customers, list);
    return customer;
  }
  function deleteCustomer(id) {
    _write(KEYS.customers, getCustomers().filter(c => c.id !== id));
  }

  /* ---- receipts ---- */
  function getReceipts() { return _read(KEYS.receipts) || []; }
  function getReceipt(id) { return getReceipts().find(r => r.id === id); }
  function getReceiptsByCustomer(customerId) {
    return getReceipts().filter(r => r.customerId === customerId);
  }
  function generateReceiptNumber() {
    const now = new Date();
    const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
    const prefix = getSettings().receiptPrefix || 'INF';
    const receipts = getReceipts().filter(r => r.receiptNumber && r.receiptNumber.includes(ym));
    const seq = receipts.length + 1;
    return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
  }
  function saveReceipt(receipt) {
    const list = getReceipts();
    if (!receipt.id) {
      receipt.id = _id();
      receipt.createdAt = new Date().toISOString();
      list.push(receipt);
    } else {
      const idx = list.findIndex(r => r.id === receipt.id);
      if (idx >= 0) { list[idx] = { ...list[idx], ...receipt, updatedAt: new Date().toISOString() }; }
      else { list.push(receipt); }
    }
    _write(KEYS.receipts, list);

    // Auto-create / update customer
    if (receipt.customerName) {
      let customer = receipt.customerId ? getCustomer(receipt.customerId) : getCustomerByPhone(receipt.customerPhone);
      if (!customer) {
        customer = saveCustomer({
          name: receipt.customerName,
          phone: receipt.customerPhone || '',
          address: receipt.customerAddress || '',
        });
      } else {
        saveCustomer({ id: customer.id, name: receipt.customerName, phone: receipt.customerPhone, address: receipt.customerAddress });
      }
      receipt.customerId = customer.id;
    }

    // Log activity
    addActivity({
      type: 'receipt',
      message: `Receipt ${receipt.receiptNumber || ''} created for ${receipt.customerName || 'Unknown'}`,
      amount: receipt.totalAmount || 0,
      receiptId: receipt.id,
    });

    return receipt;
  }
  function deleteReceipt(id) {
    _write(KEYS.receipts, getReceipts().filter(r => r.id !== id));
  }

  /* ---- activities ---- */
  function getActivities() { return _read(KEYS.activities) || []; }
  function addActivity(activity) {
    const list = getActivities();
    activity.id = _id();
    activity.timestamp = new Date().toISOString();
    list.unshift(activity);
    if (list.length > 200) list.length = 200;
    _write(KEYS.activities, list);
  }

  /* ---- drafts ---- */
  function getDraft() { return _read(KEYS.drafts); }
  function saveDraft(data) { _write(KEYS.drafts, data); }
  function clearDraft() { localStorage.removeItem(KEYS.drafts); }

  /* ---- backup / restore ---- */
  function exportAll() {
    const data = {};
    Object.values(KEYS).forEach(k => { data[k] = _read(k); });
    return JSON.stringify(data, null, 2);
  }
  function importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.entries(data).forEach(([k, v]) => { if (v !== null) _write(k, v); });
      return true;
    } catch { return false; }
  }

  /* ---- search ---- */
  function search(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results = [];
    getReceipts().forEach(r => {
      const searchable = [
        r.receiptNumber, r.customerName, r.customerPhone,
        r.deviceModel, r.serviceType, r.deviceName,
      ].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) results.push({ type: 'receipt', data: r });
    });
    getCustomers().forEach(c => {
      const searchable = [c.name, c.phone, c.address].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) results.push({ type: 'customer', data: c });
    });
    return results;
  }

  /* ---- analytics helpers ---- */
  function getMonthlyRevenue(months = 12) {
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const receipts = getReceipts().filter(r => {
        const rd = new Date(r.createdAt);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });
      const revenue = receipts.reduce((s, r) => s + (r.totalAmount || 0), 0);
      const paid = receipts.reduce((s, r) => s + (r.amountPaid || 0), 0);
      const count = receipts.length;
      result.push({ label, ym, revenue, paid, count, pending: revenue - paid });
    }
    return result;
  }
  function getServiceDistribution() {
    const map = {};
    getReceipts().forEach(r => {
      const st = r.serviceType || 'Other';
      map[st] = (map[st] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }
  function getPaymentMethodDistribution() {
    const map = {};
    getReceipts().forEach(r => {
      const pm = r.paymentMethod || 'Cash';
      map[pm] = (map[pm] || 0) + (r.amountPaid || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }

  /* ---- seed demo data ---- */
  function seedIfEmpty() {
    if (getReceipts().length > 0) return;

    const customers = [
      { name: 'Rahman Enterprises', phone: '+8801712345678', address: 'Banani, Dhaka' },
      { name: 'Sarah Tech Solutions', phone: '+8801812345678', address: 'Gulshan, Dhaka' },
      { name: 'Karim Security Ltd', phone: '+8801912345678', address: 'Uttara, Dhaka' },
      { name: 'Dhaka Medical Center', phone: '+8801612345678', address: 'Mirpur, Dhaka' },
      { name: 'City Mart Head Office', phone: '+8801512345678', address: 'Motijheel, Dhaka' },
      { name: 'Green Valley School', phone: '+8801312345678', address: 'Dhanmondi, Dhaka' },
      { name: 'National Bank Tower', phone: '+8801412345678', address: 'Agrabad, Chittagong' },
      { name: 'Royal Hotel & Resort', phone: '+8801212345678', address: 'Cox\'s Bazar' },
    ];

    const serviceTypes = ['CCTV Installation', 'CCTV Repair', 'DVR Setup', 'Network Configuration', 'System Maintenance', 'Access Control', 'IP Camera Setup'];
    const deviceNames = ['Hikvision DVR', 'Dahua NVR', 'Hikvision Camera', 'CP Plus Camera', 'Samsung Camera', 'Axis IP Camera', 'Hikvision Access Control'];
    const deviceModels = ['DS-7108NI-K1', 'DS-7608NI-K2', 'DS-2CD2143G2-I', 'IPC-HDW5442T', 'DS-2DE4A425IWG', 'P3245-V', 'DS-K1T606MFW'];
    const problems = ['No display', 'Night vision not working', 'Recording not saving', 'Network connectivity issue', 'Camera offline', 'Hard disk error', 'Motion detection fault'];
    const workDone = ['Power IC Replaced', 'Firmware Updated', 'HDD Replaced', 'LAN Cable Rerun', 'Camera Realigned', 'Full System Reset', 'New Cable Installation'];
    const paymentMethods = ['Cash', 'Bank', 'Mobile Banking'];
    const receivedBy = ['Admin', 'Manager', 'Technician'];

    const savedCustomers = customers.map(c => saveCustomer(c));
    const receipts = [];

    // Generate 40 receipts spread over last 6 months
    for (let i = 0; i < 40; i++) {
      const monthsAgo = Math.floor(i / 7);
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);
      date.setDate(Math.floor(Math.random() * 28) + 1);
      date.setHours(Math.floor(Math.random() * 12) + 8);

      const customer = savedCustomers[i % savedCustomers.length];
      const amount = Math.floor(Math.random() * 15000) + 2000;
      const isPaid = Math.random() > 0.2;
      const isPartial = !isPaid && Math.random() > 0.5;
      const paid = isPaid ? amount : (isPartial ? Math.floor(amount * 0.5) : 0);

      const receipt = {
        receiptNumber: `INF-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        customerId: customer.id,
        serviceType: serviceTypes[i % serviceTypes.length],
        deviceName: deviceNames[i % deviceNames.length],
        deviceModel: deviceModels[i % deviceModels.length],
        deviceSerial: 'SN-' + String(100000 + i),
        problemDescription: problems[i % problems.length],
        workPerformed: workDone[i % workDone.length],
        totalAmount: amount,
        discount: Math.random() > 0.8 ? Math.floor(amount * 0.1) : 0,
        amountPaid: paid,
        paymentMethod: paymentMethods[i % paymentMethods.length],
        paymentStatus: isPaid ? 'Paid' : (isPartial ? 'Partial' : 'Due'),
        receivedBy: receivedBy[i % receivedBy.length],
        notes: '',
        createdAt: date.toISOString(),
        id: _id() + i,
      };
      receipts.push(receipt);
    }

    _write(KEYS.receipts, receipts);

    // Add some activities
    receipts.slice(0, 10).forEach(r => {
      addActivity({
        type: 'receipt',
        message: `Receipt ${r.receiptNumber} created for ${r.customerName}`,
        amount: r.totalAmount,
        receiptId: r.id,
      });
    });
  }

  return {
    on, getSettings, saveSettings,
    getCustomers, getCustomer, getCustomerByPhone, saveCustomer, deleteCustomer,
    getReceipts, getReceipt, getReceiptsByCustomer, generateReceiptNumber, saveReceipt, deleteReceipt,
    getActivities, addActivity,
    getDraft, saveDraft, clearDraft,
    exportAll, importAll, search,
    getMonthlyRevenue, getServiceDistribution, getPaymentMethodDistribution,
    seedIfEmpty,
  };
})();
