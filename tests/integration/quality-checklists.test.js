import { describe, it, expect } from 'vitest';
import { bootQualityApp, qs } from '../support/quality-dom.js';

describe('Listas de verificación', () => {
  it('muestra plantillas con nombre, categoría, criterios, fecha, estado y acciones', async () => {
    await bootQualityApp();
    qs('nav-quality-checklists').click();
    expect(qs('view-quality-checklists').hidden).toBe(false);
    const cards = qs('checklist-cards').querySelectorAll('.checklist-card');
    expect(cards).toHaveLength(3);
    const text = cards[0].textContent;
    expect(text).toContain('Recepción de materias primas');
    expect(text).toContain('Recepción');
    expect(text).toContain('4 criterios');
    expect(text).toContain('Activo');
    expect(cards[0].querySelector('button[data-checklist-view]')).not.toBeNull();
    expect(cards[0].querySelector('button[data-checklist-edit]')).not.toBeNull();
    expect(cards[0].querySelector('button[data-checklist-delete]')).not.toBeNull();
  });

  it('crea una plantilla con criterios y la muestra en el panel', async () => {
    await bootQualityApp();
    qs('nav-quality-checklists').click();
    qs('checklist-create').click();
    expect(qs('checklist-editor-panel').hidden).toBe(false);
    qs('checklist-name').value = 'Control de prueba';
    qs('checklist-category').value = 'Seguridad';
    qs('checklist-description').value = 'Verificación de prueba';
    qs('criterion-name').value = 'Extintores';
    qs('criterion-description').value = 'Cargados y vigentes';
    qs('criterion-critical').checked = true;
    qs('criterion-add').click();
    expect(qs('criterion-draft-list').querySelectorAll('.criterion-item')).toHaveLength(1);
    qs('checklist-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    expect(qs('checklist-editor-panel').hidden).toBe(true);
    expect(qs('checklist-cards').textContent).toContain('Control de prueba');
    expect(qs('checklist-summary').textContent).toContain('Plantillas activas');
  });

  it('registra una evaluación con resultados y observaciones', async () => {
    await bootQualityApp();
    qs('nav-quality-checklists').click();
    qs('checklist-cards').querySelector('button[data-checklist-evaluate]').click();
    expect(qs('checklist-evaluation-save').disabled).toBe(true);
    const radios = qs('checklist-detail-body').querySelectorAll('input[type="radio"]');
    [0, 3, 6, 9].forEach(index => {
      radios[index].checked = true;
      radios[index].dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    const observations = qs('checklist-detail-body').querySelectorAll('textarea');
    observations[0].value = 'Todo correcto';
    observations[0].dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(qs('checklist-eval-pass').textContent).toBe('4');
    expect(qs('checklist-evaluation-save').disabled).toBe(false);
    qs('checklist-evaluation-save').click();
    expect(qs('checklist-detail-body').textContent).toContain('Última evaluación');
    expect(qs('checklist-detail-body').textContent).toContain('Todo correcto');
  });
});
