import * as storage from '../storage.js';
import {
  loadCollection,
  loadExternal,
  validateCorrectiveAction,
  addCorrectiveAction,
  updateCorrectiveAction,
  deleteCorrectiveAction,
  isCapaOverdue,
  evidenceFor,
  deleteEvidence,
  qualityCatalog
} from '../storage.js';
import { can, assertCan, applyPermissionState } from '../permissions.js';
import { CAPA_CLOSURE_STATUSES, EFFECTIVENESS_RESULTS } from '../quality-status.js';
import {
  buildReferenceMaps,
  employeeName,
  todayIso,
  qs,
  cell,
  actionButton
} from './quality-utils.js';
import { addEvidenceFromFile, downloadEvidence, renderEvidenceList } from './evidence.js';
import { renderStatusBadge, statusLabel } from './status-badge.js';
import { renderPermissionNotice } from './permission-notice.js';

const ERROR_FIELDS = {
  action_category: 'error-capm-category',
  action_description: 'error-capm-description',
  responsible_employee_id: 'error-capm-responsible',
  root_cause: 'error-capm-root',
  action_type: 'error-capm-type',
  due_date: 'error-capm-due',
  status: 'error-capm-status',
  progress: 'error-capm-progress'
};

const STATUS_META = {
  pending: { label: 'Pendiente', className: 'capa-status-pending', rank: 0 },
  in_progress: { label: 'En ejecución', className: 'capa-status-progress', rank: 1 },
  completed: { label: 'Completada', className: 'capa-status-completed', rank: 2 }
};

const CATEGORY_META = {
  corrective: { label: 'Correctiva', className: 'capa-type-corrective' },
  preventive: { label: 'Preventiva', className: 'capa-type-preventive' }
};

const TYPE_LABELS = {
  rework: 'Reproceso',
  resampling: 'Nuevo muestreo',
  other: 'Otra'
};

const DUE_FILTER_CLASS = {
  overdue: 'capa-due-overdue',
  soon: 'capa-due-soon',
  future: 'capa-due-safe'
};

const AUDIT_FIELD_LABELS = {
  action_category: 'Tipo de acción',
  action_description: 'Descripción',
  non_conformance_id: 'No conformidad',
  responsible_employee_id: 'Responsable',
  root_cause: 'Causa raíz',
  action_type: 'Modalidad',
  start_date: 'Fecha de inicio',
  due_date: 'Fecha límite',
  expected_result: 'Resultado esperado',
  observations: 'Observaciones',
  progress: 'Avance',
  status: 'Estado'
};

const AUDIT_ACTION_LABELS = {
  create: 'Registro creado',
  status_change: 'Cambio de estado',
  update: 'Actualización',
  delete: 'Eliminación'
};

const CLOSURE_META = {
  pending: { label: 'Pendiente', className: 'status-pending badge-pending' },
  approved: { label: 'Aprobado', className: 'status-approved badge-approved' },
  rejected: { label: 'Rechazado', className: 'status-rejected badge-rejected' }
};

const EFFECTIVENESS_LABELS = {
  effective: 'Eficaz',
  not_effective: 'No eficaz'
};

let currentDetailId = '';

function activeRole(){
  const getter = storage.getActiveRole;
  if(typeof getter === 'function'){
    try{ return getter(); }catch{ return 'jefe_calidad'; }
  }
  return 'jefe_calidad';
}

function invoke(name, ...args){
  const fn = storage[name];
  if(typeof fn !== 'function') throw new Error(`La operación ${name} no está disponible en este momento.`);
  return fn(...args);
}

function capaContext(action){
  return {
    status: action && action.status,
    closureStatus: action && action.closure_status
  };
}

function workflowButton(label, dataset, permission, disabled){
  const button = actionButton(label, 'secondary', dataset);
  if(disabled){
    button.disabled = true;
    button.dataset.stateDisabled = 'true';
  }else{
    button.dataset.permission = permission;
  }
  return button;
}

function applyStateDisables(root){
  if(!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-state-disabled]').forEach(button => { button.disabled = true; });
}

function applyCapaPermissions(root){
  const scope = root || document;
  applyPermissionState(scope, activeRole());
  applyStateDisables(scope);
}

function permissionNotice(container, action, context){
  if(!container || can(activeRole(), action, context)) return;
  [...container.children].forEach(child => {
    if(child.classList && child.classList.contains('permission-notice')) child.remove();
  });
  container.prepend(renderPermissionNotice(action));
}

function setDetailError(message){
  const error = qs('capm-detail-error') || qs('capm-error');
  if(error) error.textContent = message || '';
}

function reloadAction(id){
  renderCapaManager();
  showCapaDetail(id);
}

function completeAction(action){
  try{
    assertCan(activeRole(), 'complete_capa', capaContext(action));
    const updated = updateCorrectiveAction(action.id, { status: 'completed', progress: 100 });
    setDetailError('');
    reloadAction(updated.id);
  }catch(err){
    setDetailError(err.message);
  }
}

function requestClosure(action){
  try{
    assertCan(activeRole(), 'request_capa_closure', capaContext(action));
    const updated = invoke('requestCapaClosure', action.id, action.responsible_employee_id || activeRole());
    setDetailError('');
    reloadAction(updated.id);
  }catch(err){
    setDetailError(err.message);
  }
}

function saveEffectiveness(action){
  const result = qs('capm-effectiveness') ? qs('capm-effectiveness').value : '';
  const observations = qs('capm-effectiveness-observations') ? qs('capm-effectiveness-observations').value.trim() : '';
  if(!result || !observations){
    setDetailError('Registra la eficacia y sus observaciones antes de continuar.');
    return;
  }
  try{
    assertCan(activeRole(), 'register_effectiveness', capaContext(action));
    const updated = invoke('registerCapaEffectiveness', action.id, result, observations, activeRole());
    setDetailError('');
    reloadAction(updated.id);
  }catch(err){
    setDetailError(err.message);
  }
}

function reviewClosure(action, decision){
  const effectiveness = qs('capm-effectiveness') ? qs('capm-effectiveness').value : '';
  const effectivenessNotes = qs('capm-effectiveness-observations') ? qs('capm-effectiveness-observations').value.trim() : '';
  let justification = qs('capm-closure-justification') ? qs('capm-closure-justification').value.trim() : '';
  if(decision === 'rejected' && !justification && typeof prompt === 'function'){
    justification = String(prompt('Justificación del rechazo del cierre') || '').trim();
  }
  if(effectiveness && !effectivenessNotes){
    setDetailError('Registra las observaciones de eficacia antes de decidir el cierre.');
    return;
  }
  if(decision === 'rejected' && !justification){
    setDetailError('Registra la justificación para continuar.');
    return;
  }
  try{
    assertCan(activeRole(), 'review_capa_closure', capaContext(action));
    const updated = invoke(
      'reviewCapaClosure',
      action.id,
      decision,
      effectiveness || null,
      effectivenessNotes || null,
      activeRole(),
      justification || null
    );
    setDetailError('');
    reloadAction(updated.id);
  }catch(err){
    setDetailError(err.message);
  }
}

function closureBadge(status){
  const key = CAPA_CLOSURE_STATUSES.includes(status) ? status : 'pending';
  const badgeEl = renderStatusBadge(key);
  badgeEl.classList.add(CLOSURE_META[key].className);
  badgeEl.setAttribute('aria-label', `Cierre: ${statusLabel(key)}`);
  return badgeEl;
}

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

function metaFor(value, map, fallback){
  return map[value] || { label: fallback || value || '—', className: '', rank: 99 };
}

function categoryMeta(value){
  const key = value || 'corrective';
  const fallback = CATEGORY_META[key] || { label: key, className: '' };
  const configured = qualityCatalog('action_types').find(item => item.key === key);
  return { ...fallback, label: configured ? configured.label : fallback.label };
}

function progressOf(action){
  const fallback = action.status === 'completed' ? 100 : action.status === 'in_progress' ? 50 : 0;
  const numeric = Number(action.progress === undefined || action.progress === '' ? fallback : action.progress);
  if(!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function daysUntilDue(action){
  if(!action.due_date) return null;
  const due = Date.parse(`${action.due_date}T00:00:00Z`);
  const today = Date.parse(`${todayIso()}T00:00:00Z`);
  if(!Number.isFinite(due) || !Number.isFinite(today)) return null;
  return Math.round((due - today) / 86400000);
}

function dueMeta(action){
  if(isCapaOverdue(action)) return { label: 'Fuera de plazo', className: 'capa-due-overdue', rank: 0 };
  const days = daysUntilDue(action);
  if(days !== null && days >= 0 && days <= 7){
    return { label: days === 0 ? 'Vence hoy' : `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, className: 'capa-due-soon', rank: 1 };
  }
  return { label: 'En plazo', className: 'capa-due-safe', rank: 2 };
}

function formatAuditValue(value){
  if(value === undefined || value === null || value === '') return '—';
  if(value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function badge(text, className){
  const span = document.createElement('span');
  span.className = `capa-badge ${className}`;
  span.textContent = text;
  return span;
}

function progressBar(value){
  const wrapper = document.createElement('div');
  wrapper.className = value === 100 ? 'capa-progress is-complete' : 'capa-progress';
  const track = document.createElement('div');
  track.className = 'capa-progress-track';
  const fill = document.createElement('span');
  fill.style.width = `${value}%`;
  track.appendChild(fill);
  const label = document.createElement('strong');
  label.textContent = `${value}%`;
  wrapper.append(track, label);
  return wrapper;
}

export function showCapaManagerErrors(errors = {}){
  Object.entries(ERROR_FIELDS).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
}

export function clearCapaManagerForm(){
  const fields = [
    'capm-id', 'capm-description', 'capm-nc', 'capm-responsible', 'capm-root',
    'capm-start-date', 'capm-due-date', 'capm-expected-result', 'capm-files'
  ];
  fields.forEach(id => {
    const el = qs(id);
    if(el) el.value = '';
  });
  if(qs('capm-category')) qs('capm-category').value = qualityCatalog('action_types')[0]?.key || 'corrective';
  if(qs('capm-type')) qs('capm-type').value = 'rework';
  if(qs('capm-status')) qs('capm-status').value = 'pending';
  if(qs('capm-start-date')) qs('capm-start-date').value = todayIso();
  if(qs('capm-form-heading')) qs('capm-form-heading').textContent = 'Nueva acción';
  if(qs('capm-error')) qs('capm-error').textContent = '';
  showCapaManagerErrors({});
}

function hideCapaForm(){
  const card = qs('capm-form-card');
  if(card) card.hidden = true;
  clearCapaManagerForm();
}

function hideCapaDetail(){
  const card = qs('capm-detail-card');
  if(card) card.hidden = true;
  const listCard = qs('capm-list') && qs('capm-list').closest('.card');
  if(listCard) listCard.hidden = false;
  currentDetailId = '';
}

function openCapaForm(action){
  hideCapaDetail();
  clearCapaManagerForm();
  const card = qs('capm-form-card');
  if(card){
    card.hidden = false;
    if(card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if(action){
    qs('capm-id').value = action.id;
    qs('capm-category').value = action.action_category || 'corrective';
    qs('capm-description').value = action.action_description;
    qs('capm-nc').value = action.non_conformance_id || '';
    qs('capm-responsible').value = action.responsible_employee_id;
    qs('capm-root').value = action.root_cause;
    qs('capm-type').value = action.action_type;
    qs('capm-start-date').value = action.start_date || todayIso();
    qs('capm-due-date').value = action.due_date;
    qs('capm-expected-result').value = action.expected_result || '';
    qs('capm-status').value = action.status;
    qs('capm-form-heading').textContent = `Editar acción · ${action.corrective_action_id}`;
  }
  qs('capm-description').focus();
}

function renderSummary(actions){
  const container = qs('capm-summary');
  if(!container) return;
  const values = [
    { key: 'pending', label: 'Acciones pendientes', value: actions.filter(a => a.status === 'pending').length, hint: 'Sin iniciar' },
    { key: 'progress', label: 'En ejecución', value: actions.filter(a => a.status === 'in_progress').length, hint: 'Trabajo en curso' },
    { key: 'completed', label: 'Completadas', value: actions.filter(a => a.status === 'completed').length, hint: 'Ejecución reportada' },
    { key: 'overdue', label: 'Fuera de plazo', value: actions.filter(a => isCapaOverdue(a)).length, hint: 'Requieren atención inmediata' },
    { key: 'closure', label: 'Cierres pendientes', value: actions.filter(a => a.closure_status === 'pending').length, hint: 'Requieren revisión de jefatura' }
  ];
  container.replaceChildren(...values.map(item => {
    const card = document.createElement('article');
    card.className = `capa-stat ${item.key}`;
    const label = document.createElement('span');
    label.textContent = item.label;
    const value = document.createElement('strong');
    value.textContent = String(item.value);
    const hint = document.createElement('small');
    hint.textContent = item.hint;
    card.append(label, value, hint);
    return card;
  }));
}

function filteredActions(){
  const search = (qs('capm-search').value || '').trim().toLowerCase();
  const category = qs('capm-category-filter').value;
  const status = qs('capm-status-filter').value;
  const due = qs('capm-due-filter').value;
  const ncs = new Map(loadCollection('non_conformances').map(nc => [nc.non_conformance_id, nc]));
  return loadCollection('corrective_actions')
    .filter(action => {
      const nc = ncs.get(action.non_conformance_id);
      const haystack = `${action.corrective_action_id} ${action.action_description} ${nc ? nc.description : ''}`.toLowerCase();
      if(search && !haystack.includes(search)) return false;
      if(category && (action.action_category || 'corrective') !== category) return false;
      if(status && action.status !== status) return false;
      if(due && dueMeta(action).className !== DUE_FILTER_CLASS[due]) return false;
      return true;
    })
    .sort((a, b) => {
      const dueDiff = dueMeta(a).rank - dueMeta(b).rank;
      if(dueDiff) return dueDiff;
      return String(a.due_date || '').localeCompare(String(b.due_date || ''));
    });
}

function renderList(){
  const host = qs('capm-list');
  const empty = qs('capm-empty');
  if(!host) return;
  const all = loadCollection('corrective_actions');
  const list = filteredActions();
  renderSummary(all);
  const count = qs('capm-result-count');
  if(count) count.textContent = `Mostrando ${list.length} de ${all.length} acciones`;
  host.replaceChildren();
  if(empty) empty.hidden = list.length > 0;
  if(!list.length) return;

  const maps = buildReferenceMaps();
  const ncs = new Map(loadCollection('non_conformances').map(nc => [nc.non_conformance_id, nc]));
  const table = document.createElement('table');
  table.className = 'data-table capa-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Código de acción', 'Descripción', 'No conformidad relacionada', 'Tipo de acción', 'Responsable', 'Fecha de inicio', 'Fecha límite', 'Estado', 'Progreso', 'Acciones'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tbody.id = 'capm-rows';
  list.forEach(action => {
    const tr = document.createElement('tr');

    const code = document.createElement('td');
    code.className = 'capa-code';
    code.textContent = action.corrective_action_id;
    tr.appendChild(code);

    const description = document.createElement('td');
    description.className = 'capa-description-cell';
    const title = document.createElement('strong');
    title.textContent = action.action_description;
    const meta = document.createElement('span');
    meta.className = 'nc-muted-meta';
    meta.textContent = action.expected_result || TYPE_LABELS[action.action_type] || '—';
    description.append(title, meta);
    tr.appendChild(description);

    const ncCell = document.createElement('td');
    const nc = ncs.get(action.non_conformance_id);
    if(nc){
      const codeEl = document.createElement('strong');
      codeEl.textContent = nc.non_conformance_id;
      const desc = document.createElement('span');
      desc.className = 'nc-muted-meta';
      desc.textContent = nc.description.slice(0, 48);
      ncCell.append(codeEl, desc);
    }else{
      ncCell.textContent = action.non_conformance_id || 'Sin NC';
    }
    tr.appendChild(ncCell);

    const typeCell = document.createElement('td');
    const category = categoryMeta(action.action_category);
    typeCell.appendChild(badge(category.label, category.className));
    const mode = document.createElement('span');
    mode.className = 'nc-muted-meta';
    mode.textContent = TYPE_LABELS[action.action_type] || action.action_type;
    typeCell.appendChild(mode);
    tr.appendChild(typeCell);

    tr.appendChild(cell(employeeName(maps, action.responsible_employee_id)));
    tr.appendChild(cell(action.start_date || '—'));

    const dueCell = document.createElement('td');
    dueCell.textContent = action.due_date || '—';
    const due = dueMeta(action);
    const dueBadge = document.createElement('span');
    dueBadge.className = `capa-due-tag ${due.className}`;
    dueBadge.textContent = due.label;
    dueCell.appendChild(dueBadge);
    tr.appendChild(dueCell);

    const statusCell = document.createElement('td');
    const status = metaFor(action.status, STATUS_META);
    statusCell.appendChild(badge(status.label, status.className));
    if(action.closure_status){
      const closureLabel = document.createElement('span');
      closureLabel.className = 'nc-muted-meta';
      closureLabel.textContent = 'Cierre';
      statusCell.append(closureLabel, closureBadge(action.closure_status));
    }
    tr.appendChild(statusCell);

    const progressCell = document.createElement('td');
    progressCell.appendChild(progressBar(progressOf(action)));
    tr.appendChild(progressCell);

    const actions = document.createElement('td');
    actions.className = 'table-actions';
    actions.appendChild(actionButton('Ver detalle', 'secondary', { capmDetail: action.id }));
    const edit = actionButton('Editar', 'secondary', { capmEdit: action.id });
    edit.dataset.permission = 'edit_capa';
    actions.appendChild(edit);
    if(action.status === 'in_progress' || action.closure_status === 'rejected'){
      actions.appendChild(workflowButton('Completar', { capmComplete: action.id }, 'complete_capa', false));
    }
    if(action.status === 'completed' && action.closure_status !== 'approved' && action.closure_status !== 'pending'){
      actions.appendChild(workflowButton('Solicitar cierre', { capmRequestClosure: action.id }, 'request_capa_closure', false));
    }
    const remove = actionButton('Eliminar', 'danger', { capmDelete: action.id });
    remove.dataset.permission = 'delete_records';
    actions.appendChild(remove);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.appendChild(table);
  host.appendChild(wrapper);
  applyCapaPermissions(host);
}

function renderHistory(action){
  const list = document.createElement('ul');
  list.className = 'capa-timeline';
  const entries = loadCollection('quality_audit_log')
    .filter(entry => entry.entity_type === 'corrective_action'
      && (entry.entity_id === action.corrective_action_id || entry.entity_id === action.id))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  if(!entries.length){
    const empty = document.createElement('div');
    empty.className = 'capa-detail-empty';
    empty.textContent = 'Aún no hay cambios registrados para esta acción.';
    return empty;
  }
  entries.forEach(entry => {
    const li = document.createElement('li');
    const heading = document.createElement('strong');
    const actionLabel = AUDIT_ACTION_LABELS[entry.action] || entry.action;
    const fieldLabel = AUDIT_FIELD_LABELS[entry.changed_field] || entry.changed_field;
    heading.textContent = fieldLabel ? `${actionLabel} · ${fieldLabel}` : actionLabel;
    const detail = document.createElement('span');
    detail.textContent = `${formatAuditValue(entry.before_value)} → ${formatAuditValue(entry.after_value)}`;
    const meta = document.createElement('time');
    meta.textContent = `${String(entry.timestamp || '').slice(0, 16).replace('T', ' ')} · ${entry.actor || 'sistema'}`;
    li.append(heading, detail, meta);
    if(entry.justification){
      const justification = document.createElement('span');
      justification.textContent = `Justificación: ${entry.justification}`;
      li.appendChild(justification);
    }
    list.appendChild(li);
  });
  return list;
}

function renderDetailActions(action){
  const wrapper = document.createElement('div');
  wrapper.className = 'capa-detail-actions';
  const role = activeRole();
  const context = capaContext(action);
  const title = document.createElement('h3');
  title.textContent = 'Actualizar avance';
  const value = progressOf(action);
  const control = document.createElement('div');
  control.className = 'capa-progress-editor';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.value = String(value);
  slider.id = 'capm-progress-input';
  slider.setAttribute('aria-label', 'Porcentaje de avance');
  const output = document.createElement('strong');
  output.id = 'capm-progress-output';
  output.textContent = `${value}%`;
  const save = actionButton('Guardar avance', 'secondary', { capmProgressSave: action.id });
  save.dataset.permission = 'edit_capa';
  control.append(slider, output, save);

  const observationsTitle = document.createElement('h3');
  observationsTitle.textContent = 'Observaciones';
  const observations = document.createElement('textarea');
  observations.id = 'capm-observations-input';
  observations.rows = 3;
  observations.value = action.observations || '';
  observations.placeholder = 'Registra notas sobre la ejecución de la acción';
  const saveObservations = actionButton('Guardar observaciones', 'secondary', { capmObservationsSave: action.id });
  saveObservations.dataset.permission = 'edit_capa';

  const closure = document.createElement('div');
  closure.className = 'capa-closure-workflow';
  const closureTitle = document.createElement('h3');
  closureTitle.textContent = 'Cierre y eficacia';
  closure.appendChild(closureTitle);
  const closureState = document.createElement('div');
  closureState.className = 'capa-closure-state';
  if(action.closure_status){
    closureState.append(closureBadge(action.closure_status));
  }else{
    closureState.appendChild(badge('Cierre no solicitado', 'capa-status-pending'));
  }
  closure.appendChild(closureState);

  if(action.status === 'completed' && (!action.closure_status || action.closure_status === 'rejected')){
    closure.appendChild(workflowButton('Solicitar cierre', { capmRequestClosure: action.id }, 'request_capa_closure', false));
  }
  if(action.closure_status === 'pending'){
    if(can(role, 'register_effectiveness', context)){
      const effectiveness = document.createElement('select');
      effectiveness.id = 'capm-effectiveness';
      effectiveness.setAttribute('aria-label', 'Resultado de eficacia');
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '-- Selecciona eficacia --';
      effectiveness.appendChild(blank);
      EFFECTIVENESS_RESULTS.forEach(result => {
        const option = document.createElement('option');
        option.value = result;
        option.textContent = EFFECTIVENESS_LABELS[result];
        effectiveness.appendChild(option);
      });
      effectiveness.value = action.effectiveness_result || '';
      const effectivenessNotes = document.createElement('textarea');
      effectivenessNotes.id = 'capm-effectiveness-observations';
      effectivenessNotes.rows = 2;
      effectivenessNotes.placeholder = 'Observaciones de la revisión de eficacia';
      effectivenessNotes.value = action.effectiveness_observations || '';
      const saveEffectiveness = actionButton('Registrar eficacia', 'secondary', { capmEffectivenessSave: action.id });
      saveEffectiveness.dataset.permission = 'register_effectiveness';
      closure.append(effectiveness, effectivenessNotes, saveEffectiveness);
    }
    if(can(role, 'review_capa_closure', context)){
      const justification = document.createElement('input');
      justification.type = 'text';
      justification.id = 'capm-closure-justification';
      justification.placeholder = 'Justificación de la decisión de cierre';
      justification.setAttribute('aria-label', 'Justificación de la decisión de cierre');
      const approve = actionButton('Aprobar cierre', 'secondary', { capmClosureApprove: action.id });
      approve.dataset.permission = 'review_capa_closure';
      const reject = actionButton('Rechazar cierre', 'danger', { capmClosureReject: action.id });
      reject.dataset.permission = 'review_capa_closure';
      closure.append(justification, approve, reject);
    }
    permissionNotice(closure, 'review_capa_closure', context);
  }
  if(action.closure_status === 'approved' || action.closure_status === 'rejected'){
    const summary = document.createElement('div');
    summary.className = 'capa-closure-summary';
    summary.textContent = [
      action.effectiveness_result ? `Eficacia: ${EFFECTIVENESS_LABELS[action.effectiveness_result] || action.effectiveness_result}` : '',
      action.closure_justification ? `Justificación: ${action.closure_justification}` : ''
    ].filter(Boolean).join(' · ') || 'Sin observaciones de cierre.';
    closure.appendChild(summary);
  }

  const detailActions = document.createElement('div');
  detailActions.className = 'capa-detail-actions';
  const complete = workflowButton('Marcar completada', { capmComplete: action.id }, 'complete_capa', !['pending', 'in_progress'].includes(action.status));
  const edit = actionButton('Editar acción', 'secondary', { capmEdit: action.id });
  edit.dataset.permission = 'edit_capa';
  const remove = actionButton('Eliminar acción', 'danger', { capmDelete: action.id });
  remove.dataset.permission = 'delete_records';
  detailActions.append(complete, edit, remove, actionButton('Volver al listado', 'secondary', { capmBack: true }));

  const error = document.createElement('div');
  error.className = 'error';
  error.id = 'capm-detail-error';
  error.setAttribute('aria-live', 'polite');
  wrapper.append(title, control, observationsTitle, observations, saveObservations, closure, detailActions, error);
  return wrapper;
}

function showCapaDetail(id){
  const action = loadCollection('corrective_actions').find(item => item.id === id || item.corrective_action_id === id);
  if(!action) return;
  currentDetailId = action.id;
  const maps = buildReferenceMaps();
  const ncs = new Map(loadCollection('non_conformances').map(nc => [nc.non_conformance_id, nc]));
  const card = qs('capm-detail-card');
  const body = qs('capm-detail-body');
  const heading = qs('capm-detail-heading');
  if(card) card.hidden = false;
  const listCard = qs('capm-list') && qs('capm-list').closest('.card');
  if(listCard) listCard.hidden = true;
  if(heading) heading.textContent = `${action.corrective_action_id} · ${action.action_description.slice(0, 48)}`;
  if(!body) return;

  body.replaceChildren();
  const layout = document.createElement('div');
  layout.className = 'capa-detail-layout';

  const main = document.createElement('div');
  main.className = 'capa-detail-block';
  const badges = document.createElement('div');
  badges.className = 'capa-detail-badges';
  const category = categoryMeta(action.action_category);
  const status = metaFor(action.status, STATUS_META);
  const due = dueMeta(action);
  badges.append(
    badge(`Tipo: ${category.label}`, category.className),
    badge(`Estado: ${status.label}`, status.className),
    badge(`Vencimiento: ${due.label}`, due.className)
  );
  if(action.closure_status) badges.appendChild(closureBadge(action.closure_status));
  main.appendChild(badges);

  const progress = document.createElement('div');
  progress.className = 'capa-detail-progress';
  const progressLabel = document.createElement('span');
  progressLabel.textContent = 'Avance de la acción';
  progress.append(progressLabel, progressBar(progressOf(action)));
  main.appendChild(progress);

  const grid = document.createElement('div');
  grid.className = 'capa-detail-grid';
  const nc = ncs.get(action.non_conformance_id);
  const items = [
    ['Código', action.corrective_action_id],
    ['No conformidad relacionada', nc ? `${nc.non_conformance_id} · ${nc.description.slice(0, 42)}` : (action.non_conformance_id || '—')],
    ['Responsable', employeeName(maps, action.responsible_employee_id)],
    ['Modalidad', TYPE_LABELS[action.action_type] || action.action_type],
    ['Fecha de inicio', action.start_date || '—'],
    ['Fecha límite', action.due_date || '—'],
    ['Causa raíz', action.root_cause],
    ['Resultado esperado', action.expected_result || 'Sin resultado esperado registrado']
  ];
  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'capa-detail-item';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = value || '—';
    item.append(labelEl, valueEl);
    grid.appendChild(item);
  });
  main.appendChild(grid);
  main.appendChild(renderDetailActions(action));

  const detailActions = document.createElement('div');
  detailActions.className = 'capa-detail-actions';
  detailActions.append(
    actionButton('Editar acción', 'secondary', { capmEdit: action.id }),
    actionButton('Eliminar acción', 'danger', { capmDelete: action.id }),
    actionButton('Volver al listado', 'secondary', { capmBack: true })
  );
  main.appendChild(detailActions);

  const side = document.createElement('div');
  const history = document.createElement('div');
  history.className = 'capa-detail-block';
  const historyHeading = document.createElement('h3');
  historyHeading.textContent = 'Historial de cambios';
  history.append(historyHeading, renderHistory(action));
  side.appendChild(history);

  const evidence = document.createElement('div');
  evidence.className = 'capa-detail-block';
  const evidenceHeading = document.createElement('h3');
  evidenceHeading.textContent = 'Evidencias';
  evidence.appendChild(evidenceHeading);
  const evidenceHost = document.createElement('div');
  evidenceHost.id = 'capm-detail-evidence';
  evidence.appendChild(evidenceHost);
  side.appendChild(evidence);

  layout.append(main, side);
  body.appendChild(layout);
  renderEvidenceList(
    evidenceHost,
    evidenceFor('corrective_action', action.corrective_action_id),
    maps,
    { emptyMessage: 'Sin evidencia adjunta para esta acción.' }
  );
  permissionNotice(main, 'edit_capa', capaContext(action));
  applyCapaPermissions(body);
}

function collectPayload(){
  return {
    action_category: qs('capm-category').value,
    action_description: qs('capm-description').value,
    non_conformance_id: qs('capm-nc').value,
    responsible_employee_id: qs('capm-responsible').value,
    root_cause: qs('capm-root').value,
    action_type: qs('capm-type').value,
    start_date: qs('capm-start-date').value,
    due_date: qs('capm-due-date').value,
    expected_result: qs('capm-expected-result').value,
    status: qs('capm-status').value
  };
}

async function handleSubmit(event){
  event.preventDefault();
  const error = qs('capm-error');
  error.textContent = '';
  const id = qs('capm-id').value;
  const payload = collectPayload();
  const check = validateCorrectiveAction(payload);
  showCapaManagerErrors(check.errors);
  if(!check.valid) return;

  try{
    const action = id
      ? updateCorrectiveAction(id, payload)
      : addCorrectiveAction(payload);
    const files = Array.from(qs('capm-files').files || []);
    for(const file of files){
      await addEvidenceFromFile({
        entityType: 'corrective_action',
        entityId: action.corrective_action_id,
        file,
        uploadedBy: action.responsible_employee_id
      });
    }
    hideCapaForm();
    renderCapaManager();
    showCapaDetail(action.id);
  }catch(err){
    error.textContent = err.message;
  }
}

function handleEvidenceClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const error = qs('capm-detail-error');
  if(button.dataset.evidenceDownload){
    const record = loadCollection('quality_evidence').find(item => item.id === button.dataset.evidenceDownload);
    if(record){
      try{
        downloadEvidence(record);
      }catch(err){
        if(error) error.textContent = err.message;
      }
    }
    return;
  }
  if(button.dataset.evidenceDelete){
    if(!confirm('¿Eliminar esta evidencia?')) return;
    try{
      deleteEvidence(button.dataset.evidenceDelete);
      if(currentDetailId) showCapaDetail(currentDetailId);
    }catch(err){
      if(error) error.textContent = err.message;
    }
  }
}

function handleListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const actions = loadCollection('corrective_actions');
  if(button.dataset.capmDetail){
    showCapaDetail(button.dataset.capmDetail);
    return;
  }
  if(button.dataset.capmComplete){
    const action = actions.find(a => a.id === button.dataset.capmComplete);
    if(action) completeAction(action);
    return;
  }
  if(button.dataset.capmRequestClosure){
    const action = actions.find(a => a.id === button.dataset.capmRequestClosure);
    if(action) requestClosure(action);
    return;
  }
  if(button.dataset.capmEdit){
    const action = actions.find(a => a.id === button.dataset.capmEdit);
    if(action) openCapaForm(action);
    return;
  }
  if(button.dataset.capmDelete){
    if(!confirm('¿Eliminar esta acción correctiva/preventiva?')) return;
    try{
      deleteCorrectiveAction(button.dataset.capmDelete);
      hideCapaDetail();
      hideCapaForm();
      renderCapaManager();
    }catch(err){
      const error = qs('capm-error');
      if(error) error.textContent = err.message;
    }
  }
}

function handleDetailClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.evidenceDownload || button.dataset.evidenceDelete){
    handleEvidenceClick(event);
    return;
  }
  const actions = loadCollection('corrective_actions');
  if(button.dataset.capmComplete){
    const action = actions.find(a => a.id === button.dataset.capmComplete);
    if(action) completeAction(action);
    return;
  }
  if(button.dataset.capmRequestClosure){
    const action = actions.find(a => a.id === button.dataset.capmRequestClosure);
    if(action) requestClosure(action);
    return;
  }
  if(button.dataset.capmEffectivenessSave){
    const action = actions.find(a => a.id === button.dataset.capmEffectivenessSave);
    if(action) saveEffectiveness(action);
    return;
  }
  if(button.dataset.capmClosureApprove || button.dataset.capmClosureReject){
    const id = button.dataset.capmClosureApprove || button.dataset.capmClosureReject;
    const action = actions.find(a => a.id === id);
    if(action) reviewClosure(action, button.dataset.capmClosureApprove ? 'approved' : 'rejected');
    return;
  }
  if(button.dataset.capmEdit){
    const action = actions.find(a => a.id === button.dataset.capmEdit);
    if(action) openCapaForm(action);
    return;
  }
  if(button.dataset.capmDelete){
    if(!confirm('¿Eliminar esta acción correctiva/preventiva?')) return;
    try{
      deleteCorrectiveAction(button.dataset.capmDelete);
      hideCapaDetail();
      renderCapaManager();
    }catch(err){
      const error = qs('capm-detail-error');
      if(error) error.textContent = err.message;
    }
    return;
  }
  if(button.dataset.capmProgressSave){
    const action = actions.find(a => a.id === button.dataset.capmProgressSave);
    const value = qs('capm-progress-input').value;
    if(!action) return;
    try{
      updateCorrectiveAction(action.id, { progress: Number(value) });
      renderCapaManager();
      showCapaDetail(action.id);
    }catch(err){
      const error = qs('capm-detail-error');
      if(error) error.textContent = err.message;
    }
    return;
  }
  if(button.dataset.capmObservationsSave){
    const action = actions.find(a => a.id === button.dataset.capmObservationsSave);
    if(!action) return;
    try{
      updateCorrectiveAction(action.id, { observations: qs('capm-observations-input').value });
      renderCapaManager();
      showCapaDetail(action.id);
    }catch(err){
      const error = qs('capm-detail-error');
      if(error) error.textContent = err.message;
    }
    return;
  }
  hideCapaDetail();
}

export function renderCapaManager(){
  populateSelect(
    qs('capm-category'),
    qualityCatalog('action_types'),
    'key',
    item => item.label,
    '-- Selecciona un tipo --'
  );
  const categoryFilter = qs('capm-category-filter');
  if(categoryFilter){
    const previous = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">Todos los tipos</option>';
    qualityCatalog('action_types').forEach(item => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      categoryFilter.appendChild(option);
    });
    if([...categoryFilter.options].some(option => option.value === previous)) categoryFilter.value = previous;
  }
  populateSelect(
    qs('capm-nc'),
    loadCollection('non_conformances'),
    'non_conformance_id',
    nc => `${nc.non_conformance_id} · ${nc.description.slice(0, 46)}`,
    '-- Sin no conformidad --'
  );
  populateSelect(
    qs('capm-responsible'),
    loadExternal('employees'),
    'employee_id',
    employee => employee.name,
    '-- Selecciona un responsable --'
  );
  renderList();
  if(currentDetailId) showCapaDetail(currentDetailId);
  applyCapaPermissions(qs('view-corrective-actions') || document);
}

export function initCapaManager(){
  const form = qs('capm-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
  form.addEventListener('submit', handleSubmit);
  const create = qs('capm-create');
  if(create) create.dataset.permission = 'propose_capa';
  create.addEventListener('click', () => openCapaForm());
  qs('capm-cancel').addEventListener('click', hideCapaForm);
  qs('capm-form-back').addEventListener('click', hideCapaForm);
  qs('capm-detail-back').addEventListener('click', hideCapaDetail);
  qs('capm-list').addEventListener('click', handleListClick);
  qs('capm-detail-body').addEventListener('click', handleDetailClick);
  qs('capm-detail-body').addEventListener('input', event => {
    if(event.target && event.target.id === 'capm-progress-input'){
      const output = qs('capm-progress-output');
      if(output) output.textContent = `${event.target.value}%`;
    }
  });
  ['capm-search', 'capm-category-filter', 'capm-status-filter', 'capm-due-filter'].forEach(id => {
    const control = qs(id);
    if(!control) return;
    control.addEventListener('input', renderList);
    control.addEventListener('change', renderList);
  });
}
