import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  addCorrectiveAction,
  evidenceFor,
  loadCollection,
  loadExternal
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;

function createFailedInspection(){
  const reference = loadExternal('goods_receipt')[0].goods_receipt_id;
  const plan = addPlan({ plan_name: 'Plan CAPA', product_id: 'prod-001', applicable_stage: 'incoming' });
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
    inspection_date: '2026-11-20'
  });
  completeInspection(inspection.inspection_id, 'failed', [{
    criteria_id: criterion.criteria_id,
    measured_value: 99,
    pass_fail: false
  }]);
  return inspection;
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('Dedicated corrective and preventive actions workspace', () => {
  it('renders summary cards, due badges and the requested table columns', () => {
    createFailedInspection();
    const nc = loadCollection('non_conformances')[0];
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar lote retrasado',
      root_cause: 'Falla de calibración',
      action_type: 'rework',
      start_date: '2026-11-01',
      due_date: '2020-01-01',
      status: 'pending'
    });

    qs('nav-quality-capa').click();

    expect(qs('capa-view-heading').textContent).toBe('Acciones Correctivas y Preventivas');
    expect(document.querySelector('#view-corrective-actions').hidden).toBe(false);
    expect(document.querySelector('#view-corrective-actions .muted').textContent)
      .toBe('Seguimiento de medidas para mejorar la calidad.');
    expect(qs('capm-create').textContent).toContain('Nueva acción');
    expect(qs('capm-summary').textContent).toContain('Acciones pendientes');
    expect(qs('capm-summary').textContent).toContain('En ejecución');
    expect(qs('capm-summary').textContent).toContain('Completadas');
    expect(qs('capm-summary').textContent).toContain('Fuera de plazo');
    const headers = [...document.querySelectorAll('#capm-list thead th')].map(th => th.textContent.trim());
    expect(headers).toEqual([
      'Código de acción', 'Descripción', 'No conformidad relacionada', 'Tipo de acción',
      'Responsable', 'Fecha de inicio', 'Fecha límite', 'Estado', 'Progreso', 'Acciones'
    ]);
    expect(qs('capm-list').querySelector('.table-scroll table.capa-table')).not.toBeNull();
    expect(qs('capm-list').textContent).toContain('Reprocesar lote retrasado');
    expect(qs('capm-list').textContent).toContain('Fuera de plazo');
    expect(qs('capm-list').textContent).toContain('Pendiente');
    expect(qs('capm-list').textContent).toContain('0%');
  });

  it('registers a preventive action with expected result, evidence and tracking detail', async () => {
    createFailedInspection();
    const nc = loadCollection('non_conformances')[0];
    qs('nav-quality-capa').click();
    qs('capm-create').click();
    expect(qs('capm-form-card').hidden).toBe(false);

    qs('capm-category').value = 'preventive';
    qs('capm-description').value = 'Ajustar procedimiento de recepción';
    qs('capm-nc').value = nc.non_conformance_id;
    qs('capm-responsible').value = 'emp-001';
    qs('capm-root').value = 'Procedimiento incompleto';
    qs('capm-type').value = 'resampling';
    qs('capm-start-date').value = '2026-11-20';
    qs('capm-due-date').value = '2026-12-01';
    qs('capm-expected-result').value = 'Evitar desviaciones repetidas';
    qs('capm-status').value = 'in_progress';
    const file = new dom.window.File([new Uint8Array([1, 2, 3])], 'plan.png', { type: 'image/png' });
    Object.defineProperty(qs('capm-files'), 'files', { value: [file], configurable: true });
    qs('capm-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(qs('capm-detail-card').hidden).toBe(false);
    });
    const action = loadCollection('corrective_actions')[0];
    expect(action.action_category).toBe('preventive');
    expect(action.start_date).toBe('2026-11-20');
    expect(action.expected_result).toBe('Evitar desviaciones repetidas');
    expect(action.progress).toBe(50);
    expect(evidenceFor('corrective_action', action.corrective_action_id).length).toBe(1);
    expect(qs('capm-detail-body').textContent).toContain('Historial de cambios');
    expect(qs('capm-detail-body').textContent).toContain('Registro creado');
    expect(qs('capm-detail-body').textContent).toContain('Avance de la acción');
    expect(qs('capm-detail-body').textContent).toContain('plan.png');
    expect(qs('capm-detail-body').textContent).toContain('Preventiva');
    expect(qs('capm-detail-body').textContent).toContain('50%');
  });

  it('filters by status and updates progress and observations from the detail', () => {
    const inspection = createFailedInspection();
    const nc = loadCollection('non_conformances')[0];
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-002',
      action_description: 'Capacitar al inspector',
      root_cause: `Inspección ${inspection.inspection_id}`,
      action_type: 'other',
      start_date: '2026-11-20',
      due_date: '2026-12-15',
      status: 'pending'
    });

    qs('nav-quality-capa').click();
    qs('capm-status-filter').value = 'in_progress';
    qs('capm-status-filter').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(qs('capm-empty').hidden).toBe(false);

    qs('capm-status-filter').value = 'pending';
    qs('capm-status-filter').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(qs('capm-list').textContent).toContain('Capacitar al inspector');
    qs('capm-list').querySelector('button[data-capm-detail]').click();
    expect(qs('capm-detail-card').hidden).toBe(false);

    const progress = qs('capm-progress-input');
    progress.value = '70';
    progress.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(qs('capm-progress-output').textContent).toBe('70%');
    qs('capm-detail-body').querySelector('button[data-capm-progress-save]').click();
    expect(loadCollection('corrective_actions')[0].progress).toBe(70);

    qs('capm-observations-input').value = 'Avance validado con supervisor';
    qs('capm-detail-body').querySelector('button[data-capm-observations-save]').click();
    expect(loadCollection('corrective_actions')[0].observations).toBe('Avance validado con supervisor');
    expect(qs('capm-detail-body').textContent).toContain('Avance validado con supervisor');
  });
});
