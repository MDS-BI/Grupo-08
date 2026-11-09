import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  loadCollection,
  externalDocuments,
  derivePendingLots
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;

function makePlan(criteria = [{}]){
  const plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
  criteria.forEach((overrides, index) => {
    addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: `Criterio ${index + 1}`,
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true,
      ...overrides
    });
  });
  return plan;
}

function selectInspectionHeader(plan, reference = 'gr-001'){
  qs('inspection-plan').value = plan.inspection_plan_id;
  qs('inspection-plan').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  qs('inspection-inspector').value = 'emp-001';
  qs('inspection-module').value = 'goods_receipt';
  qs('inspection-module').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  qs('inspection-reference').value = reference;
  qs('inspection-date').value = '2026-11-09';
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 2 - pending lots and automatic evaluation', () => {
  it('lists pending lots and preselects the lot when inspecting', () => {
    qs('nav-quality-lots').click();
    expect(qs('view-pending-lots').hidden).toBe(false);
    const rows = qs('pending-lots-body').querySelectorAll('tr');
    expect(rows.length).toBe(externalDocuments().length);
    expect(qs('pending-lots-empty').hidden).toBe(true);

    const firstButton = qs('pending-lots-body').querySelector('button[data-inspect-module]');
    firstButton.click();
    expect(qs('view-inspections').hidden).toBe(false);
    expect(qs('inspection-module').value).toBe(firstButton.dataset.inspectModule);
    expect(qs('inspection-reference').value).toBe(firstButton.dataset.inspectReference);
  });

  it('saves a draft while measurements are missing and keeps the lot pending', () => {
    const plan = makePlan([{}, {}]);
    qs('nav-quality-inspections').click();
    selectInspectionHeader(plan);

    const inputs = qs('inspection-measurements').querySelectorAll('input[data-criteria-id]');
    inputs[0].value = '10';
    inputs[0].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    qs('inspection-complete').click();

    const inspections = loadCollection('quality_inspections');
    expect(inspections.length).toBe(1);
    expect(inspections[0].inspection_status).toBe('draft');
    expect(inspections[0].overall_result).toBeNull();
    expect(qs('inspection-error').textContent).toContain('faltan');

    const pending = derivePendingLots(externalDocuments(), inspections);
    expect(pending.map(d => `${d.reference_module}:${d.reference_id}`)).toContain('goods_receipt:gr-001');
  });

  it('completes an inspection with an automatic passed verdict and removes the lot from pending', () => {
    const plan = makePlan([{ is_critical: true }]);
    qs('nav-quality-inspections').click();
    selectInspectionHeader(plan);

    const input = qs('inspection-measurements').querySelector('input[data-criteria-id]');
    input.value = '10.5';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    expect(qs('inspection-verdict').textContent).toContain('Aprobado');
    qs('inspection-complete').click();

    const inspections = loadCollection('quality_inspections');
    expect(inspections.length).toBe(1);
    expect(inspections[0].inspection_status).toBe('completed');
    expect(inspections[0].overall_result).toBe('passed');

    const pending = derivePendingLots(externalDocuments(), inspections);
    expect(pending.map(d => `${d.reference_module}:${d.reference_id}`)).not.toContain('goods_receipt:gr-001');
  });

  it('rejects orphan references at storage level', () => {
    const plan = makePlan();
    expect(() => addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: 'gr-999',
      inspection_date: '2026-11-09'
    })).toThrow();
  });
});
