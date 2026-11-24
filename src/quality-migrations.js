const KEY_PREFIX = 'erp_quality:';

const COLLECTIONS = Object.freeze({
  plans: `${KEY_PREFIX}quality_inspection_plans`,
  criteria: `${KEY_PREFIX}quality_inspection_criteria`,
  checklists: `${KEY_PREFIX}quality_checklists`,
  documents: `${KEY_PREFIX}quality_documents`,
  inspections: `${KEY_PREFIX}quality_inspections`,
  results: `${KEY_PREFIX}quality_inspection_results`,
  nonConformances: `${KEY_PREFIX}non_conformances`,
  capas: `${KEY_PREFIX}corrective_actions`,
  evidence: `${KEY_PREFIX}quality_evidence`,
  alertRules: `${KEY_PREFIX}quality_alert_rules`
});

function read(key){
  try{
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }catch{
    return [];
  }
}

function write(key, records){
  localStorage.setItem(key, JSON.stringify(records));
}

function timestamp(){
  return new Date().toISOString();
}

function versionGroup(record, prefix){
  return record.version_group_id || `${prefix}-${record.id || record.inspection_plan_id || record.checklist_id || record.document_id || record.non_conformance_id || record.corrective_action_id || 'legacy'}`;
}

function migratePlans(){
  const key = COLLECTIONS.plans;
  const records = read(key);
  let changed = 0;
  const result = records.map(record => {
    const next = { ...record };
    if(!next.status){
      next.status = 'approved';
      changed += 1;
    }
    if(next.status === 'active'){
      next.status = 'approved';
      changed += 1;
    }
    if(!next.version_group_id){
      next.version_group_id = versionGroup(next, 'plan');
      changed += 1;
    }
    if(!next.version){
      next.version = 1;
      changed += 1;
    }
    if(next.version_of === undefined){
      next.version_of = null;
      changed += 1;
    }
    if(next.is_locked === undefined){
      next.is_locked = false;
      changed += 1;
    }
    return next;
  });
  if(changed) write(key, result);
  return changed;
}

function migrateChecklists(){
  const key = COLLECTIONS.checklists;
  const records = read(key);
  let changed = 0;
  const result = records.map(record => {
    const next = { ...record };
    if(next.status === 'active'){
      next.status = 'approved';
      changed += 1;
    }else if(next.status === 'under_review'){
      next.status = 'pending_review';
      changed += 1;
    }
    if(next.status === 'archived' && !next.legacy_archived){
      next.legacy_archived = true;
      next.selectable = false;
      changed += 1;
    }
    if(!next.version_group_id){
      next.version_group_id = versionGroup(next, 'checklist');
      changed += 1;
    }
    if(!next.version){
      next.version = 1;
      changed += 1;
    }
    if(next.version_of === undefined){
      next.version_of = null;
      changed += 1;
    }
    if(next.is_locked === undefined){
      next.is_locked = false;
      changed += 1;
    }
    if(!Array.isArray(next.criteria)){
      next.criteria = [];
      changed += 1;
    }
    if(!Array.isArray(next.evaluations)){
      next.evaluations = [];
      changed += 1;
    }
    return next;
  });
  if(changed) write(key, result);
  return changed;
}

function migrateDocuments(){
  const key = COLLECTIONS.documents;
  const records = read(key);
  let changed = 0;
  const result = records.map(record => {
    const next = { ...record };
    if(next.status === 'under_review'){
      next.status = 'pending_review';
      changed += 1;
    }
    if(next.status === 'archived' && !next.legacy_archived){
      next.legacy_archived = true;
      changed += 1;
    }
    if(!next.status){
      next.status = 'draft';
      changed += 1;
    }
    if(!next.document_id){
      next.document_id = next.id || `DOC-${next.version_group_id || 'legacy'}`;
      changed += 1;
    }
    if(!next.version_group_id){
      next.version_group_id = `doc-${next.document_id}`;
      changed += 1;
    }
    if(!next.version){
      next.version = 1;
      changed += 1;
    }
    if(next.version_of === undefined){
      next.version_of = null;
      changed += 1;
    }
    if(next.responsible_employee_id === undefined){
      next.responsible_employee_id = null;
      changed += 1;
    }
    if(!next.uploaded_at){
      next.uploaded_at = next.uploadedAt || next.createdAt || timestamp();
      changed += 1;
    }
    if(!next.updated_at){
      next.updated_at = next.updatedAt || next.uploaded_at;
      changed += 1;
    }
    return next;
  });
  if(changed) write(key, result);
  return changed;
}

function migrateInspections(){
  const key = COLLECTIONS.inspections;
  const records = read(key);
  let changed = 0;
  const result = records.map(record => {
    const next = { ...record };
    if(!next.inspection_status && next.status){
      next.inspection_status = next.status;
      changed += 1;
    }
    if(!next.inspection_status){
      next.inspection_status = 'draft';
      changed += 1;
    }
    if(next.review_decision === undefined){
      next.review_decision = null;
      changed += 1;
    }
    if(next.proposed_result === undefined && next.overall_result){
      next.proposed_result = next.overall_result;
      changed += 1;
    }
    if(next.overall_result === undefined){
      next.overall_result = null;
      changed += 1;
    }
    if(next.inspection_status === 'completed' && !next.review_decision && (next.proposed_result === 'conditional' || next.overall_result === 'conditional')){
      next.proposed_result = 'conditional';
      if(next.legacy_completed !== true){
        next.legacy_completed = true;
        changed += 1;
      }
      if(next.migration_flagged_for_review !== true){
        next.migration_flagged_for_review = true;
        changed += 1;
      }
    }else if(next.legacy_completed === undefined){
      next.legacy_completed = false;
      changed += 1;
    }
    return next;
  });
  if(changed) write(key, result);
  return changed;
}

function migrateCapas(){
  const key = COLLECTIONS.capas;
  const records = read(key);
  let changed = 0;
  const result = records.map(record => {
    const next = { ...record };
    if(next.closure_status === undefined){
      next.closure_status = next.status === 'completed' ? 'pending' : null;
      changed += 1;
    }
    if(next.status === 'completed' && next.closure_status === null){
      next.closure_status = 'pending';
      changed += 1;
    }
    if(next.effectiveness_result === undefined){
      next.effectiveness_result = null;
      changed += 1;
    }
    if(next.effectiveness_observations === undefined){
      next.effectiveness_observations = null;
      changed += 1;
    }
    if(next.completed_at === undefined && next.completedAt){
      next.completed_at = next.completedAt;
      changed += 1;
    }
    return next;
  });
  if(changed) write(key, result);
  return changed;
}

function migrateEvidence(){
  const key = COLLECTIONS.evidence;
  const records = read(key);
  let changed = 0;
  const result = records.map(record => {
    const next = { ...record };
    if(!next.evidence_id){
      next.evidence_id = next.id;
      changed += 1;
    }
    if(next.uploaded_by === undefined){
      next.uploaded_by = next.uploadedBy || 'jefe_calidad';
      changed += 1;
    }
    if(!next.uploaded_at){
      next.uploaded_at = next.uploadedAt || timestamp();
      changed += 1;
    }
    return next;
  });
  if(changed) write(key, result);
  return changed;
}

export function migrateQualityData(){
  if(typeof localStorage === 'undefined') return { changed: 0 };
  const changes = {
    plans: migratePlans(),
    checklists: migrateChecklists(),
    documents: migrateDocuments(),
    inspections: migrateInspections(),
    capas: migrateCapas(),
    evidence: migrateEvidence()
  };
  return {
    changed: Object.values(changes).reduce((sum, count) => sum + count, 0),
    ...changes
  };
}

export function qualityMigrationApplied(){
  try{
    return localStorage.getItem('erp_quality:migration_version') === '2';
  }catch{
    return false;
  }
}

export function markQualityMigrationApplied(){
  try{
    localStorage.setItem('erp_quality:migration_version', '2');
  }catch{
    return false;
  }
  return true;
}
