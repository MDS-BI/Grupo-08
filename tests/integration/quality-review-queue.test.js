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
  q.setActiveRole('jefe_calidad');
});

describe('inspection review queue', () => {
  it('groups pending and eligible legacy inspections only', () => {
    const records = [
      { inspection_status: 'pending_review', proposed_result: 'failed', review_decision: null },
      { inspection_status: 'completed', proposed_result: 'conditional', review_decision: null, legacy_completed: true },
      { inspection_status: 'completed', proposed_result: 'passed', review_decision: null, overall_result: 'passed', legacy_completed: true },
      { inspection_status: 'completed', proposed_result: 'conditional', review_decision: 'approved', legacy_completed: true }
    ];
    expect(q.reviewQueue(records)).toHaveLength(2);
    expect(q.pendingInspections(records)).toBe(1);
  });

  it('keeps a reviewed legacy conditional inspection out of the queue', () => {
    q.saveCollection('quality_inspections', [{
      id: 'legacy',
      inspection_id: 'legacy',
      inspection_status: 'completed',
      proposed_result: 'conditional',
      overall_result: 'conditional',
      review_decision: 'approved_conditional',
      reviewed_by: 'jefe_calidad',
      reviewed_at: new Date().toISOString()
    }]);
    expect(q.reviewQueue()).toHaveLength(0);
  });

  it('maps reference modules to approval-rate stages', () => {
    const inspections = [
      { inspection_status: 'completed', overall_result: 'passed', reference_module: 'goods_receipt' },
      { inspection_status: 'completed', overall_result: 'failed', reference_module: 'goods_receipt' },
      { inspection_status: 'completed', overall_result: 'passed', reference_module: 'shipment' }
    ];
    expect(q.approvalRate(inspections, 'incoming')).toBe(50);
    expect(q.approvalRate(inspections, 'final')).toBe(100);
  });
});
