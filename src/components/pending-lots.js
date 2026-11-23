import { externalDocuments, loadCollection, derivePendingLots } from '../storage.js';
import { buildReferenceMaps, productName, moduleLabel, qs, cell, actionButton } from './quality-utils.js';

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

    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.textContent = 'Pendiente';
    status.appendChild(badge);
    tr.appendChild(status);

    const action = document.createElement('td');
    action.appendChild(actionButton('Inspeccionar', 'secondary', {
      inspectModule: doc.reference_module,
      inspectReference: doc.reference_id
    }));
    tr.appendChild(action);

    tbody.appendChild(tr);
  });

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
