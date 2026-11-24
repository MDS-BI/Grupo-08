import * as storage from '../storage.js';
import { loadExternal, loadQualityDocuments, validateQualityDocument } from '../storage.js';
import { can, assertCan, applyPermissionState } from '../permissions.js';
import { DOCUMENT_STATUSES } from '../quality-status.js';
import { buildReferenceMaps, employeeName, qs, cell, actionButton } from './quality-utils.js';
import {
  formatFileSize,
  downloadEvidence,
  readFileAsDataUrl,
  addEvidenceFromFile,
  renderEvidenceList
} from './evidence.js';
import { renderStatusBadge, renderStatusLegend, statusLabel } from './status-badge.js';
import { renderPermissionNotice } from './permission-notice.js';

const CATEGORY_META = Object.freeze({
  manual: { label: 'Manuales de calidad', short: 'Manual', className: 'docm-category-manual' },
  procedure: { label: 'Procedimientos', short: 'Procedimiento', className: 'docm-category-procedure' },
  regulation: { label: 'Normativas', short: 'Normativa', className: 'docm-category-regulation' },
  certificate: { label: 'Certificados', short: 'Certificado', className: 'docm-category-certificate' },
  specification: { label: 'Especificaciones técnicas', short: 'Especificación', className: 'docm-category-specification' },
  other: { label: 'Otros documentos', short: 'Otro', className: 'docm-category-other' }
});

const STATUS_META = Object.freeze({
  draft: { label: 'Borrador', className: 'docm-status-draft' },
  pending_review: { label: 'Pendiente', className: 'docm-status-review status-pending_review badge-pending_review' },
  approved: { label: 'Aprobado', className: 'docm-status-approved status-approved badge-approved' },
  rejected: { label: 'Rechazado', className: 'docm-status-rejected status-rejected badge-rejected' },
  archived: { label: 'Archivado', className: 'docm-status-archived' }
});

const MIME_LABELS = Object.freeze({
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'application/pdf': 'PDF'
});

const LEGACY_STATUS_LABELS = Object.freeze({
  under_review: 'Pendiente de revisión (legado)'
});

const VIEW_STATUSES = Object.freeze(DOCUMENT_STATUSES.filter(status => status !== 'archived'));

let currentPreviewId = '';

function activeRole(){
  const getter = storage.getActiveRole;
  if(typeof getter === 'function'){
    try{ return getter(); }catch{ return 'jefe_calidad'; }
  }
  return 'jefe_calidad';
}

function invoke(name, ...args){
  const fn = storage[name];
  if(typeof fn !== 'function') throw new Error(`La operación ${name} no está disponible en este momento.`);
  return fn(...args);
}

function normalizeStatus(status){
  if(status === 'under_review') return 'pending_review';
  return DOCUMENT_STATUSES.includes(status) ? status : 'draft';
}

function statusMeta(status){
  const key = normalizeStatus(status);
  return STATUS_META[key] || { label: statusLabel(key), className: `status-${key} badge-${key}` };
}

function statusBadge(status){
  return renderStatusBadge(normalizeStatus(status));
}

function documentHasHistory(doc){
  if(!doc) return false;
  if(doc.version_of || doc.submitted_at || doc.reviewed_at) return true;
  try{
    return storage.loadCollection('quality_inspections').some(item =>
      item.reference_id === doc.document_id || item.reference_id === doc.id || item.source_document_id === doc.id);
  }catch{ return false; }
}

function documentContext(doc){
  return {
    status: normalizeStatus(doc && doc.status),
    hasHistory: documentHasHistory(doc)
  };
}

function isEditableStatus(doc){
  return ['draft', 'rejected'].includes(normalizeStatus(doc && doc.status));
}

function hasBasePermission(role, action){
  return can(role, action);
}

function workflowButton(label, dataset, permission, disabled){
  const button = actionButton(label, 'secondary', dataset);
  if(disabled){
    button.disabled = true;
    button.dataset.stateDisabled = 'true';
  }else{
    button.dataset.permission = permission;
  }
  return button;
}

function applyStateDisables(root){
  if(!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-state-disabled]').forEach(button => { button.disabled = true; });
}

function applyDocumentPermissions(root){
  applyPermissionState(root || qs('view-quality-documents') || document, activeRole());
  applyStateDisables(root || qs('view-quality-documents') || document);
}

function clearLocalNotices(container){
  if(!container) return;
  [...container.children].forEach(child => {
    if(child.classList && child.classList.contains('permission-notice')) child.remove();
  });
}

function permissionNotice(container, action, context){
  if(!container || can(activeRole(), action, context)) return;
  clearLocalNotices(container);
  container.prepend(renderPermissionNotice(action));
}

function setWorkflowError(message){
  let el = qs('docm-workflow-error');
  if(!el){
    const card = cardOf('docm-list');
    el = document.createElement('div');
    el.id = 'docm-workflow-error';
    el.className = 'error';
    el.setAttribute('role', 'alert');
    const head = card ? card.querySelector('.card-head') : null;
    if(head && typeof head.after === 'function') head.after(el);
    else if(card) card.prepend(el);
    else document.body.appendChild(el);
  }
  el.textContent = message || '';
}

function cardOf(id){
  const el = qs(id);
  return el ? el.closest('.card') : null;
}

function setListVisible(visible){
  const summary = qs('docm-summary');
  if(summary) summary.hidden = !visible;
  ['docm-categories', 'docm-filters-heading', 'docm-list'].forEach(id => {
    const card = cardOf(id);
    if(card) card.hidden = !visible;
  });
}

function showErrors(errors = {}){
  const fields = {
    name: 'error-docm-name',
    category: 'error-docm-category',
    responsible_employee_id: 'error-docm-responsible'
  };
  Object.entries(fields).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
  const fileErrors = ['file_name', 'mime_type', 'size_bytes', 'data_url']
    .map(key => errors[key])
    .filter(Boolean);
  const fileError = qs('error-docm-file');
  if(fileError) fileError.textContent = fileErrors.join(' ');
}

function populateStatusSelect(){
  const select = qs('docm-status');
  if(!select) return;
  select.innerHTML = '';
  DOCUMENT_STATUSES.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = statusMeta(status).label;
    select.appendChild(option);
  });
  select.value = 'draft';
  select.disabled = true;
  select.title = 'El estado se gestiona con las acciones de flujo.';
}

function populateStatusFilter(){
  const select = qs('docm-status-filter');
  if(!select) return;
  const previous = select.value;
  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'Todos los estados';
  select.appendChild(all);
  [...VIEW_STATUSES, 'archived', 'under_review'].forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = LEGACY_STATUS_LABELS[status] || statusMeta(status).label;
    select.appendChild(option);
  });
  select.value = previous || '';
  if(select.value !== previous) select.value = '';
}

export function canDeleteQualityDocuments(){
  return hasBasePermission(activeRole(), 'delete_document');
}

export function clearQualityDocumentForm(){
  ['docm-id', 'docm-name', 'docm-description', 'docm-file', 'docm-error'].forEach(id => {
    const el = qs(id);
    if(el) el.value = '';
  });
  if(qs('docm-category')) qs('docm-category').value = 'manual';
  populateStatusSelect();
  if(qs('docm-form-heading')) qs('docm-form-heading').textContent = 'Subir documento';
  if(qs('docm-save')) {
    qs('docm-save').textContent = 'Subir documento';
    qs('docm-save').dataset.permission = 'create_document';
    delete qs('docm-save').dataset.stateDisabled;
  }
  if(qs('docm-file-hint')) qs('docm-file-hint').textContent = 'PNG, JPG o PDF hasta 10 MB. Obligatorio al subir; opcional al editar.';
  showErrors({});
}

function hideDocumentForm(){
  const card = qs('docm-form-card');
  if(card) card.hidden = true;
  clearQualityDocumentForm();
  showListOnly();
}

function hideDocumentPreview(){
  const card = qs('docm-preview-card');
  if(card) card.hidden = true;
  currentPreviewId = '';
  showListOnly();
}

function showListOnly(){
  const form = qs('docm-form-card');
  const preview = qs('docm-preview-card');
  if(form) form.hidden = true;
  if(preview) preview.hidden = true;
  setListVisible(true);
}

function openDocumentForm(doc){
  const role = activeRole();
  const context = doc ? documentContext(doc) : { status: 'draft' };
  const message = doc
    ? 'El documento aprobado no se edita; crea una nueva versión.'
    : 'Tu rol no puede subir documentos.';
  try{
    if(doc){
      assertCan(role, 'edit_document', context);
      if(!isEditableStatus(doc)) throw new Error(message);
    }else{
      assertCan(role, 'create_document');
    }
  }catch(err){
    setWorkflowError(err.message || message);
    return;
  }
  showListOnly();
  clearQualityDocumentForm();
  setWorkflowError('');
  populateResponsibleSelect();
  if(doc){
    qs('docm-id').value = doc.id;
    qs('docm-name').value = doc.name || '';
    qs('docm-category').value = doc.category || 'manual';
    qs('docm-description').value = doc.description || '';
    qs('docm-responsible').value = doc.responsible_employee_id || '';
    qs('docm-status').value = 'draft';
    qs('docm-form-heading').textContent = `Editar documento · ${doc.document_id}`;
    qs('docm-save').textContent = 'Guardar cambios';
    qs('docm-save').dataset.permission = 'edit_document';
    qs('docm-file-hint').textContent = `Archivo actual: ${doc.file_name} · ${formatFileSize(doc.size_bytes)}. Deja vacío para conservarlo.`;
  }
  const form = qs('docm-form-card');
  if(form) form.hidden = false;
  applyDocumentPermissions(form);
}

function detailItem(label, value){
  const item = document.createElement('div');
  item.className = 'docm-detail-item';
  const span = document.createElement('span');
  span.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value || '—';
  item.append(span, strong);
  return item;
}

function renderDocumentEvidence(doc, details){
  const section = document.createElement('div');
  section.className = 'docm-evidence';
  const heading = document.createElement('h3');
  heading.textContent = 'Evidencia adjunta';
  section.appendChild(heading);
  const maps = buildReferenceMaps();
  const records = invoke('evidenceFor', 'document', doc.document_id || doc.id);
  const list = document.createElement('div');
  list.className = 'docm-evidence-list';
  renderEvidenceList(list, records, maps);
  section.appendChild(list);
  if(can(activeRole(), 'attach_evidence', { entityType: 'document' })){
    const controls = document.createElement('div');
    controls.className = 'docm-evidence-form';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,application/pdf';
    input.id = `docm-evidence-file-${doc.id}`;
    input.setAttribute('aria-label', 'Adjuntar evidencia al documento');
    const upload = actionButton('Adjuntar evidencia', 'secondary', { docmEvidenceUpload: doc.id });
    upload.dataset.permission = 'attach_evidence';
    controls.append(input, upload);
    section.appendChild(controls);
  }
  details.appendChild(section);
}

function workflowActions(doc){
  const role = activeRole();
  const context = documentContext(doc);
  const status = normalizeStatus(doc.status);
  const actions = document.createElement('div');
  actions.className = 'docm-detail-actions';
  actions.appendChild(actionButton('Descargar', 'secondary', { docmDownload: doc.id }));

  if(hasBasePermission(role, 'edit_document')){
    actions.appendChild(workflowButton('Editar', { docmEdit: doc.id }, 'edit_document', !can(role, 'edit_document', context)));
  }
  if(hasBasePermission(role, 'submit_document')){
    actions.appendChild(workflowButton('Enviar a revisión', { docmSubmit: doc.id }, 'submit_document', !can(role, 'submit_document', context)));
  }
  if(hasBasePermission(role, 'approve_document')){
    actions.appendChild(workflowButton('Aprobar', { docmApprove: doc.id }, 'approve_document', status !== 'pending_review'));
  }
  if(hasBasePermission(role, 'reject_document')){
    actions.appendChild(workflowButton('Rechazar', { docmReject: doc.id }, 'reject_document', status !== 'pending_review'));
  }
  if(hasBasePermission(role, 'version_document')){
    actions.appendChild(workflowButton('Nueva versión', { docmVersion: doc.id }, 'version_document', status !== 'approved'));
  }
  if(hasBasePermission(role, 'delete_document')){
    actions.appendChild(workflowButton('Eliminar', { docmDelete: doc.id }, 'delete_document', !can(role, 'delete_document', context)));
  }
  return actions;
}

function showDocumentPreview(doc){
  showListOnly();
  currentPreviewId = doc.id;
  const heading = qs('docm-preview-heading');
  const body = qs('docm-preview-body');
  const card = qs('docm-preview-card');
  if(heading) heading.textContent = doc.name;
  if(body){
    body.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = 'docm-preview-layout';

    const details = document.createElement('div');
    details.className = 'docm-preview-details';
    const maps = buildReferenceMaps();
    const status = normalizeStatus(doc.status);
    const items = [
      detailItem('Categoría', CATEGORY_META[doc.category]?.label || doc.category),
      detailItem('Tipo de archivo', `${fileTypeLabel(doc)} · ${formatFileSize(doc.size_bytes)}`),
      detailItem('Fecha de carga', formatDate(doc.uploaded_at)),
      detailItem('Responsable', employeeName(maps, doc.responsible_employee_id)),
      detailItem('Estado', statusMeta(status).label),
      detailItem('Versión', String(doc.version || 1))
    ];
    items.forEach(item => details.appendChild(item));
    if(doc.review_justification){
      details.appendChild(detailItem('Justificación de revisión', doc.review_justification));
    }
    if(doc.description){
      const item = document.createElement('div');
      item.className = 'docm-detail-item full';
      const span = document.createElement('span');
      span.textContent = 'Descripción';
      const strong = document.createElement('strong');
      strong.textContent = doc.description;
      item.append(span, strong);
      details.appendChild(item);
    }
    const statusRow = document.createElement('div');
    statusRow.className = 'docm-detail-status';
    statusRow.appendChild(statusBadge(status));
    details.appendChild(statusRow);
    details.appendChild(workflowActions(doc));
    renderDocumentEvidence(doc, details);
    permissionNotice(details, 'approve_document', documentContext(doc));
    layout.appendChild(details);

    const preview = document.createElement('div');
    preview.className = 'docm-preview-media';
    if(doc.mime_type === 'application/pdf'){
      const iframe = document.createElement('iframe');
      iframe.className = 'docm-preview-frame';
      iframe.title = `Vista previa de ${doc.name}`;
      iframe.src = doc.data_url;
      preview.appendChild(iframe);
    }else{
      const image = document.createElement('img');
      image.className = 'docm-preview-image';
      image.src = doc.data_url;
      image.alt = `Vista previa de ${doc.name}`;
      preview.appendChild(image);
    }
    layout.appendChild(preview);
    body.appendChild(layout);
    applyDocumentPermissions(body);
  }
  if(card) card.hidden = false;
}

function populateResponsibleSelect(){
  const select = qs('docm-responsible');
  if(!select) return;
  const previous = select.value;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- Selecciona un responsable --';
  select.appendChild(blank);
  loadExternal('employees').forEach(employee => {
    const option = document.createElement('option');
    option.value = employee.employee_id;
    option.textContent = employee.name;
    select.appendChild(option);
  });
  if(previous && [...select.options].some(option => option.value === previous)) select.value = previous;
}

function formatDate(value){
  if(!value) return '—';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function fileTypeLabel(doc){
  return MIME_LABELS[doc.mime_type] || String(doc.file_name || '').split('.').pop()?.toUpperCase() || 'Archivo';
}

function badge(text, className){
  const span = document.createElement('span');
  span.className = `docm-badge ${className}`;
  span.textContent = text;
  return span;
}

function matchesFilters(doc, maps){
  const search = (qs('docm-search')?.value || '').trim().toLowerCase();
  const category = qs('docm-category-filter')?.value || '';
  const status = qs('docm-status-filter')?.value || '';
  if(category && doc.category !== category) return false;
  if(status && normalizeStatus(doc.status) !== normalizeStatus(status)) return false;
  if(!search) return true;
  const haystack = [
    doc.document_id,
    doc.name,
    doc.description,
    doc.file_name,
    employeeName(maps, doc.responsible_employee_id)
  ].join(' ').toLowerCase();
  return haystack.includes(search);
}

function sortedDocuments(){
  return [...loadQualityDocuments()].sort((a, b) => String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || '')));
}

function stat(label, value, detail, className){
  const card = document.createElement('div');
  card.className = `docm-stat ${className}`;
  const span = document.createElement('span');
  span.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = String(value);
  const small = document.createElement('small');
  small.textContent = detail;
  card.append(span, strong, small);
  return card;
}

function renderSummary(docs){
  const container = qs('docm-summary');
  if(!container) return;
  container.innerHTML = '';
  const count = category => docs.filter(doc => doc.category === category).length;
  const normalized = docs.map(doc => normalizeStatus(doc.status));
  const stats = [
    stat('Total de documentos', docs.length, 'Archivos registrados en el sistema', 'total'),
    stat('Manuales', count('manual'), 'Documentos rectores de calidad', 'manual'),
    stat('Procedimientos', count('procedure'), 'Instrucciones documentadas', 'procedure'),
    stat('Certificados', count('certificate'), 'Certificaciones y calibraciones', 'certificate'),
    stat('Pendientes de revisión', normalized.filter(status => status === 'pending_review').length, 'Requieren aprobación', 'review')
  ];
  stats.forEach(item => container.appendChild(item));
  container.appendChild(renderStatusLegend(VIEW_STATUSES));
}

function renderCategories(docs){
  const container = qs('docm-categories');
  if(!container) return;
  container.innerHTML = '';
  const active = qs('docm-category-filter')?.value || '';
  const entries = [['', 'Todos los documentos'], ...Object.entries(CATEGORY_META).map(([key, meta]) => [key, meta.label])];
  entries.forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = value === active ? 'docm-category-chip is-active' : 'docm-category-chip';
    button.dataset.docmCategory = value;
    button.setAttribute('aria-pressed', String(value === active));
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('strong');
    count.textContent = String(value ? docs.filter(doc => doc.category === value).length : docs.length);
    button.append(name, count);
    container.appendChild(button);
  });
}

function renderRows(docs, maps){
  const tbody = qs('docm-rows');
  if(!tbody) return;
  const role = activeRole();
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const tr = document.createElement('tr');

    const nameCell = cell('');
    const name = document.createElement('strong');
    name.textContent = doc.name || '—';
    const meta = document.createElement('span');
    meta.className = 'docm-muted-meta';
    meta.textContent = `${doc.document_id || '—'} · v${doc.version || 1} · ${doc.description ? doc.description.slice(0, 60) : 'Sin descripción'}`;
    nameCell.append(name, meta);
    tr.appendChild(nameCell);

    const category = CATEGORY_META[doc.category] || { label: doc.category, className: '' };
    const categoryCell = cell('');
    categoryCell.appendChild(badge(category.short, category.className));
    tr.appendChild(categoryCell);

    const fileCell = cell('');
    const fileType = document.createElement('strong');
    fileType.textContent = fileTypeLabel(doc);
    const fileSize = document.createElement('span');
    fileSize.className = 'docm-muted-meta';
    fileSize.textContent = `${doc.file_name || '—'} · ${formatFileSize(doc.size_bytes)}`;
    fileCell.append(fileType, fileSize);
    tr.appendChild(fileCell);

    tr.appendChild(cell(formatDate(doc.uploaded_at)));
    tr.appendChild(cell(employeeName(maps, doc.responsible_employee_id)));

    const statusCell = cell('');
    statusCell.appendChild(statusBadge(doc.status));
    tr.appendChild(statusCell);

    const context = documentContext(doc);
    const status = normalizeStatus(doc.status);
    const actions = document.createElement('td');
    actions.className = 'table-actions';
    actions.appendChild(actionButton('Ver', 'secondary', { docmView: doc.id }));
    actions.appendChild(actionButton('Descargar', 'secondary', { docmDownload: doc.id }));
    if(hasBasePermission(role, 'edit_document')){
      actions.appendChild(workflowButton('Editar', { docmEdit: doc.id }, 'edit_document', !can(role, 'edit_document', context)));
    }
    if(hasBasePermission(role, 'submit_document')){
      actions.appendChild(workflowButton('Enviar', { docmSubmit: doc.id }, 'submit_document', !can(role, 'submit_document', context)));
    }
    if(hasBasePermission(role, 'approve_document')){
      actions.appendChild(workflowButton('Aprobar', { docmApprove: doc.id }, 'approve_document', status !== 'pending_review'));
    }
    if(hasBasePermission(role, 'reject_document')){
      actions.appendChild(workflowButton('Rechazar', { docmReject: doc.id }, 'reject_document', status !== 'pending_review'));
    }
    if(hasBasePermission(role, 'version_document')){
      actions.appendChild(workflowButton('Nueva versión', { docmVersion: doc.id }, 'version_document', status !== 'approved'));
    }
    if(hasBasePermission(role, 'delete_document')){
      actions.appendChild(workflowButton('Eliminar', { docmDelete: doc.id }, 'delete_document', !can(role, 'delete_document', context)));
    }
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
}

export function renderQualityDocuments(){
  populateResponsibleSelect();
  populateStatusFilter();
  const docs = sortedDocuments();
  const maps = buildReferenceMaps();
  const filtered = docs.filter(doc => matchesFilters(doc, maps));
  renderSummary(docs);
  renderCategories(docs);
  renderRows(filtered, maps);
  const list = qs('docm-list');
  const empty = qs('docm-empty');
  if(list) list.hidden = filtered.length === 0;
  if(empty) empty.hidden = filtered.length !== 0;
  const resultCount = qs('docm-result-count');
  if(resultCount) resultCount.textContent = `${filtered.length} de ${docs.length} documentos`;
  const hint = qs('docm-permission-hint');
  if(hint){
    const role = activeRole();
    if(!can(role, 'create_document')) hint.textContent = 'Modo solo lectura. Consulta los documentos registrados.';
    else if(can(role, 'approve_document')) hint.textContent = 'Tu rol permite revisar, aprobar, versionar y eliminar documentos.';
    else hint.textContent = 'Puedes subir documentos y enviarlos a revisión; la aprobación está restringida a Jefatura de Calidad.';
  }
  permissionNotice(cardOf('docm-list'), 'create_document');
  applyDocumentPermissions(qs('view-quality-documents'));
  if(currentPreviewId){
    const current = docs.find(doc => doc.id === currentPreviewId);
    if(current) showDocumentPreview(current);
    else hideDocumentPreview();
  }
}

async function handleSubmit(event){
  event.preventDefault();
  showErrors({});
  setWorkflowError('');
  const error = qs('docm-error');
  if(error) error.textContent = '';
  const id = qs('docm-id').value;
  const docs = loadQualityDocuments();
  const existing = id ? docs.find(doc => doc.id === id || doc.document_id === id) : null;
  const role = activeRole();
  try{
    if(existing){
      assertCan(role, 'edit_document', documentContext(existing));
      if(!isEditableStatus(existing)) throw new Error('El documento aprobado no se edita; crea una nueva versión.');
    }else{
      assertCan(role, 'create_document');
    }
    const payload = {
      name: qs('docm-name').value,
      category: qs('docm-category').value,
      description: qs('docm-description').value,
      responsible_employee_id: qs('docm-responsible').value,
      status: 'draft'
    };
    const file = qs('docm-file').files ? qs('docm-file').files[0] : null;
    if(file){
      const dataUrl = await readFileAsDataUrl(file);
      payload.file_name = file.name;
      payload.mime_type = file.type;
      payload.size_bytes = file.size;
      payload.data_url = dataUrl;
    }else if(existing){
      payload.file_name = existing.file_name;
      payload.mime_type = existing.mime_type;
      payload.size_bytes = existing.size_bytes;
      payload.data_url = existing.data_url;
    }
    const check = validateQualityDocument(payload, { requireFile: !existing });
    showErrors(check.errors);
    if(!check.valid) return;
    const actor = payload.responsible_employee_id || role;
    const saved = existing
      ? invoke('updateQualityDocument', existing.id, payload, actor)
      : invoke('addQualityDocument', { ...payload, created_by: actor });
    hideDocumentForm();
    renderQualityDocuments();
    if(saved && saved.id) showDocumentPreview(saved);
  }catch(err){
    if(error) error.textContent = err.message;
    else setWorkflowError(err.message);
  }
}

function findDocument(id){
  return loadQualityDocuments().find(item => item.id === id || item.document_id === id);
}

function afterDocumentChange(saved, removed){
  renderQualityDocuments();
  if(removed){
    hideDocumentPreview();
    return;
  }
  if(saved && saved.id){
    currentPreviewId = saved.id;
    showDocumentPreview(saved);
  }
}

async function attachDocumentEvidence(doc, input){
  if(!input || !input.files || !input.files[0]) return;
  try{
    assertCan(activeRole(), 'attach_evidence', { entityType: 'document' });
    const uploadedBy = doc.responsible_employee_id || activeRole();
    await addEvidenceFromFile({
      entityType: 'document',
      entityId: doc.document_id || doc.id,
      file: input.files[0],
      uploadedBy
    });
    input.value = '';
    setWorkflowError('');
    showDocumentPreview(doc);
  }catch(err){
    setWorkflowError(err.message);
  }
}

function handleListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.evidenceDownload){
    try{
      const doc = findDocument(currentPreviewId);
      const records = invoke('evidenceFor', 'document', doc ? doc.document_id || doc.id : currentPreviewId);
      const record = records.find(item => item.id === button.dataset.evidenceDownload);
      if(record) downloadEvidence(record);
    }catch(err){
      setWorkflowError(err.message);
    }
    return;
  }
  if(button.dataset.evidenceDelete){
    const doc = findDocument(currentPreviewId);
    if(!doc) return;
    try{
      const record = invoke('evidenceFor', 'document', doc.document_id || doc.id)
        .find(item => item.id === button.dataset.evidenceDelete);
      if(!record) return;
      assertCan(activeRole(), 'delete_evidence', { entityType: 'document', isOwner: true });
      invoke('deleteEvidence', record.id, record.uploaded_by || activeRole());
      showDocumentPreview(doc);
    }catch(err){
      setWorkflowError(err.message);
    }
    return;
  }
  if(button.dataset.docmEvidenceUpload){
    const doc = findDocument(button.dataset.docmEvidenceUpload);
    const input = qs(`docm-evidence-file-${doc ? doc.id : button.dataset.docmEvidenceUpload}`);
    if(doc) void attachDocumentEvidence(doc, input);
    return;
  }
  if(button.dataset.docmView){
    const doc = findDocument(button.dataset.docmView);
    if(doc) showDocumentPreview(doc);
    return;
  }
  if(button.dataset.docmDownload){
    const doc = findDocument(button.dataset.docmDownload);
    if(!doc) return;
    try{
      downloadEvidence(doc);
    }catch(err){
      setWorkflowError(err.message);
    }
    return;
  }
  const action = ['docmEdit', 'docmSubmit', 'docmApprove', 'docmReject', 'docmVersion', 'docmDelete']
    .find(key => button.dataset[key]);
  if(!action) return;
  const doc = findDocument(button.dataset[action]);
  if(!doc || button.disabled) return;
  const role = activeRole();
  const context = documentContext(doc);
  const actor = doc.responsible_employee_id || role;
  try{
    if(action === 'docmEdit'){
      openDocumentForm(doc);
      return;
    }
    if(action === 'docmSubmit'){
      assertCan(role, 'submit_document', context);
      if(!isEditableStatus(doc)) throw new Error('Solo se pueden enviar documentos en borrador o rechazados.');
      afterDocumentChange(invoke('submitDocumentForReview', doc.id, actor), false);
      return;
    }
    if(action === 'docmApprove'){
      assertCan(role, 'approve_document', context);
      if(normalizeStatus(doc.status) !== 'pending_review') throw new Error('El documento no está pendiente de revisión.');
      afterDocumentChange(invoke('approveDocument', doc.id, actor), false);
      return;
    }
    if(action === 'docmReject'){
      assertCan(role, 'reject_document', context);
      if(normalizeStatus(doc.status) !== 'pending_review') throw new Error('El documento no está pendiente de revisión.');
      const justification = prompt('Justificación del rechazo');
      if(!String(justification || '').trim()){
        setWorkflowError('Registra la justificación del rechazo.');
        return;
      }
      afterDocumentChange(invoke('rejectDocument', doc.id, actor, justification), false);
      return;
    }
    if(action === 'docmVersion'){
      assertCan(role, 'version_document', context);
      if(normalizeStatus(doc.status) !== 'approved') throw new Error('Solo se puede versionar un documento aprobado.');
      afterDocumentChange(invoke('duplicateDocumentVersion', doc.id, actor), false);
      return;
    }
    if(action === 'docmDelete'){
      assertCan(role, 'delete_document', context);
      if(!confirm('¿Eliminar este documento de calidad?')) return;
      invoke('deleteQualityDocument', doc.id, actor);
      afterDocumentChange(null, true);
    }
  }catch(err){
    setWorkflowError(err.message || 'No se pudo completar la operación.');
  }
}

function handleCategoryClick(event){
  const button = event.target.closest('button[data-docm-category]');
  if(!button) return;
  const select = qs('docm-category-filter');
  if(select) select.value = button.dataset.docmCategory || '';
  renderQualityDocuments();
}

function handlePreviewDownload(){
  const doc = findDocument(currentPreviewId);
  if(!doc) return;
  try{
    downloadEvidence(doc);
  }catch(err){
    setWorkflowError(err.message);
  }
}

export function initQualityDocumentManager(){
  const form = qs('docm-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
  form.addEventListener('submit', handleSubmit);
  const create = qs('docm-create');
  if(create){
    create.dataset.permission = 'create_document';
    create.addEventListener('click', () => openDocumentForm(null));
  }
  qs('docm-cancel').addEventListener('click', hideDocumentForm);
  qs('docm-form-back').addEventListener('click', hideDocumentForm);
  qs('docm-preview-back').addEventListener('click', hideDocumentPreview);
  qs('docm-preview-download').addEventListener('click', handlePreviewDownload);
  qs('docm-list').addEventListener('click', handleListClick);
  qs('docm-preview-body').addEventListener('click', handleListClick);
  qs('docm-categories').addEventListener('click', handleCategoryClick);
  ['docm-search', 'docm-category-filter', 'docm-status-filter'].forEach(id => {
    const control = qs(id);
    if(!control) return;
    control.addEventListener('input', renderQualityDocuments);
    control.addEventListener('change', renderQualityDocuments);
  });
}
