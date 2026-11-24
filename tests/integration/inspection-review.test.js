import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function submittedInspection(measurement = { measured_value: 10, pass_fail: true }){
  const plan = q.addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' });
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
  const criterion = q.planCriteria(plan.inspection_plan_id)[0];
  const inspection = q.addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    inspection_date: '2026-11-09'
  });
  q.setInspectionResults(inspection.inspection_id, [{ criteria_id: criterion.criteria_id, ...measurement }]);
  return q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
});

describe('inspection review', () => {
  it('approves a submitted inspection with a single final decision', () => {
    const submitted = submittedInspection();
    expect(submitted.inspection_status).toBe('pending_review');
    expect(submitted.overall_result).toBeNull();

    const reviewed = q.reviewInspection(submitted.inspection_id, 'approved', 'jefe_calidad', 'Dentro de especificación');
    expect(reviewed.inspection_status).toBe('completed');
    expect(reviewed.overall_result).toBe('passed');
    expect(reviewed.review_decision).toBe('approved');
    expect(reviewed.reviewed_by).toBe('jefe_calidad');
    expect(q.loadCollection('non_conformances')).toHaveLength(0);
  });

  it('creates a non-conformance only on rejection', () => {
    const submitted = submittedInspection({ measured_value: 99, pass_fail: false });
    const reviewed = q.reviewInspection(submitted.inspection_id, 'rejected', 'jefe_calidad', 'Fuera de especificación');
    expect(reviewed.overall_result).toBe('failed');
    expect(q.loadCollection('non_conformances')).toHaveLength(1);
    expect(() => q.reviewInspection(submitted.inspection_id, 'rejected', 'jefe_calidad', 'Otra')).toThrow();
  });

  it('blocks approval when a critical criterion failed', () => {
    const submitted = submittedInspection({ measured_value: 99, pass_fail: false });
    expect(() => q.reviewInspection(submitted.inspection_id, 'approved', 'jefe_calidad', 'Aprobado'))
      .toThrow('críticos fallidos');
  });

  it('reviews a legacy conditional inspection without changing its status', () => {
    q.saveCollection('quality_inspections', [{
      id: 'legacy',
      inspection_id: 'legacy',
      inspection_plan_id: 'plan-legacy',
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      inspection_status: 'completed',
      proposed_result: 'conditional',
      overall_result: null,
      review_decision: null,
      legacy_completed: true
    }]);
    const reviewed = q.reviewInspection('legacy', 'approved_conditional', 'jefe_calidad', 'Aceptado condicionalmente');
    expect(reviewed.inspection_status).toBe('completed');
    expect(reviewed.overall_result).toBe('conditional');
    expect(reviewed.review_decision).toBe('approved_conditional');
  });

  it('keeps override separate from review and never creates a non-conformance', () => {
    const submitted = submittedInspection({ measured_value: 99, pass_fail: false });
    const reviewed = q.reviewInspection(submitted.inspection_id, 'rejected', 'jefe_calidad', 'Rechazado');
    const overridden = q.overrideInspection(reviewed.inspection_id, 'failed', 'Confirmación', 'jefe_calidad');
    expect(overridden.overall_result).toBe('failed');
    expect(q.loadCollection('non_conformances')).toHaveLength(1);
  });
});
