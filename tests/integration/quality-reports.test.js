import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearQualityData,
  loadExternal,
  addPlan,
  addCriterion,
  approvePlan,
  submitPlanForApproval,
  addChecklist,
  addInspection,
  completeInspection,
  addNonConformance,
  updateNonConformance
} from '../../src/storage.js';
import { buildReportsCsv, computeReportModel } from '../../src/components/quality-reports.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;

function isoDaysAgo(days){
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function change(id, value, eventName = 'change'){
  const control = qs(id);
  control.value = value;
  control.dispatchEvent(new dom.window.Event(eventName, { bubbles: true }));
}

function buildData(){
  clearQualityData();
  const productId = loadExternal('products')[0].product_id;
  const referenceId = loadExternal('goods_receipt')[0].goods_receipt_id;
  const incoming = addPlan({ plan_name: 'Plan de recepción', product_id: productId, applicable_stage: 'incoming' });
  const incomingCriterion = addCriterion({
    inspection_plan_id: incoming.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true
  });
  const final = addPlan({ plan_name: 'Plan final', product_id: productId, applicable_stage: 'final' });
  const finalCriterion = addCriterion({
    inspection_plan_id: final.inspection_plan_id,
    criteria_name: 'Etiquetado',
    expected_value: 10,
    tolerance: 1,
    unit: 'puntos',
    comparison_type: 'range',
    is_critical: true
  });
  [incoming, final].forEach(plan => {
    submitPlanForApproval(plan.inspection_plan_id);
    approvePlan(plan.inspection_plan_id);
  });
  const checklist = addChecklist({
    name: 'Checklist de reportes',
    category: 'general',
    status: 'approved',
    criteria: [{ name: 'Revisión documental' }]
  });

  const register = (plan, criterion, date, inspectorId, result) => {
    const inspection = addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      checklist_id: checklist.checklist_id,
      inspector_id: inspectorId,
      reference_module: 'goods_receipt',
      reference_id: referenceId,
      inspection_date: date
    });
    completeInspection(inspection.inspection_id, result, [{
      criteria_id: criterion.criteria_id,
      measured_value: result === 'failed' ? 99 : 10,
      pass_fail: result !== 'failed'
    }]);
    return inspection;
  };

  register(incoming, incomingCriterion, isoDaysAgo(60), 'emp-001', 'passed');
  register(incoming, incomingCriterion, isoDaysAgo(40), 'emp-002', 'failed');
  register(final, finalCriterion, isoDaysAgo(10), 'emp-001', 'passed');

  const dimensional = addNonConformance({
    product_id: productId,
    description: 'Desviación dimensional',
    defect_type: 'dimensional',
    severity: 'major',
    status: 'open',
    detected_date: isoDaysAgo(30)
  });
  const functional = addNonConformance({
    product_id: productId,
    description: 'Falla funcional',
    defect_type: 'functional',
    severity: 'critical',
    status: 'open',
    detected_date: isoDaysAgo(5)
  });
  updateNonConformance(functional.id, { status: 'closed' });
  return { dimensional, functional };
}

beforeEach(async () => {
  dom = await bootQualityApp();
  buildData();
  qs('nav-quality-reports').click();
});

afterEach(() => {
  dom.window.close();
});

describe('Quality reports and statistics workspace', () => {
  it('renders the requested header, filters, KPIs and five labeled charts', () => {
    expect(qs('rep-view-heading').textContent).toBe('Reportes y Estadísticas');
    expect(document.querySelector('#view-quality-reports .rep-heading-copy .muted').textContent)
      .toBe('Análisis del desempeño y cumplimiento de calidad.');
    ['rep-period', 'rep-start', 'rep-end', 'rep-category', 'rep-type'].forEach(id => {
      expect(qs(id)).not.toBeNull();
    });
    expect(qs('rep-start').disabled).toBe(true);
    expect(qs('rep-end').disabled).toBe(true);
    expect(qs('rep-kpis').textContent).toContain('Porcentaje de aprobación');
    expect(qs('rep-kpis').textContent).toContain('66.7%');
    expect(qs('rep-kpis').textContent).toContain('33.3%');
    expect(qs('rep-kpis').textContent).toContain('Total de inspecciones');
    expect(qs('rep-kpis').textContent).toContain('Total de no conformidades');
    expect(qs('rep-kpis').textContent).toContain('Tiempo promedio de resolución');
    expect(qs('rep-summary-heading').textContent).toBe('Resumen del período');
    expect(qs('rep-summary').textContent).toContain('Se registraron 3 inspecciones');
    expect(document.querySelectorAll('.rep-chart svg').length).toBe(5);
    expect(qs('rep-chart-monthly').textContent).toContain('Registradas');
    expect(qs('rep-chart-monthly').textContent).toContain('Completadas');
    expect(qs('rep-chart-results').textContent).toContain('Aprobado');
    expect(qs('rep-chart-compliance').textContent).toContain('Objetivo 90%');
    expect(qs('rep-range-note').textContent).toContain('Período:');
    expect(qs('rep-active-filters').textContent).toContain('Filtros activos:');
    expect(qs('rep-active-filters').textContent).toContain('Últimos 12 meses');
    expect(qs('rep-empty-state').hidden).toBe(true);

    const model = computeReportModel();
    const now = new Date();
    const expectedEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    expect(model.months).toHaveLength(12);
    expect(model.range.start.endsWith('-01')).toBe(true);
    expect(model.range.end).toBe(expectedEnd);
  });

  it('applies category, inspection type and custom date filters', () => {
    change('rep-category', 'functional');
    expect(qs('rep-kpis').textContent).toContain('Total de no conformidades1');
    expect(qs('rep-chart-nc-category').textContent).toContain('Funcional');
    expect(qs('rep-chart-nc-category').textContent).not.toContain('Dimensional');

    change('rep-category', '');
    change('rep-type', 'incoming');
    expect(qs('rep-kpis').textContent).toContain('Total de inspecciones2');

    change('rep-period', 'custom');
    expect(qs('rep-start').disabled).toBe(false);
    expect(qs('rep-end').disabled).toBe(false);
    change('rep-start', isoDaysAgo(15), 'input');
    change('rep-end', isoDaysAgo(1), 'input');
    expect(qs('rep-kpis').textContent).toContain('Total de inspecciones0');
    expect(qs('rep-range-note').textContent).toContain('Período:');
    change('rep-category', 'dimensional');
    expect(qs('rep-empty-state').hidden).toBe(false);
    expect(qs('rep-empty-state').textContent).toContain('No hay datos para los filtros seleccionados');
  });

  it('exports an Excel-compatible report and sends PDF to browser printing', () => {
    const clickSpy = vi.spyOn(dom.window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    qs('rep-export-excel').click();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();

    const csv = buildReportsCsv(computeReportModel());
    expect(csv).toContain('Reporte,Reportes y Estadísticas');
    expect(csv).toContain('Indicador,Valor');
    expect(csv).toContain('Porcentaje de aprobación,66.7%');
    expect(csv).toContain('Mes,Registradas,Completadas,Cumplimiento (%)');
    expect(csv).toContain('Responsable,Inspecciones');

    dom.window.print = vi.fn();
    qs('rep-export-pdf').click();
    expect(dom.window.print).toHaveBeenCalledTimes(1);
  });
});
