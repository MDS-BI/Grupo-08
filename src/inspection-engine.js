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
