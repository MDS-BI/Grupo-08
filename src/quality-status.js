export const PLAN_STATUSES = Object.freeze(['draft', 'pending_approval', 'approved', 'rejected']);
export const CHECKLIST_STATUSES = Object.freeze(['draft', 'pending_approval', 'approved', 'rejected', 'archived']);
export const DOCUMENT_STATUSES = Object.freeze(['draft', 'pending_review', 'approved', 'rejected', 'archived']);
export const INSPECTION_STATUSES = Object.freeze(['draft', 'pending_review', 'completed']);
export const REVIEW_DECISIONS = Object.freeze(['approved', 'approved_conditional', 'rejected']);
export const FINAL_RESULTS = Object.freeze(['passed', 'conditional', 'failed']);
export const CAPA_CLOSURE_STATUSES = Object.freeze(['pending', 'approved', 'rejected']);
export const EFFECTIVENESS_RESULTS = Object.freeze(['effective', 'not_effective']);

const TRANSITIONS = Object.freeze({
  plan: Object.freeze({
    submit: Object.freeze({ from: ['draft', 'rejected'], to: 'pending_approval' }),
    approve: Object.freeze({ from: ['pending_approval'], to: 'approved' }),
    reject: Object.freeze({ from: ['pending_approval'], to: 'rejected' }),
    edit: Object.freeze({ from: ['draft', 'rejected'], to: 'draft' }),
    version: Object.freeze({ from: ['approved'], to: 'draft' })
  }),
  checklist: Object.freeze({
    submit: Object.freeze({ from: ['draft', 'rejected'], to: 'pending_approval' }),
    approve: Object.freeze({ from: ['pending_approval'], to: 'approved' }),
    reject: Object.freeze({ from: ['pending_approval'], to: 'rejected' }),
    edit: Object.freeze({ from: ['draft', 'rejected'], to: 'draft' }),
    version: Object.freeze({ from: ['approved'], to: 'draft' })
  }),
  document: Object.freeze({
    submit: Object.freeze({ from: ['draft', 'rejected'], to: 'pending_review' }),
    approve: Object.freeze({ from: ['pending_review'], to: 'approved' }),
    reject: Object.freeze({ from: ['pending_review'], to: 'rejected' }),
    edit: Object.freeze({ from: ['draft', 'rejected'], to: 'draft' }),
    version: Object.freeze({ from: ['approved'], to: 'draft' })
  }),
  inspection: Object.freeze({
    submit: Object.freeze({ from: ['draft'], to: 'pending_review' }),
    review: Object.freeze({ from: ['pending_review', 'completed'], to: 'completed' }),
    override: Object.freeze({ from: ['completed'], to: 'completed' })
  }),
  capaClosure: Object.freeze({
    request: Object.freeze({ from: ['completed'], to: 'completed' }),
    review: Object.freeze({ from: ['pending'], to: 'pending' }),
    approve: Object.freeze({ from: ['pending'], to: 'approved' }),
    reject: Object.freeze({ from: ['pending'], to: 'rejected' })
  })
});

export function statusesFor(entity){
  switch(entity){
    case 'plan': return PLAN_STATUSES;
    case 'checklist': return CHECKLIST_STATUSES;
    case 'document': return DOCUMENT_STATUSES;
    case 'inspection': return INSPECTION_STATUSES;
    case 'capaClosure': return CAPA_CLOSURE_STATUSES;
    default: return Object.freeze([]);
  }
}

export function transition(entity, action, from, context = {}){
  const rule = TRANSITIONS[entity] && TRANSITIONS[entity][action];
  if(!rule || !rule.from.includes(from)) return null;
  if(entity === 'inspection' && action === 'review' && from === 'completed' && !isLegacyConditionalInspection(context)){
    return null;
  }
  if((action === 'approve' || action === 'reject') && context.requiresJustification && !String(context.justification || '').trim()){
    return null;
  }
  if(entity === 'capaClosure' && action === 'approve' && !context.hasEffectiveness){
    return null;
  }
  return rule.to;
}

export function canTransition(entity, action, from, context = {}){
  return transition(entity, action, from, context) !== null;
}

export function isApproved(status){
  return status === 'approved';
}

export function isPendingApproval(status){
  return status === 'pending_approval';
}

export function isPendingReview(status){
  return status === 'pending_review' || status === 'under_review';
}

export function isPendingCapaClosure(action){
  return Boolean(action && action.status === 'completed' && action.closure_status === 'pending');
}

export function isLegacyConditionalInspection(inspection){
  if(!inspection) return false;
  const status = inspection.inspection_status || inspection.status;
  const proposed = inspection.proposed_result || inspection.proposedResult;
  const result = inspection.overall_result || inspection.overallResult;
  const decision = inspection.review_decision || inspection.reviewDecision;
  return status === 'completed' && decision === null && (proposed === 'conditional' || (proposed === undefined && result === 'conditional'));
}

export function isFinalLegacyInspection(inspection){
  if(!inspection) return false;
  const status = inspection.inspection_status || inspection.status;
  const decision = inspection.review_decision || inspection.reviewDecision;
  return status === 'completed' && decision === null && !isLegacyConditionalInspection(inspection);
}

export function isReviewableInspection(inspection){
  if(!inspection) return false;
  const status = inspection.inspection_status || inspection.status;
  return status === 'pending_review' || isLegacyConditionalInspection(inspection);
}

export function decisionResult(decision){
  switch(decision){
    case 'approved': return 'passed';
    case 'approved_conditional': return 'conditional';
    case 'rejected': return 'failed';
    default: return null;
  }
}

export function requiresJustification(decision, proposedResult){
  if(decision === 'rejected' || decision === 'approved_conditional') return true;
  return proposedResult !== undefined && proposedResult !== decisionResult(decision);
}

export function approvalRate(inspections){
  const eligible = inspections.filter(inspection => {
    const status = inspection.inspection_status || inspection.status;
    const result = inspection.overall_result || inspection.overallResult;
    return status === 'completed' && FINAL_RESULTS.includes(result);
  });
  if(!eligible.length) return 0;
  const passed = eligible.filter(inspection => (inspection.overall_result || inspection.overallResult) === 'passed').length;
  return Math.round((passed / eligible.length) * 1000) / 10;
}

export function capaEffectiveness(actions){
  const approved = actions.filter(action => action.closure_status === 'approved');
  if(!approved.length) return 0;
  const effective = approved.filter(action => action.effectiveness_result === 'effective').length;
  return Math.round((effective / approved.length) * 1000) / 10;
}
