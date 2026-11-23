import {
  loadCollection,
  loadExternal,
  externalDocuments,
  planCriteria,
  addInspection,
  updateInspection,
  saveDraftInspection,
  completeInspection,
  validateInspection,
  evidenceFor,
  deleteEvidence,
  qualityCatalog,
  qualityParameter
} from '../storage.js';
import { evaluateInspection } from '../inspection-engine.js';
import {
  buildReferenceMaps,
  productName,
  planName,
  moduleLabel,
  stageLabel,
  resultLabel,
  statusLabel,
  todayIso,
  qs
} from './quality-utils.js';
import { addEvidenceFromFile, downloadEvidence, renderEvidenceList } from './evidence.js';

const INSPECTION_ERROR_FIELDS = {
  inspection_plan_id: 'error-inspection-plan',
  inspector_id: 'error-inspection-inspector',
  reference_module: 'error-inspection-module',
  reference_id: 'error-inspection-reference',
  inspection_date: 'error-inspection-date'
};

const STAGE_BY_MODULE = Object.freeze({
  goods_receipt: 'incoming',
  production_order: 'in_process',
  shipment: 'final'
});

function stageOptions(){
  return qualityCatalog('inspection_categories');
}

function preferredStage(module, keepCurrent = true){
  const options = stageOptions();
  const current = keepCurrent && qs('inspection-stage') ? qs('inspection-stage').value : '';
  if(current && options.some(item => item.key === current)) return current;
  const mapped = STAGE_BY_MODULE[module];
  if(mapped && options.some(item => item.key === mapped)) return mapped;
  const configured = qualityParameter('default_inspection_stage');
  if(configured && options.some(item => item.key === configured)) return configured;
  return options[0] ? options[0].key : '';
}

function referenceContext(referenceModule, referenceId){
  const module = referenceModule || (qs('inspection-module') ? qs('inspection-module').value : '') || 'goods_receipt';
  const reference = referenceId !== undefined
    ? referenceId
    : (qs('inspection-reference') ? qs('inspection-reference').value : '');
  const document = reference
    ? externalDocuments().find(doc => doc.reference_module === module && doc.reference_id === reference)
    : null;
  const stage = qs('inspection-stage') && qs('inspection-stage').value
    ? qs('inspection-stage').value
    : preferredStage(module);
  return { module, reference, productId: document ? document.product_id : '', stage };
}

function enabledPlans(context = {}){
  return loadCollection('quality_inspection_plans')
    .filter(plan => planCriteria(plan.inspection_plan_id).length > 0)
    .filter(plan => !context.productId || !context.stage
      || (plan.product_id === context.productId && plan.applicable_stage === context.stage));
}

function findResumableDrafts(referenceModule, referenceId, planId){
  return loadCollection('quality_inspections')
    .filter(inspection => inspection.inspection_status === 'draft'
      && inspection.reference_module === referenceModule
      && inspection.reference_id === referenceId
      && inspection.inspection_plan_id === planId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function resumeDraft(referenceModule, referenceId, planId){
  const drafts = findResumableDrafts(referenceModule, referenceId, planId);
  if(drafts.length === 0) return null;
  loadDraft(drafts[0]);
  const error = qs('inspection-error');
  if(error && drafts.length > 1){
    error.textContent = `Hay ${drafts.length} borradores para este lote y plan; se reanudó el más reciente.`;
    error.classList.add('info');
  }
  return drafts[0];
}

export function selectedPlan(explicitPlanId){
  const planId = explicitPlanId !== undefined
    ? explicitPlanId
    : (qs('inspection-plan') ? qs('inspection-plan').value : '');
  if(!planId) return null;
  const plan = loadCollection('quality_inspection_plans').find(p => p.inspection_plan_id === planId);
  if(!plan) return null;
  return { ...plan, criteria: planCriteria(planId) };
}

export function collectInspectionHeader(){
  return {
    inspection_plan_id: qs('inspection-plan').value,
    inspector_id: qs('inspection-inspector').value,
    reference_module: qs('inspection-module').value,
    reference_id: qs('inspection-reference').value,
    inspection_date: qs('inspection-date').value
  };
}

export function collectMeasurements(){
  const plan = selectedPlan();
  if(!plan) return [];
  return plan.criteria.map(criterion => {
    const input = document.querySelector(`#inspection-measurements [data-criteria-id="${criterion.criteria_id}"]`);
    return {
      criteria_id: criterion.criteria_id,
      measured_value: input ? input.value : ''
    };
  });
}

export function showInspectionErrors(errors = {}){
  Object.entries(INSPECTION_ERROR_FIELDS).forEach(([key, id]) => {
    const el = qs(id);
    if(el) el.textContent = errors[key] || '';
  });
}

export function clearInspectionErrors(){
  showInspectionErrors({});
  const error = qs('inspection-error');
  if(error) error.textContent = '';
  const moduleError = qs('error-inspection-module');
  if(moduleError) moduleError.textContent = '';
  const referenceError = qs('error-inspection-reference');
  if(referenceError) referenceError.textContent = '';
}

function populateSelect(select, records, valueKey, labelKey, blankLabel){
  if(!select) return;
  const prev = select.value;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = blankLabel;
  select.appendChild(blank);
  records.forEach(record => {
    const opt = document.createElement('option');
    opt.value = record[valueKey];
    opt.textContent = typeof labelKey === 'function' ? labelKey(record) : record[labelKey];
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

function populateStageSelect(){
  const select = qs('inspection-stage');
  if(!select) return;
  const module = qs('inspection-module') ? qs('inspection-module').value : 'goods_receipt';
  const previous = select.value || preferredStage(module, false);
  select.innerHTML = '';
  stageOptions().forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.key;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
  if(previous && [...select.options].some(opt => opt.value === previous)) select.value = previous;
}

export function renderReferenceOptions(module, selected){
  const select = qs('inspection-reference');
  if(!select) return;
  const maps = buildReferenceMaps();
  const docs = externalDocuments().filter(doc => doc.reference_module === module);
  const prev = selected !== undefined ? selected : select.value;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = docs.length ? '-- Selecciona el documento origen --' : '-- No hay documentos para este módulo --';
  select.appendChild(blank);
  docs.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = doc.reference_id;
    opt.textContent = `${doc.reference_id} · ${productName(maps, doc.product_id)} · ${doc.date || 's/f'}`;
    select.appendChild(opt);
  });
  if(prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

export function renderMeasurements(planId, existingResults = []){
  const container = qs('inspection-measurements');
  if(!container) return;
  container.innerHTML = '';
  const plan = planId ? selectedPlan(planId) : null;
  if(!plan || plan.criteria.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Selecciona un plan habilitado para ver sus criterios de medición.';
    container.appendChild(empty);
    renderChecklist(null);
    return;
  }

  const byCriteria = new Map((existingResults || []).map(r => [r.criteria_id, r]));
  const title = document.createElement('h3');
  title.textContent = 'Mediciones';
  container.appendChild(title);

  plan.criteria.forEach(criterion => {
    const row = document.createElement('div');
    row.className = 'measurement-row';

    const label = document.createElement('label');
    label.setAttribute('for', `measure-${criterion.criteria_id}`);
    const expected = criterion.comparison_type === 'range'
      ? `${criterion.expected_value} ± ${criterion.tolerance} ${criterion.unit}`
      : `${criterion.comparison_type === 'min' ? '≥' : criterion.comparison_type === 'max' ? '≤' : '='} ${criterion.expected_value} ${criterion.unit}`;
    label.textContent = `${criterion.criteria_name} (${expected})${criterion.is_critical ? ' · Crítico' : ''}`;
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.id = `measure-${criterion.criteria_id}`;
    input.dataset.criteriaId = criterion.criteria_id;
    input.setAttribute('aria-label', `Medición para ${criterion.criteria_name}`);
    const existing = byCriteria.get(criterion.criteria_id);
    if(existing && existing.measured_value !== undefined && existing.measured_value !== null){
      input.value = existing.measured_value;
    }
    row.appendChild(input);

    const badge = document.createElement('span');
    badge.className = 'measurement-badge';
    badge.dataset.resultFor = criterion.criteria_id;
    if(existing){
      badge.textContent = existing.pass_fail ? 'Cumple' : 'No cumple';
      badge.classList.add(existing.pass_fail ? 'pass' : 'fail');
    }
    row.appendChild(badge);

    container.appendChild(row);
  });

  renderChecklist(plan, existingResults);
}

function setChecklistState(item, passFail){
  item.dataset.state = passFail ? 'pass' : 'fail';
  const icon = item.querySelector('.check-icon');
  const state = item.querySelector('.check-state');
  if(icon) icon.textContent = passFail ? '✓' : '!';
  if(state) state.textContent = passFail ? 'Cumple' : 'No cumple';
}

function updateChecklistProgress(container){
  const items = [...container.querySelectorAll('.checklist-item')];
  const evaluated = items.filter(item => item.dataset.state === 'pass' || item.dataset.state === 'fail').length;
  const progressText = qs('checklist-progress-text');
  const progressBar = qs('checklist-progress-bar');
  if(progressText) progressText.textContent = `${evaluated}/${items.length} criterios evaluados`;
  if(progressBar) progressBar.style.width = `${items.length ? Math.round((evaluated / items.length) * 100) : 0}%`;
}

function renderChecklist(plan, existingResults = []){
  const container = qs('inspection-checklist');
  if(!container) return;
  container.innerHTML = '';
  if(!plan || plan.criteria.length === 0){
    const item = document.createElement('div');
    item.className = 'checklist-item';
    const icon = document.createElement('span');
    icon.className = 'check-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '·';
    const name = document.createElement('span');
    name.className = 'check-name';
    name.textContent = 'Selecciona un plan para ver sus criterios.';
    item.append(icon, name);
    container.appendChild(item);
    const progressText = qs('checklist-progress-text');
    const progressBar = qs('checklist-progress-bar');
    if(progressText) progressText.textContent = '0/0 criterios evaluados';
    if(progressBar) progressBar.style.width = '0%';
    return;
  }

  const byCriteria = new Map((existingResults || []).map(result => [result.criteria_id, result]));
  plan.criteria.forEach(criterion => {
    const item = document.createElement('div');
    item.className = 'checklist-item';
    item.dataset.checkFor = criterion.criteria_id;
    item.dataset.state = 'pending';
    const icon = document.createElement('span');
    icon.className = 'check-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '·';
    const name = document.createElement('span');
    name.className = 'check-name';
    name.textContent = criterion.criteria_name;
    const state = document.createElement('span');
    state.className = 'check-state';
    state.textContent = 'Pendiente';
    item.append(icon, name, state);
    container.appendChild(item);
    const existing = byCriteria.get(criterion.criteria_id);
    if(existing && existing.pass_fail !== undefined && existing.pass_fail !== null){
      setChecklistState(item, Boolean(existing.pass_fail));
    }
  });
  updateChecklistProgress(container);
}

function updateChecklist(evaluation){
  const container = qs('inspection-checklist');
  if(!container) return;
  evaluation.results.forEach(result => {
    const item = container.querySelector(`[data-check-for="${result.criteria_id}"]`);
    if(!item) return;
    if(result.pass_fail === null){
      item.dataset.state = 'pending';
      const icon = item.querySelector('.check-icon');
      const state = item.querySelector('.check-state');
      if(icon) icon.textContent = '·';
      if(state) state.textContent = 'Pendiente';
      return;
    }
    setChecklistState(item, result.pass_fail);
  });
  updateChecklistProgress(container);
}

export function previewEvaluation(){
  const verdict = qs('inspection-verdict');
  const plan = selectedPlan();
  if(!verdict) return null;
  if(!plan){
    verdict.hidden = true;
    return null;
  }
  const evaluation = evaluateInspection(plan, collectMeasurements());

  updateMeasurementBadges(evaluation);

  verdict.hidden = false;
  verdict.classList.remove('verdict-pass', 'verdict-fail', 'verdict-conditional', 'verdict-incomplete');
  if(evaluation.status === 'incomplete'){
    verdict.textContent = `Inspección incompleta: faltan ${evaluation.missing_criteria_ids.length} medición(es). Se guardará como borrador.`;
    verdict.classList.add('verdict-incomplete');
  } else {
    verdict.textContent = `Dictamen calculado automáticamente: ${resultLabel(evaluation.overall_result)}.`;
    verdict.classList.add(
      evaluation.overall_result === 'passed' ? 'verdict-pass'
        : evaluation.overall_result === 'failed' ? 'verdict-fail'
          : 'verdict-conditional'
    );
  }
  return evaluation;
}

function updateMeasurementBadges(evaluation){
  evaluation.results.forEach(result => {
    const badge = document.querySelector(`[data-result-for="${result.criteria_id}"]`);
    if(!badge) return;
    badge.classList.remove('pass', 'fail');
    if(result.pass_fail === null){
      badge.textContent = '';
      return;
    }
    badge.textContent = result.pass_fail ? 'Cumple' : 'No cumple';
    badge.classList.add(result.pass_fail ? 'pass' : 'fail');
  });
  updateChecklist(evaluation);
}

function numericResults(evaluation){
  return evaluation.results.filter(result => result.pass_fail !== null);
}

function persistInspection(evaluation, complete){
  const header = collectInspectionHeader();
  const check = validateInspection(header);
  showInspectionErrors(check.errors);
  if(!check.valid) return null;

  let inspectionId = qs('inspection-id').value;
  if(!inspectionId){
    const inspection = addInspection({ ...header, inspection_status: 'draft' });
    inspectionId = inspection.inspection_id;
  } else {
    updateInspection(inspectionId, header);
  }
  qs('inspection-id').value = inspectionId;

  if(complete){
    const { inspection } = completeInspection(inspectionId, evaluation.overall_result, numericResults(evaluation));
    return inspection;
  }
  saveDraftInspection(inspectionId, numericResults(evaluation));
  return { inspection_id: inspectionId, inspection_status: 'draft' };
}

function showDraftSaved(){
  const error = qs('inspection-error');
  if(error){ error.textContent = 'Borrador guardado. El lote sigue pendiente hasta completar la inspección.'; error.classList.add('info'); }
}

export function resetInspectionForm(options = {}){
  qs('inspection-id').value = '';
  qs('inspection-reference').value = '';
  if(qs('inspection-stage')) qs('inspection-stage').value = preferredStage(qs('inspection-module').value, false);
  qs('inspection-date').value = todayIso();
  clearInspectionErrors();
  const error = qs('inspection-error');
  if(error) error.classList.remove('info');
  const verdict = qs('inspection-verdict');
  if(verdict){ verdict.hidden = true; verdict.textContent = ''; }
  renderMeasurements(qs('inspection-plan').value);
  renderInspectionEvidence();
  if(!options.keepMessage){
    const errorEl = qs('inspection-error');
    if(errorEl) errorEl.textContent = '';
  }
}

export function handleSaveDraft(){
  const evaluation = previewEvaluation();
  if(!evaluation) return null;
  const saved = persistInspection(evaluation, false);
  if(!saved) return null;
  showDraftSaved();
  renderDrafts();
  renderInspectionEvidence();
  return saved;
}

export function handleCompleteInspection(){
  const evaluation = previewEvaluation();
  if(!evaluation) return null;

  if(evaluation.status === 'incomplete'){
    const saved = persistInspection(evaluation, false);
    if(saved){
      const plan = selectedPlan();
      const names = (plan ? plan.criteria : [])
        .filter(c => evaluation.missing_criteria_ids.includes(c.criteria_id))
        .map(c => c.criteria_name);
      const error = qs('inspection-error');
      error.textContent = `No se puede emitir dictamen: faltan mediciones de ${names.join(', ') || 'uno o más criterios'}. La inspección queda en borrador.`;
      error.classList.remove('info');
    }
    renderDrafts();
    return null;
  }

  const built = persistInspection(evaluation, true);
  if(!built) return null;

  const overall = evaluation.overall_result;
  const message = overall === 'failed'
    ? 'Inspección completada: Reprobado. Se generó una no conformidad automática.'
    : overall === 'conditional'
      ? 'Inspección completada: Condicional. Queda pendiente de revisión del Jefe de Calidad.'
      : 'Inspección completada: Aprobado.';

  resetInspectionForm({ keepMessage: true });
  const verdict = qs('inspection-verdict');
  verdict.hidden = false;
  verdict.className = `verdict ${overall === 'passed' ? 'verdict-pass' : overall === 'failed' ? 'verdict-fail' : 'verdict-conditional'}`;
  verdict.textContent = message;
  const evidenceSelect = qs('inspection-evidence-inspection');
  if(evidenceSelect) evidenceSelect.value = built.inspection_id;
  renderDrafts();
  renderInspectionEvidence();
  return built;
}

function loadDraft(inspection){
  const plan = selectedPlan(inspection.inspection_plan_id);
  qs('inspection-id').value = inspection.inspection_id;
  if(qs('inspection-stage') && plan) qs('inspection-stage').value = plan.applicable_stage;
  qs('inspection-plan').value = inspection.inspection_plan_id;
  qs('inspection-inspector').value = inspection.inspector_id;
  qs('inspection-module').value = inspection.reference_module;
  renderReferenceOptions(inspection.reference_module, inspection.reference_id);
  qs('inspection-date').value = inspection.inspection_date;
  const results = loadCollection('quality_inspection_results').filter(r => r.inspection_id === inspection.inspection_id);
  renderMeasurements(inspection.inspection_plan_id, results);
  const evidenceSelect = qs('inspection-evidence-inspection');
  if(evidenceSelect) evidenceSelect.value = inspection.inspection_id;
  renderInspectionEvidence();
  previewEvaluation();
  const error = qs('inspection-error');
  if(error){ error.textContent = `Borrador cargado (${inspection.reference_id}).`; error.classList.add('info'); }
}

export function renderDrafts(){
  const container = qs('inspection-drafts');
  if(!container) return;
  container.innerHTML = '';
  const drafts = loadCollection('quality_inspections').filter(i => i.inspection_status === 'draft');
  if(drafts.length === 0){
    container.className = 'empty';
    container.textContent = 'No hay inspecciones en borrador.';
    return;
  }
  container.className = '';
  const maps = buildReferenceMaps();
  drafts.forEach(inspection => {
    const item = document.createElement('div');
    item.className = 'draft-item';
    const text = document.createElement('span');
    text.textContent = `${planName(maps, inspection.inspection_plan_id)} · ${moduleLabel(inspection.reference_module)} ${inspection.reference_id} · ${inspection.inspection_date}`;
    item.appendChild(text);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    btn.textContent = 'Continuar';
    btn.dataset.draftId = inspection.inspection_id;
    item.appendChild(btn);
    container.appendChild(item);
  });
}

export function renderInspectionEvidence(){
  const select = qs('inspection-evidence-inspection');
  if(!select) return;
  const currentId = select.value || qs('inspection-id').value;
  const inspections = loadCollection('quality_inspections');
  populateSelect(
    select,
    inspections,
    'inspection_id',
    inspection => `${moduleLabel(inspection.reference_module)} ${inspection.reference_id} · ${statusLabel(inspection.inspection_status)}`,
    inspections.length ? '-- Selecciona una inspección --' : '-- No hay inspecciones registradas --'
  );
  if(currentId && [...select.options].some(option => option.value === currentId)){
    select.value = currentId;
  }
  const records = select.value ? evidenceFor('inspection', select.value) : [];
  renderEvidenceList(
    qs('inspection-evidence-list'),
    records,
    buildReferenceMaps(),
    {
      emptyMessage: select.value
        ? 'Sin evidencia adjunta para esta inspección.'
        : 'Selecciona una inspección para ver o adjuntar evidencia.'
    }
  );
}

async function handleInspectionEvidenceSubmit(event){
  event.preventDefault();
  const error = qs('inspection-evidence-error');
  if(error) error.textContent = '';
  const entityId = qs('inspection-evidence-inspection').value;
  const uploadedBy = qs('inspection-evidence-author').value;
  const fileInput = qs('inspection-evidence-file');
  const file = fileInput.files && fileInput.files[0];
  try{
    await addEvidenceFromFile({
      entityType: 'inspection',
      entityId,
      file,
      uploadedBy
    });
    fileInput.value = '';
    renderInspectionEvidence();
  }catch(err){
    if(error) error.textContent = err.message;
  }
}

function handleInspectionEvidenceClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.evidenceDownload){
    const record = loadCollection('quality_evidence')
      .find(item => item.id === button.dataset.evidenceDownload);
    if(record){
      try{
        downloadEvidence(record);
      }catch(err){
        const error = qs('inspection-evidence-error');
        if(error) error.textContent = err.message;
      }
    }
    return;
  }
  if(button.dataset.evidenceDelete){
    if(!confirm('¿Eliminar esta evidencia?')) return;
    try{
      deleteEvidence(button.dataset.evidenceDelete);
      renderInspectionEvidence();
    }catch(err){
      const error = qs('inspection-evidence-error');
      if(error) error.textContent = err.message;
    }
  }
}

export function renderInspectionView(options = {}){
  const planSelect = qs('inspection-plan');
  if(!planSelect) return;
  const moduleSelect = qs('inspection-module');
  const module = options.referenceModule || moduleSelect.value || 'goods_receipt';
  moduleSelect.value = module;
  const selectedReference = options.referenceId !== undefined
    ? options.referenceId
    : (qs('inspection-reference') ? qs('inspection-reference').value : '');
  renderReferenceOptions(module, selectedReference);
  populateStageSelect();
  const context = referenceContext(module, qs('inspection-reference') ? qs('inspection-reference').value : '');
  populateSelect(planSelect, enabledPlans(context), 'inspection_plan_id', plan => `${plan.plan_name} · ${stageLabel(plan.applicable_stage)}`, '-- Selecciona un plan habilitado --');
  populateSelect(qs('inspection-inspector'), loadExternal('employees'), 'employee_id', 'name', '-- Selecciona un inspector --');

  if(!qs('inspection-date').value) qs('inspection-date').value = todayIso();
  populateSelect(
    qs('inspection-evidence-author'),
    loadExternal('employees'),
    'employee_id',
    employee => employee.name,
    '-- Selecciona un autor --'
  );

  const existingResults = [];
  const inspectionId = qs('inspection-id').value;
  if(inspectionId){
    loadCollection('quality_inspection_results')
      .filter(r => r.inspection_id === inspectionId)
      .forEach(r => existingResults.push(r));
  }
  renderMeasurements(planSelect.value, existingResults);
  previewEvaluation();
  renderDrafts();
  renderInspectionEvidence();
}

export function startInspection(referenceModule, referenceId){
  qs('inspection-id').value = '';
  if(qs('inspection-stage')) qs('inspection-stage').value = '';
  renderInspectionView({ referenceModule, referenceId });
  const error = qs('inspection-error');
  if(error){ error.textContent = ''; error.classList.remove('info'); }
  const verdict = qs('inspection-verdict');
  if(verdict) verdict.hidden = true;
  const planSelect = qs('inspection-plan');
  if(referenceId && planSelect.options.length === 2){
    const onlyPlan = planSelect.options[1].value;
    if(onlyPlan) planSelect.value = onlyPlan;
  }
  if(referenceId && planSelect.value) resumeDraft(referenceModule, referenceId, planSelect.value);
  if(!qs('inspection-id').value) qs('inspection-date').value = todayIso();
  previewEvaluation();
  planSelect.focus();
}

export function initInspectionEngine(){
  const form = qs('inspection-form');
  if(!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';

  qs('inspection-plan').addEventListener('change', () => {
    const context = referenceContext();
    const resumed = context.reference && qs('inspection-plan').value
      ? resumeDraft(context.module, context.reference, qs('inspection-plan').value)
      : null;
    if(!resumed){
      renderMeasurements(qs('inspection-plan').value);
      previewEvaluation();
    }
  });
  qs('inspection-module').addEventListener('change', () => {
    qs('inspection-id').value = '';
    if(qs('inspection-stage')) qs('inspection-stage').value = '';
    renderInspectionView({ referenceModule: qs('inspection-module').value, referenceId: '' });
    previewEvaluation();
  });
  qs('inspection-stage').addEventListener('change', () => {
    qs('inspection-id').value = '';
    qs('inspection-plan').value = '';
    renderInspectionView({ referenceModule: qs('inspection-module').value, referenceId: qs('inspection-reference').value });
    previewEvaluation();
  });
  qs('inspection-reference').addEventListener('change', () => {
    qs('inspection-id').value = '';
    renderInspectionView({ referenceModule: qs('inspection-module').value, referenceId: qs('inspection-reference').value });
    const context = referenceContext();
    if(context.reference && qs('inspection-plan').value){
      resumeDraft(context.module, context.reference, qs('inspection-plan').value);
    }
    previewEvaluation();
  });
  qs('inspection-measurements').addEventListener('input', () => previewEvaluation());
  qs('inspection-save-draft').addEventListener('click', () => handleSaveDraft());
  qs('inspection-complete').addEventListener('click', () => handleCompleteInspection());
  qs('inspection-reset').addEventListener('click', () => resetInspectionForm());
  qs('inspection-drafts').addEventListener('click', event => {
    const btn = event.target.closest('button[data-draft-id]');
    if(!btn) return;
    const inspection = loadCollection('quality_inspections').find(i => i.inspection_id === btn.dataset.draftId);
    if(inspection) loadDraft(inspection);
  });
  qs('inspection-evidence-form').addEventListener('submit', handleInspectionEvidenceSubmit);
  qs('inspection-evidence-inspection').addEventListener('change', () => renderInspectionEvidence());
  qs('inspection-evidence-list').addEventListener('click', handleInspectionEvidenceClick);
}
