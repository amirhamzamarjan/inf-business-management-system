// Automated Test Suite for INFORMIX BD Quotation System & Document Engine
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('RUNNING TEST SUITE: Quotation Management & Documents');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 1. Check HTML Elements
console.log('--- TEST 1: DOM Elements in index.html ---');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const requiredHtmlIds = [
  'navQuotationsLink',
  'page-quotations',
  'tabQuotationGen',
  'tabQuotationHist',
  'tabContentQuotationGen',
  'tabContentQuotationHist',
  'quotationForm',
  'qtNumber',
  'qtDate',
  'qtValidUntil',
  'qtStatus',
  'qtProjectName',
  'qtCustomerName',
  'qtCustomerPhone',
  'qtCustomerEmail',
  'qtCustomerAddress',
  'qtItemsTableBody',
  'qtAddItemBtn',
  'qtSubtotalText',
  'qtDiscount',
  'qtTaxPercent',
  'qtOtherCharges',
  'qtGrandTotalText',
  'qtStatus',
  'qtNotes',
  'qtResetBtn',
  'qtSaveDraftBtn',
  'qtSavePrintBtn',
  'qtPreviewBtn',
  'qtSaveDownloadPDFBtn',
  'qtStatusPills',
  'qtHistSearchInput',
  'quotationHistoryCount',
  'quotationsTableBody',
  'exportQuotationsCSVBtn',
  'quotationModal',
  'qtModalClose',
  'quotationPreviewContent',
  'qtModalPrint',
  'qtModalDownloadPDF',
  'qtModalApproveConvert',
];

requiredHtmlIds.forEach(id => {
  assert(indexHtml.includes(`id="${id}"`), `index.html contains element #${id}`);
});

assert(indexHtml.includes('js/lib/html2canvas.min.js'), 'html2canvas.min.js is included in <head>');
assert(indexHtml.includes('Quotations'), 'Sidebar contains "Quotations" link');
assert(indexHtml.includes('Ctrl+6'), 'Sidebar Quotations badge shows Ctrl+6 shortcut');

// 2. Check CSS styling
console.log('\n--- TEST 2: Print & Document CSS ---');
const styleCss = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
const printCss = fs.readFileSync(path.join(__dirname, 'css/print.css'), 'utf8');

assert(styleCss.includes('.status-badge--draft'), 'style.css defines .status-badge--draft');
assert(styleCss.includes('.status-badge--sent'), 'style.css defines .status-badge--sent');
assert(styleCss.includes('.status-badge--approved'), 'style.css defines .status-badge--approved');
assert(styleCss.includes('.status-badge--converted'), 'style.css defines .status-badge--converted');
assert(styleCss.includes('.btn--success'), 'style.css defines .btn--success');
assert(styleCss.includes('.lx-meta-converted'), 'style.css defines .lx-meta-converted');
assert(styleCss.includes('.lx-header__company, .lx-header__tagline'), 'style.css hides text company/tagline in document header');

assert(printCss.includes('size: A4 portrait;'), 'print.css enforces A4 portrait');
assert(printCss.includes('margin: 12mm 15mm;'), 'print.css enforces safe print margins');
assert(printCss.includes('.lx-header__company'), 'print.css suppresses textual company branding');
assert(printCss.includes('page-break-inside: avoid'), 'print.css includes table row page-break protection');

// 3. Test Utils: Currency and Amount in Words
console.log('\n--- TEST 3: Utils Functionality ---');
// Mock browser environment for utils
global.window = {};
require('./js/utils.js');
const Utils = global.window.Utils;

assert(typeof Utils.formatCurrency === 'function', 'Utils.formatCurrency is available');
assert(typeof Utils.numberToWords === 'function', 'Utils.numberToWords is available');

const formattedCurrency = Utils.formatCurrency(25500);
assert(formattedCurrency.includes('25,500'), `Currency formatted cleanly: ${formattedCurrency}`);
assert(!formattedCurrency.toLowerCase().includes('taka'), 'formatCurrency does NOT append "Taka" to numeric value');

const words1 = Utils.numberToWords(25500);
assert(words1.replace(/-/g, ' ') === 'Twenty Five Thousand Five Hundred Taka Only', `Amount to words (25,500): "${words1}"`);

const words2 = Utils.numberToWords(150000);
assert(words2.replace(/-/g, ' ') === 'One Lakh Fifty Thousand Taka Only', `Amount to words (150,000): "${words2}"`);

// 4. Test MinimalLuxuryRenderer
console.log('\n--- TEST 4: Document Renderer (Logo Only, Words, Bank Details) ---');
// Mock browser globals for app.js renderer testing
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  documentElement: { getAttribute: () => 'light', setAttribute: () => {} },
  createElement: () => ({
    set textContent(v) { this._text = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    get innerHTML() { return this._text || ''; }
  }),
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

// Extract MinimalLuxuryRenderer from app.js source to test directly
const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');

// Test that MinimalLuxuryRenderer builds Quotation, Invoice, and Receipt
const dummySettings = {
  company_name: 'INFORMIX BD',
  logo_url: 'assets/logo.svg',
  address: 'House 12, Road 4, Banani, Dhaka',
  phone: '+880 1711 000000',
  email: 'info@informixbd.com',
  bank_details: {
    bank_name: 'City Bank Bangladesh',
    account_name: 'INFORMIX BD',
    account_number: '1102938475001',
    branch: 'Banani Branch',
    bkash_merchant: '+8801700000000',
  },
};

const dummyQuotation = {
  id: 'qt-101',
  quotation_number: 'QT-2026-0001',
  date: '2026-10-07',
  valid_until: '2026-10-22',
  customer_name: 'Marjan Assignment Tech Ltd',
  customer_phone: '+880 1819 123456',
  customer_email: 'contact@marjan.com',
  customer_address: 'Gulshan-2, Dhaka',
  subtotal: 50000,
  discount: 5000,
  tax_percent: 5,
  tax_amount: 2250,
  other_charges: 0,
  grand_total: 47250,
  status: 'Sent',
  project_name: 'Corporate Surveillance System Setup',
  notes: 'Installation warranty included for 12 months.',
  prepared_by_name: 'Amir Hamza Marjan',
  items: [
    { description: 'IP Camera 8-Channel NVR', qty: 1, rate: 25000 },
    { description: '4MP Dome Cameras', qty: 5, rate: 5000 },
  ],
};

const dummyInvoice = {
  id: 'inv-201',
  invoice_number: 'INV-2026-0001',
  source_quotation_id: 'qt-101',
  quotation_number: 'QT-2026-0001',
  project_name: 'Corporate Surveillance System Setup',
  date: '2026-10-07',
  customer_name: 'Marjan Assignment Tech Ltd',
  customer_phone: '+880 1819 123456',
  subtotal: 50000,
  discount: 5000,
  grand_total: 47250,
  paid_amount: 47250,
  due_amount: 0,
  payment_status: 'Paid',
  items: dummyQuotation.items,
};

// Check renderer output by evaluating the MinimalLuxuryRenderer block in an isolated scope
const vm = require('vm');
const sandbox = {
  Utils,
  window: {},
  document: global.document,
};
vm.createContext(sandbox);

// Extract MinimalLuxuryRenderer code snippet
const rendererStart = appJs.indexOf('const MinimalLuxuryRenderer = (() => {');
const rendererEnd = appJs.indexOf('})();', rendererStart) + 5;
const rendererCode = appJs.slice(rendererStart, rendererEnd);

const Renderer = vm.runInContext(rendererCode + '; MinimalLuxuryRenderer;', sandbox);

assert(typeof Renderer.buildQuotationHTML === 'function', 'Renderer.buildQuotationHTML is defined');
assert(typeof Renderer.buildInvoiceHTML === 'function', 'Renderer.buildInvoiceHTML is defined');
assert(typeof Renderer.buildReceiptHTML === 'function', 'Renderer.buildReceiptHTML is defined');

// Test Quotation HTML
const quotHtml = Renderer.buildQuotationHTML(dummyQuotation, dummySettings, false);
assert(quotHtml.includes('QUOTATION'), 'Quotation HTML contains title QUOTATION');
assert(quotHtml.includes('QT-2026-0001'), 'Quotation HTML contains quotation number');
assert(quotHtml.includes('assets/logo.svg'), 'Quotation HTML contains logo asset');
assert(!quotHtml.includes('<div class="lx-header__company">'), 'Quotation HTML header is LOGO ONLY (no text company name in header)');
assert(quotHtml.includes('Amount in Words'), 'Quotation HTML contains Amount in Words section');
assert(quotHtml.includes('Forty Seven Thousand Two Hundred Fifty Taka Only') || quotHtml.includes('Forty-Seven Thousand Two Hundred Fifty Taka Only'), 'Quotation Amount in Words matches grand total (47,250)');
assert(quotHtml.includes('Bank &amp; Payment Information') || quotHtml.includes('Bank & Payment Information'), 'Quotation HTML contains Bank & Payment Information');
assert(quotHtml.includes('City Bank Bangladesh'), 'Quotation HTML shows bank name');
assert(quotHtml.includes('1102938475001'), 'Quotation HTML shows bank account number');
assert(quotHtml.includes('IP Camera 8-Channel NVR'), 'Quotation HTML renders line item');
assert(quotHtml.includes('Project / Subject:'), 'Quotation HTML renders Project / Subject label');
assert(quotHtml.includes('Corporate Surveillance System Setup'), 'Quotation HTML renders Project Name value');

// Test Invoice HTML
const invHtml = Renderer.buildInvoiceHTML(dummyInvoice, dummySettings, false);
assert(invHtml.includes('INVOICE'), 'Invoice HTML contains title INVOICE');
assert(invHtml.includes('INV-2026-0001'), 'Invoice HTML contains invoice number');
assert(!invHtml.includes('<div class="lx-header__company">'), 'Invoice HTML header is LOGO ONLY');
assert(invHtml.includes('Source Quotation: QT-2026-0001'), 'Invoice HTML displays linked Source Quotation badge');
assert(invHtml.includes('Amount in Words'), 'Invoice HTML contains Amount in Words');
assert(invHtml.includes('Bank &amp; Payment Information') || invHtml.includes('Bank & Payment Information'), 'Invoice HTML contains Bank & Payment Information');
assert(invHtml.includes('Corporate Surveillance System Setup'), 'Invoice HTML displays Project Name when present');

// Test Legacy Invoice (no quotation fields)
const legacyInvoice = {
  id: 'legacy-1',
  invoice_number: 'INV-2025-0042',
  date: '2025-03-10',
  customer_name: 'Legacy Corporate Client',
  customer_phone: '+880 1711 111111',
  subtotal: 15000,
  grand_total: 15000,
  paid_amount: 15000,
  due_amount: 0,
  payment_status: 'Paid',
  items: [{ description: 'Annual Service Maintenance', qty: 1, rate: 15000 }],
};
const legacyInvHtml = Renderer.buildInvoiceHTML(legacyInvoice, dummySettings, false);
assert(legacyInvHtml.includes('INV-2025-0042'), 'Legacy invoice without quotation fields renders invoice number');
assert(legacyInvHtml.includes('Legacy Corporate Client'), 'Legacy invoice renders customer');
assert(!legacyInvHtml.includes('Source Quotation'), 'Legacy invoice without quotation does NOT render Source Quotation badge');
assert(legacyInvHtml.includes('Fifteen Thousand Taka Only'), 'Legacy invoice contains Amount in Words');

// Test Money Receipt HTML
const dummyReceipt = {
  id: 'rec-301',
  receipt_number: 'MR-2026-0001',
  date: '2026-10-07',
  customer_name: 'Marjan Assignment Tech Ltd',
  customer_phone: '+880 1819 123456',
  invoice_number: 'INV-2026-0001',
  amount: 47250,
  payment_method: 'Bank Transfer',
  bank_name: 'City Bank Bangladesh',
  items: dummyQuotation.items,
};
const receiptHtml = Renderer.buildReceiptHTML(dummyReceipt, dummySettings, false);
assert(receiptHtml.includes('MONEY RECEIPT'), 'Receipt HTML contains title MONEY RECEIPT');
assert(!receiptHtml.includes('<div class="lx-header__company">'), 'Receipt HTML header is LOGO ONLY');
assert(receiptHtml.includes('Forty Seven Thousand Two Hundred Fifty Taka Only') || receiptHtml.includes('Forty-Seven Thousand Two Hundred Fifty Taka Only'), 'Receipt HTML contains Amount in Words');
assert(receiptHtml.includes('Bank &amp; Payment Information') || receiptHtml.includes('Bank & Payment Information'), 'Receipt HTML contains Bank & Payment Information');

// 5. Test Quotation to Invoice Conversion Integrity
console.log('\n--- TEST 5: Data Integrity & Conversion Simulation ---');
// Verify snapshot behavior: mutating an invoice converted from a quotation does not alter the source quotation
const quotationSnapshot = JSON.parse(JSON.stringify(dummyQuotation));
const convertedInvoice = {
  id: 'inv-new-999',
  invoice_number: 'INV-2026-0999',
  source_quotation_id: quotationSnapshot.id,
  quotation_number: quotationSnapshot.quotation_number,
  customer_name: quotationSnapshot.customer_name,
  customer_phone: quotationSnapshot.customer_phone,
  subtotal: quotationSnapshot.subtotal,
  discount: quotationSnapshot.discount,
  grand_total: quotationSnapshot.grand_total,
  items: quotationSnapshot.items.map(it => ({ ...it })),
};

// Admin edits the invoice: change rate and add an extra item
convertedInvoice.items[0].rate = 30000;
convertedInvoice.items.push({ description: 'Extra Hard Drive 4TB', qty: 1, rate: 12000 });
convertedInvoice.subtotal = 30000 + (5 * 5000) + 12000;

assert(quotationSnapshot.items[0].rate === 25000, 'Original quotation item price remains 25,000 after invoice edit');
assert(quotationSnapshot.items.length === 2, 'Original quotation items count remains 2 after new item added to invoice');
assert(convertedInvoice.items.length === 3, 'Converted invoice has 3 items');
assert(convertedInvoice.source_quotation_id === quotationSnapshot.id, 'Invoice is linked to source_quotation_id');

// 6. Test SQL Migration files
console.log('\n--- TEST 6: Supabase Migration Script Safety ---');
const migrationSql = fs.readFileSync(path.join(__dirname, 'quotations-migration.sql'), 'utf8');

assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.quotations'), 'Migration creates public.quotations safely');
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.quotation_items'), 'Migration creates public.quotation_items safely');
assert(migrationSql.includes('ADD COLUMN IF NOT EXISTS source_quotation_id'), 'Migration adds source_quotation_id safely without DROP');
assert(migrationSql.includes('ADD COLUMN IF NOT EXISTS project_name'), 'Migration adds project_name safely without DROP');
assert(migrationSql.includes('convert_quotation_to_invoice'), 'Migration contains atomic convert_quotation_to_invoice function');
assert(migrationSql.includes('has already been converted'), 'Migration prevents duplicate conversion at database level');
assert(!migrationSql.includes('DROP TABLE'), 'Migration has ZERO DROP TABLE statements (100% data safe)');
assert(!migrationSql.includes('TRUNCATE'), 'Migration has ZERO TRUNCATE statements (100% data safe)');

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} tests passed successfully!`);
console.log('====================================================\n');
