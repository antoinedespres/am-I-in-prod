let labelElement = null;

function matchesPattern(url, pattern) {
  return url.toLowerCase().includes(pattern.toLowerCase());
}

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

function removeLabel() {
  if (labelElement) {
    labelElement.remove();
    labelElement = null;
  }
}

function showLabel(site) {
  removeLabel();

  const color   = site.color   || '#e53e3e';
  const opacity = site.opacity !== undefined ? site.opacity : 0.85;
  const pos     = getPositionStyles(site.position || 'top-left');
  const textColor = getLuminance(color) > 0.5 ? '#000000' : '#ffffff';

  labelElement = document.createElement('div');
  labelElement.id = '__am-i-in-prod__';
  labelElement.textContent = site.label || 'ENV';

  Object.assign(labelElement.style, {
    position:        'fixed',
    zIndex:          '2147483647',
    padding:         '5px 12px',
    borderRadius:    '5px',
    fontSize:        '12px',
    fontWeight:      '800',
    fontFamily:      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    letterSpacing:   '0.1em',
    textTransform:   'uppercase',
    color:           textColor,
    backgroundColor: hexToRgba(color, opacity),
    pointerEvents:   'none',
    userSelect:      'none',
    boxShadow:       '0 2px 8px rgba(0,0,0,0.20)',
    lineHeight:      '1.4',
    ...pos,
  });

  document.body.appendChild(labelElement);
}

function checkAndUpdate() {
  chrome.storage.sync.get('sites', (data) => {
    const sites = data.sites || [];
    const url   = window.location.href;
    const match = sites.find(s => s.pattern && matchesPattern(url, s.pattern));

    if (match) {
      showLabel(match);
    } else {
      removeLabel();
    }
  });
}

checkAndUpdate();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.sites) {
    checkAndUpdate();
  }
});
