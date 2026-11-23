import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadCollection } from '../../src/storage.js';
import { bootQualityApp, qs } from '../support/quality-dom.js';

let dom;

function openDocuments(){
  qs('nav-quality-documents').click();
}

function change(id, value, eventName = 'change'){
  const control = qs(id);
  control.value = value;
  control.dispatchEvent(new dom.window.Event(eventName, { bubbles: true }));
}

beforeEach(async () => {
  dom = await bootQualityApp();
});

afterEach(() => {
  dom.window.close();
});

describe('Quality documents administrator', () => {
  it('renders summary cards, category tabs and the requested table columns', () => {
    openDocuments();

    expect(qs('docm-view-heading').textContent).toBe('Documentación');
    expect(document.querySelector('#view-quality-documents').hidden).toBe(false);
    expect(qs('docm-create').textContent).toContain('Subir documento');
    expect(qs('docm-summary').textContent).toContain('Total de documentos');
    expect(qs('docm-summary').textContent).toContain('Manuales');
    expect(qs('docm-summary').textContent).toContain('Procedimientos');
    expect(qs('docm-summary').textContent).toContain('Certificados');
    expect(qs('docm-summary').textContent).toContain('Pendientes de revisión');
    expect(qs('docm-categories').textContent).toContain('Manuales de calidad');
    expect(qs('docm-categories').textContent).toContain('Especificaciones técnicas');
    const headers = [...document.querySelectorAll('#docm-list thead th')].map(th => th.textContent.trim());
    expect(headers).toEqual([
      'Nombre del documento', 'Categoría', 'Tipo de archivo', 'Fecha de carga',
      'Responsable', 'Estado', 'Acciones'
    ]);
    expect(qs('docm-rows').children.length).toBe(6);
    expect(qs('docm-result-count').textContent).toBe('6 de 6 documentos');
    expect(qs('docm-list').textContent).toContain('Manual de calidad');
    expect(qs('docm-list').textContent).toContain('Pendiente de revisión');
  });

  it('uploads a file, stores its content and opens a downloadable preview', async () => {
    const clickSpy = vi.spyOn(dom.window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    openDocuments();
    qs('docm-create').click();
    expect(qs('docm-form-card').hidden).toBe(false);

    qs('docm-name').value = 'Certificado de pesaje';
    qs('docm-category').value = 'certificate';
    qs('docm-description').value = 'Certificado vigente de la báscula';
    qs('docm-responsible').value = 'emp-004';
    qs('docm-status').value = 'approved';
    const file = new dom.window.File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'pesaje.png', { type: 'image/png' });
    Object.defineProperty(qs('docm-file'), 'files', { value: [file], configurable: true });
    qs('docm-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(qs('docm-preview-card').hidden).toBe(false);
    });
    const docs = loadCollection('quality_documents');
    expect(docs.length).toBe(7);
    const created = docs.find(doc => doc.name === 'Certificado de pesaje');
    expect(created.category).toBe('certificate');
    expect(created.status).toBe('approved');
    expect(created.file_name).toBe('pesaje.png');
    expect(created.data_url.startsWith('data:image/png;base64,')).toBe(true);
    expect(qs('docm-preview-heading').textContent).toBe('Certificado de pesaje');
    expect(qs('docm-preview-body').textContent).toContain('Aprobado');
    expect(qs('docm-preview-body').textContent).toContain('PNG');
    qs('docm-preview-download').click();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('filters by category and search text', () => {
    openDocuments();
    change('docm-category-filter', 'certificate');
    expect(qs('docm-rows').children.length).toBe(1);
    expect(qs('docm-list').textContent).toContain('Certificado de calibración');
    expect(qs('docm-categories').querySelector('.docm-category-chip.is-active').dataset.docmCategory).toBe('certificate');

    change('docm-category-filter', '');
    change('docm-search', 'harina', 'input');
    expect(qs('docm-rows').children.length).toBe(1);
    expect(qs('docm-list').textContent).toContain('Especificación de harina');
    expect(qs('docm-result-count').textContent).toBe('1 de 6 documentos');
  });

  it('restricts deletion by role and supports metadata editing without replacing the file', () => {
    openDocuments();
    localStorage.setItem('erp_quality:viewer_role', 'inspector');
    change('docm-search', '', 'input');
    const deleteButtons = [...document.querySelectorAll('#docm-rows button[data-docm-delete]')];
    expect(deleteButtons.length).toBe(6);
    expect(deleteButtons.every(button => button.disabled)).toBe(true);
    expect(qs('docm-permission-hint').textContent).toContain('restringida');

    localStorage.setItem('erp_quality:viewer_role', 'jefe_calidad');
    change('docm-search', '', 'input');
    const firstEditButton = document.querySelector('#docm-rows button[data-docm-edit]');
    const original = loadCollection('quality_documents').find(doc => doc.id === firstEditButton.dataset.docmEdit);
    firstEditButton.click();
    expect(qs('docm-form-heading').textContent).toContain('Editar documento');
    qs('docm-name').value = 'Manual de calidad revisado';
    qs('docm-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

    const edited = loadCollection('quality_documents').find(doc => doc.id === original.id);
    expect(edited.name).toBe('Manual de calidad revisado');
    expect(edited.file_name).toBe(original.file_name);
    expect(edited.version).toBe(original.version + 1);

    const enabledDelete = document.querySelector('#docm-rows button[data-docm-delete]:not([disabled])');
    expect(enabledDelete).not.toBeNull();
    enabledDelete.click();
    expect(loadCollection('quality_documents').length).toBe(5);
  });
});
