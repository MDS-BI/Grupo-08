import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  addCorrectiveAction,
  updateCorrectiveAction,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs, submit } from '../support/quality-dom.js';

let dom;

function createFailedInspection(reference = 'gr-001', critical = true){
  const plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
  const criterion = addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: critical
  });
  const inspection = addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: reference,
    inspection_date: '2026-11-09'
  });
  completeInspection(inspection.inspection_id, critical ? 'failed' : 'conditional', [{
    criteria_id: criterion.criteria_id,
    measured_value: 99,
    pass_fail: false
  }]);
  return { plan, criterion, inspection };
}

function fillCapa(nc, overrides = {}){
  qs('capa-nc').value = nc.non_conformance_id;
  qs('capa-responsible').value = 'emp-003';
  qs('capa-description').value = 'Reprocesar el lote';
  qs('capa-root').value = 'Falla de calibración';
  qs('capa-type').value = 'rework';
  qs('capa-due').value = overrides.dueDate || '2026-12-01';
  qs('capa-status').value = overrides.status || 'pending';
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 3 - non-conformances and CAPA', () => {
  it('shows the automatically generated non-conformance after a failed inspection', () => {
    createFailedInspection();
    qs('nav-quality-nc').click();

    const ncs = loadCollection('non_conformances');
    expect(ncs.length).toBe(1);
    expect(qs('nc-list').textContent).toContain('Peso');
    expect(qs('nc-list').textContent).toContain('other');
    expect(qs('quarantine-body').textContent).toContain('Cuarentena');
  });

  it('validates mandatory CAPA fields', () => {
    const { inspection } = createFailedInspection();
    void inspection;
    qs('nav-quality-nc').click();
    const nc = loadCollection('non_conformances')[0];

    fillCapa(nc);
    qs('capa-description').value = '';
    submit(dom.window, 'capa-form');

    expect(qs('error-capa-description').textContent).toContain('obligatoria');
    expect(loadCollection('corrective_actions').length).toBe(0);
  });

  it('adds a CAPA and updates the quarantine label to under treatment', () => {
    createFailedInspection();
    qs('nav-quality-nc').click();
    const nc = loadCollection('non_conformances')[0];

    fillCapa(nc);
    submit(dom.window, 'capa-form');

    const actions = loadCollection('corrective_actions');
    expect(actions.length).toBe(1);
    expect(actions[0].responsible_employee_id).toBe('emp-003');
    expect(actions[0].action_type).toBe('rework');
    expect(qs('quarantine-body').textContent).toContain('Cuarentena - En tratamiento');
  });

  it('flags overdue CAPA without changing its stored status', () => {
    createFailedInspection();
    const nc = loadCollection('non_conformances')[0];
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar el lote',
      root_cause: 'Falla de calibración',
      action_type: 'rework',
      due_date: '2020-01-01',
      status: 'pending'
    });

    qs('nav-quality-nc').click();
    expect(qs('capa-list').textContent).toContain('Vencida');
    expect(loadCollection('corrective_actions')[0].status).toBe('pending');
  });

  it('stamps completed_at only on completion and preserves it on later edits', () => {
    createFailedInspection();
    qs('nav-quality-nc').click();
    const nc = loadCollection('non_conformances')[0];

    fillCapa(nc);
    submit(dom.window, 'capa-form');
    let action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toBeUndefined();

    updateCorrectiveAction(action.corrective_action_id, { status: 'completed' });
    action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toMatch(/^\d{4}-/);
    const completedAt = action.completed_at;

    updateCorrectiveAction(action.corrective_action_id, { action_description: 'Ajuste final' });
    action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toBe(completedAt);
    expect(action.status).toBe('completed');
  });

  it('shows conditional inspections in the review tray without creating a non-conformance', () => {
    createFailedInspection('gr-002', false);
    qs('nav-quality-nc').click();

    expect(loadCollection('non_conformances').length).toBe(0);
    expect(qs('review-body').querySelectorAll('tr').length).toBe(1);
    expect(qs('review-empty').hidden).toBe(true);
  });
});
