import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSeedData,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs, submit } from '../support/quality-dom.js';

let dom;

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('Full quality flow', () => {
  it('goes from plan creation to pending lot inspection, non-conformance, CAPA and history', () => {
    qs('nav-quality-plans').click();

    qs('plan-name').value = 'Plan integral';
    qs('plan-product').value = 'prod-001';
    qs('plan-stage').value = 'incoming';
    submit(dom.window, 'plan-form');

    const plan = loadCollection('quality_inspection_plans')[0];
    expect(plan).toBeDefined();
    expect(plan.plan_name).toBe('Plan integral');

    qs('criteria-plan').value = plan.inspection_plan_id;
    qs('criteria-plan').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    qs('criteria-name').value = 'Peso';
    qs('criteria-expected').value = '10';
    qs('criteria-tolerance').value = '1';
    qs('criteria-unit').value = 'kg';
    qs('criteria-comparison').value = 'range';
    qs('criteria-critical').checked = true;
    submit(dom.window, 'criteria-form');

    expect(loadCollection('quality_inspection_criteria').length).toBe(1);

    qs('nav-quality-lots').click();
    qs('pending-lots-body').querySelector('button[data-inspect-reference="gr-001"]').click();

    qs('inspection-plan').value = plan.inspection_plan_id;
    qs('inspection-plan').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    qs('inspection-inspector').value = 'emp-001';
    qs('inspection-date').value = '2026-11-09';
    const measurement = qs('inspection-measurements').querySelector('input[data-criteria-id]');
    measurement.value = '99';
    measurement.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    qs('inspection-complete').click();

    const inspection = loadCollection('quality_inspections')[0];
    expect(inspection.inspection_status).toBe('completed');
    expect(inspection.overall_result).toBe('failed');

    const nc = loadCollection('non_conformances')[0];
    expect(nc).toBeDefined();
    expect(nc.status).toBe('open');

    qs('nav-quality-nc').click();
    qs('capa-nc').value = nc.non_conformance_id;
    qs('capa-responsible').value = 'emp-003';
    qs('capa-description').value = 'Reprocesar el lote';
    qs('capa-root').value = 'Falla de calibración';
    qs('capa-type').value = 'rework';
    qs('capa-due').value = '2099-01-01';
    qs('capa-status').value = 'pending';
    submit(dom.window, 'capa-form');

    expect(loadCollection('corrective_actions').length).toBe(1);

    qs('nav-quality-history').click();
    const row = qs('history-body').querySelector('tr');
    expect(row.textContent).toContain('gr-001');
    expect(row.textContent).toContain(nc.non_conformance_id);
    expect(row.textContent).toContain('1 acción(es)');
  });
});
