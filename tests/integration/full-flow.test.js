import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';
import { pendingLotsRows } from '../../src/components/pending-lots.js';
import { filterInspections, historyCsv } from '../../src/components/inspection-history.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function approvedPlan(name, isCritical = true){
  const plan = q.addPlan({ plan_name: name, product_id: 'prod-001', applicable_stage: 'incoming' });
  q.addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: isCritical
  });
  q.submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
  q.approvePlan(plan.inspection_plan_id, 'jefe_calidad');
  return { plan, criterion: q.planCriteria(plan.inspection_plan_id)[0] };
}

function runInspection(plan, criterion, reference, measuredValue, passFail, decision, justification){
  const inspection = q.addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: reference,
    inspection_date: '2026-11-09'
  });
  q.setInspectionResults(inspection.inspection_id, [{
    criteria_id: criterion.criteria_id,
    measured_value: measuredValue,
    pass_fail: passFail
  }]);
  const submitted = q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
  const reviewed = q.reviewInspection(inspection.inspection_id, decision, 'jefe_calidad', justification);
  return { inspection, submitted, reviewed };
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
});

describe('full quality flow', () => {
  it('goes from pending lot to rejected inspection, non-conformance and approved CAPA with history', () => {
    expect(pendingLotsRows().map(row => row.reference_id)).toContain('gr-001');
    const { plan, criterion } = approvedPlan('Plan integral');

    const inspection = q.addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-001',
      inspection_date: '2026-11-09'
    });
    q.setInspectionResults(inspection.inspection_id, [{
      criteria_id: criterion.criteria_id,
      measured_value: 99,
      pass_fail: false
    }]);
    const submitted = q.submitInspectionForReview(inspection.inspection_id, 'emp-001');
    expect(submitted.proposed_result).toBe('failed');
    expect(pendingLotsRows().map(row => row.reference_id)).toContain('gr-001');

    const reviewed = q.reviewInspection(inspection.inspection_id, 'rejected', 'jefe_calidad', 'Lote conforme no');
    expect(reviewed.inspection_status).toBe('completed');
    expect(reviewed.overall_result).toBe('failed');
    expect(pendingLotsRows().map(row => row.reference_id)).not.toContain('gr-001');
    const nc = q.loadCollection('non_conformances')[0];
    expect(nc.status).toBe('open');

    let capa = q.addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar lote',
      root_cause: 'Calibración',
      action_type: 'rework',
      due_date: '2099-01-01',
      progress: 0,
      status: 'pending'
    });
    capa = q.updateCorrectiveAction(capa.corrective_action_id, { status: 'in_progress', progress: 50 });
    capa = q.updateCorrectiveAction(capa.corrective_action_id, { status: 'completed', progress: 100 });
    capa = q.requestCapaClosure(capa.corrective_action_id, 'emp-003');
    capa = q.registerCapaEffectiveness(capa.corrective_action_id, 'effective', 'Sin recurrencia', 'jefe_calidad');
    capa = q.reviewCapaClosure(capa.corrective_action_id, 'approved', null, null, 'jefe_calidad');
    expect(capa.closure_status).toBe('approved');
    expect(q.capaEffectiveness()).toBe(100);

    const historyRows = filterInspections(q.loadCollection('quality_inspections'), {
      module: 'goods_receipt',
      lot: 'goods_receipt:gr-001',
      from: '2026-11-01',
      to: '2026-11-30',
      search: ''
    });
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].inspection_id).toBe(inspection.inspection_id);
    const csv = historyCsv(historyRows);
    expect(csv).toContain('gr-001');
    expect(csv).toContain('Peso:99:No');

    const inspectionAudit = q.findAuditEntries({ entity_type: 'inspection', entity_id: inspection.inspection_id });
    expect(inspectionAudit.filter(entry => entry.action === 'reject')).toHaveLength(1);
    expect(inspectionAudit.filter(entry => entry.action === 'status_change' && entry.changed_field === 'overall_result')).toHaveLength(0);
    const capaAudit = q.findAuditEntries({ entity_type: 'corrective_action', entity_id: capa.corrective_action_id });
    expect(capaAudit.filter(entry => entry.action === 'approve' && entry.changed_field === 'closure_status')).toHaveLength(1);
  });

  it('does not create a non-conformance for conditional review or a completed inspection override', () => {
    const main = approvedPlan('Plan principal');
    runInspection(main.plan, main.criterion, 'gr-001', 99, false, 'rejected', 'Lote conforme no');
    const ncCountAfterMain = q.loadCollection('non_conformances').length;
    expect(ncCountAfterMain).toBe(1);

    const conditional = approvedPlan('Plan condicional', false);
    const conditionalFlow = runInspection(
      conditional.plan,
      conditional.criterion,
      'gr-002',
      99,
      false,
      'approved_conditional',
      'Desviación no crítica'
    );
    expect(conditionalFlow.reviewed.overall_result).toBe('conditional');
    expect(q.loadCollection('non_conformances')).toHaveLength(ncCountAfterMain);

    const overrideSource = approvedPlan('Plan para override');
    const passedFlow = runInspection(
      overrideSource.plan,
      overrideSource.criterion,
      'gr-003',
      10,
      true,
      'approved',
      'Conforme'
    );
    const ncCountBeforeOverride = q.loadCollection('non_conformances').length;
    const overridden = q.overrideInspection(
      passedFlow.inspection.inspection_id,
      'failed',
      'Cambio manual controlado',
      'jefe_calidad'
    );
    expect(overridden.inspection_status).toBe('completed');
    expect(overridden.overall_result).toBe('failed');
    expect(q.loadCollection('non_conformances')).toHaveLength(ncCountBeforeOverride);

    const overrideAudit = q.findAuditEntries({
      entity_type: 'inspection',
      entity_id: passedFlow.inspection.inspection_id
    });
    expect(overrideAudit.filter(entry => entry.action === 'status_change' && entry.changed_field === 'overall_result')).toHaveLength(1);
  });
});
