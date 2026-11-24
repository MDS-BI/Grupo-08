import * as storage from '../storage.js';
import {
  loadCollection,
  loadExternal,
  planCriteria,
  planHasInspections,
  validateInspectionPlan,
  validateCriterion,
  isPlanEnabled,
  qualityCatalog,
  qualityParameter
} from '../storage.js';
import { can, assertCan, applyPermissionState } from '../permissions.js';
import { PLAN_STATUSES } from '../quality-status.js';
import { buildReferenceMaps, productName, stageLabel, qs, cell, actionButton, emptyState } from './quality-utils.js';
import { renderStatusBadge, renderStatusLegend, statusLabel } from './status-badge.js';
import { renderPermissionNotice } from './permission-notice.js';

const PLAN_ERROR_FIELDS = {
  plan_name: 'error-plan-name',
  product_id: 'error-plan-product',
  applicable_stage: 'error-plan-stage'
};

const CRITERIA_ERROR_FIELDS = {
  criteria_name: 'error-criteria-name',
  expected_value: 'error-criteria-expected',
  tolerance: 'error-criteria-tolerance',
  unit: 'error-criteria-unit',
  comparison_type: 'error-criteria-comparison'
};

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

function planStatus(plan){
  return PLAN_STATUSES.includes(plan && plan.status) ? plan.status : 'draft';
}

function planIsEditable(plan){
  return ['draft', 'rejected'].includes(planStatus(plan));
}

function planContext(plan){
  return {
    status: planStatus(plan),
    criteriaCount: planCriteria(plan && (plan.inspection_plan_id || plan.id)).length,
    hasHistory: Boolean(plan && plan.is_locked) || planHasInspections(plan && plan.inspection_plan_id),
    isLocked: Boolean(plan && plan.is_locked)
  };
}

function setPlanError(message){
  const el = qs('plan-action-error');
  if(el) el.textContent = message || '';
}

function setCriteriaError(message){
  const el = qs('criteria-action-error');
  if(el) el.textContent = message || '';
}

function workflowButton(label, dataset, permission, disabled){
  const button = actionButton(label, 'secondary', dataset);
  if(disabled){
    button.disabled = true;
    button.dataset.stateDisabled = 'true';
  }else{
    button.setAttribute('data-permission', permission);
  }
  return button;
}

function applyStateDisables(root){
  if(!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-state-disabled]').forEach(button => { button.disabled = true; });
}

function permissionNotice(container, action){
  if(!container || can(activeRole(), action)) return;
  container.prepend(renderPermissionNotice(action));
}

export function collectPlanPayload(){
  return {
    plan_name: qs('plan-name').value,
    product_id: qs('plan-product').value,
    applicable_stage: qs('plan-stage').value
  };
}

export function collectCriterionPayload(){
  return {
    inspection_plan_id: qs('criteria-plan').value,
    criteria_name: qs('criteria-name').value,
    expected_value: qs('criteria-expected').value,
    tolerance: qs('criteria-tolerance').value,
    unit: qs('criteria-unit').value,
    comparison_type: qs('criteria-comparison').value,
    is_critical: qs('criteria-critical').checked
  };
}

export function showPlanErrors(errors = {}){
  Object.entries(PLAN_ERROR_FIELDS).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
}

export function showCriterionErrors(errors = {}){
  Object.entries(CRITERIA_ERROR_FIELDS).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
  const planError = qs('error-criteria-plan');
  if(planError) planError.textContent = errors.inspection_plan_id || '';
}

export function clearPlanForm(){
  qs('plan-id').value = '';
  qs('plan-name').value = '';
  qs('plan-product').value = '';
  const stages = qualityCatalog('inspection_categories');
  qs('plan-stage').value = stages.some(item => item.key === qualityParameter('default_inspection_stage'))
    ? qualityParameter('default_inspection_stage')
    : stages[0]?.key || '';
  qs('plan-submit').textContent = 'Guardar plan';
  qs('plan-cancel').hidden = true;
  showPlanErrors({});
}

export function clearCriterionForm(){
  qs('criteria-id').value = '';
  qs('criteria-name').value = '';
  qs('criteria-expected').value = '';
  qs('criteria-tolerance').value = '';
  qs('criteria-unit').value = '';
  qs('criteria-comparison').value = 'range';
  qs('criteria-critical').checked = false;
  qs('criteria-submit').textContent = 'Guardar criterio';
  qs('criteria-cancel').hidden = true;
  showCriterionErrors({});
}

function populateProductSelect(){
  const select = qs('plan-product');
  const prev = select.value;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- Selecciona un producto --';
  select.appendChild(blank);
  loadExternal('products').forEach(product => {
    const opt = document.createElement('option');
    opt.value = product.product_id;
    opt.textContent = product.name;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

function populateStageSelect(){
  const select = qs('plan-stage');
  if(!select) return;
  const prev = select.value || qualityParameter('default_inspection_stage');
  select.innerHTML = '';
  qualityCatalog('inspection_categories').forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.key;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(opt => opt.value === prev)) select.value = prev;
}

function populateCriteriaPlanSelect(){
  const select = qs('criteria-plan');
  const prev = select.value;
  const plans = loadCollection('quality_inspection_plans');
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = plans.length ? '-- Selecciona un plan --' : '-- No hay planes --';
  select.appendChild(blank);
  plans.forEach(plan => {
    const opt = document.createElement('option');
    opt.value = plan.inspection_plan_id;
    opt.textContent = `${plan.plan_name} · ${stageLabel(plan.applicable_stage)} · ${statusLabel(planStatus(plan))}`;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

export function renderPlansList(){
  const container = qs('plans-list');
  if(!container) return;
  container.innerHTML = '';
  const role = activeRole();
  const plans = loadCollection('quality_inspection_plans');
  const maps = buildReferenceMaps();
  const isEmpty = plans.length === 0;
  emptyState(container, 'Aún no existen planes de inspección.', isEmpty);

  const legend = renderStatusLegend(PLAN_STATUSES);
  legend.classList.add('plan-status-legend');
  container.appendChild(legend);

  plans.forEach(plan => {
    const status = planStatus(plan);
    const context = planContext(plan);
    const item = document.createElement('div');
    item.className = 'plan-item';

    const head = document.createElement('div');
    head.className = 'plan-item-head';
    const title = document.createElement('strong');
    title.textContent = plan.plan_name;
    head.appendChild(title);
    const stage = document.createElement('span');
    stage.className = 'status-badge';
    stage.textContent = stageLabel(plan.applicable_stage);
    head.appendChild(stage);
    head.appendChild(renderStatusBadge(status));
    const product = document.createElement('span');
    product.className = 'muted';
    product.textContent = productName(maps, plan.product_id);
    head.appendChild(product);
    item.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'muted plan-meta';
    const details = [
      `${context.criteriaCount} criterio(s)`,
      isPlanEnabled(plan.inspection_plan_id) ? 'Habilitado' : 'Sin criterios',
      context.hasHistory ? 'Bloqueado por historial' : 'Editable'
    ];
    if(status === 'rejected' && plan.review_justification) details.push(`Rechazo: ${plan.review_justification}`);
    meta.textContent = details.join(' · ');
    item.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.appendChild(workflowButton('Editar', { planEdit: plan.id }, 'manage_plan', !planIsEditable(plan)));
    actions.appendChild(workflowButton('Criterios', { planCriteria: plan.inspection_plan_id }, 'manage_plan', !planIsEditable(plan)));
    if(['draft', 'rejected'].includes(status)){
      actions.appendChild(workflowButton('Enviar a aprobación', { planSubmit: plan.id }, 'submit_plan', !context.criteriaCount));
    }
    if(status === 'pending_approval'){
      actions.appendChild(workflowButton('Aprobar', { planApprove: plan.id }, 'approve_plan', false));
      actions.appendChild(workflowButton('Rechazar', { planReject: plan.id }, 'reject_plan', false));
    }
    if(status === 'approved'){
      actions.appendChild(workflowButton('Nueva versión', { planVersion: plan.id }, 'version_plan', false));
    }
    actions.appendChild(workflowButton(status === 'approved' ? 'Duplicar como borrador' : 'Duplicar', { planDuplicate: plan.id }, 'version_plan', status !== 'approved'));
    const del = workflowButton('Eliminar', { planDelete: plan.id }, 'delete_plan', !can(role, 'delete_plan', context));
    del.classList.add('danger');
    actions.appendChild(del);
    item.appendChild(actions);

    applyPermissionState(actions, role, context);
    applyStateDisables(actions);
    container.appendChild(item);
  });

  permissionNotice(container, 'manage_plan');
  setPlanError('');
}

export function renderCriteriaList(){
  const container = qs('criteria-list');
  const planId = qs('criteria-plan') ? qs('criteria-plan').value : '';
  if(!container) return;
  container.innerHTML = '';

  if(!planId){
    emptyState(container, 'Selecciona un plan para ver sus criterios.', true);
    return;
  }

  const role = activeRole();
  const plan = loadCollection('quality_inspection_plans').find(item => item.inspection_plan_id === planId || item.id === planId);
  const status = planStatus(plan);
  const context = planContext(plan || { inspection_plan_id: planId, status: 'draft' });
  const criteria = planCriteria(planId);
  const isEmpty = criteria.length === 0;
  emptyState(container, 'El plan todavía no tiene criterios. Agrega al menos uno para habilitarlo.', isEmpty);

  const workflow = document.createElement('div');
  workflow.className = 'form-actions criteria-workflow';
  workflow.appendChild(renderStatusBadge(status));
  if(['draft', 'rejected'].includes(status)){
    workflow.appendChild(workflowButton('Enviar a aprobación', { planSubmit: planId }, 'submit_plan', !criteria.length));
  }
  if(status === 'pending_approval'){
    workflow.appendChild(workflowButton('Aprobar', { planApprove: planId }, 'approve_plan', false));
    workflow.appendChild(workflowButton('Rechazar', { planReject: planId }, 'reject_plan', false));
  }
  if(status === 'approved'){
    workflow.appendChild(workflowButton('Nueva versión', { planVersion: planId }, 'version_plan', false));
  }
  if(status === 'rejected' && plan && plan.review_justification){
    const reason = document.createElement('span');
    reason.className = 'muted';
    reason.textContent = `Motivo del rechazo: ${plan.review_justification}`;
    workflow.appendChild(reason);
  }
  applyPermissionState(workflow, role, context);
  applyStateDisables(workflow);
  container.appendChild(workflow);
  permissionNotice(container, 'manage_plan');

  if(isEmpty) return;

  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Criterio', 'Esperado', 'Tolerancia', 'Unidad', 'Comparación', 'Crítico', 'Acciones'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  criteria.forEach(criterion => {
    const tr = document.createElement('tr');
    tr.appendChild(cell(criterion.criteria_name));
    tr.appendChild(cell(criterion.expected_value));
    tr.appendChild(cell(criterion.tolerance));
    tr.appendChild(cell(criterion.unit));
    tr.appendChild(cell(criterion.comparison_type));
    tr.appendChild(cell(criterion.is_critical ? 'Sí' : 'No'));
    const actions = document.createElement('td');
    actions.className = 'table-actions';
    const locked = Boolean(criterion.is_locked) || !planIsEditable(plan || { status });
    const edit = workflowButton('Editar', { criterionEdit: criterion.id }, 'manage_plan', locked);
    actions.appendChild(edit);
    const del = workflowButton('Eliminar', { criterionDelete: criterion.id }, 'delete_records', locked);
    del.classList.add('danger');
    actions.appendChild(del);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  applyPermissionState(table, role, context);
  applyStateDisables(table);
}

export function renderPlanConfig(){
  populateProductSelect();
  populateStageSelect();
  populateCriteriaPlanSelect();
  renderPlansList();
  renderCriteriaList();
}

function startPlanEdit(plan){
  qs('plan-id').value = plan.id;
  qs('plan-name').value = plan.plan_name;
  qs('plan-product').value = plan.product_id;
  qs('plan-stage').value = plan.applicable_stage;
  qs('plan-submit').textContent = 'Actualizar plan';
  qs('plan-cancel').hidden = false;
  showPlanErrors({});
}

function startCriterionEdit(criterion){
  qs('criteria-id').value = criterion.id;
  qs('criteria-name').value = criterion.criteria_name;
  qs('criteria-expected').value = criterion.expected_value;
  qs('criteria-tolerance').value = criterion.tolerance;
  qs('criteria-unit').value = criterion.unit;
  qs('criteria-comparison').value = criterion.comparison_type;
  qs('criteria-critical').checked = Boolean(criterion.is_critical);
  qs('criteria-submit').textContent = 'Actualizar criterio';
  qs('criteria-cancel').hidden = false;
  showCriterionErrors({});
}

function handlePlanSubmit(event){
  event.preventDefault();
  const role = activeRole();
  const id = qs('plan-id').value;
  const plans = loadCollection('quality_inspection_plans');
  const current = id ? plans.find(plan => plan.id === id || plan.inspection_plan_id === id) : null;
  const context = current ? planContext(current) : { status: 'draft', criteriaCount: 0, hasHistory: false };
  assertCan(role, 'manage_plan', context);
  if(current && !planIsEditable(current)){
    setPlanError('Este plan no puede editarse; crea una nueva versión.');
    return;
  }
  const payload = collectPlanPayload();
  const check = validateInspectionPlan(payload);
  showPlanErrors(check.errors);
  if(!check.valid) return;
  try{
    if(id) invoke('updatePlan', id, payload, role);
    else invoke('addPlan', { ...payload, created_by: role });
    clearPlanForm();
    renderPlanConfig();
  }catch(error){
    setPlanError(error.message);
  }
}

function handleCriterionSubmit(event){
  event.preventDefault();
  const role = activeRole();
  const planId = qs('criteria-plan').value;
  if(!planId){
    showCriterionErrors({ inspection_plan_id: 'Selecciona un plan antes de agregar criterios' });
    return;
  }
  const plan = loadCollection('quality_inspection_plans').find(item => item.inspection_plan_id === planId || item.id === planId);
  assertCan(role, 'manage_plan', planContext(plan || { inspection_plan_id: planId, status: 'draft' }));
  if(plan && !planIsEditable(plan)){
    setCriteriaError('Este plan no admite cambios en sus criterios; crea una nueva versión.');
    return;
  }
  const id = qs('criteria-id').value;
  const payload = collectCriterionPayload();
  const check = validateCriterion(payload);
  showCriterionErrors(check.errors);
  if(!check.valid) return;
  try{
    if(id) invoke('updateCriterion', id, payload);
    else invoke('addCriterion', payload);
    clearCriterionForm();
    renderPlanConfig();
  }catch(error){
    setCriteriaError(error.message);
  }
}

function rejectionJustification(errorSetter){
  const value = typeof globalThis.prompt === 'function' ? globalThis.prompt('Justificación del rechazo') : '';
  if(value === null) return null;
  const reason = String(value).trim();
  if(!reason){
    errorSetter('La justificación es obligatoria para rechazar.');
    return null;
  }
  return reason;
}

function handlePlanWorkflowAction(button){
  const role = activeRole();
  const plans = loadCollection('quality_inspection_plans');
  const id = button.dataset.planSubmit || button.dataset.planApprove || button.dataset.planReject || button.dataset.planVersion || button.dataset.planDuplicate || button.dataset.planDelete;
  const plan = plans.find(item => item.id === id || item.inspection_plan_id === id);
  if(!plan) return false;
  const context = planContext(plan);
  const actions = {
    planSubmit: ['submit_plan', () => invoke('submitPlanForApproval', id, role)],
    planApprove: ['approve_plan', () => invoke('approvePlan', id, role)],
    planReject: ['reject_plan', () => invoke('rejectPlan', id, role, rejectionJustification(setPlanError))],
    planVersion: ['version_plan', () => invoke('duplicatePlanVersion', id, role)],
    planDuplicate: ['version_plan', () => planStatus(plan) === 'approved'
      ? invoke('duplicatePlanVersion', id, role)
      : invoke('duplicatePlan', id)],
    planDelete: ['delete_plan', () => {
      if(!confirm('¿Eliminar este plan y sus criterios?')) return null;
      return invoke('deletePlan', id, role);
    }]
  };
  const entry = Object.entries(actions).find(([key]) => button.dataset[key]);
  if(!entry) return false;
  const [, [permission, run]] = entry;
  setPlanError('');
  try{
    assertCan(role, permission, context);
    const result = run();
    if(result === null) return true;
    clearPlanForm();
    renderPlanConfig();
  }catch(error){
    setPlanError(error.message);
  }
  return true;
}

function handlePlansListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  setPlanError('');
  if(handlePlanWorkflowAction(button)) return;
  const plans = loadCollection('quality_inspection_plans');
  if(button.dataset.planEdit){
    const plan = plans.find(p => p.id === button.dataset.planEdit);
    if(plan && planIsEditable(plan)) startPlanEdit(plan);
    else setPlanError('Este plan no puede editarse; crea una nueva versión.');
    return;
  }
  if(button.dataset.planCriteria){
    const plan = plans.find(p => p.inspection_plan_id === button.dataset.planCriteria || p.id === button.dataset.planCriteria);
    if(plan && !planIsEditable(plan)) setPlanError('Este plan no puede editarse; crea una nueva versión.');
    qs('criteria-plan').value = button.dataset.planCriteria;
    renderCriteriaList();
  }
}

function handleCriteriaListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  setCriteriaError('');
  if(handlePlanWorkflowAction(button)) return;
  const criteria = loadCollection('quality_inspection_criteria');
  if(button.dataset.criterionEdit){
    const criterion = criteria.find(c => c.id === button.dataset.criterionEdit);
    if(criterion) startCriterionEdit(criterion);
    return;
  }
  if(button.dataset.criterionDelete){
    if(!confirm('¿Eliminar este criterio?')) return;
    try{
      invoke('deleteCriterion', button.dataset.criterionDelete);
      clearCriterionForm();
      renderPlanConfig();
    }catch(error){
      setCriteriaError(error.message);
    }
  }
}

export function initPlanConfig(){
  const form = qs('plan-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
  ['plan-name', 'plan-product', 'plan-stage', 'plan-submit', 'criteria-plan', 'criteria-name', 'criteria-expected', 'criteria-tolerance', 'criteria-unit', 'criteria-comparison', 'criteria-critical', 'criteria-submit'].forEach(id => {
    const control = qs(id);
    if(control) control.setAttribute('data-permission', 'manage_plan');
  });
  form.addEventListener('submit', handlePlanSubmit);
  qs('plan-cancel').addEventListener('click', clearPlanForm);
  qs('criteria-form').addEventListener('submit', handleCriterionSubmit);
  qs('criteria-cancel').addEventListener('click', clearCriterionForm);
  qs('criteria-plan').addEventListener('change', () => {
    clearCriterionForm();
    renderCriteriaList();
  });
  qs('plans-list').addEventListener('click', handlePlansListClick);
  qs('criteria-list').addEventListener('click', handleCriteriaListClick);
}
