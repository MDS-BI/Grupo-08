import { describe, it, expect, beforeEach } from 'vitest';
import { transition, approvalRate, capaEffectiveness } from '../../src/quality-status.js';
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

describe('quality status machine and derived metrics', () => {
  it('allows only canonical transitions', () => {
    expect(transition('plan', 'submit', 'draft')).toBe('pending_approval');
    expect(transition('plan', 'approve', 'pending_approval')).toBe('approved');
    expect(transition('plan', 'approve', 'draft')).toBeNull();
    expect(transition('document', 'submit', 'draft')).toBe('pending_review');
    expect(transition('capaClosure', 'request', 'completed')).toBe('completed');
    expect(transition('capaClosure', 'approve', 'pending', { hasEffectiveness: true })).toBe('approved');
    expect(transition('capaClosure', 'approve', 'pending', { hasEffectiveness: false })).toBeNull();
  });

  it('computes approval rate from final completed results only', () => {
    const inspections = [
      { inspection_status: 'completed', overall_result: 'passed' },
      { inspection_status: 'completed', overall_result: 'conditional' },
      { inspection_status: 'completed', overall_result: null },
      { inspection_status: 'pending_review', overall_result: null }
    ];
    expect(approvalRate(inspections)).toBe(50);
    expect(q.approvalRate(inspections)).toBe(50);
  });

  it('computes CAPA effectiveness from approved closures only', () => {
    const actions = [
      { closure_status: 'approved', effectiveness_result: 'effective' },
      { closure_status: 'approved', effectiveness_result: 'not_effective' },
      { closure_status: 'pending', effectiveness_result: 'effective' }
    ];
    expect(capaEffectiveness(actions)).toBe(50);
    expect(q.capaEffectiveness(actions)).toBe(50);
  });

  it('separates pending KPI from review queue', () => {
    const inspections = [
      { inspection_status: 'draft', proposed_result: null, review_decision: null },
      { inspection_status: 'pending_review', proposed_result: 'failed', review_decision: null },
      { inspection_status: 'completed', proposed_result: 'conditional', review_decision: null, legacy_completed: true },
      { inspection_status: 'completed', proposed_result: 'conditional', review_decision: 'approved', legacy_completed: true }
    ];
    expect(q.pendingInspections(inspections)).toBe(2);
    expect(q.reviewQueue(inspections).map(item => item.inspection_status)).toEqual(['pending_review', 'completed']);
  });
});
