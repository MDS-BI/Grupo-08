import * as storage from '../storage.js';
import {
  loadCollection,
  loadExternal,
  validateNonConformance,
  addNonConformance,
  updateNonConformance,
  deleteNonConformance,
  addCorrectiveAction,
  updateCorrectiveAction,
  deleteCorrectiveAction,
  validateCorrectiveAction,
  deriveQuarantineLots,
  isCapaOverdue,
  overrideInspection,
  evidenceFor,
  deleteEvidence,
  qualityCatalog,
  qualityCatalogLabels,
  qualityParameter
} from '../storage.js';
import {
  buildReferenceMaps,
  productName,
  employeeName,
  moduleLabel,
  resultLabel,
  todayIso,
  qs,
  cell,
  actionButton,
  emptyState
} from './quality-utils.js';
import { addEvidenceFromFile, downloadEvidence, renderEvidenceList } from './evidence.js';
import { can, assertCan, applyPermissionState } from '../permissions.js';
import { CAPA_CLOSURE_STATUSES, EFFECTIVENESS_RESULTS, isReviewableInspection } from '../quality-status.js';
import { renderStatusBadge, statusLabel } from './status-badge.js';
import { renderPermissionNotice } from './permission-notice.js';

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

const NC_SEVERITY = {
  critical: { label: 'Alta', className: 'nc-severity-high', rank: 0 },
  major: { label: 'Media', className: 'nc-severity-medium', rank: 1 },
  minor: { label: 'Baja', className: 'nc-severity-low', rank: 2 }
};

const NC_STATUS = {
  open: { label: 'Abierta', className: 'nc-status-open', rank: 0 },
  under_review: { label: 'En revisión', className: 'nc-status-review', rank: 1 },
  closed: { label: 'Solucionada', className: 'nc-status-closed', rank: 2 }
};

const NC_CATEGORY = {
  dimensional: 'Dimensional',
  functional: 'Funcional',
  packaging: 'Empaque',
  other: 'Otro'
};

const AUDIT_FIELD_LABELS = {
  description: 'Descripción',
  defect_type: 'Categoría',
  severity: 'Gravedad',
  status: 'Estado',
  detected_date: 'Fecha de detección',
  responsible_employee_id: 'Responsable',
  observations: 'Observaciones'
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

function applyNcPermissions(root){
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

function setCapaWorkflowError(message){
  const error = qs('capa-error');
  if(error) error.textContent = message || '';
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

function fillCatalogSelect(id, items, blankLabel){
  const select = qs(id);
  if(!select) return;
  const previous = select.value;
  select.innerHTML = '';
  if(blankLabel){
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = blankLabel;
    select.appendChild(blank);
  }
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = item.label;
    select.appendChild(option);
  });
  const target = previous && [...select.options].some(option => option.value === previous)
    ? previous
    : !blankLabel && items.length ? items[0].key : '';
  select.value = target;
}

function severityMeta(value){
  const fallback = NC_SEVERITY[value] || { label: value || '—', className: '', rank: 99 };
  return { ...fallback, label: qualityCatalogLabels('severity_levels')[value] || fallback.label };
}

function ncStatusMeta(value){
  const fallback = NC_STATUS[value] || { label: value || '—', className: '', rank: 99 };
  return { ...fallback, label: qualityCatalogLabels('nc_statuses')[value] || fallback.label };
}

function ncDate(nc){
  return nc.detected_date || String(nc.createdAt || '').slice(0, 10) || '—';
}

function formatAuditValue(value){
  if(value === undefined || value === null || value === '') return '—';
  if(value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function badge(text, className){
  const span = document.createElement('span');
  span.className = `nc-badge ${className}`;
  span.textContent = text;
  return span;
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
  const description = qs('nc-description');
  const inspection = qs('nc-inspection');
  const defect = qs('nc-defect');
  const severity = qs('nc-severity');
  const status = qs('nc-status');
  const detectedDate = qs('nc-detected-date');
  const responsible = qs('nc-responsible');
  const files = qs('nc-files');
  const observations = qs('nc-observations');
  const error = qs('nc-error');
  if(description) description.value = '';
  if(inspection) inspection.value = '';
  if(defect) defect.value = 'other';
  if(severity) severity.value = qualityParameter('default_nc_severity');
  if(status) status.value = qualityParameter('default_nc_status');
  if(detectedDate) detectedDate.value = todayIso();
  if(responsible) responsible.value = '';
  if(files) files.value = '';
  if(observations) observations.value = '';
  if(qs('nc-id')) qs('nc-id').value = '';
  if(qs('nc-form-heading')) qs('nc-form-heading').textContent = 'Registrar no conformidad';
  if(qs('nc-cancel')) qs('nc-cancel').hidden = false;
  showNcErrors({});
  if(error) error.textContent = '';
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

function collectNcPayload(){
  return {
    description: qs('nc-description').value,
    inspection_id: qs('nc-inspection').value,
    defect_type: qs('nc-defect').value,
    severity: qs('nc-severity').value,
    status: qs('nc-status').value,
    detected_date: qs('nc-detected-date').value,
    responsible_employee_id: qs('nc-responsible').value,
    observations: qs('nc-observations').value
  };
}

function hideNcForm(){
  const card = qs('nc-form-card');
  if(card) card.hidden = true;
  clearNcForm();
}

function openNcForm(nc){
  hideNcDetail();
  clearNcForm();
  const card = qs('nc-form-card');
  if(card){
    card.hidden = false;
    if(card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if(nc){
    qs('nc-id').value = nc.id;
    qs('nc-description').value = nc.description;
    qs('nc-inspection').value = nc.inspection_id || '';
    qs('nc-defect').value = nc.defect_type;
    qs('nc-severity').value = nc.severity;
    qs('nc-status').value = nc.status;
    qs('nc-detected-date').value = nc.detected_date || String(nc.createdAt || '').slice(0, 10);
    qs('nc-responsible').value = nc.responsible_employee_id || '';
    qs('nc-observations').value = nc.observations || '';
    qs('nc-form-heading').textContent = `Editar no conformidad · ${nc.non_conformance_id}`;
  }
  qs('nc-description').focus();
}

function hideNcDetail(){
  const card = qs('nc-detail-card');
  if(card) card.hidden = true;
  const listCard = qs('nc-list') && qs('nc-list').closest('.card');
  if(listCard) listCard.hidden = false;
  currentDetailId = '';
}

function renderNcSummary(list){
  const container = qs('nc-summary');
  if(!container) return;
  const values = [
    { key: 'total', label: 'Total de no conformidades', value: list.length, hint: 'Registros acumulados' },
    { key: 'open', label: 'Abiertas', value: list.filter(nc => nc.status === 'open').length, hint: 'Requieren atención inmediata' },
    { key: 'review', label: 'En revisión', value: list.filter(nc => nc.status === 'under_review').length, hint: 'En análisis o CAPA' },
    { key: 'closed', label: 'Solucionadas', value: list.filter(nc => nc.status === 'closed').length, hint: 'Cerradas y verificadas' }
  ];
  container.replaceChildren(...values.map(item => {
    const card = document.createElement('article');
    card.className = `nc-stat ${item.key}`;
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

function filteredNcs(){
  const search = (qs('nc-search').value || '').trim().toLowerCase();
  const severity = qs('nc-severity-filter').value;
  const status = qs('nc-status-filter').value;
  const date = qs('nc-date-filter').value;
  return loadCollection('non_conformances')
    .filter(nc => {
      if(search && !`${nc.non_conformance_id} ${nc.description}`.toLowerCase().includes(search)) return false;
      if(severity && nc.severity !== severity) return false;
      if(status && nc.status !== status) return false;
      if(date && ncDate(nc) !== date) return false;
      return true;
    })
    .sort((a, b) => {
      const severityDiff = severityMeta(a.severity).rank - severityMeta(b.severity).rank;
      if(severityDiff) return severityDiff;
      const statusDiff = ncStatusMeta(a.status).rank - ncStatusMeta(b.status).rank;
      if(statusDiff) return statusDiff;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
}

function renderNcList(){
  const host = qs('nc-list');
  const empty = qs('nc-empty');
  if(!host) return;
  const all = loadCollection('non_conformances');
  const list = filteredNcs();
  renderNcSummary(all);
  const count = qs('nc-result-count');
  if(count) count.textContent = `Mostrando ${list.length} de ${all.length} registros`;
  host.replaceChildren();
  if(empty) empty.hidden = list.length > 0;
  if(!list.length) return;

  const maps = buildReferenceMaps();
  const table = document.createElement('table');
  table.className = 'data-table nc-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Código', 'Descripción del problema', 'Inspección relacionada', 'Categoría', 'Nivel de gravedad', 'Responsable', 'Fecha de detección', 'Estado', 'Acciones'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tbody.id = 'nc-rows';
  list.forEach(nc => {
    const tr = document.createElement('tr');

    const code = document.createElement('td');
    code.className = 'nc-code';
    code.textContent = nc.non_conformance_id;
    tr.appendChild(code);

    const description = document.createElement('td');
    description.className = 'nc-description-cell';
    const title = document.createElement('strong');
    title.textContent = nc.description;
    const meta = document.createElement('span');
    meta.className = 'nc-muted-meta';
    meta.textContent = `${productName(maps, nc.product_id)} · ${moduleLabel(nc.reference_module)} ${nc.reference_id || ''}`.trim();
    description.append(title, meta);
    tr.appendChild(description);

    const inspection = document.createElement('td');
    inspection.textContent = nc.inspection_id || '—';
    tr.appendChild(inspection);

    const category = document.createElement('td');
    category.textContent = `${NC_CATEGORY[nc.defect_type] || nc.defect_type || '—'} · ${nc.defect_type || '—'}`;
    tr.appendChild(category);

    const severityCell = document.createElement('td');
    const severity = severityMeta(nc.severity);
    severityCell.appendChild(badge(severity.label, severity.className));
    tr.appendChild(severityCell);

    tr.appendChild(cell(employeeName(maps, nc.responsible_employee_id)));
    tr.appendChild(cell(ncDate(nc)));

    const statusCell = document.createElement('td');
    const status = ncStatusMeta(nc.status);
    statusCell.appendChild(badge(status.label, status.className));
    tr.appendChild(statusCell);

    const actions = document.createElement('td');
    actions.className = 'table-actions';
    actions.appendChild(actionButton('Ver detalle', 'secondary', { ncDetail: nc.id }));
    const edit = actionButton('Editar', 'secondary', { ncEdit: nc.id });
    edit.dataset.permission = 'edit_nc';
    actions.appendChild(edit);
    const remove = actionButton('Eliminar', 'danger', { ncDelete: nc.id });
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
  applyNcPermissions(host);
}

function renderNcHistory(nc){
  const list = document.createElement('ul');
  list.className = 'nc-timeline';
  const entries = loadCollection('quality_audit_log')
    .filter(entry => entry.entity_type === 'non_conformance'
      && (entry.entity_id === nc.non_conformance_id || entry.entity_id === nc.id))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

  if(!entries.length){
    const empty = document.createElement('div');
    empty.className = 'nc-detail-empty';
    empty.textContent = 'Aún no hay eventos de seguimiento registrados.';
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

function showNcDetail(id){
  const nc = loadCollection('non_conformances').find(item => item.id === id || item.non_conformance_id === id);
  if(!nc) return;
  currentDetailId = nc.id;
  const maps = buildReferenceMaps();
  const card = qs('nc-detail-card');
  const body = qs('nc-detail-body');
  const heading = qs('nc-detail-heading');
  if(card) card.hidden = false;
  const listCard = qs('nc-list') && qs('nc-list').closest('.card');
  if(listCard) listCard.hidden = true;
  if(heading) heading.textContent = `${nc.non_conformance_id} · ${nc.description.slice(0, 48)}`;
  if(!body) return;

  body.replaceChildren();
  const layout = document.createElement('div');
  layout.className = 'nc-detail-layout';

  const main = document.createElement('div');
  main.className = 'nc-detail-block';
  const badges = document.createElement('div');
  badges.className = 'nc-detail-badges';
  const severity = severityMeta(nc.severity);
  const status = ncStatusMeta(nc.status);
  badges.append(
    badge(`Gravedad: ${severity.label}`, severity.className),
    badge(`Estado: ${status.label}`, status.className),
    badge(`Categoría: ${NC_CATEGORY[nc.defect_type] || nc.defect_type || '—'}`, '')
  );
  main.appendChild(badges);

  const grid = document.createElement('div');
  grid.className = 'nc-detail-grid';
  const items = [
    ['Código', nc.non_conformance_id],
    ['Inspección relacionada', nc.inspection_id || '—'],
    ['Producto', productName(maps, nc.product_id)],
    ['Origen', `${moduleLabel(nc.reference_module)} ${nc.reference_id || ''}`.trim()],
    ['Responsable', employeeName(maps, nc.responsible_employee_id)],
    ['Fecha de detección', ncDate(nc)],
    ['Registrada', String(nc.createdAt || '').slice(0, 16).replace('T', ' ')],
    ['Última actualización', String(nc.updatedAt || '').slice(0, 16).replace('T', ' ')]
  ];
  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'nc-detail-item';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = value || '—';
    item.append(labelEl, valueEl);
    grid.appendChild(item);
  });
  const descriptionItem = document.createElement('div');
  descriptionItem.className = 'nc-detail-item full';
  const descriptionLabel = document.createElement('span');
  descriptionLabel.textContent = 'Descripción del problema';
  const descriptionValue = document.createElement('strong');
  descriptionValue.textContent = nc.description;
  descriptionItem.append(descriptionLabel, descriptionValue);
  grid.appendChild(descriptionItem);
  const observations = document.createElement('div');
  observations.className = 'nc-detail-item full';
  const observationsLabel = document.createElement('span');
  observationsLabel.textContent = 'Observaciones';
  const observationsValue = document.createElement('strong');
  observationsValue.textContent = nc.observations || 'Sin observaciones adicionales.';
  observations.append(observationsLabel, observationsValue);
  grid.appendChild(observations);
  main.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'nc-detail-actions';
  const edit = actionButton('Editar', 'secondary', { ncEdit: nc.id });
  edit.dataset.permission = 'edit_nc';
  const manageCapa = actionButton('Gestionar CAPA', 'secondary', { ncCapa: nc.non_conformance_id });
  manageCapa.dataset.permission = 'propose_capa';
  actions.append(edit, manageCapa, actionButton('Volver al listado', 'secondary', { ncBack: true }));
  main.appendChild(actions);

  const side = document.createElement('div');
  const history = document.createElement('div');
  history.className = 'nc-detail-block';
  const historyHeading = document.createElement('h3');
  historyHeading.textContent = 'Historial de seguimiento';
  history.append(historyHeading, renderNcHistory(nc));
  side.appendChild(history);

  const capa = document.createElement('div');
  capa.className = 'nc-detail-block';
  const capaHeading = document.createElement('h3');
  capaHeading.textContent = 'Acciones correctivas';
  capa.appendChild(capaHeading);
  const related = loadCollection('corrective_actions').filter(action => action.non_conformance_id === nc.non_conformance_id);
  if(related.length){
    const capaList = document.createElement('ul');
    capaList.className = 'nc-timeline';
    related.forEach(action => {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = action.action_description;
      const meta = document.createElement('span');
      meta.textContent = `${employeeName(maps, action.responsible_employee_id)} · Vence ${action.due_date} · ${action.status}${isCapaOverdue(action) ? ' · Vencida' : ''}`;
      li.append(title, meta);
      if(action.closure_status) li.appendChild(closureBadge(action.closure_status));
      capaList.appendChild(li);
    });
    capa.appendChild(capaList);
  }else{
    const empty = document.createElement('div');
    empty.className = 'nc-detail-empty';
    empty.textContent = 'Sin acciones correctivas asociadas.';
    capa.appendChild(empty);
  }
  side.appendChild(capa);

  const evidence = document.createElement('div');
  evidence.className = 'nc-detail-block';
  const evidenceHeading = document.createElement('h3');
  evidenceHeading.textContent = 'Evidencias';
  evidence.appendChild(evidenceHeading);
  const evidenceHost = document.createElement('div');
  evidenceHost.id = 'nc-detail-evidence';
  evidence.appendChild(evidenceHost);
  side.appendChild(evidence);

  layout.append(main, side);
  body.appendChild(layout);
  permissionNotice(main, 'edit_nc', { status: nc.status });
  applyNcPermissions(body);
  renderEvidenceList(
    evidenceHost,
    evidenceFor('non_conformance', nc.non_conformance_id),
    maps,
    { emptyMessage: 'Sin evidencia adjunta para esta no conformidad.' }
  );
}

function renderReview(){
  const tbody = qs('review-body');
  const empty = qs('review-empty');
  if(!tbody) return;
  tbody.innerHTML = '';
  const inspections = loadCollection('quality_inspections').filter(isReviewableInspection);
  const maps = buildReferenceMaps();

  inspections.forEach(inspection => {
    const tr = document.createElement('tr');
    tr.appendChild(cell(inspection.inspection_id));
    tr.appendChild(cell(`${moduleLabel(inspection.reference_module)} ${inspection.reference_id}`));
    const plan = maps.plans.get(inspection.inspection_plan_id);
    tr.appendChild(cell(plan ? productName(maps, plan.product_id) : '—'));
    tr.appendChild(cell(inspection.inspection_date));

    const result = document.createElement('td');
    const proposed = inspection.proposed_result || inspection.proposedResult;
    const finalResult = inspection.overall_result || inspection.overallResult || proposed;
    const badgeEl = finalResult === 'conditional'
      ? document.createElement('span')
      : renderStatusBadge('pending_review');
    if(finalResult === 'conditional') badgeEl.className = 'status-badge badge-conditional';
    badgeEl.textContent = resultLabel(finalResult);
    result.appendChild(badgeEl);
    tr.appendChild(result);

    tbody.appendChild(tr);
  });

  if(empty) empty.hidden = inspections.length > 0;
}

function renderOverrideSelect(){
  const select = qs('override-inspection');
  if(!select) return;
  const inspections = loadCollection('quality_inspections').filter(i => i.inspection_status === 'completed');
  populateSelect(
    select,
    inspections,
    'inspection_id',
    inspection => `${moduleLabel(inspection.reference_module)} ${inspection.reference_id} · ${resultLabel(inspection.overall_result)}`,
    inspections.length ? '-- Selecciona una inspección --' : '-- No hay inspecciones completadas --'
  );
}

function capaClosureControls(action){
  const controls = document.createElement('div');
  controls.className = 'capa-closure-controls';
  const role = activeRole();
  const context = capaContext(action);

  if(action.status === 'completed' && (!action.closure_status || action.closure_status === 'rejected')){
    controls.appendChild(workflowButton('Solicitar cierre', { ncCapaRequestClosure: action.id }, 'request_capa_closure', false));
  }
  if(action.closure_status === 'pending'){
    if(can(role, 'register_effectiveness', context)){
      const effectiveness = document.createElement('select');
      effectiveness.dataset.capaEffectiveness = 'true';
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
      const notes = document.createElement('textarea');
      notes.dataset.capaEffectivenessNotes = 'true';
      notes.rows = 2;
      notes.placeholder = 'Observaciones de eficacia';
      notes.value = action.effectiveness_observations || '';
      const save = actionButton('Registrar eficacia', 'secondary', { ncCapaEffectivenessSave: action.id });
      save.dataset.permission = 'register_effectiveness';
      controls.append(effectiveness, notes, save);
    }
    if(can(role, 'review_capa_closure', context)){
      const justification = document.createElement('input');
      justification.type = 'text';
      justification.dataset.capaClosureJustification = 'true';
      justification.placeholder = 'Justificación de cierre';
      justification.setAttribute('aria-label', 'Justificación de cierre');
      const approve = actionButton('Aprobar cierre', 'secondary', { ncCapaClosureApprove: action.id });
      approve.dataset.permission = 'review_capa_closure';
      const reject = actionButton('Rechazar cierre', 'danger', { ncCapaClosureReject: action.id });
      reject.dataset.permission = 'review_capa_closure';
      controls.append(justification, approve, reject);
    }
    permissionNotice(controls, 'review_capa_closure', context);
  }
  if(action.closure_status === 'approved' || action.closure_status === 'rejected'){
    const summary = document.createElement('span');
    summary.className = 'nc-muted-meta';
    summary.textContent = [
      action.effectiveness_result ? EFFECTIVENESS_LABELS[action.effectiveness_result] || action.effectiveness_result : '',
      action.closure_justification || ''
    ].filter(Boolean).join(' · ');
    controls.appendChild(summary);
  }
  return controls;
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
  const role = activeRole();

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
    const badgeEl = document.createElement('span');
    badgeEl.className = 'status-badge';
    badgeEl.textContent = action.status;
    status.appendChild(badgeEl);
    if(action.closure_status) status.appendChild(closureBadge(action.closure_status));
    if(isCapaOverdue(action)){
      const overdue = document.createElement('span');
      overdue.className = 'status-badge badge-overdue';
      overdue.textContent = 'Vencida';
      status.appendChild(overdue);
    }
    tr.appendChild(status);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'table-actions';
    if(can(role, 'complete_capa', capaContext(action))){
      actionsCell.appendChild(workflowButton('Completar', { ncCapaComplete: action.id }, 'complete_capa', !['pending', 'in_progress'].includes(action.status)));
    }
    const edit = actionButton('Editar', 'secondary', { capaEdit: action.id });
    edit.dataset.permission = 'edit_capa';
    const remove = actionButton('Eliminar', 'danger', { capaDelete: action.id });
    remove.dataset.permission = 'delete_records';
    actionsCell.append(edit, remove, capaClosureControls(action));
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  applyNcPermissions(container);
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
    const badgeEl = document.createElement('span');
    badgeEl.className = `status-badge ${row.has_capa ? 'badge-treatment' : 'badge-quarantine'}`;
    badgeEl.textContent = row.status_label;
    status.appendChild(badgeEl);
    tr.appendChild(status);

    const action = document.createElement('td');
    action.appendChild(actionButton('Gestionar CAPA', 'secondary', { quarantineNc: row.non_conformance_id }));
    tr.appendChild(action);

    tbody.appendChild(tr);
  });

  if(empty) empty.hidden = rows.length > 0;
}

export function renderNcEvidence(){
  const select = qs('nc-evidence-nc');
  if(!select) return;
  const ncs = loadCollection('non_conformances');
  populateSelect(
    select,
    ncs,
    'non_conformance_id',
    nc => `${nc.non_conformance_id} · ${nc.description.slice(0, 50)}`,
    ncs.length ? '-- Selecciona una no conformidad --' : '-- No hay no conformidades --'
  );
  const records = select.value ? evidenceFor('non_conformance', select.value) : [];
  renderEvidenceList(
    qs('nc-evidence-list'),
    records,
    buildReferenceMaps(),
    {
      emptyMessage: select.value
        ? 'Sin evidencia adjunta para esta no conformidad.'
        : 'Selecciona una no conformidad para ver o adjuntar evidencia.'
    }
  );
}

async function handleNcEvidenceSubmit(event){
  event.preventDefault();
  const error = qs('nc-evidence-error');
  if(error) error.textContent = '';
  const entityId = qs('nc-evidence-nc').value;
  const uploadedBy = qs('nc-evidence-author').value;
  const fileInput = qs('nc-evidence-file');
  const file = fileInput.files && fileInput.files[0];
  try{
    await addEvidenceFromFile({
      entityType: 'non_conformance',
      entityId,
      file,
      uploadedBy
    });
    fileInput.value = '';
    renderNcEvidence();
  }catch(err){
    if(error) error.textContent = err.message;
  }
}

function handleNcEvidenceClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.evidenceDownload){
    const record = loadCollection('quality_evidence')
      .find(item => item.id === button.dataset.evidenceDownload);
    if(record){
      try{
        downloadEvidence(record);
      }catch(err){
        const error = qs('nc-evidence-error');
        if(error) error.textContent = err.message;
      }
    }
    return;
  }
  if(button.dataset.evidenceDelete){
    if(!confirm('¿Eliminar esta evidencia?')) return;
    try{
      deleteEvidence(button.dataset.evidenceDelete);
      renderNcEvidence();
      if(currentDetailId) showNcDetail(currentDetailId);
    }catch(err){
      const error = qs('nc-evidence-error');
      if(error) error.textContent = err.message;
    }
  }
}

export function renderNonConformance(){
  fillCatalogSelect('nc-severity', qualityCatalog('severity_levels'), '');
  fillCatalogSelect('nc-status', qualityCatalog('nc_statuses'), '');
  fillCatalogSelect('nc-severity-filter', qualityCatalog('severity_levels'), 'Todas las gravedades');
  fillCatalogSelect('nc-status-filter', qualityCatalog('nc_statuses'), 'Todos los estados');
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
  populateSelect(
    qs('nc-inspection'),
    loadCollection('quality_inspections').filter(i => i.inspection_status === 'completed'),
    'inspection_id',
    inspection => `${moduleLabel(inspection.reference_module)} ${inspection.reference_id} · ${resultLabel(inspection.overall_result)}`,
    '-- Sin inspección relacionada --'
  );
  populateSelect(
    qs('nc-responsible'),
    loadExternal('employees'),
    'employee_id',
    employee => employee.name,
    '-- Sin responsable asignado --'
  );
  populateSelect(
    qs('nc-evidence-author'),
    loadExternal('employees'),
    'employee_id',
    employee => employee.name,
    '-- Selecciona un autor --'
  );
  renderOverrideSelect();
  renderReview();
  renderNcList();
  renderCapaList();
  renderQuarantine();
  renderNcEvidence();
  if(currentDetailId) showNcDetail(currentDetailId);
  if(!qs('capa-due').value) qs('capa-due').value = todayIso();
  if(!qs('nc-detected-date').value) qs('nc-detected-date').value = todayIso();
  applyNcPermissions(qs('view-non-conformance') || document);
}

function startNcEdit(nc){
  openNcForm(nc);
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
  const targetResult = qs('override-result').value;
  const justification = qs('override-justification').value.trim();
  if(targetResult === 'failed'){
    if(!justification){
      error.textContent = 'La justificación es obligatoria para rechazar el lote.';
      return;
    }
    if(typeof globalThis.confirm === 'function'
      && !globalThis.confirm('¿Rechazar el lote? El dictamen pasará a reprobado.')) return;
  }
  try{
    overrideInspection(
      qs('override-inspection').value,
      targetResult,
      justification,
      qs('override-user').value
    );
    qs('override-justification').value = '';
    renderNonConformance();
  }catch(err){
    error.textContent = err.message;
  }
}

async function handleNcSubmit(event){
  event.preventDefault();
  const error = qs('nc-error');
  error.textContent = '';
  const id = qs('nc-id').value;
  const existing = id ? loadCollection('non_conformances').find(nc => nc.id === id) : null;
  const inspectionId = qs('nc-inspection').value;
  const inspection = inspectionId
    ? loadCollection('quality_inspections').find(item => item.inspection_id === inspectionId)
    : null;
  const plan = inspection
    ? buildReferenceMaps().plans.get(inspection.inspection_plan_id)
    : null;
  const payload = {
    ...collectNcPayload(),
    product_id: (existing && existing.product_id) || (plan && plan.product_id) || 'prod-001'
  };
  const check = validateNonConformance(payload);
  showNcErrors(check.errors);
  if(!check.valid) return;

  try{
    let nc;
    if(id){
      nc = updateNonConformance(id, payload);
    }else{
      nc = addNonConformance(payload);
    }
    const files = Array.from(qs('nc-files').files || []);
    if(files.length){
      const uploadedBy = payload.responsible_employee_id
        || (loadExternal('employees')[0] && loadExternal('employees')[0].employee_id)
        || 'emp-001';
      for(const file of files){
        await addEvidenceFromFile({
          entityType: 'non_conformance',
          entityId: nc.non_conformance_id,
          file,
          uploadedBy
        });
      }
    }
    hideNcForm();
    renderNonConformance();
    showNcDetail(nc.id);
  }catch(err){
    error.textContent = err.message;
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

function reloadNcCapa(){
  renderNonConformance();
  setCapaWorkflowError('');
}

function completeNcCapa(action){
  try{
    assertCan(activeRole(), 'complete_capa', capaContext(action));
    updateCorrectiveAction(action.id, { status: 'completed', progress: 100 });
    reloadNcCapa();
  }catch(err){
    setCapaWorkflowError(err.message);
  }
}

function requestNcCapaClosure(action){
  try{
    assertCan(activeRole(), 'request_capa_closure', capaContext(action));
    invoke('requestCapaClosure', action.id, action.responsible_employee_id || activeRole());
    reloadNcCapa();
  }catch(err){
    setCapaWorkflowError(err.message);
  }
}

function saveNcEffectiveness(action, button){
  const row = button.closest('tr');
  const result = row && row.querySelector('[data-capa-effectiveness]') ? row.querySelector('[data-capa-effectiveness]').value : '';
  const notesEl = row && row.querySelector('[data-capa-effectiveness-notes]');
  const observations = notesEl ? notesEl.value.trim() : '';
  if(!result || !observations){
    setCapaWorkflowError('Registra la eficacia y sus observaciones antes de continuar.');
    return;
  }
  try{
    assertCan(activeRole(), 'register_effectiveness', capaContext(action));
    invoke('registerCapaEffectiveness', action.id, result, observations, activeRole());
    reloadNcCapa();
  }catch(err){
    setCapaWorkflowError(err.message);
  }
}

function reviewNcCapaClosure(action, decision, button){
  const row = button.closest('tr');
  const resultEl = row && row.querySelector('[data-capa-effectiveness]');
  const notesEl = row && row.querySelector('[data-capa-effectiveness-notes]');
  const justificationEl = row && row.querySelector('[data-capa-closure-justification]');
  const result = resultEl ? resultEl.value : '';
  const observations = notesEl ? notesEl.value.trim() : '';
  let justification = justificationEl ? justificationEl.value.trim() : '';
  if(decision === 'rejected' && !justification && typeof prompt === 'function'){
    justification = String(prompt('Justificación del rechazo del cierre') || '').trim();
  }
  if(result && !observations){
    setCapaWorkflowError('Registra las observaciones de eficacia antes de decidir el cierre.');
    return;
  }
  if(decision === 'rejected' && !justification){
    setCapaWorkflowError('Registra la justificación para continuar.');
    return;
  }
  try{
    assertCan(activeRole(), 'review_capa_closure', capaContext(action));
    invoke(
      'reviewCapaClosure',
      action.id,
      decision,
      result || null,
      observations || null,
      activeRole(),
      justification || null
    );
    reloadNcCapa();
  }catch(err){
    setCapaWorkflowError(err.message);
  }
}

function handleNcListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const ncs = loadCollection('non_conformances');
  if(button.dataset.ncDetail){
    showNcDetail(button.dataset.ncDetail);
    return;
  }
  if(button.dataset.ncBack){
    hideNcDetail();
    return;
  }
  if(button.dataset.ncCapa){
    qs('capa-nc').value = button.dataset.ncCapa;
    qs('capa-description').focus();
    if(qs('capa-form').scrollIntoView) qs('capa-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if(button.dataset.ncEdit){
    const nc = ncs.find(n => n.id === button.dataset.ncEdit);
    if(nc) startNcEdit(nc);
    return;
  }
  if(button.dataset.ncDelete){
    if(!confirm('¿Eliminar esta no conformidad y sus acciones CAPA?')) return;
    try{
      deleteNonConformance(button.dataset.ncDelete);
      hideNcDetail();
      hideNcForm();
      renderNonConformance();
    }catch(err){
      qs('nc-error').textContent = err.message;
    }
  }
}

function handleNcDetailClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.evidenceDownload || button.dataset.evidenceDelete){
    handleNcEvidenceClick(event);
    return;
  }
  const ncs = loadCollection('non_conformances');
  if(button.dataset.ncDetail){
    showNcDetail(button.dataset.ncDetail);
    return;
  }
  if(button.dataset.ncEdit){
    const nc = ncs.find(n => n.id === button.dataset.ncEdit);
    if(nc) startNcEdit(nc);
    return;
  }
  if(button.dataset.ncCapa){
    qs('capa-nc').value = button.dataset.ncCapa;
    qs('capa-description').focus();
    return;
  }
  hideNcDetail();
}

function handleCapaListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const actions = loadCollection('corrective_actions');
  if(button.dataset.ncCapaComplete){
    const action = actions.find(a => a.id === button.dataset.ncCapaComplete);
    if(action) completeNcCapa(action);
    return;
  }
  if(button.dataset.ncCapaRequestClosure){
    const action = actions.find(a => a.id === button.dataset.ncCapaRequestClosure);
    if(action) requestNcCapaClosure(action);
    return;
  }
  if(button.dataset.ncCapaEffectivenessSave){
    const action = actions.find(a => a.id === button.dataset.ncCapaEffectivenessSave);
    if(action) saveNcEffectiveness(action, button);
    return;
  }
  if(button.dataset.ncCapaClosureApprove || button.dataset.ncCapaClosureReject){
    const id = button.dataset.ncCapaClosureApprove || button.dataset.ncCapaClosureReject;
    const action = actions.find(a => a.id === id);
    if(action) reviewNcCapaClosure(action, button.dataset.ncCapaClosureApprove ? 'approved' : 'rejected', button);
    return;
  }
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
  const ncCreate = qs('nc-create');
  if(ncCreate){
    ncCreate.dataset.permission = 'register_nc';
    ncCreate.addEventListener('click', () => openNcForm());
  }
  qs('nc-cancel').addEventListener('click', hideNcForm);
  qs('nc-form-back').addEventListener('click', hideNcForm);
  qs('nc-detail-back').addEventListener('click', hideNcDetail);
  qs('nc-list').addEventListener('click', handleNcListClick);
  qs('nc-detail-body').addEventListener('click', handleNcDetailClick);
  ['nc-search', 'nc-severity-filter', 'nc-status-filter', 'nc-date-filter'].forEach(id => {
    const control = qs(id);
    if(control) control.addEventListener('input', renderNcList);
    if(control) control.addEventListener('change', renderNcList);
  });
  qs('capa-form').addEventListener('submit', handleCapaSubmit);
  qs('capa-cancel').addEventListener('click', clearCapaForm);
  qs('capa-list').addEventListener('click', handleCapaListClick);
  qs('nc-evidence-form').addEventListener('submit', handleNcEvidenceSubmit);
  qs('nc-evidence-nc').addEventListener('change', () => renderNcEvidence());
  qs('nc-evidence-list').addEventListener('click', handleNcEvidenceClick);
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
