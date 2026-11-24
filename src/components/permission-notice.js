export function renderPermissionNotice(action){
  const notice = document.createElement('div');
  notice.className = 'permission-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 18 18');
  icon.setAttribute('width', '18');
  icon.setAttribute('height', '18');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.8');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<circle cx="9" cy="9" r="6.5"></circle><path d="M9 6v3.5"></path><path d="M9 12v.1"></path>';
  notice.appendChild(icon);
  const text = document.createElement('span');
  text.textContent = action
    ? `Modo solo lectura. Permiso requerido: ${action}.`
    : 'Modo solo lectura.';
  notice.appendChild(text);
  if(action) notice.dataset.permission = action;
  return notice;
}

export function clearPermissionNotice(root){
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
  const notices = scope.querySelectorAll('.permission-notice');
  notices.forEach(notice => notice.remove());
  return notices.length;
}

export function showPermissionNotice(action, targetId){
  clearPermissionNotice();
  const notice = renderPermissionNotice(action);
  const target = targetId ? document.getElementById(targetId) : null;
  const container = target || document.querySelector('main') || document.body;
  if(container) container.prepend(notice);
  return notice;
}
