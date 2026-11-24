export const ROLES = Object.freeze(['jefe_calidad', 'inspector', 'gerente']);

export const PERMISSION_DENIED = 'PERMISSION_DENIED';

const PERMISSION_LABELS = Object.freeze({
  view_dashboard: 'Ver el panel',
  view_reports: 'Ver reportes',
  export_reports: 'Exportar reportes',
  view_history: 'Ver historial',
  view_history_detail: 'Ver detalle del historial',
  view_own_inspection_result: 'Ver el resultado de la inspección',
  export_history: 'Exportar historial',
  view_audit: 'Ver la bitácora',
  view_approval_queues: 'Ver bandejas de aprobación',
  manage_plan: 'Gestionar planes de inspección',
  submit_plan: 'Enviar planes a aprobación',
  approve_plan: 'Aprobar planes de inspección',
  reject_plan: 'Rechazar planes de inspección',
  delete_plan: 'Eliminar planes de inspección',
  version_plan: 'Versionar planes de inspección',
  manage_checklist: 'Gestionar listas de verificación',
  submit_checklist: 'Enviar listas a aprobación',
  approve_checklist: 'Aprobar listas de verificación',
  reject_checklist: 'Rechazar listas de verificación',
  delete_checklist: 'Eliminar listas de verificación',
  version_checklist: 'Versionar listas de verificación',
  create_document: 'Crear documentos',
  edit_document: 'Editar documentos',
  submit_document: 'Enviar documentos a revisión',
  approve_document: 'Aprobar documentos',
  reject_document: 'Rechazar documentos',
  delete_document: 'Eliminar documentos',
  version_document: 'Versionar documentos',
  execute_inspection: 'Ejecutar inspecciones',
  submit_inspection: 'Enviar inspecciones a revisión',
  review_inspection: 'Emitir el dictamen final',
  override_inspection: 'Modificar un dictamen final',
  attach_evidence: 'Adjuntar evidencia',
  delete_evidence: 'Eliminar evidencia',
  create_non_conformance: 'Registrar no conformidades',
  edit_non_conformance: 'Editar no conformidades',
  close_non_conformance: 'Cerrar no conformidades',
  delete_non_conformance: 'Eliminar no conformidades',
  propose_capa: 'Proponer acciones CAPA',
  edit_capa: 'Editar acciones CAPA',
  complete_capa: 'Completar acciones CAPA',
  request_capa_closure: 'Solicitar cierre de CAPA',
  review_capa_closure: 'Revisar cierre de CAPA',
  register_effectiveness: 'Registrar eficacia CAPA',
  configure_alerts: 'Configurar alertas',
  delete_records: 'Eliminar registros',
  clear_data: 'Limpiar datos'
});

const permissionBlockers = new WeakMap();

function lowerFirst(text){
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function permissionLabel(action){
  return PERMISSION_LABELS[action] || 'Realizar esta acción';
}

const J = 'jefe_calidad';
const I = 'inspector';
const G = 'gerente';

function value(context, ...keys){
  for(const key of keys){
    if(context && context[key] !== undefined) return context[key];
  }
  return undefined;
}

function hasCriteria(context){
  const count = value(context, 'criteriaCount', 'criteria_count', 'totalCriteria');
  return count === undefined || Number(count) > 0;
}

function hasHistory(context){
  return Boolean(value(context, 'hasHistory', 'has_history', 'isLocked', 'is_locked'));
}

function isDraft(context){
  const status = value(context, 'status', 'documentStatus', 'planStatus', 'checklistStatus');
  return status === undefined || status === 'draft' || status === 'rejected';
}

function isPendingStatus(context, pending){
  const status = value(context, 'status', 'documentStatus', 'planStatus', 'checklistStatus');
  return status === undefined || status === pending;
}

function isPendingApproval(context){
  return isPendingStatus(context, 'pending_approval');
}

function isPendingReview(context){
  return isPendingStatus(context, 'pending_review') || value(context, 'legacyReview') === true;
}

function isEditableDocument(context){
  const status = value(context, 'status', 'documentStatus');
  if(status === undefined) return true;
  if(status === 'approved' || status === 'archived') return false;
  return value(context, 'role') !== I || status === 'draft' || status === 'rejected';
}

function isDeletableDocument(context){
  const status = value(context, 'status', 'documentStatus');
  if(status === undefined) return true;
  if(hasHistory(context)) return false;
  if(value(context, 'role') === I) return status === 'draft' || status === 'rejected';
  return status !== 'approved';
}

function isOwnerOrChief(context){
  if(value(context, 'role') === J) return true;
  if(value(context, 'isOwner', 'ownedByRole') === true) return true;
  return value(context, 'isOwner', 'ownedByRole') === undefined;
}

function isExecutableInspection(context){
  const planStatus = value(context, 'planStatus');
  const checklistStatus = value(context, 'checklistStatus');
  if(planStatus !== undefined && planStatus !== 'approved') return false;
  if(checklistStatus !== undefined && checklistStatus !== 'approved') return false;
  return true;
}

function isReviewableInspection(context){
  const status = value(context, 'inspectionStatus', 'status');
  const proposed = value(context, 'proposedResult', 'proposed_result');
  const decision = value(context, 'reviewDecision', 'review_decision');
  const legacy = value(context, 'isLegacy', 'legacyCompleted', 'legacy_completed');
  if(status === undefined) return true;
  if(status === 'pending_review') return true;
  return status === 'completed' && proposed === 'conditional' && (decision === null || decision === undefined) && legacy !== false;
}

function isReviewableCapa(context){
  const status = value(context, 'status');
  const closure = value(context, 'closureStatus', 'closure_status');
  if(closure !== undefined) return closure === 'pending';
  return status === undefined || status === 'completed';
}

function isInProgressCapa(context){
  const status = value(context, 'status');
  const closure = value(context, 'closureStatus', 'closure_status');
  return status === undefined || status === 'in_progress' || closure === 'rejected';
}

const MATRIX = Object.freeze({
  view_dashboard: { roles: [J, I, G] },
  view_reports: { roles: [J, I, G] },
  export_reports: { roles: [J, G] },
  view_history: { roles: [J, I, G] },
  view_history_detail: { roles: [J] },
  view_own_inspection_result: { roles: [J, I] },
  export_history: { roles: [J, G] },
  view_audit: { roles: [J, G] },
  view_approval_queues: { roles: [J] },
  manage_plan: { roles: [J] },
  submit_plan: { roles: [J], guard: c => hasCriteria(c) && isDraft(c) },
  approve_plan: { roles: [J], guard: isPendingApproval },
  reject_plan: { roles: [J], guard: isPendingApproval },
  delete_plan: { roles: [J], guard: c => !hasHistory(c) },
  version_plan: { roles: [J] },
  manage_checklist: { roles: [J] },
  submit_checklist: { roles: [J], guard: c => hasCriteria(c) && isDraft(c) },
  approve_checklist: { roles: [J], guard: isPendingApproval },
  reject_checklist: { roles: [J], guard: isPendingApproval },
  delete_checklist: { roles: [J], guard: c => !hasHistory(c) },
  version_checklist: { roles: [J] },
  create_document: { roles: [J, I] },
  edit_document: { roles: [J, I], guard: isEditableDocument },
  submit_document: { roles: [J, I], guard: c => isEditableDocument(c) && isDraft(c) },
  approve_document: { roles: [J], guard: isPendingReview },
  reject_document: { roles: [J], guard: isPendingReview },
  delete_document: { roles: [J, I], guard: isDeletableDocument },
  version_document: { roles: [J] },
  execute_inspection: { roles: [J, I], guard: isExecutableInspection },
  submit_inspection: { roles: [J, I], guard: c => isExecutableInspection(c) && isDraft(c) },
  review_inspection: { roles: [J], guard: isReviewableInspection },
  override_inspection: { roles: [J] },
  attach_evidence: { roles: [J, I] },
  delete_evidence: { roles: [J, I], guard: isOwnerOrChief },
  create_non_conformance: { roles: [J, I] },
  edit_non_conformance: { roles: [J, I] },
  close_non_conformance: { roles: [J, I] },
  delete_non_conformance: { roles: [J] },
  propose_capa: { roles: [J, I] },
  edit_capa: { roles: [J, I], guard: isInProgressCapa },
  complete_capa: { roles: [J, I] },
  request_capa_closure: { roles: [J, I], guard: c => value(c, 'status') === undefined || value(c, 'status') === 'completed' },
  review_capa_closure: { roles: [J], guard: isReviewableCapa },
  register_effectiveness: { roles: [J], guard: isReviewableCapa },
  configure_alerts: { roles: [J] },
  delete_records: { roles: [J, I] },
  clear_data: { roles: [J] }
});

function withRole(context, role){
  return { ...context, role };
}

export function can(role, action, context = {}){
  const rule = MATRIX[action];
  if(!rule || !ROLES.includes(role)) return false;
  if(!rule.roles.includes(role)) return false;
  return typeof rule.guard === 'function' ? Boolean(rule.guard(withRole(context, role))) : true;
}

export function assertCan(role, action, context = {}){
  if(can(role, action, context)) return;
  const error = new Error('No tienes permiso para realizar esta acción.');
  error.code = PERMISSION_DENIED;
  throw error;
}

export function permissionsFor(role){
  if(!ROLES.includes(role)) return [];
  return Object.keys(MATRIX).filter(action => can(role, action));
}

export function visibleActions(role, actions, context = {}){
  if(!Array.isArray(actions)) return [];
  return actions.filter(action => can(role, action, context));
}

export function showPermissionMessage(action){
  if(typeof document === 'undefined') return;
  const notice = document.createElement('div');
  notice.className = 'permission-notice';
  notice.setAttribute('role', 'status');
  notice.textContent = `No tienes permiso para ${lowerFirst(permissionLabel(action))}.`;
  notice.dataset.permission = action;
  const target = document.querySelector('main') || document.body;
  if(!target) return;
  const existing = target.querySelector('.permission-notice');
  if(existing) existing.remove();
  target.prepend(notice);
}

export function applyPermissionState(root, role, context = {}){
  if(!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-permission]').forEach(control => {
    const action = control.getAttribute('data-permission');
    const allowed = can(role, action, context);
    if(allowed){
      const blocker = permissionBlockers.get(control);
      if(blocker){
        control.removeEventListener('click', blocker);
        permissionBlockers.delete(control);
      }
      delete control.dataset.permissionDenied;
      control.removeAttribute('aria-disabled');
      control.removeAttribute('title');
      if('disabled' in control) control.disabled = false;
      return;
    }
    if('disabled' in control) control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    control.setAttribute('title', `Permiso requerido: ${permissionLabel(action)}`);
    control.dataset.permissionDenied = 'true';
    if(!permissionBlockers.has(control)){
      const blocker = event => {
        event.preventDefault();
        event.stopPropagation();
        showPermissionMessage(action);
      };
      permissionBlockers.set(control, blocker);
      control.addEventListener('click', blocker);
    }
  });
}
