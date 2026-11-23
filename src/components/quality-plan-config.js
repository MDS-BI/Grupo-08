import {
  loadCollection,
  loadExternal,
  addPlan,
  updatePlan,
  deletePlan,
  duplicatePlan,
  addCriterion,
  updateCriterion,
  deleteCriterion,
  planCriteria,
  planHasInspections,
  validateInspectionPlan,
  validateCriterion,
  isPlanEnabled,
  qualityCatalog,
  qualityParameter
} from '../storage.js';
import { buildReferenceMaps, productName, stageLabel, qs, cell, actionButton, emptyState } from './quality-utils.js';

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
    opt.textContent = `${plan.plan_name} · ${stageLabel(plan.applicable_stage)}`;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

export function renderPlansList(){
  const container = qs('plans-list');
  if(!container) return;
  container.innerHTML = '';
  const plans = loadCollection('quality_inspection_plans');
  const maps = buildReferenceMaps();
  const isEmpty = plans.length === 0;
  emptyState(container, 'Aún no existen planes de inspección.', isEmpty);
  if(isEmpty) return;

  plans.forEach(plan => {
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
    const product = document.createElement('span');
    product.className = 'muted';
    product.textContent = productName(maps, plan.product_id);
    head.appendChild(product);
    item.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'muted plan-meta';
    const criteriaCount = planCriteria(plan.inspection_plan_id).length;
    const locked = plan.is_locked || planHasInspections(plan.inspection_plan_id);
    meta.textContent = `${criteriaCount} criterio(s) · ${isPlanEnabled(plan.inspection_plan_id) ? 'Habilitado' : 'Sin criterios'} · ${locked ? 'Bloqueado por historial' : 'Editable'}`;
    item.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.appendChild(actionButton('Editar', 'secondary', { planEdit: plan.id }));
    actions.appendChild(actionButton('Criterios', 'secondary', { planCriteria: plan.inspection_plan_id }));
    actions.appendChild(actionButton('Duplicar', 'secondary', { planDuplicate: plan.id }));
    const del = actionButton('Eliminar', 'danger', { planDelete: plan.id });
    del.disabled = locked;
    actions.appendChild(del);
    item.appendChild(actions);

    container.appendChild(item);
  });
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

  const criteria = planCriteria(planId);
  const isEmpty = criteria.length === 0;
  emptyState(container, 'El plan todavía no tiene criterios. Agrega al menos uno para habilitarlo.', isEmpty);
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
    const edit = actionButton('Editar', 'secondary', { criterionEdit: criterion.id });
    edit.disabled = Boolean(criterion.is_locked);
    actions.appendChild(edit);
    const del = actionButton('Eliminar', 'danger', { criterionDelete: criterion.id });
    del.disabled = Boolean(criterion.is_locked);
    actions.appendChild(del);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
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
  const id = qs('plan-id').value;
  const payload = collectPlanPayload();
  const check = validateInspectionPlan(payload);
  showPlanErrors(check.errors);
  if(!check.valid) return;
  try{
    if(id) updatePlan(id, payload);
    else addPlan(payload);
    clearPlanForm();
    renderPlanConfig();
  }catch(error){
    qs('plan-action-error').textContent = error.message;
  }
}

function handleCriterionSubmit(event){
  event.preventDefault();
  const planId = qs('criteria-plan').value;
  if(!planId){
    showCriterionErrors({ inspection_plan_id: 'Selecciona un plan antes de agregar criterios' });
    return;
  }
  const id = qs('criteria-id').value;
  const payload = collectCriterionPayload();
  const check = validateCriterion(payload);
  showCriterionErrors(check.errors);
  if(!check.valid) return;
  try{
    if(id) updateCriterion(id, payload);
    else addCriterion(payload);
    clearCriterionForm();
    renderPlanConfig();
  }catch(error){
    qs('criteria-action-error').textContent = error.message;
  }
}

function handlePlansListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  qs('plan-action-error').textContent = '';
  const plans = loadCollection('quality_inspection_plans');
  if(button.dataset.planEdit){
    const plan = plans.find(p => p.id === button.dataset.planEdit);
    if(plan) startPlanEdit(plan);
    return;
  }
  if(button.dataset.planCriteria){
    qs('criteria-plan').value = button.dataset.planCriteria;
    renderCriteriaList();
    return;
  }
  if(button.dataset.planDuplicate){
    try{
      duplicatePlan(button.dataset.planDuplicate);
      renderPlanConfig();
    }catch(error){
      qs('plan-action-error').textContent = error.message;
    }
    return;
  }
  if(button.dataset.planDelete){
    if(!confirm('¿Eliminar este plan y sus criterios?')) return;
    try{
      deletePlan(button.dataset.planDelete);
      clearPlanForm();
      renderPlanConfig();
    }catch(error){
      qs('plan-action-error').textContent = error.message;
    }
  }
}

function handleCriteriaListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  qs('criteria-action-error').textContent = '';
  const criteria = loadCollection('quality_inspection_criteria');
  if(button.dataset.criterionEdit){
    const criterion = criteria.find(c => c.id === button.dataset.criterionEdit);
    if(criterion) startCriterionEdit(criterion);
    return;
  }
  if(button.dataset.criterionDelete){
    if(!confirm('¿Eliminar este criterio?')) return;
    try{
      deleteCriterion(button.dataset.criterionDelete);
      clearCriterionForm();
      renderPlanConfig();
    }catch(error){
      qs('criteria-action-error').textContent = error.message;
    }
  }
}

export function initPlanConfig(){
  const form = qs('plan-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
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
