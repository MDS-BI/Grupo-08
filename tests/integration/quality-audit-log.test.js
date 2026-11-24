import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function submittedInspection() {
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
  q.setInspectionResults(inspection.inspection_id, [
    {
      criteria_id: criterion.criteria_id,
      measured_value: 10,
      pass_fail: true
    }
  ]);
  return q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
}

function seedTimedAuditData(count) {
  const timestamp = '2026-11-15T12:00:00.000Z';
  const inspections = [];
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const inspectionId = `audit-inspection-${index}`;
    inspections.push({
      id: `audit-inspection-id-${index}`,
      inspection_id: inspectionId,
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      inspection_status: 'completed',
      proposed_result: 'passed',
      overall_result: 'passed',
      review_decision: 'approved',
      reviewed_by: 'jefe_calidad',
      reviewed_at: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    entries.push({
      id: `audit-entry-${index}`,
      entity_type: 'inspection',
      entity_id: inspectionId,
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      action: 'approve',
      changed_field: 'overall_result',
      before_value: null,
      after_value: { overall_result: 'passed' },
      actor: 'jefe_calidad',
      timestamp,
      justification: 'Revisión de prueba'
    });
  }
  q.saveCollection('quality_inspections', inspections);
  q.saveCollection('quality_audit_log', entries);
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
  q.clearAuditEntries();
});

describe('quality audit log', () => {
  it('does not audit denied operations', () => {
    q.setActiveRole('inspector');
    expect(() => q.addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' })).toThrow();
    expect(q.findAuditEntries()).toHaveLength(0);
  });

  it('records one entry for plan creation, submission and approval', () => {
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

    const entries = q.findAuditEntries({ entity_type: 'inspection_plan', entity_id: plan.inspection_plan_id });
    expect(entries.map((entry) => entry.action)).toEqual(['create', 'status_change', 'approve']);
    expect(entries[2].after_value.status).toBe('approved');
    expect(entries[2].after_value.reviewed_by).toBe('jefe_calidad');
  });

  it('records a single final decision without a second status change', () => {
    const inspection = submittedInspection();
    q.reviewInspection(inspection.inspection_id, 'approved', 'jefe_calidad', 'Conforme');
    const entries = q.findAuditEntries({ entity_type: 'inspection', entity_id: inspection.inspection_id });
    expect(entries.filter((entry) => entry.action === 'approve')).toHaveLength(1);
    expect(entries.some((entry) => entry.action === 'status_change' && entry.changed_field === 'overall_result')).toBe(
      false
    );
  });

  it('keeps effectiveness review and CAPA decision as separate entries', () => {
    const nc = q.addNonConformance({
      product_id: 'prod-001',
      description: 'NC',
      defect_type: 'other',
      severity: q.qualityCatalogKeys('severity_levels')[0],
      status: q.qualityCatalogKeys('nc_statuses')[0]
    });
    let action = q.addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-001',
      action_description: 'Acción',
      root_cause: 'Causa',
      action_type: 'rework',
      due_date: '2099-01-01',
      progress: 0,
      status: 'pending'
    });
    action = q.updateCorrectiveAction(action.corrective_action_id, { status: 'completed', progress: 100 });
    q.requestCapaClosure(action.corrective_action_id, 'emp-001');
    q.registerCapaEffectiveness(action.corrective_action_id, 'effective', 'Observaciones', 'jefe_calidad');
    q.reviewCapaClosure(action.corrective_action_id, 'approved', null, null, 'jefe_calidad');

    const entries = q.findAuditEntries({ entity_type: 'corrective_action', entity_id: action.corrective_action_id });
    expect(entries.some((entry) => entry.action === 'review' && entry.changed_field === 'effectiveness_result')).toBe(
      true
    );
    expect(entries.some((entry) => entry.action === 'approve' && entry.changed_field === 'closure_status')).toBe(true);
  });

  it('keeps delete entries after the record is removed', () => {
    const plan = q.addPlan({ plan_name: 'Temporal', product_id: 'prod-001', applicable_stage: 'incoming' });
    q.deletePlan(plan.inspection_plan_id);
    const entries = q.findAuditEntries({ entity_type: 'inspection_plan', entity_id: plan.inspection_plan_id });
    expect(entries.map((entry) => entry.action)).toEqual(['create', 'delete']);
    expect(entries[1].after_value).toBeNull();
  });

  it('filters audit entries with 500 inspections within the SC-016 time budget', () => {
    seedTimedAuditData(500);

    const startedAt = performance.now();
    const entries = q.findAuditEntries({
      entity_type: 'inspection',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      desde: '2026-11-01',
      hasta: '2026-11-30'
    });
    const elapsedMs = performance.now() - startedAt;

    console.info(`[SC-016] consulta filtrada de bitácora con 500 inspecciones en ${elapsedMs.toFixed(2)} ms`);
    expect(entries).toHaveLength(500);
    expect(elapsedMs).toBeLessThan(2000);
  });
});
