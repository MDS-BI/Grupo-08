import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureSeedData,
  loadExternal,
  validateReference,
  validateInspectionPlan,
  validateCriterion,
  validateCorrectiveAction,
  addPlan,
  updatePlan,
  deletePlan,
  duplicatePlan,
  addCriterion,
  deleteCriterion,
  addInspection,
  completeInspection,
  saveDraftInspection,
  deleteInspection,
  loadCollection,
  addNonConformance,
  deleteNonConformance,
  addCorrectiveAction,
  updateCorrectiveAction,
  isCapaOverdue,
  canOverrideInspection,
  overrideInspection
} from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

function makePlan(overrides = {}){
  return addPlan({
    plan_name: 'Plan de recepción',
    product_id: 'prod-001',
    applicable_stage: 'incoming',
    ...overrides
  });
}

function makeCriterion(plan, overrides = {}){
  return addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 0.5,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true,
    ...overrides
  });
}

function makeInspection(plan, overrides = {}){
  return addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    inspection_date: '2026-11-09',
    ...overrides
  });
}

function complete(inspection, criterion, measured, result){
  return completeInspection(inspection.inspection_id, result, [{
    criteria_id: criterion.criteria_id,
    measured_value: measured,
    pass_fail: result === 'passed'
  }]);
}

beforeEach(() => {
  store.clear();
  ensureSeedData();
});

describe('quality storage seed dependencies', () => {
  it('loads external seed collections', () => {
    expect(loadExternal('products').length).toBeGreaterThan(0);
    expect(loadExternal('employees').length).toBeGreaterThan(0);
    expect(loadExternal('goods_receipt').length).toBeGreaterThan(0);
    expect(loadExternal('production_order').length).toBeGreaterThan(0);
    expect(loadExternal('shipment').length).toBeGreaterThan(0);
  });

  it('validates reference module and existing reference id', () => {
    expect(validateReference('goods_receipt', 'gr-001').valid).toBe(true);
    expect(validateReference('goods_receipt', 'gr-999').valid).toBe(false);
    expect(validateReference('unknown', 'gr-001').valid).toBe(false);
    expect(validateReference('shipment', '').valid).toBe(false);
  });
});

describe('quality plans and criteria', () => {
  it('validates plan name, product and stage', () => {
    expect(validateInspectionPlan({ plan_name: '', product_id: 'prod-001', applicable_stage: 'incoming' }).valid).toBe(false);
    expect(validateInspectionPlan({ plan_name: 'X', product_id: 'prod-999', applicable_stage: 'incoming' }).valid).toBe(false);
    expect(validateInspectionPlan({ plan_name: 'X', product_id: 'prod-001', applicable_stage: 'other' }).valid).toBe(false);
    expect(validateInspectionPlan({ plan_name: 'X', product_id: 'prod-001', applicable_stage: 'final' }).valid).toBe(true);
  });

  it('validates criterion numbers, tolerance and comparison type', () => {
    const base = {
      inspection_plan_id: 'plan-x',
      criteria_name: 'Temperatura',
      expected_value: 5,
      tolerance: 0,
      unit: '°C',
      comparison_type: 'range'
    };
    expect(validateCriterion(base).valid).toBe(true);
    expect(validateCriterion({ ...base, expected_value: '' }).valid).toBe(false);
    expect(validateCriterion({ ...base, tolerance: -1 }).valid).toBe(false);
    expect(validateCriterion({ ...base, unit: '' }).valid).toBe(false);
    expect(validateCriterion({ ...base, comparison_type: 'nope' }).valid).toBe(false);
  });

  it('blocks editing and deleting a plan once it has historical inspections', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan);
    const inspection = makeInspection(plan);
    complete(inspection, criterion, 10, 'passed');

    expect(() => updatePlan(plan.id, { plan_name: 'Renombrado' })).toThrow();
    expect(() => deletePlan(plan.id)).toThrow();
    expect(() => deleteCriterion(criterion.id)).toThrow();
  });

  it('duplicates a plan with its criteria as a new version', () => {
    const plan = makePlan();
    makeCriterion(plan);
    makeCriterion(plan, { criteria_name: 'Color', is_critical: false });

    const copy = duplicatePlan(plan.id);
    expect(copy.inspection_plan_id).not.toBe(plan.inspection_plan_id);
    expect(copy.plan_name).toContain('(copia)');

    const copiedCriteria = loadCollection('quality_inspection_criteria')
      .filter(c => c.inspection_plan_id === copy.inspection_plan_id);
    expect(copiedCriteria.length).toBe(2);
    expect(copiedCriteria.map(c => c.criteria_name)).toContain('Color');
  });
});

describe('quality inspections', () => {
  it('rejects orphan references and plans without criteria', () => {
    const plan = makePlan();
    const base = {
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      inspection_date: '2026-11-09'
    };
    expect(() => addInspection(base)).toThrow();
    makeCriterion(plan);
    expect(() => addInspection({ ...base, reference_id: 'gr-999' })).toThrow();
    expect(() => addInspection({ ...base, inspector_id: 'emp-999' })).toThrow();
  });

  it('persists drafts without overall_result and completes with calculated results', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan);
    const inspection = makeInspection(plan);

    saveDraftInspection(inspection.inspection_id, []);
    const draft = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(draft.inspection_status).toBe('draft');
    expect(draft.overall_result).toBeNull();

    const { inspection: completed } = complete(inspection, criterion, 10.4, 'passed');
    expect(completed.inspection_status).toBe('completed');
    expect(completed.overall_result).toBe('passed');

    const results = loadCollection('quality_inspection_results')
      .filter(r => r.inspection_id === inspection.inspection_id);
    expect(results.length).toBe(1);
    expect(results[0].pass_fail).toBe(true);
  });

  it('creates an automated non-conformance when the inspection fails', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan);
    const inspection = makeInspection(plan);
    complete(inspection, criterion, 99, 'failed');

    const ncs = loadCollection('non_conformances');
    expect(ncs.length).toBe(1);
    expect(ncs[0].inspection_id).toBe(inspection.inspection_id);
    expect(ncs[0].product_id).toBe('prod-001');
    expect(ncs[0].defect_type).toBe('other');
    expect(ncs[0].severity).toBe('major');
    expect(ncs[0].status).toBe('open');
    expect(ncs[0].description).toContain('Peso');
  });

  it('blocks deleting an inspection with a non-conformance and cascades results otherwise', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan);
    const failedInspection = makeInspection(plan);
    complete(failedInspection, criterion, 99, 'failed');
    expect(() => deleteInspection(failedInspection.inspection_id)).toThrow();

    const okInspection = makeInspection(plan, { reference_id: 'gr-002' });
    complete(okInspection, criterion, 10, 'passed');
    expect(loadCollection('quality_inspection_results').some(r => r.inspection_id === okInspection.inspection_id)).toBe(true);
    deleteInspection(okInspection.inspection_id);
    expect(loadCollection('quality_inspection_results').some(r => r.inspection_id === okInspection.inspection_id)).toBe(false);
  });
});

describe('non-conformances and CAPA', () => {
  function failedWithNc(){
    const plan = makePlan();
    const criterion = makeCriterion(plan);
    const inspection = makeInspection(plan);
    complete(inspection, criterion, 99, 'failed');
    return { plan, criterion, inspection, nc: loadCollection('non_conformances')[0] };
  }

  it('requires CAPA responsible, description, root cause, type and due date', () => {
    const { nc } = failedWithNc();
    const base = {
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar lote',
      root_cause: 'Falla de calibración',
      action_type: 'rework',
      due_date: '2026-12-01',
      status: 'pending'
    };
    expect(validateCorrectiveAction(base).valid).toBe(true);
    expect(validateCorrectiveAction({ ...base, responsible_employee_id: '' }).valid).toBe(false);
    expect(validateCorrectiveAction({ ...base, action_description: '' }).valid).toBe(false);
    expect(validateCorrectiveAction({ ...base, root_cause: '' }).valid).toBe(false);
    expect(validateCorrectiveAction({ ...base, action_type: 'nope' }).valid).toBe(false);
    expect(validateCorrectiveAction({ ...base, due_date: '' }).valid).toBe(false);
  });

  it('marks overdue CAPA without changing its status automatically', () => {
    const { nc } = failedWithNc();
    const action = addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar lote',
      root_cause: 'Falla de calibración',
      action_type: 'rework',
      due_date: '2020-01-01',
      status: 'pending'
    });
    expect(isCapaOverdue(action, '2026-11-09')).toBe(true);
    expect(action.status).toBe('pending');

    updateCorrectiveAction(action.id, { status: 'completed' });
    const updated = loadCollection('corrective_actions').find(a => a.id === action.id);
    expect(isCapaOverdue(updated, '2026-11-09')).toBe(false);
    expect(updated.completed_at).toBeDefined();
  });

  it('cascades CAPA deletion when the non-conformance is deleted', () => {
    const { nc } = failedWithNc();
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar lote',
      root_cause: 'Falla de calibración',
      action_type: 'rework',
      due_date: '2026-12-01',
      status: 'pending'
    });
    expect(loadCollection('corrective_actions').length).toBe(1);
    deleteNonConformance(nc.id);
    expect(loadCollection('corrective_actions').length).toBe(0);
  });

  it('does not allow the automatic flow to create a duplicate non-conformance', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan);
    const inspection = makeInspection(plan);
    complete(inspection, criterion, 99, 'failed');
    const first = loadCollection('non_conformances')[0];
    addNonConformance({
      inspection_id: inspection.inspection_id,
      product_id: 'prod-001',
      description: 'Duplicada',
      defect_type: 'other',
      severity: 'major',
      status: 'open'
    });
    expect(loadCollection('non_conformances').length).toBe(2);
    expect(first.non_conformance_id).toBeDefined();
  });
});

describe('dictamen overrides', () => {
  it('blocks passed when a critical criterion failed or was not measured', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan, { is_critical: true });
    const inspection = makeInspection(plan);
    complete(inspection, criterion, 99, 'failed');

    expect(canOverrideInspection(inspection.inspection_id, 'passed').valid).toBe(false);
    expect(() => overrideInspection(inspection.inspection_id, 'passed', 'Justificación', 'emp-003')).toThrow();

    const override = overrideInspection(inspection.inspection_id, 'conditional', 'Se reprocesa el lote', 'emp-003');
    expect(override.overall_result).toBe('conditional');
    expect(override.override_justification).toBe('Se reprocesa el lote');
    expect(override.overridden_by).toBe('emp-003');
    expect(override.override_at).toBeDefined();
  });

  it('allows passed when only non-critical criteria deviated', () => {
    const plan = makePlan();
    const criterion = makeCriterion(plan, { is_critical: false });
    const inspection = makeInspection(plan);
    complete(inspection, criterion, 99, 'conditional');

    expect(canOverrideInspection(inspection.inspection_id, 'passed').valid).toBe(true);
    const override = overrideInspection(inspection.inspection_id, 'passed', 'Desviación menor aceptada', 'emp-003');
    expect(override.overall_result).toBe('passed');
  });
});
