import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs, submit } from '../support/quality-dom.js';

let dom;

function createInspection({ reference = 'gr-001', critical = true, result = 'failed' } = {}){
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
  completeInspection(inspection.inspection_id, result, [{
    criteria_id: criterion.criteria_id,
    measured_value: 99,
    pass_fail: false
  }]);
  return { plan, criterion, inspection };
}

function fillOverride(inspection, result, justification = 'Revisión documentada del lote'){
  qs('override-inspection').value = inspection.inspection_id;
  qs('override-result').value = result;
  qs('override-user').value = 'emp-003';
  qs('override-justification').value = justification;
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 4 - review, override and quarantine', () => {
  it('blocks passing an inspection with failed critical criteria', () => {
    const { inspection } = createInspection({ critical: true, result: 'failed' });
    qs('nav-quality-nc').click();

    fillOverride(inspection, 'passed');
    submit(dom.window, 'override-form');

    expect(qs('override-error').textContent).toContain('No se puede aprobar');
    const stored = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(stored.overall_result).toBe('failed');
    expect(stored.override_justification).toBeUndefined();
  });

  it('records justification, user and date when the verdict changes', () => {
    const { inspection } = createInspection({ critical: true, result: 'failed' });
    qs('nav-quality-nc').click();

    fillOverride(inspection, 'conditional', 'Se reprocesa y se re-inspecciona');
    submit(dom.window, 'override-form');

    const stored = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(stored.overall_result).toBe('conditional');
    expect(stored.override_justification).toBe('Se reprocesa y se re-inspecciona');
    expect(stored.overridden_by).toBe('emp-003');
    expect(stored.override_at).toBeDefined();
    expect(qs('review-body').querySelectorAll('tr').length).toBe(1);
  });

  it('requires a justification for the manual verdict change', () => {
    const { inspection } = createInspection({ critical: true, result: 'failed' });
    qs('nav-quality-nc').click();

    fillOverride(inspection, 'conditional', '');
    submit(dom.window, 'override-form');

    expect(qs('override-error').textContent).toContain('justificación');
  });

  it('allows passing a conditional inspection with only non-critical deviations', () => {
    const { inspection } = createInspection({ reference: 'gr-002', critical: false, result: 'conditional' });
    qs('nav-quality-nc').click();

    fillOverride(inspection, 'passed', 'Desviación menor aceptada por el Jefe de Calidad');
    submit(dom.window, 'override-form');

    const stored = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(stored.overall_result).toBe('passed');
  });

  it('allows a manual failed verdict without generating a non-conformance (FR-034)', () => {
    const { inspection } = createInspection({ reference: 'gr-002', critical: false, result: 'conditional' });
    expect(loadCollection('non_conformances').length).toBe(0);
    qs('nav-quality-nc').click();

    fillOverride(inspection, 'failed', 'Rechazo documentado del lote');
    submit(dom.window, 'override-form');

    const stored = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(stored.overall_result).toBe('failed');
    expect(stored.inspection_status).toBe('completed');
    expect(stored.override_at).toBeDefined();
    expect(loadCollection('non_conformances').length).toBe(0);
  });

  it('requires confirmation and a reason before a manual rejection', () => {
    const { inspection } = createInspection({ reference: 'gr-002', critical: false, result: 'conditional' });
    qs('nav-quality-nc').click();

    fillOverride(inspection, 'failed', '');
    submit(dom.window, 'override-form');
    expect(qs('override-error').textContent).toContain('justificación');

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    fillOverride(inspection, 'failed', 'Rechazo documentado');
    submit(dom.window, 'override-form');
    let stored = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(stored.overall_result).toBe('conditional');
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    submit(dom.window, 'override-form');
    stored = loadCollection('quality_inspections').find(i => i.inspection_id === inspection.inspection_id);
    expect(stored.overall_result).toBe('failed');
    expect(stored.override_justification).toBe('Rechazo documentado');
    confirmSpy.mockRestore();
  });

  it('lists the lot in quarantine with the treatment label when CAPA exists', () => {
    createInspection({ reference: 'gr-001', critical: true, result: 'failed' });
    qs('nav-quality-nc').click();

    expect(qs('quarantine-body').textContent).toContain('gr-001');
    expect(qs('quarantine-body').textContent).toContain('Cuarentena');
    expect(qs('quarantine-body').textContent).toContain('major');
  });
});
