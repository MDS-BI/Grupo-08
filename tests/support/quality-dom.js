import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const html = fs.readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
const styles = [
  fs.readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8'),
  fs.readFileSync(fileURLToPath(new URL('../../src/quality-styles.css', import.meta.url)), 'utf8')
].join('\n');

const ROLE_KEY = 'erp_quality:viewer_role';

const NAV_IDS = Object.freeze({
  'pending-lots': 'nav-quality-lots',
  'quality-history': 'nav-quality-history',
  'quality-audit-log': 'nav-quality-audit'
});

export function qs(id){ return document.getElementById(id); }

export async function bootQualityApp(options = {}){
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.localStorage = w.localStorage;
  globalThis.FileReader = w.FileReader;
  globalThis.File = w.File;
  globalThis.CustomEvent = w.CustomEvent;
  globalThis.prompt = vi.fn(() => 'Justificación de prueba');
  globalThis.alert = vi.fn();
  globalThis.confirm = vi.fn(() => true);
  w.scrollTo = vi.fn();
  w.localStorage.clear();
  if(options.role) w.localStorage.setItem(ROLE_KEY, options.role);
  if(options.width) Object.defineProperty(w, 'innerWidth', { configurable: true, value: options.width });
  vi.resetModules();
  const { boot } = await import('../../src/app.js');
  await boot();
  return dom;
}

export async function mountQualityView(name, options = {}){
  const dom = await bootQualityApp(options);
  clickNav(name);
  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    view: activeView(),
    name
  };
}

export function clickNav(idOrView){
  const id = NAV_IDS[idOrView] || idOrView;
  const nav = qs(id) || document.querySelector(`[data-quality="${idOrView}"]`) || document.querySelector(`[data-related-quality="${idOrView}"]`);
  if(nav) nav.click();
  return nav;
}

export function activeView(){
  return document.querySelector('main [data-quality-view]:not([hidden])')
    || document.querySelector('main section:not([hidden])');
}

export function ariaCurrent(){
  const current = document.querySelector('[aria-current="page"]');
  return current ? (current.dataset.quality || current.dataset.relatedQuality || current.id || '') : '';
}

export function headingText(){
  const view = activeView();
  const heading = view ? view.querySelector('h1') : null;
  return heading ? heading.textContent.trim() : '';
}

export function primaryAction(){
  const view = activeView();
  if(!view) return null;
  return view.querySelector('button.primary:not([hidden]), button[type="submit"].primary:not([hidden])');
}

export function keyColumns(){
  const view = activeView();
  if(!view) return [];
  return [...view.querySelectorAll('thead th')].map(th => th.textContent.trim());
}

export function focusVisible(){
  const target = primaryAction() || activeView()?.querySelector('button, input, select, textarea, [tabindex]');
  if(!target) return false;
  target.focus();
  return /:focus-visible[\s\S]*outline:\s*2px[\s\S]*outline-offset:\s*2px/.test(styles);
}

export function hasHorizontalOverflow(){
  return document.documentElement.scrollWidth > window.innerWidth;
}

export function applyFilters(filters = {}){
  Object.entries(filters).forEach(([id, value]) => {
    const el = qs(id);
    if(!el) return;
    el.value = value;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.dispatchEvent(new window.Event(eventName, { bubbles: true }));
  });
}

export function clearFilters(ids = []){
  ids.forEach(id => {
    const el = qs(id);
    if(!el) return;
    el.value = '';
    el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

export function setRole(role){
  const select = qs('quality-role') || qs('quality-settings-role');
  if(!select) return;
  select.value = role;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  return role;
}

export function submit(windowRef, formId){
  const form = document.getElementById(formId);
  form.dispatchEvent(new windowRef.Event('submit', { bubbles: true, cancelable: true }));
}
