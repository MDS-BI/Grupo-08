import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  submitPlanForApproval,
  approvePlan,
  setInspectionResults,
  submitInspectionForReview,
  reviewInspection,
  addCorrectiveAction,
  updateCorrectiveAction,
  requestCapaClosure,
  registerCapaEffectiveness,
  reviewCapaClosure,
  evidenceFor,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs, submit } from '../support/quality-dom.js';

let dom;

function createFailedInspection(reference = 'gr-001', critical = true, finalize = true){
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
  submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
  approvePlan(plan.inspection_plan_id, 'jefe_calidad');
  const inspection = addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: reference,
    inspection_date: '2026-11-09'
  });
  setInspectionResults(inspection.inspection_id, [{
    criteria_id: criterion.criteria_id,
    measured_value: 99,
    pass_fail: false
  }]);
  submitInspectionForReview(inspection.inspection_id, 'emp-001');
  if(!finalize) return { plan, criterion, inspection };
  const decision = critical ? 'rejected' : 'approved_conditional';
  const reviewed = reviewInspection(inspection.inspection_id, decision, 'jefe_calidad', 'Revisión de prueba');
  return { plan, criterion, inspection: reviewed };
}

function fillCapa(nc, overrides = {}){
  qs('capa-nc').value = nc.non_conformance_id;
  qs('capa-responsible').value = 'emp-003';
  qs('capa-description').value = 'Reprocesar el lote';
  qs('capa-root').value = 'Falla de calibración';
  qs('capa-type').value = 'rework';
  qs('capa-due').value = overrides.dueDate || '2026-12-01';
  qs('capa-status').value = overrides.status || 'pending';
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 3 - non-conformances and CAPA', () => {
  it('shows the automatically generated non-conformance after a failed inspection', () => {
    createFailedInspection();
    qs('quality-non-conformances').click();

    const ncs = loadCollection('non_conformances');
    expect(ncs.length).toBe(1);
    expect(qs('nc-list').textContent).toContain('Peso');
    expect(qs('nc-list').textContent).toContain('other');
    expect(qs('nc-list').querySelector('.table-scroll table.nc-table')).not.toBeNull();
    expect(qs('quarantine-body').textContent).toContain('Cuarentena');
  });

  it('validates mandatory CAPA fields', () => {
    const { inspection } = createFailedInspection();
    void inspection;
    qs('quality-non-conformances').click();
    const nc = loadCollection('non_conformances')[0];

    fillCapa(nc);
    qs('capa-description').value = '';
    submit(dom.window, 'capa-form');

    expect(qs('error-capa-description').textContent).toContain('obligatoria');
    expect(loadCollection('corrective_actions').length).toBe(0);
  });

  it('adds a CAPA and updates the quarantine label to under treatment', () => {
    createFailedInspection();
    qs('quality-non-conformances').click();
    const nc = loadCollection('non_conformances')[0];

    fillCapa(nc);
    submit(dom.window, 'capa-form');

    const actions = loadCollection('corrective_actions');
    expect(actions.length).toBe(1);
    expect(actions[0].responsible_employee_id).toBe('emp-003');
    expect(actions[0].action_type).toBe('rework');
    expect(qs('quarantine-body').textContent).toContain('Cuarentena - En tratamiento');
  });

  it('flags overdue CAPA without changing its stored status', () => {
    createFailedInspection();
    const nc = loadCollection('non_conformances')[0];
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Reprocesar el lote',
      root_cause: 'Falla de calibración',
      action_type: 'rework',
      due_date: '2020-01-01',
      status: 'pending'
    });

    qs('quality-non-conformances').click();
    expect(qs('capa-list').textContent).toContain('Vencida');
    expect(loadCollection('corrective_actions')[0].status).toBe('pending');
  });

  it('stamps completed_at only on completion and preserves it through closure', () => {
    createFailedInspection();
    qs('quality-non-conformances').click();
    const nc = loadCollection('non_conformances')[0];

    fillCapa(nc);
    submit(dom.window, 'capa-form');
    let action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toBeUndefined();

    updateCorrectiveAction(action.corrective_action_id, { status: 'in_progress' });
    updateCorrectiveAction(action.corrective_action_id, { action_description: 'Ajuste intermedio' });
    action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toBeUndefined();

    updateCorrectiveAction(action.corrective_action_id, { status: 'completed' });
    action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toMatch(/^\d{4}-/);
    const completedAt = action.completed_at;

    action = requestCapaClosure(action.corrective_action_id, 'emp-003');
    action = registerCapaEffectiveness(action.corrective_action_id, 'effective', 'Verificado', 'jefe_calidad');
    reviewCapaClosure(action.corrective_action_id, 'approved', null, null, 'jefe_calidad');
    action = loadCollection('corrective_actions')[0];
    expect(action.completed_at).toBe(completedAt);
    expect(action.status).toBe('completed');
    expect(action.closure_status).toBe('approved');
  });

  it('shows conditional inspections in the review tray without creating a non-conformance', () => {
    createFailedInspection('gr-002', false, false);
    qs('quality-non-conformances').click();

    expect(loadCollection('non_conformances').length).toBe(0);
    expect(qs('review-body').querySelectorAll('tr').length).toBe(1);
    expect(qs('review-empty').hidden).toBe(true);
  });

  it('renders the redesigned workspace with summary, filters and severity columns', () => {
    createFailedInspection();
    qs('quality-non-conformances').click();

    expect(qs('nc-heading').textContent).toBe('Gestión de No Conformidades');
    expect(qs('nc-create').textContent).toContain('Registrar no conformidad');
    expect(qs('nc-summary').textContent).toContain('Total de no conformidades');
    expect(qs('nc-summary').textContent).toContain('Abiertas');
    expect(qs('nc-summary').textContent).toContain('Solucionadas');
    expect(qs('nc-list').textContent).toContain('Nivel de gravedad');
    expect(qs('nc-list').textContent).toContain('Media');
    expect(qs('nc-result-count').textContent).toContain('1 de 1');
  });

  it('registers a non-conformance from the form and opens its tracking detail', async () => {
    qs('quality-non-conformances').click();

    qs('nc-description').value = 'Etiqueta ilegible en el empaque';
    qs('nc-defect').value = 'packaging';
    qs('nc-severity').value = 'critical';
    qs('nc-detected-date').value = '2026-11-20';
    qs('nc-responsible').value = 'emp-001';
    qs('nc-observations').value = 'Revisar al proveedor';
    const file = new dom.window.File([new Uint8Array([1, 2, 3])], 'evidencia.png', { type: 'image/png' });
    Object.defineProperty(qs('nc-files'), 'files', { value: [file], configurable: true });
    qs('nc-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(qs('nc-detail-card').hidden).toBe(false);
    });
    const nc = loadCollection('non_conformances')[0];
    expect(nc.detected_date).toBe('2026-11-20');
    expect(nc.responsible_employee_id).toBe('emp-001');
    expect(nc.observations).toBe('Revisar al proveedor');
    expect(evidenceFor('non_conformance', nc.non_conformance_id).length).toBe(1);
    expect(qs('nc-detail-body').textContent).toContain('Historial de seguimiento');
    expect(qs('nc-detail-body').textContent).toContain('Registro creado');
    expect(qs('nc-detail-body').textContent).toContain('evidencia.png');
    expect(qs('nc-detail-body').textContent).toContain('Alta');
  });

  it('filters by severity and opens the detail from the table', () => {
    createFailedInspection();
    qs('quality-non-conformances').click();

    qs('nc-severity-filter').value = 'critical';
    qs('nc-severity-filter').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(qs('nc-empty').hidden).toBe(false);

    qs('nc-severity-filter').value = 'major';
    qs('nc-severity-filter').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(qs('nc-list').textContent).toContain('Peso');
    qs('nc-list').querySelector('button[data-nc-detail]').click();
    expect(qs('nc-detail-card').hidden).toBe(false);
    expect(qs('nc-detail-body').textContent).toContain('Peso');
    expect(qs('nc-detail-body').textContent).toContain('Acciones correctivas');
  });
});
