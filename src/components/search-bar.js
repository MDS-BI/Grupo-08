import { getConfig } from '../module-config.js';
import { initQualityEntities } from './entity-list.js';

let lastTerm = '';

function ensureBrowserEventCompatibility(){
  if(typeof window !== 'undefined' && window.CustomEvent && globalThis.CustomEvent !== window.CustomEvent){
    globalThis.CustomEvent = window.CustomEvent;
  }
}

function normalizeTerm(term){
  return String(term ?? '').trim().toLowerCase();
}

function visibleFields(){
  const custom = typeof getConfig === 'function'
    ? (getConfig()?.customFields || []).filter(field => field.target === 'entity')
    : [];
  return ['name', 'code', 'category', 'targetDate', 'description', ...custom.map(field => field.key)];
}

export function visibleEntityText(entity){
  if(!entity || typeof entity !== 'object') return '';
  const parts = visibleFields()
    .filter(field => entity[field] !== undefined && entity[field] !== null && entity[field] !== '')
    .map(field => String(entity[field]));
  const custom = typeof getConfig === 'function'
    ? (getConfig()?.customFields || []).filter(field => field.target === 'entity')
    : [];
  custom.forEach(field => {
    if(entity[field.key] !== undefined && entity[field.key] !== null && entity[field.key] !== ''){
      parts.push(String(field.label));
    }
  });
  return parts.join(' ').toLowerCase();
}

export function matchesVisibleColumns(entity, term){
  const normalized = normalizeTerm(term);
  if(!normalized) return true;
  return visibleEntityText(entity).includes(normalized);
}

export function filterByVisibleColumns(entities, term){
  const list = Array.isArray(entities) ? entities : [];
  const normalized = normalizeTerm(term);
  if(!normalized) return list;
  return list.filter(entity => matchesVisibleColumns(entity, normalized));
}

function resolveTerm(listEl){
  if(listEl && listEl.dataset && listEl.dataset.searchTerm !== undefined) return listEl.dataset.searchTerm;
  if(typeof document !== 'undefined'){
    const input = document.getElementById('search-input');
    if(input && input.dataset && input.dataset.searchTerm !== undefined) return input.dataset.searchTerm;
  }
  return lastTerm;
}

function ensureLegacySearchNavigation(){
  if(typeof document === 'undefined') return;
  const root = document.documentElement || document.body;
  if(!root || root.dataset.searchNavigationWired === 'true') return;
  if(root.dataset) root.dataset.searchNavigationWired = 'true';
  document.addEventListener('click', event => {
    if(!event.target || typeof event.target.closest !== 'function') return;
    if(!event.target.closest('#nav-search, [data-module="search"]')) return;
    const view = document.getElementById('view-search');
    if(view) view.hidden = false;
    document.querySelectorAll('.quality-shell').forEach(section => { section.hidden = true; });
  });
}

export function setupSearchBar(inputEl, onInput){
  ensureBrowserEventCompatibility();
  initQualityEntities();
  ensureLegacySearchNavigation();
  if(!inputEl) return;
  inputEl.addEventListener('input', () => {
    const term = inputEl.value || '';
    lastTerm = term;
    inputEl.dataset.searchTerm = term;
    if(typeof document !== 'undefined'){
      ['search-results-list', 'quality-entity-list'].forEach(id => {
        const results = document.getElementById(id);
        if(results) results.dataset.searchTerm = term;
      });
    }
    if(typeof onInput === 'function') onInput(term);
  });
}

export function renderSearchResults(listEl, emptyEl, entities, renderItem){
  if(!listEl) return;
  const visible = filterByVisibleColumns(entities, resolveTerm(listEl));
  listEl.innerHTML = '';
  if(!visible.length){
    if(emptyEl) emptyEl.hidden = false;
    return;
  }
  if(emptyEl) emptyEl.hidden = true;
  for(const entity of visible) listEl.appendChild(renderItem(entity));
}
