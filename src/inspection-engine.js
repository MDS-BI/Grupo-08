// Motor puro de evaluación de inspecciones.
// No lee ni escribe localStorage ni modifica el DOM.

function compare(criterion, value){
  const expected = Number(criterion.expected_value);
  const tolerance = Number(criterion.tolerance) || 0;
  switch(criterion.comparison_type){
    case 'range':
      return expected - tolerance <= value && value <= expected + tolerance;
    case 'min':
      return value >= expected;
    case 'max':
      return value <= expected;
    case 'boolean':
      return value === expected;
    default:
      throw new Error(`Tipo de comparación no soportado: ${criterion.comparison_type}`);
  }
}

function toMeasurement(value){
  if(value === null || value === undefined) return { numeric: false, value: null };
  if(typeof value === 'boolean') return { numeric: false, value };
  if(typeof value === 'string' && value.trim() === '') return { numeric: false, value };
  const num = Number(value);
  if(!Number.isFinite(num)) return { numeric: false, value };
  return { numeric: true, value: num };
}

export function evaluateCriterion(criterion, measuredValue){
  const converted = toMeasurement(measuredValue);
  if(!converted.numeric) return null;
  return compare(criterion, converted.value);
}

export const REVIEW_DECISIONS = Object.freeze(['approved', 'approved_conditional', 'rejected']);

function isBlank(value){
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

function isFiniteNumber(value){
  if(value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
}

function reviewCriteria(options, inspection){
  if(Array.isArray(options.criteria)) return options.criteria;
  const planCriteria = options.plan && Array.isArray(options.plan.criteria)
    ? options.plan.criteria
    : (Array.isArray(inspection.criteria) ? inspection.criteria : []);
  const checklistCriteria = options.checklist && Array.isArray(options.checklist.criteria)
    ? options.checklist.criteria
    : (Array.isArray(inspection.checklist_criteria) ? inspection.checklist_criteria : []);
  return [...planCriteria, ...checklistCriteria];
}

function reviewResults(options, inspection){
  if(Array.isArray(options.results)) return options.results;
  return Array.isArray(inspection.results) ? inspection.results : [];
}

function measurementFlags(criteria, results){
  const byId = new Map();
  results.forEach(result => {
    if(result && result.criteria_id !== undefined) byId.set(result.criteria_id, result);
  });
  const missing = criteria.filter(criterion => {
    const result = byId.get(criterion.criteria_id);
    return !result || !isFiniteNumber(result.measured_value);
  });
  const criticalFailed = criteria.filter(criterion =>
    criterion.is_critical && byId.get(criterion.criteria_id) && byId.get(criterion.criteria_id).pass_fail === false
  );
  return {
    hasMissingMeasurements: missing.length > 0,
    hasCriticalFailures: criticalFailed.length > 0,
    missing_criteria_ids: missing.map(criterion => criterion.criteria_id),
    critical_failed_criteria_ids: criticalFailed.map(criterion => criterion.criteria_id)
  };
}

function resultForDecision(decision){
  if(decision === 'approved') return 'passed';
  if(decision === 'approved_conditional') return 'conditional';
  if(decision === 'rejected') return 'failed';
  return null;
}

function justificationRequired(decision, proposedResult){
  if(decision === 'rejected' || decision === 'approved_conditional') return true;
  return proposedResult !== undefined && proposedResult !== null && proposedResult !== resultForDecision(decision);
}

export function reviewInspection(inspection, decision, justification, reviewer, options = {}){
  if(!inspection) throw new Error('Inspección no encontrada');
  const sourceStatus = inspection.inspection_status || inspection.status;
  const proposedResult = inspection.proposed_result === undefined || inspection.proposed_result === null
    ? (inspection.proposedResult === undefined ? null : inspection.proposedResult)
    : inspection.proposed_result;
  const reviewDecision = inspection.review_decision === undefined ? inspection.reviewDecision : inspection.review_decision;
  const reviewable = sourceStatus === 'pending_review'
    || (sourceStatus === 'completed' && proposedResult === 'conditional' && (reviewDecision === null || reviewDecision === undefined));
  if(!reviewable) throw new Error('La acción no está disponible en el estado actual.');
  if(!REVIEW_DECISIONS.includes(decision)) throw new Error('Decisión de revisión no válida.');
  if(justificationRequired(decision, proposedResult) && isBlank(justification)){
    throw new Error('Registra la justificación para continuar.');
  }
  const flags = measurementFlags(reviewCriteria(options, inspection), reviewResults(options, inspection));
  const hasCriticalFailures = options.hasCriticalFailures === undefined ? flags.hasCriticalFailures : Boolean(options.hasCriticalFailures);
  const hasMissingMeasurements = options.hasMissingMeasurements === undefined ? flags.hasMissingMeasurements : Boolean(options.hasMissingMeasurements);
  if(decision !== 'rejected' && (hasCriticalFailures || hasMissingMeasurements)){
    throw new Error('No se puede aprobar con criterios críticos fallidos o mediciones faltantes.');
  }
  const now = options.now || new Date().toISOString();
  const reviewedBy = isBlank(reviewer) ? null : String(reviewer).trim();
  const reviewedJustification = isBlank(justification) ? null : String(justification).trim();
  const overallResult = resultForDecision(decision);
  return {
    ...inspection,
    inspection_status: 'completed',
    proposed_result: proposedResult,
    overall_result: overallResult,
    review_decision: decision,
    reviewed_by: reviewedBy,
    reviewed_at: now,
    review_justification: reviewedJustification,
    createNonConformance: decision === 'rejected',
    audit: {
      action: decision === 'rejected' ? 'reject' : 'approve',
      changed_field: 'overall_result',
      before_value: inspection.overall_result === undefined ? null : inspection.overall_result,
      after_value: {
        overall_result: overallResult,
        review_decision: decision,
        reviewed_by: reviewedBy,
        reviewed_at: now,
        review_justification: reviewedJustification,
        justification: reviewedJustification
      },
      actor: reviewedBy,
      timestamp: now
    }
  };
}

export function evaluateInspection(plan, measurements){
  if(!plan || !Array.isArray(plan.criteria)){
    throw new Error('Plan de inspección inválido: se requiere una lista de criterios');
  }
  const list = Array.isArray(measurements) ? measurements : [];
  const byCriteria = new Map();
  list.forEach(m => {
    if(m && m.criteria_id !== undefined) byCriteria.set(m.criteria_id, m);
  });

  const results = [];
  const missing = [];

  plan.criteria.forEach(criterion => {
    const measurement = byCriteria.get(criterion.criteria_id);
    const converted = toMeasurement(measurement ? measurement.measured_value : undefined);
    if(!converted.numeric){
      missing.push(criterion.criteria_id);
      results.push({
        criteria_id: criterion.criteria_id,
        measured_value: converted.value,
        pass_fail: null
      });
      return;
    }
    results.push({
      criteria_id: criterion.criteria_id,
      measured_value: converted.value,
      pass_fail: compare(criterion, converted.value)
    });
  });

  if(missing.length){
    return {
      status: 'incomplete',
      results,
      missing_criteria_ids: missing,
      overall_result: null
    };
  }

  const byId = new Map(plan.criteria.map(c => [c.criteria_id, c]));
  const criticalFailed = results.some(r => r.pass_fail === false && byId.get(r.criteria_id)?.is_critical);
  const anyFailed = results.some(r => r.pass_fail === false);

  return {
    status: 'complete',
    results,
    missing_criteria_ids: [],
    overall_result: criticalFailed ? 'failed' : anyFailed ? 'conditional' : 'passed'
  };
}
