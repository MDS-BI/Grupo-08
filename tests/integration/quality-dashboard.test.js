import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  loadCollection,
  saveCollection
} from '../../src/storage.js';
import { bootQualityApp, qs, setRole } from '../support/quality-dom.js';

let dom;
let plan;
let criterion;
let conditionalCriterion;

function setupPlan(){
  plan = addPlan({ plan_name: 'Plan de recepción', product_id: 'prod-001', applicable_stage: 'incoming' });
  criterion = addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Peso',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: true
  });
  conditionalCriterion = addCriterion({
    inspection_plan_id: plan.inspection_plan_id,
    criteria_name: 'Etiqueta',
    expected_value: 10,
    tolerance: 1,
    unit: 'kg',
    comparison_type: 'range',
    is_critical: false
  });
  submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
  approvePlan(plan.inspection_plan_id, 'jefe_calidad');
}

function runInspection(reference, result){
  const inspection = addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: reference,
    inspection_date: '2026-11-09'
  });
  setInspectionResults(inspection.inspection_id, [
    {
      criteria_id: criterion.criteria_id,
      measured_value: result === 'failed' ? 99 : 10,
      pass_fail: result !== 'failed'
    },
    {
      criteria_id: conditionalCriterion.criteria_id,
      measured_value: result === 'conditional' ? 99 : 10,
      pass_fail: result !== 'conditional'
    }
  ]);
  submitInspectionForReview(inspection.inspection_id, 'emp-001');
  const decision = result === 'passed' ? 'approved' : result === 'conditional' ? 'approved_conditional' : 'rejected';
  return reviewInspection(inspection.inspection_id, decision, 'jefe_calidad', 'Revisión de prueba');
}

function closedCapa(nc, description, dueDate, effectiveness){
  let action = addCorrectiveAction({
    non_conformance_id: nc.non_conformance_id,
    responsible_employee_id: 'emp-003',
    action_description: description,
    root_cause: 'Causa',
    action_type: 'rework',
    due_date: dueDate,
    status: 'pending'
  });
  action = updateCorrectiveAction(action.corrective_action_id, { status: 'in_progress', progress: 50 });
  action = updateCorrectiveAction(action.corrective_action_id, { status: 'completed', progress: 100 });
  action = requestCapaClosure(action.corrective_action_id, 'emp-003');
  action = registerCapaEffectiveness(action.corrective_action_id, effectiveness, 'Verificado', 'jefe_calidad');
  return reviewCapaClosure(action.corrective_action_id, 'approved', null, null, 'jefe_calidad');
}

function seedCompletedInspections(count){
  const now = new Date().toISOString();
  const inspections = [];
  for(let index = 0; index < count; index += 1){
    const inspectionId = `dashboard-inspection-${index}`;
    const date = `2026-10-${String((index % 28) + 1).padStart(2, '0')}`;
    inspections.push({
      id: `dashboard-id-${index}`,
      inspection_id: inspectionId,
      inspection_plan_id: plan.inspection_plan_id,
      checklist_id: null,
      checklist_version: null,
      inspector_id: 'emp-001',
      reference_module: 'goods_receipt',
      reference_id: `gr-${String(index + 1).padStart(3, '0')}`,
      inspection_date: date,
      inspection_status: 'completed',
      proposed_result: 'passed',
      overall_result: 'passed',
      review_decision: 'approved',
      review_justification: 'Revisión de prueba',
      reviewed_by: 'jefe_calidad',
      reviewed_at: `${date}T12:00:00.000Z`,
      submitted_by: 'emp-001',
      submitted_at: `${date}T10:00:00.000Z`,
      legacy_completed: false,
      createdAt: now,
      updatedAt: now
    });
  }
  saveCollection('quality_inspections', inspections);
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 5 - quality dashboard', () => {
  it('shows clear empty states and zeroed KPIs without data', () => {
    qs('quality-dashboard').click();
    expect(qs('kpi-approval-rate').textContent).toBe('0%');
    expect(qs('kpi-open-nc').textContent).toBe('0');
    expect(qs('kpi-pending-inspections').textContent).toBe('0');
    expect(qs('quality-approval-by-stage').textContent).toContain('Sin inspecciones');
  });

  it('unifies quick actions, record stats and charts, adapting priorities by role', () => {
    expect(qs('view-quality-dashboard').hidden).toBe(false);
    expect(qs('view-dashboard').hidden).toBe(true);
    expect(qs('action-new-entity').closest('#view-quality-dashboard')).not.toBeNull();
    expect(qs('stat-entities').closest('#view-quality-dashboard')).not.toBeNull();
    expect(qs('quality-trend').closest('#view-quality-dashboard')).not.toBeNull();

    setRole('gerente');
    expect(qs('view-quality-dashboard').dataset.dashboardRole).toBe('gerente');
    expect(qs('kpi-pending-documents').closest('.stat-card').hidden).toBe(true);
    expect(qs('quality-pareto-product').closest('section').hidden).toBe(true);

    setRole('inspector');
    expect(qs('view-quality-dashboard').dataset.dashboardRole).toBe('inspector');
    expect(qs('quality-summary-approvals').hidden).toBe(true);
    expect(qs('quality-summary-inspections').hidden).toBe(false);

    setRole('jefe_calidad');
    expect(qs('view-quality-dashboard').dataset.dashboardRole).toBe('jefe_calidad');
    expect(qs('kpi-pending-documents').closest('.stat-card').hidden).toBe(false);
  });

  it('computes KPIs, CAPA effectiveness, pending inspections and Pareto', () => {
    setupPlan();

    runInspection('gr-001', 'passed');
    runInspection('gr-002', 'failed');
    runInspection('gr-003', 'conditional');
    addInspection({
      inspection_plan_id: plan.inspection_plan_id,
      inspector_id: 'emp-002',
      reference_module: 'goods_receipt',
      reference_id: 'gr-003',
      inspection_date: '2026-11-09'
    });

    const nc = loadCollection('non_conformances')[0];
    closedCapa(nc, 'Acción a tiempo', '2099-01-01', 'effective');
    closedCapa(nc, 'Acción tardía', '2000-01-01', 'not_effective');
    addCorrectiveAction({
      non_conformance_id: nc.non_conformance_id,
      responsible_employee_id: 'emp-003',
      action_description: 'Acción vencida',
      root_cause: 'Causa 3',
      action_type: 'other',
      due_date: '2000-01-01',
      status: 'pending'
    });

    qs('quality-dashboard').click();

    expect(qs('kpi-approval-rate').textContent).toBe('33.3%');
    expect(qs('kpi-open-nc').textContent).toBe('1');
    expect(qs('kpi-overdue-capa').textContent).toBe('1');
    expect(qs('kpi-capa-effectiveness').textContent).toBe('50%');
    expect(qs('kpi-pending-inspections').textContent).toBe('1');
    expect(qs('quality-approval-by-stage').textContent).toContain('Recepción');
    expect(qs('quality-nc-by-severity').textContent).toContain('Mayor: 1');
    expect(qs('quality-pareto-product').textContent).toContain('Harina de trigo');
    expect(qs('quality-pareto-stage').textContent).toContain('Recepción');
    expect(qs('quality-inspector-detail').textContent).toContain('Ana Torres');
  });

  it('restricts individual inspector detail to the head-of-quality role', () => {
    setupPlan();
    runInspection('gr-001', 'passed');
    qs('quality-role').value = 'gerente';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    qs('quality-dashboard').click();
    expect(qs('quality-role').value).toBe('gerente');
    qs('quality-role').value = 'inspector';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(qs('quality-inspector-detail').textContent).toContain('restringido');
    expect(qs('kpi-approval-rate').textContent).toBe('100%');
    expect(localStorage.getItem('erp_quality:viewer_role')).toBe('inspector');

    qs('quality-role').value = 'gerente';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(localStorage.getItem('erp_quality:viewer_role')).toBe('gerente');
    expect(qs('quality-inspector-detail').textContent).toContain('restringido');

    qs('quality-role').value = 'jefe_calidad';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(localStorage.getItem('erp_quality:viewer_role')).toBe('jefe_calidad');
    expect(qs('quality-inspector-detail').textContent).toContain('Ana Torres');
    expect(qs('quality-role').value).toBe('jefe_calidad');
  });

  it('renders dashboard metrics with 500 inspections within the SC-010 time budget', () => {
    setupPlan();
    seedCompletedInspections(500);

    const startedAt = performance.now();
    qs('quality-dashboard').click();
    const elapsedMs = performance.now() - startedAt;

    console.info(`[SC-010] dashboard con 500 inspecciones renderizado en ${elapsedMs.toFixed(2)} ms`);
    expect(qs('kpi-approval-rate').textContent).toBe('100%');
    expect(qs('kpi-pending-inspections').textContent).toBe('0');
    expect(elapsedMs).toBeLessThan(2000);
  });

  it('renders the organized dashboard with real-data compliance chart and role panel', () => {
    setupPlan();
    runInspection('gr-001', 'passed');
    runInspection('gr-002', 'failed');

    qs('quality-dashboard').click();

    expect(document.querySelector('.dashboard-layout')).not.toBeNull();
    expect(document.querySelector('.dashboard-main')).not.toBeNull();
    expect(document.querySelector('.dashboard-side')).not.toBeNull();
    expect(qs('quality-compliance-ring-value').textContent).toBe('50%');
    expect(qs('quality-compliance-ring').style.background).toContain('conic-gradient');
    expect(qs('quality-compliance-chip').textContent).toBe('1 de 2 aprobadas');
    expect(qs('quality-role-summary').textContent).toContain('Supervisión de calidad');
    expect(qs('quality-role-metrics').children).toHaveLength(3);
    expect(qs('dashboard-role-icon').textContent).toBe('JC');
  });

  it('adapts the side panel to the active role', () => {
    qs('quality-dashboard').click();
    qs('quality-role').value = 'gerente';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(qs('quality-role-summary').textContent).toContain('Vista ejecutiva');
    expect(qs('dashboard-role-icon').textContent).toBe('GO');

    qs('quality-role').value = 'inspector';
    qs('quality-role').dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(qs('quality-role-summary').textContent).toContain('Vista de inspector');
    expect(qs('dashboard-role-icon').textContent).toBe('IN');
  });

  it('renders inspection operation KPIs and a visual compliance meter', () => {
    setupPlan();
    runInspection('gr-001', 'passed');
    runInspection('gr-002', 'failed');

    qs('quality-dashboard').click();

    expect(qs('kpi-total-inspections').textContent).toBe('2');
    expect(qs('kpi-performed-inspections').textContent).toBe('2');
    expect(qs('kpi-approved-inspections').textContent).toBe('1');
    expect(qs('kpi-observation-inspections').textContent).toBe('1');
    expect(qs('quality-compliance-value').textContent).toBe('50%');
    expect(qs('quality-compliance-fill').style.width).toBe('50%');
  });
});
