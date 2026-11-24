import { loadDocuments, loadExternal, loadEntities, REFERENCE_MODULES } from '../storage.js';
import { labelFor, getConfig } from '../module-config.js';
import { createDocumentItem } from './document-list.js';

const ORIGIN_META = Object.freeze({
  goods_receipt: { label: 'Recepción', idKey: 'goods_receipt_id' },
  production_order: { label: 'Orden de producción', idKey: 'production_order_id' },
  shipment: { label: 'Envío', idKey: 'shipment_id' }
});

function escapeHtml(s){ return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

export function createEntityItem(entity){
  const li = document.createElement('li');
  li.className = 'entity-item';
  const custom = getConfig().customFields.filter(f => f.target === 'entity');
  const customBits = custom
    .filter(f => entity[f.key] !== undefined && entity[f.key] !== null)
    .map(f => ` &middot; ${escapeHtml(f.label)}: ${escapeHtml(String(entity[f.key]))}`)
    .join('');
  const meta = document.createElement('div');
  meta.className = 'entity-meta';
  meta.innerHTML = `<strong>${escapeHtml(entity.name)}</strong><div>${escapeHtml(entity.code)}${entity.category ? ' • ' + escapeHtml(entity.category) : ''}</div>` +
    `${entity.targetDate ? '<div class="muted">Fecha objetivo: ' + escapeHtml(entity.targetDate) + '</div>' : ''}` +
    `${entity.description ? '<div class="muted">' + escapeHtml(entity.description) + '</div>' : ''}` +
    (customBits ? `<div class="muted">${customBits}</div>` : '');;
  const docs = document.createElement('div');
  docs.className = 'entity-documents';
  renderDocumentsFor(entity, docs);
  li.appendChild(meta);
  li.appendChild(docs);
  return li;
}

export function renderDocumentsFor(entity, container){
  const documents = loadDocuments().filter(d => d.entity_id === entity.entity_id);
  const heading = document.createElement('div');
  heading.className = 'muted';
  heading.textContent = labelFor('documents') + ':';
  container.appendChild(heading);
  if(documents.length === 0){
    const none = document.createElement('div');
    none.className = 'muted';
    none.textContent = `Aún no hay ${labelFor('documents').toLowerCase()}.`;
    container.appendChild(none);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'document-list';
    for(const d of documents) ul.appendChild(createDocumentItem(d));
    container.appendChild(ul);
  }
}

export function renderEntityList(listEl, entities){
  listEl.innerHTML = '';
  if(!entities || entities.length === 0) return false;
  for(const e of entities) listEl.appendChild(createEntityItem(e));
  return true;
}

function safeExternal(name){
  try{
    const value = loadExternal(name);
    return Array.isArray(value) ? value : [];
  }catch{
    return [];
  }
}

function detailForProduct(item){
  return [item.product_id, item.standard_cost !== undefined ? `Costo ${item.standard_cost}` : ''].filter(Boolean).join(' · ');
}

function detailForEmployee(item){
  return [item.employee_id, item.role].filter(Boolean).join(' · ');
}

function detailForOrigin(item, module){
  const meta = ORIGIN_META[module] || { idKey: `${module}_id` };
  return [item[meta.idKey], item.product_id, item.date, item.supplier].filter(Boolean).join(' · ');
}

export function collectQualityEntities(){
  const records = [];
  loadEntities().forEach(item => {
    records.push({
      type: 'Entidad',
      name: item.name || item.code || '',
      detail: [item.code, item.category].filter(Boolean).join(' · ')
    });
  });
  safeExternal('products').forEach(item => {
    records.push({ type: 'Producto', name: item.name || item.product_id || '', detail: detailForProduct(item) });
  });
  safeExternal('employees').forEach(item => {
    records.push({ type: 'Empleado', name: item.name || item.employee_id || '', detail: detailForEmployee(item) });
  });
  (Array.isArray(REFERENCE_MODULES) && REFERENCE_MODULES.length ? REFERENCE_MODULES : Object.keys(ORIGIN_META)).forEach(module => {
    const meta = ORIGIN_META[module] || { label: module, idKey: `${module}_id` };
    safeExternal(module).forEach(item => {
      records.push({ type: meta.label, name: item[meta.idKey] || item.id || '', detail: detailForOrigin(item, module) });
    });
  });
  return records;
}

export function filterQualityEntities(records, term){
  const normalized = String(term ?? '').trim().toLowerCase();
  if(!normalized) return records;
  return records.filter(record =>
    `${record.type} ${record.name} ${record.detail}`.toLowerCase().includes(normalized)
  );
}

function renderQualityEntityTable(records){
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'data-table qc-table';
  table.setAttribute('aria-label', 'Maestros referenciados');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Tipo', 'Nombre', 'Detalle'].forEach(label => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  records.forEach(record => {
    const row = document.createElement('tr');
    row.dataset.qualityEntityRow = 'true';
    [record.type, record.name, record.detail || '—'].forEach(value => {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  return scroll;
}

export function renderQualityEntities(options = {}){
  const host = typeof document === 'undefined' ? null : document.getElementById(options.hostId || 'quality-entity-list');
  if(!host) return [];
  const input = document.getElementById(options.searchInputId || 'quality-entity-search');
  const term = options.term !== undefined ? options.term : (input ? input.value : '');
  const records = filterQualityEntities(collectQualityEntities(), term);
  host.replaceChildren();
  if(!records.length){
    host.className = 'empty';
    host.textContent = 'Ningún maestro coincide con la búsqueda.';
    return records;
  }
  host.className = '';
  host.appendChild(renderQualityEntityTable(records));
  return records;
}

export function initQualityEntities(){
  if(typeof document === 'undefined') return;
  const root = document.documentElement || document.body;
  if(root && root.dataset.qualityEntitiesWired !== 'true'){
    if(root.dataset) root.dataset.qualityEntitiesWired = 'true';
    document.addEventListener('quality:view-changed', event => {
      if(event && event.detail && event.detail.view === 'quality-entities') renderQualityEntities();
    });
    document.addEventListener('input', event => {
      if(event.target && event.target.id === 'quality-entity-search') renderQualityEntities();
    });
    document.addEventListener('click', event => {
      if(!event.target || typeof event.target.closest !== 'function') return;
      if(!event.target.closest('#nav-entities, [data-module="entities"]')) return;
      const view = document.getElementById('view-entities');
      if(view) view.hidden = false;
      document.querySelectorAll('.quality-shell').forEach(section => { section.hidden = true; });
      const readonly = document.getElementById('quality-entities-readonly');
      if(readonly) readonly.hidden = true;
      document.querySelectorAll('#view-entities .entity-write').forEach(section => { section.hidden = false; });
    });
  }
}
