export const ROLES = Object.freeze(['jefe_calidad', 'inspector', 'gerente']);

export const PERMISSION_DENIED = 'PERMISSION_DENIED';

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
  notice.textContent = `No tienes permiso para realizar esta acción: ${action}.`;
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
      control.removeAttribute('aria-disabled');
      control.removeAttribute('title');
      if('disabled' in control) control.disabled = false;
      return;
    }
    if('disabled' in control) control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    control.setAttribute('title', `Permiso requerido: ${action}`);
    control.dataset.permissionDenied = 'true';
    control.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showPermissionMessage(action);
    }, { once: true });
  });
}
