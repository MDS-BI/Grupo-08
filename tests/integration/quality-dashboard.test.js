import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  addCorrectiveAction,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;
let plan;
let criterion;

function runInspection(reference, result, measured = 10){
  const inspection = addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: reference,
    inspection_date: '2026-11-09'
  });
  completeInspection(inspection.inspection_id, result, [{
    criteria_id: criterion.criteria_id,
    measured_value: measured,
    pass_fail: result === 'passed'
  }]);
  return inspection;
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 5 - quality dashboard', () => {
  it('shows clear empty states and zeroed KPIs without data', () => {
    qs('nav-quality-dashboard').click();
    expect(qs('kpi-approval-rate').textContent).toBe('0%');
    expect(qs('kpi-open-nc').textContent).toBe('0');
    expect(qs('kpi-pending-inspections').textContent).toBe('0');
    expect(qs('quality-approval-by-stage').textContent).toContain('Sin inspecciones');
  });

  it('computes KPIs, CAPA effectiveness, pending inspections and Pareto', () => {
    plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
    criterion = addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });

    runInspection('gr-001', 'passed');
    runInspection('gr-002', 'failed', 99);
    runInspection('gr-003', 'conditional', 99);
    addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-002',
      reference_module: 'goods_receipt',
      reference_id: 'gr-003',
      inspection_date: '2026-11-09'
    });

    const nc = loadCollection('non_conformances')[0];
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Acción a tiempo',
      root_cause: 'Causa 1',
      action_type: 'rework',
      due_date: '2099-01-01',
      status: 'completed'
    });
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Acción tardía',
      root_cause: 'Causa 2',
      action_type: 'rework',
      due_date: '2000-01-01',
      status: 'completed'
    });
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Acción vencida',
      root_cause: 'Causa 3',
      action_type: 'other',
      due_date: '2000-01-01',
      status: 'pending'
    });

    qs('nav-quality-dashboard').click();

    expect(qs('kpi-approval-rate').textContent).toBe('33.3%');
    expect(qs('kpi-open-nc').textContent).toBe('1');
    expect(qs('kpi-overdue-capa').textContent).toBe('1');
    expect(qs('kpi-capa-effectiveness').textContent).toBe('50%');
    expect(qs('kpi-pending-inspections').textContent).toBe('1');
    expect(qs('quality-approval-by-stage').textContent).toContain('Recepción');
    expect(qs('quality-nc-by-severity').textContent).toContain('Mayor: 1');
    expect(qs('quality-pareto-product').textContent).toContain('Harina de trigo');
    expect(qs('quality-pareto-stage').textContent).toContain('Recepción');
    expect(qs('quality-inspector-detail').textContent).toContain('Ana Torres');
  });

  it('restricts individual inspector detail to the head-of-quality role', () => {
    plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
    criterion = addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    runInspection('gr-001', 'passed');

    qs('nav-quality-dashboard').click();
    qs('quality-role').value = 'inspector';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(qs('quality-inspector-detail').textContent).toContain('restringido');
    expect(qs('kpi-approval-rate').textContent).toBe('100%');
  });
});
