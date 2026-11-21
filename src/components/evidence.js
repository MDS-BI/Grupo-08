import { addEvidence } from '../storage.js';
import { employeeName, actionButton } from './quality-utils.js';

export function formatFileSize(bytes){
  const size = Number(bytes) || 0;
  if(size >= 1024 * 1024) return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
  if(size >= 1024) return `${Math.round((size / 1024) * 10) / 10} KB`;
  return `${size} B`;
}

export function renderEvidenceList(container, records, maps, options = {}){
  if(!container) return;
  container.innerHTML = '';
  const list = Array.isArray(records) ? records : [];
  if(list.length === 0){
    container.className = 'empty';
    container.textContent = options.emptyMessage || 'Sin evidencia adjunta.';
    return;
  }
  container.className = 'evidence-list';
  list.forEach(record => {
    const item = document.createElement('div');
    item.className = 'evidence-item';

    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = record.file_name;
    info.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = `${formatFileSize(record.size_bytes)} · ${employeeName(maps, record.uploaded_by)} · ${String(record.uploaded_at || '').slice(0, 10)}`;
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'table-actions';
    if(options.allowDownload !== false){
      actions.appendChild(actionButton('Descargar', 'secondary', { evidenceDownload: record.id }));
    }
    if(options.allowDelete !== false){
      actions.appendChild(actionButton('Eliminar', 'danger', { evidenceDelete: record.id }));
    }
    item.appendChild(actions);
    container.appendChild(item);
  });
}

export function downloadEvidence(record){
  if(!record || !record.data_url) throw new Error('La evidencia no tiene contenido descargable');
  const link = document.createElement('a');
  link.href = record.data_url;
  link.download = record.file_name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return record.file_name;
}

export function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    if(!file) {
      reject(new Error('Selecciona un archivo de evidencia'));
      return;
    }
    const Reader = typeof FileReader !== 'undefined'
      ? FileReader
      : (typeof window !== 'undefined' ? window.FileReader : null);
    if(Reader){
      const reader = new Reader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado'));
      reader.readAsDataURL(file);
      return;
    }
    if(typeof file.arrayBuffer !== 'function'){
      reject(new Error('No se pudo leer el archivo seleccionado'));
      return;
    }
    file.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach(byte => { binary += String.fromCharCode(byte); });
      const encode = typeof btoa === 'function' ? btoa : (typeof window !== 'undefined' ? window.btoa : null);
      if(!encode) throw new Error('No se pudo leer el archivo seleccionado');
      resolve(`data:${file.type || 'application/octet-stream'};base64,${encode(binary)}`);
    }).catch(() => reject(new Error('No se pudo leer el archivo seleccionado')));
  });
}

export async function addEvidenceFromFile({ entityType, entityId, file, uploadedBy }){
  const dataUrl = await readFileAsDataUrl(file);
  return addEvidence({
    entity_type: entityType,
    entity_id: entityId,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    data_url: dataUrl,
    uploaded_by: uploadedBy
  });
}
