import {
  loadCollection,
  loadExternal,
  updateNonConformance,
  deleteNonConformance,
  addCorrectiveAction,
  updateCorrectiveAction,
  deleteCorrectiveAction,
  validateCorrectiveAction,
  deriveQuarantineLots,
  isCapaOverdue,
  overrideInspection
} from '../storage.js';
import {
  buildReferenceMaps,
  productName,
  employeeName,
  planName,
  moduleLabel,
  resultLabel,
  todayIso,
  qs,
  cell,
  actionButton,
  emptyState
} from './quality-utils.js';

const NC_ERROR_FIELDS = {
  description: 'error-nc-description',
  defect_type: 'error-nc-defect',
  severity: 'error-nc-severity',
  status: 'error-nc-status'
};

const CAPA_ERROR_FIELDS = {
  responsible_employee_id: 'error-capa-responsible',
  action_description: 'error-capa-description',
  root_cause: 'error-capa-root',
  action_type: 'error-capa-type',
  due_date: 'error-capa-due',
  status: 'error-capa-status'
};

function populateSelect(select, records, valueKey, labelFn, blankLabel){
  if(!select) return;
  const prev = select.value;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = blankLabel;
  select.appendChild(blank);
  records.forEach(record => {
    const opt = document.createElement('option');
    opt.value = record[valueKey];
    opt.textContent = labelFn(record);
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

export function showNcErrors(errors = {}){
  Object.entries(NC_ERROR_FIELDS).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
}

export function showCapaErrors(errors = {}){
  Object.entries(CAPA_ERROR_FIELDS).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
  const ncError = qs('error-capa-nc');
  if(ncError) ncError.textContent = errors.non_conformance_id || '';
}

export function clearNcForm(){
  qs('nc-id').value = '';
  qs('nc-description').value = '';
  qs('nc-defect').value = 'other';
  qs('nc-severity').value = 'major';
  qs('nc-status').value = 'open';
  qs('nc-cancel').hidden = true;
  showNcErrors({});
  qs('nc-error').textContent = '';
}

export function clearCapaForm(){
  qs('capa-id').value = '';
  qs('capa-description').value = '';
  qs('capa-root').value = '';
  qs('capa-type').value = 'other';
  qs('capa-due').value = '';
  qs('capa-status').value = 'pending';
  qs('capa-cancel').hidden = true;
  showCapaErrors({});
  qs('capa-error').textContent = '';
}

export function collectCapaPayload(){
  return {
    non_conformance_id: qs('capa-nc').value,
    responsible_employee_id: qs('capa-responsible').value,
    action_description: qs('capa-description').value,
    root_cause: qs('capa-root').value,
    action_type: qs('capa-type').value,
    due_date: qs('capa-due').value,
    status: qs('capa-status').value
  };
}

function renderReview(){
  const tbody = qs('review-body');
  const empty = qs('review-empty');
  if(!tbody) return;
  tbody.innerHTML = '';
  const inspections = loadCollection('quality_inspections')
    .filter(i => i.inspection_status === 'completed' && i.overall_result === 'conditional');
  const maps = buildReferenceMaps();

  inspections.forEach(inspection => {
    const tr = document.createElement('tr');
    tr.appendChild(cell(inspection.inspection_id));
    tr.appendChild(cell(`${moduleLabel(inspection.reference_module)} ${inspection.reference_id}`));
    const plan = maps.plans.get(inspection.inspection_plan_id);
    tr.appendChild(cell(plan ? productName(maps, plan.product_id) : '—'));
    tr.appendChild(cell(inspection.inspection_date));

    const result = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-badge badge-conditional';
    badge.textContent = resultLabel(inspection.overall_result);
    result.appendChild(badge);
    tr.appendChild(result);

    tbody.appendChild(tr);
  });

  if(empty) empty.hidden = inspections.length > 0;
}

function renderOverrideSelect(){
  const select = qs('override-inspection');
  if(!select) return;
  const maps = buildReferenceMaps();
  const inspections = loadCollection('quality_inspections').filter(i => i.inspection_status === 'completed');
  populateSelect(
    select,
    inspections,
    'inspection_id',
    inspection => `${moduleLabel(inspection.reference_module)} ${inspection.reference_id} · ${resultLabel(inspection.overall_result)}`,
    inspections.length ? '-- Selecciona una inspección --' : '-- No hay inspecciones completadas --'
  );
  void maps;
}

function renderNcList(){
  const container = qs('nc-list');
  if(!container) return;
  container.innerHTML = '';
  const list = loadCollection('non_conformances');
  const isEmpty = list.length === 0;
  emptyState(container, 'No hay no conformidades registradas.', isEmpty);
  if(isEmpty) return;

  const maps = buildReferenceMaps();
  list.forEach(nc => {
    const item = document.createElement('div');
    item.className = 'record-item';

    const head = document.createElement('div');
    head.className = 'record-item-head';
    const title = document.createElement('strong');
    title.textContent = productName(maps, nc.product_id);
    head.appendChild(title);
    const severity = document.createElement('span');
    severity.className = `status-badge badge-${nc.severity}`;
    severity.textContent = nc.severity;
    head.appendChild(severity);
    const status = document.createElement('span');
    status.className = 'status-badge';
    status.textContent = nc.status;
    head.appendChild(status);
    item.appendChild(head);

    const description = document.createElement('p');
    description.className = 'record-description';
    description.textContent = nc.description;
    item.appendChild(description);

    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = `Tipo: ${nc.defect_type} · Inspección: ${nc.inspection_id || '—'}`;
    item.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.appendChild(actionButton('Editar', 'secondary', { ncEdit: nc.id }));
    actions.appendChild(actionButton('Eliminar', 'danger', { ncDelete: nc.id }));
    item.appendChild(actions);

    container.appendChild(item);
  });
}

function renderCapaList(){
  const container = qs('capa-list');
  if(!container) return;
  container.innerHTML = '';
  const actions = loadCollection('corrective_actions');
  const isEmpty = actions.length === 0;
  emptyState(container, 'No hay acciones CAPA registradas.', isEmpty);
  if(isEmpty) return;

  const maps = buildReferenceMaps();
  const ncs = new Map(loadCollection('non_conformances').map(nc => [nc.non_conformance_id, nc]));

  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['No conformidad', 'Responsable', 'Tipo', 'Vence', 'Estado', 'Acciones'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  actions.forEach(action => {
    const tr = document.createElement('tr');
    const nc = ncs.get(action.non_conformance_id);
    tr.appendChild(cell(nc ? nc.description.slice(0, 60) : action.non_conformance_id));
    tr.appendChild(cell(employeeName(maps, action.responsible_employee_id)));
    tr.appendChild(cell(action.action_type));
    tr.appendChild(cell(action.due_date));

    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.textContent = action.status;
    status.appendChild(badge);
    if(isCapaOverdue(action)){
      const overdue = document.createElement('span');
      overdue.className = 'status-badge badge-overdue';
      overdue.textContent = 'Vencida';
      status.appendChild(overdue);
    }
    tr.appendChild(status);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'table-actions';
    actionsCell.appendChild(actionButton('Editar', 'secondary', { capaEdit: action.id }));
    actionsCell.appendChild(actionButton('Eliminar', 'danger', { capaDelete: action.id }));
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderQuarantine(){
  const tbody = qs('quarantine-body');
  const empty = qs('quarantine-empty');
  if(!tbody) return;
  tbody.innerHTML = '';
  const rows = deriveQuarantineLots();
  const maps = buildReferenceMaps();

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.appendChild(cell(row.reference_id || '—'));
    tr.appendChild(cell(productName(maps, row.product_id)));
    tr.appendChild(cell(row.severity));
    tr.appendChild(cell(row.defect_type));

    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status-badge ${row.has_capa ? 'badge-treatment' : 'badge-quarantine'}`;
    badge.textContent = row.status_label;
    status.appendChild(badge);
    tr.appendChild(status);

    const action = document.createElement('td');
    action.appendChild(actionButton('Gestionar CAPA', 'secondary', { quarantineNc: row.non_conformance_id }));
    tr.appendChild(action);

    tbody.appendChild(tr);
  });

  if(empty) empty.hidden = rows.length > 0;
}

export function renderNonConformance(){
  const ncs = loadCollection('non_conformances');
  populateSelect(
    qs('capa-nc'),
    ncs,
    'non_conformance_id',
    nc => `${nc.non_conformance_id} · ${nc.description.slice(0, 50)}`,
    ncs.length ? '-- Selecciona una no conformidad --' : '-- No hay no conformidades --'
  );
  populateSelect(
    qs('capa-responsible'),
    loadExternal('employees'),
    'employee_id',
    employee => employee.name,
    '-- Selecciona un responsable --'
  );
  renderOverrideSelect();
  renderReview();
  renderNcList();
  renderCapaList();
  renderQuarantine();
  if(!qs('capa-due').value) qs('capa-due').value = todayIso();
}

function startNcEdit(nc){
  qs('nc-id').value = nc.id;
  qs('nc-description').value = nc.description;
  qs('nc-defect').value = nc.defect_type;
  qs('nc-severity').value = nc.severity;
  qs('nc-status').value = nc.status;
  qs('nc-cancel').hidden = false;
  showNcErrors({});
  qs('nc-error').textContent = '';
}

function startCapaEdit(action){
  qs('capa-id').value = action.id;
  qs('capa-nc').value = action.non_conformance_id;
  qs('capa-responsible').value = action.responsible_employee_id;
  qs('capa-description').value = action.action_description;
  qs('capa-root').value = action.root_cause;
  qs('capa-type').value = action.action_type;
  qs('capa-due').value = action.due_date;
  qs('capa-status').value = action.status;
  qs('capa-cancel').hidden = false;
  showCapaErrors({});
  qs('capa-error').textContent = '';
}

function handleOverrideSubmit(event){
  event.preventDefault();
  const error = qs('override-error');
  error.textContent = '';
  try{
    overrideInspection(
      qs('override-inspection').value,
      qs('override-result').value,
      qs('override-justification').value,
      qs('override-user').value
    );
    qs('override-justification').value = '';
    renderNonConformance();
  }catch(err){
    error.textContent = err.message;
  }
}

function handleNcSubmit(event){
  event.preventDefault();
  const id = qs('nc-id').value;
  if(!id){
    qs('nc-error').textContent = 'Selecciona una no conformidad existente para editarla.';
    return;
  }
  const payload = {
    description: qs('nc-description').value,
    defect_type: qs('nc-defect').value,
    severity: qs('nc-severity').value,
    status: qs('nc-status').value
  };
  try{
    updateNonConformance(id, payload);
    clearNcForm();
    renderNonConformance();
  }catch(err){
    qs('nc-error').textContent = err.message;
  }
}

function handleCapaSubmit(event){
  event.preventDefault();
  const id = qs('capa-id').value;
  const payload = collectCapaPayload();
  const check = validateCorrectiveAction(payload);
  showCapaErrors(check.errors);
  if(!check.valid) return;
  try{
    if(id) updateCorrectiveAction(id, payload);
    else addCorrectiveAction(payload);
    clearCapaForm();
    renderNonConformance();
  }catch(err){
    qs('capa-error').textContent = err.message;
  }
}

function handleNcListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const ncs = loadCollection('non_conformances');
  if(button.dataset.ncEdit){
    const nc = ncs.find(n => n.id === button.dataset.ncEdit);
    if(nc) startNcEdit(nc);
    return;
  }
  if(button.dataset.ncDelete){
    if(!confirm('¿Eliminar esta no conformidad y sus acciones CAPA?')) return;
    try{
      deleteNonConformance(button.dataset.ncDelete);
      clearNcForm();
      renderNonConformance();
    }catch(err){
      qs('nc-error').textContent = err.message;
    }
  }
}

function handleCapaListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const actions = loadCollection('corrective_actions');
  if(button.dataset.capaEdit){
    const action = actions.find(a => a.id === button.dataset.capaEdit);
    if(action) startCapaEdit(action);
    return;
  }
  if(button.dataset.capaDelete){
    if(!confirm('¿Eliminar esta acción CAPA?')) return;
    try{
      deleteCorrectiveAction(button.dataset.capaDelete);
      clearCapaForm();
      renderNonConformance();
    }catch(err){
      qs('capa-error').textContent = err.message;
    }
  }
}

export function initNonConformanceCapa(){
  const form = qs('override-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', handleOverrideSubmit);
  qs('nc-form').addEventListener('submit', handleNcSubmit);
  qs('nc-cancel').addEventListener('click', clearNcForm);
  qs('nc-list').addEventListener('click', handleNcListClick);
  qs('capa-form').addEventListener('submit', handleCapaSubmit);
  qs('capa-cancel').addEventListener('click', clearCapaForm);
  qs('capa-list').addEventListener('click', handleCapaListClick);
  qs('review-body').addEventListener('click', event => {
    const row = event.target.closest('tr');
    if(!row) return;
    const first = row.querySelector('td');
    if(first) qs('override-inspection').value = first.textContent;
  });
  qs('quarantine-body').addEventListener('click', event => {
    const btn = event.target.closest('button[data-quarantine-nc]');
    if(!btn) return;
    qs('capa-nc').value = btn.dataset.quarantineNc;
    qs('capa-description').focus();
  });
}
