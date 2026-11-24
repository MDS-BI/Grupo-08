import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function approvedPlan(){
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
  return q.approvePlan(plan.inspection_plan_id, 'jefe_calidad');
}

function submittedInspection(){
  const plan = approvedPlan();
  const criterion = q.planCriteria(plan.inspection_plan_id)[0];
  const inspection = q.addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    inspection_date: '2026-11-09'
  });
  q.setInspectionResults(inspection.inspection_id, [{
    criteria_id: criterion.criteria_id,
    measured_value: 10,
    pass_fail: true
  }]);
  return q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
});

describe('quality workflow permissions', () => {
  it('blocks inspector plan submission without mutating or auditing', () => {
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
    q.clearAuditEntries();

    q.setActiveRole('inspector');
    expect(() => q.submitPlanForApproval(plan.inspection_plan_id, 'emp-001'))
      .toThrow('No tienes permiso para realizar esta acción.');
    expect(q.loadCollection('quality_inspection_plans')[0].status).toBe('draft');
    expect(q.findAuditEntries()).toHaveLength(0);
  });

  it('allows only the head of quality to issue the final verdict', () => {
    const inspection = submittedInspection();
    q.setActiveRole('inspector');
    expect(() => q.reviewInspection(inspection.inspection_id, 'approved', 'emp-001', 'Aprobado'))
      .toThrow('No tienes permiso para realizar esta acción.');
    expect(q.loadCollection('quality_inspections')[0].inspection_status).toBe('pending_review');

    q.setActiveRole('jefe_calidad');
    expect(q.reviewInspection(inspection.inspection_id, 'approved', 'jefe_calidad', 'Aprobado').overall_result).toBe('passed');
  });

  it('blocks gerente evidence deletion and CAPA closure review', () => {
    q.setActiveRole('gerente');
    expect(() => q.addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' }))
      .toThrow('No tienes permiso para realizar esta acción.');
    expect(() => q.registerCapaEffectiveness('missing', 'effective', 'Observaciones', 'gerente'))
      .toThrow('No tienes permiso para realizar esta acción.');
  });
});
