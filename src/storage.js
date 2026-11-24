import { getConfig } from './module-config.js';
import { SEED_KEYS, seedDataSnapshot } from './seed-data.js';
import { assertCan, ROLES } from './permissions.js';
import {
  CAPA_CLOSURE_STATUSES,
  CHECKLIST_STATUSES,
  DOCUMENT_STATUSES,
  INSPECTION_STATUSES,
  approvalRate as statusApprovalRate,
  capaEffectiveness as statusCapaEffectiveness,
  transition
} from './quality-status.js';
import { migrateQualityData } from './quality-migrations.js';
import {
  evaluateInspection,
  reviewInspection as reviewInspectionRecord
} from './inspection-engine.js';

const ENTITIES_KEY = 'erp_base_module:entities';
const DOCUMENTS_KEY = 'erp_base_module:documents';

export function loadEntities(){
  try{
    const raw = localStorage.getItem(ENTITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Failed to parse entities from storage', e);
    return [];
  }
}

export function saveEntities(entities){
  localStorage.setItem(ENTITIES_KEY, JSON.stringify(entities));
}

export function loadDocuments(){
  try{
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Failed to parse documents from storage', e);
    return [];
  }
}

export function saveDocuments(documents){
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
}

function generateId(){
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

function declaredFields(target){
  return getConfig().customFields.filter(f => f.target === target);
}

export function isValidDate(value){
  if(!value) return false;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isEmpty(v){ return v === undefined || v === null || (typeof v === 'string' && !v.trim()); }

function normalizeCustomValue(field, value){
  if(isEmpty(value)) return undefined;
  if(field.type === 'number') return Number(value);
  return String(value).trim();
}

function collectCustomErrors(target, data){
  const errs = {};
  for(const f of declaredFields(target)){
    const v = data ? data[f.key] : undefined;
    if(f.required && isEmpty(v)){ errs[f.key] = `${f.label} es obligatorio`; continue; }
    if(!isEmpty(v)){
      if(f.type === 'number' && !Number.isFinite(Number(v))){ errs[f.key] = `${f.label} debe ser un número`; continue; }
      if(f.type === 'date' && !isValidDate(v)){ errs[f.key] = `${f.label} debe ser una fecha válida (YYYY-MM-DD)`; continue; }
      if(f.type === 'select' && !f.options.includes(String(v).trim())){ errs[f.key] = `${f.label} debe ser uno de: ${f.options.join(', ')}`; }
    }
  }
  return errs;
}

function validateLifecycleStatus(status, currentStatus, errors){
  const lc = getConfig().statusLifecycle;
  if(!lc) return;
  if(currentStatus === undefined || currentStatus === null){
    if(!isEmpty(status) && !lc.statuses.includes(status)){
      errors.status = `El estado debe ser uno de: ${lc.statuses.join(', ')}`;
    }
    return;
  }
  if(status === currentStatus) return;
  const allowed = lc.transitions[currentStatus] || [];
  if(!allowed.includes(status)){
    errors.status = `Transición de estado inválida de "${currentStatus}" a "${status}"`;
  }
}

function isValidEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function validateEntity({name, code, email, targetDate, creditLimit, ...rest}){
  const errors = {};
  if(!name || !name.trim()) errors.name = 'El nombre es obligatorio';
  if(!code || !code.trim()) errors.code = 'El código es obligatorio';
  if(!isEmpty(email) && !isValidEmail(email)) errors.email = 'El correo electrónico no es válido';
  if(!isEmpty(targetDate) && !isValidDate(targetDate)) errors.targetDate = 'La fecha objetivo debe ser una fecha válida (YYYY-MM-DD)';
  if(!isEmpty(creditLimit)){
    const c = Number(creditLimit);
    if(Number.isNaN(c) || c < 0) errors.creditLimit = 'El límite de crédito debe ser un número no negativo';
  }
  Object.assign(errors, collectCustomErrors('entity', rest));
  return { valid: Object.keys(errors).length === 0, errors };
}

function pickCustomFields(target, data){
  const out = {};
  for(const f of declaredFields(target)){
    const n = normalizeCustomValue(f, data[f.key]);
    if(n !== undefined) out[f.key] = n;
  }
  return out;
}

export function addEntity(payload){
  const now = new Date().toISOString();
  const entity = {
    id: generateId(),
    entity_id: generateId(),
    name: (payload.name||'').trim(),
    code: (payload.code||'').trim(),
    taxId: (payload.taxId||'').trim() || undefined,
    email: (payload.email||'').trim() || undefined,
    phone: (payload.phone||'').trim() || undefined,
    address: (payload.address||'').trim() || undefined,
    category: (payload.category||'').trim() || undefined,
    description: (payload.description||'').trim() || undefined,
    targetDate: (payload.targetDate||'').trim() || undefined,
    creditLimit: isEmpty(payload.creditLimit) ? undefined : Number(payload.creditLimit),
    paymentTerms: (payload.paymentTerms||'').trim() || undefined,
    ...pickCustomFields('entity', payload),
    createdAt: now,
    updatedAt: now
  };
  const list = loadEntities();
  list.push(entity);
  saveEntities(list);
  return entity;
}

export function updateEntity(id, updates){
  const list = loadEntities();
  const idx = list.findIndex(e => e.id === id);
  if(idx === -1) throw new Error('Entidad no encontrada');
  const merged = { ...list[idx], ...updates };
  list[idx] = {
    ...list[idx],
    name: (merged.name||'').trim(),
    code: (merged.code||'').trim(),
    taxId: (merged.taxId||'').trim() || undefined,
    email: (merged.email||'').trim() || undefined,
    phone: (merged.phone||'').trim() || undefined,
    address: (merged.address||'').trim() || undefined,
    category: (merged.category||'').trim() || undefined,
    description: (merged.description||'').trim() || undefined,
    targetDate: (merged.targetDate||'').trim() || undefined,
    creditLimit: isEmpty(merged.creditLimit) ? undefined : Number(merged.creditLimit),
    paymentTerms: (merged.paymentTerms||'').trim() || undefined,
    ...pickCustomFields('entity', merged),
    updatedAt: new Date().toISOString()
  };
  saveEntities(list);
  return list[idx];
}

export function deleteEntity(id){
  const list = loadEntities();
  const entity = list.find(e => e.id === id);
  const newList = list.filter(e => e.id !== id);
  saveEntities(newList);
  if(entity) deleteDocumentsForEntity(entity.entity_id);
  return newList;
}

export function validateDocument(payload, currentStatus){
  const {entityId, folio, startDate, endDate, quantity, subtotal, discount, status} = payload;
  const errors = {};
  const entities = loadEntities();
  if(!entityId || !entities.some(e => e.entity_id === entityId)){
    errors.entityId = 'Selecciona una entidad para el documento';
  }
  if(isEmpty(folio)){ errors.folio = 'El folio es obligatorio'; }
  else {
    const f = Number(folio);
    if(!Number.isInteger(f) || f <= 0) errors.folio = 'El folio debe ser un entero positivo';
  }
  if(!startDate){ errors.startDate = 'La fecha de inicio es obligatoria'; }
  else if(!isValidDate(startDate)) errors.startDate = 'La fecha de inicio debe ser una fecha válida (YYYY-MM-DD)';
  if(!endDate){ errors.endDate = 'La fecha de fin es obligatoria'; }
  else if(!isValidDate(endDate)) errors.endDate = 'La fecha de fin debe ser una fecha válida (YYYY-MM-DD)';
  if(startDate && endDate && isValidDate(startDate) && isValidDate(endDate) && endDate < startDate){
    errors.endDate = 'La fecha de fin debe ser igual o posterior a la fecha de inicio';
  }
  if(quantity !== undefined && quantity !== null && quantity !== ''){
    const n = Number(quantity);
    if(!Number.isInteger(n) || n <= 0) errors.quantity = 'La cantidad debe ser un entero positivo';
  }
  for(const [key, label] of [['subtotal', 'El subtotal'], ['discount', 'El descuento'], ['taxAmount', 'El impuesto'], ['totalAmount', 'El importe total']]){
    const v = payload[key];
    if(v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if(Number.isNaN(n) || n < 0) errors[key] = `${label} debe ser un número no negativo`;
  }
  if(!errors.subtotal && !errors.discount
    && subtotal !== undefined && subtotal !== null && subtotal !== ''
    && discount !== undefined && discount !== null && discount !== ''
    && Number(discount) > Number(subtotal)){
    errors.discount = 'El descuento no puede superar el subtotal';
  }
  validateLifecycleStatus((status||'').trim(), currentStatus, errors);
  Object.assign(errors, collectCustomErrors('document', payload));
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addDocument(payload){
  const now = new Date().toISOString();
  const check = validateDocument(payload);
  if(!check.valid){
    throw new Error(Object.values(check.errors)[0]);
  }
  const document = {
    id: generateId(),
    entity_id: payload.entityId,
    series: (payload.series||'').trim() || undefined,
    folio: Number(payload.folio),
    startDate: payload.startDate,
    endDate: payload.endDate,
    quantity: (isEmpty(payload.quantity)) ? undefined : Number(payload.quantity),
    subtotal: (isEmpty(payload.subtotal)) ? undefined : Number(payload.subtotal),
    discount: (isEmpty(payload.discount)) ? undefined : Number(payload.discount),
    taxAmount: (isEmpty(payload.taxAmount)) ? undefined : Number(payload.taxAmount),
    totalAmount: (isEmpty(payload.totalAmount)) ? undefined : Number(payload.totalAmount),
    currency: (payload.currency||'').trim() || undefined,
    paymentTerms: (payload.paymentTerms||'').trim() || undefined,
    notes: (payload.notes||'').trim() || undefined,
    status: (payload.status||'').trim() || undefined,
    ...pickCustomFields('document', payload),
    createdAt: now,
    updatedAt: now
  };
  const list = loadDocuments();
  list.push(document);
  saveDocuments(list);
  return document;
}

export function updateDocument(id, updates){
  const list = loadDocuments();
  const idx = list.findIndex(d => d.id === id);
  if(idx === -1) throw new Error('Documento no encontrado');
  const prev = list[idx];
  const merged = { ...prev, ...updates };
  const check = validateDocument({
    entityId: merged.entity_id,
    series: merged.series,
    folio: merged.folio,
    startDate: merged.startDate,
    endDate: merged.endDate,
    quantity: merged.quantity,
    subtotal: merged.subtotal,
    discount: merged.discount,
    taxAmount: merged.taxAmount,
    totalAmount: merged.totalAmount,
    status: updates.status !== undefined ? (updates.status||'').trim() : merged.status
  }, prev.status);
  if(!check.valid){
    throw new Error(Object.values(check.errors)[0]);
  }
  list[idx] = {
    ...prev,
    series: (merged.series||'').trim() || undefined,
    folio: Number(merged.folio),
    startDate: merged.startDate,
    endDate: merged.endDate,
    quantity: (isEmpty(merged.quantity)) ? undefined : Number(merged.quantity),
    subtotal: (isEmpty(merged.subtotal)) ? undefined : Number(merged.subtotal),
    discount: (isEmpty(merged.discount)) ? undefined : Number(merged.discount),
    taxAmount: (isEmpty(merged.taxAmount)) ? undefined : Number(merged.taxAmount),
    totalAmount: (isEmpty(merged.totalAmount)) ? undefined : Number(merged.totalAmount),
    currency: (merged.currency||'').trim() || undefined,
    paymentTerms: (merged.paymentTerms||'').trim() || undefined,
    notes: (merged.notes||'').trim() || undefined,
    status: updates.status !== undefined ? (updates.status||'').trim() : merged.status,
    ...pickCustomFields('document', { ...prev, ...updates }),
    updatedAt: new Date().toISOString()
  };
  saveDocuments(list);
  return list[idx];
}

export function deleteDocument(id){
  const list = loadDocuments();
  const newList = list.filter(d => d.id !== id);
  saveDocuments(newList);
  return newList;
}

export function deleteDocumentsForEntity(entityId){
  const list = loadDocuments();
  const newList = list.filter(d => d.entity_id !== entityId);
  saveDocuments(newList);
  return newList;
}

export function clearAll(){
  saveEntities([]);
  saveDocuments([]);
}

export function searchEntities(term){
  const q = (term||'').trim().toLowerCase();
  if(!q) return loadEntities();
  const fields = ['name', 'code', 'taxId', 'email', 'phone', 'address', 'category', 'description', 'targetDate', 'paymentTerms', ...declaredFields('entity').map(f => f.key)];
  return loadEntities().filter(e => fields.some(f => String(e[f] ?? '').toLowerCase().includes(q)));
}

// ============================================================================
// Módulo de Control de Calidad
// ============================================================================

export const APPLICABLE_STAGES = Object.freeze(['incoming', 'in_process', 'final']);
export const COMPARISON_TYPES = Object.freeze(['range', 'min', 'max', 'boolean']);
export const DEFECT_TYPES = Object.freeze(['dimensional', 'functional', 'packaging', 'other']);
export const SEVERITIES = Object.freeze(['minor', 'major', 'critical']);
export const NON_CONFORMANCE_STATUSES = Object.freeze(['open', 'under_review', 'closed']);
export const CORRECTIVE_ACTION_STATUSES = Object.freeze(['pending', 'in_progress', 'completed']);
export const ACTION_CATEGORIES = Object.freeze(['corrective', 'preventive']);
export const ACTION_TYPES = Object.freeze(['resampling', 'rework', 'other']);
export const REFERENCE_MODULES = Object.freeze(['goods_receipt', 'production_order', 'shipment']);
export const EVIDENCE_ENTITY_TYPES = Object.freeze(['inspection', 'non_conformance', 'corrective_action', 'document']);
export const EVIDENCE_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'application/pdf']);
export const EVIDENCE_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const ALERT_METRICS = Object.freeze([
  'approval_rate',
  'open_non_conformances',
  'overdue_capa',
  'capa_effectiveness',
  'pending_inspections'
]);
export const ALERT_OPERATORS = Object.freeze(['lt', 'lte', 'gt', 'gte', 'eq']);
export const ALERT_SEVERITIES = Object.freeze(['info', 'warning', 'critical']);
export const AUDIT_ENTITIES = Object.freeze(['inspection_plan', 'checklist', 'document', 'inspection', 'non_conformance', 'corrective_action']);
export const AUDIT_ACTIONS = Object.freeze(['create', 'update', 'review', 'approve', 'reject', 'status_change', 'delete']);
export const QUALITY_DOCUMENT_CATEGORIES = Object.freeze(['manual', 'procedure', 'regulation', 'certificate', 'specification', 'other']);
export const QUALITY_DOCUMENT_STATUSES = Object.freeze([...DOCUMENT_STATUSES]);
export const QUALITY_DOCUMENT_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'application/pdf']);
export const QUALITY_DOCUMENT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const QUALITY_SETTINGS_KEY = 'erp_quality:settings';
export const QUALITY_SETTING_TYPES = Object.freeze([
  'inspection_categories',
  'severity_levels',
  'inspection_statuses',
  'nc_statuses',
  'action_types'
]);
const DEFAULT_QUALITY_SETTINGS = Object.freeze({
  catalogs: Object.freeze({
    inspection_categories: Object.freeze([
      Object.freeze({ id: 'qset-stage-incoming', key: 'incoming', label: 'Recepción', description: 'Control documental y de materias primas al ingreso.', system: true }),
      Object.freeze({ id: 'qset-stage-process', key: 'in_process', label: 'En proceso', description: 'Verificación de parámetros críticos durante la producción.', system: true }),
      Object.freeze({ id: 'qset-stage-final', key: 'final', label: 'Final', description: 'Validación del producto terminado antes del despacho.', system: true })
    ]),
    severity_levels: Object.freeze([
      Object.freeze({ id: 'qset-sev-minor', key: 'minor', label: 'Baja', description: 'Desviación sin impacto funcional relevante.', system: true }),
      Object.freeze({ id: 'qset-sev-major', key: 'major', label: 'Media', description: 'Desviación que afecta el proceso o el producto.', system: true }),
      Object.freeze({ id: 'qset-sev-critical', key: 'critical', label: 'Alta', description: 'Riesgo directo para el producto o el cliente.', system: true })
    ]),
    inspection_statuses: Object.freeze([
      Object.freeze({ id: 'qset-istatus-draft', key: 'draft', label: 'Borrador', description: 'Inspección en captura; aún no genera dictamen.', system: true }),
      Object.freeze({ id: 'qset-istatus-completed', key: 'completed', label: 'Completada', description: 'Inspección finalizada con dictamen registrado.', system: true })
    ]),
    nc_statuses: Object.freeze([
      Object.freeze({ id: 'qset-ncstatus-open', key: 'open', label: 'Abierta', description: 'Detectada y pendiente de análisis.', system: true }),
      Object.freeze({ id: 'qset-ncstatus-review', key: 'under_review', label: 'En revisión', description: 'En evaluación o esperando disposición.', system: true }),
      Object.freeze({ id: 'qset-ncstatus-closed', key: 'closed', label: 'Solucionada', description: 'Cerrada tras la verificación correspondiente.', system: true })
    ]),
    action_types: Object.freeze([
      Object.freeze({ id: 'qset-action-corrective', key: 'corrective', label: 'Correctiva', description: 'Elimina la causa de una desviación detectada.', system: true }),
      Object.freeze({ id: 'qset-action-preventive', key: 'preventive', label: 'Preventiva', description: 'Previene una desviación potencial.', system: true })
    ])
  }),
  parameters: Object.freeze({
    approval_target: 90,
    auto_create_nc_on_failure: true,
    default_nc_severity: 'major',
    default_nc_status: 'open',
    default_inspection_stage: 'incoming'
  })
});
const AUDIT_ROLE_KEY = 'erp_quality:viewer_role';
const ALERT_RATE_METRICS = Object.freeze(['approval_rate', 'capa_effectiveness']);

function normalizedRole(role){
  return ROLES.includes(role) ? role : 'jefe_calidad';
}

function dispatchRoleChange(role){
  if(typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const detail = { role };
  let event;
  if(typeof window.CustomEvent === 'function'){
    event = new window.CustomEvent('quality:role-changed', { detail });
  }else if(typeof window.Event === 'function'){
    event = new window.Event('quality:role-changed');
    Object.defineProperty(event, 'detail', { value: detail });
  }else{
    return;
  }
  window.dispatchEvent(event);
}

function persistRole(role){
  const next = normalizedRole(role);
  try{
    localStorage.setItem(AUDIT_ROLE_KEY, next);
  }catch(e){
    console.error('No se pudo guardar el rol activo', e);
  }
  dispatchRoleChange(next);
  return next;
}

export function getActiveRole(){
  let role = null;
  try{
    role = localStorage.getItem(AUDIT_ROLE_KEY);
  }catch(e){
    console.error('No se pudo leer el rol activo', e);
  }
  if(ROLES.includes(role)) return role;
  return persistRole('jefe_calidad');
}

export function setActiveRole(role){
  return persistRole(role);
}

const QUALITY_COLLECTION_KEYS = Object.freeze({
  quality_inspection_plans: 'erp_quality:quality_inspection_plans',
  quality_inspection_criteria: 'erp_quality:quality_inspection_criteria',
  quality_inspections: 'erp_quality:quality_inspections',
  quality_inspection_results: 'erp_quality:quality_inspection_results',
  non_conformances: 'erp_quality:non_conformances',
  corrective_actions: 'erp_quality:corrective_actions',
  quality_evidence: 'erp_quality:quality_evidence',
  quality_alert_rules: 'erp_quality:quality_alert_rules',
  quality_audit_log: 'erp_quality:quality_audit_log',
  quality_checklists: 'erp_quality:quality_checklists',
  quality_documents: 'erp_quality:quality_documents'
});

const EXTERNAL_COLLECTION_KEYS = Object.freeze({
  products: SEED_KEYS.products,
  employees: SEED_KEYS.employees,
  goods_receipt: SEED_KEYS.goods_receipt,
  production_order: SEED_KEYS.production_order,
  shipment: SEED_KEYS.shipment
});

const CHECKLIST_SEED = Object.freeze([
  {
    id: 'seed-checklist-1',
    checklist_id: 'checklist-recepcion',
    name: 'Recepción de materias primas',
    description: 'Verificación documental, sensorial y de peso de cada lote recibido.',
    category: 'Recepción',
    status: 'active',
    createdAt: '2026-11-02T09:00:00.000Z',
    updatedAt: '2026-11-02T09:00:00.000Z',
    criteria: [
      { id: 'sc-11', criteria_id: 'sc-11', name: 'Documento de entrega', description: 'Remito y certificado presentes.', is_critical: true },
      { id: 'sc-12', criteria_id: 'sc-12', name: 'Peso neto', description: 'Conforme a la orden de compra.', is_critical: false },
      { id: 'sc-13', criteria_id: 'sc-13', name: 'Condición del embalaje', description: 'Sin daños ni humedad.', is_critical: false },
      { id: 'sc-14', criteria_id: 'sc-14', name: 'Lote trazable', description: 'Código de lote legible.', is_critical: true }
    ],
    evaluations: []
  },
  {
    id: 'seed-checklist-2',
    checklist_id: 'checklist-proceso',
    name: 'Control en proceso',
    description: 'Controles de parámetros críticos durante la producción.',
    category: 'Producción',
    status: 'active',
    createdAt: '2026-11-05T10:30:00.000Z',
    updatedAt: '2026-11-05T10:30:00.000Z',
    criteria: [
      { id: 'sc-21', criteria_id: 'sc-21', name: 'Temperatura', description: 'Dentro del rango operativo.', is_critical: true },
      { id: 'sc-22', criteria_id: 'sc-22', name: 'Tiempo de mezcla', description: 'Registro de ciclo completado.', is_critical: false },
      { id: 'sc-23', criteria_id: 'sc-23', name: 'Limpieza de línea', description: 'Checklist de higiene firmado.', is_critical: false },
      { id: 'sc-24', criteria_id: 'sc-24', name: 'Muestreo', description: 'Muestra identificada y sellada.', is_critical: true },
      { id: 'sc-25', criteria_id: 'sc-25', name: 'Registro de turno', description: 'Datos cargados en el sistema.', is_critical: false }
    ],
    evaluations: []
  },
  {
    id: 'seed-checklist-3',
    checklist_id: 'checklist-despacho',
    name: 'Verificación final de despacho',
    description: 'Revisión de etiquetado, documentación y estado del producto terminado.',
    category: 'Despacho',
    status: 'draft',
    createdAt: '2026-11-12T14:15:00.000Z',
    updatedAt: '2026-11-12T14:15:00.000Z',
    criteria: [
      { id: 'sc-31', criteria_id: 'sc-31', name: 'Etiquetado', description: 'Lote, fecha y destino visibles.', is_critical: true },
      { id: 'sc-32', criteria_id: 'sc-32', name: 'Documentación', description: 'Remito y certificado adjuntos.', is_critical: false },
      { id: 'sc-33', criteria_id: 'sc-33', name: 'Sellado', description: 'Precinto íntegro y numerado.', is_critical: true }
    ],
    evaluations: []
  }
]);

const DOCUMENT_PREVIEW_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const DOCUMENT_SEED = Object.freeze([
  {
    id: 'seed-doc-1', document_id: 'DOC-001', name: 'Manual de calidad',
    category: 'manual', description: 'Política y alcance del sistema de gestión de calidad.',
    file_name: 'manual-calidad.png', mime_type: 'image/png', size_bytes: 68,
    data_url: DOCUMENT_PREVIEW_PNG, responsible_employee_id: 'emp-003',
    status: 'approved', uploaded_at: '2026-10-02T09:00:00.000Z', updated_at: '2026-10-02T09:00:00.000Z', version: 2
  },
  {
    id: 'seed-doc-2', document_id: 'DOC-002', name: 'Procedimiento de recepción',
    category: 'procedure', description: 'Pasos para la inspección de materias primas.',
    file_name: 'proc-recepcion.png', mime_type: 'image/png', size_bytes: 68,
    data_url: DOCUMENT_PREVIEW_PNG, responsible_employee_id: 'emp-001',
    status: 'approved', uploaded_at: '2026-10-08T11:30:00.000Z', updated_at: '2026-10-08T11:30:00.000Z', version: 1
  },
  {
    id: 'seed-doc-3', document_id: 'DOC-003', name: 'Normativa ISO 9001',
    category: 'regulation', description: 'Requisitos aplicables de la norma de referencia.',
    file_name: 'iso-9001.png', mime_type: 'image/png', size_bytes: 68,
    data_url: DOCUMENT_PREVIEW_PNG, responsible_employee_id: 'emp-003',
    status: 'under_review', uploaded_at: '2026-11-04T08:15:00.000Z', updated_at: '2026-11-04T08:15:00.000Z', version: 1
  },
  {
    id: 'seed-doc-4', document_id: 'DOC-004', name: 'Certificado de calibración',
    category: 'certificate', description: 'Certificado vigente de la balanza de recepción.',
    file_name: 'cert-calibracion.png', mime_type: 'image/png', size_bytes: 68,
    data_url: DOCUMENT_PREVIEW_PNG, responsible_employee_id: 'emp-004',
    status: 'under_review', uploaded_at: '2026-11-12T15:45:00.000Z', updated_at: '2026-11-12T15:45:00.000Z', version: 1
  },
  {
    id: 'seed-doc-5', document_id: 'DOC-005', name: 'Especificación de harina',
    category: 'specification', description: 'Parámetros técnicos exigidos al proveedor.',
    file_name: 'esp-harina.png', mime_type: 'image/png', size_bytes: 68,
    data_url: DOCUMENT_PREVIEW_PNG, responsible_employee_id: 'emp-002',
    status: 'approved', uploaded_at: '2026-11-18T10:20:00.000Z', updated_at: '2026-11-18T10:20:00.000Z', version: 3
  },
  {
    id: 'seed-doc-6', document_id: 'DOC-006', name: 'Acta de revisión mensual',
    category: 'other', description: 'Acta de la reunión de revisión de calidad.',
    file_name: 'acta-revision.png', mime_type: 'image/png', size_bytes: 68,
    data_url: DOCUMENT_PREVIEW_PNG, responsible_employee_id: 'emp-003',
    status: 'draft', uploaded_at: '2026-11-21T16:10:00.000Z', updated_at: '2026-11-21T16:10:00.000Z', version: 1
  }
]);

function readList(key){
  try{
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){
    console.error(`Failed to parse list from storage (${key})`, e);
    return [];
  }
}

function writeList(key, list){
  localStorage.setItem(key, JSON.stringify(list));
}

function resolveQualityKey(name){
  const key = QUALITY_COLLECTION_KEYS[name];
  if(!key) throw new Error(`Colección de calidad desconocida: ${name}`);
  return key;
}

export function slugifySettingKey(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeCatalog(type, rawItems){
  const defaults = DEFAULT_QUALITY_SETTINGS.catalogs[type] || [];
  const source = Array.isArray(rawItems) ? rawItems : defaults;
  const seen = new Set();
  const items = [];
  source.forEach(raw => {
    if(!raw || typeof raw !== 'object') return;
    const key = slugifySettingKey(raw.key);
    if(!key || seen.has(key)) return;
    const fallback = defaults.find(item => item.key === key);
    const system = raw.system === true || Boolean(fallback);
    items.push({
      id: String(raw.id || `${type}-${key}`),
      key,
      label: String(raw.label || fallback?.label || key).trim(),
      description: String(raw.description || fallback?.description || '').trim(),
      system
    });
    seen.add(key);
  });
  defaults.forEach(fallback => {
    if(seen.has(fallback.key)) return;
    items.push({ ...fallback });
    seen.add(fallback.key);
  });
  return items;
}

export function normalizeQualitySettings(raw){
  const catalogs = {};
  QUALITY_SETTING_TYPES.forEach(type => {
    catalogs[type] = normalizeCatalog(type, raw && raw.catalogs ? raw.catalogs[type] : null);
  });
  const keys = type => new Set(catalogs[type].map(item => item.key));
  const severityKeys = keys('severity_levels');
  const ncKeys = keys('nc_statuses');
  const stageKeys = keys('inspection_categories');
  const source = raw && raw.parameters ? raw.parameters : {};
  const defaults = DEFAULT_QUALITY_SETTINGS.parameters;
  const numericTarget = Number(source.approval_target ?? defaults.approval_target);
  return {
    catalogs,
    parameters: {
      approval_target: Number.isFinite(numericTarget) ? Math.max(0, Math.min(100, Math.round(numericTarget))) : defaults.approval_target,
      auto_create_nc_on_failure: source.auto_create_nc_on_failure === undefined ? defaults.auto_create_nc_on_failure : Boolean(source.auto_create_nc_on_failure),
      default_nc_severity: severityKeys.has(source.default_nc_severity) ? source.default_nc_severity : defaults.default_nc_severity,
      default_nc_status: ncKeys.has(source.default_nc_status) ? source.default_nc_status : defaults.default_nc_status,
      default_inspection_stage: stageKeys.has(source.default_inspection_stage) ? source.default_inspection_stage : defaults.default_inspection_stage
    }
  };
}

export function loadQualitySettings(){
  try{
    const raw = localStorage.getItem(QUALITY_SETTINGS_KEY);
    return normalizeQualitySettings(raw ? JSON.parse(raw) : null);
  }catch(e){
    console.error('Failed to parse quality settings', e);
    return normalizeQualitySettings(null);
  }
}

export function saveQualitySettings(settings){
  const normalized = normalizeQualitySettings(settings);
  localStorage.setItem(QUALITY_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetQualitySettings(){
  return saveQualitySettings(DEFAULT_QUALITY_SETTINGS);
}

export function qualityCatalog(type){
  const settings = loadQualitySettings();
  return [...(settings.catalogs[type] || [])];
}

export function qualityCatalogKeys(type){
  return qualityCatalog(type).map(item => item.key);
}

export function qualityCatalogLabels(type){
  return qualityCatalog(type).reduce((map, item) => {
    map[item.key] = item.label;
    return map;
  }, {});
}

export function qualityParameter(name){
  return loadQualitySettings().parameters[name];
}

export function updateQualityParameters(updates){
  const settings = loadQualitySettings();
  Object.entries(updates || {}).forEach(([name, value]) => {
    if(Object.prototype.hasOwnProperty.call(DEFAULT_QUALITY_SETTINGS.parameters, name)) settings.parameters[name] = value;
  });
  return saveQualitySettings(settings).parameters;
}

export function qualitySettingUsage(type, key){
  switch(type){
    case 'inspection_categories':
      return loadCollection('quality_inspection_plans').filter(item => item.applicable_stage === key).length;
    case 'severity_levels':
      return loadCollection('non_conformances').filter(item => item.severity === key).length;
    case 'inspection_statuses':
      return loadCollection('quality_inspections').filter(item => item.inspection_status === key).length;
    case 'nc_statuses':
      return loadCollection('non_conformances').filter(item => item.status === key).length;
    case 'action_types':
      return loadCollection('corrective_actions').filter(item => item.action_category === key).length;
    default:
      return 0;
  }
}

export function addSettingItem(type, payload){
  if(!QUALITY_SETTING_TYPES.includes(type)) throw new Error('Catálogo desconocido');
  const settings = loadQualitySettings();
  const key = slugifySettingKey(payload && payload.key);
  const label = String(payload && payload.label || '').trim();
  if(!key) throw new Error('La clave es obligatoria');
  if(!label) throw new Error('El nombre es obligatorio');
  if(settings.catalogs[type].some(item => item.key === key)) throw new Error('Ya existe un elemento con esa clave');
  const item = {
    id: generateId(),
    key,
    label,
    description: String(payload.description || '').trim(),
    system: false
  };
  settings.catalogs[type].push(item);
  saveQualitySettings(settings);
  return item;
}

export function updateSettingItem(type, id, updates){
  if(!QUALITY_SETTING_TYPES.includes(type)) throw new Error('Catálogo desconocido');
  const settings = loadQualitySettings();
  const list = settings.catalogs[type];
  const idx = list.findIndex(item => item.id === id || item.key === id);
  if(idx === -1) throw new Error('Elemento no encontrado');
  const previous = list[idx];
  const nextKey = updates.key === undefined ? previous.key : slugifySettingKey(updates.key);
  if(!nextKey) throw new Error('La clave es obligatoria');
  if(updates.label !== undefined && !String(updates.label).trim()) throw new Error('El nombre es obligatorio');
  if(previous.system && nextKey !== previous.key) throw new Error('La clave de un elemento del sistema no se puede modificar');
  if(nextKey !== previous.key && list.some(item => item.key === nextKey)) throw new Error('Ya existe un elemento con esa clave');
  if(nextKey !== previous.key && qualitySettingUsage(type, previous.key) > 0){
    throw new Error('La clave está en uso y no se puede modificar');
  }
  list[idx] = {
    ...previous,
    key: nextKey,
    label: updates.label === undefined ? previous.label : String(updates.label).trim(),
    description: updates.description === undefined ? previous.description : String(updates.description).trim()
  };
  if(nextKey !== previous.key){
    Object.entries(settings.parameters).forEach(([name, value]) => {
      if(value === previous.key) settings.parameters[name] = nextKey;
    });
  }
  saveQualitySettings(settings);
  return list[idx];
}

export function deleteSettingItem(type, id){
  if(!QUALITY_SETTING_TYPES.includes(type)) throw new Error('Catálogo desconocido');
  const settings = loadQualitySettings();
  const list = settings.catalogs[type];
  const item = list.find(entry => entry.id === id || entry.key === id);
  if(!item) throw new Error('Elemento no encontrado');
  if(item.system) throw new Error('Los elementos del sistema no se pueden eliminar');
  const usage = qualitySettingUsage(type, item.key);
  if(usage > 0) throw new Error(`El elemento está en uso por ${usage} registro(s)`);
  const usedAsParameter = Object.values(settings.parameters).includes(item.key);
  if(usedAsParameter) throw new Error('El elemento está definido como parámetro predeterminado');
  saveQualitySettings({ ...settings, catalogs: { ...settings.catalogs, [type]: list.filter(entry => entry.id !== item.id) } });
  return true;
}

export function ensureSeedData(){
  const snapshot = seedDataSnapshot();
  for(const [name, records] of Object.entries(snapshot)){
    const key = EXTERNAL_COLLECTION_KEYS[name];
    if(key && localStorage.getItem(key) === null){
      writeList(key, records);
    }
  }
  if(localStorage.getItem(QUALITY_COLLECTION_KEYS.quality_checklists) === null){
    saveCollection('quality_checklists', JSON.parse(JSON.stringify(CHECKLIST_SEED)));
  }
  if(localStorage.getItem(QUALITY_COLLECTION_KEYS.quality_documents) === null){
    saveCollection('quality_documents', JSON.parse(JSON.stringify(DOCUMENT_SEED)));
  }
  if(localStorage.getItem(QUALITY_SETTINGS_KEY) === null){
    saveQualitySettings(DEFAULT_QUALITY_SETTINGS);
  }
  migrateQualityData();
}

export function loadCollection(name){
  return readList(resolveQualityKey(name));
}

export function saveCollection(name, records){
  writeList(resolveQualityKey(name), records);
  return records;
}

export function addRecord(name, record){
  const list = loadCollection(name);
  const now = new Date().toISOString();
  const created = { id: generateId(), ...record, createdAt: now, updatedAt: now };
  list.push(created);
  saveCollection(name, list);
  return created;
}

export function updateRecord(name, id, updates){
  const list = loadCollection(name);
  const idx = list.findIndex(r => r.id === id);
  if(idx === -1) throw new Error('Registro no encontrado');
  list[idx] = { ...list[idx], ...updates, id: list[idx].id, updatedAt: new Date().toISOString() };
  saveCollection(name, list);
  return list[idx];
}

export function deleteRecord(name, id){
  const list = loadCollection(name);
  const next = list.filter(r => r.id !== id);
  saveCollection(name, next);
  return next;
}

export function deleteRelated(name, foreignKey, id){
  const list = loadCollection(name);
  const next = list.filter(r => r[foreignKey] !== id);
  saveCollection(name, next);
  return next;
}

// ----------------------------------------------------------------------------
// Bitácora de auditoría (US10)
// ----------------------------------------------------------------------------

function isValidIsoTimestamp(value){
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validateAuditEntry(entry){
  const errors = {};
  if(!AUDIT_ENTITIES.includes(entry && entry.entity_type)) errors.entity_type = 'Tipo de entidad de auditoría inválido';
  if(!AUDIT_ACTIONS.includes(entry && entry.action)) errors.action = 'Acción de auditoría inválida';
  if(isBlank(entry && entry.entity_id)) errors.entity_id = 'El ID de la entidad es obligatorio';
  if(isBlank(entry && entry.reference_module)) errors.reference_module = 'El módulo de origen es obligatorio';
  if(isBlank(entry && entry.reference_id)) errors.reference_id = 'El documento origen es obligatorio';
  if(isBlank(entry && entry.changed_field)) errors.changed_field = 'El campo modificado es obligatorio';
  if(!entry || !Object.prototype.hasOwnProperty.call(entry, 'before_value') || entry.before_value === undefined) errors.before_value = 'El valor anterior es obligatorio';
  if(!entry || !Object.prototype.hasOwnProperty.call(entry, 'after_value') || entry.after_value === undefined) errors.after_value = 'El valor nuevo es obligatorio';
  if(isBlank(entry && entry.actor)) errors.actor = 'El actor de la auditoría es obligatorio';
  if(!isValidIsoTimestamp(entry && entry.timestamp)) errors.timestamp = 'La marca temporal debe ser ISO válida';
  return { valid: Object.keys(errors).length === 0, errors };
}

function isDuplicateAuditEntry(entry, list){
  return list.some(existing => existing.entity_type === entry.entity_type
    && existing.entity_id === entry.entity_id
    && existing.action === entry.action
    && existing.changed_field === entry.changed_field
    && existing.timestamp === entry.timestamp
    && JSON.stringify(existing.before_value) === JSON.stringify(entry.before_value)
    && JSON.stringify(existing.after_value) === JSON.stringify(entry.after_value)
    && (existing.justification || null) === (entry.justification || null));
}

export function appendAuditEntry(entry){
  const check = validateAuditEntry(entry);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const list = loadCollection('quality_audit_log');
  const duplicate = isDuplicateAuditEntry(entry, list);
  if(duplicate) return duplicate;
  const stored = { id: generateId(), ...entry };
  list.push(stored);
  saveCollection('quality_audit_log', list);
  return stored;
}

function auditRangeBoundary(value, isEnd){
  if(!value) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) return isEnd ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
  return value;
}

export function findAuditEntries(filters = {}){
  const desde = auditRangeBoundary(filters.desde, false);
  const hasta = auditRangeBoundary(filters.hasta, true);
  return loadCollection('quality_audit_log').filter(entry => {
    if(filters.reference_module && entry.reference_module !== filters.reference_module) return false;
    if(filters.reference_id && entry.reference_id !== filters.reference_id) return false;
    if(filters.entity_type && entry.entity_type !== filters.entity_type) return false;
    if(filters.action && entry.action !== filters.action) return false;
    if(desde && entry.timestamp < desde) return false;
    if(hasta && entry.timestamp > hasta) return false;
    return true;
  });
}

export function clearAuditEntries(){
  saveCollection('quality_audit_log', []);
}

function auditActor(candidate){
  if(!isBlank(candidate)) return String(candidate).trim();
  return getActiveRole();
}

function auditLotReference(entityType, record){
  if(!record) return { reference_module: 'desconocido', reference_id: 'desconocido' };
  if(record.reference_module && record.reference_id){
    return { reference_module: record.reference_module, reference_id: record.reference_id };
  }
  if(entityType === 'document' || entityType === 'inspection_plan' || entityType === 'checklist'){
    return {
      reference_module: record.reference_module || 'desconocido',
      reference_id: record.reference_id || record.document_id || record.inspection_plan_id || record.checklist_id || record.id || 'desconocido'
    };
  }
  if(entityType === 'non_conformance' && record.inspection_id){
    const inspection = loadCollection('quality_inspections').find(i => i.inspection_id === record.inspection_id);
    if(inspection) return { reference_module: inspection.reference_module, reference_id: inspection.reference_id };
  }
  if(entityType === 'corrective_action' && record.non_conformance_id){
    const nc = loadCollection('non_conformances').find(n => n.non_conformance_id === record.non_conformance_id);
    if(nc){
      if(nc.reference_module && nc.reference_id) return { reference_module: nc.reference_module, reference_id: nc.reference_id };
      if(nc.inspection_id){
        const inspection = loadCollection('quality_inspections').find(i => i.inspection_id === nc.inspection_id);
        if(inspection) return { reference_module: inspection.reference_module, reference_id: inspection.reference_id };
      }
    }
  }
  return {
    reference_module: record.reference_module || 'desconocido',
    reference_id: record.reference_id || record.inspection_id || record.non_conformance_id || record.corrective_action_id || record.id || 'desconocido'
  };
}

function recordAudit({ entityType, entityId, record, action, changedField, beforeValue, afterValue, actor, justification, timestamp }){
  const reference = auditLotReference(entityType, record);
  return appendAuditEntry({
    entity_type: entityType,
    entity_id: entityId,
    reference_module: reference.reference_module,
    reference_id: reference.reference_id,
    action,
    changed_field: changedField,
    before_value: beforeValue === undefined || beforeValue === null ? null : beforeValue,
    after_value: afterValue === undefined || afterValue === null ? null : afterValue,
    actor: auditActor(actor),
    timestamp: timestamp || new Date().toISOString(),
    ...(isBlank(justification) ? {} : { justification: String(justification).trim() })
  });
}

const AUDIT_IGNORED_FIELDS = Object.freeze([
  'id', 'createdAt', 'updatedAt', 'reference_module', 'reference_id',
  'completed_at', 'override_justification', 'overridden_by', 'override_at',
  'closure_status', 'closure_requested_at', 'closure_reviewed_by', 'closure_reviewed_at',
  'closure_justification', 'effectiveness_result', 'effectiveness_observations',
  'effectiveness_reviewed_by', 'effectiveness_reviewed_at'
]);

function changedFields(previous, next){
  return Object.keys(next).filter(field => !AUDIT_IGNORED_FIELDS.includes(field)
    && JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

function recordUpdateAudit({ entityType, entityId, previous, next, actor, justification, statusField = 'status' }){
  const fields = changedFields(previous, next);
  fields.forEach(field => {
    const isStatus = field === statusField;
    recordAudit({
      entityType,
      entityId,
      record: next,
      action: isStatus ? 'status_change' : 'update',
      changedField: field,
      beforeValue: previous[field],
      afterValue: next[field],
      actor,
      justification: isStatus ? justification : undefined
    });
  });
}

function isQuotaError(error){
  return Boolean(error) && (
    error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || /quota/i.test(String(error.message || ''))
  );
}

export function evidenceFor(entityType, entityId){
  return loadCollection('quality_evidence').filter(record =>
    record.entity_type === entityType && record.entity_id === entityId
  );
}

export function evidenceTotalBytes(records){
  const list = Array.isArray(records) ? records : loadCollection('quality_evidence');
  return list.reduce((total, record) => total + (Number(record.size_bytes) || 0), 0);
}

function evidenceEntityExists(entityType, entityId){
  if(entityType === 'inspection'){
    return loadCollection('quality_inspections').some(i => i.inspection_id === entityId || i.id === entityId);
  }
  if(entityType === 'non_conformance'){
    return loadCollection('non_conformances').some(nc => nc.non_conformance_id === entityId || nc.id === entityId);
  }
  if(entityType === 'corrective_action'){
    return loadCollection('corrective_actions').some(a => a.corrective_action_id === entityId || a.id === entityId);
  }
  if(entityType === 'document'){
    return loadQualityDocuments().some(doc => doc.document_id === entityId || doc.id === entityId);
  }
  return false;
}

export function validateEvidence(payload, options = {}){
  const errors = {};
  const entityType = payload && payload.entity_type;
  const entityId = payload && payload.entity_id;
  if(!EVIDENCE_ENTITY_TYPES.includes(entityType)){
    errors.entity_type = 'El tipo de vínculo debe ser inspection, non_conformance, corrective_action o document';
  }
  if(isBlank(entityId)){
    errors.entity_id = 'El registro vinculado es obligatorio';
  } else if(errors.entity_type === undefined && !evidenceEntityExists(entityType, entityId)){
    errors.entity_id = 'El registro vinculado no existe';
  }
  if(isBlank(payload && payload.file_name)){
    errors.file_name = 'El nombre del archivo es obligatorio';
  }
  if(!EVIDENCE_MIME_TYPES.includes(payload && payload.mime_type)){
    errors.mime_type = 'El archivo debe ser PNG, JPG o PDF';
  }
  const size = Number(payload && payload.size_bytes);
  if(!Number.isFinite(size) || size <= 0){
    errors.size_bytes = 'El tamaño del archivo debe ser mayor que cero';
  } else if(size > EVIDENCE_MAX_FILE_BYTES){
    errors.size_bytes = 'El archivo supera el límite de 5 MB';
  }
  const dataUrl = payload && payload.data_url;
  if(typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')){
    errors.data_url = 'El contenido del archivo no es válido';
  } else if(payload && payload.mime_type && !dataUrl.startsWith(`data:${payload.mime_type};base64,`)){
    errors.data_url = 'El contenido no coincide con el tipo de archivo';
  }
  if(isBlank(payload && payload.uploaded_by)){
    errors.uploaded_by = 'El autor es obligatorio';
  } else if(!loadExternal('employees').some(e => e.employee_id === payload.uploaded_by)){
    errors.uploaded_by = 'El autor seleccionado no existe';
  }
  const list = loadCollection('quality_evidence');
  const previous = list
    .filter(record => !options.ignoreId || record.id !== options.ignoreId)
    .reduce((total, record) => total + (Number(record.size_bytes) || 0), 0);
  if(!errors.size_bytes && previous + size > EVIDENCE_MAX_TOTAL_BYTES){
    errors.size_bytes = 'La evidencia supera el límite acumulado de 8 MB';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addEvidence(payload){
  assertCan(getActiveRole(), 'attach_evidence', { entityType: payload && payload.entity_type, entityId: payload && payload.entity_id });
  const check = validateEvidence(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const record = {
    id: generateId(),
    evidence_id: generateId(),
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    file_name: String(payload.file_name).trim(),
    mime_type: payload.mime_type,
    size_bytes: Number(payload.size_bytes),
    data_url: payload.data_url,
    uploaded_by: payload.uploaded_by,
    uploaded_at: now,
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_evidence');
  list.push(record);
  try{
    saveCollection('quality_evidence', list);
  }catch(error){
    if(isQuotaError(error)){
      throw new Error('No hay espacio suficiente para guardar la evidencia. La evidencia anterior se conserva.', { cause: error });
    }
    throw error;
  }
  return record;
}

export function deleteEvidence(id, actor){
  const list = loadCollection('quality_evidence');
  const record = list.find(item => item.id === id || item.evidence_id === id);
  if(!record) throw new Error('Evidencia no encontrada');
  assertCan(getActiveRole(), 'delete_evidence', {
    entityType: record.entity_type,
    entityId: record.entity_id,
    isOwner: actor ? record.uploaded_by === actor : undefined
  });
  saveCollection('quality_evidence', list.filter(item => item.id !== record.id));
  return true;
}

export function deleteEvidenceFor(entityType, entityId){
  const list = loadCollection('quality_evidence');
  const next = list.filter(record =>
    record.entity_type !== entityType || record.entity_id !== entityId
  );
  if(next.length !== list.length) saveCollection('quality_evidence', next);
  return next;
}

function isActiveAlertRule(rule){
  return Boolean(rule) && rule.is_active !== false;
}

export function validateAlertRule(rule, options = {}){
  const errors = {};
  const metric = rule && rule.metric;
  const operator = rule && rule.operator;
  if(!ALERT_METRICS.includes(metric)){
    errors.metric = 'El indicador de alerta no es válido';
  }
  if(!ALERT_OPERATORS.includes(operator)){
    errors.operator = 'El operador de alerta no es válido';
  }
  if(rule && (isBlank(rule.threshold) || !Number.isFinite(Number(rule.threshold)))){
    errors.threshold = 'El umbral debe ser numérico';
  } else if(!errors.metric){
    const threshold = Number(rule.threshold);
    if(ALERT_RATE_METRICS.includes(metric) && (threshold < 0 || threshold > 100)){
      errors.threshold = 'El umbral debe estar entre 0 y 100 para este indicador';
    } else if(!ALERT_RATE_METRICS.includes(metric) && threshold < 0){
      errors.threshold = 'El umbral debe ser mayor o igual que cero';
    }
  }
  if(!ALERT_SEVERITIES.includes(rule && rule.severity)){
    errors.severity = 'La severidad debe ser info, warning o critical';
  }
  if(!errors.metric && !errors.operator && isActiveAlertRule(rule)){
    const duplicate = loadCollection('quality_alert_rules').find(item =>
      isActiveAlertRule(item)
      && item.metric === metric
      && item.operator === operator
      && item.id !== options.ignoreId
      && item.alert_rule_id !== options.ignoreId
    );
    if(duplicate) errors.operator = 'Ya existe una regla activa para este indicador y operador';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addAlertRule(payload){
  const candidate = {
    metric: payload.metric,
    operator: payload.operator,
    threshold: payload.threshold,
    severity: payload.severity,
    is_active: payload.is_active !== false
  };
  const check = validateAlertRule(candidate);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const rule = {
    id: generateId(),
    alert_rule_id: generateId(),
    metric: candidate.metric,
    operator: candidate.operator,
    threshold: Number(candidate.threshold),
    severity: candidate.severity,
    is_active: candidate.is_active,
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_alert_rules');
  list.push(rule);
  saveCollection('quality_alert_rules', list);
  return rule;
}

export function updateAlertRule(id, updates){
  const list = loadCollection('quality_alert_rules');
  const idx = list.findIndex(rule => rule.id === id || rule.alert_rule_id === id);
  if(idx === -1) throw new Error('Regla de alerta no encontrada');
  const current = list[idx];
  const merged = {
    metric: updates.metric !== undefined ? updates.metric : current.metric,
    operator: updates.operator !== undefined ? updates.operator : current.operator,
    threshold: updates.threshold !== undefined ? updates.threshold : current.threshold,
    severity: updates.severity !== undefined ? updates.severity : current.severity,
    is_active: updates.is_active !== undefined ? Boolean(updates.is_active) : current.is_active
  };
  const check = validateAlertRule(merged, { ignoreId: current.id });
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  list[idx] = {
    ...current,
    metric: merged.metric,
    operator: merged.operator,
    threshold: Number(merged.threshold),
    severity: merged.severity,
    is_active: merged.is_active,
    updatedAt: new Date().toISOString()
  };
  saveCollection('quality_alert_rules', list);
  return list[idx];
}

export function deleteAlertRule(id){
  const list = loadCollection('quality_alert_rules');
  const rule = list.find(item => item.id === id || item.alert_rule_id === id);
  if(!rule) throw new Error('Regla de alerta no encontrada');
  saveCollection('quality_alert_rules', list.filter(item => item.id !== rule.id));
  return true;
}

function compareAlertValue(value, operator, threshold){
  if(operator === 'lt') return value < threshold;
  if(operator === 'lte') return value <= threshold;
  if(operator === 'gt') return value > threshold;
  if(operator === 'gte') return value >= threshold;
  if(operator === 'eq') return value === threshold;
  return false;
}

const REFERENCE_MODULE_STAGES = Object.freeze({
  goods_receipt: 'incoming',
  production_order: 'in_process',
  shipment: 'final'
});

function inspectionStage(inspection){
  if(!inspection) return null;
  return inspection.applicable_stage || inspection.stage || REFERENCE_MODULE_STAGES[inspection.reference_module] || null;
}

export function approvalRate(inspections, stage){
  const list = Array.isArray(inspections)
    ? inspections
    : loadCollection('quality_inspections');
  const filtered = isBlank(stage) ? list : list.filter(inspection => inspectionStage(inspection) === stage);
  return statusApprovalRate(filtered);
}

export function capaEffectiveness(actions){
  const list = Array.isArray(actions) ? actions : loadCollection('corrective_actions');
  return statusCapaEffectiveness(list);
}

export function pendingInspections(inspections){
  const list = Array.isArray(inspections) ? inspections : loadCollection('quality_inspections');
  return list.filter(inspection => ['draft', 'pending_review'].includes(inspection.inspection_status || inspection.status)).length;
}

export function reviewQueue(inspections){
  const list = Array.isArray(inspections) ? inspections : loadCollection('quality_inspections');
  return list.filter(inspection => isQueueableInspection(inspection));
}

export function deriveAlerts(kpis, alertRules){
  const values = kpis || {};
  const rules = Array.isArray(alertRules) ? alertRules : loadCollection('quality_alert_rules');
  return rules.reduce((alerts, rule) => {
    if(!isActiveAlertRule(rule)) return alerts;
    const current = Number(values[rule.metric]);
    if(!Number.isFinite(current)) return alerts;
    if(!compareAlertValue(current, rule.operator, Number(rule.threshold))) return alerts;
    alerts.push({ ...rule, value: current });
    return alerts;
  }, []);
}

export function loadExternal(name){
  ensureSeedData();
  const key = EXTERNAL_COLLECTION_KEYS[name];
  if(!key) throw new Error(`Colección externa desconocida: ${name}`);
  return readList(key);
}

export function saveExternal(name, records){
  const key = EXTERNAL_COLLECTION_KEYS[name];
  if(!key) throw new Error(`Colección externa desconocida: ${name}`);
  writeList(key, records);
  return records;
}

function externalNameForModule(referenceModule){
  if(referenceModule === 'goods_receipt') return 'goods_receipt';
  if(referenceModule === 'production_order') return 'production_order';
  if(referenceModule === 'shipment') return 'shipment';
  return null;
}

export function findReferenceRecord(referenceModule, referenceId){
  const externalName = externalNameForModule(referenceModule);
  if(!externalName || !referenceId) return null;
  const records = loadExternal(externalName);
  return records.find(r => r[`${externalName}_id`] === referenceId) || null;
}

export function validateReference(referenceModule, referenceId){
  const errors = {};
  if(!REFERENCE_MODULES.includes(referenceModule)){
    errors.reference_module = 'El módulo de origen debe ser goods_receipt, production_order o shipment';
  }
  if(!referenceId || !String(referenceId).trim()){
    errors.reference_id = 'El documento origen es obligatorio';
  } else if(!errors.reference_module && !findReferenceRecord(referenceModule, referenceId)){
    errors.reference_id = 'El documento origen no existe en el módulo indicado';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function externalDocuments(){
  ensureSeedData();
  const out = [];
  loadExternal('goods_receipt').forEach(r => out.push({
    reference_module: 'goods_receipt',
    reference_id: r.goods_receipt_id,
    product_id: r.product_id,
    date: r.date,
    label: `Recepción ${r.goods_receipt_id}`
  }));
  loadExternal('production_order').forEach(r => out.push({
    reference_module: 'production_order',
    reference_id: r.production_order_id,
    product_id: r.product_id,
    date: r.date,
    label: `Orden de producción ${r.production_order_id}`
  }));
  loadExternal('shipment').forEach(r => out.push({
    reference_module: 'shipment',
    reference_id: r.shipment_id,
    product_id: r.product_id,
    date: r.date,
    label: `Despacho ${r.shipment_id}`
  }));
  return out;
}

export function derivePendingLots(documents, inspections){
  const docs = Array.isArray(documents) ? documents : externalDocuments();
  const list = Array.isArray(inspections) ? inspections : loadCollection('quality_inspections');
  const completed = new Set(
    list.filter(i => i.inspection_status === 'completed')
      .map(i => `${i.reference_module}:${i.reference_id}`)
  );
  return docs.filter(d => !completed.has(`${d.reference_module}:${d.reference_id}`));
}

export function deriveQuarantineLots(nonConformances, correctiveActions, inspections){
  const ncs = Array.isArray(nonConformances) ? nonConformances : loadCollection('non_conformances');
  const actions = Array.isArray(correctiveActions) ? correctiveActions : loadCollection('corrective_actions');
  const insp = Array.isArray(inspections) ? inspections : loadCollection('quality_inspections');
  const rows = [];
  ncs.filter(nc => nc.status === 'open' || nc.status === 'under_review').forEach(nc => {
    const inspection = insp.find(i => i.inspection_id === nc.inspection_id);
    const hasCapa = actions.some(a => a.non_conformance_id === nc.non_conformance_id);
    rows.push({
      non_conformance_id: nc.non_conformance_id,
      inspection_id: nc.inspection_id,
      reference_module: inspection ? inspection.reference_module : null,
      reference_id: inspection ? inspection.reference_id : null,
      product_id: nc.product_id,
      severity: nc.severity,
      defect_type: nc.defect_type,
      status: nc.status,
      has_capa: hasCapa,
      status_label: hasCapa ? 'Cuarentena - En tratamiento' : 'Cuarentena'
    });
  });
  return rows;
}

function isBlank(v){ return v === undefined || v === null || (typeof v === 'string' && !v.trim()); }

export function validateInspectionPlan(plan){
  const errors = {};
  if(!plan || isBlank(plan.plan_name)) errors.plan_name = 'El nombre del plan es obligatorio';
  if(isBlank(plan.product_id)){
    errors.product_id = 'El producto es obligatorio';
  } else if(!loadExternal('products').some(p => p.product_id === plan.product_id)){
    errors.product_id = 'El producto seleccionado no existe';
  }
  if(!qualityCatalogKeys('inspection_categories').includes(plan && plan.applicable_stage)){
    errors.applicable_stage = 'Seleccione una categoría de inspección configurada';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function planCriteria(planId){
  return loadCollection('quality_inspection_criteria').filter(c => c.inspection_plan_id === planId);
}

export function planHasCriteria(planId){
  return planCriteria(planId).length > 0;
}

export function planHasInspections(planId){
  return loadCollection('quality_inspections').some(i => i.inspection_plan_id === planId);
}

export function criterionHasResults(criteriaId){
  return loadCollection('quality_inspection_results').some(r => r.criteria_id === criteriaId);
}

export function isPlanEnabled(planId){
  return planHasCriteria(planId);
}

function fail(code, message){
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requireJustification(justification){
  if(isBlank(justification)) fail('MISSING_JUSTIFICATION', 'Registra la justificación para continuar.');
  return String(justification).trim();
}

function workflowActor(actor){
  return isBlank(actor) ? getActiveRole() : String(actor).trim();
}

function findPlanRecord(id){
  return loadCollection('quality_inspection_plans').find(plan => plan.id === id || plan.inspection_plan_id === id);
}

function versionMetadata(id, previous){
  return {
    version_group_id: previous ? previous.version_group_id || previous.id : id,
    version: previous ? (Number(previous.version) || 1) + 1 : 1,
    version_of: previous ? previous.id : null
  };
}

export function addPlan(payload){
  assertCan(getActiveRole(), 'manage_plan', { status: 'draft', isDraft: true });
  const check = validateInspectionPlan(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const id = generateId();
  const plan = {
    id,
    inspection_plan_id: generateId(),
    ...versionMetadata(id),
    product_id: payload.product_id,
    plan_name: String(payload.plan_name).trim(),
    applicable_stage: payload.applicable_stage,
    status: 'draft',
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_justification: null,
    is_locked: false,
    created_by: isBlank(payload.created_by) ? null : String(payload.created_by).trim(),
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_inspection_plans');
  list.push(plan);
  saveCollection('quality_inspection_plans', list);
  recordAudit({
    entityType: 'inspection_plan',
    entityId: plan.inspection_plan_id,
    record: plan,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: { status: plan.status, version: plan.version },
    actor: plan.created_by
  });
  return plan;
}

export function updatePlan(id, updates, actor){
  const list = loadCollection('quality_inspection_plans');
  const idx = list.findIndex(p => p.id === id || p.inspection_plan_id === id);
  if(idx === -1) throw new Error('Plan no encontrado');
  const previous = list[idx];
  const hasHistory = Boolean(previous.is_locked) || planHasInspections(previous.inspection_plan_id);
  assertCan(getActiveRole(), 'manage_plan', { status: previous.status, hasHistory, isLocked: previous.is_locked });
  if(previous.status === 'approved' || hasHistory){
    fail('INVALID_STATE', 'El plan tiene inspecciones históricas o está aprobado y no puede editarse; duplícalo para crear una nueva versión');
  }
  if(previous.status === 'pending_approval'){
    fail('INVALID_STATE', 'El plan está pendiente de aprobación y no puede editarse');
  }
  const merged = { ...previous, ...updates };
  const check = validateInspectionPlan(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const next = {
    ...previous,
    product_id: merged.product_id,
    plan_name: String(merged.plan_name).trim(),
    applicable_stage: merged.applicable_stage,
    status: previous.status === 'rejected' ? 'draft' : previous.status,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspection_plans', list);
  const statusChanged = next.status !== previous.status;
  recordAudit({
    entityType: 'inspection_plan',
    entityId: previous.inspection_plan_id,
    record: next,
    action: statusChanged ? 'status_change' : 'update',
    changedField: statusChanged ? 'status' : 'plan_name',
    beforeValue: statusChanged ? previous.status : previous.plan_name,
    afterValue: statusChanged ? next.status : next.plan_name,
    actor: actor || undefined,
    justification: statusChanged ? previous.review_justification : undefined
  });
  return next;
}

export function submitPlanForApproval(id, actor){
  const list = loadCollection('quality_inspection_plans');
  const idx = list.findIndex(plan => plan.id === id || plan.inspection_plan_id === id);
  if(idx === -1) throw new Error('Plan no encontrado');
  const previous = list[idx];
  const criteriaCount = planCriteria(previous.inspection_plan_id).length;
  assertCan(getActiveRole(), 'submit_plan', { status: previous.status, criteriaCount });
  if(!['draft', 'rejected'].includes(previous.status)){
    fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  }
  if(!criteriaCount) fail('INVALID_STATE', 'El plan necesita al menos un criterio para enviarse a aprobación');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status: 'pending_approval',
    submitted_by: workflowActor(actor),
    submitted_at: now,
    reviewed_by: null,
    reviewed_at: null,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspection_plans', list);
  recordAudit({
    entityType: 'inspection_plan',
    entityId: previous.inspection_plan_id,
    record: next,
    action: 'status_change',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: next.status,
    actor: next.submitted_by
  });
  return next;
}

export function approvePlan(id, reviewer, justification){
  const list = loadCollection('quality_inspection_plans');
  const idx = list.findIndex(plan => plan.id === id || plan.inspection_plan_id === id);
  if(idx === -1) throw new Error('Plan no encontrado');
  const previous = list[idx];
  assertCan(getActiveRole(), 'approve_plan', { status: previous.status });
  const status = transition('plan', 'approve', previous.status, { requiresJustification: false });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  const now = new Date().toISOString();
  const reviewedBy = workflowActor(reviewer);
  const next = {
    ...previous,
    status,
    reviewed_by: reviewedBy,
    reviewed_at: now,
    review_justification: isBlank(justification) ? previous.review_justification : String(justification).trim(),
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspection_plans', list);
  recordAudit({
    entityType: 'inspection_plan',
    entityId: previous.inspection_plan_id,
    record: next,
    action: 'approve',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: {
      status: next.status,
      reviewed_by: next.reviewed_by,
      reviewed_at: next.reviewed_at,
      review_justification: next.review_justification
    },
    actor: next.reviewed_by,
    justification
  });
  return next;
}

export function rejectPlan(id, reviewer, justification){
  const list = loadCollection('quality_inspection_plans');
  const idx = list.findIndex(plan => plan.id === id || plan.inspection_plan_id === id);
  if(idx === -1) throw new Error('Plan no encontrado');
  const previous = list[idx];
  assertCan(getActiveRole(), 'reject_plan', { status: previous.status });
  const reason = requireJustification(justification);
  const status = transition('plan', 'reject', previous.status, { requiresJustification: true, justification: reason });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    reviewed_by: workflowActor(reviewer),
    reviewed_at: now,
    review_justification: reason,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspection_plans', list);
  recordAudit({
    entityType: 'inspection_plan',
    entityId: previous.inspection_plan_id,
    record: next,
    action: 'reject',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: {
      status: next.status,
      reviewed_by: next.reviewed_by,
      reviewed_at: next.reviewed_at,
      review_justification: next.review_justification
    },
    actor: next.reviewed_by,
    justification: reason
  });
  return next;
}

export function duplicatePlanVersion(id, actor){
  const source = findPlanRecord(id);
  if(!source) throw new Error('Plan no encontrado');
  const hasHistory = Boolean(source.is_locked) || planHasInspections(source.inspection_plan_id);
  assertCan(getActiveRole(), 'version_plan', { status: source.status, hasHistory });
  if(source.status !== 'approved') fail('INVALID_STATE', 'Solo se puede versionar un plan aprobado.');
  const now = new Date().toISOString();
  const newId = generateId();
  const copy = {
    ...source,
    id: newId,
    inspection_plan_id: generateId(),
    ...versionMetadata(newId, source),
    status: 'draft',
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_justification: null,
    is_locked: false,
    created_by: workflowActor(actor),
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_inspection_plans');
  list.push(copy);
  saveCollection('quality_inspection_plans', list);
  planCriteria(source.inspection_plan_id).forEach(criterion => {
    addCriterion({
      inspection_plan_id: copy.inspection_plan_id,
      criteria_name: criterion.criteria_name,
      expected_value: criterion.expected_value,
      tolerance: criterion.tolerance,
      unit: criterion.unit,
      comparison_type: criterion.comparison_type,
      is_critical: criterion.is_critical
    });
  });
  recordAudit({
    entityType: 'inspection_plan',
    entityId: copy.inspection_plan_id,
    record: copy,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: { status: copy.status, version: copy.version, version_group_id: copy.version_group_id, version_of: copy.version_of },
    actor: copy.created_by
  });
  return copy;
}

export function deletePlan(id, actor){
  const plans = loadCollection('quality_inspection_plans');
  const plan = plans.find(p => p.id === id || p.inspection_plan_id === id);
  if(!plan) throw new Error('Plan no encontrado');
  const hasHistory = Boolean(plan.is_locked) || planHasInspections(plan.inspection_plan_id);
  assertCan(getActiveRole(), 'delete_plan', { status: plan.status, hasHistory });
  if(hasHistory || plan.status === 'approved'){
    throw new Error('El plan tiene inspecciones históricas o está aprobado y no puede eliminarse');
  }
  saveCollection('quality_inspection_plans', plans.filter(p => p.id !== plan.id));
  deleteRelated('quality_inspection_criteria', 'inspection_plan_id', plan.inspection_plan_id);
  recordAudit({
    entityType: 'inspection_plan',
    entityId: plan.inspection_plan_id,
    record: plan,
    action: 'delete',
    changedField: 'status',
    beforeValue: plan.status,
    afterValue: null,
    actor: actor || undefined
  });
  return true;
}

export function duplicatePlan(id){
  const source = findPlanRecord(id);
  if(!source) throw new Error('Plan no encontrado');
  const copy = addPlan({
    product_id: source.product_id,
    plan_name: `${source.plan_name} (copia)`,
    applicable_stage: source.applicable_stage
  });
  planCriteria(source.inspection_plan_id).forEach(criterion => {
    addCriterion({
      inspection_plan_id: copy.inspection_plan_id,
      criteria_name: criterion.criteria_name,
      expected_value: criterion.expected_value,
      tolerance: criterion.tolerance,
      unit: criterion.unit,
      comparison_type: criterion.comparison_type,
      is_critical: criterion.is_critical
    });
  });
  return copy;
}

export function validateCriterion(criterion){
  const errors = {};
  if(!criterion || isBlank(criterion.criteria_name)) errors.criteria_name = 'El nombre del criterio es obligatorio';
  const expected = Number(criterion && criterion.expected_value);
  if(isBlank(criterion && criterion.expected_value) || !Number.isFinite(expected)){
    errors.expected_value = 'El valor esperado debe ser numérico';
  }
  const tolerance = Number(criterion && criterion.tolerance);
  if(isBlank(criterion && criterion.tolerance) || !Number.isFinite(tolerance)){
    errors.tolerance = 'La tolerancia debe ser numérica';
  } else if(tolerance < 0){
    errors.tolerance = 'La tolerancia no puede ser negativa';
  }
  if(isBlank(criterion && criterion.unit)) errors.unit = 'La unidad es obligatoria';
  if(!COMPARISON_TYPES.includes(criterion && criterion.comparison_type)){
    errors.comparison_type = 'El tipo de comparación debe ser range, min, max o boolean';
  }
  if(!criterion || !planCriteria(criterion.inspection_plan_id).length){
    // permitido crear el primer criterio; solo se valida que el plan exista
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addCriterion(payload){
  const check = validateCriterion(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const criterion = {
    id: generateId(),
    criteria_id: generateId(),
    inspection_plan_id: payload.inspection_plan_id,
    criteria_name: String(payload.criteria_name).trim(),
    expected_value: Number(payload.expected_value),
    tolerance: Number(payload.tolerance),
    unit: String(payload.unit).trim(),
    comparison_type: payload.comparison_type,
    is_critical: Boolean(payload.is_critical),
    is_locked: false,
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_inspection_criteria');
  list.push(criterion);
  saveCollection('quality_inspection_criteria', list);
  return criterion;
}

export function updateCriterion(id, updates){
  const list = loadCollection('quality_inspection_criteria');
  const idx = list.findIndex(c => c.id === id || c.criteria_id === id);
  if(idx === -1) throw new Error('Criterio no encontrado');
  if(list[idx].is_locked || criterionHasResults(list[idx].criteria_id)){
    throw new Error('El criterio tiene resultados históricos y no puede editarse');
  }
  const merged = { ...list[idx], ...updates };
  const check = validateCriterion(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  list[idx] = {
    ...list[idx],
    criteria_name: String(merged.criteria_name).trim(),
    expected_value: Number(merged.expected_value),
    tolerance: Number(merged.tolerance),
    unit: String(merged.unit).trim(),
    comparison_type: merged.comparison_type,
    is_critical: Boolean(merged.is_critical),
    updatedAt: new Date().toISOString()
  };
  saveCollection('quality_inspection_criteria', list);
  return list[idx];
}

export function deleteCriterion(id){
  const list = loadCollection('quality_inspection_criteria');
  const criterion = list.find(c => c.id === id || c.criteria_id === id);
  if(!criterion) throw new Error('Criterio no encontrado');
  if(criterion.is_locked || criterionHasResults(criterion.criteria_id)){
    throw new Error('El criterio tiene resultados históricos y no puede eliminarse');
  }
  saveCollection('quality_inspection_criteria', list.filter(c => c.id !== criterion.id));
  return true;
}

function findChecklistRecord(id){
  if(isBlank(id)) return null;
  return loadCollection('quality_checklists').find(item => item.id === id || item.checklist_id === id) || null;
}

function inspectionResults(inspectionId){
  return loadCollection('quality_inspection_results').filter(result => result.inspection_id === inspectionId);
}

function criteriaForInspection(inspection){
  const plan = findPlanRecord(inspection && inspection.inspection_plan_id);
  const checklist = findChecklistRecord(inspection && inspection.checklist_id);
  return [
    ...(plan ? planCriteria(plan.inspection_plan_id) : []),
    ...(checklist && Array.isArray(checklist.criteria) ? checklist.criteria : [])
  ];
}

function isQueueableInspection(inspection){
  if(!inspection) return false;
  const status = inspection.inspection_status || inspection.status;
  const proposed = inspection.proposed_result === undefined ? inspection.proposedResult : inspection.proposed_result;
  const result = inspection.overall_result === undefined ? inspection.overallResult : inspection.overall_result;
  const decision = inspection.review_decision === undefined ? inspection.reviewDecision : inspection.review_decision;
  if(status === 'pending_review') return true;
  return status === 'completed' && decision === null
    && (proposed === 'conditional' || (proposed === undefined && result === 'conditional'));
}

export function validateInspection(payload){
  const errors = {};
  const plan = findPlanRecord(payload && payload.inspection_plan_id);
  if(!plan){
    errors.inspection_plan_id = 'Selecciona un plan de inspección válido';
  } else if(plan.status !== 'approved'){
    errors.inspection_plan_id = 'Solo se pueden usar planes aprobados.';
  } else if(!planHasCriteria(plan.inspection_plan_id)){
    errors.inspection_plan_id = 'El plan necesita al menos un criterio para habilitarse';
  }
  const checklist = findChecklistRecord(payload && payload.checklist_id);
  if(!isBlank(payload && payload.checklist_id) && !checklist){
    errors.checklist_id = 'Selecciona una lista de verificación válida';
  } else if(checklist && checklist.status !== 'approved'){
    errors.checklist_id = 'Solo se pueden usar listas aprobadas.';
  }
  if(isBlank(payload.inspector_id)){
    errors.inspector_id = 'El inspector es obligatorio';
  } else if(!loadExternal('employees').some(e => e.employee_id === payload.inspector_id)){
    errors.inspector_id = 'El inspector seleccionado no existe';
  }
  Object.assign(errors, validateReference(payload.reference_module, payload.reference_id).errors);
  if(isBlank(payload.inspection_date)) errors.inspection_date = 'La fecha de inspección es obligatoria';
  else if(!isValidDate(payload.inspection_date)) errors.inspection_date = 'La fecha de inspección no es válida (YYYY-MM-DD)';
  return { valid: Object.keys(errors).length === 0, errors, plan, checklist };
}

export function addInspection(payload){
  const check = validateInspection(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  assertCan(getActiveRole(), 'execute_inspection', {
    status: 'draft',
    planStatus: check.plan && check.plan.status,
    checklistStatus: check.checklist ? check.checklist.status : undefined
  });
  const now = new Date().toISOString();
  const legacy = payload.inspection_status === 'completed' || payload.status === 'completed';
  const status = legacy && INSPECTION_STATUSES.includes('completed') ? 'completed' : 'draft';
  const proposedResult = legacy
    ? (payload.proposed_result || payload.overall_result || null)
    : null;
  const inspection = {
    id: generateId(),
    inspection_id: generateId(),
    inspection_plan_id: payload.inspection_plan_id,
    checklist_id: isBlank(payload.checklist_id) ? null : payload.checklist_id,
    checklist_version: check.checklist ? check.checklist.version || 1 : null,
    inspector_id: payload.inspector_id,
    reference_module: payload.reference_module,
    reference_id: payload.reference_id,
    inspection_date: payload.inspection_date,
    inspection_status: status,
    proposed_result: proposedResult,
    overall_result: legacy ? (payload.overall_result || null) : null,
    review_decision: payload.review_decision || null,
    review_justification: payload.review_justification || null,
    reviewed_by: payload.reviewed_by || null,
    reviewed_at: payload.reviewed_at || null,
    submitted_by: payload.submitted_by || null,
    submitted_at: payload.submitted_at || null,
    legacy_completed: legacy && !payload.review_decision,
    override_justification: payload.override_justification || undefined,
    overridden_by: payload.overridden_by || undefined,
    override_at: payload.override_at || undefined,
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_inspections');
  list.push(inspection);
  saveCollection('quality_inspections', list);
  recordAudit({
    entityType: 'inspection',
    entityId: inspection.inspection_id,
    record: inspection,
    action: 'create',
    changedField: 'inspection_status',
    beforeValue: null,
    afterValue: { inspection_status: inspection.inspection_status },
    actor: inspection.inspector_id
  });
  return inspection;
}

export function updateInspection(id, updates, options = {}){
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(i => i.id === id || i.inspection_id === id);
  if(idx === -1) throw new Error('Inspección no encontrada');
  const previous = list[idx];
  const plan = findPlanRecord(previous.inspection_plan_id);
  const checklist = findChecklistRecord(previous.checklist_id);
  assertCan(getActiveRole(), 'execute_inspection', {
    status: previous.inspection_status,
    planStatus: plan && plan.status,
    checklistStatus: checklist ? checklist.status : undefined
  });
  if(previous.inspection_status === 'pending_review' && !options.allowPending){
    fail('INVALID_STATE', 'La inspección está pendiente de revisión y no puede editarse');
  }
  list[idx] = { ...previous, ...updates, id: previous.id, updatedAt: new Date().toISOString() };
  saveCollection('quality_inspections', list);
  if(options.audit !== false && options.auditMode !== 'override'){
    const actor = options.actor || updates.overridden_by || updates.inspector_id || previous.inspector_id;
    recordUpdateAudit({
      entityType: 'inspection',
      entityId: previous.inspection_id,
      previous,
      next: list[idx],
      actor,
      justification: options.justification,
      statusField: 'inspection_status'
    });
  }
  return list[idx];
}

export function deleteInspection(id){
  const list = loadCollection('quality_inspections');
  const inspection = list.find(i => i.id === id || i.inspection_id === id);
  if(!inspection) throw new Error('Inspección no encontrada');
  const hasNc = loadCollection('non_conformances').some(nc => nc.inspection_id === inspection.inspection_id);
  assertCan(getActiveRole(), 'delete_records', { status: inspection.inspection_status, isDraft: inspection.inspection_status === 'draft', hasHistory: hasNc });
  if(hasNc) throw new Error('La inspección tiene una no conformidad asociada y no puede eliminarse');
  saveCollection('quality_inspections', list.filter(i => i.id !== inspection.id));
  deleteRelated('quality_inspection_results', 'inspection_id', inspection.inspection_id);
  deleteEvidenceFor('inspection', inspection.inspection_id);
  recordAudit({
    entityType: 'inspection',
    entityId: inspection.inspection_id,
    record: inspection,
    action: 'delete',
    changedField: 'inspection_status',
    beforeValue: inspection.inspection_status,
    afterValue: null,
    actor: inspection.inspector_id
  });
  return true;
}

export function setInspectionResults(inspectionId, results){
  const list = loadCollection('quality_inspection_results');
  const next = list.filter(r => r.inspection_id !== inspectionId);
  const now = new Date().toISOString();
  results.forEach(r => {
    next.push({
      id: generateId(),
      result_id: generateId(),
      inspection_id: inspectionId,
      criteria_id: r.criteria_id,
      measured_value: Number(r.measured_value),
      pass_fail: Boolean(r.pass_fail),
      createdAt: now,
      updatedAt: now
    });
  });
  saveCollection('quality_inspection_results', next);
  return next.filter(r => r.inspection_id === inspectionId);
}

export function completeInspection(id, overallResult, results, actor){
  setInspectionResults(id, results || []);
  const now = new Date().toISOString();
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(item => item.id === id || item.inspection_id === id);
  if(idx === -1) throw new Error('Inspección no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'execute_inspection', { status: previous.inspection_status });
  const proposedResult = ['passed', 'conditional', 'failed'].includes(overallResult) ? overallResult : null;
  const next = {
    ...previous,
    inspection_status: 'completed',
    proposed_result: proposedResult,
    overall_result: overallResult,
    review_decision: previous.review_decision || null,
    legacy_completed: !previous.review_decision,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspections', list);
  recordAudit({
    entityType: 'inspection',
    entityId: previous.inspection_id,
    record: next,
    action: 'status_change',
    changedField: 'inspection_status',
    beforeValue: previous.inspection_status,
    afterValue: 'completed',
    actor: actor || previous.inspector_id
  });
  if(overallResult === 'failed' && qualityParameter('auto_create_nc_on_failure')){
    createNonConformanceFromInspection(next.inspection_id);
  }
  return { inspection: next, results: inspectionResults(next.inspection_id) };
}

export function saveDraftInspection(id, results, actor){
  const saved = setInspectionResults(id, results || []);
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(item => item.id === id || item.inspection_id === id);
  if(idx === -1) throw new Error('Inspección no encontrada');
  const previous = list[idx];
  const plan = findPlanRecord(previous.inspection_plan_id);
  const checklist = findChecklistRecord(previous.checklist_id);
  assertCan(getActiveRole(), 'execute_inspection', {
    status: previous.inspection_status,
    planStatus: plan && plan.status,
    checklistStatus: checklist ? checklist.status : undefined
  });
  if(previous.inspection_status === 'pending_review'){
    fail('INVALID_STATE', 'La inspección está pendiente de revisión y no puede editarse');
  }
  const now = new Date().toISOString();
  const next = {
    ...previous,
    inspection_status: 'draft',
    proposed_result: null,
    overall_result: null,
    review_decision: null,
    review_justification: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_by: null,
    submitted_at: null,
    legacy_completed: false,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspections', list);
  if(previous.inspection_status !== 'draft'){
    recordAudit({
      entityType: 'inspection',
      entityId: previous.inspection_id,
      record: next,
      action: 'status_change',
      changedField: 'inspection_status',
      beforeValue: previous.inspection_status,
      afterValue: 'draft',
      actor: actor || previous.inspector_id
    });
  }
  return { inspection: next, results: saved };
}

export function submitInspectionForReview(id, actor){
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(item => item.id === id || item.inspection_id === id);
  if(idx === -1) throw new Error('Inspección no encontrada');
  const previous = list[idx];
  const plan = findPlanRecord(previous.inspection_plan_id);
  const checklist = findChecklistRecord(previous.checklist_id);
  assertCan(getActiveRole(), 'submit_inspection', {
    status: previous.inspection_status,
    planStatus: plan && plan.status,
    checklistStatus: checklist ? checklist.status : undefined
  });
  if(!['draft'].includes(previous.inspection_status)){
    fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  }
  if(!plan || plan.status !== 'approved'){
    fail('NON_APPROVED_PLAN', 'Solo se pueden usar planes aprobados.');
  }
  if(checklist && checklist.status !== 'approved'){
    fail('NON_APPROVED_CHECKLIST', 'Solo se pueden usar listas aprobadas.');
  }
  const criteria = criteriaForInspection(previous);
  if(!criteria.length) fail('INVALID_STATE', 'El plan de inspección no tiene criterios');
  const evaluation = evaluateInspection({ criteria }, inspectionResults(previous.inspection_id));
  if(evaluation.status !== 'complete'){
    fail('INVALID_STATE', 'Faltan mediciones para enviar la inspección a revisión');
  }
  setInspectionResults(previous.inspection_id, evaluation.results.map((result, index) => ({
    criteria_id: criteria[index] && criteria[index].criteria_id !== undefined ? criteria[index].criteria_id : result.criteria_id,
    measured_value: result.measured_value,
    pass_fail: result.pass_fail
  })));
  const now = new Date().toISOString();
  const next = {
    ...previous,
    inspection_status: 'pending_review',
    proposed_result: evaluation.overall_result,
    overall_result: null,
    review_decision: null,
    review_justification: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_by: workflowActor(actor),
    submitted_at: now,
    legacy_completed: false,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspections', list);
  recordAudit({
    entityType: 'inspection',
    entityId: previous.inspection_id,
    record: next,
    action: 'status_change',
    changedField: 'inspection_status',
    beforeValue: previous.inspection_status,
    afterValue: next.inspection_status,
    actor: next.submitted_by
  });
  return next;
}

function parseInspectionReviewArguments(third, fourth){
  if(ROLES.includes(third)) return { actor: third, justification: fourth };
  if(ROLES.includes(fourth)) return { actor: fourth, justification: third };
  if(!isBlank(third) && loadExternal('employees').some(employee => employee.employee_id === third)){
    return { actor: third, justification: fourth };
  }
  return { actor: fourth || getActiveRole(), justification: third };
}

export function reviewInspection(id, decision, third, fourth){
  const args = parseInspectionReviewArguments(third, fourth);
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(item => item.id === id || item.inspection_id === id);
  if(idx === -1) throw new Error('Inspección no encontrada');
  const previous = list[idx];
  const eligible = isQueueableInspection(previous);
  assertCan(getActiveRole(), 'review_inspection', {
    inspectionStatus: previous.inspection_status,
    proposedResult: previous.proposed_result,
    reviewDecision: previous.review_decision,
    isLegacy: eligible && previous.inspection_status === 'completed'
  });
  if(!eligible) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  const reviewed = reviewInspectionRecord(previous, decision, args.justification, args.actor || getActiveRole(), {
    criteria: criteriaForInspection(previous),
    results: inspectionResults(previous.inspection_id),
    now: new Date().toISOString()
  });
  const next = {
    ...previous,
    inspection_status: reviewed.inspection_status,
    proposed_result: reviewed.proposed_result,
    overall_result: reviewed.overall_result,
    review_decision: reviewed.review_decision,
    reviewed_by: reviewed.reviewed_by,
    reviewed_at: reviewed.reviewed_at,
    review_justification: reviewed.review_justification,
    legacy_completed: previous.inspection_status === 'completed',
    updatedAt: reviewed.reviewed_at
  };
  list[idx] = next;
  saveCollection('quality_inspections', list);
  const audit = reviewed.audit || {};
  recordAudit({
    entityType: 'inspection',
    entityId: previous.inspection_id,
    record: next,
    action: audit.action,
    changedField: 'overall_result',
    beforeValue: audit.before_value,
    afterValue: audit.after_value,
    actor: audit.actor,
    justification: args.justification,
    timestamp: audit.timestamp
  });
  if(reviewed.createNonConformance){
    createNonConformanceFromInspection(next.inspection_id);
  }
  return next;
}

export function validateNonConformance(nc){
  const errors = {};
  if(!nc || isBlank(nc.description)) errors.description = 'La descripción es obligatoria';
  if(!DEFECT_TYPES.includes(nc && nc.defect_type)) errors.defect_type = 'Tipo de defecto inválido';
  if(!qualityCatalogKeys('severity_levels').includes(nc && nc.severity)) errors.severity = 'Seleccione una gravedad configurada';
  if(!qualityCatalogKeys('nc_statuses').includes(nc && nc.status)) errors.status = 'Seleccione un estado configurado';
  if(isBlank(nc && nc.product_id)) errors.product_id = 'El producto es obligatorio';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addNonConformance(payload){
  assertCan(getActiveRole(), 'create_non_conformance', { inspectionId: payload && payload.inspection_id });
  const check = validateNonConformance(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const inspection = payload.inspection_id
    ? loadCollection('quality_inspections').find(i => i.inspection_id === payload.inspection_id)
    : null;
  const lot = auditLotReference('non_conformance', payload);
  const nc = {
    id: generateId(),
    non_conformance_id: generateId(),
    inspection_id: payload.inspection_id,
    product_id: payload.product_id,
    reference_module: lot.reference_module,
    reference_id: lot.reference_id,
    description: String(payload.description).trim(),
    defect_type: payload.defect_type,
    severity: payload.severity,
    status: payload.status,
    detected_date: String(payload.detected_date || now.slice(0, 10)).slice(0, 10),
    responsible_employee_id: payload.responsible_employee_id || undefined,
    observations: String(payload.observations || '').trim(),
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('non_conformances');
  list.push(nc);
  saveCollection('non_conformances', list);
  recordAudit({
    entityType: 'non_conformance',
    entityId: nc.non_conformance_id,
    record: nc,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: nc.status,
    actor: inspection ? inspection.inspector_id : undefined
  });
  return nc;
}

export function updateNonConformance(id, updates){
  const list = loadCollection('non_conformances');
  const idx = list.findIndex(nc => nc.id === id || nc.non_conformance_id === id);
  if(idx === -1) throw new Error('No conformidad no encontrada');
  const previous = list[idx];
  const closing = updates.status === 'closed' && previous.status !== 'closed';
  assertCan(getActiveRole(), closing ? 'close_non_conformance' : 'edit_non_conformance', { status: previous.status });
  const merged = { ...previous, ...updates };
  const check = validateNonConformance(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  list[idx] = {
    ...previous,
    description: String(merged.description).trim(),
    defect_type: merged.defect_type,
    severity: merged.severity,
    status: merged.status,
    detected_date: String(merged.detected_date || previous.detected_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    responsible_employee_id: merged.responsible_employee_id || previous.responsible_employee_id || undefined,
    observations: String(merged.observations || '').trim(),
    updatedAt: new Date().toISOString()
  };
  saveCollection('non_conformances', list);
  const inspection = list[idx].inspection_id
    ? loadCollection('quality_inspections').find(i => i.inspection_id === list[idx].inspection_id)
    : null;
  recordUpdateAudit({
    entityType: 'non_conformance',
    entityId: list[idx].non_conformance_id,
    previous,
    next: list[idx],
    actor: inspection ? inspection.inspector_id : undefined,
    justification: updates.justification
  });
  return list[idx];
}

export function deleteNonConformance(id){
  const list = loadCollection('non_conformances');
  const nc = list.find(n => n.id === id || n.non_conformance_id === id);
  if(!nc) throw new Error('No conformidad no encontrada');
  assertCan(getActiveRole(), 'delete_non_conformance', { status: nc.status });
  const cascadedActions = loadCollection('corrective_actions')
    .filter(a => a.non_conformance_id === nc.non_conformance_id);
  const inspection = nc.inspection_id
    ? loadCollection('quality_inspections').find(i => i.inspection_id === nc.inspection_id)
    : null;
  saveCollection('non_conformances', list.filter(n => n.id !== nc.id));
  deleteRelated('corrective_actions', 'non_conformance_id', nc.non_conformance_id);
  deleteEvidenceFor('non_conformance', nc.non_conformance_id);
  recordAudit({
    entityType: 'non_conformance',
    entityId: nc.non_conformance_id,
    record: nc,
    action: 'delete',
    changedField: 'status',
    beforeValue: nc.status,
    afterValue: null,
    actor: inspection ? inspection.inspector_id : undefined
  });
  cascadedActions.forEach(action => recordAudit({
    entityType: 'corrective_action',
    entityId: action.corrective_action_id,
    record: nc,
    action: 'delete',
    changedField: 'status',
    beforeValue: action.status,
    afterValue: null,
    actor: action.responsible_employee_id
  }));
  return true;
}

export function createNonConformanceFromInspection(inspectionId){
  const existing = loadCollection('non_conformances').find(nc => nc.inspection_id === inspectionId);
  if(existing) return existing;
  const params = loadQualitySettings().parameters;
  const inspection = loadCollection('quality_inspections').find(i => i.inspection_id === inspectionId);
  if(!inspection) throw new Error('Inspección no encontrada');
  const plan = loadCollection('quality_inspection_plans').find(p => p.inspection_plan_id === inspection.inspection_plan_id);
  const criteria = planCriteria(inspection.inspection_plan_id);
  const results = loadCollection('quality_inspection_results').filter(r => r.inspection_id === inspectionId);
  const failed = results.filter(r => r.pass_fail === false).map(r => {
    const c = criteria.find(x => x.criteria_id === r.criteria_id);
    return c ? c.criteria_name : r.criteria_id;
  });
  const description = `Desviación detectada en el plan "${plan ? plan.plan_name : inspection.inspection_plan_id}": ` +
    (failed.length ? `no cumplen ${failed.join(', ')}.` : 'la inspección resultó reprobada.');
  return addNonConformance({
    inspection_id: inspectionId,
    product_id: plan ? plan.product_id : null,
    description,
    defect_type: 'other',
    severity: params.default_nc_severity,
    status: params.default_nc_status,
    detected_date: inspection.inspection_date
  });
}

function defaultActionProgress(status){
  if(status === 'completed') return 100;
  if(status === 'in_progress') return 50;
  return 0;
}

function normalizeActionProgress(value, status){
  const numeric = Number(value === undefined || value === null || value === '' ? defaultActionProgress(status) : value);
  if(!Number.isFinite(numeric)) return defaultActionProgress(status);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function validateCorrectiveAction(action){
  const errors = {};
  if(action && action.action_category !== undefined && !qualityCatalogKeys('action_types').includes(action.action_category)){
    errors.action_category = 'Seleccione un tipo de acción configurado';
  }
  if(action && action.progress !== undefined && action.progress !== ''
    && (!Number.isFinite(Number(action.progress)) || Number(action.progress) < 0 || Number(action.progress) > 100)){
    errors.progress = 'El avance debe estar entre 0 y 100';
  }
  if(isBlank(action && action.responsible_employee_id)){
    errors.responsible_employee_id = 'El responsable es obligatorio';
  } else if(!loadExternal('employees').some(e => e.employee_id === action.responsible_employee_id)){
    errors.responsible_employee_id = 'El responsable seleccionado no existe';
  }
  if(isBlank(action && action.action_description)) errors.action_description = 'La descripción de la acción es obligatoria';
  if(isBlank(action && action.root_cause)) errors.root_cause = 'La causa raíz es obligatoria';
  if(!ACTION_TYPES.includes(action && action.action_type)) errors.action_type = 'El tipo de acción debe ser resampling, rework u other';
  if(isBlank(action && action.due_date)) errors.due_date = 'La fecha límite es obligatoria';
  else if(!isValidDate(action.due_date)) errors.due_date = 'La fecha límite no es válida (YYYY-MM-DD)';
  if(!CORRECTIVE_ACTION_STATUSES.includes(action && action.status)) errors.status = 'Estado de acción CAPA inválido';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addCorrectiveAction(payload){
  assertCan(getActiveRole(), 'propose_capa', { nonConformanceId: payload && payload.non_conformance_id });
  const check = validateCorrectiveAction(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const lot = auditLotReference('corrective_action', payload);
  const action = {
    id: generateId(),
    corrective_action_id: generateId(),
    non_conformance_id: payload.non_conformance_id,
    reference_module: lot.reference_module,
    reference_id: lot.reference_id,
    responsible_employee_id: payload.responsible_employee_id,
    action_category: payload.action_category || 'corrective',
    action_description: String(payload.action_description).trim(),
    root_cause: String(payload.root_cause).trim(),
    action_type: payload.action_type,
    start_date: String(payload.start_date || now.slice(0, 10)).slice(0, 10),
    due_date: payload.due_date,
    expected_result: String(payload.expected_result || '').trim(),
    observations: String(payload.observations || '').trim(),
    progress: normalizeActionProgress(payload.progress, payload.status),
    status: payload.status,
    completed_at: payload.status === 'completed' ? now : undefined,
    closure_status: payload.status === 'completed' ? 'pending' : (payload.closure_status || null),
    closure_requested_at: payload.status === 'completed' ? now : null,
    closure_reviewed_by: null,
    closure_reviewed_at: null,
    closure_justification: null,
    effectiveness_result: null,
    effectiveness_observations: null,
    effectiveness_reviewed_by: null,
    effectiveness_reviewed_at: null,
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('corrective_actions');
  list.push(action);
  saveCollection('corrective_actions', list);
  recordAudit({
    entityType: 'corrective_action',
    entityId: action.corrective_action_id,
    record: action,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: action.status,
    actor: action.responsible_employee_id
  });
  return action;
}

export function updateCorrectiveAction(id, updates){
  const list = loadCollection('corrective_actions');
  const idx = list.findIndex(a => a.id === id || a.corrective_action_id === id);
  if(idx === -1) throw new Error('Acción CAPA no encontrada');
  const previous = list[idx];
  const completing = updates.status === 'completed' && previous.status !== 'completed';
  const starting = previous.status === 'pending' && updates.status === 'in_progress';
  assertCan(getActiveRole(), starting || completing ? 'complete_capa' : 'edit_capa', {
    status: previous.status,
    closureStatus: previous.closure_status
  });
  if(previous.closure_status === 'approved') fail('INVALID_STATE', 'La CAPA tiene el cierre aprobado y no puede editarse');
  const merged = { ...previous, ...updates };
  const check = validateCorrectiveAction(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  list[idx] = {
    ...previous,
    responsible_employee_id: merged.responsible_employee_id,
    action_category: merged.action_category || previous.action_category || 'corrective',
    action_description: String(merged.action_description).trim(),
    root_cause: String(merged.root_cause).trim(),
    action_type: merged.action_type,
    start_date: String(merged.start_date || previous.start_date || now.slice(0, 10)).slice(0, 10),
    due_date: merged.due_date,
    expected_result: String(merged.expected_result || '').trim(),
    observations: String(merged.observations || '').trim(),
    progress: merged.progress !== undefined && merged.progress !== ''
      ? normalizeActionProgress(merged.progress, merged.status)
      : (merged.status === 'completed'
        ? 100
        : normalizeActionProgress(previous.progress, merged.status)),
    status: merged.status,
    completed_at: completing ? now : previous.completed_at,
    closure_status: completing ? 'pending' : (previous.closure_status || null),
    closure_requested_at: completing ? now : previous.closure_requested_at || null,
    updatedAt: now
  };
  saveCollection('corrective_actions', list);
  recordUpdateAudit({
    entityType: 'corrective_action',
    entityId: list[idx].corrective_action_id,
    previous,
    next: list[idx],
    actor: updates.responsible_employee_id || list[idx].responsible_employee_id,
    justification: updates.justification
  });
  return list[idx];
}

export function deleteCorrectiveAction(id){
  const list = loadCollection('corrective_actions');
  const action = list.find(a => a.id === id || a.corrective_action_id === id);
  if(!action) throw new Error('Acción CAPA no encontrada');
  assertCan(getActiveRole(), 'delete_records', { status: action.status, closureStatus: action.closure_status });
  const next = list.filter(a => a.id !== action.id);
  saveCollection('corrective_actions', next);
  deleteEvidenceFor('corrective_action', action.corrective_action_id);
  recordAudit({
    entityType: 'corrective_action',
    entityId: action.corrective_action_id,
    record: action,
    action: 'delete',
    changedField: 'status',
    beforeValue: action.status,
    afterValue: null,
    actor: action.responsible_employee_id
  });
  return true;
}

export function isCapaOverdue(action, today){
  if(!action || !action.due_date) return false;
  if(action.closure_status === 'approved') return false;
  const ref = today || new Date().toISOString().slice(0, 10);
  return action.due_date < ref && action.closure_status !== 'approved';
}

export function requestCapaClosure(id, actor){
  assertCan(getActiveRole(), 'request_capa_closure', {});
  const list = loadCollection('corrective_actions');
  const idx = list.findIndex(action => action.id === id || action.corrective_action_id === id);
  if(idx === -1) throw new Error('Acción CAPA no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'request_capa_closure', { status: previous.status, closureStatus: previous.closure_status });
  if(previous.status !== 'completed') fail('INVALID_STATE', 'Solo se puede solicitar el cierre de una CAPA completada.');
  const status = transition('capaClosure', 'request', previous.status, { requiresJustification: false });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    closure_status: 'pending',
    closure_requested_at: now,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('corrective_actions', list);
  recordAudit({
    entityType: 'corrective_action',
    entityId: previous.corrective_action_id,
    record: next,
    action: 'status_change',
    changedField: 'closure_status',
    beforeValue: previous.closure_status,
    afterValue: { closure_status: next.closure_status, closure_requested_at: next.closure_requested_at },
    actor: actor || previous.responsible_employee_id
  });
  return next;
}

export function registerCapaEffectiveness(id, result, observations, actor){
  assertCan(getActiveRole(), 'register_effectiveness', {});
  const list = loadCollection('corrective_actions');
  const idx = list.findIndex(action => action.id === id || action.corrective_action_id === id);
  if(idx === -1) throw new Error('Acción CAPA no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'register_effectiveness', { status: previous.status, closureStatus: previous.closure_status });
  if(!CAPA_CLOSURE_STATUSES.includes(previous.closure_status) || previous.closure_status !== 'pending'){
    fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  }
  if(!['effective', 'not_effective'].includes(result)) fail('INVALID_STATE', 'La eficacia debe ser effective o not_effective');
  const note = requireJustification(observations);
  const now = new Date().toISOString();
  const next = {
    ...previous,
    effectiveness_result: result,
    effectiveness_observations: note,
    effectiveness_reviewed_by: workflowActor(actor),
    effectiveness_reviewed_at: now,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('corrective_actions', list);
  recordAudit({
    entityType: 'corrective_action',
    entityId: previous.corrective_action_id,
    record: next,
    action: 'review',
    changedField: 'effectiveness_result',
    beforeValue: previous.effectiveness_result,
    afterValue: {
      effectiveness_result: next.effectiveness_result,
      effectiveness_observations: next.effectiveness_observations,
      effectiveness_reviewed_by: next.effectiveness_reviewed_by,
      effectiveness_reviewed_at: next.effectiveness_reviewed_at
    },
    actor: next.effectiveness_reviewed_by
  });
  return next;
}

export function reviewCapaClosure(id, decision, effectiveness, observations, actor, justification){
  assertCan(getActiveRole(), 'review_capa_closure', {});
  const list = loadCollection('corrective_actions');
  const idx = list.findIndex(action => action.id === id || action.corrective_action_id === id);
  if(idx === -1) throw new Error('Acción CAPA no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'review_capa_closure', { status: previous.status, closureStatus: previous.closure_status });
  if(previous.closure_status !== 'pending') fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  if(!['approved', 'rejected'].includes(decision)) fail('INVALID_STATE', 'La decisión de cierre no es válida.');
  let current = previous;
  if(!isBlank(effectiveness)){
    assertCan(getActiveRole(), 'register_effectiveness', { status: previous.status, closureStatus: previous.closure_status });
    if(!['effective', 'not_effective'].includes(effectiveness)) fail('INVALID_STATE', 'La eficacia debe ser effective o not_effective');
    if(isBlank(observations)) fail('MISSING_JUSTIFICATION', 'Registra la justificación para continuar.');
    const now = new Date().toISOString();
    current = {
      ...current,
      effectiveness_result: effectiveness,
      effectiveness_observations: String(observations).trim(),
      effectiveness_reviewed_by: workflowActor(actor),
      effectiveness_reviewed_at: now,
      updatedAt: now
    };
    list[idx] = current;
    saveCollection('corrective_actions', list);
    recordAudit({
      entityType: 'corrective_action',
      entityId: previous.corrective_action_id,
      record: current,
      action: 'review',
      changedField: 'effectiveness_result',
      beforeValue: previous.effectiveness_result,
      afterValue: {
        effectiveness_result: current.effectiveness_result,
        effectiveness_observations: current.effectiveness_observations,
        effectiveness_reviewed_by: current.effectiveness_reviewed_by,
        effectiveness_reviewed_at: current.effectiveness_reviewed_at
      },
      actor: current.effectiveness_reviewed_by
    });
  }
  let justificationText = justification;
  if(decision === 'rejected') justificationText = requireJustification(justificationText);
  const hasEffectiveness = Boolean(current.effectiveness_result && !isBlank(current.effectiveness_observations));
  const transitionAction = decision === 'approved' ? 'approve' : 'reject';
  const status = transition('capaClosure', transitionAction, current.closure_status, {
    requiresJustification: decision === 'rejected',
    justification: justificationText,
    hasEffectiveness
  });
  if(!status){
    if(!hasEffectiveness) fail('MISSING_EVIDENCE_EFFECTIVENESS', 'Registra la eficacia antes de aprobar el cierre.');
    fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  }
  const now = new Date().toISOString();
  const next = {
    ...current,
    closure_status: status,
    status: decision === 'rejected' ? 'in_progress' : current.status,
    closure_reviewed_by: workflowActor(actor),
    closure_reviewed_at: now,
    closure_justification: isBlank(justificationText) ? null : String(justificationText).trim(),
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('corrective_actions', list);
  recordAudit({
    entityType: 'corrective_action',
    entityId: previous.corrective_action_id,
    record: next,
    action: decision === 'approved' ? 'approve' : 'reject',
    changedField: 'closure_status',
    beforeValue: current.closure_status,
    afterValue: {
      closure_status: next.closure_status,
      status: next.status,
      closure_reviewed_by: next.closure_reviewed_by,
      closure_reviewed_at: next.closure_reviewed_at,
      closure_justification: next.closure_justification,
      effectiveness_result: next.effectiveness_result
    },
    actor: next.closure_reviewed_by,
    justification: justificationText
  });
  return next;
}

export function canOverrideInspection(inspectionId, targetResult){
  const errors = {};
  if(!['passed', 'failed', 'conditional'].includes(targetResult)){
    errors.overall_result = 'El dictamen debe ser passed, failed o conditional';
  }
  const inspection = loadCollection('quality_inspections').find(i => i.id === inspectionId || i.inspection_id === inspectionId);
  if(!inspection){
    errors.inspection_id = 'La inspección no existe';
    return { valid: false, errors };
  }
  if(inspection.inspection_status !== 'completed'){
    errors.inspection_id = 'Solo se puede modificar una inspección completada';
    return { valid: false, errors };
  }
  const criteria = criteriaForInspection(inspection);
  const results = inspectionResults(inspection.inspection_id);
  const byCriteria = new Map(results.map(result => [result.criteria_id, result]));
  const missing = criteria.some(criterion => {
    const result = byCriteria.get(criterion.criteria_id);
    return !result || !Number.isFinite(Number(result.measured_value));
  });
  const criticalFailed = criteria.some(criterion => {
    const result = byCriteria.get(criterion.criteria_id);
    return criterion.is_critical && result && result.pass_fail === false;
  });
  if(targetResult === 'passed' && (missing || criticalFailed)){
    errors.overall_result = 'No se puede aprobar: hay criterios críticos fallidos o mediciones faltantes';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function overrideInspection(inspectionId, targetResult, justification, overriddenBy){
  assertCan(getActiveRole(), 'override_inspection', { status: 'completed' });
  const reason = isBlank(justification) ? '' : String(justification).trim();
  if(!reason) fail('MISSING_JUSTIFICATION', 'La justificación es obligatoria');
  if(isBlank(overriddenBy)) throw new Error('El usuario que autoriza es obligatorio');
  const check = canOverrideInspection(inspectionId, targetResult);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(item => item.id === inspectionId || item.inspection_id === inspectionId);
  const previous = list[idx];
  const now = new Date().toISOString();
  const next = {
    ...previous,
    overall_result: targetResult,
    override_justification: reason,
    overridden_by: String(overriddenBy).trim(),
    override_at: now,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_inspections', list);
  recordAudit({
    entityType: 'inspection',
    entityId: previous.inspection_id,
    record: next,
    action: 'status_change',
    changedField: 'overall_result',
    beforeValue: previous.overall_result,
    afterValue: {
      overall_result: targetResult,
      overridden_by: next.overridden_by,
      override_at: next.override_at,
      override_justification: next.override_justification
    },
    actor: next.overridden_by,
    justification: reason
  });
  return next;
}

export function loadChecklists(){
  return loadCollection('quality_checklists');
}

export function validateChecklist(payload){
  const errors = {};
  if(isBlank(payload && payload.name)) errors.name = 'El nombre es obligatorio';
  if(isBlank(payload && payload.category)) errors.category = 'La categoría es obligatoria';
  if(!Array.isArray(payload && payload.criteria) || payload.criteria.length === 0){
    errors.criteria = 'Agrega al menos un criterio';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function normalizeChecklistCriteria(criteria){
  const now = new Date().toISOString();
  return criteria.map(criterion => ({
    id: criterion.id || generateId(),
    criteria_id: criterion.criteria_id || criterion.id || generateId(),
    name: String(criterion.name).trim(),
    description: String(criterion.description || '').trim(),
    is_critical: Boolean(criterion.is_critical),
    createdAt: criterion.createdAt || now
  }));
}

function normalizeChecklistStatus(status){
  if(status === 'active' || status === 'approved') return 'approved';
  if(status === 'under_review') return 'pending_review';
  return CHECKLIST_STATUSES.includes(status) ? status : 'draft';
}

function checklistHasHistory(checklist){
  if(!checklist) return false;
  if(checklist.is_locked || (checklist.evaluations && checklist.evaluations.length)) return true;
  return loadCollection('quality_inspections').some(item => item.checklist_id === checklist.checklist_id);
}

export function addChecklist(payload){
  assertCan(getActiveRole(), 'manage_checklist', { status: 'draft', isDraft: true });
  const check = validateChecklist(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const id = generateId();
  const checklist = {
    id,
    checklist_id: generateId(),
    ...versionMetadata(id),
    name: String(payload.name).trim(),
    description: String(payload.description || '').trim(),
    category: String(payload.category).trim(),
    status: normalizeChecklistStatus(payload.status),
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_justification: null,
    is_locked: false,
    created_by: isBlank(payload.created_by) ? null : String(payload.created_by).trim(),
    createdAt: now,
    updatedAt: now,
    criteria: normalizeChecklistCriteria(payload.criteria),
    evaluations: []
  };
  const list = loadCollection('quality_checklists');
  list.push(checklist);
  saveCollection('quality_checklists', list);
  recordAudit({
    entityType: 'checklist',
    entityId: checklist.checklist_id,
    record: checklist,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: { status: checklist.status, version: checklist.version },
    actor: checklist.created_by
  });
  return checklist;
}

export function updateChecklist(id, updates, actor){
  const list = loadCollection('quality_checklists');
  const idx = list.findIndex(item => item.id === id || item.checklist_id === id);
  if(idx === -1) throw new Error('Lista de verificación no encontrada');
  const previous = list[idx];
  const hasHistory = checklistHasHistory(previous);
  assertCan(getActiveRole(), 'manage_checklist', { status: previous.status, hasHistory, isLocked: previous.is_locked });
  if(previous.status === 'approved' && hasHistory){
    fail('INVALID_STATE', 'La lista tiene historial y no puede editarse; crea una nueva versión');
  }
  if(previous.status === 'pending_approval'){
    fail('INVALID_STATE', 'La lista está pendiente de aprobación y no puede editarse');
  }
  const merged = { ...previous, ...updates };
  const check = validateChecklist(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const next = {
    ...previous,
    name: String(merged.name).trim(),
    description: String(merged.description || '').trim(),
    category: String(merged.category).trim(),
    status: previous.status === 'rejected' ? 'draft' : normalizeChecklistStatus(merged.status),
    criteria: normalizeChecklistCriteria(merged.criteria),
    updatedAt: new Date().toISOString()
  };
  list[idx] = next;
  saveCollection('quality_checklists', list);
  const statusChanged = next.status !== previous.status;
  recordAudit({
    entityType: 'checklist',
    entityId: previous.checklist_id,
    record: next,
    action: statusChanged ? 'status_change' : 'update',
    changedField: statusChanged ? 'status' : 'name',
    beforeValue: statusChanged ? previous.status : previous.name,
    afterValue: statusChanged ? next.status : next.name,
    actor: actor || undefined,
    justification: statusChanged ? previous.review_justification : undefined
  });
  return next;
}

export function submitChecklistForApproval(id, actor){
  const list = loadCollection('quality_checklists');
  const idx = list.findIndex(item => item.id === id || item.checklist_id === id);
  if(idx === -1) throw new Error('Lista de verificación no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'submit_checklist', { status: previous.status, criteriaCount: (previous.criteria || []).length });
  const status = transition('checklist', 'submit', previous.status, { requiresJustification: false });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  if(!(previous.criteria || []).length) fail('INVALID_STATE', 'La lista necesita al menos un criterio');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    submitted_by: workflowActor(actor),
    submitted_at: now,
    reviewed_by: null,
    reviewed_at: null,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_checklists', list);
  recordAudit({
    entityType: 'checklist',
    entityId: previous.checklist_id,
    record: next,
    action: 'status_change',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: next.status,
    actor: next.submitted_by
  });
  return next;
}

export function approveChecklist(id, reviewer, justification){
  const list = loadCollection('quality_checklists');
  const idx = list.findIndex(item => item.id === id || item.checklist_id === id);
  if(idx === -1) throw new Error('Lista de verificación no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'approve_checklist', { status: previous.status, criteriaCount: (previous.criteria || []).length });
  const status = transition('checklist', 'approve', previous.status, { requiresJustification: false });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  if(!(previous.criteria || []).length) fail('INVALID_STATE', 'No se puede aprobar una lista sin criterios');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    reviewed_by: workflowActor(reviewer),
    reviewed_at: now,
    review_justification: isBlank(justification) ? previous.review_justification : String(justification).trim(),
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_checklists', list);
  recordAudit({
    entityType: 'checklist',
    entityId: previous.checklist_id,
    record: next,
    action: 'approve',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: {
      status: next.status,
      reviewed_by: next.reviewed_by,
      reviewed_at: next.reviewed_at,
      review_justification: next.review_justification
    },
    actor: next.reviewed_by,
    justification
  });
  return next;
}

export function rejectChecklist(id, reviewer, justification){
  const list = loadCollection('quality_checklists');
  const idx = list.findIndex(item => item.id === id || item.checklist_id === id);
  if(idx === -1) throw new Error('Lista de verificación no encontrada');
  const previous = list[idx];
  assertCan(getActiveRole(), 'reject_checklist', { status: previous.status });
  const reason = requireJustification(justification);
  const status = transition('checklist', 'reject', previous.status, { requiresJustification: true, justification: reason });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    reviewed_by: workflowActor(reviewer),
    reviewed_at: now,
    review_justification: reason,
    updatedAt: now
  };
  list[idx] = next;
  saveCollection('quality_checklists', list);
  recordAudit({
    entityType: 'checklist',
    entityId: previous.checklist_id,
    record: next,
    action: 'reject',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: {
      status: next.status,
      reviewed_by: next.reviewed_by,
      reviewed_at: next.reviewed_at,
      review_justification: next.review_justification
    },
    actor: next.reviewed_by,
    justification: reason
  });
  return next;
}

export function duplicateChecklistVersion(id, actor){
  const source = findChecklistRecord(id);
  if(!source) throw new Error('Lista de verificación no encontrada');
  assertCan(getActiveRole(), 'version_checklist', { status: source.status, hasHistory: checklistHasHistory(source) });
  if(normalizeChecklistStatus(source.status) !== 'approved') fail('INVALID_STATE', 'Solo se puede versionar una lista aprobada.');
  const now = new Date().toISOString();
  const newId = generateId();
  const copy = {
    ...source,
    id: newId,
    checklist_id: generateId(),
    ...versionMetadata(newId, source),
    status: 'draft',
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_justification: null,
    is_locked: false,
    created_by: workflowActor(actor),
    createdAt: now,
    updatedAt: now,
    criteria: normalizeChecklistCriteria(source.criteria || []),
    evaluations: []
  };
  const list = loadCollection('quality_checklists');
  list.push(copy);
  saveCollection('quality_checklists', list);
  recordAudit({
    entityType: 'checklist',
    entityId: copy.checklist_id,
    record: copy,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: { status: copy.status, version: copy.version, version_group_id: copy.version_group_id },
    actor: copy.created_by
  });
  return copy;
}

export function deleteChecklist(id, actor){
  const list = loadCollection('quality_checklists');
  const checklist = list.find(item => item.id === id || item.checklist_id === id);
  if(!checklist) throw new Error('Lista de verificación no encontrada');
  const hasHistory = checklistHasHistory(checklist);
  assertCan(getActiveRole(), 'delete_checklist', { status: checklist.status, hasHistory });
  if(hasHistory || checklist.status === 'approved'){
    fail('INVALID_STATE', 'La lista tiene historial o está aprobada y no puede eliminarse');
  }
  saveCollection('quality_checklists', list.filter(item => item.id !== checklist.id));
  recordAudit({
    entityType: 'checklist',
    entityId: checklist.checklist_id,
    record: checklist,
    action: 'delete',
    changedField: 'status',
    beforeValue: checklist.status,
    afterValue: null,
    actor: actor || undefined
  });
  return true;
}

export function addChecklistEvaluation(id, evaluation){
  const list = loadCollection('quality_checklists');
  const idx = list.findIndex(item => item.id === id || item.checklist_id === id);
  if(idx === -1) throw new Error('Lista de verificación no encontrada');
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const record = {
    evaluation_id: generateId(),
    date: String(evaluation.date || fallbackDate).slice(0, 10),
    results: Array.isArray(evaluation.results) ? evaluation.results : [],
    summary: evaluation.summary || {},
    createdAt: new Date().toISOString()
  };
  list[idx].evaluations = [...(list[idx].evaluations || []), record];
  list[idx].updatedAt = new Date().toISOString();
  saveCollection('quality_checklists', list);
  return record;
}

export function loadQualityDocuments(){
  return loadCollection('quality_documents');
}

function qualityDocumentFileErrors(doc, errors, required){
  const hasFile = Boolean(doc && doc.file_name);
  if(required && !hasFile){
    errors.file_name = 'El archivo es obligatorio';
    return;
  }
  if(!hasFile) return;
  if(!QUALITY_DOCUMENT_MIME_TYPES.includes(doc.mime_type)){
    errors.mime_type = 'El archivo debe ser PNG, JPG o PDF';
  }
  const size = Number(doc.size_bytes);
  if(!Number.isFinite(size) || size <= 0){
    errors.size_bytes = 'El tamaño del archivo debe ser mayor que cero';
  }else if(size > QUALITY_DOCUMENT_MAX_FILE_BYTES){
    errors.size_bytes = 'El archivo supera el límite de 10 MB';
  }
  const dataUrl = doc.data_url;
  if(typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')){
    errors.data_url = 'El contenido del archivo no es válido';
  }else if(doc.mime_type && !dataUrl.startsWith(`data:${doc.mime_type};base64,`)){
    errors.data_url = 'El contenido no coincide con el tipo de archivo';
  }
}

export function validateQualityDocument(doc, options = {}){
  const errors = {};
  if(isBlank(doc && doc.name)) errors.name = 'El nombre del documento es obligatorio';
  if(!QUALITY_DOCUMENT_CATEGORIES.includes(doc && doc.category)) errors.category = 'La categoría no es válida';
  if(!QUALITY_DOCUMENT_STATUSES.includes(doc && doc.status)) errors.status = 'El estado no es válido';
  if(isBlank(doc && doc.responsible_employee_id)){
    errors.responsible_employee_id = 'El responsable es obligatorio';
  }else if(!loadExternal('employees').some(e => e.employee_id === doc.responsible_employee_id)){
    errors.responsible_employee_id = 'El responsable seleccionado no existe';
  }
  qualityDocumentFileErrors(doc, errors, options.requireFile !== false);
  return { valid: Object.keys(errors).length === 0, errors };
}

function nextQualityDocumentId(list){
  const max = list.reduce((acc, doc) => {
    const numeric = Number(String(doc.document_id || '').replace(/\D/g, ''));
    return Number.isFinite(numeric) ? Math.max(acc, numeric) : acc;
  }, 0);
  return `DOC-${String(max + 1).padStart(3, '0')}`;
}

function findQualityDocumentRecord(id){
  return loadQualityDocuments().find(doc => doc.id === id || doc.document_id === id);
}

function normalizeQualityDocumentStatus(status){
  if(status === 'active' || status === 'approved') return 'approved';
  if(status === 'under_review') return 'pending_review';
  return DOCUMENT_STATUSES.includes(status) ? status : 'draft';
}

function documentHasPreview(doc){
  return Boolean(doc && doc.file_name && QUALITY_DOCUMENT_MIME_TYPES.includes(doc.mime_type)
    && typeof doc.data_url === 'string' && doc.data_url.includes(';base64,'));
}

export function addQualityDocument(payload){
  assertCan(getActiveRole(), 'create_document', { status: 'draft', documentStatus: 'draft' });
  const normalized = { ...payload, status: normalizeQualityDocumentStatus(payload && payload.status) };
  const check = validateQualityDocument(normalized);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const list = loadQualityDocuments();
  const now = new Date().toISOString();
  const id = generateId();
  const documentId = nextQualityDocumentId(list);
  const doc = {
    id,
    document_id: documentId,
    version_group_id: `doc-${documentId}`,
    version: 1,
    version_of: null,
    name: String(normalized.name).trim(),
    category: normalized.category,
    description: String(normalized.description || '').trim(),
    file_name: String(normalized.file_name).trim(),
    mime_type: normalized.mime_type,
    size_bytes: Number(normalized.size_bytes),
    data_url: normalized.data_url,
    responsible_employee_id: normalized.responsible_employee_id,
    status: normalized.status,
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_justification: null,
    created_by: isBlank(normalized.created_by) ? null : String(normalized.created_by).trim(),
    uploaded_at: now,
    updated_at: now
  };
  list.push(doc);
  saveCollection('quality_documents', list);
  recordAudit({
    entityType: 'document',
    entityId: doc.document_id,
    record: doc,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: { status: doc.status, version: doc.version },
    actor: doc.created_by || doc.responsible_employee_id
  });
  return doc;
}

export function updateQualityDocument(id, updates, actor){
  const list = loadQualityDocuments();
  const idx = list.findIndex(doc => doc.id === id || doc.document_id === id);
  if(idx === -1) throw new Error('Documento no encontrado');
  const previous = list[idx];
  if(['approved', 'archived'].includes(previous.status)){
    fail('INVALID_STATE', 'El documento aprobado no se edita; crea una nueva versión');
  }
  assertCan(getActiveRole(), 'edit_document', { documentStatus: previous.status, status: previous.status });
  const merged = { ...previous, ...updates, status: normalizeQualityDocumentStatus(updates.status !== undefined ? updates.status : previous.status) };
  const check = validateQualityDocument(merged, { requireFile: false });
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const next = {
    ...previous,
    name: String(merged.name).trim(),
    category: merged.category,
    description: String(merged.description || '').trim(),
    file_name: merged.file_name || previous.file_name,
    mime_type: merged.mime_type || previous.mime_type,
    size_bytes: Number(merged.size_bytes || previous.size_bytes),
    data_url: merged.data_url || previous.data_url,
    responsible_employee_id: merged.responsible_employee_id,
    status: previous.status === 'rejected' ? 'draft' : merged.status,
    review_justification: previous.status === 'rejected' ? previous.review_justification : (merged.review_justification || previous.review_justification || null),
    updated_at: now,
    version: Number(previous.version) || 1
  };
  list[idx] = next;
  saveCollection('quality_documents', list);
  const statusChanged = next.status !== previous.status;
  recordAudit({
    entityType: 'document',
    entityId: previous.document_id,
    record: next,
    action: statusChanged ? 'status_change' : 'update',
    changedField: statusChanged ? 'status' : 'name',
    beforeValue: statusChanged ? previous.status : previous.name,
    afterValue: statusChanged ? next.status : next.name,
    actor: actor || undefined,
    justification: statusChanged ? previous.review_justification : undefined
  });
  return next;
}

export function submitDocumentForReview(id, actor){
  const list = loadQualityDocuments();
  const idx = list.findIndex(doc => doc.id === id || doc.document_id === id);
  if(idx === -1) throw new Error('Documento no encontrado');
  const previous = list[idx];
  assertCan(getActiveRole(), 'submit_document', { documentStatus: previous.status, status: previous.status });
  const status = transition('document', 'submit', previous.status, { requiresJustification: false });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  if(!documentHasPreview(previous)) fail('INVALID_STATE', 'El documento necesita un archivo previsualizable');
  const check = validateQualityDocument(previous);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    submitted_by: workflowActor(actor),
    submitted_at: now,
    reviewed_by: null,
    reviewed_at: null,
    updated_at: now
  };
  list[idx] = next;
  saveCollection('quality_documents', list);
  recordAudit({
    entityType: 'document',
    entityId: previous.document_id,
    record: next,
    action: 'status_change',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: next.status,
    actor: next.submitted_by
  });
  return next;
}

export function approveDocument(id, reviewer, justification){
  const list = loadQualityDocuments();
  const idx = list.findIndex(doc => doc.id === id || doc.document_id === id);
  if(idx === -1) throw new Error('Documento no encontrado');
  const previous = list[idx];
  assertCan(getActiveRole(), 'approve_document', { documentStatus: previous.status, status: previous.status });
  const status = transition('document', 'approve', previous.status, { requiresJustification: false });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  if(!documentHasPreview(previous)) fail('INVALID_STATE', 'El documento necesita un archivo previsualizable');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    reviewed_by: workflowActor(reviewer),
    reviewed_at: now,
    review_justification: isBlank(justification) ? previous.review_justification : String(justification).trim(),
    updated_at: now
  };
  list[idx] = next;
  saveCollection('quality_documents', list);
  recordAudit({
    entityType: 'document',
    entityId: previous.document_id,
    record: next,
    action: 'approve',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: {
      status: next.status,
      reviewed_by: next.reviewed_by,
      reviewed_at: next.reviewed_at,
      review_justification: next.review_justification
    },
    actor: next.reviewed_by,
    justification
  });
  return next;
}

export function rejectDocument(id, reviewer, justification){
  const list = loadQualityDocuments();
  const idx = list.findIndex(doc => doc.id === id || doc.document_id === id);
  if(idx === -1) throw new Error('Documento no encontrado');
  const previous = list[idx];
  assertCan(getActiveRole(), 'reject_document', { documentStatus: previous.status, status: previous.status });
  const reason = requireJustification(justification);
  const status = transition('document', 'reject', previous.status, { requiresJustification: true, justification: reason });
  if(!status) fail('INVALID_STATE', 'La acción no está disponible en el estado actual.');
  const now = new Date().toISOString();
  const next = {
    ...previous,
    status,
    reviewed_by: workflowActor(reviewer),
    reviewed_at: now,
    review_justification: reason,
    updated_at: now
  };
  list[idx] = next;
  saveCollection('quality_documents', list);
  recordAudit({
    entityType: 'document',
    entityId: previous.document_id,
    record: next,
    action: 'reject',
    changedField: 'status',
    beforeValue: previous.status,
    afterValue: {
      status: next.status,
      reviewed_by: next.reviewed_by,
      reviewed_at: next.reviewed_at,
      review_justification: next.review_justification
    },
    actor: next.reviewed_by,
    justification: reason
  });
  return next;
}

export function duplicateDocumentVersion(id, actor){
  const source = findQualityDocumentRecord(id);
  if(!source) throw new Error('Documento no encontrado');
  assertCan(getActiveRole(), 'version_document', { documentStatus: source.status, status: source.status });
  if(source.status !== 'approved') fail('INVALID_STATE', 'Solo se puede versionar un documento aprobado.');
  const now = new Date().toISOString();
  const copy = {
    ...source,
    id: generateId(),
    version: (Number(source.version) || 1) + 1,
    version_group_id: source.version_group_id || `doc-${source.document_id}`,
    version_of: source.id,
    status: 'draft',
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_justification: null,
    created_by: workflowActor(actor),
    uploaded_at: now,
    updated_at: now
  };
  const list = loadQualityDocuments();
  list.push(copy);
  saveCollection('quality_documents', list);
  recordAudit({
    entityType: 'document',
    entityId: copy.document_id,
    record: copy,
    action: 'create',
    changedField: 'status',
    beforeValue: null,
    afterValue: { status: copy.status, version: copy.version, version_of: copy.version_of },
    actor: copy.created_by
  });
  return copy;
}

export function deleteQualityDocument(id, actor){
  const list = loadQualityDocuments();
  const doc = list.find(item => item.id === id || item.document_id === id);
  if(!doc) throw new Error('Documento no encontrado');
  assertCan(getActiveRole(), 'delete_document', { documentStatus: doc.status, status: doc.status });
  if(doc.status === 'approved') fail('INVALID_STATE', 'El documento aprobado no se elimina; crea una nueva versión');
  saveCollection('quality_documents', list.filter(item => item.id !== doc.id));
  deleteEvidenceFor('document', doc.document_id);
  recordAudit({
    entityType: 'document',
    entityId: doc.document_id,
    record: doc,
    action: 'delete',
    changedField: 'status',
    beforeValue: doc.status,
    afterValue: null,
    actor: actor || undefined
  });
  return true;
}

export function clearQualityData(){
  Object.keys(QUALITY_COLLECTION_KEYS).forEach(name => saveCollection(name, []));
  localStorage.removeItem(QUALITY_SETTINGS_KEY);
}
