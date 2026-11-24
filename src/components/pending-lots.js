import * as storage from '../storage.js';
import { externalDocuments, loadCollection, derivePendingLots } from '../storage.js';
import { buildReferenceMaps, productName, moduleLabel, qs, cell, actionButton } from './quality-utils.js';
import { applyPermissionState } from '../permissions.js';
import { renderStatusBadge } from './status-badge.js';

function activeRole(){
  const getter = storage.getActiveRole;
  if(typeof getter === 'function'){
    try{ return getter(); }catch{ return 'jefe_calidad'; }
  }
  return 'jefe_calidad';
}

function lotState(doc){
  const inspections = loadCollection('quality_inspections')
    .filter(inspection => inspection.reference_module === doc.reference_module && inspection.reference_id === doc.reference_id)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const inspection = inspections[0];
  if(!inspection) return { status: '', label: 'Pendiente', action: 'Inspeccionar', disabled: false };
  if(inspection.inspection_status === 'draft') return { status: 'draft', label: 'Borrador', action: 'Continuar inspección', disabled: false };
  if(inspection.inspection_status === 'pending_review') return { status: 'pending_review', label: 'Pendiente de revisión', action: 'En revisión', disabled: true };
  return { status: '', label: 'Pendiente', action: 'Inspeccionar', disabled: false };
}

export function pendingLotsRows(){
  return derivePendingLots(externalDocuments(), loadCollection('quality_inspections'));
}

export function renderPendingLots(){
  const tbody = qs('pending-lots-body');
  const empty = qs('pending-lots-empty');
  if(!tbody) return [];
  tbody.innerHTML = '';
  const maps = buildReferenceMaps();
  const searchInput = qs('pending-lots-search');
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const rows = pendingLotsRows().filter(doc => {
    if(!search) return true;
    return [doc.reference_id, moduleLabel(doc.reference_module), productName(maps, doc.product_id), doc.date]
      .join(' ').toLowerCase().includes(search);
  });

  rows.forEach(doc => {
    const tr = document.createElement('tr');
    tr.appendChild(cell(doc.reference_id));
    tr.appendChild(cell(moduleLabel(doc.reference_module)));
    tr.appendChild(cell(productName(maps, doc.product_id)));
    tr.appendChild(cell(doc.date || '—'));

    const state = lotState(doc);
    const status = document.createElement('td');
    if(state.status){
      status.appendChild(renderStatusBadge(state.status, { label: state.label }));
    }else{
      const badge = document.createElement('span');
      badge.className = 'status-badge';
      badge.textContent = state.label;
      status.appendChild(badge);
    }
    tr.appendChild(status);

    const action = document.createElement('td');
    const button = actionButton(state.action, 'secondary', {
      inspectModule: doc.reference_module,
      inspectReference: doc.reference_id
    });
    if(state.disabled){
      button.disabled = true;
      button.dataset.stateDisabled = 'true';
    }else{
      button.dataset.permission = 'execute_inspection';
    }
    action.appendChild(button);
    tr.appendChild(action);

    tbody.appendChild(tr);
  });
  applyPermissionState(tbody, activeRole());
  tbody.querySelectorAll('[data-state-disabled]').forEach(button => { button.disabled = true; });

  if(empty){
    empty.hidden = rows.length > 0;
    empty.textContent = search
      ? 'Ningún lote coincide con la búsqueda.'
      : 'No hay lotes pendientes: todos los documentos origen tienen inspección completada.';
  }
  return rows;
}

export function initPendingLots({ onInspect } = {}){
  const searchInput = qs('pending-lots-search');
  if(searchInput && searchInput.dataset.wired !== 'true'){
    searchInput.dataset.wired = 'true';
    searchInput.addEventListener('input', () => renderPendingLots());
  }
  const tbody = qs('pending-lots-body');
  if(!tbody || tbody.dataset.wired === 'true') return;
  tbody.dataset.wired = 'true';
  tbody.addEventListener('click', event => {
    const btn = event.target.closest('button[data-inspect-module]');
    if(!btn) return;
    if(typeof onInspect === 'function') onInspect(btn.dataset.inspectModule, btn.dataset.inspectReference);
  });
}
