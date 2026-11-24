import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function makeDocument(){
  return q.addQualityDocument({
    name: 'Manual de calidad',
    category: 'manual',
    description: 'Política y alcance',
    responsible_employee_id: 'emp-001',
    file_name: 'manual.png',
    mime_type: 'image/png',
    size_bytes: 10,
    data_url: 'data:image/png;base64,AA=='
  });
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
});

describe('quality document workflow and evidence', () => {
  it('runs draft, review, rejection, edit, approval and versioning', () => {
    let doc = makeDocument();
    expect(doc.status).toBe('draft');

    doc = q.submitDocumentForReview(doc.document_id, 'emp-001');
    expect(doc.status).toBe('pending_review');
    expect(() => q.rejectDocument(doc.document_id, 'jefe_calidad', '  ')).toThrow('Registra la justificación');
    doc = q.rejectDocument(doc.document_id, 'jefe_calidad', 'Falta firma');
    expect(doc.status).toBe('rejected');

    doc = q.updateQualityDocument(doc.document_id, { description: 'Política revisada' });
    expect(doc.status).toBe('draft');
    expect(doc.version).toBe(1);
    expect(doc.review_justification).toBe('Falta firma');

    doc = q.submitDocumentForReview(doc.document_id, 'emp-001');
    doc = q.approveDocument(doc.document_id, 'jefe_calidad');
    expect(doc.status).toBe('approved');
    expect(doc.reviewed_by).toBe('jefe_calidad');

    const version = q.duplicateDocumentVersion(doc.document_id, 'jefe_calidad');
    expect(version.status).toBe('draft');
    expect(version.version).toBe(2);
    expect(version.version_of).toBe(doc.id);
    expect(version.document_id).toBe(doc.document_id);
    expect(() => q.updateQualityDocument(doc.document_id, { name: 'Otro' }))
      .toThrow('aprobado');
  });

  it('accepts document evidence and enforces deletion permissions', () => {
    const doc = makeDocument();
    const evidence = q.addEvidence({
      entity_type: 'document',
      entity_id: doc.document_id,
      file_name: 'anexo.png',
      mime_type: 'image/png',
      size_bytes: 12,
      data_url: 'data:image/png;base64,AA==',
      uploaded_by: 'emp-001'
    });
    expect(q.evidenceFor('document', doc.document_id)).toHaveLength(1);

    q.setActiveRole('inspector');
    expect(() => q.deleteEvidence(evidence.id, 'emp-002')).toThrow('No tienes permiso');
    q.setActiveRole('jefe_calidad');
    expect(q.deleteEvidence(evidence.id)).toBe(true);
    expect(q.evidenceFor('document', doc.document_id)).toHaveLength(0);
  });

  it('cascades evidence when a draft document is deleted', () => {
    const doc = makeDocument();
    q.addEvidence({
      entity_type: 'document',
      entity_id: doc.document_id,
      file_name: 'anexo.pdf',
      mime_type: 'application/pdf',
      size_bytes: 12,
      data_url: 'data:application/pdf;base64,AA==',
      uploaded_by: 'emp-001'
    });
    expect(q.deleteQualityDocument(doc.document_id)).toBe(true);
    expect(q.evidenceFor('document', doc.document_id)).toHaveLength(0);
  });
});
