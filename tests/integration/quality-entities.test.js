import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;

beforeEach(async () => {
  dom = await bootQualityApp();
});

afterEach(() => {
  dom.window.close();
});

describe('Quality entities reference workspace', () => {
  it('shows loaded products, employees and origins as read-only records', () => {
    qs('quality-entities').click();
    expect(qs('view-entities').hidden).toBe(false);
    expect(qs('quality-entities-readonly').hidden).toBe(false);
    document.querySelectorAll('#view-entities .entity-write').forEach(section => {
      expect(section.hidden).toBe(true);
    });
    const text = qs('quality-entity-list').textContent;
    expect(text).toContain('Harina de trigo');
    expect(text).toContain('Ana Torres');
    expect(text).toContain('gr-001');
    expect(qs('quality-entity-list').querySelectorAll('tr[data-quality-entity-row]').length).toBeGreaterThan(0);
  });

  it('searches the visible master records case-insensitively', () => {
    qs('quality-entities').click();
    const input = qs('quality-entity-search');
    input.value = 'ana';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const rows = [...qs('quality-entity-list').querySelectorAll('tr[data-quality-entity-row]')];
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Ana Torres');
  });

  it('shows an empty state when no master record matches', () => {
    qs('quality-entities').click();
    const input = qs('quality-entity-search');
    input.value = 'no-existe';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(qs('quality-entity-list').textContent).toContain('Ningún maestro coincide');
  });
});
