import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function evidence(overrides = {}){
  return {
    entity_type: 'inspection',
    entity_id: 'insp-001',
    file_name: 'evidencia.png',
    mime_type: 'image/png',
    size_bytes: 12,
    data_url: 'data:image/png;base64,AA==',
    uploaded_by: 'emp-001',
    ...overrides
  };
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
  q.saveCollection('quality_inspections', [{
    id: 'insp-001',
    inspection_id: 'insp-001',
    inspection_status: 'draft',
    inspection_plan_id: 'plan-001',
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    inspection_date: '2026-11-09'
  }]);
});

describe('quality evidence', () => {
  it('validates type, size, author and linked entity', () => {
    expect(q.validateEvidence(evidence()).valid).toBe(true);
    expect(q.validateEvidence(evidence({ mime_type: 'text/plain' })).errors.mime_type).toBeDefined();
    expect(q.validateEvidence(evidence({ size_bytes: 6 * 1024 * 1024 })).errors.size_bytes).toBeDefined();
    expect(q.validateEvidence(evidence({ entity_id: 'missing' })).errors.entity_id).toBeDefined();
    expect(q.validateEvidence(evidence({ uploaded_by: 'missing' })).errors.uploaded_by).toBeDefined();
  });

  it('preserves previous evidence when an invalid upload is rejected', () => {
    const first = q.addEvidence(evidence());
    expect(() => q.addEvidence(evidence({ mime_type: 'text/plain' }))).toThrow();
    expect(q.evidenceFor('inspection', 'insp-001').map(item => item.id)).toEqual([first.id]);
  });

  it('deletes evidence only by the owner or the head of quality', () => {
    const record = q.addEvidence(evidence());
    q.setActiveRole('inspector');
    expect(() => q.deleteEvidence(record.id, 'emp-002')).toThrow('No tienes permiso');
    expect(q.deleteEvidence(record.id, 'emp-001')).toBe(true);

    const second = q.addEvidence(evidence());
    q.setActiveRole('jefe_calidad');
    expect(q.deleteEvidence(second.id)).toBe(true);
  });

  it('cascades evidence when its inspection is deleted', () => {
    q.addEvidence(evidence());
    expect(q.deleteInspection('insp-001')).toBe(true);
    expect(q.evidenceFor('inspection', 'insp-001')).toHaveLength(0);
  });
});
