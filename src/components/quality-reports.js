import {
  DEFECT_TYPES,
  findAuditEntries,
  getActiveRole,
  loadCollection,
  loadExternal,
  qualityCatalog,
  qualityParameter
} from '../storage.js';
import { applyPermissionState } from '../permissions.js';
import { employeeName, qs } from './quality-utils.js';
import { rowsToCsv, downloadContent, safeFilenamePart } from './csv.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MONTH_LABELS = Object.freeze(['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']);

const CATEGORY_LABELS = Object.freeze({
  dimensional: 'Dimensional',
  functional: 'Funcional',
  packaging: 'Embalaje',
  other: 'Otra'
});

const RESULT_META = Object.freeze({
  passed: { label: 'Aprobado', className: 'rep-result-passed', color: '#16a34a' },
  conditional: { label: 'Condicional', className: 'rep-result-conditional', color: '#f59e0b' },
  failed: { label: 'Rechazado', className: 'rep-result-failed', color: '#dc2626' }
});

function svgNode(name, attributes){
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function round1(value){
  return Math.round((Number(value) || 0) * 10) / 10;
}

function percent(part, total){
  return total ? round1((part / total) * 100) : 0;
}

function shiftDays(iso, days){
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftedMonthStart(iso, months){
  const date = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function currentMonthEnd(iso){
  const date = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function formatDate(iso){
  if(!iso) return '—';
  const date = new Date(`${iso}T00:00:00Z`);
  if(Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

function monthKeysBetween(start, end){
  if(!start || !end) return [];
  const from = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const to = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  if(Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
  const keys = [];
  const cursor = new Date(from);
  while(cursor <= to && keys.length < 36){
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    keys.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[month]} ${String(year).slice(2)}`
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys.slice(-12);
}

function collectFilters(){
  return {
    period: qs('rep-period')?.value || 'last_12_months',
    startDate: qs('rep-start')?.value || '',
    endDate: qs('rep-end')?.value || '',
    category: qs('rep-category')?.value || '',
    inspectionType: qs('rep-type')?.value || ''
  };
}

function ensureReportStatusNodes(){
  const error = qs('rep-export-error');
  let filtersNode = qs('rep-active-filters');
  if(!filtersNode && error && error.parentNode){
    filtersNode = document.createElement('div');
    filtersNode.id = 'rep-active-filters';
    filtersNode.className = 'muted';
    filtersNode.setAttribute('aria-live', 'polite');
    error.parentNode.insertBefore(filtersNode, error.nextSibling);
  }
  let emptyNode = qs('rep-empty-state');
  const kpis = qs('rep-kpis');
  if(!emptyNode && kpis && kpis.parentNode){
    emptyNode = document.createElement('div');
    emptyNode.id = 'rep-empty-state';
    emptyNode.className = 'empty';
    emptyNode.hidden = true;
    kpis.parentNode.insertBefore(emptyNode, kpis);
  }
  return { filtersNode, emptyNode };
}

function selectedLabel(id){
  const control = qs(id);
  if(!control) return '—';
  const option = control.selectedOptions && control.selectedOptions[0];
  return option ? option.textContent.trim() : (control.value || '—');
}

function renderReportStatus(model){
  const { filtersNode, emptyNode } = ensureReportStatusNodes();
  if(filtersNode){
    const period = selectedLabel('rep-period');
    const category = model.filters.category ? (CATEGORY_LABELS[model.filters.category] || selectedLabel('rep-category')) : 'Todas';
    const type = model.filters.inspectionType ? selectedLabel('rep-type') : 'Todos';
    filtersNode.textContent = `Filtros activos: ${period} · Categoría: ${category} · Tipo: ${type} · ${model.range.label}`;
  }
  if(emptyNode){
    const isEmpty = !model.inspections.length && !model.ncs.length;
    emptyNode.hidden = !isEmpty;
    emptyNode.textContent = isEmpty
      ? 'No hay datos para los filtros seleccionados. Ajusta el período o las categorías para consultar otros resultados.'
      : '';
  }
}

function applyReportPermissions(){
  const view = qs('view-quality-reports');
  if(!view) return;
  const excel = qs('rep-export-excel');
  if(excel) excel.dataset.permission = 'export_reports';
  const pdf = qs('rep-export-pdf');
  if(pdf) pdf.dataset.permission = 'view_reports';
  applyPermissionState(view, getActiveRole());
}

function resolveRange(filters, inspections, ncs){
  const today = new Date().toISOString().slice(0, 10);
  let start;
  let end = today;
  switch(filters.period){
    case 'custom':
      start = filters.startDate || '';
      end = filters.endDate || today;
      break;
    case 'last_30_days':
      start = shiftDays(today, -29);
      break;
    case 'last_90_days':
      start = shiftDays(today, -89);
      break;
    case 'last_6_months':
      start = shiftedMonthStart(today, -5);
      end = currentMonthEnd(today);
      break;
    case 'all': {
      const dates = [
        ...inspections.map(item => item.inspection_date),
        ...ncs.map(item => item.detected_date)
      ].filter(Boolean).sort();
      start = dates[0] || shiftedMonthStart(today, -11);
      break;
    }
    default:
      start = shiftedMonthStart(today, -11);
      end = currentMonthEnd(today);
      break;
  }
  if(start && end && start > end) [start, end] = [end, start];
  return {
    start,
    end,
    label: `${formatDate(start)} — ${formatDate(end)}`
  };
}

function inRange(value, start, end){
  if(!value) return false;
  const date = String(value).slice(0, 10);
  if(start && date < start) return false;
  if(end && date > end) return false;
  return true;
}

function closeTimesById(){
  const map = new Map();
  findAuditEntries({ entity_type: 'non_conformance', action: 'status_change' })
    .filter(entry => entry.changed_field === 'status' && entry.after_value === 'closed')
    .forEach(entry => {
      const previous = map.get(entry.entity_id);
      if(!previous || entry.timestamp > previous) map.set(entry.entity_id, entry.timestamp);
    });
  return map;
}

export function computeReportModel(filters = collectFilters()){
  const allInspections = loadCollection('quality_inspections');
  const allNcs = loadCollection('non_conformances');
  const plans = loadCollection('quality_inspection_plans');
  const employees = loadExternal('employees');
  const planById = new Map(plans.map(plan => [plan.inspection_plan_id, plan]));
  const range = resolveRange(filters, allInspections, allNcs);
  const typeOf = inspection => {
    const plan = planById.get(inspection.inspection_plan_id);
    return plan ? plan.applicable_stage : '';
  };
  const inspectionById = new Map(allInspections.map(item => [item.inspection_id, item]));
  const ncType = nc => {
    const inspection = inspectionById.get(nc.inspection_id);
    return inspection ? typeOf(inspection) : '';
  };

  const inspections = allInspections.filter(inspection =>
    inRange(inspection.inspection_date, range.start, range.end)
    && (!filters.inspectionType || typeOf(inspection) === filters.inspectionType)
  );
  const ncs = allNcs.filter(nc =>
    inRange(nc.detected_date, range.start, range.end)
    && (!filters.category || nc.defect_type === filters.category)
    && (!filters.inspectionType || ncType(nc) === filters.inspectionType)
  );

  const completed = inspections.filter(item => item.inspection_status === 'completed');
  const passed = completed.filter(item => item.overall_result === 'passed');
  const conditional = completed.filter(item => item.overall_result === 'conditional');
  const failed = completed.filter(item => item.overall_result === 'failed');
  const closeTimes = closeTimesById();
  const resolutions = ncs
    .filter(nc => nc.status === 'closed')
    .map(nc => {
      const started = Date.parse(`${String(nc.detected_date).slice(0, 10)}T00:00:00Z`);
      const closed = Date.parse(closeTimes.get(nc.non_conformance_id) || nc.updatedAt || '');
      if(!Number.isFinite(started) || !Number.isFinite(closed) || closed < started) return null;
      return (closed - started) / 86400000;
    })
    .filter(value => value !== null);
  const avgResolutionDays = resolutions.length ? round1(resolutions.reduce((sum, value) => sum + value, 0) / resolutions.length) : null;

  const months = monthKeysBetween(range.start, range.end).map(month => {
    const inMonth = list => list.filter(item => String(item.inspection_date || '').slice(0, 7) === month.key);
    const monthCompleted = inMonth(completed);
    const monthPassed = monthCompleted.filter(item => item.overall_result === 'passed').length;
    return {
      ...month,
      registered: inMonth(inspections).length,
      completed: monthCompleted.length,
      compliance: monthCompleted.length ? percent(monthPassed, monthCompleted.length) : null
    };
  });

  const ncCount = new Map();
  ncs.forEach(nc => {
    const key = nc.defect_type || 'other';
    ncCount.set(key, (ncCount.get(key) || 0) + 1);
  });
  const ncCategories = [...ncCount.entries()]
    .map(([key, count]) => ({ key, label: CATEGORY_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const inspectorCount = new Map();
  inspections.forEach(inspection => {
    const key = inspection.inspector_id || '';
    if(key) inspectorCount.set(key, (inspectorCount.get(key) || 0) + 1);
  });
  const inspectors = [...inspectorCount.entries()]
    .map(([key, count]) => ({ key, label: employeeName({ employees: new Map(employees.map(e => [e.employee_id, e])) }, key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    filters,
    range,
    inspections,
    ncs,
    completed,
    passed,
    conditional,
    failed,
    approvalRate: percent(passed.length, completed.length),
    rejectionRate: percent(failed.length, completed.length),
    conditionalRate: percent(conditional.length, completed.length),
    avgResolutionDays,
    months,
    ncCategories,
    inspectors,
    topNcCategory: ncCategories[0] || null,
    topInspector: inspectors[0] || null
  };
}

function populateControls(){
  const category = qs('rep-category');
  if(category){
    const current = category.value;
    const values = new Set([...DEFECT_TYPES, ...loadCollection('non_conformances').map(nc => nc.defect_type).filter(Boolean)]);
    category.innerHTML = '<option value="">Todas las categorías</option>';
    [...values].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = CATEGORY_LABELS[value] || value;
      category.appendChild(option);
    });
    if([...category.options].some(option => option.value === current)) category.value = current;
  }
  const type = qs('rep-type');
  if(type){
    const current = type.value;
    const values = qualityCatalog('inspection_categories');
    type.innerHTML = '<option value="">Todos los tipos</option>';
    values.forEach(item => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      type.appendChild(option);
    });
    if([...type.options].some(option => option.value === current)) type.value = current;
  }
  const period = qs('rep-period')?.value || 'last_12_months';
  const custom = period === 'custom';
  ['rep-start', 'rep-end'].forEach(id => {
    const input = qs(id);
    if(input) input.disabled = !custom;
  });
}

function kpi(label, value, detail, className){
  const card = document.createElement('div');
  card.className = `rep-kpi ${className}`;
  const span = document.createElement('span');
  span.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value;
  const small = document.createElement('small');
  small.textContent = detail;
  card.append(span, strong, small);
  return card;
}

function renderKpis(model){
  const container = qs('rep-kpis');
  if(!container) return;
  container.innerHTML = '';
  const items = [
    kpi('Porcentaje de aprobación', `${model.approvalRate}%`, `${model.passed.length} de ${model.completed.length} completadas`, 'approval'),
    kpi('Porcentaje de rechazo', `${model.rejectionRate}%`, `${model.failed.length} inspecciones rechazadas`, 'rejection'),
    kpi('Total de inspecciones', String(model.inspections.length), `${model.completed.length} completadas en el período`, 'inspections'),
    kpi('Total de no conformidades', String(model.ncs.length), `${model.ncs.filter(nc => nc.status === 'open' || nc.status === 'under_review').length} abiertas o en revisión`, 'ncs'),
    kpi('Tiempo promedio de resolución', model.avgResolutionDays === null ? '—' : `${model.avgResolutionDays} días`, 'Desde detección hasta cierre', 'resolution')
  ];
  items.forEach(item => container.appendChild(item));
}

function insight(title, text, tone){
  const card = document.createElement('div');
  card.className = `rep-insight ${tone}`;
  const heading = document.createElement('h3');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  card.append(heading, paragraph);
  return card;
}

function renderSummary(model){
  const container = qs('rep-summary');
  if(!container) return;
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'rep-summary-grid';
  const performance = `Se registraron ${model.inspections.length} inspecciones, de las cuales ${model.completed.length} se completaron. La aprobación fue del ${model.approvalRate}% y el rechazo del ${model.rejectionRate}%.`;
  const ncText = model.ncs.length
    ? `Se detectaron ${model.ncs.length} no conformidades. La categoría más frecuente fue ${model.topNcCategory.label} con ${model.topNcCategory.count} ${model.topNcCategory.count === 1 ? 'caso' : 'casos'}.`
    : 'No se detectaron no conformidades en el período seleccionado.';
  const operation = model.topInspector
    ? `${model.topInspector.label} registró la mayor cantidad de inspecciones (${model.topInspector.count}). El tiempo promedio de resolución fue ${model.avgResolutionDays === null ? 'no disponible' : `${model.avgResolutionDays} días`}.`
    : 'No hay inspecciones registradas por responsable en el período seleccionado.';
  grid.append(
    insight('Desempeño', performance, 'performance'),
    insight('No conformidades', ncText, 'nc'),
    insight('Operación', operation, 'operation')
  );
  container.appendChild(grid);
}

function emptyChart(container, message){
  if(!container) return;
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = message;
  container.appendChild(empty);
}

function renderLegend(container, items){
  if(!container) return;
  const legend = document.createElement('div');
  legend.className = 'rep-chart-legend';
  items.forEach(item => {
    const entry = document.createElement('span');
    const dot = document.createElement('i');
    dot.style.background = item.color;
    entry.append(dot, document.createTextNode(item.label));
    legend.appendChild(entry);
  });
  container.appendChild(legend);
}

function renderLineChart(container, config){
  if(!container || !config.months.length){
    emptyChart(container, config.emptyMessage || 'Sin datos para el período seleccionado.');
    return;
  }
  container.innerHTML = '';
  const left = 52;
  const right = 600;
  const top = 22;
  const bottom = 206;
  const max = config.max || 1;
  const xFor = index => left + (index * (right - left)) / Math.max(1, config.months.length - 1);
  const yFor = value => bottom - ((Number(value) || 0) / max) * (bottom - top);
  const svg = svgNode('svg', {
    viewBox: '0 0 620 260',
    role: 'img',
    'aria-label': config.ariaLabel || 'Gráfico de líneas'
  });

  const title = svgNode('text', { x: left, y: 12, class: 'rep-axis-title' });
  title.textContent = config.yLabel || 'Valor';
  svg.appendChild(title);

  [max, max / 2, 0].forEach((value, index) => {
    const y = top + (index * (bottom - top)) / 2;
    svg.appendChild(svgNode('line', { x1: left, y1: y, x2: right, y2: y, class: 'rep-grid-line' }));
    const label = svgNode('text', { x: left - 8, y: y + 4, class: 'rep-axis-label', 'text-anchor': 'end' });
    label.textContent = Number.isInteger(value) ? String(value) : String(round1(value));
    svg.appendChild(label);
  });

  if(config.target !== undefined){
    const y = yFor(config.target);
    svg.appendChild(svgNode('line', {
      x1: left, y1: y, x2: right, y2: y, class: 'rep-target-line'
    }));
    const label = svgNode('text', { x: right - 4, y: y - 6, class: 'rep-target-label', 'text-anchor': 'end' });
    label.textContent = `Objetivo ${config.target}%`;
    svg.appendChild(label);
  }

  const primary = config.series[0];
  const areaPoints = `${left},${bottom} ${primary.values.map((value, index) => `${xFor(index)},${yFor(value ?? 0)}`).join(' ')} ${right},${bottom}`;
  svg.appendChild(svgNode('polygon', { points: areaPoints, class: 'rep-line-area', fill: primary.color }));

  config.series.forEach(series => {
    const points = [];
    series.values.forEach((value, index) => {
      if(value === null || value === undefined) return;
      points.push(`${xFor(index)},${yFor(value)}`);
    });
    if(points.length > 1){
      svg.appendChild(svgNode('polyline', {
        points: points.join(' '),
        fill: 'none',
        stroke: series.color,
        'stroke-width': 3,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      }));
    }
    series.values.forEach((value, index) => {
      if(value === null || value === undefined) return;
      svg.appendChild(svgNode('circle', {
        cx: xFor(index),
        cy: yFor(value),
        r: 4,
        fill: '#ffffff',
        stroke: series.color,
        'stroke-width': 2.5
      }));
    });
  });

  const step = Math.ceil(config.months.length / 6);
  config.months.forEach((month, index) => {
    if(index % step !== 0 && index !== config.months.length - 1) return;
    const label = svgNode('text', {
      x: xFor(index),
      y: bottom + 24,
      class: 'rep-axis-label',
      'text-anchor': 'middle'
    });
    label.textContent = month.label;
    svg.appendChild(label);
  });

  container.appendChild(svg);
  renderLegend(container, config.series.map(series => ({ label: series.name, color: series.color })));
}

function renderDonutChart(container, model){
  const entries = [
    { key: 'passed', count: model.passed.length },
    { key: 'conditional', count: model.conditional.length },
    { key: 'failed', count: model.failed.length }
  ];
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if(!total){
    emptyChart(container, 'Sin inspecciones completadas en el período.');
    return;
  }
  container.innerHTML = '';
  const svg = svgNode('svg', {
    viewBox: '0 0 220 220',
    role: 'img',
    'aria-label': 'Distribución de resultados de inspecciones'
  });
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  svg.appendChild(svgNode('circle', {
    cx: 110, cy: 110, r: radius, fill: 'none', stroke: '#e8eef7', 'stroke-width': 28
  }));
  let offset = 0;
  entries.forEach(entry => {
    if(!entry.count) return;
    const length = (entry.count / total) * circumference;
    svg.appendChild(svgNode('circle', {
      cx: 110,
      cy: 110,
      r: radius,
      fill: 'none',
      stroke: RESULT_META[entry.key].color,
      'stroke-width': 28,
      'stroke-dasharray': `${length} ${circumference - length}`,
      'stroke-dashoffset': -offset,
      transform: 'rotate(-90 110 110)'
    }));
    offset += length;
  });
  const totalText = svgNode('text', { x: 110, y: 108, class: 'rep-donut-total', 'text-anchor': 'middle' });
  totalText.textContent = String(total);
  const totalLabel = svgNode('text', { x: 110, y: 130, class: 'rep-donut-label', 'text-anchor': 'middle' });
  totalLabel.textContent = 'Completadas';
  svg.append(totalText, totalLabel);
  container.appendChild(svg);
  renderLegend(container, entries.map(entry => ({
    label: `${RESULT_META[entry.key].label} · ${entry.count} (${percent(entry.count, total)}%)`,
    color: RESULT_META[entry.key].color
  })));
}

function renderBarChart(container, entries, config){
  if(!container || !entries.length){
    emptyChart(container, config.emptyMessage || 'Sin datos para el período seleccionado.');
    return;
  }
  container.innerHTML = '';
  const left = 182;
  const right = 600;
  const top = 20;
  const rowHeight = 38;
  const bottom = top + entries.length * rowHeight;
  const max = Math.max(1, ...entries.map(entry => entry.count));
  const xFor = value => left + (value / max) * (right - left);
  const svg = svgNode('svg', {
    viewBox: `0 0 620 ${bottom + 42}`,
    role: 'img',
    'aria-label': config.ariaLabel || 'Gráfico de barras'
  });

  const title = svgNode('text', { x: left, y: 12, class: 'rep-axis-title' });
  title.textContent = config.xLabel || 'Cantidad';
  svg.appendChild(title);

  [max, max / 2, 0].forEach(value => {
    const x = xFor(value);
    svg.appendChild(svgNode('line', { x1: x, y1: top, x2: x, y2: bottom, class: 'rep-grid-line' }));
    const label = svgNode('text', { x, y: bottom + 20, class: 'rep-axis-label', 'text-anchor': 'middle' });
    label.textContent = Number.isInteger(value) ? String(value) : String(round1(value));
    svg.appendChild(label);
  });

  entries.forEach((entry, index) => {
    const y = top + index * rowHeight + 7;
    const width = Math.max(2, xFor(entry.count) - left);
    const label = svgNode('text', { x: left - 10, y: y + 15, class: 'rep-bar-label', 'text-anchor': 'end' });
    label.textContent = entry.label.length > 24 ? `${entry.label.slice(0, 23)}…` : entry.label;
    svg.appendChild(label);
    svg.appendChild(svgNode('rect', {
      x: left, y, width, height: 20, rx: 4, fill: config.color
    }));
    const value = svgNode('text', { x: left + width + 8, y: y + 15, class: 'rep-bar-value' });
    value.textContent = String(entry.count);
    svg.appendChild(value);
  });

  container.appendChild(svg);
  renderLegend(container, [{ label: config.legend || 'Cantidad', color: config.color }]);
}

function renderCharts(model){
  const target = Number(qualityParameter('approval_target')) || 90;
  const subtitle = qs('rep-compliance-subtitle');
  if(subtitle) subtitle.textContent = `Inspecciones aprobadas sobre completadas; objetivo del ${target}%.`;
  renderLineChart(qs('rep-chart-monthly'), {
    months: model.months,
    max: Math.max(1, ...model.months.flatMap(month => [month.registered, month.completed])),
    yLabel: 'Inspecciones',
    ariaLabel: 'Evolución mensual de inspecciones registradas y completadas',
    emptyMessage: 'Sin inspecciones en el período seleccionado.',
    series: [
      { name: 'Registradas', color: '#2563eb', values: model.months.map(month => month.registered) },
      { name: 'Completadas', color: '#0f766e', values: model.months.map(month => month.completed) }
    ]
  });

  renderDonutChart(qs('rep-chart-results'), model);

  renderBarChart(qs('rep-chart-nc-category'), model.ncCategories, {
    color: '#dc2626',
    legend: 'No conformidades',
    xLabel: 'Cantidad de no conformidades',
    ariaLabel: 'No conformidades por categoría',
    emptyMessage: 'Sin no conformidades en el período seleccionado.'
  });

  renderBarChart(qs('rep-chart-inspectors'), model.inspectors, {
    color: '#2563eb',
    legend: 'Inspecciones registradas',
    xLabel: 'Cantidad de inspecciones',
    ariaLabel: 'Inspecciones por responsable',
    emptyMessage: 'Sin inspecciones por responsable en el período seleccionado.'
  });

  renderLineChart(qs('rep-chart-compliance'), {
    months: model.months,
    max: 100,
    target,
    yLabel: 'Cumplimiento (%)',
    ariaLabel: 'Evolución mensual del porcentaje de cumplimiento',
    emptyMessage: 'Sin inspecciones completadas en el período seleccionado.',
    series: [
      { name: 'Cumplimiento', color: '#0f766e', values: model.months.map(month => month.compliance) }
    ]
  });
}

export function renderQualityReports(){
  populateControls();
  const model = computeReportModel();
  const note = qs('rep-range-note');
  if(note) note.textContent = `Período: ${model.range.label}`;
  renderReportStatus(model);
  applyReportPermissions();
  renderKpis(model);
  renderSummary(model);
  renderCharts(model);
  return model;
}

export function buildReportsCsv(model){
  const rows = [
    ['Reporte', 'Reportes y Estadísticas'],
    ['Período', model.range.label],
    ['Categoría', model.filters.category || 'Todas'],
    ['Tipo de inspección', model.filters.inspectionType || 'Todos'],
    [],
    ['Indicador', 'Valor'],
    ['Porcentaje de aprobación', `${model.approvalRate}%`],
    ['Porcentaje de rechazo', `${model.rejectionRate}%`],
    ['Total de inspecciones', model.inspections.length],
    ['Total de no conformidades', model.ncs.length],
    ['Tiempo promedio de resolución', model.avgResolutionDays === null ? '—' : `${model.avgResolutionDays} días`],
    [],
    ['Mes', 'Registradas', 'Completadas', 'Cumplimiento (%)'],
    ...model.months.map(month => [month.label, month.registered, month.completed, month.compliance === null ? '—' : month.compliance]),
    [],
    ['Resultado', 'Cantidad', 'Porcentaje (%)'],
    ['Aprobado', model.passed.length, model.approvalRate],
    ['Condicional', model.conditional.length, model.conditionalRate],
    ['Rechazado', model.failed.length, model.rejectionRate],
    [],
    ['Categoría de no conformidad', 'Cantidad'],
    ...model.ncCategories.map(entry => [entry.label, entry.count]),
    [],
    ['Responsable', 'Inspecciones'],
    ...model.inspectors.map(entry => [entry.label, entry.count])
  ];
  return rowsToCsv(rows);
}

export function exportReportsExcel(){
  const error = qs('rep-export-error');
  if(error) error.textContent = '';
  const model = computeReportModel();
  if(!model.inspections.length && !model.ncs.length){
    if(error) error.textContent = 'No hay datos para exportar con los filtros aplicados.';
    return null;
  }
  const content = `\ufeff${buildReportsCsv(model)}`;
  const filename = `calidad_reporte_${safeFilenamePart(model.range.label)}.csv`;
  try{
    downloadContent(content, filename, 'text/csv;charset=utf-8;');
  }catch(err){
    if(error) error.textContent = err.message;
    return null;
  }
  return content;
}

export function exportReportsPdf(){
  const error = qs('rep-export-error');
  if(error) error.textContent = '';
  if(typeof window === 'undefined' || typeof window.print !== 'function'){
    if(error) error.textContent = 'La exportación a PDF requiere un navegador con impresión disponible.';
    return false;
  }
  window.print();
  return true;
}

function applyFilters(){
  const error = qs('rep-export-error');
  if(error) error.textContent = '';
  renderQualityReports();
}

export function initQualityReports(){
  const refresh = qs('rep-refresh');
  if(!refresh || refresh.dataset.wired === 'true') return;
  refresh.dataset.wired = 'true';
  refresh.addEventListener('click', applyFilters);
  ['rep-period', 'rep-start', 'rep-end', 'rep-category', 'rep-type'].forEach(id => {
    const control = qs(id);
    if(!control) return;
    control.addEventListener('change', applyFilters);
    control.addEventListener('input', applyFilters);
  });
  qs('rep-export-excel').addEventListener('click', exportReportsExcel);
  qs('rep-export-pdf').addEventListener('click', exportReportsPdf);
  document.addEventListener('quality:role-changed', applyReportPermissions);
  applyReportPermissions();
}
