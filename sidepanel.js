// ── State ──────────────────────────────────────────────────────────────────
let sites     = [];
let editIndex = -1;  // -1 means "add mode"

// ── DOM refs ───────────────────────────────────────────────────────────────
const sitesList    = document.getElementById('sites-list');
const emptyState   = document.getElementById('empty-state');
const formTitle    = document.getElementById('form-title');
const inputPattern = document.getElementById('input-pattern');
const inputLabel   = document.getElementById('input-label');
const inputColor   = document.getElementById('input-color');
const inputOpacity = document.getElementById('input-opacity');
const opacityValue = document.getElementById('opacity-value');
const posBtns      = document.querySelectorAll('.pos-btn');
const btnSave      = document.getElementById('btn-save');
const btnCancel    = document.getElementById('btn-cancel');

// ── Helpers ────────────────────────────────────────────────────────────────
function getLuminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16) / 255;
  const g = parseInt(h.substr(2, 2), 16) / 255;
  const b = parseInt(h.substr(4, 2), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgba(hex, opacity) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getSelectedPosition() {
  const active = document.querySelector('.pos-btn.active');
  return active ? active.dataset.pos : 'top-left';
}

function selectPosition(pos) {
  posBtns.forEach(b => b.classList.toggle('active', b.dataset.pos === pos));
}

// ── Render site list ───────────────────────────────────────────────────────
function renderList() {
  sitesList.innerHTML = '';

  if (sites.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  sites.forEach((site, i) => {
    const opacity   = site.opacity !== undefined ? site.opacity : 0.85;
    const color     = site.color || '#e53e3e';
    const textColor = getLuminance(color) > 0.5 ? '#000' : '#fff';
    const bg        = hexToRgba(color, opacity);

    const li = document.createElement('li');
    li.className = 'site-card';

    li.innerHTML = `
      <div class="site-card__preview">
        <span class="site-badge" style="background:${bg};color:${textColor}">
          ${escapeHtml(site.label || 'ENV')}
        </span>
        <div class="site-card__info">
          <span class="site-pattern">${escapeHtml(site.pattern)}</span>
          <span class="site-meta">${posLabel(site.position)} · ${Math.round(opacity * 100)}% opacity</span>
        </div>
      </div>
      <div class="site-card__actions">
        <button class="btn-icon" data-action="edit" data-index="${i}" title="Edit">✏️</button>
        <button class="btn-icon btn-icon--danger" data-action="delete" data-index="${i}" title="Delete">🗑️</button>
      </div>
    `;

    sitesList.appendChild(li);
  });
}

function posLabel(pos) {
  const map = {
    'top-left':     'Top left',
    'top-right':    'Top right',
    'bottom-left':  'Bottom left',
    'bottom-right': 'Bottom right',
  };
  return map[pos] || 'Top left';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Form helpers ───────────────────────────────────────────────────────────
function resetForm() {
  editIndex = -1;
  formTitle.textContent = 'Add site';
  inputPattern.value = '';
  inputLabel.value   = '';
  inputColor.value   = '#e53e3e';
  inputOpacity.value = 85;
  opacityValue.textContent = '85%';
  selectPosition('top-left');
  btnCancel.classList.add('hidden');
  inputPattern.focus();
}

function loadSiteIntoForm(site) {
  inputPattern.value  = site.pattern || '';
  inputLabel.value    = site.label   || '';
  inputColor.value    = site.color   || '#e53e3e';
  const pct = Math.round((site.opacity !== undefined ? site.opacity : 0.85) * 100);
  inputOpacity.value  = pct;
  opacityValue.textContent = `${pct}%`;
  selectPosition(site.position || 'top-left');
}

// ── Persist ────────────────────────────────────────────────────────────────
function saveSites() {
  chrome.storage.sync.set({ sites });
}

// ── Load ───────────────────────────────────────────────────────────────────
function loadSites() {
  chrome.storage.sync.get('sites', (data) => {
    sites = data.sites || [];
    renderList();
  });
}

// ── Events ─────────────────────────────────────────────────────────────────
inputOpacity.addEventListener('input', () => {
  opacityValue.textContent = `${inputOpacity.value}%`;
});

posBtns.forEach(btn => {
  btn.addEventListener('click', () => selectPosition(btn.dataset.pos));
});

btnSave.addEventListener('click', () => {
  const pattern = inputPattern.value.trim();
  const label   = inputLabel.value.trim();

  if (!pattern) {
    inputPattern.focus();
    inputPattern.classList.add('input-error');
    return;
  }
  inputPattern.classList.remove('input-error');

  if (!label) {
    inputLabel.focus();
    inputLabel.classList.add('input-error');
    return;
  }
  inputLabel.classList.remove('input-error');

  const site = {
    pattern,
    label,
    color:    inputColor.value,
    opacity:  parseInt(inputOpacity.value, 10) / 100,
    position: getSelectedPosition(),
  };

  if (editIndex >= 0) {
    sites[editIndex] = site;
  } else {
    sites.push(site);
  }

  saveSites();
  renderList();
  resetForm();
});

btnCancel.addEventListener('click', () => {
  resetForm();
});

sitesList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const index  = parseInt(btn.dataset.index, 10);
  const action = btn.dataset.action;

  if (action === 'delete') {
    sites.splice(index, 1);
    saveSites();
    renderList();
    if (editIndex === index) resetForm();
    return;
  }

  if (action === 'edit') {
    editIndex = index;
    formTitle.textContent = 'Edit site';
    loadSiteIntoForm(sites[index]);
    btnCancel.classList.remove('hidden');
    inputPattern.focus();
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
loadSites();
