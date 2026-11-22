import { getConfig } from './module-config.js';
import { SEED_KEYS, seedDataSnapshot } from './seed-data.js';

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
export const ACTION_TYPES = Object.freeze(['resampling', 'rework', 'other']);
export const REFERENCE_MODULES = Object.freeze(['goods_receipt', 'production_order', 'shipment']);
export const EVIDENCE_ENTITY_TYPES = Object.freeze(['inspection', 'non_conformance']);
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
export const AUDIT_ENTITIES = Object.freeze(['inspection', 'non_conformance', 'corrective_action']);
export const AUDIT_ACTIONS = Object.freeze(['create', 'update', 'status_change', 'delete']);
const AUDIT_ROLE_KEY = 'erp_quality:viewer_role';
const ALERT_RATE_METRICS = Object.freeze(['approval_rate', 'capa_effectiveness']);

const QUALITY_COLLECTION_KEYS = Object.freeze({
  quality_inspection_plans: 'erp_quality:quality_inspection_plans',
  quality_inspection_criteria: 'erp_quality:quality_inspection_criteria',
  quality_inspections: 'erp_quality:quality_inspections',
  quality_inspection_results: 'erp_quality:quality_inspection_results',
  non_conformances: 'erp_quality:non_conformances',
  corrective_actions: 'erp_quality:corrective_actions',
  quality_evidence: 'erp_quality:quality_evidence',
  quality_alert_rules: 'erp_quality:quality_alert_rules',
  quality_audit_log: 'erp_quality:quality_audit_log'
});

const EXTERNAL_COLLECTION_KEYS = Object.freeze({
  products: SEED_KEYS.products,
  employees: SEED_KEYS.employees,
  goods_receipt: SEED_KEYS.goods_receipt,
  production_order: SEED_KEYS.production_order,
  shipment: SEED_KEYS.shipment
});

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

export function ensureSeedData(){
  const snapshot = seedDataSnapshot();
  for(const [name, records] of Object.entries(snapshot)){
    const key = EXTERNAL_COLLECTION_KEYS[name];
    if(key && localStorage.getItem(key) === null){
      writeList(key, records);
    }
  }
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
    && JSON.stringify(existing.after_value) === JSON.stringify(entry.after_value));
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
  try{
    const role = localStorage.getItem(AUDIT_ROLE_KEY);
    if(!isBlank(role)) return String(role).trim();
  }catch(e){
    console.error('No se pudo leer el rol de auditoría', e);
  }
  return 'sistema';
}

function auditLotReference(entityType, record){
  if(!record) return { reference_module: 'desconocido', reference_id: 'desconocido' };
  if(record.reference_module && record.reference_id){
    return { reference_module: record.reference_module, reference_id: record.reference_id };
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
  'completed_at', 'override_justification', 'overridden_by', 'override_at'
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
    return loadCollection('quality_inspections').some(i => i.inspection_id === entityId);
  }
  if(entityType === 'non_conformance'){
    return loadCollection('non_conformances').some(nc => nc.non_conformance_id === entityId);
  }
  return false;
}

export function validateEvidence(payload, options = {}){
  const errors = {};
  const entityType = payload && payload.entity_type;
  const entityId = payload && payload.entity_id;
  if(!EVIDENCE_ENTITY_TYPES.includes(entityType)){
    errors.entity_type = 'El tipo de vínculo debe ser inspection o non_conformance';
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

export function deleteEvidence(id){
  const list = loadCollection('quality_evidence');
  const record = list.find(item => item.id === id || item.evidence_id === id);
  if(!record) throw new Error('Evidencia no encontrada');
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
  if(!APPLICABLE_STAGES.includes(plan && plan.applicable_stage)){
    errors.applicable_stage = 'La etapa debe ser incoming, in_process o final';
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

export function addPlan(payload){
  const check = validateInspectionPlan(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const plan = {
    id: generateId(),
    inspection_plan_id: generateId(),
    product_id: payload.product_id,
    plan_name: String(payload.plan_name).trim(),
    applicable_stage: payload.applicable_stage,
    is_locked: false,
    createdAt: now,
    updatedAt: now
  };
  const list = loadCollection('quality_inspection_plans');
  list.push(plan);
  saveCollection('quality_inspection_plans', list);
  return plan;
}

export function updatePlan(id, updates){
  const list = loadCollection('quality_inspection_plans');
  const idx = list.findIndex(p => p.id === id || p.inspection_plan_id === id);
  if(idx === -1) throw new Error('Plan no encontrado');
  if(list[idx].is_locked || planHasInspections(list[idx].inspection_plan_id)){
    throw new Error('El plan tiene inspecciones históricas y no puede editarse; duplícalo para crear una nueva versión');
  }
  const merged = { ...list[idx], ...updates };
  const check = validateInspectionPlan(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  list[idx] = {
    ...list[idx],
    product_id: merged.product_id,
    plan_name: String(merged.plan_name).trim(),
    applicable_stage: merged.applicable_stage,
    updatedAt: new Date().toISOString()
  };
  saveCollection('quality_inspection_plans', list);
  return list[idx];
}

export function deletePlan(id){
  const plans = loadCollection('quality_inspection_plans');
  const plan = plans.find(p => p.id === id || p.inspection_plan_id === id);
  if(!plan) throw new Error('Plan no encontrado');
  if(plan.is_locked || planHasInspections(plan.inspection_plan_id)){
    throw new Error('El plan tiene inspecciones históricas y no puede eliminarse');
  }
  saveCollection('quality_inspection_plans', plans.filter(p => p.id !== plan.id));
  deleteRelated('quality_inspection_criteria', 'inspection_plan_id', plan.inspection_plan_id);
  return true;
}

export function duplicatePlan(id){
  const plans = loadCollection('quality_inspection_plans');
  const source = plans.find(p => p.id === id || p.inspection_plan_id === id);
  if(!source) throw new Error('Plan no encontrado');
  const copy = addPlan({
    product_id: source.product_id,
    plan_name: `${source.plan_name} (copia)`,
    applicable_stage: source.applicable_stage
  });
  planCriteria(source.inspection_plan_id).forEach(c => {
    addCriterion({
      inspection_plan_id: copy.inspection_plan_id,
      criteria_name: c.criteria_name,
      expected_value: c.expected_value,
      tolerance: c.tolerance,
      unit: c.unit,
      comparison_type: c.comparison_type,
      is_critical: c.is_critical
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

export function validateInspection(payload){
  const errors = {};
  const plans = loadCollection('quality_inspection_plans');
  const plan = plans.find(p => p.inspection_plan_id === payload.inspection_plan_id);
  if(!plan){
    errors.inspection_plan_id = 'Selecciona un plan de inspección válido';
  } else if(!planHasCriteria(plan.inspection_plan_id)){
    errors.inspection_plan_id = 'El plan necesita al menos un criterio para habilitarse';
  }
  if(isBlank(payload.inspector_id)){
    errors.inspector_id = 'El inspector es obligatorio';
  } else if(!loadExternal('employees').some(e => e.employee_id === payload.inspector_id)){
    errors.inspector_id = 'El inspector seleccionado no existe';
  }
  Object.assign(errors, validateReference(payload.reference_module, payload.reference_id).errors);
  if(isBlank(payload.inspection_date)) errors.inspection_date = 'La fecha de inspección es obligatoria';
  else if(!isValidDate(payload.inspection_date)) errors.inspection_date = 'La fecha de inspección no es válida (YYYY-MM-DD)';
  return { valid: Object.keys(errors).length === 0, errors, plan };
}

export function addInspection(payload){
  const check = validateInspection(payload);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const status = payload.inspection_status === 'completed' ? 'completed' : 'draft';
  const inspection = {
    id: generateId(),
    inspection_id: generateId(),
    inspection_plan_id: payload.inspection_plan_id,
    inspector_id: payload.inspector_id,
    reference_module: payload.reference_module,
    reference_id: payload.reference_id,
    inspection_date: payload.inspection_date,
    inspection_status: status,
    overall_result: status === 'completed' ? (payload.overall_result || null) : null,
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
    afterValue: inspection.inspection_status,
    actor: inspection.inspector_id
  });
  return inspection;
}

export function updateInspection(id, updates, options = {}){
  const list = loadCollection('quality_inspections');
  const idx = list.findIndex(i => i.id === id || i.inspection_id === id);
  if(idx === -1) throw new Error('Inspección no encontrada');
  const previous = list[idx];
  list[idx] = { ...previous, ...updates, id: previous.id, updatedAt: new Date().toISOString() };
  saveCollection('quality_inspections', list);
  if(options.audit !== false){
    const actor = options.actor || updates.overridden_by || updates.inspector_id || previous.inspector_id;
    if(options.auditMode === 'override'){
      recordAudit({
        entityType: 'inspection',
        entityId: previous.inspection_id,
        record: previous,
        action: 'status_change',
        changedField: 'overall_result',
        beforeValue: previous.overall_result,
        afterValue: list[idx].overall_result,
        actor,
        justification: options.justification
      });
    }else{
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
  }
  return list[idx];
}

export function deleteInspection(id){
  const list = loadCollection('quality_inspections');
  const inspection = list.find(i => i.id === id || i.inspection_id === id);
  if(!inspection) throw new Error('Inspección no encontrada');
  const hasNc = loadCollection('non_conformances').some(nc => nc.inspection_id === inspection.inspection_id);
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

export function completeInspection(id, overallResult, results){
  const saved = setInspectionResults(id, results);
  const inspection = updateInspection(id, {
    inspection_status: 'completed',
    overall_result: overallResult
  });
  if(overallResult === 'failed'){
    createNonConformanceFromInspection(inspection.inspection_id);
  }
  return { inspection, results: saved };
}

export function saveDraftInspection(id, results){
  const saved = setInspectionResults(id, results);
  const inspection = updateInspection(id, { inspection_status: 'draft', overall_result: null });
  return { inspection, results: saved };
}

export function validateNonConformance(nc){
  const errors = {};
  if(!nc || isBlank(nc.description)) errors.description = 'La descripción es obligatoria';
  if(!DEFECT_TYPES.includes(nc && nc.defect_type)) errors.defect_type = 'Tipo de defecto inválido';
  if(!SEVERITIES.includes(nc && nc.severity)) errors.severity = 'Severidad inválida';
  if(!NON_CONFORMANCE_STATUSES.includes(nc && nc.status)) errors.status = 'Estado de no conformidad inválido';
  if(isBlank(nc && nc.product_id)) errors.product_id = 'El producto es obligatorio';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function addNonConformance(payload){
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
  const merged = { ...previous, ...updates };
  const check = validateNonConformance(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  list[idx] = {
    ...previous,
    description: String(merged.description).trim(),
    defect_type: merged.defect_type,
    severity: merged.severity,
    status: merged.status,
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
    severity: 'major',
    status: 'open'
  });
}

export function validateCorrectiveAction(action){
  const errors = {};
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
    action_description: String(payload.action_description).trim(),
    root_cause: String(payload.root_cause).trim(),
    action_type: payload.action_type,
    due_date: payload.due_date,
    status: payload.status,
    completed_at: payload.status === 'completed' ? now : undefined,
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
  const merged = { ...previous, ...updates };
  const check = validateCorrectiveAction(merged);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  const now = new Date().toISOString();
  const completing = merged.status === 'completed' && previous.status !== 'completed';
  list[idx] = {
    ...previous,
    responsible_employee_id: merged.responsible_employee_id,
    action_description: String(merged.action_description).trim(),
    root_cause: String(merged.root_cause).trim(),
    action_type: merged.action_type,
    due_date: merged.due_date,
    status: merged.status,
    completed_at: completing ? now : previous.completed_at,
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
  const next = list.filter(a => a.id !== action.id);
  saveCollection('corrective_actions', next);
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
  const ref = today || new Date().toISOString().slice(0, 10);
  return action.due_date < ref && action.status !== 'completed';
}

export function canOverrideInspection(inspectionId, targetResult){
  const errors = {};
  if(!['passed', 'failed', 'conditional'].includes(targetResult)){
    errors.overall_result = 'El dictamen debe ser passed, failed o conditional';
  }
  const inspection = loadCollection('quality_inspections').find(i => i.inspection_id === inspectionId);
  if(!inspection){
    errors.inspection_id = 'La inspección no existe';
    return { valid: false, errors };
  }
  const plan = loadCollection('quality_inspection_plans').find(p => p.inspection_plan_id === inspection.inspection_plan_id);
  const criteria = plan ? planCriteria(plan.inspection_plan_id) : [];
  const results = loadCollection('quality_inspection_results').filter(r => r.inspection_id === inspectionId);
  if(targetResult === 'passed'){
    const critical = criteria.filter(c => c.is_critical);
    for(const c of critical){
      const result = results.find(r => r.criteria_id === c.criteria_id);
      if(!result) errors.overall_result = 'No se puede aprobar: hay criterios críticos sin medición';
      else if(result.pass_fail === false) errors.overall_result = 'No se puede aprobar: hay criterios críticos fallidos';
      if(errors.overall_result) break;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function overrideInspection(inspectionId, targetResult, justification, overriddenBy){
  if(isBlank(justification)) throw new Error('La justificación es obligatoria');
  if(isBlank(overriddenBy)) throw new Error('El usuario que autoriza es obligatorio');
  const check = canOverrideInspection(inspectionId, targetResult);
  if(!check.valid) throw new Error(Object.values(check.errors)[0]);
  return updateInspection(inspectionId, {
    overall_result: targetResult,
    override_justification: String(justification).trim(),
    overridden_by: String(overriddenBy).trim(),
    override_at: new Date().toISOString()
  }, {
    auditMode: 'override',
    justification,
    actor: overriddenBy
  });
}

export function clearQualityData(){
  Object.keys(QUALITY_COLLECTION_KEYS).forEach(name => saveCollection(name, []));
}
