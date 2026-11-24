import { describe, it, expect } from 'vitest';
import {
  bootQualityApp,
  clickNav,
  activeView,
  ariaCurrent,
  headingText,
  primaryAction,
  keyColumns,
  focusVisible,
  hasHorizontalOverflow,
  applyFilters,
  qs
} from '../support/quality-dom.js';

const ROLES = ['jefe_calidad', 'inspector', 'gerente'];
const WIDTHS = [1024, 768, 360];
const CATEGORIES = ['GENERAL', 'GESTIÓN DE CALIDAD', 'DOCUMENTACIÓN', 'ANÁLISIS', 'ADMINISTRACIÓN'];
const CANONICAL_NAV = [
  'quality-dashboard',
  'quality-search',
  'quality-entities',
  'quality-plans',
  'quality-checklists',
  'quality-inspections',
  'quality-non-conformances',
  'quality-capa',
  'quality-approvals',
  'quality-documents',
  'quality-reports',
  'quality-settings'
];
const SCREENS = [
  ...CANONICAL_NAV,
  'pending-lots',
  'quality-history',
  'quality-audit-log'
];
const TABLE_SCREENS = new Set([
  'quality-plans',
  'quality-inspections',
  'quality-non-conformances',
  'quality-capa',
  'quality-documents',
  'pending-lots',
  'quality-history',
  'quality-audit-log'
]);

describe('US15 quality visual matrix', () => {
  it('renders the exact five-category, twelve-entry quality menu', async () => {
    const dom = await bootQualityApp({ role: 'jefe_calidad', width: 1024 });
    try {
      const categories = [...document.querySelectorAll('.quality-category')].map(el => el.textContent.trim());
      const navIds = [...document.querySelectorAll('.nav-quality')].map(el => el.dataset.quality);
      expect(categories).toEqual(CATEGORIES);
      expect(navIds).toEqual(CANONICAL_NAV);
      expect(document.querySelectorAll('.nav-related').length).toBe(3);
    } finally {
      dom.window.close();
    }
  });

  it('renders every screen for every role and breakpoint without overflow', async () => {
    for(const role of ROLES){
      for(const width of WIDTHS){
        const dom = await bootQualityApp({ role, width });
        try {
          for(const screen of SCREENS){
            clickNav(screen);
            const view = activeView();
            expect(view, `${screen}/${role}/${width}: view`).not.toBeNull();
            expect(headingText(), `${screen}/${role}/${width}: heading`).not.toBe('');
            expect(ariaCurrent(), `${screen}/${role}/${width}: current nav`).toBe(screen);
            expect(primaryAction(), `${screen}/${role}/${width}: primary action`).not.toBeNull();
            expect(focusVisible(), `${screen}/${role}/${width}: focus ring`).toBe(true);
            expect(hasHorizontalOverflow(), `${screen}/${role}/${width}: overflow`).toBe(false);
            if(TABLE_SCREENS.has(screen)){
              const visibleEmpty = [...view.querySelectorAll('.empty')].some(empty => !empty.hidden && empty.textContent.trim());
              if(!visibleEmpty) expect(keyColumns().length, `${screen}/${role}/${width}: key columns`).toBeGreaterThan(0);
            }
            document.querySelectorAll(`${view.id} .empty`).forEach(empty => {
              expect(empty.textContent.trim()).not.toBe('');
            });
          }
        } finally {
          dom.window.close();
        }
      }
    }
  }, 60000);

  it('keeps the dashboard matrix and status legend available to all roles', async () => {
    for(const role of ROLES){
      const dom = await bootQualityApp({ role, width: 1024 });
      try {
        clickNav('quality-dashboard');
        expect(qs('quality-welcome').textContent).not.toBe('');
        expect(qs('quality-active-role').textContent).not.toBe('');
        expect(qs('kpi-final-inspections').textContent).not.toBe('');
        expect(qs('kpi-pending-capa').textContent).not.toBe('');
        expect(qs('kpi-pending-documents').textContent).not.toBe('');
        expect(qs('quality-status-legend').children.length).toBeGreaterThan(0);
        expect(qs('quality-summary-approvals')).not.toBeNull();
        expect(qs('quality-recent-activity').textContent.trim()).not.toBe('');
        expect(qs('quality-quick-actions').textContent.trim()).not.toBe('');
      } finally {
        dom.window.close();
      }
    }
  });

  it('applies queue filters and status labels without changing the active view', async () => {
    const dom = await bootQualityApp({ role: 'jefe_calidad', width: 768 });
    try {
      clickNav('quality-approvals');
      applyFilters({ 'approval-type-filter': 'plans', 'approval-search': 'plan' });
      expect(qs('approval-result-count').textContent).toContain('visible');
      expect(qs('queue-checklists').closest('[data-queue-section]').hidden).toBe(true);
      expect(activeView().dataset.qualityView).toBe('quality-approvals');
      expect(qs('quality-status-legend').textContent).toContain('Pendiente');
      expect(qs('quality-status-legend').textContent).toContain('Aprobado');
    } finally {
      dom.window.close();
    }
  });
});
