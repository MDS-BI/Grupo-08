import { loadModuleConfig, normalizeConfig, setActiveConfig, labelFor } from './module-config.js';
import { loadEntities, addEntity, updateEntity, deleteEntity, validateEntity, searchEntities, loadDocuments, addDocument, updateDocument, deleteDocument, validateDocument, ensureSeedData } from './storage.js';
import { clearEntityForm, startEntityEdit, collectEntityPayload, showEntityErrors } from './components/entity-form.js';
import { createEntityItem } from './components/entity-list.js';
import { clearDocumentForm, startDocumentEdit, collectDocumentPayload, showDocumentErrors } from './components/document-form.js';
import { folioLabel } from './components/document-list.js';
import { renderLogo, applyShellLabels, setActiveModule } from './components/shell.js';
import { renderQualityDashboard, initQualityAlerts } from './components/dashboard.js';
import { setupSearchBar, renderSearchResults } from './components/search-bar.js';
import { renderPendingLots, initPendingLots } from './components/pending-lots.js';
import { renderPlanConfig, initPlanConfig, clearPlanForm, clearCriterionForm } from './components/quality-plan-config.js';
import { renderChecklists, initChecklistManager, clearChecklistForm } from './components/checklist-manager.js';
import { renderInspectionView, initInspectionEngine, startInspection, resetInspectionForm } from './components/inspection-engine.js';
import { renderNonConformance, initNonConformanceCapa, clearNcForm, clearCapaForm } from './components/non-conformance-capa.js';
import { renderCapaManager, initCapaManager, clearCapaManagerForm } from './components/capa-manager.js';
import { renderQualityDocuments, initQualityDocumentManager, clearQualityDocumentForm } from './components/quality-document-manager.js';
import { renderQualityReports, initQualityReports } from './components/quality-reports.js';
import { renderQualitySettings, initQualitySettings } from './components/quality-settings.js';
import { renderHistory, initInspectionHistory } from './components/inspection-history.js';
import { renderAuditLog, initAuditLog } from './components/quality-audit-log.js';
import * as qualityStorage from './storage.js';
import { applyPermissionState } from './permissions.js';
import { renderStatusLegend } from './components/status-badge.js';
import { renderReviewQueue, initReviewQueue } from './components/review-queue.js';

function qs(id){ return document.getElementById(id); }

// Ayudantes de género gramatical para etiquetas configurables en español.
// El género se deduce de la primera palabra (p. ej., "Pedido de Venta" → masculino)
// usando terminaciones femeninas comunes (-a, -dad, -ción, ...).
const palabraClave = (word) => String(word).trim().split(/\s+/)[0] || '';
const esFemenina = (word) => /(a|dad|tad|ción|sión|tud|umbre|ie)$/i.test(palabraClave(word));
const articulo = (word) => esFemenina(word) ? 'la' : 'el';
const demostrativo = (word) => esFemenina(word) ? 'esta' : 'este';
const seleccionada = (word) => esFemenina(word) ? 'seleccionada' : 'seleccionado';

const MODULES = ['dashboard', 'entities', 'documents', 'search'];
const VIEWS = {
  dashboard: 'view-dashboard',
  entities: 'view-entities',
  documents: 'view-documents',
  search: 'view-search'
};

const QUALITY_VIEWS = Object.freeze({
  'quality-dashboard': 'view-quality-dashboard',
  'quality-search': 'view-search',
  'quality-plans': 'view-quality-plans',
  'quality-checklists': 'view-quality-checklists',
  'quality-inspections': 'view-inspections',
  'quality-non-conformances': 'view-non-conformance',
  'quality-capa': 'view-corrective-actions',
  'quality-documents': 'view-quality-documents',
  'quality-approvals': 'view-quality-approvals',
  'quality-reports': 'view-quality-reports',
  'quality-entities': 'view-entities',
  'quality-settings': 'view-quality-settings'
});

const QUALITY_SECONDARY_VIEWS = Object.freeze({
  'pending-lots': 'view-pending-lots',
  'quality-history': 'view-quality-history',
  'quality-audit-log': 'view-quality-audit-log'
});

const QUALITY_VIEW_ALIASES = Object.freeze({
  inspections: 'quality-inspections',
  'non-conformance': 'quality-non-conformances',
  'corrective-actions': 'quality-capa',
  'quality-lots': 'pending-lots'
});

const QUALITY_ROLE_KEY = 'erp_quality:viewer_role';
const QUALITY_ROLES = Object.freeze(['jefe_calidad', 'inspector', 'gerente']);
const ROLE_META = Object.freeze({
  jefe_calidad: { label: 'Jefe de Calidad', initials: 'JC' },
  inspector: { label: 'Inspector de Calidad', initials: 'IN' },
  gerente: { label: 'Gerente de Operaciones', initials: 'GO' }
});

let wired = false;
let activeQualityView = null;

function normalizeQualityView(name){
  if(QUALITY_VIEWS[name] || QUALITY_SECONDARY_VIEWS[name]) return name;
  return QUALITY_VIEW_ALIASES[name] || 'quality-dashboard';
}

function currentQualityRole(){
  const getter = qualityStorage.getActiveRole;
  if(typeof getter === 'function'){
    try{
      const role = getter();
      if(QUALITY_ROLES.includes(role)) return role;
    }catch{ return 'jefe_calidad'; }
  }
  const select = qs('quality-role') || qs('quality-settings-role');
  const selected = select ? select.value : '';
  if(QUALITY_ROLES.includes(selected)) return selected;
  try{
    const stored = localStorage.getItem(QUALITY_ROLE_KEY);
    if(QUALITY_ROLES.includes(stored)) return stored;
  }catch{ return 'jefe_calidad'; }
  return 'jefe_calidad';
}

function syncRoleIndicator(role){
  const meta = ROLE_META[role] || ROLE_META.jefe_calidad;
  const moduleName = qs('topbar-module-name');
  const topbarUser = qs('topbar-user-name');
  const topbarRole = qs('topbar-role');
  const topbarAvatar = qs('topbar-avatar');
  if(moduleName) moduleName.textContent = 'Control de Calidad';
  if(topbarUser) topbarUser.textContent = 'Usuario de calidad';
  if(topbarRole) topbarRole.textContent = meta.label;
  if(topbarAvatar) topbarAvatar.textContent = meta.initials;
  const welcome = qs('quality-welcome');
  if(welcome) welcome.textContent = `Bienvenido, ${meta.label}. Consulta el estado del sistema de calidad.`;
  const chip = qs('quality-active-role');
  if(chip) chip.textContent = meta.label;
}

function setQualityRole(role){
  if(!QUALITY_ROLES.includes(role)) return;
  try{ localStorage.setItem(QUALITY_ROLE_KEY, role); }catch(error){ Object(error); }
  const setter = qualityStorage.setActiveRole;
  if(typeof setter === 'function') setter(role);
  ['quality-role', 'quality-settings-role'].forEach(id => {
    const select = qs(id);
    if(select) select.value = role;
  });
  syncRoleIndicator(role);
  document.dispatchEvent(new CustomEvent('quality:role-changed', { detail: { role } }));
}

function applyQualityPermissions(root){
  const role = currentQualityRole();
  applyPermissionState(root || document, role);
  syncRoleIndicator(role);
}

function hideQualityViews(){
  [...Object.values(QUALITY_VIEWS), ...Object.values(QUALITY_SECONDARY_VIEWS)].forEach(id => {
    const el = qs(id);
    if(el) el.hidden = true;
  });
}

function setActiveQuality(name){
  const canonical = QUALITY_VIEWS[name] ? name : null;
  document.querySelectorAll('.nav-quality').forEach(btn => {
    const active = btn.dataset.quality === canonical;
    btn.classList.toggle('active', active);
    if(active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  document.querySelectorAll('.nav-related').forEach(btn => {
    const active = btn.dataset.relatedQuality === name;
    btn.classList.toggle('active', active);
    if(active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

function renderQualityEntities(){
  const host = qs('quality-entity-list');
  if(!host) return;
  const term = (qs('quality-entity-search') ? qs('quality-entity-search').value : '').trim().toLowerCase();
  const records = [];
  loadEntities().forEach(item => records.push({ tipo: 'Entidad', nombre: item.name, detalle: `${item.code || ''} ${item.category || ''}`.trim() }));
  try{
    qualityStorage.loadExternal('products').forEach(item => records.push({ tipo: 'Producto', nombre: item.name, detalle: item.product_id || '' }));
    qualityStorage.loadExternal('employees').forEach(item => records.push({ tipo: 'Empleado', nombre: item.name, detalle: item.employee_id || '' }));
  }catch{ return; }
  const filtered = term ? records.filter(item => `${item.tipo} ${item.nombre} ${item.detalle}`.toLowerCase().includes(term)) : records;
  host.replaceChildren();
  if(filtered.length === 0){
    host.className = 'empty';
    host.textContent = 'Ningún maestro coincide con la búsqueda.';
    return;
  }
  host.className = '';
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Tipo', 'Nombre', 'Detalle'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  filtered.forEach(item => {
    const row = document.createElement('tr');
    [item.tipo, item.nombre, item.detalle || '—'].forEach(value => {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  host.appendChild(scroll);
}

function renderQualityView(name, opts = {}){
  const role = currentQualityRole();
  syncRoleIndicator(role);
  if(name === 'quality-dashboard') renderQualityDashboard();
  if(name === 'quality-search') refreshSearch();
  if(name === 'quality-entities') renderQualityEntities();
  if(name === 'pending-lots') renderPendingLots();
  if(name === 'quality-plans') renderPlanConfig();
  if(name === 'quality-checklists') renderChecklists();
  if(name === 'quality-inspections'){
    if(opts.referenceModule && opts.referenceId) startInspection(opts.referenceModule, opts.referenceId);
    else renderInspectionView();
  }
  if(name === 'quality-non-conformances') renderNonConformance();
  if(name === 'quality-capa') renderCapaManager();
  if(name === 'quality-documents') renderQualityDocuments();
  if(name === 'quality-approvals') renderReviewQueue();
  if(name === 'quality-reports') renderQualityReports();
  if(name === 'quality-settings') renderQualitySettings();
  if(name === 'quality-history') renderHistory();
  if(name === 'quality-audit-log') renderAuditLog();
  applyQualityPermissions(qs(QUALITY_VIEWS[name] || QUALITY_SECONDARY_VIEWS[name]));
}

function showQuality(name, opts = {}){
  const view = normalizeQualityView(name);
  activeQualityView = view;
  MODULES.forEach(m => { const el = qs(VIEWS[m]); if(el) el.hidden = true; });
  const allViews = { ...QUALITY_VIEWS, ...QUALITY_SECONDARY_VIEWS };
  Object.entries(allViews).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.hidden = key !== view;
  });
  const writeSections = document.querySelectorAll('#view-entities .entity-write');
  writeSections.forEach(el => { el.hidden = true; });
  const readonly = qs('quality-entities-readonly');
  if(readonly) readonly.hidden = view !== 'quality-entities';
  setActiveModule('');
  setActiveQuality(view);
  renderQualityView(view, opts);
  document.dispatchEvent(new CustomEvent('quality:view-changed', { detail: { view, role: currentQualityRole() } }));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showModule(name, opts = {}){
  if(!MODULES.includes(name)) name = 'dashboard';
  if(name === 'dashboard'){
    showQuality('quality-dashboard');
    return;
  }
  activeQualityView = null;
  MODULES.forEach(m => { qs(VIEWS[m]).hidden = m !== name; });
  hideQualityViews();
  setActiveQuality(null);
  setActiveModule(name);
  if(name === 'entities'){
    document.querySelectorAll('#view-entities .entity-write').forEach(el => { el.hidden = false; });
    const readonly = qs('quality-entities-readonly');
    if(readonly) readonly.hidden = true;
    populateDocumentEntitySelect();
    populateEditEntitySelect();
    if(opts.newRecord) clearEntityForm();
    if(opts.focusForm) qs('name').focus();
  }
  if(name === 'documents'){
    populateDocumentEntitySelect();
    populateEditDocumentSelect();
    if(opts.newRecord) clearDocumentForm();
    if(opts.focusForm) qs('document-entity').focus();
  }
  if(name === 'search'){
    refreshSearch();
    if(opts.focusSearch) qs('search-input').focus();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function populateDocumentEntitySelect(){
  const select = qs('document-entity');
  const prev = select.value;
  select.innerHTML = '';
  loadEntities().forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.entity_id;
    opt.textContent = e.name;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

function populateEditEntitySelect(){
  const select = qs('edit-entity');
  const prev = select.value;
  select.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = `-- Selecciona ${articulo(labelFor('entity'))} ${labelFor('entity').toLowerCase()} --`;
  select.appendChild(none);
  loadEntities().forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.name} — ${e.code}`;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

function populateEditDocumentSelect(){
  const select = qs('edit-document');
  const prev = select.value;
  select.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = `-- Selecciona ${articulo(labelFor('document'))} ${labelFor('document').toLowerCase()} --`;
  select.appendChild(none);
  const entities = loadEntities();
  loadDocuments().forEach(d => {
    const entity = entities.find(e => e.entity_id === d.entity_id);
    const label = `${entity ? entity.name : 'Entidad desconocida'} · ${folioLabel(d)} · ${d.startDate} → ${d.endDate}`;
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = label;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

function refreshSearch(){
  renderSearchResults(qs('search-results-list'), qs('search-empty'), searchEntities(qs('search-input').value), (e) => createEntityItem(e));
}

function onEditEntityChange(){
  const id = qs('edit-entity').value;
  if(!id){ clearEntityForm(); return; }
  const entity = loadEntities().find(e => e.id === id);
  if(entity) startEntityEdit(entity);
}

function handleDeleteSelectedEntity(){
  const id = qs('edit-entity').value;
  if(!id){ qs('error-edit-entity').textContent = `Selecciona ${articulo(labelFor('entity'))} ${labelFor('entity').toLowerCase()} para eliminar.`; return; }
  if(!confirm(`¿Eliminar ${demostrativo(labelFor('entity'))} ${labelFor('entity').toLowerCase()}? Sus ${labelFor('documents').toLowerCase()} también se eliminarán.`)) return;
  deleteEntity(id);
  qs('error-edit-entity').textContent = '';
  clearEntityForm();
  populateDocumentEntitySelect();
  populateEditEntitySelect();
  populateEditDocumentSelect();
}

function onEditDocumentChange(){
  const id = qs('edit-document').value;
  if(!id){ clearDocumentForm(); return; }
  const doc = loadDocuments().find(d => d.id === id);
  if(doc) startDocumentEdit(doc);
}

function handleDeleteSelectedDocument(){
  const id = qs('edit-document').value;
  if(!id){ qs('error-edit-document').textContent = `Selecciona ${articulo(labelFor('document'))} ${labelFor('document').toLowerCase()} para eliminar.`; return; }
  if(!confirm(`¿Eliminar ${demostrativo(labelFor('document'))} ${labelFor('document').toLowerCase()}?`)) return;
  deleteDocument(id);
  qs('error-edit-document').textContent = '';
  clearDocumentForm();
  populateEditDocumentSelect();
}

function afterSaveRefresh(){
  populateDocumentEntitySelect();
  populateEditEntitySelect();
  populateEditDocumentSelect();
}

function handleEntitySubmit(ev){
  ev.preventDefault();
  const id = qs('entity-id').value;
  const payload = collectEntityPayload();
  const { valid, errors } = validateEntity(payload);
  showEntityErrors(errors);
  if(!valid) return;
  if(id){
    try{
      updateEntity(id, payload);
      clearEntityForm();
    }catch(e){ alert(e.message); }
  }else{
    addEntity(payload);
    clearEntityForm();
  }
  afterSaveRefresh();
}

function handleDocumentSubmit(ev){
  ev.preventDefault();
  const id = qs('document-id').value;
  const payload = collectDocumentPayload();
  const existing = id ? loadDocuments().find(d => d.id === id) : undefined;
  const { valid, errors } = validateDocument(payload, existing ? existing.status : undefined);
  showDocumentErrors(errors);
  if(!valid) return;
  try{
    if(id){
      updateDocument(id, payload);
    }else{
      addDocument(payload);
    }
    clearDocumentForm();
  }catch(e){
    alert(e.message);
    showDocumentErrors({ status: e.message });
  }
  afterSaveRefresh();
}

function applyLabels(config){
  const entity = config.labels.entity;
  const entities = config.labels.entities;
  const document_ = config.labels.document;
  const documents = config.labels.documents;
  const femEntity = esFemenina(entity);
  const femDocument = esFemenina(document_);

  document.title = config.moduleName;
  qs('brand-name').textContent = config.moduleName;
  applyShellLabels();

  qs('dashboard-heading').textContent = config.moduleName;
  qs('dashboard-subtitle').textContent = `Gestiona tus ${entities.toLowerCase()} y ${documents.toLowerCase()} en un solo lugar.`;
  qs('action-new-entity-title').textContent = `${femEntity ? 'Nueva' : 'Nuevo'} ${entity}`;
  qs('action-new-entity-sub').textContent = `Crear un registro de ${entity.toLowerCase()}`;
  qs('action-new-document-title').textContent = `${femDocument ? 'Nueva' : 'Nuevo'} ${document_}`;
  qs('action-new-document-sub').textContent = `Registrar un registro de ${document_.toLowerCase()}`;
  qs('action-find-title').textContent = 'Buscar registros';
  qs('action-find-sub').textContent = `Buscar ${entities.toLowerCase()}`;

  qs('entities-view-heading').textContent = entities;
  qs('documents-view-heading').textContent = documents;
  qs('entity-form-heading').textContent = `Agregar / Editar ${entity}`;
  qs('edit-entity-heading').textContent = `Editar o eliminar ${articulo(entity)} ${entity.toLowerCase()}`;
  qs('document-form-heading').textContent = `Agregar / Editar ${document_}`;
  qs('edit-document-heading').textContent = `Editar o eliminar ${articulo(document_)} ${document_.toLowerCase()}`;
  qs('search-view-heading').textContent = `Buscar ${entities}`;
  qs('search-heading').textContent = `Buscar ${articulo(entity)} ${entity.toLowerCase()}`;
  qs('search-input').placeholder = 'Buscar por nombre, código, categoría...';
  qs('search-input').setAttribute('aria-label', `Buscar ${entities.toLowerCase()}`);
  qs('search-empty').textContent = 'Sin coincidencias para tu búsqueda.';
  qs('delete-entity').textContent = `Eliminar ${articulo(entity)} ${entity.toLowerCase()} ${seleccionada(entity)}`;
  qs('delete-document').textContent = `Eliminar ${articulo(document_)} ${document_.toLowerCase()} ${seleccionada(document_)}`;
}

function applyTheme(config){
  document.documentElement.style.setProperty('--accent', config.theme.accentColor);
}

function showConfigErrors(errors){
  const banner = qs('config-errors');
  if(errors && errors.length > 0){
    banner.textContent = `Problema de configuración del módulo: ${errors.join(' ')}`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
    banner.textContent = '';
  }
}

function wireEvents(){
  if(wired) return;
  wired = true;
  document.querySelectorAll('.nav-module').forEach(btn => {
    btn.addEventListener('click', () => showModule(btn.dataset.module));
  });
  qs('action-new-entity').addEventListener('click', () => showModule('entities', { newRecord: true, focusForm: true }));
  qs('action-new-document').addEventListener('click', () => showModule('documents', { newRecord: true, focusForm: true }));
  qs('action-find').addEventListener('click', () => showModule('search', { focusSearch: true }));
  qs('entity-form').addEventListener('submit', handleEntitySubmit);
  qs('cancel-edit').addEventListener('click', clearEntityForm);
  qs('document-form').addEventListener('submit', handleDocumentSubmit);
  qs('document-cancel-edit').addEventListener('click', clearDocumentForm);
  setupSearchBar(qs('search-input'), () => refreshSearch());
  qs('edit-entity').addEventListener('change', onEditEntityChange);
  qs('edit-document').addEventListener('change', onEditDocumentChange);
  qs('delete-entity').addEventListener('click', handleDeleteSelectedEntity);
  qs('delete-document').addEventListener('click', handleDeleteSelectedDocument);

  document.querySelectorAll('.nav-quality').forEach(btn => {
    btn.addEventListener('click', () => showQuality(btn.dataset.quality));
  });
  document.querySelectorAll('.nav-related').forEach(btn => {
    btn.addEventListener('click', () => showQuality(btn.dataset.relatedQuality));
  });
  ['quality-role', 'quality-settings-role'].forEach(id => {
    const select = qs(id);
    if(select) select.addEventListener('change', () => setQualityRole(select.value));
  });
  document.addEventListener('quality:role-changed', () => {
    if(activeQualityView) renderQualityView(activeQualityView);
    applyQualityPermissions(document);
  });
  document.addEventListener('quality:navigate-requested', event => {
    const view = event && event.detail ? event.detail.view : null;
    if(view) showQuality(view);
  });
  document.querySelectorAll('[data-quality-target]').forEach(button => {
    button.addEventListener('click', () => showQuality(button.dataset.qualityTarget));
  });
  const reviewButton = qs('quality-review-open');
  if(reviewButton) reviewButton.addEventListener('click', () => showQuality('quality-approvals'));
  const lotsRefresh = qs('pending-lots-refresh');
  if(lotsRefresh) lotsRefresh.addEventListener('click', () => renderPendingLots());
  const entitySearch = qs('quality-entity-search');
  if(entitySearch) entitySearch.addEventListener('input', () => renderQualityEntities());
  const entityRefresh = qs('quality-entity-refresh');
  if(entityRefresh) entityRefresh.addEventListener('click', () => renderQualityEntities());
  const legend = qs('quality-status-legend');
  if(legend) legend.appendChild(renderStatusLegend());
  initReviewQueue();
  initPendingLots({
    onInspect: (referenceModule, referenceId) => showQuality('quality-inspections', { referenceModule, referenceId })
  });
  initQualityAlerts();
  initPlanConfig();
  initChecklistManager();
  initInspectionEngine();
  initNonConformanceCapa();
  initCapaManager();
  initQualityDocumentManager();
  initQualityReports();
  initQualitySettings();
  initInspectionHistory();
  initAuditLog();
}

export function initApp(resolved){
  showConfigErrors(resolved.errors);
  setActiveConfig(resolved.config);
  applyTheme(resolved.config);
  ensureSeedData();
  renderLogo(qs('logo-mark'));
  applyLabels(resolved.config);
  ['nav-search', 'nav-dashboard'].forEach(id => {
    const legacyNav = qs(id);
    if(legacyNav){
      legacyNav.hidden = true;
      legacyNav.style.display = 'none';
    }
  });
  wireEvents();
  clearEntityForm();
  clearDocumentForm();
  clearPlanForm();
  clearCriterionForm();
  clearChecklistForm();
  clearNcForm();
  clearCapaForm();
  clearCapaManagerForm();
  clearQualityDocumentForm();
  resetInspectionForm();
  const role = currentQualityRole();
  ['quality-role', 'quality-settings-role'].forEach(id => {
    const select = qs(id);
    if(select) select.value = role;
  });
  syncRoleIndicator(role);
  showQuality('quality-dashboard');
  applyQualityPermissions(document);
}

export async function boot(overrideConfig){
  const resolved = overrideConfig !== undefined ? normalizeConfig(overrideConfig) : await loadModuleConfig();
  initApp(resolved);
}
