import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureSeedData,
  validateInspectionPlan,
  validateCriterion,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  planCriteria,
  planHasCriteria,
  planHasInspections,
  duplicatePlan,
  loadCollection
} from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

beforeEach(() => {
  store.clear();
  ensureSeedData();
});

describe('quality plan configuration rules', () => {
  it('requires name, existing product and canonical stage', () => {
    expect(validateInspectionPlan({ plan_name: 'A', product_id: 'prod-001', applicable_stage: 'incoming' }).valid).toBe(true);
    expect(validateInspectionPlan({ plan_name: '', product_id: 'prod-001', applicable_stage: 'incoming' }).errors.plan_name).toBeDefined();
    expect(validateInspectionPlan({ plan_name: 'A', product_id: 'prod-404', applicable_stage: 'incoming' }).errors.product_id).toBeDefined();
    expect(validateInspectionPlan({ plan_name: 'A', product_id: 'prod-001', applicable_stage: 'otra' }).errors.applicable_stage).toBeDefined();
  });

  it('only enables plans that have at least one criterion', () => {
    const plan = addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' });
    expect(planHasCriteria(plan.inspection_plan_id)).toBe(false);
    addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 0.5,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    expect(planHasCriteria(plan.inspection_plan_id)).toBe(true);
  });

  it('rejects non-numeric expected values, negative tolerance and empty units', () => {
    const base = {
      inspection_plan_id: 'plan',
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range'
    };
    expect(validateCriterion(base).valid).toBe(true);
    expect(validateCriterion({ ...base, expected_value: 'diez' }).valid).toBe(false);
    expect(validateCriterion({ ...base, tolerance: -0.1 }).valid).toBe(false);
    expect(validateCriterion({ ...base, unit: '  ' }).valid).toBe(false);
  });

  it('detects plans with historical inspections for lock and duplication', () => {
    const plan = addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' });
    const criterion = addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 0.5,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    const inspection = addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      inspection_date: '2026-11-09'
    });
    completeInspection(inspection.inspection_id, 'passed', [{
      criteria_id: criterion.criteria_id,
      measured_value: 10,
      pass_fail: true
    }]);

    expect(planHasInspections(plan.inspection_plan_id)).toBe(true);
    const copy = duplicatePlan(plan.id);
    expect(copy.plan_name).toContain('(copia)');
    expect(planCriteria(copy.inspection_plan_id).length).toBe(1);
    expect(loadCollection('quality_inspection_plans').length).toBe(2);
  });
});
