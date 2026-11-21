import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureSeedData,
  addAlertRule,
  updateAlertRule,
  deleteAlertRule,
  deriveAlerts,
  loadCollection
} from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;

function rule(overrides = {}){
  return {
    metric: 'approval_rate',
    operator: 'lt',
    threshold: 80,
    severity: 'warning',
    ...overrides
  };
}

beforeEach(async () => {
  dom = await bootQualityApp();
  ensureSeedData();
});

afterEach(() => {
  dom.window.close();
});

describe('User Story 9 - quality alerts', () => {
  it('validates catalogs, ranges and duplicate active rules', () => {
    expect(() => addAlertRule(rule({ metric: 'unknown' }))).toThrow('indicador');
    expect(() => addAlertRule(rule({ operator: 'ne' }))).toThrow('operador');
    expect(() => addAlertRule(rule({ severity: 'fatal' }))).toThrow('severidad');
    expect(() => addAlertRule(rule({ threshold: 101 }))).toThrow('0 y 100');
    expect(() => addAlertRule(rule({ metric: 'open_non_conformances', threshold: -1 }))).toThrow('mayor o igual');

    addAlertRule(rule());
    expect(() => addAlertRule(rule({ threshold: 90 }))).toThrow('Ya existe');
    expect(() => addAlertRule(rule({ threshold: 90, is_active: false }))).not.toThrow();
  });

  it('derives alerts only for active rules whose threshold is violated', () => {
    const active = addAlertRule(rule());
    const inactive = addAlertRule(rule({ metric: 'overdue_capa', operator: 'gte', threshold: 1, is_active: false }));
    const alerts = deriveAlerts({
      approval_rate: 70,
      open_non_conformances: 0,
      overdue_capa: 3,
      capa_effectiveness: 100,
      pending_inspections: 0
    }, [active, inactive]);

    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_rule_id).toBe(active.alert_rule_id);
    expect(alerts[0].value).toBe(70);
    expect(deriveAlerts({ approval_rate: 80 }, [active])).toEqual([]);
  });

  it('shows violated rules and persists inactive rules in the dashboard', () => {
    addAlertRule(rule({ severity: 'critical' }));
    qs('nav-quality-dashboard').click();

    expect(qs('quality-alerts').textContent).toContain('Tasa de aprobación');
    expect(qs('quality-alerts').textContent).toContain('0 < 80');
    expect(qs('alert-rule-list').textContent).toContain('Crítica');

    const stored = loadCollection('quality_alert_rules')[0];
    expect(() => updateAlertRule(stored.id, { is_active: false })).not.toThrow();
    expect(loadCollection('quality_alert_rules')[0].is_active).toBe(false);
    qs('nav-quality-dashboard').click();
    expect(qs('quality-alerts').textContent).toContain('Sin alertas');
  });

  it('creates, toggles and deletes rules from the dashboard form', () => {
    qs('nav-quality-dashboard').click();
    qs('alert-metric').value = 'open_non_conformances';
    qs('alert-operator').value = 'gte';
    qs('alert-threshold').value = '1';
    qs('alert-severity').value = 'warning';
    qs('alert-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    const stored = loadCollection('quality_alert_rules');
    expect(stored.length).toBe(1);
    expect(stored[0].metric).toBe('open_non_conformances');

    const toggle = qs('alert-rule-list').querySelector('button[data-alert-toggle]');
    toggle.click();
    expect(loadCollection('quality_alert_rules')[0].is_active).toBe(false);

    const remove = qs('alert-rule-list').querySelector('button[data-alert-delete]');
    remove.click();
    expect(loadCollection('quality_alert_rules').length).toBe(0);
  });

  it('rejects an out-of-range form value without persisting it', () => {
    qs('nav-quality-dashboard').click();
    qs('alert-threshold').value = '150';
    qs('alert-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    expect(qs('alert-error').textContent).toContain('0 y 100');
    expect(loadCollection('quality_alert_rules').length).toBe(0);
  });
});
