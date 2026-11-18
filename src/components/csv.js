export function csvEscape(value){
  const text = String(value ?? '');
  if(/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function rowsToCsv(rows){
  return (rows || []).map(row => row.map(csvEscape).join(',')).join('\n');
}

export function safeFilenamePart(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function downloadContent(content, filename, mime = 'text/csv;charset=utf-8'){
  const blob = new Blob([content], { type: mime });
  const canObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const url = canObjectUrl ? URL.createObjectURL(blob) : `data:${mime},${encodeURIComponent(content)}`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  if(canObjectUrl && typeof URL.revokeObjectURL === 'function'){
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return filename;
}
