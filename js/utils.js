/* ====================================================================
   INFORMIX BD — Utility Functions & Helper Library
   Formatting, Numbers-to-Words, Autocomplete, Notifications, Modals
   ==================================================================== */

const Utils = (() => {
  'use strict';

  /* ---- 1. CURRENCY & NUMBER FORMATTING ---- */
  function formatCurrency(amount, currencySymbol = '৳') {
    const n = Number(amount) || 0;
    return `${currencySymbol}${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  /* ---- 2. NUMBER TO WORDS (BENGALI TAKA STANDARDS) ---- */
  function numberToWords(amount) {
    const n = Math.abs(Number(amount) || 0);
    if (n === 0) return 'Zero Taka Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(val) {
      if (val === 0) return '';
      if (val < 20) return ones[val];
      if (val < 100) return tens[Math.floor(val / 10)] + (val % 10 ? ' ' + ones[val % 10] : '');
      if (val < 1000) return ones[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' ' + convertGroup(val % 100) : '');
      if (val < 100000) return convertGroup(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 ? ' ' + convertGroup(val % 1000) : '');
      if (val < 10000000) return convertGroup(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 ? ' ' + convertGroup(val % 100000) : '');
      return convertGroup(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 ? ' ' + convertGroup(val % 10000000) : '');
    }

    const integerPart = Math.floor(n);
    const decimalPart = Math.round((n - integerPart) * 100);

    let words = convertGroup(integerPart) + ' Taka';
    if (decimalPart > 0) {
      words += ' and ' + convertGroup(decimalPart) + ' Paisa';
    }
    words += ' Only';

    return words.replace(/\s+/g, ' ').trim();
  }

  /* ---- 3. DATE & TIME FORMATTING ---- */
  function formatDate(dateStr, options = {}) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const defaults = { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('en-US', { ...defaults, ...options });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return '—';
    const now = Date.now();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateStr);
  }

  /* ---- 4. NOTIFICATION TOASTS ---- */
  let notifContainer = null;
  function notify(message, type = 'info', duration = 4000) {
    if (!notifContainer) {
      notifContainer = document.getElementById('notifContainer');
      if (!notifContainer) {
        notifContainer = document.createElement('div');
        notifContainer.id = 'notifContainer';
        notifContainer.className = 'ix-notifications';
        document.body.appendChild(notifContainer);
      }
    }

    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const el = document.createElement('div');
    el.className = `ix-notif ix-notif--${type}`;
    el.innerHTML = `
      <span class="ix-notif__icon">${icons[type] || icons.info}</span>
      <span class="ix-notif__text">${esc(message)}</span>
      <button type="button" class="ix-notif__close" aria-label="Dismiss">&times;</button>
    `;

    el.querySelector('.ix-notif__close').addEventListener('click', () => {
      el.classList.remove('ix-notif--show');
      setTimeout(() => el.remove(), 300);
    });

    notifContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('ix-notif--show'));

    setTimeout(() => {
      if (el.parentNode) {
        el.classList.remove('ix-notif--show');
        setTimeout(() => el.remove(), 300);
      }
    }, duration);
  }

  /* ---- 5. AUTOCOMPLETE HELPER ---- */
  function setupAutocomplete({ inputEl, onSearch, onSelect, renderItem }) {
    if (!inputEl) return;

    let dropdown = null;
    let items = [];
    let selectedIndex = -1;

    function createDropdown() {
      if (dropdown) return dropdown;
      dropdown = document.createElement('div');
      dropdown.className = 'autocomplete-dropdown';
      document.body.appendChild(dropdown);
      return dropdown;
    }

    function positionDropdown() {
      if (!dropdown) return;
      const rect = inputEl.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
      dropdown.style.left = `${rect.left + window.scrollX}px`;
      dropdown.style.width = `${Math.max(rect.width, 280)}px`;
    }

    function close() {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
        items = [];
        selectedIndex = -1;
      }
    }

    const debouncedSearch = debounce(async (val) => {
      const q = (val || '').trim();
      if (!q) { close(); return; }

      try {
        items = await onSearch(q);
        if (!items || !items.length) {
          close();
          return;
        }

        const dd = createDropdown();
        positionDropdown();
        selectedIndex = -1;

        dd.innerHTML = items.map((item, idx) => `
          <div class="autocomplete-item" data-idx="${idx}">
            ${renderItem ? renderItem(item) : esc(item.name || item.title || String(item))}
          </div>
        `).join('');

        dd.querySelectorAll('.autocomplete-item').forEach(el => {
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const idx = parseInt(el.dataset.idx, 10);
            if (items[idx]) {
              onSelect(items[idx]);
              close();
            }
          });
        });
      } catch (err) {
        console.error('Autocomplete search error:', err);
      }
    }, 200);

    inputEl.addEventListener('input', (e) => debouncedSearch(e.target.value));
    inputEl.addEventListener('focus', () => { if (inputEl.value) debouncedSearch(inputEl.value); });
    inputEl.addEventListener('blur', () => setTimeout(close, 200));

    inputEl.addEventListener('keydown', (e) => {
      if (!dropdown || !items.length) return;

      const domItems = dropdown.querySelectorAll('.autocomplete-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        domItems.forEach((el, i) => el.classList.toggle('active', i === selectedIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        domItems.forEach((el, i) => el.classList.toggle('active', i === selectedIndex));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && items[selectedIndex]) {
          e.preventDefault();
          onSelect(items[selectedIndex]);
          close();
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown, true);
  }

  /* ---- 6. CONFIRMATION DIALOG MODAL ---- */
  function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'modal-overlay modal-overlay--confirm';
      modalOverlay.innerHTML = `
        <div class="modal modal--sm">
          <div class="modal__header">
            <h3 class="modal__title">${esc(title || 'Confirm Action')}</h3>
          </div>
          <div class="modal__body">
            <p style="color:var(--text-secondary);font-size:0.95rem;line-height:1.5">${esc(message || 'Are you sure you want to proceed?')}</p>
          </div>
          <div class="modal__footer" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)">
            <button type="button" class="btn btn--secondary btn-cancel">${esc(cancelText)}</button>
            <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'} btn-confirm">${esc(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);
      requestAnimationFrame(() => modalOverlay.classList.add('modal-overlay--show'));

      const close = (val) => {
        modalOverlay.classList.remove('modal-overlay--show');
        setTimeout(() => modalOverlay.remove(), 250);
        resolve(val);
      };

      modalOverlay.querySelector('.btn-cancel').addEventListener('click', () => close(false));
      modalOverlay.querySelector('.btn-confirm').addEventListener('click', () => close(true));
      modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) close(false); });
    });
  }

  /* ---- 7. GENERAL UTILS ---- */
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function throttle(fn, ms = 100) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn(...args);
      }
    };
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function downloadFile(content, filename, type = 'application/json') {
    const blob = new Blob([content], { type });
    downloadBlob(blob, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 4000);
  }

  /* ---- Simple ZIP Builder ---- */
  function createZip(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const centralDir = [];
    let offset = 0;

    files.forEach(({ name, content }) => {
      const nameBytes = encoder.encode(name);
      const dataBytes = typeof content === 'string' ? encoder.encode(content) : content;
      const crc = crc32(dataBytes);

      const header = new ArrayBuffer(30 + nameBytes.length);
      const hv = new DataView(header);
      hv.setUint32(0, 0x04034b50, true);
      hv.setUint16(4, 20, true);
      hv.setUint16(6, 0, true);
      hv.setUint16(8, 0, true);
      hv.setUint16(10, 0, true);
      hv.setUint16(12, 0, true);
      hv.setUint32(14, crc, true);
      hv.setUint32(18, dataBytes.length, true);
      hv.setUint32(22, dataBytes.length, true);
      hv.setUint16(26, nameBytes.length, true);
      hv.setUint16(28, 0, true);
      new Uint8Array(header).set(nameBytes, 30);

      const cent = new ArrayBuffer(46 + nameBytes.length);
      const cv = new DataView(cent);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0x20, true);
      cv.setUint32(42, offset, true);
      new Uint8Array(cent).set(nameBytes, 46);

      parts.push(header, dataBytes);
      centralDir.push(cent);
      offset += 30 + nameBytes.length + dataBytes.length;
    });

    const centralDirOffset = offset;
    let centralDirSize = 0;
    centralDir.forEach(c => { parts.push(c); centralDirSize += c.byteLength; });

    const eocd = new ArrayBuffer(22);
    const ev = new DataView(eocd);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);
    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }

  function crc32(bytes) {
    let c, table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
      }
      return t;
    })());
    c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---- 8. KEYBOARD SHORTCUTS ENGINE ---- */
  const shortcuts = {};
  function registerShortcut(combo, callback, description) {
    shortcuts[combo.toUpperCase()] = { callback, description };
  }

  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger single-key shortcuts when typing in inputs
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const key = [];
      if (e.ctrlKey || e.metaKey) key.push('CTRL');
      if (e.shiftKey) key.push('SHIFT');
      if (e.altKey) key.push('ALT');

      if (e.key && e.key.length === 1) key.push(e.key.toUpperCase());
      else if (['F1', 'F2', 'F3', 'F4', 'Escape'].includes(e.key)) {
        key.push(e.key === 'Escape' ? 'ESC' : e.key.toUpperCase());
      } else return;

      const combo = key.join('+');
      if (shortcuts[combo]) {
        if (isInput && !e.ctrlKey && !e.metaKey && combo !== 'ESC') return;
        e.preventDefault();
        shortcuts[combo].callback();
      }
    });
  }

  /* ---- 9. ICONS SVG OBJECT ---- */
  const Icons = {
    dashboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="11" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/></svg>',
    invoice: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    receipt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 10h8"/><path d="M8 14h4"/></svg>',
    customers: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    analytics: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    printer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    pdf: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  };

  return {
    formatCurrency,
    numberToWords,
    formatDate,
    formatDateTime,
    timeAgo,
    notify,
    setupAutocomplete,
    confirmDialog,
    debounce,
    throttle,
    esc,
    downloadFile,
    downloadBlob,
    createZip,
    registerShortcut,
    initShortcuts,
    shortcuts,
    Icons,
  };
})();

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
