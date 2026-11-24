import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
});

describe('quality role permissions', () => {
  it('defaults to jefe_calidad and persists the active role', () => {
    expect(q.getActiveRole()).toBe('jefe_calidad');
    expect(q.setActiveRole('inspector')).toBe('inspector');
    expect(q.getActiveRole()).toBe('inspector');
    expect(q.setActiveRole('gerente')).toBe('gerente');
    expect(store.get('erp_quality:viewer_role')).toBe('gerente');
  });

  it('normalizes unknown roles to jefe_calidad', () => {
    localStorage.setItem('erp_quality:viewer_role', 'unknown');
    expect(q.getActiveRole()).toBe('jefe_calidad');
  });

  it('blocks inspector plan management and gerente document creation', () => {
    q.setActiveRole('inspector');
    expect(() => q.addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' }))
      .toThrow('No tienes permiso para realizar esta acción.');

    q.setActiveRole('gerente');
    expect(() => q.addQualityDocument({
      name: 'Doc',
      category: 'manual',
      responsible_employee_id: 'emp-001',
      file_name: 'doc.png',
      mime_type: 'image/png',
      size_bytes: 10,
      data_url: 'data:image/png;base64,AA=='
    })).toThrow('No tienes permiso para realizar esta acción.');
  });

  it('revalidates permissions after the role changes', () => {
    const plan = q.addPlan({ plan_name: 'Plan', product_id: 'prod-001', applicable_stage: 'incoming' });
    q.addCriterion({
      inspection_plan_id: plan.inspection_plan_id,
      criteria_name: 'Peso',
      expected_value: 10,
      tolerance: 1,
      unit: 'kg',
      comparison_type: 'range',
      is_critical: true
    });
    q.submitPlanForApproval(plan.inspection_plan_id, 'emp-001');

    q.setActiveRole('inspector');
    expect(() => q.approvePlan(plan.inspection_plan_id, 'jefe_calidad')).toThrow('No tienes permiso');
    expect(q.loadCollection('quality_inspection_plans')[0].status).toBe('pending_approval');

    q.setActiveRole('jefe_calidad');
    expect(q.approvePlan(plan.inspection_plan_id, 'jefe_calidad').status).toBe('approved');
  });
});
