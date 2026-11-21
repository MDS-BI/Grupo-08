import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureSeedData,
  addPlan,
  addCriterion,
  addInspection,
  completeInspection,
  addEvidence,
  evidenceFor,
  validateEvidence,
  deleteInspection,
  deleteNonConformance,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;
let plan;
let criterion;

const PNG = 'data:image/png;base64,AAAA';

function makeInspection(result = 'passed'){
  const inspection = addInspection({
    inspection_plan_id: plan.inspection_plan_id,
    inspector_id: 'emp-001',
    reference_module: 'goods_receipt',
    reference_id: 'gr-001',
    inspection_date: '2026-11-09'
  });
  completeInspection(inspection.inspection_id, result, [{
    criteria_id: criterion.criteria_id,
    measured_value: result === 'passed' ? 10 : 99,
    pass_fail: result === 'passed'
  }]);
  return inspection;
}

function evidencePayload(entityType, entityId, overrides = {}){
  return {
    entity_type: entityType,
    entity_id: entityId,
    file_name: 'foto.png',
    mime_type: 'image/png',
    size_bytes: 4,
    data_url: PNG,
    uploaded_by: 'emp-001',
    ...overrides
  };
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
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
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 8 - evidence', () => {
  it('validates MIME, size, content and author', () => {
    const inspection = makeInspection();
    expect(validateEvidence(evidencePayload('inspection', inspection.inspection_id)).valid).toBe(true);
    expect(() => addEvidence(evidencePayload('inspection', inspection.inspection_id, { mime_type: 'text/plain' })))
      .toThrow('PNG');
    expect(() => addEvidence(evidencePayload('inspection', inspection.inspection_id, { size_bytes: 5 * 1024 * 1024 + 1 })))
      .toThrow('5 MB');
    expect(() => addEvidence(evidencePayload('inspection', inspection.inspection_id, { data_url: 'data:text/plain;base64,AAAA' })))
      .toThrow('contenido');
    expect(() => addEvidence(evidencePayload('inspection', inspection.inspection_id, { uploaded_by: 'nope' })))
      .toThrow('autor');
  });

  it('rejects evidence above the accumulated 8 MB limit', () => {
    const inspection = makeInspection();
    addEvidence(evidencePayload('inspection', inspection.inspection_id, { size_bytes: 4 * 1024 * 1024 }));
    addEvidence(evidencePayload('inspection', inspection.inspection_id, { file_name: 'dos.png', size_bytes: 4 * 1024 * 1024 }));
    expect(() => addEvidence(evidencePayload('inspection', inspection.inspection_id, { file_name: 'tres.png', size_bytes: 1 })))
      .toThrow('8 MB');
  });

  it('keeps previous evidence when storage quota is exceeded', () => {
    const inspection = makeInspection();
    addEvidence(evidencePayload('inspection', inspection.inspection_id));
    const spy = vi.spyOn(dom.window.Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });
    try{
      expect(() => addEvidence(evidencePayload('inspection', inspection.inspection_id, { file_name: 'otra.png' })))
        .toThrow('espacio');
    }finally{
      spy.mockRestore();
    }
    expect(evidenceFor('inspection', inspection.inspection_id).length).toBe(1);
  });

  it('cascades evidence with inspections and non-conformances, and respects blocked inspections', () => {
    const clean = makeInspection('passed');
    addEvidence(evidencePayload('inspection', clean.inspection_id));
    deleteInspection(clean.inspection_id);
    expect(evidenceFor('inspection', clean.inspection_id).length).toBe(0);

    const failed = makeInspection('failed');
    const nc = loadCollection('non_conformances').find(item => item.inspection_id === failed.inspection_id);
    addEvidence(evidencePayload('inspection', failed.inspection_id));
    addEvidence(evidencePayload('non_conformance', nc.non_conformance_id, { file_name: 'nc.pdf', mime_type: 'application/pdf', data_url: 'data:application/pdf;base64,AAAA' }));

    expect(() => deleteInspection(failed.inspection_id)).toThrow('no conformidad');
    expect(evidenceFor('inspection', failed.inspection_id).length).toBe(1);

    deleteNonConformance(nc.non_conformance_id);
    expect(evidenceFor('non_conformance', nc.non_conformance_id).length).toBe(0);
  });

  it('lists and deletes inspection evidence from the view', () => {
    const inspection = makeInspection();
    const record = addEvidence(evidencePayload('inspection', inspection.inspection_id));

    qs('nav-quality-inspections').click();
    qs('inspection-evidence-inspection').value = inspection.inspection_id;
    qs('inspection-evidence-inspection').dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(qs('inspection-evidence-list').textContent).toContain('foto.png');
    qs('inspection-evidence-list').querySelector('button[data-evidence-delete]').click();
    expect(evidenceFor('inspection', inspection.inspection_id).some(item => item.id === record.id)).toBe(false);
    expect(qs('inspection-evidence-list').textContent).toContain('Sin evidencia');
  });

  it('uploads a file selected in the inspection evidence form', async () => {
    const inspection = makeInspection();
    qs('nav-quality-inspections').click();
    qs('inspection-evidence-inspection').value = inspection.inspection_id;
    qs('inspection-evidence-inspection').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    qs('inspection-evidence-author').value = 'emp-001';

    const file = new dom.window.File([new Uint8Array([1, 2, 3])], 'nueva.png', { type: 'image/png' });
    const input = qs('inspection-evidence-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    qs('inspection-evidence-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(evidenceFor('inspection', inspection.inspection_id).length).toBe(1);
    });
    expect(qs('inspection-evidence-list').textContent).toContain('nueva.png');
  });
});
