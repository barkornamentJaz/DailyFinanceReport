// ============================================================
// common.js — Bark Ornament Daily Report System
// Shared utilities, API helpers, formatters
// ============================================================

/* ─────────────────────────────────────────────────────────────
   CONFIG VALIDATION
───────────────────────────────────────────────────────────── */
function isConfigured() {
  return CONFIG.SCRIPT_URL &&
         CONFIG.SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL' &&
         CONFIG.SCRIPT_URL.startsWith('https://script.google.com');
}

function showConfigBanner() {
  if (document.getElementById('__configBanner')) return;
  const b = document.createElement('div');
  b.id = '__configBanner';
  b.style.cssText = [
    'position:fixed;top:0;left:0;right:0;z-index:99999',
    'background:#fef3c7;border-bottom:2px solid #d97706',
    'padding:11px 20px;display:flex;align-items:center;gap:10px',
    "font-family:'IBM Plex Sans',sans-serif;font-size:0.85rem;color:#92400e",
    'box-shadow:0 2px 8px rgba(0,0,0,0.1)'
  ].join(';');
  b.innerHTML = `
    <span style="font-size:1.2rem">⚙️</span>
    <div>
      <strong>Setup needed:</strong>
      Open <code style="background:#fde68a;padding:1px 5px;border-radius:3px">config.js</code>
      on GitHub and replace <code style="background:#fde68a;padding:1px 5px;border-radius:3px">YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL</code>
      with your deployed Apps Script URL.
    </div>
    <button onclick="this.parentElement.remove()"
      style="margin-left:auto;background:none;border:none;font-size:1.3rem;cursor:pointer;color:#92400e;line-height:1">✕</button>
  `;
  document.body.prepend(b);
  const main = document.querySelector('.main');
  if (main) main.style.marginTop = '50px';
}

/* ─────────────────────────────────────────────────────────────
   API HELPERS
   Uses Google Apps Script Web App URL.
   GitHub Pages → Apps Script works via redirect:follow + JSON.
───────────────────────────────────────────────────────────── */
async function apiGet(params) {
  if (!isConfigured()) {
    showConfigBanner();
    throw new Error('Apps Script URL not configured in config.js');
  }

  // Build URL with query params
  const base = CONFIG.SCRIPT_URL;
  const qs   = Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  const fullUrl = base + (base.includes('?') ? '&' : '?') + qs;

  let res;
  try {
    res = await fetch(fullUrl, {
      method:   'GET',
      redirect: 'follow',   // IMPORTANT — Apps Script issues a redirect
      cache:    'no-cache',
    });
  } catch (networkErr) {
    throw new Error('Network error — check your internet connection.\n' + networkErr.message);
  }

  if (!res.ok) throw new Error('Server error: HTTP ' + res.status);

  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error('Invalid response from Apps Script. Re-deploy and try again.'); }

  if (!json.success) throw new Error(json.error || 'Unknown server error');
  return json.data;
}

async function apiPost(body) {
  if (!isConfigured()) {
    showConfigBanner();
    throw new Error('Apps Script URL not configured in config.js');
  }

  let res;
  try {
    res = await fetch(CONFIG.SCRIPT_URL, {
      method:   'POST',
      redirect: 'follow',   // IMPORTANT — Apps Script issues a redirect on POST too
      // Note: no 'Content-Type' header — Apps Script handles plain text body better
      // from cross-origin requests
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error('Network error — check your internet connection.\n' + networkErr.message);
  }

  if (!res.ok) throw new Error('Server error: HTTP ' + res.status);

  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error('Invalid response from Apps Script. Re-deploy and try again.'); }

  if (!json.success) throw new Error(json.error || 'Unknown server error');
  return json.data;
}

/* ─────────────────────────────────────────────────────────────
   FORMATTERS
───────────────────────────────────────────────────────────── */
function fmtLKR(n) {
  return 'Rs\u00A0' + parseFloat(n || 0)
    .toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtUSD(n) {
  return '$\u00A0' + parseFloat(n || 0)
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMoney(n, cur) { return cur === 'USD' ? fmtUSD(n) : fmtLKR(n); }

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toISOString().split('T')[0];
}
function todayISO() { return new Date().toISOString().split('T')[0]; }

function isOverdue(dueDate) {
  if (!dueDate) return false;
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const now = new Date();         now.setHours(0, 0, 0, 0);
  return due < now;
}

/* ─────────────────────────────────────────────────────────────
   BADGES
───────────────────────────────────────────────────────────── */
function statusBadge(s) {
  const m = { Paid:'badge-success', Partial:'badge-warning', Pending:'badge-info', Overdue:'badge-danger' };
  return `<span class="badge ${m[s]||'badge-secondary'}">${s||'—'}</span>`;
}
function regionBadge(r) {
  const m = { Local:'region-local', Seychelles:'region-seychelles', Maldives:'region-maldives' };
  return `<span class="badge ${m[r]||'badge-secondary'}">${r||'—'}</span>`;
}

/* ─────────────────────────────────────────────────────────────
   UI HELPERS
───────────────────────────────────────────────────────────── */
function showLoading(v) {
  const el = document.getElementById('loading');
  if (el) el.style.display = v ? 'flex' : 'none';
}

let _toastTimer;
function showToast(msg, type = 'success') {
  const old = document.getElementById('__toast');
  if (old) old.remove();
  clearTimeout(_toastTimer);
  const t = document.createElement('div');
  t.id = '__toast';
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  _toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 320);
  }, 3500);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('open');
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
    e.target.classList.remove('open');
  }
});

async function confirmDel(msg = 'Delete this record? This cannot be undone.') {
  return window.confirm(msg);
}

function doPrint(title) {
  const orig = document.title;
  document.title = `${title} — ${CONFIG.COMPANY_NAME} — ${fmtDate(new Date())}`;
  window.print();
  document.title = orig;
}

/* ─────────────────────────────────────────────────────────────
   PAGE INIT
───────────────────────────────────────────────────────────── */
function setPageDate() {
  const s = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const el = document.getElementById('pageDate');
  if (el) el.textContent = s;
  const ph = document.getElementById('printDateHdr');
  if (ph) ph.innerHTML = 'Report Date:<br><strong>' + s + '</strong>';
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    a.classList.toggle('active',
      href === page || (page === '' && href === 'index.html')
    );
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setPageDate();
  setActiveNav();
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
  if (!isConfigured()) showConfigBanner();
});
