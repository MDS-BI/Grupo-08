import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addCriterion,
  addInspection,
  addPlan,
  clearQualityData,
  completeInspection,
  loadCollection,
  loadExternal,
  loadQualitySettings,
  qualityParameter,
  updateQualityParameters
} from '../../src/storage.js';
import { bootQualityApp, qs, submit } from '../support/quality-dom.js';

let dom;

function click(id){
  qs(id).click();
}

function fill(id, value){
  qs(id).value = value;
}

beforeEach(async () => {
  dom = await bootQualityApp();
  clearQualityData();
  dom.window.confirm = vi.fn(() => true);
  dom.window.alert = vi.fn();
  click('nav-quality-settings');
});

afterEach(() => {
  dom.window.close();
});

describe('Quality configuration workspace', () => {
  it('renders the seven requested sections with a navigable internal menu', () => {
    expect(qs('qset-view-heading').textContent).toBe('Configuración');
    expect(document.querySelectorAll('#qset-tabs [data-qset-tab]').length).toBe(7);
    expect(document.querySelectorAll('[data-qset-panel]').length).toBe(7);
    expect(qs('qset-panel-inspection-categories').hidden).toBe(false);
    click('qset-tab-nc-statuses');
    expect(qs('qset-panel-inspection-categories').hidden).toBe(true);
    expect(qs('qset-panel-nc-statuses').hidden).toBe(false);
    expect(qs('qset-rows-nc-statuses').textContent).toContain('Solucionada');
  });

  it('creates, edits and deletes catalog items while protecting system entries', () => {
    click('qset-tab-severity-levels');
    const systemRow = [...qs('qset-rows-severity-levels').querySelectorAll('tr')]
      .find(row => row.textContent.includes('Alta'));
    expect(systemRow.querySelector('[data-qset-action="delete"]').disabled).toBe(true);

    click('qset-add-severity-levels');
    fill('qset-field-key', 'Observación menor');
    fill('qset-field-label', 'Observación');
    fill('qset-field-description', 'Desviación documental menor.');
    submit(dom.window, 'qset-modal-form');

    let tbody = qs('qset-rows-severity-levels');
    expect(tbody.textContent).toContain('observacion_menor');
    expect(tbody.textContent).toContain('Observación');
    expect(qs('qset-modal').hidden).toBe(true);

    const customRow = [...tbody.querySelectorAll('tr')]
      .find(row => row.textContent.includes('observacion_menor'));
    customRow.querySelector('[data-qset-action="edit"]').click();
    fill('qset-field-label', 'Observación leve');
    submit(dom.window, 'qset-modal-form');

    tbody = qs('qset-rows-severity-levels');
    expect(tbody.textContent).toContain('Observación leve');
    const editedRow = [...tbody.querySelectorAll('tr')]
      .find(row => row.textContent.includes('observacion_menor'));
    editedRow.querySelector('[data-qset-action="delete"]').click();
    expect(qs('qset-rows-severity-levels').textContent).not.toContain('observacion_menor');
  });

  it('creates quality criteria from the configuration screen', () => {
    const productId = loadExternal('products')[0].product_id;
    const plan = addPlan({ plan_name: 'Plan de configuración', product_id: productId, applicable_stage: 'final' });
    click('qset-tab-criteria');
    click('qset-add-criteria');
    fill('qset-criteria-plan', plan.inspection_plan_id);
    fill('qset-criteria-name', 'Densidad');
    fill('qset-criteria-expected', '1.2');
    fill('qset-criteria-tolerance', '0.1');
    fill('qset-criteria-unit', 'g/cm3');
    fill('qset-criteria-comparison', 'range');
    submit(dom.window, 'qset-modal-form');

    const rows = qs('qset-rows-criteria').textContent;
    expect(rows).toContain('Plan de configuración');
    expect(rows).toContain('Densidad');
    expect(rows).toContain('g/cm3');
  });

  it('saves general parameters and applies the approval target to reports', () => {
    click('qset-tab-parameters');
    fill('qset-param-approval-target', '85');
    submit(dom.window, 'qset-parameters-form');
    expect(qs('qset-params-message').textContent).toBe('Parámetros guardados correctamente.');
    expect(qualityParameter('approval_target')).toBe(85);

    click('nav-quality-reports');
    expect(qs('rep-compliance-subtitle').textContent).toContain('objetivo del 85%');
    expect(qs('rep-chart-compliance').textContent).toContain('Objetivo 85%');
  });

  it('uses configured defaults and auto-NC parameter when completing inspections', () => {
    const productId = loadExternal('products')[0].product_id;
    const referenceId = loadExternal('goods_receipt')[0].goods_receipt_id;
    const plan = addPlan({ plan_name: 'Plan parametrizado', product_id: productId, applicable_stage: 'incoming' });
    const criterion = addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    updateQualityParameters({
      approval_target: 90,
      auto_create_nc_on_failure: false,
      default_nc_severity: 'critical',
      default_nc_status: 'under_review',
      default_inspection_stage: 'final'
    });

    const failedInspection = addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: referenceId,
      inspection_date: '2026-11-20'
    });
    completeInspection(failedInspection.inspection_id, 'failed', [{
      criteria_id: criterion.criteria_id,
      measured_value: 99,
      pass_fail: false
    }]);
    expect(loadCollection('non_conformances').length).toBe(0);

    updateQualityParameters({ auto_create_nc_on_failure: true });
    const secondInspection = addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: referenceId,
      inspection_date: '2026-11-21'
    });
    completeInspection(secondInspection.inspection_id, 'failed', [{
      criteria_id: criterion.criteria_id,
      measured_value: 99,
      pass_fail: false
    }]);

    const generated = loadCollection('non_conformances');
    expect(generated.length).toBe(1);
    expect(generated[0].severity).toBe('critical');
    expect(generated[0].status).toBe('under_review');
    expect(loadQualitySettings().parameters.default_inspection_stage).toBe('final');
  });
});
