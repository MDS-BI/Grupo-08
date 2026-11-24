import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountQualityView, qs } from '../support/quality-dom.js';

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

  it('shows all approval queues and permission notices for a restricted role', async () => {
    const { setRole } = await import('../support/quality-dom.js');
    setRole('inspector');
    expect(qs('review-permission-notice').hidden).toBe(false);
    expect(qs('review-permission-notice').textContent).toContain('view_approval_queues');
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
});
