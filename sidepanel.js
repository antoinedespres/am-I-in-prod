// ── State ──────────────────────────────────────────────────────────────────
let sites       = [];
let editIndex   = -1;  // -1 means "add mode"
let currentArea = chrome.storage.sync;
let dragSrcIndex = -1;

// ── DOM refs ───────────────────────────────────────────────────────────────
const sitesList      = document.getElementById('sites-list');
const emptyState     = document.getElementById('empty-state');
const formTitle      = document.getElementById('form-title');
const inputPattern   = document.getElementById('input-pattern');
const patternHint    = document.getElementById('pattern-hint');
const patternDupWarn = document.getElementById('pattern-duplicate-warning');
const inputMatchType   = document.getElementById('input-match-type');
const inputMatchTarget = document.getElementById('input-match-target');
const inputExclude   = document.getElementById('input-exclude');
const inputLabel     = document.getElementById('input-label');
const inputColor     = document.getElementById('input-color');
const inputOpacity   = document.getElementById('input-opacity');
const opacityValue   = document.getElementById('opacity-value');
const posBtns        = document.querySelectorAll('.pos-btn');
const sizeBtns       = document.querySelectorAll('.size-btn');
const presetSwatches = document.querySelectorAll('.preset-swatch');
const btnSave        = document.getElementById('btn-save');
const btnCancel      = document.getElementById('btn-cancel');
const btnUseCurrentTab = document.getElementById('btn-use-current-tab');
const btnExport      = document.getElementById('btn-export');
const btnImport      = document.getElementById('btn-import');
const inputImportFile = document.getElementById('input-import-file');
const inputSync      = document.getElementById('input-sync');

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

function getSelectedSize() {
  const active = document.querySelector('.size-btn.active');
  return active ? active.dataset.size : 'medium';
}

function selectSize(size) {
  sizeBtns.forEach(b => b.classList.toggle('active', b.dataset.size === (size || 'medium')));
}

function siteKey(site) {
  return `${(site.pattern || '').toLowerCase()}::${site.matchType || 'contains'}::${site.matchTarget || 'hostname'}`;
}

// ── Storage area (sync vs local) ─────────────────────────────────────────────
function resolveStorageArea(callback) {
  chrome.storage.local.get('useSync', (data) => {
    const useSync = data.useSync !== false;
    currentArea = useSync ? chrome.storage.sync : chrome.storage.local;
    inputSync.checked = useSync;
    if (callback) callback();
  });
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
    li.className   = 'site-card';
    li.draggable   = true;
    li.dataset.index = i;

    li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <div class="site-card__preview">
        <span class="site-badge" style="background:${bg};color:${textColor}">
          ${escapeHtml(site.label || 'ENV')}
        </span>
        <div class="site-card__info">
          <span class="site-pattern">${escapeHtml(site.pattern)}</span>
          <span class="site-meta">${matchTypeLabel(site.matchType)} · ${matchTargetLabel(site.matchTarget)} · ${posLabel(site.position)}</span>
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

function matchTypeLabel(t) {
  const map = { contains: 'Contains', wildcard: 'Wildcard', regex: 'Regex' };
  return map[t] || 'Contains';
}

function matchTargetLabel(t) {
  return t === 'url' ? 'Full URL' : 'Hostname';
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
  inputMatchType.value = 'contains';
  inputMatchTarget.value = 'hostname';
  inputExclude.value = '';
  inputLabel.value   = '';
  inputColor.value   = '#e53e3e';
  inputOpacity.value = 85;
  opacityValue.textContent = '85%';
  selectPosition('top-left');
  selectSize('medium');
  updatePatternHint();
  hideDuplicateWarning();
  btnCancel.classList.add('hidden');
  inputPattern.focus();
}

function loadSiteIntoForm(site) {
  inputPattern.value      = site.pattern || '';
  inputMatchType.value    = site.matchType || 'contains';
  inputMatchTarget.value  = site.matchTarget || 'hostname';
  inputExclude.value      = site.excludePattern || '';
  inputLabel.value        = site.label   || '';
  inputColor.value        = site.color   || '#e53e3e';
  const pct = Math.round((site.opacity !== undefined ? site.opacity : 0.85) * 100);
  inputOpacity.value  = pct;
  opacityValue.textContent = `${pct}%`;
  selectPosition(site.position || 'top-left');
  selectSize(site.size || 'medium');
  updatePatternHint();
  checkDuplicateWarning();
}

function updatePatternHint() {
  const target = inputMatchTarget.value === 'url' ? 'full URL' : 'hostname';
  const type   = inputMatchType.value;
  const verb   = type === 'regex' ? 'matches (regex)' : type === 'wildcard' ? 'matches (wildcard)' : 'contains this string';
  patternHint.textContent = `Matches if the ${target} ${verb}`;
}

function hideDuplicateWarning() {
  patternDupWarn.classList.add('hidden');
}

function checkDuplicateWarning() {
  const candidate = {
    pattern: inputPattern.value.trim(),
    matchType: inputMatchType.value,
    matchTarget: inputMatchTarget.value,
  };
  if (!candidate.pattern) {
    hideDuplicateWarning();
    return;
  }
  const key = siteKey(candidate);
  const isDuplicate = sites.some((s, i) => i !== editIndex && siteKey(s) === key);
  patternDupWarn.classList.toggle('hidden', !isDuplicate);
}

// ── Persist ────────────────────────────────────────────────────────────────
function saveSites() {
  currentArea.set({ sites });
}

// ── Load ───────────────────────────────────────────────────────────────────
function loadSites() {
  currentArea.get('sites', (data) => {
    sites = data.sites || [];
    renderList();
  });
}

// ── Events: form basics ──────────────────────────────────────────────────────
inputOpacity.addEventListener('input', () => {
  opacityValue.textContent = `${inputOpacity.value}%`;
});

inputMatchType.addEventListener('change', () => {
  updatePatternHint();
  checkDuplicateWarning();
});
inputMatchTarget.addEventListener('change', () => {
  updatePatternHint();
  checkDuplicateWarning();
});
inputPattern.addEventListener('input', checkDuplicateWarning);

posBtns.forEach(btn => {
  btn.addEventListener('click', () => selectPosition(btn.dataset.pos));
});

sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => selectSize(btn.dataset.size));
});

presetSwatches.forEach(btn => {
  btn.addEventListener('click', () => {
    inputColor.value = btn.dataset.color;
  });
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

  if (inputMatchType.value === 'regex') {
    try {
      new RegExp(pattern);
    } catch (e) {
      inputPattern.focus();
      inputPattern.classList.add('input-error');
      return;
    }
  }

  const site = {
    pattern,
    matchType:      inputMatchType.value,
    matchTarget:    inputMatchTarget.value,
    excludePattern: inputExclude.value.trim(),
    label,
    color:    inputColor.value,
    opacity:  parseInt(inputOpacity.value, 10) / 100,
    position: getSelectedPosition(),
    size:     getSelectedSize(),
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

// ── Events: list actions (edit / delete) ─────────────────────────────────────
sitesList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const index  = parseInt(btn.dataset.index, 10);
  const action = btn.dataset.action;

  if (action === 'delete') {
    const site = sites[index];
    const confirmed = confirm(`Delete the rule for "${site.pattern}"?`);
    if (!confirmed) return;
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

// ── Events: drag-to-reorder ───────────────────────────────────────────────────
sitesList.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.site-card');
  if (!li) return;
  dragSrcIndex = parseInt(li.dataset.index, 10);
  e.dataTransfer.effectAllowed = 'move';
  li.classList.add('dragging');
});

sitesList.addEventListener('dragend', (e) => {
  const li = e.target.closest('.site-card');
  if (li) li.classList.remove('dragging');
});

sitesList.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
});

sitesList.addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest('.site-card');
  if (!li || dragSrcIndex < 0) return;
  const targetIndex = parseInt(li.dataset.index, 10);
  if (targetIndex === dragSrcIndex) return;

  const [moved] = sites.splice(dragSrcIndex, 1);
  sites.splice(targetIndex, 0, moved);
  dragSrcIndex = -1;

  if (editIndex >= 0) resetForm();
  saveSites();
  renderList();
});

// ── Quick add from current tab ───────────────────────────────────────────────
btnUseCurrentTab.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.url) return;
    try {
      const url = new URL(tab.url);
      inputPattern.value = inputMatchTarget.value === 'url' ? tab.url : url.hostname;
    } catch (e) {
      return;
    }
    checkDuplicateWarning();
    inputLabel.focus();
  });
});

// ── Import / export ───────────────────────────────────────────────────────────
btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(sites, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'am-i-in-prod-rules.json';
  a.click();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', () => {
  inputImportFile.click();
});

inputImportFile.addEventListener('change', () => {
  const file = inputImportFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let imported;
    try {
      imported = JSON.parse(reader.result);
    } catch (e) {
      alert('That file is not valid JSON.');
      inputImportFile.value = '';
      return;
    }

    if (!Array.isArray(imported)) {
      alert('Expected a JSON array of rules.');
      inputImportFile.value = '';
      return;
    }

    const valid = imported.filter(s => s && typeof s.pattern === 'string' && typeof s.label === 'string');
    const skipped = imported.length - valid.length;

    sites = sites.concat(valid);
    saveSites();
    renderList();

    inputImportFile.value = '';
    alert(`Imported ${valid.length} rule(s).${skipped ? ` Skipped ${skipped} invalid entr${skipped === 1 ? 'y' : 'ies'}.` : ''}`);
  };
  reader.readAsText(file);
});

// ── Sync / local storage toggle ───────────────────────────────────────────────
inputSync.addEventListener('change', () => {
  const useSync   = inputSync.checked;
  const fromArea  = useSync ? chrome.storage.local : chrome.storage.sync;
  const toArea    = useSync ? chrome.storage.sync   : chrome.storage.local;

  fromArea.get('sites', (data) => {
    const existing = data.sites || [];
    toArea.set({ sites: existing }, () => {
      chrome.storage.local.set({ useSync }, () => {
        currentArea = toArea;
        loadSites();
      });
    });
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
resolveStorageArea(loadSites);
updatePatternHint();
