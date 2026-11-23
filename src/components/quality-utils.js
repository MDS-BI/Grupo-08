import { loadCollection, loadExternal, qualityCatalogLabels } from '../storage.js';

export function qs(id){ return document.getElementById(id); }

export function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const MODULE_LABELS = Object.freeze({
  goods_receipt: 'Recepción',
  production_order: 'Orden de producción',
  shipment: 'Despacho'
});

export const STAGE_LABELS = Object.freeze({
  incoming: 'Recepción',
  in_process: 'En proceso',
  final: 'Final'
});

export const RESULT_LABELS = Object.freeze({
  passed: 'Aprobado',
  failed: 'Reprobado',
  conditional: 'Condicional'
});

export const STATUS_LABELS = Object.freeze({
  draft: 'Borrador',
  completed: 'Completada'
});

export function moduleLabel(module){
  return MODULE_LABELS[module] || module || '';
}

export function stageLabel(stage){
  return qualityCatalogLabels('inspection_categories')[stage] || STAGE_LABELS[stage] || stage || '';
}

export function resultLabel(result){
  return RESULT_LABELS[result] || result || '';
}

export function statusLabel(status){
  return qualityCatalogLabels('inspection_statuses')[status] || STATUS_LABELS[status] || status || '';
}

export function todayIso(){
  return new Date().toISOString().slice(0, 10);
}

export function buildReferenceMaps(){
  const products = new Map(loadExternal('products').map(p => [p.product_id, p]));
  const employees = new Map(loadExternal('employees').map(e => [e.employee_id, e]));
  const plans = new Map(loadCollection('quality_inspection_plans').map(p => [p.inspection_plan_id, p]));
  const criteria = new Map(loadCollection('quality_inspection_criteria').map(c => [c.criteria_id, c]));
  return { products, employees, plans, criteria };
}

export function productName(maps, productId){
  const product = maps.products.get(productId);
  return product ? product.name : productId || '—';
}

export function employeeName(maps, employeeId){
  const employee = maps.employees.get(employeeId);
  return employee ? employee.name : employeeId || '—';
}

export function planName(maps, planId){
  const plan = maps.plans.get(planId);
  return plan ? plan.plan_name : planId || '—';
}

export function referenceLabel(module, referenceId){
  return `${moduleLabel(module)} · ${referenceId || '—'}`;
}

export function clearChildren(container){
  if(container) container.innerHTML = '';
}

export function cell(text, className){
  const td = document.createElement('td');
  td.textContent = text === undefined || text === null ? '' : String(text);
  if(className) td.className = className;
  return td;
}

export function actionButton(label, className, dataset){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  if(className) btn.className = className;
  if(dataset) Object.assign(btn.dataset, dataset);
  return btn;
}

export function emptyState(container, message, isEmpty){
  if(!container) return;
  container.textContent = message;
  container.hidden = !isEmpty;
}
