import { describe, it, expect } from 'vitest';
import { evaluateInspection, evaluateCriterion } from '../../src/inspection-engine.js';

function criterion(overrides = {}){
  return {
    criteria_id: 'c1',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: false,
    ...overrides
  };
}

function plan(criteria){
  return { inspection_plan_id: 'plan-1', criteria };
}

describe('evaluateCriterion', () => {
  it('evaluates range with inclusive limits', () => {
    const c = criterion({ comparison_type: 'range', expected_value: 10, tolerance: 1 });
    expect(evaluateCriterion(c, 9)).toBe(true);
    expect(evaluateCriterion(c, 11)).toBe(true);
    expect(evaluateCriterion(c, 8.99)).toBe(false);
    expect(evaluateCriterion(c, 11.01)).toBe(false);
  });

  it('evaluates min and max', () => {
    expect(evaluateCriterion(criterion({ comparison_type: 'min', expected_value: 5 }), 5)).toBe(true);
    expect(evaluateCriterion(criterion({ comparison_type: 'min', expected_value: 5 }), 4.9)).toBe(false);
    expect(evaluateCriterion(criterion({ comparison_type: 'max', expected_value: 5 }), 5)).toBe(true);
    expect(evaluateCriterion(criterion({ comparison_type: 'max', expected_value: 5 }), 5.1)).toBe(false);
  });

  it('evaluates boolean as equality with expected value', () => {
    expect(evaluateCriterion(criterion({ comparison_type: 'boolean', expected_value: 1 }), 1)).toBe(true);
    expect(evaluateCriterion(criterion({ comparison_type: 'boolean', expected_value: 1 }), 0)).toBe(false);
  });

  it('returns null for non-numeric measurements', () => {
    expect(evaluateCriterion(criterion(), '')).toBeNull();
    expect(evaluateCriterion(criterion(), 'abc')).toBeNull();
  });
});

describe('evaluateInspection', () => {
  it('returns incomplete with missing criteria and no verdict', () => {
    const p = plan([
      criterion({ criteria_id: 'c1' }),
      criterion({ criteria_id: 'c2' })
    ]);
    const result = evaluateInspection(p, [{ criteria_id: 'c1', measured_value: 10 }]);
    expect(result.status).toBe('incomplete');
    expect(result.missing_criteria_ids).toEqual(['c2']);
    expect(result.overall_result).toBeNull();
  });

  it('treats non-numeric values as incomplete', () => {
    const p = plan([criterion({ criteria_id: 'c1' })]);
    const result = evaluateInspection(p, [{ criteria_id: 'c1', measured_value: 'N/A' }]);
    expect(result.status).toBe('incomplete');
    expect(result.overall_result).toBeNull();
  });

  it('returns passed when all criteria comply', () => {
    const p = plan([
      criterion({ criteria_id: 'c1', is_critical: true }),
      criterion({ criteria_id: 'c2' })
    ]);
    const result = evaluateInspection(p, [
      { criteria_id: 'c1', measured_value: 10 },
      { criteria_id: 'c2', measured_value: 10.5 }
    ]);
    expect(result.status).toBe('complete');
    expect(result.overall_result).toBe('passed');
    expect(result.results.every(r => r.pass_fail === true)).toBe(true);
  });

  it('returns failed when any critical criterion fails', () => {
    const p = plan([
      criterion({ criteria_id: 'c1', is_critical: true }),
      criterion({ criteria_id: 'c2' })
    ]);
    const result = evaluateInspection(p, [
      { criteria_id: 'c1', measured_value: 99 },
      { criteria_id: 'c2', measured_value: 10 }
    ]);
    expect(result.overall_result).toBe('failed');
  });

  it('returns conditional when only non-critical criteria deviate', () => {
    const p = plan([
      criterion({ criteria_id: 'c1', is_critical: true }),
      criterion({ criteria_id: 'c2', is_critical: false })
    ]);
    const result = evaluateInspection(p, [
      { criteria_id: 'c1', measured_value: 10 },
      { criteria_id: 'c2', measured_value: 99 }
    ]);
    expect(result.overall_result).toBe('conditional');
  });

  it('is deterministic and does not require storage', () => {
    const p = plan([criterion({ criteria_id: 'c1' })]);
    const first = evaluateInspection(p, [{ criteria_id: 'c1', measured_value: 10 }]);
    const second = evaluateInspection(p, [{ criteria_id: 'c1', measured_value: 10 }]);
    expect(first).toEqual(second);
    expect(first.overall_result).toBe('passed');
  });
});
