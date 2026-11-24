import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountQualityView, qs, setRole, clickNav, activeView } from '../support/quality-dom.js';

let dom;

beforeEach(async () => {
  dom = await mountQualityView('quality-approvals', { role: 'jefe_calidad' });
});

afterEach(() => {
  dom.window.close();
});

describe('US15 quality UI consistency', () => {
  it('renders exact status and result labels with semantic state attributes', async () => {
    const { renderStatusBadge } = await import('../../src/components/status-badge.js');
    const cases = [
      ['draft', 'Borrador'],
      ['pending_approval', 'Pendiente'],
      ['under_review', 'under_review'],
      ['approved', 'Aprobado'],
      ['rejected', 'Rechazado'],
      ['overdue', 'Vencido']
    ];
    cases.forEach(([status, label]) => {
      const badge = renderStatusBadge(status);
      expect(badge.dataset.label).toBe(label);
      expect(badge.textContent).toContain(label);
      expect(badge.querySelector('svg')).not.toBeNull();
    });
    const conditional = renderStatusBadge('approved', { result: 'conditional' });
    expect(conditional.textContent).toContain('Aprobado');
    expect(conditional.textContent).toContain('Condicional');
  });

  it('shows a single Búsqueda entry in the quality sidebar', () => {
    const visibleSearchLabels = [...document.querySelectorAll('.sidebar .nav-label')]
      .filter(label => label.textContent.trim() === 'Búsqueda' && !label.closest('button').hidden);

    expect(visibleSearchLabels).toHaveLength(1);
    expect(visibleSearchLabels[0].closest('button').id).toBe('quality-search');
    expect(qs('nav-search').hidden).toBe(true);
    expect(qs('nav-search').style.display).toBe('none');
  });

  it('places the active-user selector in the top bar instead of the sidebar or dashboard', () => {
    const select = qs('quality-role');

    expect(select.closest('.topbar')).not.toBeNull();
    expect(document.querySelector('.sidebar #quality-role')).toBeNull();
    expect(document.querySelector('#view-quality-dashboard #quality-role')).toBeNull();
    expect([...select.options].map(option => option.textContent)).toEqual([
      'Jefe de Calidad',
      'Inspector de Calidad',
      'Gerente de Operaciones'
    ]);
  });

  it('shows all approval queues and permission notices for a restricted role', async () => {
    const { setRole } = await import('../support/quality-dom.js');
    setRole('inspector');
    expect(qs('review-permission-notice').hidden).toBe(false);
    expect(qs('review-permission-notice').textContent).toContain('ver bandejas de aprobación');
    expect(qs('review-permission-notice').textContent).not.toContain('view_approval_queues');
    expect(qs('review-permission-notice').querySelector('.permission-notice').dataset.permission).toBe('view_approval_queues');
    expect(qs('queue-plans').textContent).toBe('');
    expect(qs('queue-count-plans').textContent).toBe('0');
  });

  it('requires justification before rejecting a pending plan', async () => {
    const storage = await import('../../src/storage.js');
    const plan = storage.addPlan({ plan_name: 'Plan UI pendiente', product_id: 'prod-001', applicable_stage: 'incoming' });
    storage.addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    storage.submitPlanForApproval(plan.inspection_plan_id, 'jefe_calidad');
    qs('approval-refresh').click();
    const reject = qs('queue-plans').querySelector('button[data-queue-action="reject"]');
    expect(reject).not.toBeNull();
    const prompt = vi.fn(() => '');
    globalThis.prompt = prompt;
    reject.click();
    expect(prompt).toHaveBeenCalled();
    expect(qs('review-queue-error').textContent).toContain('justificación');
    expect(storage.loadCollection('quality_inspection_plans').find(item => item.inspection_plan_id === plan.inspection_plan_id).status).toBe('pending_approval');
  });

  it('updates the queue counter after approval without reloading the view', async () => {
    const storage = await import('../../src/storage.js');
    const plan = storage.addPlan({ plan_name: 'Plan UI a aprobar', product_id: 'prod-001', applicable_stage: 'incoming' });
    storage.addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Temperatura',
      expected_value: 20,
      tolerance: 2,
      unit: 'C',
      comparison_type: 'range',
      is_critical: false
    });
    storage.submitPlanForApproval(plan.inspection_plan_id, 'jefe_calidad');
    qs('approval-refresh').click();
    expect(qs('queue-count-plans').textContent).toBe('1');
    const approve = qs('queue-plans').querySelector('button[data-queue-action="approve"]');
    approve.click();
    expect(qs('queue-count-plans').textContent).toBe('0');
    expect(qs('queue-plans').textContent).toContain('No hay planes pendientes');
    expect(storage.loadCollection('quality_inspection_plans').find(item => item.inspection_plan_id === plan.inspection_plan_id).status).toBe('approved');
  });

  it('shows the quality module, user context and active role in the top bar', () => {
    expect(qs('topbar-module-name').textContent).toContain('Control de Calidad');
    expect(qs('topbar-user-name').textContent).toContain('Usuario');
    expect(qs('topbar-role').textContent).toBe('Jefe de Calidad');
    setRole('inspector');
    expect(qs('topbar-role').textContent).toBe('Inspector de Calidad');
  });

  it('restores blocked controls when the role changes back to an allowed role', () => {
    setRole('gerente');
    clickNav('quality-dashboard');
    const reviewButton = qs('quality-review-open');
    expect(reviewButton.disabled).toBe(true);
    expect(reviewButton.title).toContain('Ver bandejas de aprobación');
    expect(reviewButton.title).not.toContain('view_approval_queues');

    setRole('jefe_calidad');
    expect(reviewButton.disabled).toBe(false);
    reviewButton.click();
    expect(activeView().dataset.qualityView).toBe('quality-approvals');
  });

  it('applies permissions to pending-lot actions and refreshes them by role', () => {
    clickNav('pending-lots');
    const firstButton = () => qs('pending-lots-body').querySelector('button[data-inspect-module]');
    expect(firstButton()).not.toBeNull();
    expect(firstButton().dataset.permission).toBe('execute_inspection');

    setRole('gerente');
    expect(firstButton().disabled).toBe(true);

    setRole('inspector');
    expect(firstButton().disabled).toBe(false);
    firstButton().click();
    expect(activeView().dataset.qualityView).toBe('quality-inspections');
  });

  it('offers only approved plans and renders measurements after auto-selection', async () => {
    const storage = await import('../../src/storage.js');
    const plan = storage.addPlan({ plan_name: 'Plan UI', product_id: 'prod-001', applicable_stage: 'incoming' });
    storage.addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    storage.submitPlanForApproval(plan.inspection_plan_id, 'emp-001');
    storage.approvePlan(plan.inspection_plan_id, 'jefe_calidad');
    const { startInspection } = await import('../../src/components/inspection-engine.js');

    clickNav('quality-inspections');
    expect([...qs('inspection-plan').options].map(option => option.value)).toContain(plan.inspection_plan_id);
    startInspection('goods_receipt', 'gr-001');
    expect(qs('inspection-plan').value).toBe(plan.inspection_plan_id);
    expect(qs('inspection-measurements').querySelector('input[data-criteria-id]')).not.toBeNull();
  });
});
