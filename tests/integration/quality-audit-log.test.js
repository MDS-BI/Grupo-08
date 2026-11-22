import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  loadCollection,
  updateNonConformance,
  deleteNonConformance,
  addCorrectiveAction,
  updateCorrectiveAction,
  deleteCorrectiveAction,
  findAuditEntries
} from '../../src/storage.js';
import { bootQualityApp, qs, submit } from '../support/quality-dom.js';

let dom;

function createFailedInspection(reference = 'gr-001') {
  const plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
  const criterion = addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true
  });
  const inspection = addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: reference,
    inspection_date: '2026-11-09'
  });
  completeInspection(inspection.inspection_id, 'failed', [
    {
      criteria_id: criterion.criteria_id,
      measured_value: 99,
      pass_fail: false
    }
  ]);
  return { plan, inspection };
}

function makeCapa(nc) {
  return addCorrectiveAction({
    non_conformance_id: nc.non_conformance_id,
    responsible_employee_id: 'emp-003',
    action_description: 'Reprocesar el lote',
    root_cause: 'Falla de calibración',
    action_type: 'rework',
    due_date: '2026-12-01',
    status: 'pending'
  });
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 10 - quality audit log', () => {
  it('records the complete flow without duplicating the override', () => {
    const { inspection } = createFailedInspection();
    const created = findAuditEntries({
      entity_type: 'inspection',
      action: 'create',
      entity_id: inspection.inspection_id
    });
    expect(created.length).toBe(1);
    expect(created[0].reference_module).toBe('goods_receipt');
    expect(created[0].reference_id).toBe('gr-001');
    expect(created[0].before_value).toBeNull();
    expect(created[0].after_value).toBe('draft');

    const updatesBeforeOverride = findAuditEntries({
      entity_type: 'inspection',
      action: 'update',
      entity_id: inspection.inspection_id
    }).length;
    qs('nav-quality-nc').click();
    qs('override-inspection').value = inspection.inspection_id;
    qs('override-result').value = 'conditional';
    qs('override-user').value = 'emp-003';
    qs('override-justification').value = 'Desviación menor aceptada';
    submit(dom.window, 'override-form');

    const changes = findAuditEntries({
      entity_type: 'inspection',
      action: 'status_change',
      entity_id: inspection.inspection_id
    }).filter((audit) => audit.changed_field === 'overall_result');
    expect(changes.length).toBe(1);
    expect(changes[0].after_value).toBe('conditional');
    expect(changes[0].justification).toBe('Desviación menor aceptada');
    expect(changes[0].actor).toBe('emp-003');
    expect(
      findAuditEntries({ entity_type: 'inspection', action: 'update', entity_id: inspection.inspection_id }).length
    ).toBe(updatesBeforeOverride);

    const nc = loadCollection('non_conformances')[0];
    updateNonConformance(nc.non_conformance_id, { status: 'closed' });
    const ncChanges = findAuditEntries({ entity_type: 'non_conformance', action: 'status_change' });
    expect(ncChanges.length).toBe(1);
    expect(ncChanges[0].after_value).toBe('closed');
    expect(ncChanges[0].reference_id).toBe('gr-001');

    const capa = makeCapa(nc);
    updateCorrectiveAction(capa.corrective_action_id, { status: 'completed' });
    const capaChanges = findAuditEntries({ entity_type: 'corrective_action', action: 'status_change' });
    expect(capaChanges.length).toBe(1);
    expect(capaChanges[0].after_value).toBe('completed');
    expect(capaChanges[0].actor).toBe('emp-003');

    deleteCorrectiveAction(capa.corrective_action_id);
    const deletions = findAuditEntries({ entity_type: 'corrective_action', action: 'delete' });
    expect(deletions.length).toBe(1);
    expect(deletions[0].after_value).toBeNull();
    expect(deletions[0].reference_id).toBe('gr-001');
  });

  it('keeps delete entries after allowed deletions and cascades (FR-049)', () => {
    const { inspection } = createFailedInspection();
    const nc = loadCollection('non_conformances')[0];
    makeCapa(nc);

    deleteNonConformance(nc.non_conformance_id);

    expect(findAuditEntries({ entity_type: 'non_conformance', action: 'delete' }).length).toBe(1);
    expect(findAuditEntries({ entity_type: 'corrective_action', action: 'delete' }).length).toBe(1);
    expect(findAuditEntries({ reference_id: 'gr-001', action: 'delete' }).length).toBe(2);
    expect(inspection.inspection_id).toBeTruthy();
  });

  it('filters the view by lot, clears filters and reports an inverted range', () => {
    createFailedInspection();
    qs('nav-quality-audit').click();
    expect(qs('view-quality-audit-log').hidden).toBe(false);
    const rows = qs('audit-log-body').querySelectorAll('tr');
    expect(rows.length).toBeGreaterThan(0);
    expect(qs('audit-log-body').textContent).toContain('gr-001');

    qs('audit-filter-reference').value = 'gr-002';
    submit(dom.window, 'audit-filter-form');
    expect(qs('audit-log-body').querySelectorAll('tr').length).toBe(0);
    expect(qs('audit-log-empty').hidden).toBe(false);

    qs('audit-filter-clear').click();
    expect(qs('audit-log-body').querySelectorAll('tr').length).toBe(rows.length);
    expect(qs('audit-log-empty').hidden).toBe(true);

    qs('audit-filter-from').value = '2026-11-30';
    qs('audit-filter-to').value = '2026-11-01';
    submit(dom.window, 'audit-filter-form');
    expect(qs('audit-log-error').textContent).toContain('rango de fechas es inválido');
    expect(qs('audit-log-body').querySelectorAll('tr').length).toBe(rows.length);
  });
});
