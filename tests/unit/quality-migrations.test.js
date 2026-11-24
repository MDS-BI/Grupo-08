import { describe, it, expect, beforeEach } from 'vitest';
import { migrateQualityData } from '../../src/quality-migrations.js';
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

describe('quality legacy migration', () => {
  it('normalizes legacy statuses, versions and conditional inspections idempotently', () => {
    q.saveCollection('quality_inspection_plans', [{
      id: 'legacy-plan',
      inspection_plan_id: 'legacy-plan',
      plan_name: 'Plan legacy',
      product_id: 'prod-001',
      applicable_stage: 'incoming'
    }]);
    q.saveCollection('quality_checklists', [{
      id: 'legacy-check',
      checklist_id: 'legacy-check',
      name: 'Check legacy',
      category: 'incoming',
      status: 'active'
    }]);
    q.saveCollection('quality_documents', [{
      id: 'legacy-doc',
      document_id: 'legacy-doc',
      name: 'Doc legacy',
      status: 'under_review'
    }]);
    q.saveCollection('quality_inspections', [{
      id: 'legacy-insp',
      inspection_id: 'legacy-insp',
      inspection_status: 'completed',
      overall_result: 'conditional',
      review_decision: null
    }]);
    q.saveCollection('corrective_actions', [{
      id: 'legacy-capa',
      corrective_action_id: 'legacy-capa',
      status: 'completed'
    }]);

    const first = migrateQualityData();
    expect(first.changed).toBeGreaterThan(0);
    expect(q.loadCollection('quality_inspection_plans')[0].status).toBe('approved');
    expect(q.loadCollection('quality_checklists')[0].status).toBe('approved');
    expect(q.loadCollection('quality_documents')[0].status).toBe('pending_review');
    const inspection = q.loadCollection('quality_inspections')[0];
    expect(inspection.legacy_completed).toBe(true);
    expect(inspection.migration_flagged_for_review).toBe(true);
    expect(q.reviewQueue([inspection])).toHaveLength(1);
    expect(q.pendingInspections([inspection])).toBe(0);
    expect(q.loadCollection('corrective_actions')[0].closure_status).toBe('pending');

    const second = migrateQualityData();
    expect(second.changed).toBe(0);
  });
});
