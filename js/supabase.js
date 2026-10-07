/* ====================================================================
   INFORMIX BD — Supabase Client & Backend Service Layer
   Secure Multi-User Database, Auth, RLS, Real-Time Sync & Storage
   ==================================================================== */

const SupabaseService = (() => {
  'use strict';

  // Config Storage Key
  const CONFIG_KEY = 'ix_supabase_config';

  // Default configuration (Connected directly to your Supabase Project)
  const DEFAULT_CONFIG = {
    url: 'https://rclsoeyphxfecarbjqkn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbHNvZXlwaHhmZWNhcmJqcWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTA2NTgsImV4cCI6MjEwNDI4NjY1OH0.MqSdwzuBOTFHVi9nWoRRP3srz_jK5foqNpjqZJlWl3U',
  };

  let client = null;
  let currentProfile = null;
  let isConnected = false;
  let configPromise = null;

  /* ------------------------------------------------------------------
     1. CONFIGURATION & INITIALIZATION
     ------------------------------------------------------------------ */
  async function loadVercelConfig() {
    if (configPromise) return configPromise;
    configPromise = (async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.url && data.anonKey) {
            saveConfig(data.url, data.anonKey);
            return data;
          }
        }
      } catch (_) {}
      return getConfig();
    })();
    return configPromise;
  }

  function getConfig() {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch (_) {}
    return { ...DEFAULT_CONFIG };
  }

  function saveConfig(url, anonKey) {
    const cfg = { url: (url || '').trim(), anonKey: (anonKey || '').trim() };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    initClient();
    return cfg;
  }

  function initClient() {
    const cfg = getConfig();
    if (typeof window.supabase === 'undefined') {
      return null;
    }

    if (!cfg.url || !cfg.anonKey) {
      loadVercelConfig();
      return null;
    }

    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });
      return client;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  // Auto-fetch Vercel config on file load
  loadVercelConfig();

  function getClient() {
    if (!client) initClient();
    return client;
  }

  function isConfigured() {
    const cfg = getConfig();
    return Boolean(cfg.url && cfg.anonKey);
  }

  /* ------------------------------------------------------------------
     2. AUTHENTICATION SERVICES
     ------------------------------------------------------------------ */

  async function signIn(emailOrUsername, password) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    let email = emailOrUsername.trim();
    if (!email.includes('@')) {
      // Username format fallback
      email = `${email.toLowerCase()}@informixbd.com`;
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Fetch and check profile status
    const profile = await fetchProfile(data.user.id);
    if (profile && profile.status === 'inactive') {
      await sb.auth.signOut();
      throw new Error('This account has been disabled. Please contact Super Admin.');
    }

    currentProfile = profile;
    return { session: data.session, user: data.user, profile };
  }

  async function signUp(email, password, fullName, role = 'user') {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const cleanEmail = email.trim();
    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
        },
      },
    });

    if (error) throw error;

    // Profile auto-creates via database trigger, but ensure it's loaded
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      return { user: data.user, profile };
    }
    return data;
  }

  async function signOut() {
    const sb = getClient();
    if (sb) {
      try {
        await sb.auth.signOut();
      } catch (err) {
        console.warn('Error during sign out:', err);
      }
    }
    currentProfile = null;
  }

  async function getSession() {
    const sb = getClient();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      return data.session;
    } catch (_) {
      return null;
    }
  }

  async function getCurrentUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function fetchProfile(userId) {
    const sb = getClient();
    if (!sb || !userId) return null;

    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Fallback for newly created profile if trigger delay occurs
        const user = await getCurrentUser();
        if (user && user.id === userId) {
          return {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email.split('@')[0],
            role: user.user_metadata?.role || 'super_admin',
            status: 'active',
          };
        }
        return null;
      }
      return data;
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
      return null;
    }
  }

  async function getCurrentProfile() {
    if (currentProfile) return currentProfile;
    const user = await getCurrentUser();
    if (!user) return null;
    currentProfile = await fetchProfile(user.id);
    return currentProfile;
  }

  function onAuthStateChange(callback) {
    const sb = getClient();
    if (!sb) return { unsubscribe: () => {} };
    const { data } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        currentProfile = await fetchProfile(session.user.id);
      } else {
        currentProfile = null;
      }
      callback(event, session, currentProfile);
    });
    return data.subscription;
  }

  /* ------------------------------------------------------------------
     3. SUPER ADMIN USER MANAGEMENT
     ------------------------------------------------------------------ */

  async function listUsers() {
    const sb = getClient();
    if (!sb) return [];

    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function createManagedUser(email, password, fullName, role = 'user') {
    const sb = getClient();
    if (!sb) throw new Error('Supabase is not initialized');

    // Create user via signUp or Supabase Admin endpoint
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
        },
      },
    });

    if (error) throw error;
    return data.user;
  }

  async function updateProfile(userId, updates) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase is not initialized');

    const cleanUpdates = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await sb
      .from('profiles')
      .update(cleanUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    if (currentProfile && currentProfile.id === userId) {
      currentProfile = { ...currentProfile, ...data };
    }
    return data;
  }

  async function toggleUserStatus(userId, newStatus) {
    return updateProfile(userId, { status: newStatus });
  }

  async function deleteUser(userId) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase is not initialized');

    // Delete profile record (cascades or cleans up)
    const { error } = await sb
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------
     4. BUSINESS SETTINGS SERVICES
     ------------------------------------------------------------------ */

  const DEFAULT_BUSINESS_SETTINGS = {
    company_name: 'INFORMIX BD',
    tagline: 'Security & Surveillance Solutions',
    address: 'Dhaka, Bangladesh',
    phone: '+880 1XXXXXXXXX',
    email: 'info@informixbd.com',
    website: 'www.informixbd.com',
    logo_url: 'assets/logo.svg',
    currency: '৳',
    invoice_prefix: 'INV',
    receipt_prefix: 'INF',
    quotation_prefix: 'QT',
    invoice_sequence: 1,
    receipt_sequence: 1,
    quotation_sequence: 1,
    terms: [
      'Payment is due upon receipt of invoice.',
      'Warranty applies only to specified parts and equipment.',
      'Keep this document for future warranty and service reference.',
    ],
    bank_details: {
      bank_name: 'City Bank Bangladesh',
      account_name: 'INFORMIX BD',
      account_number: '1102938475001',
      branch: 'Banani Branch',
      routing_number: '225271983',
      bkash_merchant: '+8801700000000',
    },
  };

  async function getSettings() {
    const sb = getClient();
    if (!sb) return { ...DEFAULT_BUSINESS_SETTINGS };

    try {
      const { data, error } = await sb
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) return { ...DEFAULT_BUSINESS_SETTINGS };
      return { ...DEFAULT_BUSINESS_SETTINGS, ...data };
    } catch (_) {
      return { ...DEFAULT_BUSINESS_SETTINGS };
    }
  }

  async function updateSettings(settingsUpdates) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    // Fetch existing row ID
    const current = await getSettings();
    const payload = {
      ...settingsUpdates,
      updated_at: new Date().toISOString(),
    };

    if (current.id) {
      const { data, error } = await sb
        .from('business_settings')
        .update(payload)
        .eq('id', current.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await sb
        .from('business_settings')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  async function uploadLogoFile(file) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    try {
      const { error: uploadError } = await sb.storage
        .from('business-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.warn('Storage upload error, falling back to base64 data URL:', uploadError);
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const { data } = sb.storage.from('business-assets').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.warn('Storage error, falling back to base64 data URL:', err);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  }

  /* ------------------------------------------------------------------
     5. CUSTOMERS SERVICES
     ------------------------------------------------------------------ */

  async function getCustomers(searchQuery = '') {
    const sb = getClient();
    if (!sb) return [];

    let query = sb
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,address.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function getCustomer(id) {
    const sb = getClient();
    if (!sb || !id) return null;

    const { data, error } = await sb
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async function saveCustomer(customerData) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const profile = await getCurrentProfile();
    const payload = {
      name: (customerData.name || '').trim(),
      phone: (customerData.phone || '').trim(),
      email: (customerData.email || '').trim(),
      address: (customerData.address || '').trim(),
      notes: (customerData.notes || '').trim(),
      updated_at: new Date().toISOString(),
    };

    if (customerData.id) {
      const { data, error } = await sb
        .from('customers')
        .update(payload)
        .eq('id', customerData.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      payload.created_by = profile ? profile.id : null;
      const { data, error } = await sb
        .from('customers')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  async function deleteCustomer(id) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const { error } = await sb
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------
     6. INVOICES SERVICES
     ------------------------------------------------------------------ */

  async function getNextInvoiceNumber() {
    const sb = getClient();
    if (!sb) {
      const year = new Date().getFullYear();
      return `INV-${year}-000001`;
    }

    try {
      const { data, error } = await sb.rpc('get_next_invoice_number');
      if (!error && data) return data;
    } catch (_) {}

    // Client-side fallback if RPC is unavailable
    const s = await getSettings();
    const prefix = s.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    const { count } = await sb.from('invoices').select('id', { count: 'exact', head: true });
    const seq = (count || 0) + 1;
    return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
  }

  async function getInvoices(filters = {}) {
    const sb = getClient();
    if (!sb) return [];

    let query = sb
      .from('invoices')
      .select('*, invoice_items(*)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'All') {
      query = query.eq('payment_status', filters.status);
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters.search) {
      const s = filters.search.trim();
      query = query.or(`invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function getInvoice(id) {
    const sb = getClient();
    if (!sb || !id) return null;

    const { data, error } = await sb
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async function saveInvoice(invoiceData, items = []) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const profile = await getCurrentProfile();
    const preparedByName = profile ? profile.full_name : 'Staff';
    const preparedById = profile ? profile.id : null;

    // Auto-create/link customer if customerName provided
    let customerId = invoiceData.customer_id;
    if (!customerId && invoiceData.customer_name) {
      const existing = await getCustomers(invoiceData.customer_name);
      const match = existing.find(c => c.name.toLowerCase() === invoiceData.customer_name.toLowerCase() || (c.phone && c.phone === invoiceData.customer_phone));
      if (match) {
        customerId = match.id;
      } else {
        const newCust = await saveCustomer({
          name: invoiceData.customer_name,
          phone: invoiceData.customer_phone,
          email: invoiceData.customer_email,
          address: invoiceData.customer_address,
        });
        customerId = newCust.id;
      }
    }

    const payload = {
      invoice_number: invoiceData.invoice_number,
      date: invoiceData.date || new Date().toISOString().split('T')[0],
      due_date: invoiceData.due_date || null,
      customer_id: customerId || null,
      customer_name: (invoiceData.customer_name || '').trim(),
      customer_phone: (invoiceData.customer_phone || '').trim(),
      customer_address: (invoiceData.customer_address || '').trim(),
      customer_email: (invoiceData.customer_email || '').trim(),
      subtotal: Number(invoiceData.subtotal) || 0,
      discount: Number(invoiceData.discount) || 0,
      tax_percent: Number(invoiceData.tax_percent) || 0,
      tax_amount: Number(invoiceData.tax_amount) || 0,
      other_charges: Number(invoiceData.other_charges) || 0,
      grand_total: Number(invoiceData.grand_total) || 0,
      paid_amount: Number(invoiceData.paid_amount) || 0,
      due_amount: Number(invoiceData.due_amount) || 0,
      payment_method: invoiceData.payment_method || 'Cash',
      payment_status: invoiceData.payment_status || 'Due',
      notes: (invoiceData.notes || '').trim(),
      terms: invoiceData.terms || [],
      prepared_by_name: invoiceData.prepared_by_name || preparedByName,
      prepared_by_id: invoiceData.prepared_by_id || preparedById,
      updated_at: new Date().toISOString(),
    };

    if (invoiceData.source_quotation_id) {
      payload.source_quotation_id = invoiceData.source_quotation_id;
    }
    if (invoiceData.project_name) {
      payload.project_name = (invoiceData.project_name || '').trim();
    }

    let savedInvoice = null;

    async function executeInvoiceSave(p) {
      if (invoiceData.id) {
        return sb
          .from('invoices')
          .update(p)
          .eq('id', invoiceData.id)
          .select()
          .single();
      } else {
        return sb
          .from('invoices')
          .insert([p])
          .select()
          .single();
      }
    }

    let saveRes = await executeInvoiceSave(payload);
    // Backward-compatibility: If database has not yet added source_quotation_id or project_name column, retry safely
    if (saveRes.error && (saveRes.error.code === '42703' || saveRes.error.message?.includes('source_quotation_id') || saveRes.error.message?.includes('project_name'))) {
      if (payload.project_name && saveRes.error.message?.includes('project_name')) delete payload.project_name;
      if (payload.source_quotation_id && saveRes.error.message?.includes('source_quotation_id')) delete payload.source_quotation_id;
      saveRes = await executeInvoiceSave(payload);
    }
    if (saveRes.error) throw saveRes.error;
    savedInvoice = saveRes.data;

    if (invoiceData.id) {
      // Delete old items and insert updated items
      await sb.from('invoice_items').delete().eq('invoice_id', invoiceData.id);
    }

    // Insert line items
    if (items && items.length > 0) {
      const itemRows = items.map((it, idx) => ({
        invoice_id: savedInvoice.id,
        description: (it.description || it.name || '').trim(),
        qty: Number(it.qty) || 1,
        rate: Number(it.rate || it.unitPrice) || 0,
        total: (Number(it.qty) || 1) * (Number(it.rate || it.unitPrice) || 0),
        sort_order: idx,
      }));

      const { error: itemError } = await sb.from('invoice_items').insert(itemRows);
      if (itemError) console.error('Error inserting invoice items:', itemError);
    }

    // Log Activity
    await logActivity({
      type: 'invoice',
      message: `Invoice ${savedInvoice.invoice_number} generated for ${savedInvoice.customer_name}`,
      amount: savedInvoice.grand_total,
      entity_type: 'invoice',
      entity_id: savedInvoice.id,
    });

    return getInvoice(savedInvoice.id);
  }

  async function deleteInvoice(id) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const { error } = await sb
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------
     6.5. QUOTATIONS SERVICES
     ------------------------------------------------------------------ */

  async function getNextQuotationNumber() {
    const sb = getClient();
    if (!sb) {
      const year = new Date().getFullYear();
      return `QT-${year}-000001`;
    }

    try {
      const { data, error } = await sb.rpc('get_next_quotation_number');
      if (!error && data) return data;
    } catch (_) {}

    // Fallback if RPC is unavailable
    const s = await getSettings();
    const prefix = s.quotation_prefix || 'QT';
    const year = new Date().getFullYear();
    try {
      const { count } = await sb.from('quotations').select('id', { count: 'exact', head: true });
      const seq = (count || 0) + 1;
      return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
    } catch (_) {
      return `${prefix}-${year}-000001`;
    }
  }

  async function getQuotations(filters = {}) {
    const sb = getClient();
    if (!sb) return [];

    try {
      let query = sb
        .from('quotations')
        .select('*, quotation_items(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'All') {
        query = query.eq('status', filters.status);
      }
      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(`quotation_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,project_name.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.warn('Could not fetch quotations from Supabase:', err);
      return [];
    }
  }

  async function getQuotation(id) {
    const sb = getClient();
    if (!sb || !id) return null;

    try {
      const { data, error } = await sb
        .from('quotations')
        .select('*, quotation_items(*)')
        .eq('id', id)
        .single();

      if (error) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function saveQuotation(quotationData, items = []) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const profile = await getCurrentProfile();
    const preparedByName = profile ? profile.full_name : 'Staff';
    const preparedById = profile ? profile.id : null;

    // Auto-create/link customer if customerName provided
    let customerId = quotationData.customer_id;
    if (!customerId && quotationData.customer_name) {
      const existing = await getCustomers(quotationData.customer_name);
      const match = existing.find(c => c.name.toLowerCase() === quotationData.customer_name.toLowerCase() || (c.phone && c.phone === quotationData.customer_phone));
      if (match) {
        customerId = match.id;
      } else {
        const newCust = await saveCustomer({
          name: quotationData.customer_name,
          phone: quotationData.customer_phone,
          email: quotationData.customer_email,
          address: quotationData.customer_address,
        });
        customerId = newCust.id;
      }
    }

    const payload = {
      quotation_number: quotationData.quotation_number,
      date: quotationData.date || new Date().toISOString().split('T')[0],
      valid_until: quotationData.valid_until || null,
      customer_id: customerId || null,
      customer_name: (quotationData.customer_name || '').trim(),
      customer_phone: (quotationData.customer_phone || '').trim(),
      customer_address: (quotationData.customer_address || '').trim(),
      customer_email: (quotationData.customer_email || '').trim(),
      subtotal: Number(quotationData.subtotal) || 0,
      discount: Number(quotationData.discount) || 0,
      tax_percent: Number(quotationData.tax_percent) || 0,
      tax_amount: Number(quotationData.tax_amount) || 0,
      other_charges: Number(quotationData.other_charges) || 0,
      grand_total: Number(quotationData.grand_total) || 0,
      status: quotationData.status || 'Draft',
      notes: (quotationData.notes || '').trim(),
      terms: quotationData.terms || [],
      prepared_by_name: quotationData.prepared_by_name || preparedByName,
      prepared_by_id: quotationData.prepared_by_id || preparedById,
      updated_at: new Date().toISOString(),
    };

    if (quotationData.converted_invoice_id) {
      payload.converted_invoice_id = quotationData.converted_invoice_id;
    }
    if (quotationData.converted_invoice_number) {
      payload.converted_invoice_number = quotationData.converted_invoice_number;
    }
    if (quotationData.project_name) {
      payload.project_name = (quotationData.project_name || '').trim();
    }

    let savedQuotation = null;

    async function executeQuotationSave(p) {
      if (quotationData.id) {
        return sb
          .from('quotations')
          .update(p)
          .eq('id', quotationData.id)
          .select()
          .single();
      } else {
        return sb
          .from('quotations')
          .insert([p])
          .select()
          .single();
      }
    }

    let saveRes = await executeQuotationSave(payload);
    if (saveRes.error && (saveRes.error.code === '42703' || saveRes.error.message?.includes('project_name')) && payload.project_name) {
      delete payload.project_name;
      saveRes = await executeQuotationSave(payload);
    }
    if (saveRes.error) throw saveRes.error;
    savedQuotation = saveRes.data;

    if (quotationData.id) {
      await sb.from('quotation_items').delete().eq('quotation_id', quotationData.id);
    }

    // Insert line items
    if (items && items.length > 0) {
      const itemRows = items.map((it, idx) => ({
        quotation_id: savedQuotation.id,
        description: (it.description || it.name || '').trim(),
        qty: Number(it.qty) || 1,
        rate: Number(it.rate || it.unitPrice) || 0,
        total: (Number(it.qty) || 1) * (Number(it.rate || it.unitPrice) || 0),
        sort_order: idx,
      }));

      const { error: itemError } = await sb.from('quotation_items').insert(itemRows);
      if (itemError) console.error('Error inserting quotation items:', itemError);
    }

    // Log Activity
    await logActivity({
      type: 'quotation',
      message: `Quotation ${savedQuotation.quotation_number} created for ${savedQuotation.customer_name}`,
      amount: savedQuotation.grand_total,
      entity_type: 'quotation',
      entity_id: savedQuotation.id,
    });

    return getQuotation(savedQuotation.id);
  }

  async function deleteQuotation(id) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const { error } = await sb
      .from('quotations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async function convertQuotationToInvoice(quotationId) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    // 1. Try atomic PostgreSQL RPC first
    try {
      const { data, error } = await sb.rpc('convert_quotation_to_invoice', { p_quotation_id: quotationId });
      if (!error && data && data.success) {
        return data;
      }
    } catch (_) {}

    // 2. Safe client-side fallback
    const q = await getQuotation(quotationId);
    if (!q) throw new Error('Quotation not found');

    if (q.converted_invoice_id) {
      throw new Error(`Quotation has already been converted to invoice ${q.converted_invoice_number || ''}`);
    }

    const invNumber = await getNextInvoiceNumber();

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

    const items = (q.quotation_items || []).map(it => ({
      description: it.description,
      qty: it.qty,
      rate: it.rate,
    }));

    const savedInvoice = await saveInvoice(invPayload, items);

    // Update quotation status and link
    try {
      await sb
        .from('quotations')
        .update({
          status: 'Converted to Invoice',
          converted_invoice_id: savedInvoice.id,
          converted_invoice_number: savedInvoice.invoice_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', q.id);
    } catch (uErr) {
      console.warn('Could not update quotation converted status in Supabase:', uErr);
    }

    await logActivity({
      type: 'invoice',
      message: `Quotation ${q.quotation_number} converted to Invoice ${savedInvoice.invoice_number}`,
      amount: savedInvoice.grand_total,
      entity_type: 'invoice',
      entity_id: savedInvoice.id,
    });

    return {
      success: true,
      invoice_id: savedInvoice.id,
      invoice_number: savedInvoice.invoice_number,
      quotation_id: q.id,
    };
  }

  /* ------------------------------------------------------------------
     7. MONEY RECEIPTS SERVICES
     ------------------------------------------------------------------ */

  async function getNextReceiptNumber() {
    const sb = getClient();
    if (!sb) {
      const now = new Date();
      const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
      return `INF-${ym}-0001`;
    }

    try {
      const { data, error } = await sb.rpc('get_next_receipt_number');
      if (!error && data) return data;
    } catch (_) {}

    const s = await getSettings();
    const prefix = s.receipt_prefix || 'INF';
    const now = new Date();
    const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
    const { count } = await sb.from('money_receipts').select('id', { count: 'exact', head: true });
    const seq = (count || 0) + 1;
    return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
  }

  async function getReceipts(filters = {}) {
    const sb = getClient();
    if (!sb) return [];

    let query = sb
      .from('money_receipts')
      .select('*, receipt_items(*)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'All') {
      query = query.eq('payment_status', filters.status);
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters.search) {
      const s = filters.search.trim();
      query = query.or(`receipt_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,device_name.ilike.%${s}%,service_type.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function getReceipt(id) {
    const sb = getClient();
    if (!sb || !id) return null;

    const { data, error } = await sb
      .from('money_receipts')
      .select('*, receipt_items(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async function saveReceipt(receiptData, items = []) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const profile = await getCurrentProfile();
    const preparedByName = profile ? profile.full_name : 'Staff';
    const preparedById = profile ? profile.id : null;

    // Link or create customer
    let customerId = receiptData.customer_id;
    if (!customerId && receiptData.customer_name) {
      const existing = await getCustomers(receiptData.customer_name);
      const match = existing.find(c => c.name.toLowerCase() === receiptData.customer_name.toLowerCase() || (c.phone && c.phone === receiptData.customer_phone));
      if (match) {
        customerId = match.id;
      } else {
        const newCust = await saveCustomer({
          name: receiptData.customer_name,
          phone: receiptData.customer_phone,
          address: receiptData.customer_address,
        });
        customerId = newCust.id;
      }
    }

    const payload = {
      receipt_number: receiptData.receipt_number,
      date: receiptData.date || new Date().toISOString().split('T')[0],
      customer_id: customerId || null,
      customer_name: (receiptData.customer_name || '').trim(),
      customer_phone: (receiptData.customer_phone || '').trim(),
      customer_address: (receiptData.customer_address || '').trim(),
      service_type: (receiptData.service_type || '').trim(),
      device_name: (receiptData.device_name || '').trim(),
      device_model: (receiptData.device_model || '').trim(),
      device_serial: (receiptData.device_serial || '').trim(),
      problem_description: (receiptData.problem_description || '').trim(),
      work_performed: (receiptData.work_performed || '').trim(),
      total_amount: Number(receiptData.total_amount) || 0,
      discount: Number(receiptData.discount) || 0,
      amount_paid: Number(receiptData.amount_paid) || 0,
      due_amount: Number(receiptData.due_amount) || 0,
      payment_method: receiptData.payment_method || 'Cash',
      payment_status: receiptData.payment_status || 'Paid',
      received_by: (receiptData.received_by || '').trim(),
      notes: (receiptData.notes || '').trim(),
      invoice_id: receiptData.invoice_id || null,
      prepared_by_name: receiptData.prepared_by_name || preparedByName,
      prepared_by_id: receiptData.prepared_by_id || preparedById,
      updated_at: new Date().toISOString(),
    };

    let savedReceipt = null;

    if (receiptData.id) {
      const { data, error } = await sb
        .from('money_receipts')
        .update(payload)
        .eq('id', receiptData.id)
        .select()
        .single();
      if (error) throw error;
      savedReceipt = data;

      await sb.from('receipt_items').delete().eq('receipt_id', receiptData.id);
    } else {
      const { data, error } = await sb
        .from('money_receipts')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      savedReceipt = data;
    }

    // Insert items
    if (items && items.length > 0) {
      const itemRows = items.map((it, idx) => ({
        receipt_id: savedReceipt.id,
        description: (it.description || it.name || '').trim(),
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price || it.unitPrice || it.price) || 0,
        total: (Number(it.qty) || 1) * (Number(it.unit_price || it.unitPrice || it.price) || 0),
        sort_order: idx,
      }));

      const { error: itemError } = await sb.from('receipt_items').insert(itemRows);
      if (itemError) console.error('Error inserting receipt items:', itemError);
    }

    await logActivity({
      type: 'receipt',
      message: `Receipt ${savedReceipt.receipt_number} created for ${savedReceipt.customer_name}`,
      amount: savedReceipt.total_amount,
      entity_type: 'receipt',
      entity_id: savedReceipt.id,
    });

    return getReceipt(savedReceipt.id);
  }

  async function deleteReceipt(id) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase client is not initialized');

    const { error } = await sb
      .from('money_receipts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------
     8. ACTIVITIES & AUDIT LOG SERVICES
     ------------------------------------------------------------------ */

  async function getActivities(limit = 20) {
    const sb = getClient();
    if (!sb) return [];

    const { data, error } = await sb
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  }

  async function logActivity(activity) {
    const sb = getClient();
    if (!sb) return null;

    const profile = await getCurrentProfile();
    const payload = {
      user_id: profile ? profile.id : null,
      type: activity.type || 'system',
      message: activity.message || '',
      amount: activity.amount ? Number(activity.amount) : null,
      entity_type: activity.entity_type || null,
      entity_id: activity.entity_id || null,
      created_at: new Date().toISOString(),
    };

    try {
      const { data } = await sb.from('activities').insert([payload]).select().single();
      return data;
    } catch (_) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
     9. SEARCH SERVICE
     ------------------------------------------------------------------ */
  async function searchAll(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const [invoices, receipts, customers, quotations] = await Promise.all([
      getInvoices({ search: q }),
      getReceipts({ search: q }),
      getCustomers(q),
      getQuotations({ search: q }),
    ]);

    invoices.forEach(inv => results.push({ type: 'invoice', data: inv }));
    receipts.forEach(r => results.push({ type: 'receipt', data: r }));
    customers.forEach(c => results.push({ type: 'customer', data: c }));
    quotations.forEach(qItem => results.push({ type: 'quotation', data: qItem }));

    return results;
  }

  return {
    getConfig,
    saveConfig,
    isConfigured,
    getClient,
    // Auth
    signIn,
    signUp,
    signOut,
    getSession,
    getCurrentUser,
    getCurrentProfile,
    onAuthStateChange,
    // Users (Super Admin)
    listUsers,
    createManagedUser,
    updateProfile,
    toggleUserStatus,
    deleteUser,
    // Settings
    getSettings,
    updateSettings,
    uploadLogoFile,
    // Customers
    getCustomers,
    getCustomer,
    saveCustomer,
    deleteCustomer,
    // Invoices
    getNextInvoiceNumber,
    getInvoices,
    getInvoice,
    saveInvoice,
    deleteInvoice,
    // Quotations
    getNextQuotationNumber,
    getQuotations,
    getQuotation,
    saveQuotation,
    deleteQuotation,
    convertQuotationToInvoice,
    // Receipts
    getNextReceiptNumber,
    getReceipts,
    getReceipt,
    saveReceipt,
    deleteReceipt,
    // Activities
    getActivities,
    logActivity,
    // Search
    searchAll,
  };
})();

if (typeof window !== 'undefined') {
  window.SupabaseService = SupabaseService;
}
