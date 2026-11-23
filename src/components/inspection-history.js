import {
  loadCollection,
  externalDocuments,
  evidenceFor
} from '../storage.js';
import {
  buildReferenceMaps,
  productName,
  employeeName,
  planName,
  moduleLabel,
  stageLabel,
  resultLabel,
  statusLabel,
  todayIso,
  qs,
  cell,
  actionButton
} from './quality-utils.js';
import { rowsToCsv, downloadContent, safeFilenamePart } from './csv.js';
import { downloadEvidence } from './evidence.js';

export function currentFilters(){
  const search = qs('history-search');
  return {
    module: qs('history-module').value,
    lot: qs('history-lot').value,
    from: qs('history-from').value,
    to: qs('history-to').value,
    search: search ? search.value.trim().toLowerCase() : ''
  };
}

export function filterInspections(inspections, filters){
  const maps = filters.search ? buildReferenceMaps() : null;
  return inspections.filter(inspection => {
    if(filters.module && inspection.reference_module !== filters.module) return false;
    if(filters.lot){
      const [module, referenceId] = filters.lot.split(':');
      if(inspection.reference_module !== module || inspection.reference_id !== referenceId) return false;
    }
    if(filters.from && inspection.inspection_date < filters.from) return false;
    if(filters.to && inspection.inspection_date > filters.to) return false;
    if(filters.search){
      const plan = maps.plans.get(inspection.inspection_plan_id);
      const text = [
        inspection.inspection_date,
        inspection.reference_id,
        moduleLabel(inspection.reference_module),
        plan ? productName(maps, plan.product_id) : '',
        planName(maps, inspection.inspection_plan_id),
        employeeName(maps, inspection.inspector_id),
        resultLabel(inspection.overall_result),
        statusLabel(inspection.inspection_status)
      ].join(' ').toLowerCase();
      if(!text.includes(filters.search)) return false;
    }
    return true;
  }).sort((a, b) => String(b.inspection_date).localeCompare(String(a.inspection_date)));
}

function inspectionResultSummary(inspectionId, maps, results){
  return results
    .filter(result => result.inspection_id === inspectionId)
    .map(result => {
      const criterion = maps.criteria.get(result.criteria_id);
      const name = criterion ? criterion.criteria_name : result.criteria_id;
      return `${name}:${result.measured_value}:${result.pass_fail ? 'Sí' : 'No'}`;
    })
    .join(';');
}

export function buildHistoryCsv(rows, maps, results){
  const header = ['Lote', 'Producto', 'Plan', 'Etapa', 'Fecha', 'Inspector', 'Dictamen', 'Estado', 'Resultados'];
  const body = (rows || []).map(inspection => {
    const plan = maps.plans.get(inspection.inspection_plan_id);
    return [
      `${moduleLabel(inspection.reference_module)} ${inspection.reference_id}`,
      plan ? productName(maps, plan.product_id) : '—',
      planName(maps, inspection.inspection_plan_id),
      plan ? stageLabel(plan.applicable_stage) : '—',
      inspection.inspection_date,
      employeeName(maps, inspection.inspector_id),
      resultLabel(inspection.overall_result),
      statusLabel(inspection.inspection_status),
      inspectionResultSummary(inspection.inspection_id, maps, results)
    ];
  });
  return rowsToCsv([header, ...body]);
}

export function historyCsv(rows){
  return buildHistoryCsv(
    rows,
    buildReferenceMaps(),
    loadCollection('quality_inspection_results')
  );
}

export function exportHistoryCsv(){
  const error = qs('history-export-error');
  if(error) error.textContent = '';
  const filters = currentFilters();
  if(filters.from && filters.to && filters.from > filters.to){
    if(error) error.textContent = 'El rango de fechas es inválido: "Desde" no puede ser posterior a "Hasta".';
    return null;
  }
  const rows = filterInspections(loadCollection('quality_inspections'), filters);
  if(rows.length === 0){
    if(error) error.textContent = 'No hay inspecciones para exportar con los filtros aplicados.';
    return null;
  }
  const content = historyCsv(rows);
  const suffix = [
    filters.module,
    filters.lot ? filters.lot.replace(':', '-') : '',
    filters.from,
    filters.to
  ].filter(Boolean).map(safeFilenamePart).filter(Boolean).join('_');
  const filename = `calidad_historial_${todayIso()}${suffix ? `_${suffix}` : ''}.csv`;
  try{
    downloadContent(content, filename);
  }catch(err){
    if(error) error.textContent = err.message;
    return null;
  }
  return content;
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

    const evidenceCell = document.createElement('td');
    evidenceCell.className = 'table-actions';
    const evidence = evidenceFor('inspection', inspection.inspection_id);
    if(evidence.length === 0){
      evidenceCell.textContent = '—';
    } else {
      evidence.forEach(record => {
        evidenceCell.appendChild(actionButton(record.file_name, 'secondary', { evidenceDownload: record.id }));
      });
    }
    tr.appendChild(evidenceCell);

    tbody.appendChild(tr);
  });

  if(empty){
    empty.hidden = rows.length > 0;
    empty.textContent = filters.search
      ? 'Ninguna inspección coincide con la búsqueda.'
      : 'No hay inspecciones para los filtros aplicados.';
  }
  return rows;
}

export function clearHistoryFilters(){
  qs('history-module').value = '';
  renderHistoryLotOptions('');
  qs('history-from').value = '';
  qs('history-to').value = '';
  const search = qs('history-search');
  if(search) search.value = '';
  const error = qs('history-error');
  if(error) error.textContent = '';
  renderHistory();
}

function handleHistoryBodyClick(event){
  const button = event.target.closest('button[data-evidence-download]');
  if(!button) return;
  const record = loadCollection('quality_evidence')
    .find(item => item.id === button.dataset.evidenceDownload);
  if(!record) return;
  try{
    downloadEvidence(record);
  }catch(err){
    const error = qs('history-export-error');
    if(error) error.textContent = err.message;
  }
}

export function initInspectionHistory(){
  const button = qs('history-apply');
  if(!button || button.dataset.wired === 'true') return;
  button.dataset.wired = 'true';
  button.addEventListener('click', () => renderHistory());
  qs('history-clear').addEventListener('click', () => clearHistoryFilters());
  qs('history-module').addEventListener('change', () => renderHistoryLotOptions(''));
  const search = qs('history-search');
  if(search) search.addEventListener('input', () => renderHistory());
  const exportButton = qs('history-export');
  if(exportButton) exportButton.addEventListener('click', () => exportHistoryCsv());
  const body = qs('history-body');
  if(body) body.addEventListener('click', handleHistoryBodyClick);
}
