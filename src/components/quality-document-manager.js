import {
  loadExternal,
  loadQualityDocuments,
  validateQualityDocument,
  addQualityDocument,
  updateQualityDocument,
  deleteQualityDocument
} from '../storage.js';
import { buildReferenceMaps, employeeName, qs, cell, actionButton } from './quality-utils.js';
import { formatFileSize, downloadEvidence, readFileAsDataUrl } from './evidence.js';

const QUALITY_ROLE_KEY = 'erp_quality:viewer_role';
const DELETE_ROLES = Object.freeze(['jefe_calidad', 'gerente']);

const CATEGORY_META = Object.freeze({
  manual: { label: 'Manuales de calidad', short: 'Manual', className: 'docm-category-manual' },
  procedure: { label: 'Procedimientos', short: 'Procedimiento', className: 'docm-category-procedure' },
  regulation: { label: 'Normativas', short: 'Normativa', className: 'docm-category-regulation' },
  certificate: { label: 'Certificados', short: 'Certificado', className: 'docm-category-certificate' },
  specification: { label: 'Especificaciones técnicas', short: 'Especificación', className: 'docm-category-specification' },
  other: { label: 'Otros documentos', short: 'Otro', className: 'docm-category-other' }
});

const STATUS_META = Object.freeze({
  under_review: { label: 'Pendiente de revisión', className: 'docm-status-review' },
  approved: { label: 'Aprobado', className: 'docm-status-approved' },
  draft: { label: 'Borrador', className: 'docm-status-draft' },
  archived: { label: 'Archivado', className: 'docm-status-archived' }
});

const MIME_LABELS = Object.freeze({
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'application/pdf': 'PDF'
});

let currentPreviewId = '';

function currentRole(){
  if(typeof localStorage === 'undefined') return 'jefe_calidad';
  return localStorage.getItem(QUALITY_ROLE_KEY) || 'jefe_calidad';
}

export function canDeleteQualityDocuments(){
  return DELETE_ROLES.includes(currentRole());
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

export function clearQualityDocumentForm(){
  ['docm-id', 'docm-name', 'docm-description', 'docm-file', 'docm-error'].forEach(id => {
    const el = qs(id);
    if(el) el.value = '';
  });
  if(qs('docm-category')) qs('docm-category').value = 'manual';
  if(qs('docm-status')) qs('docm-status').value = 'under_review';
  if(qs('docm-form-heading')) qs('docm-form-heading').textContent = 'Subir documento';
  if(qs('docm-save')) qs('docm-save').textContent = 'Subir documento';
  if(qs('docm-file-hint')) qs('docm-file-hint').textContent = 'PNG, JPG o PDF hasta 10 MB. Obligatorio al subir; opcional al editar.';
  showErrors({});
}

function hideDocumentForm(){
  const card = qs('docm-form-card');
  if(card) card.hidden = true;
  clearQualityDocumentForm();
  setListVisible(true);
}

function hideDocumentPreview(){
  const card = qs('docm-preview-card');
  if(card) card.hidden = true;
  currentPreviewId = '';
  setListVisible(true);
}

function showListOnly(){
  const form = qs('docm-form-card');
  const preview = qs('docm-preview-card');
  if(form) form.hidden = true;
  if(preview) preview.hidden = true;
  currentPreviewId = '';
  setListVisible(true);
}

function openDocumentForm(doc){
  showListOnly();
  clearQualityDocumentForm();
  if(doc){
    qs('docm-id').value = doc.id;
    qs('docm-name').value = doc.name || '';
    qs('docm-category').value = doc.category || 'manual';
    qs('docm-description').value = doc.description || '';
    qs('docm-responsible').value = doc.responsible_employee_id || '';
    qs('docm-status').value = doc.status || 'under_review';
    qs('docm-form-heading').textContent = `Editar documento · ${doc.document_id}`;
    qs('docm-save').textContent = 'Guardar cambios';
    qs('docm-file-hint').textContent = `Archivo actual: ${doc.file_name} · ${formatFileSize(doc.size_bytes)}. Deja vacío para conservarlo.`;
  }
  const form = qs('docm-form-card');
  if(form) form.hidden = false;
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
    const items = [
      ['Categoría', CATEGORY_META[doc.category]?.label || doc.category],
      ['Tipo de archivo', `${fileTypeLabel(doc)} · ${formatFileSize(doc.size_bytes)}`],
      ['Fecha de carga', formatDate(doc.uploaded_at)],
      ['Responsable', employeeName(maps, doc.responsible_employee_id)],
      ['Estado', STATUS_META[doc.status]?.label || doc.status],
      ['Versión', String(doc.version || 1)]
    ];
    items.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'docm-detail-item';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value || '—';
      item.append(span, strong);
      details.appendChild(item);
    });
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
    const actions = document.createElement('div');
    actions.className = 'docm-detail-actions';
    actions.appendChild(actionButton('Descargar', 'secondary', { docmDownload: doc.id }));
    actions.appendChild(actionButton('Editar', 'secondary', { docmEdit: doc.id }));
    if(canDeleteQualityDocuments()){
      actions.appendChild(actionButton('Eliminar', 'danger', { docmDelete: doc.id }));
    }
    details.appendChild(actions);
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
  if(status && doc.status !== status) return false;
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
  const stats = [
    stat('Total de documentos', docs.length, 'Archivos registrados en el sistema', 'total'),
    stat('Manuales', count('manual'), 'Documentos rectores de calidad', 'manual'),
    stat('Procedimientos', count('procedure'), 'Instrucciones documentadas', 'procedure'),
    stat('Certificados', count('certificate'), 'Certificaciones y calibraciones', 'certificate'),
    stat('Pendientes de revisión', docs.filter(doc => doc.status === 'under_review').length, 'Requieren aprobación', 'review')
  ];
  stats.forEach(item => container.appendChild(item));
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
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const tr = document.createElement('tr');

    const nameCell = cell('');
    const name = document.createElement('strong');
    name.textContent = doc.name || '—';
    const meta = document.createElement('span');
    meta.className = 'docm-muted-meta';
    meta.textContent = `${doc.document_id || '—'} · ${doc.description ? doc.description.slice(0, 60) : 'Sin descripción'}`;
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

    const status = STATUS_META[doc.status] || { label: doc.status, className: '' };
    const statusCell = cell('');
    statusCell.appendChild(badge(status.label, status.className));
    tr.appendChild(statusCell);

    const actions = document.createElement('td');
    actions.className = 'table-actions';
    actions.appendChild(actionButton('Ver', 'secondary', { docmView: doc.id }));
    actions.appendChild(actionButton('Descargar', 'secondary', { docmDownload: doc.id }));
    actions.appendChild(actionButton('Editar', 'secondary', { docmEdit: doc.id }));
    const remove = actionButton('Eliminar', 'danger', { docmDelete: doc.id });
    if(!canDeleteQualityDocuments()){
      remove.disabled = true;
      remove.title = 'La eliminación requiere rol de Jefatura de Calidad o Gerencia';
    }
    actions.appendChild(remove);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  });
}

export function renderQualityDocuments(){
  populateResponsibleSelect();
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
    hint.textContent = canDeleteQualityDocuments()
      ? 'Tu rol permite eliminar documentos.'
      : 'Rol Inspector: la eliminación está restringida a Jefatura de Calidad o Gerencia.';
  }
  if(currentPreviewId){
    const current = docs.find(doc => doc.id === currentPreviewId);
    if(current) showDocumentPreview(current);
    else hideDocumentPreview();
  }
}

async function handleSubmit(event){
  event.preventDefault();
  showErrors({});
  const error = qs('docm-error');
  if(error) error.textContent = '';
  const id = qs('docm-id').value;
  const docs = loadQualityDocuments();
  const existing = id ? docs.find(doc => doc.id === id || doc.document_id === id) : null;
  const payload = {
    name: qs('docm-name').value,
    category: qs('docm-category').value,
    description: qs('docm-description').value,
    responsible_employee_id: qs('docm-responsible').value,
    status: qs('docm-status').value
  };
  try{
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
    const saved = existing ? updateQualityDocument(existing.id, payload) : addQualityDocument(payload);
    hideDocumentForm();
    renderQualityDocuments();
    showDocumentPreview(saved);
  }catch(err){
    if(error) error.textContent = err.message;
  }
}

function handleListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  const docs = loadQualityDocuments();
  if(button.dataset.docmView){
    const doc = docs.find(item => item.id === button.dataset.docmView || item.document_id === button.dataset.docmView);
    if(doc) showDocumentPreview(doc);
    return;
  }
  if(button.dataset.docmDownload){
    const doc = docs.find(item => item.id === button.dataset.docmDownload || item.document_id === button.dataset.docmDownload);
    if(!doc) return;
    try{
      downloadEvidence(doc);
    }catch(err){
      const error = qs('docm-error');
      if(error) error.textContent = err.message;
    }
    return;
  }
  if(button.dataset.docmEdit){
    const doc = docs.find(item => item.id === button.dataset.docmEdit || item.document_id === button.dataset.docmEdit);
    if(doc) openDocumentForm(doc);
    return;
  }
  if(button.dataset.docmDelete){
    if(button.disabled || !canDeleteQualityDocuments()) return;
    if(!confirm('¿Eliminar este documento de calidad?')) return;
    try{
      deleteQualityDocument(button.dataset.docmDelete);
      if(currentPreviewId === button.dataset.docmDelete) hideDocumentPreview();
      renderQualityDocuments();
    }catch(err){
      const error = qs('docm-error');
      if(error) error.textContent = err.message;
    }
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
  const doc = loadQualityDocuments().find(item => item.id === currentPreviewId);
  if(!doc) return;
  try{
    downloadEvidence(doc);
  }catch(err){
    const error = qs('docm-error');
    if(error) error.textContent = err.message;
  }
}

export function initQualityDocumentManager(){
  const form = qs('docm-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';
  form.addEventListener('submit', handleSubmit);
  qs('docm-create').addEventListener('click', () => openDocumentForm(null));
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
