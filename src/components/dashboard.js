import { getConfig } from '../module-config.js';
import {
  loadEntities,
  loadDocuments,
  loadCollection,
  isCapaOverdue,
  addAlertRule,
  updateAlertRule,
  deleteAlertRule,
  deriveAlerts
} from '../storage.js';
import {
  qs,
  stageLabel,
  buildReferenceMaps,
  productName,
  employeeName,
  todayIso,
  actionButton
} from './quality-utils.js';
import { rowsToCsv, downloadContent, safeFilenamePart } from './csv.js';

const ALERT_METRIC_LABELS = Object.freeze({
  approval_rate: 'Tasa de aprobación',
  open_non_conformances: 'No conformidades abiertas',
  overdue_capa: 'Acciones CAPA vencidas',
  capa_effectiveness: 'Eficacia CAPA',
  pending_inspections: 'Inspecciones pendientes'
});

const ALERT_OPERATOR_LABELS = Object.freeze({
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  eq: '='
});

const ALERT_SEVERITY_LABELS = Object.freeze({
  info: 'Informativa',
  warning: 'Advertencia',
  critical: 'Crítica'
});

function alertMetricLabel(metric){
  return ALERT_METRIC_LABELS[metric] || metric || '';
}

function alertOperatorLabel(operator){
  return ALERT_OPERATOR_LABELS[operator] || operator || '';
}

function alertSeverityLabel(severity){
  return ALERT_SEVERITY_LABELS[severity] || severity || '';
}

export function recordCounts(){
  return {
    entities: loadEntities().length,
    documents: loadDocuments().length
  };
}

export function renderDashboard(){
  const counts = recordCounts();
  const labels = getConfig().labels;

  const entitiesValue = document.getElementById('stat-entities');
  if(entitiesValue) entitiesValue.textContent = String(counts.entities);
  const documentsValue = document.getElementById('stat-documents');
  if(documentsValue) documentsValue.textContent = String(counts.documents);

  const entitiesLabel = document.getElementById('stat-entities-label');
  if(entitiesLabel) entitiesLabel.textContent = labels.entities;
  const documentsLabel = document.getElementById('stat-documents-label');
  if(documentsLabel) documentsLabel.textContent = labels.documents;
}

// ============================================================================
// Dashboard de Control de Calidad
// ============================================================================

const QUALITY_ROLE_KEY = 'erp_quality:viewer_role';

function setKpi(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function clearAndMessage(container, message){
  if(!container) return;
  container.innerHTML = '';
  container.classList.add('empty');
  container.textContent = message;
}

function resetContainer(container){
  if(!container) return;
  container.innerHTML = '';
  container.classList.remove('empty');
}

function groupCounts(records, keyFn){
  const counts = new Map();
  records.forEach(record => {
    const key = keyFn(record);
    if(key === undefined || key === null || key === '') return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderRanking(container, entries, labelFn, emptyMessage){
  if(!container) return;
  if(entries.length === 0){
    clearAndMessage(container, emptyMessage);
    return;
  }
  resetContainer(container);
  const max = entries[0][1] || 1;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  entries.forEach(([key, count]) => {
    const row = document.createElement('div');
    row.className = 'pareto-row';

    const label = document.createElement('span');
    label.className = 'pareto-label';
    label.textContent = labelFn(key);
    row.appendChild(label);

    const barWrap = document.createElement('span');
    barWrap.className = 'pareto-bar-wrap';
    const bar = document.createElement('span');
    bar.className = 'pareto-bar';
    bar.style.width = `${Math.max(4, Math.round((count / max) * 100))}%`;
    barWrap.appendChild(bar);
    row.appendChild(barWrap);

    const value = document.createElement('span');
    value.className = 'pareto-value';
    const pct = total ? Math.round((count / total) * 100) : 0;
    value.textContent = `${count} (${pct}%)`;
    row.appendChild(value);

    container.appendChild(row);
  });
}

export function qualityMetrics(){
  const inspections = loadCollection('quality_inspections');
  const plans = loadCollection('quality_inspection_plans');
  const planById = new Map(plans.map(p => [p.inspection_plan_id, p]));
  const ncs = loadCollection('non_conformances');
  const capas = loadCollection('corrective_actions');

  const completed = inspections.filter(i => i.inspection_status === 'completed');
  const passed = completed.filter(i => i.overall_result === 'passed');
  const drafts = inspections.filter(i => i.inspection_status === 'draft');
  const openNcs = ncs.filter(nc => nc.status === 'open' || nc.status === 'under_review');
  const overdueCapas = capas.filter(action => isCapaOverdue(action));
  const completedCapas = capas.filter(action => action.status === 'completed');
  const onTimeCapas = completedCapas.filter(action => {
    const completedAt = action.completed_at || action.updatedAt;
    if(!completedAt) return false;
    return String(completedAt).slice(0, 10) <= action.due_date;
  });

  const approvalByStage = new Map();
  completed.forEach(inspection => {
    const plan = planById.get(inspection.inspection_plan_id);
    const stage = plan ? plan.applicable_stage : 'unknown';
    const entry = approvalByStage.get(stage) || { total: 0, passed: 0 };
    entry.total += 1;
    if(inspection.overall_result === 'passed') entry.passed += 1;
    approvalByStage.set(stage, entry);
  });

  const ncBySeverity = { critical: 0, major: 0, minor: 0 };
  openNcs.forEach(nc => {
    if(ncBySeverity[nc.severity] !== undefined) ncBySeverity[nc.severity] += 1;
  });

  const paretoByProduct = groupCounts(ncs, nc => nc.product_id);
  const inspectionById = new Map(inspections.map(i => [i.inspection_id, i]));
  const paretoByStage = groupCounts(ncs, nc => {
    const inspection = inspectionById.get(nc.inspection_id);
    if(!inspection) return null;
    const plan = planById.get(inspection.inspection_plan_id);
    return plan ? plan.applicable_stage : null;
  });

  return {
    inspections,
    completed,
    drafts,
    ncs,
    capas,
    openNcs,
    overdueCapas,
    completedCapas,
    onTimeCapas,
    approvalRate: completed.length ? Math.round((passed.length / completed.length) * 1000) / 10 : 0,
    capaEffectiveness: completedCapas.length ? Math.round((onTimeCapas.length / completedCapas.length) * 1000) / 10 : 0,
    approvalByStage,
    ncBySeverity,
    paretoByProduct,
    paretoByStage,
    planById
  };
}

export function kpiValues(metrics){
  return {
    approval_rate: metrics.approvalRate,
    open_non_conformances: metrics.openNcs.length,
    overdue_capa: metrics.overdueCapas.length,
    capa_effectiveness: metrics.capaEffectiveness,
    pending_inspections: metrics.drafts.length
  };
}

export function buildDashboardCsv(metrics){
  const rows = [['Indicador', 'Valor']];
  rows.push(['Tasa de aprobación global', `${metrics.approvalRate}%`]);
  [...metrics.approvalByStage.entries()].forEach(([stage, entry]) => {
    const value = entry.total ? Math.round((entry.passed / entry.total) * 1000) / 10 : 0;
    rows.push([`Tasa de aprobación - ${stageLabel(stage)}`, `${value}%`]);
  });
  rows.push(['No conformidades abiertas - Crítica', metrics.ncBySeverity.critical]);
  rows.push(['No conformidades abiertas - Mayor', metrics.ncBySeverity.major]);
  rows.push(['No conformidades abiertas - Menor', metrics.ncBySeverity.minor]);
  rows.push(['Acciones CAPA vencidas', metrics.overdueCapas.length]);
  rows.push(['Eficacia CAPA', `${metrics.capaEffectiveness}%`]);
  rows.push(['Inspecciones pendientes', metrics.drafts.length]);
  return rowsToCsv(rows);
}

export function exportDashboardCsv(){
  const error = qs('dashboard-export-error');
  if(error) error.textContent = '';
  const metrics = qualityMetrics();
  const hasData = metrics.completed.length > 0
    || metrics.ncs.length > 0
    || metrics.capas.length > 0
    || metrics.drafts.length > 0;
  if(!hasData){
    if(error) error.textContent = 'No hay datos de calidad para exportar.';
    return null;
  }
  const content = buildDashboardCsv(metrics);
  const filename = `calidad_kpis_${safeFilenamePart(todayIso())}.csv`;
  try{
    downloadContent(content, filename);
  }catch(err){
    if(error) error.textContent = err.message;
    return null;
  }
  return content;
}

function showAlertError(message){
  const error = qs('alert-error');
  if(error) error.textContent = message || '';
}

function collectAlertPayload(){
  return {
    metric: qs('alert-metric').value,
    operator: qs('alert-operator').value,
    threshold: qs('alert-threshold').value,
    severity: qs('alert-severity').value,
    is_active: qs('alert-active').checked
  };
}

export function resetAlertForm(){
  qs('alert-id').value = '';
  qs('alert-metric').value = 'approval_rate';
  qs('alert-operator').value = 'lt';
  qs('alert-threshold').value = '';
  qs('alert-severity').value = 'warning';
  qs('alert-active').checked = true;
  qs('alert-cancel').hidden = true;
  showAlertError('');
}

function startAlertEdit(rule){
  qs('alert-id').value = rule.id;
  qs('alert-metric').value = rule.metric;
  qs('alert-operator').value = rule.operator;
  qs('alert-threshold').value = rule.threshold;
  qs('alert-severity').value = rule.severity;
  qs('alert-active').checked = rule.is_active !== false;
  qs('alert-cancel').hidden = false;
  showAlertError('');
  qs('alert-threshold').focus();
}

function renderAlerts(metrics){
  const container = qs('quality-alerts');
  if(!container) return;
  const alerts = deriveAlerts(kpiValues(metrics));
  if(alerts.length === 0){
    clearAndMessage(container, 'Sin alertas: todas las reglas activas se cumplen o no hay reglas configuradas.');
    return;
  }
  resetContainer(container);
  alerts.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'alert-item';
    const badge = document.createElement('span');
    badge.className = `status-badge badge-${rule.severity}`;
    badge.textContent = alertSeverityLabel(rule.severity);
    item.appendChild(badge);
    const text = document.createElement('span');
    text.textContent = `${alertMetricLabel(rule.metric)}: ${rule.value} ${alertOperatorLabel(rule.operator)} ${rule.threshold}`;
    item.appendChild(text);
    container.appendChild(item);
  });
}

function renderAlertRules(){
  const container = qs('alert-rule-list');
  if(!container) return;
  container.innerHTML = '';
  const rules = loadCollection('quality_alert_rules');
  if(rules.length === 0){
    container.className = 'empty';
    container.textContent = 'No hay reglas de alerta configuradas.';
    return;
  }
  container.className = '';
  rules.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'alert-rule-item';

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${alertMetricLabel(rule.metric)} ${alertOperatorLabel(rule.operator)} ${rule.threshold}`;
    info.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = `${alertSeverityLabel(rule.severity)} · ${rule.is_active !== false ? 'Activa' : 'Inactiva'}`;
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'table-actions';
    actions.appendChild(actionButton('Editar', 'secondary', { alertEdit: rule.id }));
    actions.appendChild(actionButton(
      rule.is_active !== false ? 'Desactivar' : 'Activar',
      'secondary',
      { alertToggle: rule.id }
    ));
    actions.appendChild(actionButton('Eliminar', 'danger', { alertDelete: rule.id }));
    item.appendChild(actions);
    container.appendChild(item);
  });
}

function handleAlertSubmit(event){
  event.preventDefault();
  const id = qs('alert-id').value;
  const payload = collectAlertPayload();
  try{
    if(id) updateAlertRule(id, payload);
    else addAlertRule(payload);
    resetAlertForm();
    renderQualityDashboard();
  }catch(err){
    showAlertError(err.message);
  }
}

function handleAlertRuleClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const rules = loadCollection('quality_alert_rules');
  if(button.dataset.alertEdit){
    const rule = rules.find(item => item.id === button.dataset.alertEdit);
    if(rule) startAlertEdit(rule);
    return;
  }
  if(button.dataset.alertToggle){
    const rule = rules.find(item => item.id === button.dataset.alertToggle);
    if(!rule) return;
    try{
      updateAlertRule(rule.id, { is_active: rule.is_active === false });
      renderQualityDashboard();
    }catch(err){
      showAlertError(err.message);
    }
    return;
  }
  if(button.dataset.alertDelete){
    if(!confirm('¿Eliminar esta regla de alerta?')) return;
    try{
      deleteAlertRule(button.dataset.alertDelete);
      if(qs('alert-id').value === button.dataset.alertDelete) resetAlertForm();
      renderQualityDashboard();
    }catch(err){
      showAlertError(err.message);
    }
  }
}

export function initQualityAlerts(){
  const form = qs('alert-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
  form.addEventListener('submit', handleAlertSubmit);
  qs('alert-cancel').addEventListener('click', resetAlertForm);
  qs('alert-rule-list').addEventListener('click', handleAlertRuleClick);
  const exportButton = qs('dashboard-export');
  if(exportButton) exportButton.addEventListener('click', () => exportDashboardCsv());
}

function renderApprovalByStage(metrics){
  const container = qs('quality-approval-by-stage');
  if(!container) return;
  if(metrics.approvalByStage.size === 0){
    clearAndMessage(container, 'Sin inspecciones completadas.');
    return;
  }
  resetContainer(container);
  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Etapa', 'Completadas', 'Aprobadas', 'Tasa'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  [...metrics.approvalByStage.entries()].forEach(([stage, entry]) => {
    const tr = document.createElement('tr');
    [stageLabel(stage), entry.total, entry.passed, `${entry.total ? Math.round((entry.passed / entry.total) * 1000) / 10 : 0}%`]
      .forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderNcBySeverity(metrics){
  const container = qs('quality-nc-by-severity');
  if(!container) return;
  const entries = [
    ['Crítica', metrics.ncBySeverity.critical, 'badge-critical'],
    ['Mayor', metrics.ncBySeverity.major, 'badge-major'],
    ['Menor', metrics.ncBySeverity.minor, 'badge-minor']
  ];
  if(metrics.openNcs.length === 0){
    clearAndMessage(container, 'Sin no conformidades abiertas.');
    return;
  }
  resetContainer(container);
  entries.forEach(([label, count, className]) => {
    const badge = document.createElement('span');
    badge.className = `status-badge ${className}`;
    badge.textContent = `${label}: ${count}`;
    container.appendChild(badge);
    container.appendChild(document.createTextNode(' '));
  });
}

export function renderQualityDashboard(){
  const roleSelect = qs('quality-role');
  if(roleSelect){
    const stored = localStorage.getItem(QUALITY_ROLE_KEY);
    if(stored) roleSelect.value = stored;
    roleSelect.onchange = () => {
      localStorage.setItem(QUALITY_ROLE_KEY, roleSelect.value);
      renderQualityDashboard();
    };
  }

  const metrics = qualityMetrics();
  setKpi('kpi-approval-rate', `${metrics.approvalRate}%`);
  setKpi('kpi-open-nc', String(metrics.openNcs.length));
  setKpi('kpi-overdue-capa', String(metrics.overdueCapas.length));
  setKpi('kpi-capa-effectiveness', `${metrics.capaEffectiveness}%`);
  setKpi('kpi-pending-inspections', String(metrics.drafts.length));

  renderApprovalByStage(metrics);
  renderNcBySeverity(metrics);
  renderAlerts(metrics);
  renderAlertRules();

  const maps = buildReferenceMaps();
  renderRanking(
    qs('quality-pareto-product'),
    metrics.paretoByProduct,
    productId => productName(maps, productId),
    'Sin no conformidades registradas.'
  );
  renderRanking(
    qs('quality-pareto-stage'),
    metrics.paretoByStage,
    stage => stageLabel(stage),
    'Sin no conformidades registradas.'
  );

  const detail = qs('quality-inspector-detail');
  const role = roleSelect ? roleSelect.value : 'jefe_calidad';
  if(role !== 'jefe_calidad'){
    clearAndMessage(detail, 'El detalle individual por inspector está restringido al rol de Jefatura de Calidad. Se muestran solo métricas agregadas.');
    return metrics;
  }
  const entries = groupCounts(metrics.completed, inspection => inspection.inspector_id);
  if(entries.length === 0){
    clearAndMessage(detail, 'Sin inspecciones completadas por inspector.');
    return metrics;
  }
  resetContainer(detail);
  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Inspector', 'Completadas', 'Aprobadas', 'Reprobadas', 'Condicionales'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  entries.forEach(([inspectorId]) => {
    const rows = metrics.completed.filter(i => i.inspector_id === inspectorId);
    const tr = document.createElement('tr');
    [
      employeeName(maps, inspectorId),
      rows.length,
      rows.filter(i => i.overall_result === 'passed').length,
      rows.filter(i => i.overall_result === 'failed').length,
      rows.filter(i => i.overall_result === 'conditional').length
    ].forEach(value => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  detail.appendChild(table);
  return metrics;
}
