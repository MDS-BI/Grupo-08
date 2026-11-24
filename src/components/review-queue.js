import * as qualityStorage from '../storage.js';
import { can, assertCan, applyPermissionState } from '../permissions.js';
import { isLegacyConditionalInspection, isPendingCapaClosure } from '../quality-status.js';
import { qs, cell, actionButton } from './quality-utils.js';
import { renderStatusBadge } from './status-badge.js';
import { renderPermissionNotice, clearPermissionNotice } from './permission-notice.js';

const ROLE_KEY = 'erp_quality:viewer_role';

const QUEUE_SECTIONS = Object.freeze([
  { key: 'plans', label: 'Planes de inspección' },
  { key: 'checklists', label: 'Listas de verificación' },
  { key: 'documents', label: 'Documentos' },
  { key: 'inspections', label: 'Inspecciones' },
  { key: 'capa', label: 'Cierres CAPA' }
]);

function activeRole(){
  const getter = qualityStorage.getActiveRole;
  if(typeof getter === 'function'){
    try{ return getter(); }catch{ return 'jefe_calidad'; }
  }
  try{ return globalThis.localStorage?.getItem(ROLE_KEY) || 'jefe_calidad'; }catch{ return 'jefe_calidad'; }
}

function invoke(name, ...args){
  const fn = qualityStorage[name];
  if(typeof fn !== 'function') throw new Error(`La operación ${name} no está disponible en este momento.`);
  return fn(...args);
}

function recordId(record){
  return record.id || record.inspection_plan_id || record.checklist_id || record.document_id || record.inspection_id || record.corrective_action_id || '';
}

function recordStatus(record){
  return record.status || record.plan_status || record.checklist_status || record.document_status || record.inspection_status || '';
}

function recordTitle(record){
  return record.plan_name || record.checklist_name || record.name || record.title || record.action_description || record.description || recordId(record);
}

function isPendingPlan(record){
  return recordStatus(record) === 'pending_approval';
}

function isPendingDocument(record){
  const status = recordStatus(record);
  return status === 'pending_review' || status === 'under_review';
}

function isPendingInspection(record){
  const status = record.inspection_status || record.status;
  if(status === 'pending_review') return true;
  return isLegacyConditionalInspection(record);
}

function isPendingCapa(record){
  return isPendingCapaClosure(record) || (record.closure_status === 'pending' && record.status === 'completed');
}

function queueData(){
  return {
    plans: qualityStorage.loadCollection('quality_inspection_plans').filter(isPendingPlan),
    checklists: qualityStorage.loadCollection('quality_checklists').filter(isPendingPlan),
    documents: qualityStorage.loadCollection('quality_documents').filter(isPendingDocument),
    inspections: qualityStorage.loadCollection('quality_inspections').filter(isPendingInspection),
    capa: qualityStorage.loadCollection('corrective_actions').filter(isPendingCapa)
  };
}

function setError(message){
  const error = qs('review-queue-error');
  if(error) error.textContent = message || '';
}

function setCounter(key, count){
  const el = qs(`queue-count-${key}`);
  if(el) el.textContent = String(count);
}

function queueFilter(){
  const typeSelect = qs('approval-type-filter');
  const searchInput = qs('approval-search');
  return {
    type: typeSelect ? typeSelect.value : '',
    term: searchInput ? searchInput.value.trim().toLowerCase() : ''
  };
}

function recordSearchText(record){
  return Object.values(record)
    .filter(value => value !== null && value !== undefined && typeof value !== 'object')
    .join(' ')
    .toLowerCase();
}

function filteredRecords(key, records){
  const filter = queueFilter();
  if(filter.type && filter.type !== key) return [];
  if(!filter.term) return records;
  return records.filter(record => recordSearchText(record).includes(filter.term));
}

function emptyQueue(message, navKey){
  const wrapper = document.createElement('div');
  wrapper.className = 'empty queue-empty';
  const text = document.createElement('span');
  text.textContent = message;
  wrapper.appendChild(text);
  if(navKey){
    const action = actionButton('Ir a la vista relacionada', 'secondary');
    action.dataset.queueNavigate = navKey;
    wrapper.appendChild(action);
  }
  return wrapper;
}

function statusCell(status, result){
  const td = document.createElement('td');
  td.appendChild(renderStatusBadge(status, result ? { result } : {}));
  return td;
}

function makeTable(headers){
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'data-table review-table';
  const thead = document.createElement('thead');
  const row = document.createElement('tr');
  headers.forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    row.appendChild(th);
  });
  thead.appendChild(row);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  scroll.appendChild(table);
  return { scroll, tbody };
}

function decisionButton(label, queueAction, permission, id, decision){
  const button = actionButton(label, decision === 'rejected' ? 'danger' : 'primary', {
    queueAction,
    permission,
    id,
    decision: decision || ''
  });
  button.setAttribute('data-permission', permission);
  return button;
}

function approvalRow(record, kind){
  const tr = document.createElement('tr');
  tr.append(cell(recordTitle(record)), statusCell(recordStatus(record)));
  const actions = document.createElement('td');
  const permissionApprove = kind === 'plan' ? 'approve_plan' : kind === 'checklist' ? 'approve_checklist' : 'approve_document';
  const permissionReject = kind === 'plan' ? 'reject_plan' : kind === 'checklist' ? 'reject_checklist' : 'reject_document';
  actions.appendChild(decisionButton('Aprobar', 'approve', permissionApprove, recordId(record), 'approved'));
  actions.appendChild(decisionButton('Rechazar', 'reject', permissionReject, recordId(record), 'rejected'));
  tr.appendChild(actions);
  return tr;
}

function inspectionRow(record){
  const tr = document.createElement('tr');
  tr.append(
    cell(recordId(record)),
    cell(record.inspection_date || '—'),
    statusCell(recordStatus(record), record.proposed_result || record.overall_result),
    cell(record.proposed_result || record.overall_result || '—')
  );
  const actions = document.createElement('td');
  actions.appendChild(decisionButton('Aprobar', 'review_inspection', 'review_inspection', recordId(record), 'approved'));
  actions.appendChild(decisionButton('Aprobado condicional', 'review_inspection', 'review_inspection', recordId(record), 'approved_conditional'));
  actions.appendChild(decisionButton('Rechazar', 'review_inspection', 'review_inspection', recordId(record), 'rejected'));
  tr.appendChild(actions);
  return tr;
}

function capaRow(record){
  const tr = document.createElement('tr');
  tr.append(
    cell(recordId(record)),
    cell(record.action_description || record.description || '—'),
    statusCell(record.closure_status || 'pending', record.effectiveness_result),
    cell(record.due_date || '—')
  );
  const actions = document.createElement('td');
  actions.className = 'capa-review-actions';

  const resultLabel = document.createElement('label');
  resultLabel.textContent = 'Resultado de eficacia';
  resultLabel.className = 'sr-only';
  resultLabel.htmlFor = `effectiveness-${recordId(record)}`;
  const result = document.createElement('select');
  result.id = `effectiveness-${recordId(record)}`;
  result.dataset.field = 'effectiveness';
  result.dataset.id = recordId(record);
  [['', 'Seleccionar resultado'], ['effective', 'Eficaz'], ['not_effective', 'No eficaz']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    result.appendChild(option);
  });
  if(record.effectiveness_result) result.value = record.effectiveness_result;
  actions.append(resultLabel, result);

  const observationsLabel = document.createElement('label');
  observationsLabel.textContent = 'Observaciones de eficacia';
  observationsLabel.className = 'sr-only';
  observationsLabel.htmlFor = `effectiveness-obs-${recordId(record)}`;
  const observations = document.createElement('textarea');
  observations.id = `effectiveness-obs-${recordId(record)}`;
  observations.rows = 2;
  observations.dataset.field = 'observations';
  observations.dataset.id = recordId(record);
  observations.value = record.effectiveness_observations || '';
  observationsLabel.append(observations);
  actions.append(observationsLabel, observations);

  const register = actionButton('Registrar eficacia', 'secondary', { queueAction: 'register_effectiveness', id: recordId(record) });
  register.setAttribute('data-permission', 'register_effectiveness');
  const approve = decisionButton('Aprobar cierre', 'review_capa_closure', 'review_capa_closure', recordId(record), 'approved');
  const reject = decisionButton('Rechazar cierre', 'review_capa_closure', 'review_capa_closure', recordId(record), 'rejected');
  actions.append(register, approve, reject);
  tr.appendChild(actions);
  return tr;
}

function renderApprovalQueue(container, records, kind, emptyMessage, navKey){
  const { scroll, tbody } = makeTable(['Registro', 'Estado', 'Acciones']);
  records.forEach(record => tbody.appendChild(approvalRow(record, kind)));
  container.replaceChildren(scroll);
  if(records.length === 0) container.appendChild(emptyQueue(emptyMessage, navKey));
}

function renderInspectionQueue(container, records){
  const { scroll, tbody } = makeTable(['Inspección', 'Fecha', 'Estado', 'Resultado propuesto', 'Acciones']);
  records.forEach(record => tbody.appendChild(inspectionRow(record)));
  container.replaceChildren(scroll);
  if(records.length === 0) container.appendChild(emptyQueue('No hay inspecciones pendientes de dictamen final.', 'quality-inspections'));
}

function renderCapaQueue(container, records){
  const { scroll, tbody } = makeTable(['Acción', 'Descripción', 'Estado de cierre', 'Fecha límite', 'Acciones']);
  records.forEach(record => tbody.appendChild(capaRow(record)));
  container.replaceChildren(scroll);
  if(records.length === 0) container.appendChild(emptyQueue('No hay cierres CAPA pendientes de revisión.', 'quality-capa'));
}

function showNoAccess(){
  const noticeHost = qs('review-permission-notice');
  if(noticeHost){
    noticeHost.replaceChildren(renderPermissionNotice('view_approval_queues'));
    noticeHost.hidden = false;
  }
  QUEUE_SECTIONS.forEach(({ key }) => {
    setCounter(key, 0);
    const container = qs(`queue-${key}`);
    if(container) container.replaceChildren();
  });
  const list = qs('review-queues');
  if(list){
    list.classList.add('read-only');
    list.setAttribute('aria-disabled', 'true');
  }
}

export function renderReviewQueue(){
  const root = qs('view-quality-approvals');
  if(!root) return null;
  const role = activeRole();
  setError('');
  clearPermissionNotice(root);
  if(!can(role, 'view_approval_queues')){
    showNoAccess();
    return null;
  }
  const noticeHost = qs('review-permission-notice');
  if(noticeHost){
    noticeHost.replaceChildren();
    noticeHost.hidden = true;
  }
  const list = qs('review-queues');
  if(list){
    list.classList.remove('read-only');
    list.removeAttribute('aria-disabled');
  }
  const data = queueData();
  const filter = queueFilter();
  QUEUE_SECTIONS.forEach(({ key }) => setCounter(key, data[key].length));
  document.querySelectorAll('[data-queue-section]').forEach(section => {
    section.hidden = Boolean(filter.type) && section.dataset.queueSection !== filter.type;
  });
  renderApprovalQueue(qs('queue-plans'), filteredRecords('plans', data.plans), 'plan', 'No hay planes pendientes de aprobación.', 'quality-plans');
  renderApprovalQueue(qs('queue-checklists'), filteredRecords('checklists', data.checklists), 'checklist', 'No hay listas pendientes de aprobación.', 'quality-checklists');
  renderApprovalQueue(qs('queue-documents'), filteredRecords('documents', data.documents), 'document', 'No hay documentos pendientes de revisión.', 'quality-documents');
  renderInspectionQueue(qs('queue-inspections'), filteredRecords('inspections', data.inspections));
  renderCapaQueue(qs('queue-capa'), filteredRecords('capa', data.capa));
  const visibleCount = QUEUE_SECTIONS.reduce((total, { key }) => total + filteredRecords(key, data[key]).length, 0);
  const resultCount = qs('approval-result-count');
  if(resultCount) resultCount.textContent = `${visibleCount} pendiente(s) visible(s)`;
  applyPermissionState(root, role);
  return data;
}

function promptJustification(action, decision){
  if(decision !== 'rejected' && decision !== 'approved_conditional') return '';
  const value = globalThis.prompt(`Justificación requerida para ${action}.`);
  if(value === null) return null;
  return value.trim();
}

function runDecision(button){
  const role = activeRole();
  const action = button.dataset.queueAction;
  const id = button.dataset.id;
  const decision = button.dataset.decision;
  const permissions = {
    approve: button.dataset.permission,
    reject: button.dataset.permission,
    review_inspection: 'review_inspection',
    review_capa_closure: 'review_capa_closure'
  };
  const permission = permissions[action] || button.dataset.permission;
  assertCan(role, permission);
  const justification = promptJustification(action, decision);
  if(justification === null) return;
  if((decision === 'rejected' || decision === 'approved_conditional') && !justification){
    setError('La justificación es obligatoria para esta decisión.');
    return;
  }
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try{
    if(action === 'approve'){
      invoke(approveName(button.dataset.permission), id, role, justification);
    } else if(action === 'reject'){
      invoke(rejectName(button.dataset.permission), id, role, justification);
    } else if(action === 'review_inspection'){
      invoke('reviewInspection', id, decision, role, justification);
    } else if(action === 'review_capa_closure'){
      const result = document.querySelector(`[data-field="effectiveness"][data-id="${id}"]`);
      const observations = document.querySelector(`[data-field="observations"][data-id="${id}"]`);
      invoke('reviewCapaClosure', id, decision, result ? result.value : '', observations ? observations.value : '', role, justification);
    }
    renderReviewQueue();
  }catch(err){
    button.disabled = false;
    button.removeAttribute('aria-busy');
    setError(err && err.message ? err.message : 'No se pudo completar la operación.');
  }
}

function approveName(permission){
  return { approve_plan: 'approvePlan', approve_checklist: 'approveChecklist', approve_document: 'approveDocument' }[permission];
}

function rejectName(permission){
  return { reject_plan: 'rejectPlan', reject_checklist: 'rejectChecklist', reject_document: 'rejectDocument' }[permission];
}

function registerEffectiveness(button){
  const role = activeRole();
  assertCan(role, 'register_effectiveness');
  const id = button.dataset.id;
  const selector = `[data-field="effectiveness"][data-id="${id}"]`;
  const result = document.querySelector(selector);
  const observations = document.querySelector(`[data-field="observations"][data-id="${id}"]`);
  if(!result || !result.value){
    setError('Selecciona el resultado de eficacia antes de registrarlo.');
    return;
  }
  if(!observations || !observations.value.trim()){
    setError('Las observaciones de eficacia son obligatorias.');
    return;
  }
  button.disabled = true;
  try{
    invoke('registerCapaEffectiveness', id, result.value, observations.value.trim(), role);
    renderReviewQueue();
  }catch(err){
    button.disabled = false;
    setError(err && err.message ? err.message : 'No se pudo registrar la eficacia.');
  }
}

function handleQueueClick(event){
  const navigate = event.target.closest('[data-queue-navigate]');
  if(navigate){
    document.dispatchEvent(new CustomEvent('quality:navigate-requested', { detail: { view: navigate.dataset.queueNavigate } }));
    return;
  }
  const button = event.target.closest('button[data-queue-action]');
  if(!button) return;
  if(button.dataset.queueAction === 'register_effectiveness'){
    registerEffectiveness(button);
    return;
  }
  runDecision(button);
}

export function initReviewQueue(){
  const container = qs('review-queues');
  if(!container || container.dataset.wired === 'true') return;
  container.dataset.wired = 'true';
  container.addEventListener('click', handleQueueClick);
  const typeFilter = qs('approval-type-filter');
  if(typeFilter) typeFilter.addEventListener('change', () => renderReviewQueue());
  const search = qs('approval-search');
  if(search) search.addEventListener('input', () => renderReviewQueue());
  const refresh = qs('approval-refresh');
  if(refresh) refresh.addEventListener('click', () => renderReviewQueue());
}
