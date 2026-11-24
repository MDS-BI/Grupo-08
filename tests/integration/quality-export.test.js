import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  submitPlanForApproval,
  approvePlan,
  setInspectionResults,
  submitInspectionForReview,
  reviewInspection,
  loadCollection,
  saveCollection
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';
import { currentFilters, filterInspections, historyCsv } from '../../src/components/inspection-history.js';
import { buildDashboardCsv, qualityMetrics } from '../../src/components/dashboard.js';

let dom;

function createHistoryData(){
  const plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
  const criterion = addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true
  });

  submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
  approvePlan(plan.inspection_plan_id, 'jefe_calidad');

  function run(referenceModule, referenceId, date, result){
    const inspection = addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: referenceModule,
      reference_id: referenceId,
      inspection_date: date
    });
    setInspectionResults(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: result === 'passed' ? 10 : 99,
      pass_fail: result === 'passed'
    }]);
    submitInspectionForReview(inspection.inspection_id, 'emp-001');
    const decision = result === 'passed' ? 'approved' : 'rejected';
    return reviewInspection(inspection.inspection_id, decision, 'jefe_calidad', 'Revisión de prueba');
  }

  run('goods_receipt', 'gr-001', '2026-11-01', 'passed');
  run('goods_receipt', 'gr-002', '2026-11-05', 'failed');
  run('production_order', 'po-001', '2026-11-10', 'passed');
}

function seedTimedExportData(count){
  const plan = addPlan({ plan_name: 'Plan de exportación', product_id: 'prod-001', applicable_stage: 'incoming' });
  const criterion = addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true
  });
  submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
  approvePlan(plan.inspection_plan_id, 'jefe_calidad');

  const now = new Date().toISOString();
  const inspections = [];
  const results = [];
  for(let index = 0; index < count; index += 1){
    const inspectionId = `export-inspection-${index}`;
    const date = index === 0 ? '2026-11-15' : `2026-10-${String((index % 28) + 1).padStart(2, '0')}`;
    inspections.push({
      id: `export-id-${index}`,
      inspection_id: inspectionId,
      inspection_plan_id: plan.inspection_plan_id,
      checklist_id: null,
      checklist_version: null,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: index === 0 ? 'gr-001' : `gr-${String(index + 1).padStart(3, '0')}`,
      inspection_date: date,
      inspection_status: 'completed',
      proposed_result: 'passed',
      overall_result: 'passed',
      review_decision: 'approved',
      review_justification: 'Revisión de prueba',
      reviewed_by: 'jefe_calidad',
      reviewed_at: `${date}T12:00:00.000Z`,
      submitted_by: 'emp-001',
      submitted_at: `${date}T10:00:00.000Z`,
      legacy_completed: false,
      createdAt: now,
      updatedAt: now
    });
    results.push({
      id: `export-result-id-${index}`,
      result_id: `export-result-${index}`,
      inspection_id: inspectionId,
      criteria_id: criterion.criteria_id,
      measured_value: 10,
      pass_fail: true,
      createdAt: now,
      updatedAt: now
    });
  }
  saveCollection('quality_inspections', inspections);
  saveCollection('quality_inspection_results', results);
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 7 - CSV export', () => {
  it('builds a history CSV with results per criterion', () => {
    createHistoryData();
    const csv = historyCsv(loadCollection('quality_inspections'));
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Lote,Producto,Plan,Etapa,Fecha,Inspector,Dictamen,Estado,Resultados');
    expect(csv).toContain('Peso:10:Sí');
    expect(csv).toContain('Peso:99:No');
  });

  it('exports only the filtered rows with an identifiable filename', () => {
    createHistoryData();
    qs('nav-quality-history').click();
    let download = null;
    const spy = vi.spyOn(dom.window.HTMLAnchorElement.prototype, 'click').mockImplementation(function(){
      download = { filename: this.download, href: this.href };
    });

    qs('history-lot').value = 'goods_receipt:gr-001';
    qs('history-export').click();

    expect(download).not.toBeNull();
    expect(download.filename).toContain('calidad_historial');
    spy.mockRestore();
  });

  it('blocks invalid date ranges and informs when there is no data', () => {
    createHistoryData();
    qs('nav-quality-history').click();

    qs('history-from').value = '2026-11-10';
    qs('history-to').value = '2026-11-01';
    qs('history-export').click();
    expect(qs('history-export-error').textContent).toContain('inválido');

    qs('history-from').value = '2027-01-01';
    qs('history-to').value = '2027-01-31';
    qs('history-export').click();
    expect(qs('history-export-error').textContent).toContain('No hay inspecciones');
  });

  it('builds the dashboard KPI CSV from the displayed metrics', () => {
    createHistoryData();
    const csv = buildDashboardCsv(qualityMetrics());
    expect(csv).toContain('Indicador,Valor');
    expect(csv).toContain('Tasa de aprobación global');
    expect(csv).toContain('No conformidades abiertas - Mayor');
    expect(csv).toContain('Eficacia CAPA');
  });

  it('exports filtered CSV with 500 inspections within the SC-012 time budget', () => {
    seedTimedExportData(500);
    qs('nav-quality-history').click();
    qs('history-from').value = '2026-11-15';
    qs('history-to').value = '2026-11-15';

    const startedAt = performance.now();
    const rows = filterInspections(loadCollection('quality_inspections'), currentFilters());
    const csv = historyCsv(rows);
    const elapsedMs = performance.now() - startedAt;

    console.info(`[SC-012] exportación filtrada de 500 inspecciones en ${elapsedMs.toFixed(2)} ms`);
    expect(rows).toHaveLength(1);
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('gr-001');
    expect(elapsedMs).toBeLessThan(2000);
  });
});
