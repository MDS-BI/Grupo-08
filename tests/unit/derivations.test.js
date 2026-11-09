import { describe, it, expect } from 'vitest';
import { derivePendingLots, deriveQuarantineLots } from '../../src/storage.js';

describe('derivePendingLots', () => {
  const documents = [
    { reference_module: 'goods_receipt', reference_id: 'gr-001', product_id: 'prod-001', date: '2026-11-01' },
    { reference_module: 'production_order', reference_id: 'po-001', product_id: 'prod-002', date: '2026-11-02' },
    { reference_module: 'shipment', reference_id: 'sh-001', product_id: 'prod-003', date: '2026-11-03' }
  ];

  it('excludes only lots with a completed inspection', () => {
    const inspections = [
      { reference_module: 'goods_receipt', reference_id: 'gr-001', inspection_status: 'completed' },
      { reference_module: 'production_order', reference_id: 'po-001', inspection_status: 'draft' }
    ];
    const pending = derivePendingLots(documents, inspections);
    expect(pending.map(d => d.reference_id)).toEqual(['po-001', 'sh-001']);
  });

  it('returns all documents when there are no inspections', () => {
    expect(derivePendingLots(documents, []).length).toBe(3);
  });

  it('keeps a lot pending while only a draft inspection exists', () => {
    const inspections = [
      { reference_module: 'shipment', reference_id: 'sh-001', inspection_status: 'draft' }
    ];
    expect(derivePendingLots(documents, inspections).map(d => d.reference_id)).toContain('sh-001');
  });
});

describe('deriveQuarantineLots', () => {
  const inspections = [
    { inspection_id: 'insp-1', reference_module: 'goods_receipt', reference_id: 'gr-001' }
  ];

  it('lists open and under_review non-conformances as quarantine', () => {
    const ncs = [
      { non_conformance_id: 'nc-1', inspection_id: 'insp-1', product_id: 'prod-001', severity: 'major', defect_type: 'other', status: 'open' },
      { non_conformance_id: 'nc-2', inspection_id: 'insp-1', product_id: 'prod-001', severity: 'minor', defect_type: 'packaging', status: 'under_review' },
      { non_conformance_id: 'nc-3', inspection_id: 'insp-1', product_id: 'prod-001', severity: 'critical', defect_type: 'functional', status: 'closed' }
    ];
    const rows = deriveQuarantineLots(ncs, [], inspections);
    expect(rows.map(r => r.non_conformance_id)).toEqual(['nc-1', 'nc-2']);
    expect(rows[0].status_label).toBe('Cuarentena');
  });

  it('marks the quarantine as under treatment when a CAPA exists', () => {
    const ncs = [
      { non_conformance_id: 'nc-1', inspection_id: 'insp-1', product_id: 'prod-001', severity: 'major', defect_type: 'other', status: 'open' }
    ];
    const capas = [
      { non_conformance_id: 'nc-1', status: 'pending' }
    ];
    const rows = deriveQuarantineLots(ncs, capas, inspections);
    expect(rows[0].status_label).toBe('Cuarentena - En tratamiento');
    expect(rows[0].reference_id).toBe('gr-001');
  });
});
