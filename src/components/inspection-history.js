import {
  loadCollection,
  externalDocuments
} from '../storage.js';
import {
  buildReferenceMaps,
  productName,
  employeeName,
  planName,
  moduleLabel,
  resultLabel,
  statusLabel,
  qs,
  cell,
  emptyState
} from './quality-utils.js';

export function currentFilters(){
  return {
    module: qs('history-module').value,
    lot: qs('history-lot').value,
    from: qs('history-from').value,
    to: qs('history-to').value
  };
}

export function filterInspections(inspections, filters){
  return inspections.filter(inspection => {
    if(filters.module && inspection.reference_module !== filters.module) return false;
    if(filters.lot){
      const [module, referenceId] = filters.lot.split(':');
      if(inspection.reference_module !== module || inspection.reference_id !== referenceId) return false;
    }
    if(filters.from && inspection.inspection_date < filters.from) return false;
    if(filters.to && inspection.inspection_date > filters.to) return false;
    return true;
  }).sort((a, b) => String(b.inspection_date).localeCompare(String(a.inspection_date)));
}

export function renderHistoryLotOptions(selected){
  const select = qs('history-lot');
  if(!select) return;
  const currentModule = qs('history-module').value;
  const prev = selected !== undefined ? selected : select.value;
  const docs = externalDocuments().filter(doc => !currentModule || doc.reference_module === currentModule);
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Todos';
  select.appendChild(blank);
  docs.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = `${doc.reference_module}:${doc.reference_id}`;
    opt.textContent = `${doc.reference_id} · ${moduleLabel(doc.reference_module)}`;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

export function renderHistory(){
  const tbody = qs('history-body');
  const empty = qs('history-empty');
  const error = qs('history-error');
  if(!tbody) return [];
  if(error) error.textContent = '';

  if(qs('history-lot').options.length <= 1) renderHistoryLotOptions('');

  const filters = currentFilters();
  if(filters.from && filters.to && filters.from > filters.to){
    if(error) error.textContent = 'El rango de fechas es inválido: "Desde" no puede ser posterior a "Hasta".';
    tbody.innerHTML = '';
    if(empty) empty.hidden = false;
    return [];
  }

  const maps = buildReferenceMaps();
  const ncs = loadCollection('non_conformances');
  const capas = loadCollection('corrective_actions');
  const rows = filterInspections(loadCollection('quality_inspections'), filters);

  tbody.innerHTML = '';
  rows.forEach(inspection => {
    const tr = document.createElement('tr');
    const plan = maps.plans.get(inspection.inspection_plan_id);
    tr.appendChild(cell(inspection.inspection_date));
    tr.appendChild(cell(`${moduleLabel(inspection.reference_module)} ${inspection.reference_id}`));
    tr.appendChild(cell(plan ? productName(maps, plan.product_id) : '—'));
    tr.appendChild(cell(planName(maps, inspection.inspection_plan_id)));
    tr.appendChild(cell(employeeName(maps, inspection.inspector_id)));
    tr.appendChild(cell(statusLabel(inspection.inspection_status)));
    tr.appendChild(cell(resultLabel(inspection.overall_result)));

    const nc = ncs.find(n => n.inspection_id === inspection.inspection_id);
    tr.appendChild(cell(nc ? nc.non_conformance_id : '—'));
    const ncCapas = nc ? capas.filter(a => a.non_conformance_id === nc.non_conformance_id) : [];
    tr.appendChild(cell(ncCapas.length ? `${ncCapas.length} acción(es)` : '—'));

    tbody.appendChild(tr);
  });

  if(empty) empty.hidden = rows.length > 0;
  return rows;
}

export function clearHistoryFilters(){
  qs('history-module').value = '';
  renderHistoryLotOptions('');
  qs('history-from').value = '';
  qs('history-to').value = '';
  const error = qs('history-error');
  if(error) error.textContent = '';
  renderHistory();
}

export function initInspectionHistory(){
  const button = qs('history-apply');
  if(!button || button.dataset.wired === 'true') return;
  button.dataset.wired = 'true';
  button.addEventListener('click', () => renderHistory());
  qs('history-clear').addEventListener('click', () => clearHistoryFilters());
  qs('history-module').addEventListener('change', () => renderHistoryLotOptions(''));
}
