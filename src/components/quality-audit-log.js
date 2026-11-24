import { findAuditEntries } from '../storage.js';
import { moduleLabel, qs } from './quality-utils.js';
import { can, applyPermissionState } from '../permissions.js';
import { renderPermissionNotice, clearPermissionNotice } from './permission-notice.js';

const AUDIT_ROLE_KEY = 'erp_quality:viewer_role';

function auditRole(){
  const select = qs('quality-role') || qs('quality-settings-role');
  const selected = select ? select.value : '';
  if(selected) return selected;
  try{ return localStorage.getItem(AUDIT_ROLE_KEY) || 'jefe_calidad'; }catch{ return 'jefe_calidad'; }
}

const ACTION_LABELS = Object.freeze({
  create: 'Alta',
  update: 'Edición',
  status_change: 'Cambio de estado',
  delete: 'Eliminación'
});

const ENTITY_LABELS = Object.freeze({
  inspection: 'Inspección',
  non_conformance: 'No conformidad',
  corrective_action: 'CAPA'
});

export const EMPTY_AUDIT_FILTERS = Object.freeze({
  reference_module: '',
  reference_id: '',
  entity_type: '',
  desde: '',
  hasta: ''
});

export function clearAuditFilters(){
  return { ...EMPTY_AUDIT_FILTERS };
}

function rangeBoundary(value, isEnd){
  if(!value) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) return isEnd ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
  return value;
}

export function filterAuditEntries(entries, filters = {}){
  const list = Array.isArray(entries) ? entries : [];
  if(filters.desde && filters.hasta && filters.desde > filters.hasta){
    throw new Error('El rango de fechas es inválido: "desde" no puede ser mayor que "hasta".');
  }
  const desde = rangeBoundary(filters.desde, false);
  const hasta = rangeBoundary(filters.hasta, true);
  return list.filter(entry => {
    if(filters.reference_module && entry.reference_module !== filters.reference_module) return false;
    if(filters.reference_id && entry.reference_id !== filters.reference_id) return false;
    if(filters.entity_type && entry.entity_type !== filters.entity_type) return false;
    if(desde && entry.timestamp < desde) return false;
    if(hasta && entry.timestamp > hasta) return false;
    return true;
  });
}

function auditValue(value){
  if(value === null || value === undefined) return '—';
  if(typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function actionBadge(action){
  const badge = document.createElement('span');
  badge.className = `audit-badge audit-badge-${action}`;
  badge.textContent = ACTION_LABELS[action] || action;
  return badge;
}

export function renderAuditLog(filters = null){
  const body = qs('audit-log-body');
  const empty = qs('audit-log-empty');
  const error = qs('audit-log-error');
  if(!body || !empty) return [];
  if(error) error.textContent = '';
  const view = qs('view-quality-audit-log');
  const role = auditRole();
  const noticeHost = qs('audit-permission-notice');
  if(!can(role, 'view_audit')){
    clearPermissionNotice(view);
    if(noticeHost){
      noticeHost.replaceChildren(renderPermissionNotice('view_audit'));
      noticeHost.hidden = false;
    }
    body.replaceChildren();
    body.hidden = true;
    empty.hidden = false;
    empty.textContent = 'No tienes permiso para consultar la bitácora de auditoría.';
    applyPermissionState(view, role);
    return [];
  }
  if(noticeHost){
    noticeHost.replaceChildren();
    noticeHost.hidden = true;
  }
  const activeFilters = filters || currentAuditFilters();
  let entries;
  try{
    entries = filterAuditEntries(findAuditEntries(), activeFilters);
  }catch(err){
    if(error) error.textContent = err.message;
    return [];
  }
  const searchInput = qs('audit-log-search');
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if(search){
    entries = entries.filter(entry => [
      ENTITY_LABELS[entry.entity_type] || entry.entity_type,
      entry.entity_id,
      auditReferenceLabel(entry),
      ACTION_LABELS[entry.action] || entry.action,
      entry.changed_field,
      auditValue(entry.before_value),
      auditValue(entry.after_value),
      entry.actor,
      entry.timestamp,
      auditValue(entry.justification)
    ].join(' ').toLowerCase().includes(search));
  }
  body.innerHTML = '';
  if(entries.length === 0){
    body.hidden = true;
    empty.hidden = false;
    empty.textContent = search
      ? 'Ninguna entrada coincide con la búsqueda.'
      : 'No hay entradas de bitácora para los filtros seleccionados.';
    return entries;
  }
  body.hidden = false;
  empty.hidden = true;
  entries.forEach(entry => {
    const row = document.createElement('tr');
    const cells = [
      ENTITY_LABELS[entry.entity_type] || entry.entity_type,
      entry.entity_id,
      auditReferenceLabel(entry),
      null,
      `${entry.changed_field}: ${auditValue(entry.before_value)} → ${auditValue(entry.after_value)}`,
      entry.actor,
      entry.timestamp,
      auditValue(entry.justification)
    ];
    cells.forEach((value, index) => {
      const cell = document.createElement('td');
      if(index === 3) cell.appendChild(actionBadge(entry.action));
      else cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  applyPermissionState(view, role);
  return entries;
}

export function currentAuditFilters(){
  const read = id => (qs(id) ? qs(id).value : '');
  return {
    reference_module: read('audit-filter-module'),
    reference_id: read('audit-filter-reference').trim(),
    entity_type: read('audit-filter-entity'),
    desde: read('audit-filter-from'),
    hasta: read('audit-filter-to')
  };
}

export function applyAuditFilters(){
  return renderAuditLog(currentAuditFilters());
}

export function resetAuditFilters(){
  const filters = clearAuditFilters();
  Object.entries(filters).forEach(([key, value]) => {
    const idMap = {
      reference_module: 'audit-filter-module',
      reference_id: 'audit-filter-reference',
      entity_type: 'audit-filter-entity',
      desde: 'audit-filter-from',
      hasta: 'audit-filter-to'
    };
    const el = qs(idMap[key]);
    if(el) el.value = value;
  });
  const search = qs('audit-log-search');
  if(search) search.value = '';
  return renderAuditLog(filters);
}

export function initAuditLog(){
  const form = qs('audit-filter-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
  form.addEventListener('submit', event => {
    event.preventDefault();
    applyAuditFilters();
  });
  const clearButton = qs('audit-filter-clear');
  if(clearButton) clearButton.addEventListener('click', () => resetAuditFilters());
  const search = qs('audit-log-search');
  if(search) search.addEventListener('input', () => applyAuditFilters());
  renderAuditLog();
}

export function auditReferenceLabel(entry){
  return `${moduleLabel(entry.reference_module)} ${entry.reference_id}`;
}
