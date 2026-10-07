// Automated Test Suite for INFORMIX BD Company Pad / Letterhead System
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('===========================================================');
console.log('RUNNING TEST SUITE: Company Pad / Premium Corporate Letterhead');
console.log('===========================================================\n');

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

// -------------------------------------------------------------
// 1. Check HTML Elements in index.html
// -------------------------------------------------------------
console.log('--- TEST 1: DOM Elements in index.html ---');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const requiredPadIds = [
  'navCompanyPadLink',
  'page-company-pad',
  'tabPadCreator',
  'tabPadHistory',
  'tabContentPadCreator',
  'tabContentPadHistory',
  'companyPadForm',
  'padNumber',
  'padDate',
  'padRefNo',
  'padStatus',
  'padRecipientName',
  'padRecipientAddress',
  'padTopic',
  'padTemplateSelect',
  'padContentEditor',
  'padContent',
  'padIncludeSignBlock',
  'padSignatoryName',
  'padSignatoryTitle',
  'padResetBtn',
  'padSaveDraftBtn',
  'padPreviewBtn',
  'padSavePrintBtn',
  'padSaveDownloadPDFBtn',
  'padHistSearchInput',
  'padStatusPills',
  'padHistoryCount',
  'padsTableBody',
  'exportPadsCSVBtn',
  'companyPadModal',
  'padModalClose',
  'companyPadPreviewContent',
  'padModalPrint',
  'padModalDownloadPDF'
];

requiredPadIds.forEach(id => {
  assert(indexHtml.includes(`id="${id}"`), `index.html contains element #${id}`);
});

assert(indexHtml.includes('Letterhead / Pad') || indexHtml.includes('Company Pad'), 'Sidebar contains Company Pad / Letterhead navigation item');
assert(indexHtml.includes('Ctrl+7'), 'Shortcut Ctrl+7 registered for Company Pad in sidebar/modal');
assert(indexHtml.includes('data-command="bold"'), 'Rich-text toolbar includes Bold button');
assert(indexHtml.includes('data-command="italic"'), 'Rich-text toolbar includes Italic button');
assert(indexHtml.includes('data-command="underline"'), 'Rich-text toolbar includes Underline button');
assert(indexHtml.includes('data-command="formatBlock"'), 'Rich-text toolbar includes heading formatBlock buttons');
assert(indexHtml.includes('data-command="insertUnorderedList"'), 'Rich-text toolbar includes bullet list button');
assert(indexHtml.includes('data-command="insertOrderedList"'), 'Rich-text toolbar includes numbered list button');
assert(indexHtml.includes('data-command="justifyLeft"'), 'Rich-text toolbar includes alignment buttons');
assert(indexHtml.includes('data-command="insertHorizontalRule"'), 'Rich-text toolbar includes divider button');
assert(indexHtml.includes('data-command="removeFormat"'), 'Rich-text toolbar includes clear formatting button');

// -------------------------------------------------------------
// 2. Check CSS Architecture & Color Discipline
// -------------------------------------------------------------
console.log('\n--- TEST 2: CSS Styles & Luxury Color Hierarchy ---');
const styleCss = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
const printCss = fs.readFileSync(path.join(__dirname, 'css/print.css'), 'utf8');

assert(styleCss.includes('.company-pad-document'), 'style.css defines .company-pad-document container');
assert(styleCss.includes('.cp-header'), 'style.css defines .cp-header');
assert(styleCss.includes('.cp-brand-bar'), 'style.css defines .cp-brand-bar composite brand bar');
assert(styleCss.includes('.cp-bar-black'), 'style.css defines .cp-bar-black structural line');
assert(styleCss.includes('.cp-bar-red'), 'style.css defines .cp-bar-red brand accent');
assert(styleCss.includes('.cp-bar-cyan'), 'style.css defines .cp-bar-cyan micro-accent');
assert(styleCss.includes('.cp-topic-title'), 'style.css defines .cp-topic-title typography & accent border');
assert(styleCss.includes('.cp-content-body'), 'style.css defines .cp-content-body typography & line height');
assert(styleCss.includes('.cp-signoff-block'), 'style.css defines .cp-signoff-block signature section');
assert(styleCss.includes('.cp-footer'), 'style.css defines .cp-footer');
assert(styleCss.includes('.pad-editor-toolbar'), 'style.css defines .pad-editor-toolbar');
assert(styleCss.includes('.pad-rich-editor'), 'style.css defines .pad-rich-editor');
assert(styleCss.includes('.status-badge--official-notice'), 'style.css defines .status-badge--official-notice');
assert(styleCss.includes('.status-badge--final'), 'style.css defines .status-badge--final');
assert(styleCss.includes('.status-badge--issued'), 'style.css defines .status-badge--issued');

// Check Cyan restraint in style.css: should NOT be used for document backgrounds or large fills
const cyanBackgroundMatches = (styleCss.match(/\.company-pad-document[\s\S]*?background(?:-color)?:\s*[^;]*cyan/gi) || []);
assert(cyanBackgroundMatches.length === 0, 'Cyan is strictly restrained and NEVER used as a document background');

// Print CSS
assert(printCss.includes('.company-pad-document'), 'print.css defines print rules for .company-pad-document');
assert(printCss.includes('size: A4 portrait;'), 'print.css enforces A4 portrait');
assert(printCss.includes('margin: 12mm 15mm;'), 'print.css defines safe office print margins');
assert(printCss.includes('-webkit-print-color-adjust: exact') || printCss.includes('print-color-adjust: exact'), 'print.css enforces exact color reproduction');
assert(printCss.includes('break-inside: avoid') || printCss.includes('page-break-inside: avoid'), 'print.css protects headers and signatory block from splitting across pages');

// -------------------------------------------------------------
// 3. Check MinimalLuxuryRenderer.buildCompanyPadHTML
// -------------------------------------------------------------
console.log('\n--- TEST 3: Document Renderer (buildCompanyPadHTML) ---');

// Mock browser globals before loading utils
global.window = {};
global.document = {
  createElement: () => ({
    set textContent(v) { this._text = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    get innerHTML() { return this._text || ''; }
  }),
};
require('./js/utils.js');
const Utils = global.window.Utils;

const dummySettings = {
  company_name: 'INFORMIX BD',
  tagline: 'Leading Business Technology Solutions',
  logo_url: 'assets/logo.svg',
  address: 'House 12, Road 4, Banani, Dhaka-1213, Bangladesh',
  phone: '+880 1711 000000 / +880 1819 000000',
  email: 'official@informixbd.com',
  website: 'www.informixbd.com',
};

const dummyPad = {
  id: 'pad-uuid-001',
  pad_number: 'PAD-2026-000001',
  date: '2026-10-07',
  reference_no: 'INF/ENG/2026/042',
  topic: 'Corporate Fiber-Optic Backbone & CCTV Surveillance Agreement',
  recipient_name: 'Apex Holdings International Ltd',
  recipient_address: 'Gulshan Tower, Level 14, Plot 8, Road 133, Gulshan-1, Dhaka',
  status: 'Official Notice',
  content: '<p>This official communication confirms the execution parameters of the turn-key telecommunication and security deployment.</p><h3>1. Scope of Operations</h3><p>All core distribution routers and primary optical switches will be commissioned within 14 business days.</p>',
  include_sign_block: true,
  signatory_name: 'Amir Hamza Marjan',
  signatory_title: 'Chief Technology Officer',
  prepared_by_name: 'Corporate Desk',
};

const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const sandbox = {
  Utils,
  window: {},
  document: global.document,
};
vm.createContext(sandbox);

const rendererStart = appJs.indexOf('const MinimalLuxuryRenderer = (() => {');
const rendererEnd = appJs.indexOf('})();', rendererStart) + 5;
const rendererCode = appJs.slice(rendererStart, rendererEnd);

const Renderer = vm.runInContext(rendererCode + '; MinimalLuxuryRenderer;', sandbox);

assert(typeof Renderer.buildCompanyPadHTML === 'function', 'Renderer.buildCompanyPadHTML is defined');

const padHtml = Renderer.buildCompanyPadHTML(dummyPad, dummySettings, false);

assert(padHtml.includes('assets/logo.svg'), 'Pad HTML automatically renders corporate logo asset');
assert(padHtml.includes('PAD-2026-000001'), 'Pad HTML contains sequential pad number');
assert(padHtml.includes('INF/ENG/2026/042'), 'Pad HTML contains official reference number');
assert(padHtml.includes(Utils.formatDate(dummyPad.date)), `Pad HTML contains formatted document date (${Utils.formatDate(dummyPad.date)})`);
assert(padHtml.includes('Apex Holdings International Ltd'), 'Pad HTML contains recipient name');
assert(padHtml.includes('Gulshan Tower'), 'Pad HTML contains recipient address');
assert(padHtml.includes(Utils.esc(dummyPad.topic)), 'Pad HTML renders prominent Topic / Project Name');
assert(padHtml.includes('Scope of Operations'), 'Pad HTML renders formatted rich-text content');
assert(padHtml.includes('cp-bar-black') && padHtml.includes('cp-bar-red') && padHtml.includes('cp-bar-cyan'), 'Pad HTML renders composite brand bar (Black structural + Red brand + Cyan micro-accent)');
assert(padHtml.includes('Amir Hamza Marjan') && padHtml.includes('Chief Technology Officer'), 'Pad HTML renders signatory name and title');
assert(padHtml.includes('+880 1711 000000'), 'Pad HTML automatically renders official phone from settings');
assert(padHtml.includes('official@informixbd.com'), 'Pad HTML automatically renders official email from settings');
assert(padHtml.includes('www.informixbd.com'), 'Pad HTML automatically renders website from settings');

// Verify requirement: Logo is preserved, but no duplicate giant advertisement text header
const hasHugeAdHeader = padHtml.includes('<h1 class="lx-header__company">INFORMIX BD</h1>') || padHtml.includes('<h1>INFORMIX BD</h1>');
assert(!hasHugeAdHeader, 'Pad header relies on the official brand logo mark without redundant giant advertisement headings');

// Verify behavior when signatory block is false
const padNoSign = Object.assign({}, dummyPad, { include_sign_block: false });
const padNoSignHtml = Renderer.buildCompanyPadHTML(padNoSign, dummySettings, false);
assert(!padNoSignHtml.includes('cp-signature-line'), 'Pad HTML cleanly omits signatory block when include_sign_block is false');

// Verify behavior when recipient is blank
const padNoRecipient = Object.assign({}, dummyPad, { recipient_name: '', recipient_address: '' });
const padNoRecHtml = Renderer.buildCompanyPadHTML(padNoRecipient, dummySettings, false);
assert(!padNoRecHtml.includes('cp-recipient-box'), 'Pad HTML cleanly omits recipient box when recipient is not specified');

// -------------------------------------------------------------
// 4. Check Data Layer & Supabase Safe Bridge
// -------------------------------------------------------------
console.log('\n--- TEST 4: Data Layer, Supabase Service & Store Integration ---');

const supabaseJs = fs.readFileSync(path.join(__dirname, 'js/supabase.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, 'js/store.js'), 'utf8');

assert(supabaseJs.includes("pad_prefix: 'PAD'"), 'SupabaseService DEFAULT_BUSINESS_SETTINGS defines pad_prefix: PAD');
assert(supabaseJs.includes('pad_sequence: 1'), 'SupabaseService DEFAULT_BUSINESS_SETTINGS defines pad_sequence: 1');
assert(supabaseJs.includes('getNextPadNumber'), 'SupabaseService implements getNextPadNumber');
assert(supabaseJs.includes('getCompanyPads'), 'SupabaseService implements getCompanyPads');
assert(supabaseJs.includes('getCompanyPad'), 'SupabaseService implements getCompanyPad');
assert(supabaseJs.includes('saveCompanyPad'), 'SupabaseService implements saveCompanyPad');
assert(supabaseJs.includes('deleteCompanyPad'), 'SupabaseService implements deleteCompanyPad');
assert(supabaseJs.includes("'company_pads'"), 'SupabaseService searchAll includes company_pads table in global search');

assert(storeJs.includes('getCompanyPads'), 'Store implements getCompanyPads');
assert(storeJs.includes('getCompanyPad'), 'Store implements getCompanyPad');
assert(storeJs.includes('saveCompanyPad'), 'Store implements saveCompanyPad');
assert(storeJs.includes('deleteCompanyPad'), 'Store implements deleteCompanyPad');
assert(storeJs.includes('getCompanyPadDraft'), 'Store implements getCompanyPadDraft');
assert(storeJs.includes('saveCompanyPadDraft'), 'Store implements saveCompanyPadDraft');
assert(storeJs.includes('clearCompanyPadDraft'), 'Store implements clearCompanyPadDraft');
assert(storeJs.includes('ix_local_company_pads'), 'Store implements graceful fallback to ix_local_company_pads if Supabase is offline/not yet migrated');

// -------------------------------------------------------------
// 5. Check SQL Migration Non-Destructive Safety
// -------------------------------------------------------------
console.log('\n--- TEST 5: SQL Migration Safety & Security Model ---');
const migrationSql = fs.readFileSync(path.join(__dirname, 'company-pads-migration.sql'), 'utf8');

assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.company_pads'), 'Migration uses CREATE TABLE IF NOT EXISTS public.company_pads');
assert(migrationSql.includes('ALTER TABLE public.business_settings \nADD COLUMN IF NOT EXISTS pad_prefix') || migrationSql.includes('ADD COLUMN IF NOT EXISTS pad_prefix'), 'Migration adds pad_prefix non-destructively');
assert(migrationSql.includes('ADD COLUMN IF NOT EXISTS pad_sequence'), 'Migration adds pad_sequence non-destructively');
assert(migrationSql.includes('get_next_pad_number()'), 'Migration defines get_next_pad_number() function');
assert(migrationSql.includes('tr_company_pads_updated_at'), 'Migration defines updated_at timestamp trigger');
assert(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), 'Migration enables Row Level Security (RLS) on public.company_pads');
assert(migrationSql.includes('CREATE POLICY "Authenticated users can read company pads"'), 'Migration secures read operations to authenticated users');
assert(migrationSql.includes('CREATE POLICY "Authenticated users can insert company pads"'), 'Migration secures insert operations to authenticated users');
assert(migrationSql.includes('CREATE POLICY "Authenticated users can update company pads"'), 'Migration secures update operations to authenticated users');
assert(migrationSql.includes('CREATE POLICY "Super Admins can delete company pads"'), 'Migration restricts delete operations to super admins');

// Strict safety checks: Zero destructive operations
const hasDropTable = /DROP\s+TABLE/i.test(migrationSql);
const hasTruncate = /TRUNCATE/i.test(migrationSql);
const hasDropDb = /DROP\s+DATABASE/i.test(migrationSql);

assert(!hasDropTable, 'Migration has ZERO DROP TABLE statements (100% non-destructive)');
assert(!hasTruncate, 'Migration has ZERO TRUNCATE statements (100% safe)');
assert(!hasDropDb, 'Migration has ZERO DROP DATABASE statements');

console.log('\n===========================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} tests passed successfully!`);
console.log('===========================================================');
