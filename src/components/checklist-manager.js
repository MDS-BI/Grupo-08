import {
  loadChecklists,
  validateChecklist,
  addChecklist,
  updateChecklist,
  deleteChecklist,
  addChecklistEvaluation
} from '../storage.js';
import { qs, actionButton, emptyState, todayIso } from './quality-utils.js';

const STATUS_META = Object.freeze({
  active: { label: 'Activo', className: 'checklist-status-active' },
  draft: { label: 'Borrador', className: 'checklist-status-draft' },
  archived: { label: 'Archivado', className: 'checklist-status-archived' }
});

const OUTCOME_META = Object.freeze({
  pass: { label: 'Cumple', className: 'outcome-pass' },
  fail: { label: 'No cumple', className: 'outcome-fail' },
  na: { label: 'No aplica', className: 'outcome-na' }
});

const ICONS = Object.freeze({
  templates: '<path d="M6 3h12v18H6z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path>',
  criteria: '<path d="m4 7 2 2 3-3"></path><path d="m4 15 2 2 3-3"></path><path d="M12 8h8"></path><path d="M12 16h8"></path>',
  evaluations: '<path d="M4 19V5"></path><path d="M4 19h16"></path><path d="m7 15 3-4 3 2 5-6"></path>'
});

const state = {
  editingId: null,
  draftCriteria: [],
  editingCriterionIndex: null,
  activeId: null,
  evaluating: false,
  evaluation: {}
};

function checklistById(id){
  return loadChecklists().find(item => item.id === id || item.checklist_id === id);
}

function statusMeta(status){
  return STATUS_META[status] || STATUS_META.active;
}

function criterionKey(criterion, index){
  return criterion.criteria_id || criterion.id || `criterion-${index}`;
}

function formatDate(value){
  if(!value) return '—';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function icon(iconName, className){
  const wrapper = document.createElement('span');
  wrapper.className = className;
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconName] || ''}</svg>`;
  return wrapper;
}

function pill(text, className){
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function setFormError(message){
  const el = qs('checklist-form-error');
  if(el) el.textContent = message || '';
}

function showPanel(name){
  const panels = {
    list: 'checklist-list-panel',
    editor: 'checklist-editor-panel',
    detail: 'checklist-detail-panel'
  };
  Object.entries(panels).forEach(([key, id]) => {
    const panel = qs(id);
    if(panel) panel.hidden = key !== name;
  });
}

function renderSummary(){
  const container = qs('checklist-summary');
  if(!container) return;
  container.innerHTML = '';
  const checklists = loadChecklists();
  const stats = [
    {
      icon: 'templates',
      accent: 'blue',
      label: 'Plantillas activas',
      value: checklists.filter(item => item.status === 'active').length
    },
    {
      icon: 'criteria',
      accent: 'violet',
      label: 'Criterios definidos',
      value: checklists.reduce((total, item) => total + (item.criteria || []).length, 0)
    },
    {
      icon: 'evaluations',
      accent: 'green',
      label: 'Evaluaciones guardadas',
      value: checklists.reduce((total, item) => total + (item.evaluations || []).length, 0)
    }
  ];
  stats.forEach(stat => {
    const card = document.createElement('div');
    card.className = `checklist-stat checklist-stat-${stat.accent}`;
    card.append(icon(stat.icon, 'checklist-stat-icon'));
    const copy = document.createElement('div');
    const value = document.createElement('strong');
    value.textContent = String(stat.value);
    const label = document.createElement('span');
    label.textContent = stat.label;
    copy.append(value, label);
    card.appendChild(copy);
    container.appendChild(card);
  });
}

function renderCards(){
  const container = qs('checklist-cards');
  if(!container) return;
  const search = (qs('checklist-search')?.value || '').trim().toLowerCase();
  const category = qs('checklist-category-filter')?.value || '';
  const status = qs('checklist-status-filter')?.value || '';
  const all = loadChecklists();
  const checklists = all.filter(item => {
    if(category && item.category !== category) return false;
    if(status && item.status !== status) return false;
    if(!search) return true;
    return [item.name, item.category, item.description]
      .join(' ').toLowerCase().includes(search);
  });
  const count = qs('checklist-result-count');
  if(count) count.textContent = `${checklists.length} de ${all.length} plantillas`;
  container.innerHTML = '';
  container.hidden = false;
  if(checklists.length === 0){
    emptyState(container, 'No hay listas de verificación con los filtros seleccionados.', true);
    return;
  }

  checklists.forEach(checklist => {
    const card = document.createElement('article');
    card.className = 'checklist-card';

    const head = document.createElement('div');
    head.className = 'checklist-card-head';
    head.appendChild(icon('templates', 'checklist-card-icon'));
    const titleBox = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = checklist.name;
    const categoryLine = document.createElement('div');
    categoryLine.className = 'checklist-card-category';
    categoryLine.textContent = checklist.category || 'Sin categoría';
    titleBox.append(title, categoryLine);
    head.append(titleBox, pill(statusMeta(checklist.status).label, `status-badge ${statusMeta(checklist.status).className}`));
    card.appendChild(head);

    const description = document.createElement('p');
    description.className = 'checklist-card-description';
    description.textContent = checklist.description || 'Sin descripción registrada.';
    card.appendChild(description);

    const meta = document.createElement('div');
    meta.className = 'checklist-card-meta';
    [
      `${(checklist.criteria || []).length} criterios`,
      `Creada ${formatDate(checklist.createdAt)}`,
      `${(checklist.evaluations || []).length} evaluaciones`
    ].forEach(text => {
      const span = document.createElement('span');
      span.textContent = text;
      meta.appendChild(span);
    });
    card.appendChild(meta);

    const preview = document.createElement('div');
    preview.className = 'checklist-card-preview';
    (checklist.criteria || []).slice(0, 3).forEach(criterion => {
      preview.appendChild(pill(criterion.name, 'checklist-chip'));
    });
    if((checklist.criteria || []).length > 3){
      preview.appendChild(pill(`+${checklist.criteria.length - 3}`, 'checklist-chip checklist-chip-more'));
    }
    card.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'form-actions checklist-card-actions';
    actions.appendChild(actionButton('Ver', 'secondary', { checklistView: checklist.id }));
    actions.appendChild(actionButton('Evaluar', 'secondary', { checklistEvaluate: checklist.id }));
    actions.appendChild(actionButton('Editar', 'secondary', { checklistEdit: checklist.id }));
    actions.appendChild(actionButton('Eliminar', 'danger', { checklistDelete: checklist.id }));
    card.appendChild(actions);

    container.appendChild(card);
  });
}

function updateCriterionCount(){
  const el = qs('criterion-count');
  if(el) el.textContent = `${state.draftCriteria.length} ${state.draftCriteria.length === 1 ? 'criterio' : 'criterios'}`;
}

function renderDraftCriteria(){
  const container = qs('criterion-draft-list');
  if(!container) return;
  container.innerHTML = '';
  updateCriterionCount();
  if(state.draftCriteria.length === 0){
    emptyState(container, 'Agrega al menos un criterio para guardar la plantilla.', true);
    return;
  }
  container.hidden = false;
  state.draftCriteria.forEach((criterion, index) => {
    const item = document.createElement('div');
    item.className = 'criterion-item';
    const copy = document.createElement('div');
    copy.className = 'criterion-item-copy';
    const title = document.createElement('strong');
    title.textContent = criterion.name;
    const detail = document.createElement('span');
    detail.className = 'muted';
    detail.textContent = criterion.description || 'Sin detalle adicional';
    copy.append(title, detail);
    item.appendChild(copy);
    if(criterion.is_critical) item.appendChild(pill('Crítico', 'status-badge checklist-status-active'));
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.appendChild(actionButton('Editar', 'secondary', { criterionEdit: String(index) }));
    actions.appendChild(actionButton('Eliminar', 'danger', { criterionDelete: String(index) }));
    item.appendChild(actions);
    container.appendChild(item);
  });
}

function clearCriterionEntry(){
  const name = qs('criterion-name');
  const description = qs('criterion-description');
  const critical = qs('criterion-critical');
  const add = qs('criterion-add');
  if(name) name.value = '';
  if(description) description.value = '';
  if(critical) critical.checked = false;
  if(add) add.textContent = 'Agregar criterio';
  state.editingCriterionIndex = null;
}

export function clearChecklistForm(){
  const form = qs('checklist-form');
  if(form) form.reset();
  state.editingId = null;
  state.draftCriteria = [];
  clearCriterionEntry();
  setFormError('');
  const heading = qs('checklist-editor-heading');
  if(heading) heading.textContent = 'Nueva checklist';
  const save = qs('checklist-save');
  if(save) save.textContent = 'Guardar plantilla';
  const category = qs('checklist-category');
  if(category) category.value = 'Recepción';
  const status = qs('checklist-status');
  if(status) status.value = 'active';
  renderDraftCriteria();
}

function openEditor(id){
  const checklist = id ? checklistById(id) : null;
  clearChecklistForm();
  if(checklist){
    state.editingId = checklist.id;
    state.draftCriteria = (checklist.criteria || []).map(criterion => ({ ...criterion }));
    qs('checklist-id').value = checklist.id;
    qs('checklist-name').value = checklist.name;
    qs('checklist-category').value = checklist.category;
    qs('checklist-description').value = checklist.description || '';
    qs('checklist-status').value = checklist.status || 'active';
    qs('checklist-editor-heading').textContent = 'Editar checklist';
    qs('checklist-save').textContent = 'Guardar cambios';
    renderDraftCriteria();
  }
  showPanel('editor');
  qs('checklist-name')?.focus();
}

function handleCriterionAdd(){
  const name = qs('criterion-name')?.value.trim() || '';
  if(!name){
    setFormError('Escribe el nombre del criterio.');
    qs('criterion-name')?.focus();
    return;
  }
  const entry = {
    name,
    description: qs('criterion-description')?.value.trim() || '',
    is_critical: Boolean(qs('criterion-critical')?.checked)
  };
  if(state.editingCriterionIndex !== null){
    state.draftCriteria[state.editingCriterionIndex] = {
      ...state.draftCriteria[state.editingCriterionIndex],
      ...entry
    };
  }else{
    state.draftCriteria.push(entry);
  }
  clearCriterionEntry();
  setFormError('');
  renderDraftCriteria();
}

function handleCriterionListClick(event){
  const button = event.target.closest('button');
  if(!button) return;
  if(button.dataset.criterionDelete !== undefined){
    const index = Number(button.dataset.criterionDelete);
    state.draftCriteria.splice(index, 1);
    if(state.editingCriterionIndex === index) clearCriterionEntry();
    else if(state.editingCriterionIndex !== null && state.editingCriterionIndex > index) state.editingCriterionIndex -= 1;
    renderDraftCriteria();
    return;
  }
  if(button.dataset.criterionEdit !== undefined){
    const criterion = state.draftCriteria[Number(button.dataset.criterionEdit)];
    if(!criterion) return;
    qs('criterion-name').value = criterion.name;
    qs('criterion-description').value = criterion.description || '';
    qs('criterion-critical').checked = Boolean(criterion.is_critical);
    qs('criterion-add').textContent = 'Actualizar criterio';
    state.editingCriterionIndex = Number(button.dataset.criterionEdit);
    qs('criterion-name')?.focus();
  }
}

function handleFormSubmit(event){
  event.preventDefault();
  const payload = {
    name: qs('checklist-name').value.trim(),
    description: qs('checklist-description').value.trim(),
    category: qs('checklist-category').value,
    status: qs('checklist-status').value,
    criteria: state.draftCriteria
  };
  const check = validateChecklist(payload);
  if(!check.valid){
    setFormError(Object.values(check.errors)[0]);
    return;
  }
  try{
    if(state.editingId) updateChecklist(state.editingId, payload);
    else addChecklist(payload);
    renderChecklists();
  }catch(err){
    setFormError(err.message);
  }
}

function renderDetail(){
  const body = qs('checklist-detail-body');
  if(!body) return;
  body.innerHTML = '';
  const checklist = checklistById(state.activeId);
  if(!checklist) return;
  qs('checklist-detail-heading').textContent = checklist.name;

  const head = document.createElement('div');
  head.className = 'checklist-detail-head';
  const badges = document.createElement('div');
  badges.className = 'checklist-detail-badges';
  badges.append(pill(checklist.category || 'Sin categoría', 'checklist-chip'));
  badges.append(pill(statusMeta(checklist.status).label, `status-badge ${statusMeta(checklist.status).className}`));
  head.appendChild(badges);
  const description = document.createElement('p');
  description.className = 'checklist-detail-description';
  description.textContent = checklist.description || 'Sin descripción registrada.';
  const meta = document.createElement('div');
  meta.className = 'checklist-card-meta';
  [`${(checklist.criteria || []).length} criterios`, `Creada ${formatDate(checklist.createdAt)}`, `${(checklist.evaluations || []).length} evaluaciones`].forEach(text => {
    const span = document.createElement('span');
    span.textContent = text;
    meta.appendChild(span);
  });
  const actions = document.createElement('div');
  actions.className = 'form-actions';
  actions.appendChild(actionButton('Editar plantilla', 'secondary', { detailEdit: checklist.id }));
  actions.appendChild(actionButton(state.evaluating ? 'Cancelar evaluación' : 'Iniciar evaluación', 'primary', { detailEvaluate: checklist.id }));
  head.append(description, meta, actions);
  body.appendChild(head);

  if(state.evaluating) renderEvaluationForm(body, checklist);
  else renderCriteriaPreview(body, checklist);
}

function renderCriteriaPreview(container, checklist){
  const section = document.createElement('div');
  section.className = 'detail-section';
  const heading = document.createElement('h3');
  heading.textContent = 'Criterios de la lista';
  const list = document.createElement('div');
  list.className = 'detail-criteria-list';
  (checklist.criteria || []).forEach((criterion, index) => {
    const row = document.createElement('div');
    row.className = 'detail-criteria-row';
    const number = document.createElement('span');
    number.className = 'criterion-number';
    number.textContent = String(index + 1);
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = criterion.name;
    const detail = document.createElement('span');
    detail.className = 'muted';
    detail.textContent = criterion.description || 'Sin detalle adicional';
    copy.append(title, detail);
    row.append(number, copy);
    if(criterion.is_critical) row.appendChild(pill('Crítico', 'status-badge checklist-status-active'));
    list.appendChild(row);
  });
  section.append(heading, list);
  container.appendChild(section);

  const last = (checklist.evaluations || []).slice(-1)[0];
  if(last) container.appendChild(renderEvaluationResult(checklist, last));
}

function renderEvaluationResult(checklist, evaluation){
  const section = document.createElement('div');
  section.className = 'detail-section evaluation-result';
  const heading = document.createElement('h3');
  heading.textContent = `Última evaluación · ${formatDate(evaluation.date)}`;
  section.appendChild(heading);
  const summary = evaluation.summary || {};
  const chips = document.createElement('div');
  chips.className = 'evaluation-result-chips';
  [
    ['Cumple', summary.pass || 0, 'outcome-pass'],
    ['No cumple', summary.fail || 0, 'outcome-fail'],
    ['No aplica', summary.na || 0, 'outcome-na'],
    ['Cumplimiento', `${summary.compliance || 0}%`, 'outcome-compliance']
  ].forEach(([label, value, className]) => {
    const chip = document.createElement('div');
    chip.className = `evaluation-result-chip ${className}`;
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    chip.append(strong, span);
    chips.appendChild(chip);
  });
  section.appendChild(chips);

  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Criterio', 'Resultado', 'Observaciones'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  (evaluation.results || []).forEach(result => {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = result.criterion || (checklist.criteria || []).find(criterion => criterionKey(criterion, 0) === result.criteria_id)?.name || result.criteria_id;
    const outcomeCell = document.createElement('td');
    const meta = OUTCOME_META[result.outcome] || OUTCOME_META.na;
    outcomeCell.appendChild(pill(meta.label, `outcome-pill ${meta.className}`));
    const observation = document.createElement('td');
    observation.textContent = result.observation || '—';
    tr.append(name, outcomeCell, observation);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

function renderEvaluationForm(container, checklist){
  const intro = document.createElement('div');
  intro.className = 'evaluation-intro';
  const text = document.createElement('p');
  text.className = 'muted';
  text.textContent = 'Selecciona un resultado para cada criterio. Puedes agregar observaciones y guardar al finalizar.';
  intro.appendChild(text);
  container.appendChild(intro);

  const layout = document.createElement('div');
  layout.className = 'evaluation-layout';
  const criteriaPanel = document.createElement('div');
  criteriaPanel.className = 'evaluation-criteria';

  (checklist.criteria || []).forEach((criterion, index) => {
    const key = criterionKey(criterion, index);
    const current = state.evaluation[key] || {};
    const row = document.createElement('div');
    row.className = 'evaluation-row';
    const head = document.createElement('div');
    head.className = 'evaluation-row-head';
    const number = document.createElement('span');
    number.className = 'criterion-number';
    number.textContent = String(index + 1);
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = criterion.name;
    const detail = document.createElement('span');
    detail.className = 'muted';
    detail.textContent = criterion.description || 'Sin detalle adicional';
    copy.append(title, detail);
    head.append(number, copy);
    if(criterion.is_critical) head.appendChild(pill('Crítico', 'status-badge checklist-status-active'));
    row.appendChild(head);

    const options = document.createElement('div');
    options.className = 'evaluation-options';
    Object.entries(OUTCOME_META).forEach(([value, meta]) => {
      const label = document.createElement('label');
      label.className = `evaluation-option ${meta.className}`;
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `evaluation-${key}`;
      input.value = value;
      input.checked = current.outcome === value;
      input.addEventListener('change', () => {
        state.evaluation[key] = { ...(state.evaluation[key] || {}), outcome: value };
        updateEvaluationSummary(checklist);
      });
      const span = document.createElement('span');
      span.textContent = meta.label;
      label.append(input, span);
      options.appendChild(label);
    });
    row.appendChild(options);

    const observation = document.createElement('textarea');
    observation.rows = 2;
    observation.placeholder = 'Observaciones del criterio (opcional)';
    observation.value = current.observation || '';
    observation.setAttribute('aria-label', `Observaciones de ${criterion.name}`);
    observation.addEventListener('input', () => {
      state.evaluation[key] = { ...(state.evaluation[key] || {}), observation: observation.value };
    });
    row.appendChild(observation);
    criteriaPanel.appendChild(row);
  });

  const aside = document.createElement('aside');
  aside.className = 'evaluation-summary';
  const heading = document.createElement('h3');
  heading.textContent = 'Resumen';
  aside.appendChild(heading);
  [
    ['pass', 'Cumple', 'outcome-pass'],
    ['fail', 'No cumple', 'outcome-fail'],
    ['na', 'No aplica', 'outcome-na'],
    ['pending', 'Pendientes', 'outcome-pending']
  ].forEach(([key, label, className]) => {
    const row = document.createElement('div');
    row.className = `evaluation-summary-row ${className}`;
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('strong');
    strong.id = `checklist-eval-${key}`;
    strong.textContent = '0';
    row.append(span, strong);
    aside.appendChild(row);
  });
  const progressLabel = document.createElement('div');
  progressLabel.className = 'evaluation-progress-label';
  progressLabel.textContent = 'Cumplimiento';
  const compliance = document.createElement('strong');
  compliance.id = 'checklist-eval-compliance';
  compliance.textContent = '0%';
  const track = document.createElement('div');
  track.className = 'evaluation-progress-track';
  const bar = document.createElement('span');
  bar.id = 'checklist-eval-bar';
  track.appendChild(bar);
  aside.append(progressLabel, compliance, track);

  const error = document.createElement('div');
  error.className = 'error';
  error.id = 'checklist-evaluation-error';
  error.setAttribute('aria-live', 'polite');
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary';
  save.id = 'checklist-evaluation-save';
  save.textContent = 'Guardar evaluación';
  save.addEventListener('click', () => saveEvaluation(checklist));
  aside.append(error, save);
  layout.append(criteriaPanel, aside);
  container.appendChild(layout);
  updateEvaluationSummary(checklist);
}

function updateEvaluationSummary(checklist){
  const counts = { pass: 0, fail: 0, na: 0, pending: 0 };
  (checklist.criteria || []).forEach((criterion, index) => {
    const outcome = state.evaluation[criterionKey(criterion, index)]?.outcome;
    if(outcome && counts[outcome] !== undefined) counts[outcome] += 1;
    else counts.pending += 1;
  });
  Object.entries(counts).forEach(([key, value]) => {
    const el = qs(`checklist-eval-${key}`);
    if(el) el.textContent = String(value);
  });
  const scored = counts.pass + counts.fail;
  const compliance = scored ? Math.round((counts.pass / scored) * 100) : 0;
  const complianceEl = qs('checklist-eval-compliance');
  if(complianceEl) complianceEl.textContent = `${compliance}%`;
  const bar = qs('checklist-eval-bar');
  if(bar) bar.style.width = `${compliance}%`;
  const save = qs('checklist-evaluation-save');
  if(save) save.disabled = counts.pending > 0;
}

function saveEvaluation(checklist){
  const error = qs('checklist-evaluation-error');
  const pending = (checklist.criteria || []).filter((criterion, index) => !state.evaluation[criterionKey(criterion, index)]?.outcome);
  if(pending.length){
    if(error) error.textContent = 'Evalúa todos los criterios antes de guardar.';
    return;
  }
  const results = checklist.criteria.map((criterion, index) => {
    const key = criterionKey(criterion, index);
    return {
      criteria_id: key,
      criterion: criterion.name,
      outcome: state.evaluation[key].outcome,
      observation: state.evaluation[key].observation || ''
    };
  });
  const summary = {
    total: results.length,
    pass: results.filter(result => result.outcome === 'pass').length,
    fail: results.filter(result => result.outcome === 'fail').length,
    na: results.filter(result => result.outcome === 'na').length,
    compliance: results.filter(result => result.outcome === 'pass').length /
      Math.max(1, results.filter(result => result.outcome === 'pass' || result.outcome === 'fail').length) * 100
  };
  summary.compliance = Math.round(summary.compliance);
  addChecklistEvaluation(checklist.id, { date: todayIso(), results, summary });
  state.evaluating = false;
  state.evaluation = {};
  renderSummary();
  renderCards();
  renderDetail();
}

function openDetail(id, evaluate = false){
  const checklist = checklistById(id);
  if(!checklist) return;
  state.activeId = checklist.id;
  state.evaluating = evaluate;
  state.evaluation = {};
  renderDetail();
  showPanel('detail');
}

function renderAll(){
  renderSummary();
  renderCards();
}

export function renderChecklists(){
  renderAll();
  showPanel('list');
}

export function initChecklistManager(){
  const create = qs('checklist-create');
  if(create) create.addEventListener('click', () => openEditor());
  const editorBack = qs('checklist-editor-back');
  if(editorBack) editorBack.addEventListener('click', () => renderChecklists());
  const cancel = qs('checklist-cancel');
  if(cancel) cancel.addEventListener('click', () => renderChecklists());
  const detailBack = qs('checklist-detail-back');
  if(detailBack) detailBack.addEventListener('click', () => renderChecklists());

  const form = qs('checklist-form');
  if(form) form.addEventListener('submit', handleFormSubmit);
  const addCriterion = qs('criterion-add');
  if(addCriterion) addCriterion.addEventListener('click', handleCriterionAdd);
  const draftList = qs('criterion-draft-list');
  if(draftList) draftList.addEventListener('click', handleCriterionListClick);

  const search = qs('checklist-search');
  if(search) search.addEventListener('input', renderCards);
  const categoryFilter = qs('checklist-category-filter');
  if(categoryFilter) categoryFilter.addEventListener('change', renderCards);
  const statusFilter = qs('checklist-status-filter');
  if(statusFilter) statusFilter.addEventListener('change', renderCards);

  const cards = qs('checklist-cards');
  if(cards) cards.addEventListener('click', event => {
    const button = event.target.closest('button');
    if(!button) return;
    if(button.dataset.checklistView) openDetail(button.dataset.checklistView);
    else if(button.dataset.checklistEvaluate) openDetail(button.dataset.checklistEvaluate, true);
    else if(button.dataset.checklistEdit) openEditor(button.dataset.checklistEdit);
    else if(button.dataset.checklistDelete){
      if(window.confirm('¿Eliminar esta lista de verificación?')){
        deleteChecklist(button.dataset.checklistDelete);
        renderAll();
      }
    }
  });

  const detailBody = qs('checklist-detail-body');
  if(detailBody) detailBody.addEventListener('click', event => {
    const button = event.target.closest('button');
    if(!button) return;
    if(button.dataset.detailEdit) openEditor(button.dataset.detailEdit);
    else if(button.dataset.detailEvaluate){
      const id = button.dataset.detailEvaluate;
      if(state.evaluating) openDetail(id, false);
      else openDetail(id, true);
    }
  });

  clearChecklistForm();
}
