import { describe, it, expect, beforeEach } from 'vitest';
import * as q from '../../src/storage.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

function completedCapa(){
  const nc = q.addNonConformance({
    product_id: 'prod-001',
    description: 'Desviación detectada',
    defect_type: 'other',
    severity: q.qualityCatalogKeys('severity_levels')[0],
    status: q.qualityCatalogKeys('nc_statuses')[0]
  });
  let action = q.addCorrectiveAction({
    non_conformance_id: nc.non_conformance_id,
    responsible_employee_id: 'emp-001',
    action_description: 'Reprocesar lote',
    root_cause: 'Falla de calibración',
    action_type: 'rework',
    due_date: '2099-01-01',
    progress: 0,
    status: 'pending'
  });
  action = q.updateCorrectiveAction(action.corrective_action_id, { status: 'in_progress', progress: 50 });
  action = q.updateCorrectiveAction(action.corrective_action_id, { status: 'completed', progress: 100 });
  return q.requestCapaClosure(action.corrective_action_id, 'emp-001');
}

beforeEach(() => {
  store.clear();
  q.ensureSeedData();
  q.setActiveRole('jefe_calidad');
});

describe('CAPA closure', () => {
  it('requires effectiveness before approving and records closure metadata', () => {
    const action = completedCapa();
    expect(action.status).toBe('completed');
    expect(action.closure_status).toBe('pending');
    expect(action.closure_requested_at).not.toBeNull();

    expect(() => q.reviewCapaClosure(action.corrective_action_id, 'approved', null, null, 'jefe_calidad'))
      .toThrow('Registra la eficacia antes de aprobar el cierre.');

    let reviewed = q.registerCapaEffectiveness(action.corrective_action_id, 'effective', 'Sin recurrencias', 'jefe_calidad');
    expect(reviewed.effectiveness_result).toBe('effective');
    reviewed = q.reviewCapaClosure(action.corrective_action_id, 'approved', null, null, 'jefe_calidad');
    expect(reviewed.closure_status).toBe('approved');
    expect(reviewed.closure_reviewed_by).toBe('jefe_calidad');
    expect(reviewed.closure_reviewed_at).not.toBeNull();
    expect(q.isCapaOverdue({ ...reviewed, due_date: '2020-01-01' })).toBe(false);
  });

  it('reopens the CAPA when the closure is rejected', () => {
    const action = completedCapa();
    expect(() => q.reviewCapaClosure(action.corrective_action_id, 'rejected', null, null, 'jefe_calidad'))
      .toThrow('Registra la justificación para continuar.');
    const reviewed = q.reviewCapaClosure(action.corrective_action_id, 'rejected', null, null, 'jefe_calidad', 'Eficacia no demostrada');
    expect(reviewed.closure_status).toBe('rejected');
    expect(reviewed.status).toBe('in_progress');
    expect(reviewed.closure_justification).toBe('Eficacia no demostrada');
  });

  it('registers effectiveness inline when provided by the review queue', () => {
    const action = completedCapa();
    const reviewed = q.reviewCapaClosure(action.corrective_action_id, 'approved', 'effective', 'Verificado en campo', 'jefe_calidad');
    expect(reviewed.effectiveness_result).toBe('effective');
    expect(reviewed.closure_status).toBe('approved');
  });
});
