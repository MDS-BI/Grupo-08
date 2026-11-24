import {
  COMPARISON_TYPES,
  qualityCatalog,
  qualitySettingUsage,
  addSettingItem,
  updateSettingItem,
  deleteSettingItem,
  loadCollection,
  loadQualitySettings,
  updateQualityParameters,
  resetQualitySettings,
  addCriterion,
  updateCriterion,
  deleteCriterion,
  getActiveRole,
  setActiveRole,
  updateAlertRule,
  deleteAlertRule
} from '../storage.js';
import { applyPermissionState, assertCan } from '../permissions.js';
import { qs, escapeHtml, cell, actionButton } from './quality-utils.js';

const CATALOG_META = Object.freeze({
  inspection_categories: { singular: 'categoría de inspección', add: 'Nueva categoría' },
  severity_levels: { singular: 'nivel de gravedad', add: 'Nuevo nivel' },
  inspection_statuses: { singular: 'estado de inspección', add: 'Nuevo estado' },
  nc_statuses: { singular: 'estado de no conformidad', add: 'Nuevo estado' },
  action_types: { singular: 'tipo de acción CAPA', add: 'Nuevo tipo' }
});

const COMPARISON_LABELS = Object.freeze({
  range: 'Rango',
  min: 'Mínimo',
  max: 'Máximo',
  boolean: 'Booleano'
});

const ID_SUFFIXES = Object.freeze({
  inspection_categories: 'inspection-categories',
  severity_levels: 'severity-levels',
  inspection_statuses: 'inspection-statuses',
  nc_statuses: 'nc-statuses',
  action_types: 'action-types'
});

const ALERT_METRIC_LABELS = Object.freeze({
  approval_rate: 'Tasa de aprobación',
  open_non_conformances: 'No conformidades abiertas',
  overdue_capa: 'Acciones CAPA vencidas',
  capa_effectiveness: 'Eficacia CAPA',
  pending_inspections: 'Inspecciones pendientes'
});

const ALERT_OPERATOR_LABELS = Object.freeze({
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  eq: '='
});

const ALERT_SEVERITY_LABELS = Object.freeze({
  info: 'Informativa',
  warning: 'Advertencia',
  critical: 'Crítica'
});

function catalogId(prefix, type){
  return `${prefix}-${ID_SUFFIXES[type] || type}`;
}

let wired = false;
let currentSection = 'inspection_categories';
let modalState = null;

function plans(){
  return loadCollection('quality_inspection_plans');
}

function planMap(){
  return new Map(plans().map(plan => [plan.inspection_plan_id, plan.plan_name]));
}

function option(value, label, selected){
  return `<option value="${escapeHtml(value)}"${selected === value ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function textField(id, label, value, options = {}){
  const disabled = options.disabled ? ' disabled' : '';
  const step = options.step ? ` step="${escapeHtml(options.step)}"` : '';
  const hint = options.hint ? `<small>${escapeHtml(options.hint)}</small>` : '';
  return `<div class="form-field"><label for="${id}">${escapeHtml(label)}</label>` +
    `<input id="${id}" type="${escapeHtml(options.type || 'text')}" value="${escapeHtml(value || '')}"${step}${disabled}>` +
    `${hint}</div>`;
}

function selectField(id, label, options, selected){
  return `<div class="form-field"><label for="${id}">${escapeHtml(label)}</label>` +
    `<select id="${id}">${options.map(item => option(item.value, item.label, selected)).join('')}</select></div>`;
}

function checkboxField(id, label, checked){
  return `<label class="checkbox-field qset-check-field"><input id="${id}" type="checkbox"${checked ? ' checked' : ''}>` +
    `<span>${escapeHtml(label)}</span></label>`;
}

function setFormError(message){
  const el = qs('qset-form-error');
  if(!el) return;
  el.textContent = message || '';
  el.hidden = !message;
}

function setParamMessage(message){
  const el = qs('qset-params-message');
  if(el) el.textContent = message || '';
}

function closeModal(){
  modalState = null;
  const modal = qs('qset-modal');
  const backdrop = qs('qset-modal-backdrop');
  if(modal) modal.hidden = true;
  if(backdrop) backdrop.hidden = true;
  const fields = qs('qset-form-fields');
  if(fields) fields.innerHTML = '';
  setFormError('');
}

function renderCatalogRows(type){
  const tbody = qs(catalogId('qset-rows', type));
  if(!tbody) return;
  const items = qualityCatalog(type);
  tbody.innerHTML = '';
  if(!items.length){
    const row = document.createElement('tr');
    const td = cell('No hay elementos configurados.', 'qset-empty-cell');
    td.colSpan = 6;
    row.appendChild(td);
    tbody.appendChild(row);
    return;
  }
  items.forEach(item => {
    const usage = qualitySettingUsage(type, item.key);
    const row = document.createElement('tr');
    row.appendChild(cell(item.key, 'qset-key'));
    row.appendChild(cell(item.label, 'qset-name'));
    row.appendChild(cell(item.description || '—'));
    row.appendChild(cell(item.system ? 'Sistema' : 'Personalizado', item.system ? 'qset-pill system' : 'qset-pill custom'));
    row.appendChild(cell(usage ? `${usage} registro(s)` : 'Sin uso', usage ? 'qset-usage' : 'muted'));

    const actions = document.createElement('td');
    actions.className = 'table-actions';
    const edit = actionButton('Editar', 'secondary', {
      qsetAction: 'edit',
      qsetType: type,
      qsetId: item.id
    });
    const remove = actionButton('Eliminar', 'danger', {
      qsetAction: 'delete',
      qsetType: type,
      qsetId: item.id
    });
    remove.disabled = item.system || usage > 0 || items.length === 1;
    if(remove.disabled){
      remove.title = item.system
        ? 'Los elementos del sistema no se pueden eliminar'
        : usage > 0
          ? 'El elemento está en uso'
          : 'Debe existir al menos un elemento';
    }
    actions.appendChild(edit);
    actions.appendChild(remove);
    row.appendChild(actions);
    tbody.appendChild(row);
  });
}

function renderCriteriaRows(){
  const tbody = qs('qset-rows-criteria');
  if(!tbody) return;
  const criteria = loadCollection('quality_inspection_criteria');
  const names = planMap();
  tbody.innerHTML = '';
  if(!criteria.length){
    const row = document.createElement('tr');
    const td = cell('No hay criterios configurados.', 'qset-empty-cell');
    td.colSpan = 8;
    row.appendChild(td);
    tbody.appendChild(row);
    return;
  }
  criteria.forEach(criterion => {
    const row = document.createElement('tr');
    row.appendChild(cell(names.get(criterion.inspection_plan_id) || criterion.inspection_plan_id || '—'));
    row.appendChild(cell(criterion.criteria_name, 'qset-name'));
    row.appendChild(cell(criterion.expected_value));
    row.appendChild(cell(criterion.tolerance));
    row.appendChild(cell(criterion.unit));
    row.appendChild(cell(COMPARISON_LABELS[criterion.comparison_type] || criterion.comparison_type));
    row.appendChild(cell(criterion.is_critical ? 'Sí' : 'No', criterion.is_critical ? 'qset-critical' : 'muted'));

    const actions = document.createElement('td');
    actions.className = 'table-actions';
    const edit = actionButton('Editar', 'secondary', {
      qsetAction: 'edit',
      qsetType: 'criteria',
      qsetId: criterion.id
    });
    const remove = actionButton('Eliminar', 'danger', {
      qsetAction: 'delete',
      qsetType: 'criteria',
      qsetId: criterion.id
    });
    if(criterion.is_locked){
      edit.disabled = true;
      remove.disabled = true;
      const title = 'El criterio tiene resultados históricos y no se puede modificar';
      edit.title = title;
      remove.title = title;
    }
    actions.appendChild(edit);
    actions.appendChild(remove);
    row.appendChild(actions);
    tbody.appendChild(row);
  });
}

function populateSelect(id, items, selected){
  const select = qs(id);
  if(!select) return;
  const placeholder = option('', 'Seleccione…', selected);
  select.innerHTML = placeholder + items.map(item => option(item.key, item.label, selected)).join('');
  select.value = selected || '';
}

function renderParameters(){
  const settings = loadQualitySettings();
  const target = qs('qset-param-approval-target');
  const autoNc = qs('qset-param-auto-nc');
  if(target) target.value = settings.parameters.approval_target;
  if(autoNc) autoNc.checked = settings.parameters.auto_create_nc_on_failure;
  populateSelect('qset-param-default-stage', settings.catalogs.inspection_categories, settings.parameters.default_inspection_stage);
  populateSelect('qset-param-default-severity', settings.catalogs.severity_levels, settings.parameters.default_nc_severity);
  populateSelect('qset-param-default-nc-status', settings.catalogs.nc_statuses, settings.parameters.default_nc_status);
  setParamMessage('');
}

function ensureAlertSection(){
  const view = qs('view-quality-settings');
  if(!view) return null;
  const content = view.querySelector('.qset-content') || view;
  let section = qs('qset-alert-rules-section');
  if(!section){
    section = document.createElement('section');
    section.id = 'qset-alert-rules-section';
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.id = 'qset-alert-rules-heading';
    heading.textContent = 'Reglas de alerta configuradas';
    const description = document.createElement('p');
    description.className = 'muted';
    description.textContent = 'Activa, desactiva o elimina las reglas existentes; la creación se gestiona desde el dashboard.';
    const list = document.createElement('div');
    list.id = 'qset-alert-rule-list';
    list.className = 'empty';
    section.append(heading, description, list);
    content.appendChild(section);
  }
  return qs('qset-alert-rule-list');
}

function syncRoleSelectors(){
  const role = getActiveRole();
  ['quality-role', 'quality-settings-role'].forEach(id => {
    const select = qs(id);
    if(select) select.value = role;
  });
  return role;
}

function renderSettingsAlerts(){
  const list = ensureAlertSection();
  if(!list) return;
  const rules = loadCollection('quality_alert_rules');
  list.replaceChildren();
  if(!rules.length){
    list.className = 'empty';
    list.textContent = 'No hay reglas de alerta configuradas.';
    return;
  }
  list.className = '';
  rules.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'alert-rule-item';
    item.dataset.qualityAlertRule = rule.id;
    const info = document.createElement('div');
    const title = document.createElement('strong');
    const metric = ALERT_METRIC_LABELS[rule.metric] || rule.metric;
    const operator = ALERT_OPERATOR_LABELS[rule.operator] || rule.operator;
    title.textContent = `${metric} ${operator} ${rule.threshold}`;
    const meta = document.createElement('div');
    meta.className = 'muted';
    const severity = ALERT_SEVERITY_LABELS[rule.severity] || rule.severity;
    meta.textContent = `${severity} · ${rule.is_active !== false ? 'Activa' : 'Inactiva'}`;
    info.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'table-actions';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'button secondary';
    toggle.textContent = rule.is_active !== false ? 'Desactivar' : 'Activar';
    toggle.dataset.qsetAlertToggle = rule.id;
    toggle.dataset.alertToggle = rule.id;
    toggle.dataset.permission = 'configure_alerts';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button danger';
    remove.textContent = 'Eliminar';
    remove.dataset.qsetAlertDelete = rule.id;
    remove.dataset.alertDelete = rule.id;
    remove.dataset.permission = 'configure_alerts';
    actions.append(toggle, remove);
    item.append(info, actions);
    list.appendChild(item);
  });
}

function applySettingsPermissions(role = getActiveRole()){
  const view = qs('view-quality-settings');
  if(!view) return;
  const reset = qs('qset-reset');
  if(reset) reset.dataset.permission = 'clear_data';
  applyPermissionState(view, role);
}

export function renderQualitySettings(){
  Object.keys(CATALOG_META).forEach(renderCatalogRows);
  renderCriteriaRows();
  renderParameters();
  syncRoleSelectors();
  renderSettingsAlerts();
  applySettingsPermissions();
  showSection(currentSection);
}

export function showQsetSection(section){
  showSection(section);
}

function showSection(section){
  currentSection = section;
  document.querySelectorAll('[data-qset-tab]').forEach(tab => {
    const active = tab.dataset.qsetTab === section;
    tab.classList.toggle('active', active);
    if(active) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-qset-panel]').forEach(panel => {
    panel.hidden = panel.dataset.qsetPanel !== section;
    panel.classList.toggle('active', panel.dataset.qsetPanel === section);
  });
}

function planOptions(selected){
  return [option('', 'Seleccione un plan…', selected)]
    .concat(plans().map(plan => option(plan.inspection_plan_id, plan.plan_name, selected)))
    .join('');
}

function openCatalogModal(type, item){
  const meta = CATALOG_META[type];
  if(!meta) return;
  modalState = { section: type, editing: item || null };
  const keyHint = item && item.system
    ? 'La clave de los elementos del sistema no se puede modificar.'
    : 'Se usa como valor técnico en planes, inspecciones y no conformidades.';
  const fields = textField('qset-field-key', 'Clave', item ? item.key : '', { hint: keyHint, disabled: Boolean(item && item.system) })
    + textField('qset-field-label', 'Nombre', item ? item.label : '')
    + textField('qset-field-description', 'Descripción', item ? item.description : '');
  const heading = qs('qset-modal-heading');
  const save = qs('qset-save');
  if(heading) heading.textContent = `${item ? 'Editar' : 'Nueva'} ${meta.singular}`;
  if(save) save.textContent = item ? 'Guardar cambios' : 'Crear';
  const container = qs('qset-form-fields');
  if(container) container.innerHTML = fields;
  setFormError('');
  const modal = qs('qset-modal');
  const backdrop = qs('qset-modal-backdrop');
  if(modal) modal.hidden = false;
  if(backdrop) backdrop.hidden = false;
  const label = qs('qset-field-label');
  if(label) label.focus();
}

function openCriteriaModal(item){
  if(!plans().length){
    window.alert('Primero debe crear un plan de inspección.');
    return;
  }
  modalState = { section: 'criteria', editing: item || null };
  const fields = `<div class="form-field"><label for="qset-criteria-plan">Plan de inspección</label>` +
    `<select id="qset-criteria-plan">${planOptions(item ? item.inspection_plan_id : '')}</select></div>` +
    textField('qset-criteria-name', 'Criterio', item ? item.criteria_name : '') +
    textField('qset-criteria-expected', 'Valor esperado', item ? item.expected_value : '', { type: 'number', step: 'any' }) +
    textField('qset-criteria-tolerance', 'Tolerancia', item ? item.tolerance : '0', { type: 'number', step: 'any' }) +
    textField('qset-criteria-unit', 'Unidad', item ? item.unit : '') +
    selectField('qset-criteria-comparison', 'Comparación', COMPARISON_TYPES.map(value => ({ value, label: COMPARISON_LABELS[value] || value })), item ? item.comparison_type : 'range') +
    checkboxField('qset-criteria-critical', 'Criterio crítico', Boolean(item && item.is_critical));
  const heading = qs('qset-modal-heading');
  const save = qs('qset-save');
  if(heading) heading.textContent = item ? 'Editar criterio de calidad' : 'Nuevo criterio de calidad';
  if(save) save.textContent = item ? 'Guardar cambios' : 'Crear';
  const container = qs('qset-form-fields');
  if(container) container.innerHTML = fields;
  setFormError('');
  const modal = qs('qset-modal');
  const backdrop = qs('qset-modal-backdrop');
  if(modal) modal.hidden = false;
  if(backdrop) backdrop.hidden = false;
  const name = qs('qset-criteria-name');
  if(name) name.focus();
}

function saveCatalog(){
  const section = modalState.section;
  const editing = modalState.editing;
  const payload = {
    key: editing && editing.system ? editing.key : qs('qset-field-key').value,
    label: qs('qset-field-label').value,
    description: qs('qset-field-description').value
  };
  if(editing) updateSettingItem(section, editing.id, payload);
  else addSettingItem(section, payload);
}

function saveCriteria(){
  const editing = modalState.editing;
  const payload = {
    inspection_plan_id: qs('qset-criteria-plan').value,
    criteria_name: qs('qset-criteria-name').value,
    expected_value: qs('qset-criteria-expected').value,
    tolerance: qs('qset-criteria-tolerance').value,
    unit: qs('qset-criteria-unit').value,
    comparison_type: qs('qset-criteria-comparison').value,
    is_critical: qs('qset-criteria-critical').checked
  };
  if(!payload.inspection_plan_id) throw new Error('Seleccione un plan de inspección');
  if(editing) updateCriterion(editing.id, payload);
  else addCriterion(payload);
}

function handleModalSubmit(event){
  event.preventDefault();
  if(!modalState) return;
  try{
    if(modalState.section === 'criteria') saveCriteria();
    else saveCatalog();
    closeModal();
    renderQualitySettings();
  }catch(error){
    setFormError(error.message);
  }
}

function handleTableAction(event){
  const button = event.target.closest('button[data-qset-action]');
  if(!button) return;
  const { qsetAction: action, qsetType: type, qsetId: id } = button.dataset;
  const item = type === 'criteria'
    ? loadCollection('quality_inspection_criteria').find(entry => entry.id === id || entry.criteria_id === id)
    : qualityCatalog(type).find(entry => entry.id === id || entry.key === id);
  if(!item) return;
  if(action === 'edit'){
    if(type === 'criteria') openCriteriaModal(item);
    else openCatalogModal(type, item);
    return;
  }
  if(action !== 'delete') return;
  const label = type === 'criteria' ? item.criteria_name : item.label;
  if(!window.confirm(`¿Eliminar "${label}"?`)) return;
  try{
    if(type === 'criteria') deleteCriterion(item.id);
    else deleteSettingItem(type, item.id);
    renderQualitySettings();
  }catch(error){
    window.alert(error.message);
  }
}

function saveParameters(event){
  event.preventDefault();
  const rawTarget = qs('qset-param-approval-target').value;
  const target = Number(rawTarget);
  if(rawTarget === '' || !Number.isFinite(target) || target < 0 || target > 100){
    setParamMessage('El objetivo debe estar entre 0 y 100.');
    return;
  }
  const params = {
    approval_target: Math.round(target),
    auto_create_nc_on_failure: qs('qset-param-auto-nc').checked,
    default_nc_severity: qs('qset-param-default-severity').value,
    default_nc_status: qs('qset-param-default-nc-status').value,
    default_inspection_stage: qs('qset-param-default-stage').value
  };
  updateQualityParameters(params);
  renderParameters();
  setParamMessage('Parámetros guardados correctamente.');
}

function resetSettings(){
  if(!window.confirm('¿Restablecer todos los catálogos y parámetros de calidad a sus valores originales?')) return;
  resetQualitySettings();
  renderQualitySettings();
  setParamMessage('Valores restablecidos correctamente.');
}

function handleSettingsAlertAction(event){
  const button = event.target.closest('[data-qset-alert-toggle], [data-qset-alert-delete]');
  if(!button) return;
  const view = qs('view-quality-settings');
  if(view && view.hidden) return;
  const toggleId = button.dataset.qsetAlertToggle;
  const deleteId = button.dataset.qsetAlertDelete;
  if(!toggleId && !deleteId) return;
  try{
    assertCan(getActiveRole(), 'configure_alerts');
    const id = toggleId || deleteId;
    const rule = loadCollection('quality_alert_rules').find(item => item.id === id || item.alert_rule_id === id);
    if(!rule) return;
    if(deleteId){
      if(!window.confirm(`¿Eliminar la regla "${ALERT_METRIC_LABELS[rule.metric] || rule.metric}"?`)) return;
      deleteAlertRule(id);
    }else{
      updateAlertRule(id, { is_active: rule.is_active === false });
    }
    renderQualitySettings();
  }catch(error){
    if(window.alert) window.alert(error.message);
  }
}

export function initQualitySettings(){
  if(wired) return;
  wired = true;
  const tabs = qs('qset-tabs');
  if(tabs) tabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-qset-tab]');
    if(tab) showSection(tab.dataset.qsetTab);
  });
  Object.keys(CATALOG_META).forEach(type => {
    const button = qs(catalogId('qset-add', type));
    if(button) button.addEventListener('click', () => openCatalogModal(type));
  });
  const addCriteria = qs('qset-add-criteria');
  if(addCriteria) addCriteria.addEventListener('click', () => openCriteriaModal());
  document.addEventListener('click', handleTableAction);
  const modalForm = qs('qset-modal-form');
  if(modalForm) modalForm.addEventListener('submit', handleModalSubmit);
  const close = qs('qset-modal-close');
  if(close) close.addEventListener('click', closeModal);
  const cancel = qs('qset-cancel');
  if(cancel) cancel.addEventListener('click', closeModal);
  const backdrop = qs('qset-modal-backdrop');
  if(backdrop) backdrop.addEventListener('click', closeModal);
  const paramsForm = qs('qset-parameters-form');
  if(paramsForm) paramsForm.addEventListener('submit', saveParameters);
  const reset = qs('qset-reset');
  if(reset) reset.addEventListener('click', resetSettings);
  const settingsRole = qs('quality-settings-role');
  if(settingsRole) settingsRole.addEventListener('change', () => {
    setActiveRole(settingsRole.value);
    syncRoleSelectors();
    renderQualitySettings();
  });
  document.addEventListener('quality:role-changed', () => {
    syncRoleSelectors();
    const view = qs('view-quality-settings');
    if(view && !view.hidden) renderQualitySettings();
    else applySettingsPermissions();
  });
  document.addEventListener('click', handleSettingsAlertAction);
  renderQualitySettings();
}
