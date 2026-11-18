import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const html = fs.readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

export function qs(id){ return document.getElementById(id); }

export async function bootQualityApp(){
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.localStorage = w.localStorage;
  globalThis.FileReader = w.FileReader;
  globalThis.File = w.File;
  globalThis.alert = vi.fn();
  globalThis.confirm = vi.fn(() => true);
  w.scrollTo = vi.fn();
  w.localStorage.clear();
  vi.resetModules();
  const { boot } = await import('../../src/app.js');
  await boot();
  return dom;
}

export function submit(windowRef, formId){
  const form = document.getElementById(formId);
  form.dispatchEvent(new windowRef.Event('submit', { bubbles: true, cancelable: true }));
}
