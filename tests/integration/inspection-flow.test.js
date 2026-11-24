import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

let plan;
let criterion;

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
  plan = q.addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' });
  q.addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true
  });
  q.submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
  q.approvePlan(plan.inspection_plan_id, 'jefe_calidad');
  criterion = q.planCriteria(plan.inspection_plan_id)[0];
});

function addInspection(){
  return q.addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    inspection_date: '2026-11-09'
  });
}

describe('inspection flow', () => {
  it('blocks submission until all measurements are present', () => {
    const inspection = addInspection();
    expect(() => q.submitInspectionForReview(inspection.inspection_id, 'emp-001'))
      .toThrow('Faltan mediciones');

    q.setInspectionResults(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: 10,
      pass_fail: true
    }]);
    const submitted = q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
    expect(submitted.inspection_status).toBe('pending_review');
    expect(submitted.proposed_result).toBe('passed');
    expect(submitted.overall_result).toBeNull();
  });

  it('saves drafts without a final result and blocks edits while pending', () => {
    const inspection = addInspection();
    q.setInspectionResults(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: '',
      pass_fail: false
    }]);
    const draft = q.saveDraftInspection(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: '',
      pass_fail: false
    }], 'emp-001');
    expect(draft.inspection.inspection_status).toBe('draft');
    expect(draft.inspection.overall_result).toBeNull();

    q.setInspectionResults(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: 10,
      pass_fail: true
    }]);
    q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
    expect(() => q.updateInspection(inspection.inspection_id, { inspector_id: 'emp-002' }))
      .toThrow('no puede editarse');
  });

  it('completes the inspection only after review', () => {
    const inspection = addInspection();
    q.setInspectionResults(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: 10,
      pass_fail: true
    }]);
    q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
    const reviewed = q.reviewInspection(inspection.inspection_id, 'approved', 'jefe_calidad', 'Conforme');
    expect(reviewed.inspection_status).toBe('completed');
    expect(reviewed.overall_result).toBe('passed');
  });

  it('completes a ten-criterion inspection within the SC-001 time budget', () => {
    for(let index = 2; index <= 10; index += 1){
      q.addCriterion({
        inspection_plan_id: plan.inspection_plan_id,
        criteria_name: `Criterio ${index}`,
        expected_value: 10,
        tolerance: 1,
        unit: 'kg',
        comparison_type: 'range',
        is_critical: index <= 3
      });
    }
    const criteria = q.planCriteria(plan.inspection_plan_id);
    expect(criteria).toHaveLength(10);

    const startedAt = performance.now();
    const inspection = addInspection();
    q.setInspectionResults(inspection.inspection_id, criteria.map(item => ({
      criteria_id: item.criteria_id,
      measured_value: 10,
      pass_fail: true
    })));
    const submitted = q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
    const reviewed = q.reviewInspection(inspection.inspection_id, 'approved', 'jefe_calidad', 'Conforme');
    const elapsedMs = performance.now() - startedAt;

    console.info(`[SC-001] inspección de 10 criterios completada en ${elapsedMs.toFixed(2)} ms`);
    expect(submitted.inspection_status).toBe('pending_review');
    expect(reviewed.inspection_status).toBe('completed');
    expect(reviewed.overall_result).toBe('passed');
    expect(elapsedMs).toBeLessThan(180000);
  });
});
