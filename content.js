let labelElement    = null;
let cachedSites      = [];
let currentArea      = chrome.storage.sync;
const dismissedForSession = new Set();

// ── Storage area (sync vs local) ────────────────────────────────────────────
function resolveStorageArea(callback) {
  chrome.storage.local.get('useSync', (data) => {
    currentArea = data.useSync === false ? chrome.storage.local : chrome.storage.sync;
    callback();
  });
}

function loadSites(callback) {
  currentArea.get('sites', (data) => {
    cachedSites = data.sites || [];
    if (callback) callback();
  });
}

// ── Matching ─────────────────────────────────────────────────────────────────
function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$', 'i');
}

function getMatchTarget(url, matchTarget) {
  if (matchTarget === 'hostname') {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }
  return url;
}

function testPattern(target, pattern, matchType) {
  if (!pattern) return false;
  try {
    if (matchType === 'regex') return new RegExp(pattern, 'i').test(target);
    if (matchType === 'wildcard') return wildcardToRegex(pattern).test(target);
    return target.toLowerCase().includes(pattern.toLowerCase());
  } catch (e) {
    return false;
  }
}

function matchesSite(url, site) {
  const target = getMatchTarget(url, site.matchTarget || 'hostname');
  if (!testPattern(target, site.pattern, site.matchType || 'contains')) return false;
  if (site.excludePattern && testPattern(target, site.excludePattern, 'contains')) return false;
  return true;
}

function siteKey(site) {
  return `${site.pattern}::${site.matchType || 'contains'}::${site.matchTarget || 'hostname'}`;
}

// ── Badge rendering helpers ──────────────────────────────────────────────────
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

function getPositionStyles(position) {
  const base = { top: 'unset', right: 'unset', bottom: 'unset', left: 'unset' };
  switch (position) {
    case 'top-right':    return { ...base, top: '12px', right: '12px' };
    case 'bottom-left':  return { ...base, bottom: '12px', left: '12px' };
    case 'bottom-right': return { ...base, bottom: '12px', right: '12px' };
    default:             return { ...base, top: '12px', left: '12px' };
  }
}

const SIZES = {
  small:  { fontSize: '10px', padding: '3px 9px' },
  medium: { fontSize: '12px', padding: '5px 12px' },
  large:  { fontSize: '15px', padding: '7px 16px' },
};

function removeLabel() {
  if (labelElement) {
    labelElement.remove();
    labelElement = null;
  }
}

// ── Drag-to-move (session only, not persisted) ──────────────────────────────
function makeDraggable(el, onDismiss) {
  let dragging   = false;
  let moved      = false;
  let startX, startY, startTop, startLeft;

  el.addEventListener('mousedown', (e) => {
    dragging = true;
    moved    = false;
    startX   = e.clientX;
    startY   = e.clientY;
    const rect = el.getBoundingClientRect();
    startTop  = rect.top;
    startLeft = rect.left;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    Object.assign(el.style, {
      top: `${startTop + dy}px`,
      left: `${startLeft + dx}px`,
      right: 'unset',
      bottom: 'unset',
    });
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) onDismiss();
  });
}

function showLabel(site) {
  removeLabel();

  const color     = site.color   || '#e53e3e';
  const opacity   = site.opacity !== undefined ? site.opacity : 0.85;
  const pos       = getPositionStyles(site.position || 'top-left');
  const sizing    = SIZES[site.size] || SIZES.medium;
  const textColor = getLuminance(color) > 0.5 ? '#000000' : '#ffffff';

  labelElement = document.createElement('div');
  labelElement.id = '__am-i-in-prod__';
  labelElement.title = 'Click to hide for this tab · drag to move';
  labelElement.textContent = site.label || 'ENV';

  Object.assign(labelElement.style, {
    position:        'fixed',
    zIndex:          '2147483647',
    borderRadius:    '5px',
    fontWeight:      '800',
    fontFamily:      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    letterSpacing:   '0.1em',
    textTransform:   'uppercase',
    color:           textColor,
    backgroundColor: hexToRgba(color, opacity),
    cursor:          'grab',
    userSelect:      'none',
    boxShadow:       '0 2px 8px rgba(0,0,0,0.20)',
    lineHeight:      '1.4',
    ...sizing,
    ...pos,
  });

  document.body.appendChild(labelElement);

  makeDraggable(labelElement, () => {
    dismissedForSession.add(siteKey(site));
    removeLabel();
  });
}

function checkAndUpdate() {
  const url   = window.location.href;
  const match = cachedSites.find((s) => s.pattern && matchesSite(url, s));

  if (match && !dismissedForSession.has(siteKey(match))) {
    showLabel(match);
  } else {
    removeLabel();
  }
}

// ── SPA navigation support ──────────────────────────────────────────────────
(function patchHistory() {
  const fire = () => window.dispatchEvent(new Event('__am-i-in-prod-locationchange__'));

  const origPushState    = history.pushState;
  const origReplaceState = history.replaceState;

  history.pushState = function (...args) {
    origPushState.apply(this, args);
    fire();
  };
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    fire();
  };

  window.addEventListener('popstate', fire);
  window.addEventListener('__am-i-in-prod-locationchange__', checkAndUpdate);
})();

// ── Init ─────────────────────────────────────────────────────────────────────
resolveStorageArea(() => loadSites(checkAndUpdate));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.useSync) {
    resolveStorageArea(() => loadSites(checkAndUpdate));
    return;
  }
  const isCurrentArea = (area === 'sync' && currentArea === chrome.storage.sync) ||
                         (area === 'local' && currentArea === chrome.storage.local);
  if (isCurrentArea && changes.sites) {
    cachedSites = changes.sites.newValue || [];
    checkAndUpdate();
  }
});
