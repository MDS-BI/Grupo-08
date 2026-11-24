const STATUS_LABELS = Object.freeze({
  draft: 'Borrador',
  pending: 'Pendiente',
  pending_review: 'Pendiente',
  pending_approval: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  overdue: 'Vencido'
});

const RESULT_LABELS = Object.freeze({
  passed: 'Aprobado',
  conditional: 'Condicional',
  failed: 'Reprobado'
});

const ICON_PATHS = Object.freeze({
  draft: '<path d="M4 13.5 13 4.5l2.5 2.5-9 9H4z"></path>',
  pending: '<circle cx="9" cy="9" r="6"></circle><path d="M9 5.5V9l2.5 1.5"></path>',
  pending_review: '<circle cx="9" cy="9" r="6"></circle><path d="M9 5.5V9l2.5 1.5"></path>',
  pending_approval: '<circle cx="9" cy="9" r="6"></circle><path d="M9 5.5V9l2.5 1.5"></path>',
  approved: '<path d="m4 9 3.5 3.5L14 6"></path>',
  rejected: '<path d="m5.5 5.5 7 7"></path><path d="m12.5 5.5-7 7"></path>',
  overdue: '<path d="M9 3.5 16 15H2z"></path><path d="M9 7v4"></path><path d="M9 13v.1"></path>'
});

function iconNode(key){
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('status-badge-icon');
  const wrapper = document.createElementNS(namespace, 'g');
  wrapper.innerHTML = ICON_PATHS[key] || ICON_PATHS.pending;
  svg.appendChild(wrapper);
  return svg;
}

export function renderStatusBadge(status, options = {}){
  const key = String(status ?? '').toLowerCase();
  const label = STATUS_LABELS[key] || (options.label === undefined ? key : String(options.label));
  const badge = document.createElement('span');
  badge.className = `status-badge status-${key} badge-${key}`;
  badge.dataset.status = key;
  badge.dataset.label = label;
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', label);
  if(options.compact) badge.classList.add('status-badge-compact');
  if(options.icon !== false) badge.appendChild(iconNode(key));
  const text = document.createElement('span');
  text.className = 'status-badge-label';
  text.textContent = label;
  badge.appendChild(text);
  if(options.result){
    const resultKey = String(options.result).toLowerCase();
    const result = document.createElement('span');
    result.className = `status-result status-result-${resultKey}`;
    result.dataset.result = resultKey;
    result.textContent = RESULT_LABELS[resultKey] || resultKey;
    badge.appendChild(result);
  }
  return badge;
}

export function renderStatusLegend(statuses){
  const keys = Array.isArray(statuses) && statuses.length > 0
    ? statuses.map(status => String(status).toLowerCase())
    : ['draft', 'pending', 'approved', 'rejected', 'overdue'];
  const legend = document.createElement('div');
  legend.className = 'status-legend';
  legend.setAttribute('aria-label', 'Leyenda de estados');
  keys.forEach(key => legend.appendChild(renderStatusBadge(key, { compact: true })));
  return legend;
}

export function statusLabel(status){
  const key = String(status ?? '').toLowerCase();
  return STATUS_LABELS[key] || key;
}

export function resultLabel(result){
  const key = String(result ?? '').toLowerCase();
  return RESULT_LABELS[key] || key;
}
