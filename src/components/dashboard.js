import { getConfig } from '../module-config.js';
import {
  loadEntities,
  loadDocuments,
  loadCollection,
  isCapaOverdue,
  addAlertRule,
  updateAlertRule,
  deleteAlertRule,
  deriveAlerts,
  findAuditEntries
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
import {
  approvalRate,
  capaEffectiveness,
  isPendingCapaClosure,
  isPendingReview,
  isLegacyConditionalInspection,
  isReviewableInspection
} from '../quality-status.js';
import { can } from '../permissions.js';
import { renderStatusBadge } from './status-badge.js';
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

function dashboardRole(){
  const select = qs('quality-role') || qs('quality-settings-role');
  const selected = select ? select.value : '';
  if(selected) return selected;
  try{ return localStorage.getItem(QUALITY_ROLE_KEY) || 'jefe_calidad'; }catch{ return 'jefe_calidad'; }
}

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
  const documents = loadCollection('quality_documents');

  const completed = inspections.filter(inspection => {
    const status = inspection.inspection_status || inspection.status;
    const result = inspection.overall_result || inspection.overallResult;
    return status === 'completed' && ['passed', 'conditional', 'failed'].includes(result)
      && !isLegacyConditionalInspection(inspection);
  });
  const drafts = inspections.filter(inspection => {
    const status = inspection.inspection_status || inspection.status;
    return status === 'draft' || isPendingReview(inspection);
  });
  const openNcs = ncs.filter(nc => nc.status === 'open' || nc.status === 'under_review');
  const overdueCapas = capas.filter(action => isCapaOverdue(action));
  const pendingCapas = capas.filter(action => isPendingCapaClosure(action));
  const pendingDocuments = documents.filter(doc => doc.status === 'pending_review');
  const recentActivity = findAuditEntries()
    .slice()
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    .slice(0, 8);

  const approvalByStage = new Map();
  completed.forEach(inspection => {
    const plan = planById.get(inspection.inspection_plan_id);
    const stage = plan ? plan.applicable_stage : 'unknown';
    const entry = approvalByStage.get(stage) || { total: 0, passed: 0 };
    entry.total += 1;
    if((inspection.overall_result || inspection.overallResult) === 'passed') entry.passed += 1;
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
    documents,
    openNcs,
    overdueCapas,
    pendingCapas,
    pendingDocuments,
    recentActivity,
    approvalRate: approvalRate(inspections),
    capaEffectiveness: capaEffectiveness(capas),
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
    pending_inspections: metrics.drafts.length,
    final_inspections: metrics.completed.length,
    pending_capa: metrics.pendingCapas.length,
    pending_documents: metrics.pendingDocuments.length
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
  rows.push(['Cierres CAPA pendientes', metrics.pendingCapas.length]);
  rows.push(['Eficacia CAPA', `${metrics.capaEffectiveness}%`]);
  rows.push(['Inspecciones pendientes', metrics.drafts.length]);
  rows.push(['Dictámenes finales', metrics.completed.length]);
  rows.push(['Documentos pendientes', metrics.pendingDocuments.length]);
  return rowsToCsv(rows);
}

export function exportDashboardCsv(){
  const error = qs('dashboard-export-error');
  if(error) error.textContent = '';
  if(!can(dashboardRole(), 'export_reports')){
    if(error) error.textContent = 'No tienes permiso para exportar los KPIs.';
    return null;
  }
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
    actions.appendChild(actionButton('Editar', 'secondary', { alertEdit: rule.id, permission: 'configure_alerts' }));
    actions.appendChild(actionButton(
      rule.is_active !== false ? 'Desactivar' : 'Activar',
      'secondary',
      { alertToggle: rule.id, permission: 'configure_alerts' }
    ));
    actions.appendChild(actionButton('Eliminar', 'danger', { alertDelete: rule.id, permission: 'configure_alerts' }));
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
  const bars = document.createElement('div');
  bars.className = 'severity-bars';
  const max = Math.max(1, ...entries.map(([, count]) => count));
  const keys = ['critical', 'major', 'minor'];
  entries.forEach(([label, count], index) => {
    const row = document.createElement('div');
    row.className = 'severity-bar-row';
    row.dataset.severity = keys[index];
    const name = document.createElement('span');
    name.textContent = label;
    const track = document.createElement('span');
    track.className = 'severity-bar-track';
    const fill = document.createElement('span');
    fill.className = 'severity-bar-fill';
    fill.style.width = `${Math.round((count / max) * 100)}%`;
    track.appendChild(fill);
    const value = document.createElement('strong');
    value.textContent = String(count);
    row.append(name, track, value);
    bars.appendChild(row);
  });
  container.appendChild(bars);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgNode(name, attributes){
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function renderTrendChart(metrics){
  const container = qs('quality-trend');
  if(!container) return;
  if(metrics.completed.length === 0){
    clearAndMessage(container, 'Sin inspecciones completadas para mostrar la tendencia.');
    return;
  }
  resetContainer(container);
  const today = new Date(`${todayIso()}T00:00:00`);
  const months = [];
  for(let offset = 5; offset >= 0; offset -= 1){
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('es', { month: 'short' }).replace('.', '')
    });
  }
  const counts = months.map(month => metrics.completed.filter(inspection =>
    String(inspection.inspection_date || '').slice(0, 7) === month.key).length);
  const max = Math.max(1, ...counts);
  const left = 28;
  const right = 330;
  const top = 12;
  const bottom = 110;
  const xFor = index => left + (index * (right - left)) / (months.length - 1);
  const yFor = value => bottom - (value / max) * (bottom - top);

  const svg = svgNode('svg', { viewBox: '0 0 340 140', role: 'img', 'aria-label': 'Inspecciones completadas por mes en los últimos seis meses' });
  const defs = svgNode('defs', {});
  const gradient = svgNode('linearGradient', { id: 'trendFill', x1: '0', y1: '0', x2: '0', y2: '1' });
  gradient.appendChild(svgNode('stop', { offset: '0%', 'stop-color': '#93c5fd', 'stop-opacity': '0.55' }));
  gradient.appendChild(svgNode('stop', { offset: '100%', 'stop-color': '#93c5fd', 'stop-opacity': '0' }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  [max, Math.round(max / 2), 0].forEach((value, index) => {
    const y = top + (index * (bottom - top)) / 2;
    svg.appendChild(svgNode('line', { x1: left, y1: y, x2: right, y2: y, class: 'grid-line' }));
    const label = svgNode('text', { x: 20, y: y + 3, class: 'axis-label', 'text-anchor': 'end' });
    label.textContent = String(value);
    svg.appendChild(label);
  });

  const points = counts.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ');
  svg.appendChild(svgNode('polygon', {
    points: `${left},${bottom} ${points} ${right},${bottom}`,
    class: 'trend-area'
  }));
  svg.appendChild(svgNode('polyline', { points, class: 'trend-line' }));

  counts.forEach((value, index) => {
    svg.appendChild(svgNode('circle', { cx: xFor(index), cy: yFor(value), r: 3.5, class: 'trend-dot' }));
    const label = svgNode('text', {
      x: xFor(index),
      y: 128,
      class: 'axis-label',
      'text-anchor': 'middle'
    });
    label.textContent = months[index].label;
    svg.appendChild(label);
  });
  container.appendChild(svg);
}

function renderVerdictDistribution(metrics){
  const donut = qs('quality-verdict-donut');
  if(!donut) return;
  const total = metrics.completed.length;
  const passed = metrics.completed.filter(i => i.overall_result === 'passed').length;
  const conditional = metrics.completed.filter(i => i.overall_result === 'conditional').length;
  const failed = metrics.completed.filter(i => i.overall_result === 'failed').length;
  setKpi('quality-donut-total', String(total));
  setKpi('quality-verdict-passed', String(passed));
  setKpi('quality-verdict-conditional', String(conditional));
  setKpi('quality-verdict-failed', String(failed));
  if(total){
    const first = (passed / total) * 100;
    const second = ((passed + conditional) / total) * 100;
    donut.style.background = `conic-gradient(#16a34a 0% ${first}%, #f59e0b ${first}% ${second}%, #dc2626 ${second}% 100%)`;
    donut.setAttribute('aria-label', `Aprobadas: ${passed}, condicionales: ${conditional}, reprobadas: ${failed}`);
  } else {
    donut.style.background = '#e9eef7';
    donut.setAttribute('aria-label', 'Sin inspecciones completadas');
  }
}

function renderRecentActivity(metrics){
  const container = qs('quality-recent-activity');
  if(!container) return;
  container.replaceChildren();
  if(metrics.recentActivity.length === 0){
    container.className = 'empty';
    container.textContent = 'Sin actividad registrada.';
    return;
  }
  container.className = 'recent-activity-list';
  metrics.recentActivity.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'recent-activity-item';
    const status = entry.action === 'delete' ? 'rejected' : entry.action === 'status_change' ? 'pending' : 'approved';
    item.appendChild(renderStatusBadge(status, { compact: true, icon: false }));
    const text = document.createElement('span');
    text.textContent = `${entry.entity_type || 'registro'} · ${entry.action || 'acción'} · ${entry.actor || 'sistema'} · ${entry.timestamp || '—'}`;
    item.appendChild(text);
    container.appendChild(item);
  });
}

function renderQuickActions(){
  const host = qs('quality-quick-actions');
  if(!host) return;
  const role = dashboardRole();
  const definitions = {
    jefe_calidad: [
      ['Aprobaciones pendientes', 'quality-approvals', 'view_approval_queues'],
      ['Revisión de inspecciones', 'quality-inspections', 'review_inspection'],
      ['Cierres CAPA', 'quality-capa', 'review_capa_closure'],
      ['Reportes', 'quality-reports', 'view_reports']
    ],
    inspector: [
      ['Lotes pendientes', 'pending-lots', 'execute_inspection'],
      ['Ejecución de inspección', 'quality-inspections', 'execute_inspection'],
      ['Listas aprobadas', 'quality-checklists', 'view_reports'],
      ['Registro de NC/CAPA', 'quality-non-conformances', 'create_non_conformance']
    ],
    gerente: [
      ['Dashboard', 'quality-dashboard', 'view_dashboard'],
      ['Historial', 'quality-history', 'view_history'],
      ['Reportes', 'quality-reports', 'view_reports'],
      ['Bitácora', 'quality-audit-log', 'view_audit']
    ]
  };
  host.replaceChildren();
  (definitions[role] || definitions.jefe_calidad).forEach(([label, view, permission]) => {
    if(!can(role, permission)) return;
    const button = actionButton(label, 'secondary', { qualityTarget: view, permission });
    host.appendChild(button);
  });
  if(host.children.length === 0){
    host.className = 'quality-shortcuts empty';
    host.textContent = 'No hay accesos rápidos disponibles para este rol.';
    return;
  }
  host.className = 'quality-shortcuts';
}

function renderOperationalSummary(){
  const plans = loadCollection('quality_inspection_plans').filter(item => item.status === 'pending_approval').length;
  const checklists = loadCollection('quality_checklists').filter(item => item.status === 'pending_approval').length;
  const inspections = loadCollection('quality_inspections').filter(isReviewableInspection).length;
  const capas = loadCollection('corrective_actions').filter(item => isPendingCapaClosure(item) || isCapaOverdue(item)).length;
  const approvals = plans + checklists + inspections + capas;
  setKpi('quality-summary-approvals-value', String(approvals));
  setKpi('quality-summary-inspections-value', String(inspections));
  setKpi('quality-summary-capa-value', String(capas));
  setKpi('quality-summary-nc-value', String(loadCollection('non_conformances').filter(item => item.status === 'open' || item.status === 'under_review').length));
}

export function renderQualityDashboard(){
  const role = dashboardRole();
  const metrics = qualityMetrics();
  setKpi('kpi-approval-rate', `${metrics.approvalRate}%`);
  setKpi('kpi-open-nc', String(metrics.openNcs.length));
  setKpi('kpi-overdue-capa', String(metrics.overdueCapas.length));
  setKpi('kpi-capa-effectiveness', `${metrics.capaEffectiveness}%`);
  setKpi('kpi-pending-inspections', String(metrics.drafts.length));
  setKpi('kpi-final-inspections', String(metrics.completed.length));
  setKpi('kpi-pending-capa', String(metrics.pendingCapas.length));
  setKpi('kpi-pending-documents', String(metrics.pendingDocuments.length));
  renderOperationalSummary();
  renderRecentActivity(metrics);
  renderQuickActions();

  renderApprovalByStage(metrics);
  renderNcBySeverity(metrics);
  renderVerdictDistribution(metrics);
  renderTrendChart(metrics);
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
  const dashboardRoles = {
    jefe_calidad: { label: 'Jefe de Calidad', initials: 'JC' },
    inspector: { label: 'Inspector de Calidad', initials: 'IN' },
    gerente: { label: 'Gerente de Operaciones', initials: 'GO' }
  };
  const meta = dashboardRoles[role] || dashboardRoles.jefe_calidad;
  const topbarRole = qs('topbar-role');
  const topbarAvatar = qs('topbar-avatar');
  if(topbarRole) topbarRole.textContent = meta.label;
  if(topbarAvatar) topbarAvatar.textContent = meta.initials;
  const welcome = qs('quality-welcome');
  if(welcome) welcome.textContent = `Bienvenido, ${meta.label}. Consulta el estado del sistema de calidad.`;
  const chip = qs('quality-active-role');
  if(chip) chip.textContent = meta.label;
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
