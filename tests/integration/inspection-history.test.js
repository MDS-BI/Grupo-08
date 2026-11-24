import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  addCorrectiveAction,
  loadCollection,
  saveCollection
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

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

function seedTimedHistory(count){
  const plan = addPlan({ plan_name: 'Plan de rendimiento', product_id: 'prod-001', applicable_stage: 'incoming' });
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
    const inspectionId = `timed-inspection-${index}`;
    const date = index === 0 ? '2026-11-15' : `2026-10-${String((index % 28) + 1).padStart(2, '0')}`;
    inspections.push({
      id: `timed-id-${index}`,
      inspection_id: inspectionId,
      inspection_plan_id: plan.inspection_plan_id,
      checklist_id: null,
      checklist_version: null,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
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
      id: `timed-result-id-${index}`,
      result_id: `timed-result-${index}`,
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

describe('User Story 6 - inspection history', () => {
  it('lists all inspections sorted by date descending', () => {
    createHistoryData();
    qs('nav-quality-history').click();
    const rows = qs('history-body').querySelectorAll('tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('2026-11-10');
    expect(qs('history-empty').hidden).toBe(true);
  });

  it('filters by lot and exposes traceability to non-conformance and CAPA', () => {
    createHistoryData();
    qs('nav-quality-history').click();

    qs('history-lot').value = 'goods_receipt:gr-002';
    qs('history-apply').click();
    let rows = qs('history-body').querySelectorAll('tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('gr-002');
    expect(rows[0].textContent).toContain('Reprobado');

    const nc = loadCollection('non_conformances')[0];
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar',
      root_cause: 'Causa',
      action_type: 'rework',
      due_date: '2026-12-01',
      status: 'pending'
    });
    qs('history-apply').click();
    rows = qs('history-body').querySelectorAll('tr');
    expect(rows[0].textContent).toContain('1 acción(es)');
  });

  it('filters by module and date range', () => {
    createHistoryData();
    qs('nav-quality-history').click();

    qs('history-module').value = 'goods_receipt';
    qs('history-module').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    qs('history-from').value = '2026-11-02';
    qs('history-to').value = '2026-11-06';
    qs('history-apply').click();

    const rows = qs('history-body').querySelectorAll('tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('gr-002');
  });

  it('rejects an invalid date range and supports clearing filters', () => {
    createHistoryData();
    qs('nav-quality-history').click();

    qs('history-from').value = '2026-11-10';
    qs('history-to').value = '2026-11-01';
    qs('history-apply').click();

    expect(qs('history-error').textContent).toContain('inválido');
    expect(qs('history-empty').hidden).toBe(false);

    qs('history-clear').click();
    expect(qs('history-error').textContent).toBe('');
    expect(qs('history-body').querySelectorAll('tr').length).toBe(3);
  });

  it('filters 500 inspections within the SC-006 time budget', () => {
    seedTimedHistory(500);
    qs('nav-quality-history').click();

    qs('history-lot').value = 'goods_receipt:gr-001';
    qs('history-from').value = '2026-11-15';
    qs('history-to').value = '2026-11-15';

    const startedAt = performance.now();
    qs('history-apply').click();
    const elapsedMs = performance.now() - startedAt;
    const rows = qs('history-body').querySelectorAll('tr');

    console.info(`[SC-006] historial filtrado en ${elapsedMs.toFixed(2)} ms, ${rows.length} fila(s)`);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('2026-11-15');
    expect(rows[0].textContent).toContain('gr-001');
    expect(elapsedMs).toBeLessThan(1000);
  });
});
