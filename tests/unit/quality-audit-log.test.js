import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUDIT_ENTITIES,
  AUDIT_ACTIONS,
  appendAuditEntry,
  findAuditEntries,
  clearAuditEntries
} from '../../src/storage.js';
import { filterAuditEntries, clearAuditFilters } from '../../src/components/quality-audit-log.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

function entry(overrides = {}) {
  return {
    entity_type: 'inspection',
    entity_id: 'ins-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    action: 'status_change',
    changed_field: 'overall_result',
    before_value: 'failed',
    after_value: 'passed',
    actor: 'emp-001',
    timestamp: '2026-11-10T10:00:00.000Z',
    justification: 'Revisión documentada',
    ...overrides
  };
}

beforeEach(() => {
  store.clear();
  clearAuditEntries();
});

describe('quality audit log - validation and query', () => {
  it('exposes the entity and action catalogues', () => {
    expect([...AUDIT_ENTITIES]).toEqual([
      'inspection_plan',
      'checklist',
      'document',
      'inspection',
      'non_conformance',
      'corrective_action'
    ]);
    expect([...AUDIT_ACTIONS]).toEqual(['create', 'update', 'review', 'approve', 'reject', 'status_change', 'delete']);
  });

  it('rejects entries with missing mandatory fields or a non-ISO timestamp', () => {
    expect(() => appendAuditEntry({ ...entry(), actor: '' })).toThrow('actor');
    expect(() => appendAuditEntry({ ...entry(), reference_id: undefined })).toThrow('documento origen');
    expect(() => appendAuditEntry({ ...entry(), action: 'merge' })).toThrow('Acción de auditoría inválida');
    expect(() => appendAuditEntry({ ...entry(), timestamp: '10/11/2026' })).toThrow('ISO');
    expect(() => appendAuditEntry({ ...entry(), after_value: undefined })).toThrow('valor nuevo');
  });

  it('accepts null before/after values for create and delete semantics', () => {
    const created = appendAuditEntry(entry({ action: 'create', before_value: null, after_value: 'draft' }));
    const deleted = appendAuditEntry(entry({ action: 'delete', before_value: 'draft', after_value: null }));
    expect(created.before_value).toBeNull();
    expect(deleted.after_value).toBeNull();
  });

  it('filters by lot, entity type and date range', () => {
    appendAuditEntry(entry());
    appendAuditEntry(entry({ entity_id: 'ins-002', reference_id: 'gr-002', timestamp: '2026-11-21T10:00:00.000Z' }));
    appendAuditEntry(entry({ entity_type: 'corrective_action', entity_id: 'cap-001' }));

    expect(findAuditEntries({ reference_module: 'goods_receipt', reference_id: 'gr-001' }).length).toBe(2);
    expect(findAuditEntries({ entity_type: 'corrective_action' }).length).toBe(1);
    expect(findAuditEntries({ desde: '2026-11-15', hasta: '2026-11-30' }).length).toBe(1);
    expect(findAuditEntries({ desde: '2026-11-30' }).length).toBe(0);
  });

  it('does not append a duplicate override status_change', () => {
    appendAuditEntry(entry());
    appendAuditEntry(entry());
    expect(findAuditEntries({ entity_id: 'ins-001' }).length).toBe(1);
  });

  it('filters entries purely and rejects an inverted range', () => {
    const entries = [entry(), entry({ entity_id: 'ins-002', reference_id: 'gr-002' })];
    expect(filterAuditEntries(entries, { reference_id: 'gr-002' }).length).toBe(1);
    expect(filterAuditEntries(entries, { entity_type: 'inspection' }).length).toBe(2);
    expect(() => filterAuditEntries(entries, { desde: '2026-11-20', hasta: '2026-11-01' })).toThrow(
      'rango de fechas es inválido'
    );
    expect(clearAuditFilters()).toEqual({
      reference_module: '',
      reference_id: '',
      entity_type: '',
      desde: '',
      hasta: ''
    });
  });
});
