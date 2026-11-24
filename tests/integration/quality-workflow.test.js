import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
});

describe('approval workflows', () => {
  it('moves a plan through reject, edit, resubmit, approve and version', () => {
    const plan = q.addPlan({ plan_name: 'Plan recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
    q.addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });

    expect(q.submitPlanForApproval(plan.inspection_plan_id, 'emp-001').status).toBe('pending_approval');
    expect(() => q.rejectPlan(plan.inspection_plan_id, 'jefe_calidad', '  '))
      .toThrow('Registra la justificación para continuar.');
    expect(q.rejectPlan(plan.inspection_plan_id, 'jefe_calidad', 'Falta alcance').status).toBe('rejected');
    const edited = q.updatePlan(plan.inspection_plan_id, { plan_name: 'Plan recepción v1' });
    expect(edited.status).toBe('draft');
    expect(edited.review_justification).toBe('Falta alcance');

    q.submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
    const approved = q.approvePlan(plan.inspection_plan_id, 'jefe_calidad');
    expect(approved.status).toBe('approved');
    expect(approved.reviewed_by).toBe('jefe_calidad');

    const version = q.duplicatePlanVersion(plan.inspection_plan_id, 'jefe_calidad');
    expect(version.status).toBe('draft');
    expect(version.version).toBe(2);
    expect(version.version_group_id).toBe(approved.version_group_id);
    expect(version.version_of).toBe(approved.id);
    expect(q.planCriteria(version.inspection_plan_id)).toHaveLength(1);
  });

  it('moves a checklist through reject, edit, resubmit and approve', () => {
    const checklist = q.addChecklist({
      name: 'Checklist recepción',
      category: 'incoming',
      criteria: [{ name: 'Peso', is_critical: true }]
    });
    expect(checklist.status).toBe('draft');

    expect(q.submitChecklistForApproval(checklist.checklist_id, 'emp-001').status).toBe('pending_approval');
    expect(q.rejectChecklist(checklist.checklist_id, 'jefe_calidad', 'Falta criterio').status).toBe('rejected');
    expect(q.updateChecklist(checklist.checklist_id, { name: 'Checklist revisado' }).status).toBe('draft');
    expect(q.submitChecklistForApproval(checklist.checklist_id, 'emp-001').status).toBe('pending_approval');
    expect(q.approveChecklist(checklist.checklist_id, 'jefe_calidad').status).toBe('approved');
  });

  it('blocks editing plans and checklists with history', () => {
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
    q.addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      inspection_date: '2026-11-09'
    });
    expect(() => q.updatePlan(plan.inspection_plan_id, { plan_name: 'Otro' }))
      .toThrow('no puede editarse');
  });
});
