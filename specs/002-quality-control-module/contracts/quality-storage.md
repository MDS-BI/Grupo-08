# Contrato de Almacenamiento de Control de Calidad

## Propósito

El módulo persiste sus registros en `localStorage` con identificadores `string`, marcas de tiempo ISO y colecciones JSON. Este contrato define claves, formas de datos, operaciones, invariantes, migración, errores, fórmulas derivadas, permisos y auditoría. El modelo lógico de [data-model.md](../data-model.md) es la referencia; cualquier implementación relacional requiere una capa de mapeo `INT ↔ string`.

La capa visual de US15 no añade colecciones ni claves: menú, dashboard, bandejas, cuarentena, búsquedas y estados visuales se derivan de estos datos.

## 1. Colecciones

| Colección | Clave de almacenamiento |
|---|---|
| `quality_inspection_plans` | `erp_quality:quality_inspection_plans` |
| `quality_inspection_criteria` | `erp_quality:quality_inspection_criteria` |
| `quality_checklists` | `erp_quality:quality_checklists` |
| `quality_documents` | `erp_quality:quality_documents` |
| `quality_inspections` | `erp_quality:quality_inspections` |
| `quality_inspection_results` | `erp_quality:quality_inspection_results` |
| `non_conformances` | `erp_quality:non_conformances` |
| `corrective_actions` | `erp_quality:corrective_actions` |
| `quality_evidence` | `erp_quality:quality_evidence` |
| `quality_alert_rules` | `erp_quality:quality_alert_rules` |
| `quality_audit_log` | `erp_quality:quality_audit_log` |
| Rol activo | `erp_quality:viewer_role` |
| Configuración | `erp_quality:settings` |

No existen claves para "lote", "bandeja", "cuarentena", "dashboard", "menú" ni "tema visual".

## 2. Reglas generales

- Toda escritura valida la forma antes de persistir.
- Las operaciones devuelven el registro guardado o lanzan un `Error` con el primer mensaje de validación.
- Las fechas se guardan en ISO 8601; las fechas de negocio (`inspection_date`, `due_date`, `start_date`) usan `YYYY-MM-DD`.
- Los identificadores `id` son únicos; los identificadores de negocio se conservan para trazabilidad.
- Toda operación de alto nivel revalida permiso con `assertCan(role, action, context)` antes de mutar. La matriz canónica está en [quality-permissions.md](quality-permissions.md).
- Una operación bloqueada por permisos no modifica datos, no escribe auditoría y muestra el mensaje del permiso requerido.
- `saveCollection(name, records)` reemplaza la colección completa; las operaciones de alto nivel cargan, validan, mutan y guardan.
- La auditoría se escribe después de persistir el cambio y antes de devolver el resultado; si falla la auditoría, el cambio persistido se reporta como error de trazabilidad.
- `migrateQualityData()` se ejecuta antes de renderizar bandejas o vistas que dependan de estados migrados.

## 3. Formas de datos

Las formas completas están en [data-model.md](../data-model.md). Resumen de campos relevantes:

### 3.1 Planes

```js
{
  id, inspection_plan_id, version_group_id, version, version_of,
  product_id, plan_name, applicable_stage,
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected',
  submitted_by, submitted_at, reviewed_by, reviewed_at, review_justification,
  is_locked, created_by, createdAt, updatedAt
}
```

### 3.2 Listas de verificación

```js
{
  id, checklist_id, version_group_id, version, version_of,
  name, category, description,
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'archived',
  submitted_by, submitted_at, reviewed_by, reviewed_at, review_justification,
  criteria: [], evaluations: [], is_locked, created_by, createdAt, updatedAt
}
```

### 3.3 Documentos

```js
{
  id, document_id, version_group_id, version, version_of,
  name, category, description, responsible_employee_id,
  file_name, mime_type, size_bytes, data_url,
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived',
  submitted_by, submitted_at, reviewed_by, reviewed_at, review_justification,
  created_by, uploaded_at, updated_at
}
```

`under_review` solo aparece como dato legado y se normaliza a `pending_review`. El archivo principal conserva su validación documental y el límite de 10 MB.

### 3.4 Inspecciones

```js
{
  id, inspection_id, inspection_plan_id, checklist_id, checklist_version,
  inspector_id, reference_module, reference_id, inspection_date,
  inspection_status: 'draft' | 'pending_review' | 'completed',
  proposed_result: null | 'passed' | 'conditional' | 'failed',
  overall_result: null | 'passed' | 'conditional' | 'failed',
  review_decision: null | 'approved' | 'approved_conditional' | 'rejected',
  review_justification, reviewed_by, reviewed_at,
  submitted_by, submitted_at,
  override_justification, overridden_by, override_at,
  legacy_completed, createdAt, updatedAt
}
```

`inspection_status` nunca contiene `conditional`. `legacy_completed = true` identifica registros migrados sin decisión; la bandeja se determina por `proposed_result = conditional` y `review_decision = null`. Un legado con otro resultado es final y cuenta por su `overall_result`; si este es `null`, se excluye de KPIs.

### 3.5 CAPA

```js
{
  id, corrective_action_id, non_conformance_id, responsible_employee_id,
  action_description, root_cause, action_category, action_type,
  start_date, due_date, expected_result, observations, progress,
  status: 'pending' | 'in_progress' | 'completed',
  completed_at,
  closure_status: null | 'pending' | 'approved' | 'rejected',
  closure_requested_at, closure_reviewed_by, closure_reviewed_at,
  closure_justification,
  effectiveness_result: null | 'effective' | 'not_effective',
  effectiveness_observations, effectiveness_reviewed_by, effectiveness_reviewed_at,
  createdAt, updatedAt
}
```

### 3.6 Evidencia y auditoría

La evidencia admite `entity_type` `inspection`, `non_conformance`, `corrective_action` y `document`; solo `image/png`, `image/jpeg` y `application/pdf`, hasta 5 MB por archivo y 8 MB acumulados o cuota, conservando la evidencia previa ante un rechazo.

La auditoría admite `entity_type` `inspection_plan`, `checklist`, `document`, `inspection`, `non_conformance`, `corrective_action` y las acciones `create`, `update`, `review`, `approve`, `reject`, `status_change`, `delete`. Mantiene `reference_module` + `reference_id` del lote cuando aplica.

## 4. Operaciones

### 4.1 Inicialización y migración

```js
ensureSeedData(): void
migrateQualityData(): { migrated: boolean, changes: string[] }
loadCollection(name): Array<Object>
saveCollection(name, records): void
```

- `ensureSeedData()` crea datos semilla solo si la colección no existe.
- `migrateQualityData()` es idempotente, se invoca después de `ensureSeedData()` y antes de cualquier bandeja.
- La migración no elimina registros y registra un resumen de cambios efectivos.

### 4.2 Planes

```js
addPlan(payload): Plan
updatePlan(id, updates): Plan
deletePlan(id): true
submitPlanForApproval(id, actor): Plan
approvePlan(id, actor, justification?): Plan
rejectPlan(id, actor, justification): Plan
duplicatePlanVersion(id, actor): Plan
```

**Reglas:** `updatePlan` bloquea planes `approved` con inspecciones históricas; `submitPlanForApproval` exige `draft` o `rejected` y al menos un criterio; `approvePlan`/`rejectPlan` exigen `pending_approval`; el rechazo exige justificación; `duplicatePlanVersion` crea `draft` con `version + 1`, mismo `version_group_id` y `version_of = id`.

### 4.3 Listas de verificación

```js
addChecklist(payload): Checklist
updateChecklist(id, updates): Checklist
deleteChecklist(id): true
submitChecklistForApproval(id, actor): Checklist
approveChecklist(id, actor, justification?): Checklist
rejectChecklist(id, actor, justification): Checklist
duplicateChecklistVersion(id, actor): Checklist
addChecklistEvaluation(id, evaluation): Evaluation
```

**Reglas:** equivalentes a planes; `archived` no se envía a aprobación ni se selecciona. Una lista `approved` con evaluaciones o inspecciones históricas no se edita ni elimina.

### 4.4 Documentos

```js
addQualityDocument(payload): Document
updateQualityDocument(id, updates): Document
deleteQualityDocument(id): true
submitDocumentForReview(id, actor): Document
approveDocument(id, actor, justification?): Document
rejectDocument(id, actor, justification): Document
duplicateDocumentVersion(id, actor): Document
```

**Reglas:** el archivo principal es obligatorio para enviar a revisión y se valida con su límite de 10 MB; `updated_at` cambia en cada edición y `version` solo al duplicar; `document_id` se conserva entre versiones; las operaciones usan `id`.

### 4.5 Inspecciones

```js
addInspection(payload): Inspection
updateInspection(id, updates, options?): Inspection
saveDraftInspection(id, results): Inspection
submitInspectionForReview(id, actor): Inspection
reviewInspection(id, decision, actor, justification?): Inspection
completeInspection(id, overallResult, results): Inspection
overrideInspection(id, targetResult, justification, actor): Inspection
```

**Reglas:**

- `addInspection` valida plan y lista `approved`, referencia existente y etapa compatible.
- `submitInspectionForReview` exige todas las mediciones, calcula `proposed_result`, conserva `overall_result = null` y registra `status_change`.
- `reviewInspection` exige `pending_review` o `completed` con `proposed_result = conditional` y `review_decision = null`; mapea la decisión a `overall_result`.
- `reviewInspection` es la única operación que fija el dictamen final. Desde `pending_review` cambia a `completed`; desde el legado condicional conserva `completed`. Emite una sola entrada `approve`/`reject` y no una `status_change` adicional.
- `reviewInspection` crea el borrador de NC solo si la decisión es `rejected`, el origen es elegible y no existe NC previa.
- `overrideInspection` exige `completed`, justificación y no permite `passed` con críticos fallidos; nunca genera NC; emite una sola `status_change` sobre `overall_result`.
- `completeInspection` se conserva por compatibilidad con datos legados; el flujo normal usa `submitInspectionForReview` + `reviewInspection`.

### 4.6 No conformidades y CAPA

```js
addNonConformance(payload): NonConformance
updateNonConformance(id, updates): NonConformance
deleteNonConformance(id): true
createNonConformanceFromInspection(inspectionId): NonConformance
addCorrectiveAction(payload): CorrectiveAction
updateCorrectiveAction(id, updates): CorrectiveAction
deleteCorrectiveAction(id): true
requestCapaClosure(id, actor): CorrectiveAction
reviewCapaClosure(id, decision, effectiveness, observations, actor, justification?): CorrectiveAction
isCapaOverdue(action, today?): boolean
```

**Reglas:**

- `createNonConformanceFromInspection` invoca el disparador del motor y se ejecuta solo desde una revisión `rejected` elegible; la creación manual sigue siendo válida desde el formulario.
- `requestCapaClosure` exige `status = completed` y deja `closure_status = pending`.
- `reviewCapaClosure` solo la ejecuta `jefe_calidad`, exige `closure_status = pending` y requiere eficacia registrada para aprobar.
- El rechazo fija `closure_status = rejected` y `status = in_progress`, con justificación.
- La revisión de eficacia se persiste antes de la decisión de cierre y se audita con `review` separado.
- `isCapaOverdue` considera `closure_status = approved` como cerrada.

### 4.7 Evidencia

```js
validateEvidence(payload, options?): { valid, errors }
addEvidence(payload): Evidence
deleteEvidence(id): true
deleteEvidenceFor(entityType, entityId): number
evidenceFor(entityType, entityId): Evidence[]
evidenceTotalBytes(records?): number
```

- Tipos: `image/png`, `image/jpeg`, `application/pdf`.
- Máximo 5 MB por archivo; 8 MB acumulados; cuota de `localStorage`.
- El vínculo debe existir en la colección correspondiente.
- La evidencia se elimina en cascada cuando la entidad se elimina y la eliminación está permitida; permanece si la eliminación está bloqueada.

### 4.8 Auditoría

```js
appendAuditEntry(entry): AuditEntry
findAuditEntries(filters?): AuditEntry[]
clearAuditEntries(): void
recordCreateAudit(...)
recordUpdateAudit(...)
recordDecisionAudit(...)
recordStatusAudit(...)
recordDeleteAudit(...)
```

**Filtros:** `entity_type`, `entity_id`, `reference_module`, `reference_id`, `action`, `from`, `to`, `limit`, `offset`.

**Reglas:**

- `create`: `before_value = null`; `after_value =` estado inicial, por ejemplo `{ status: 'draft' }` o `{ inspection_status: 'draft' }`.
- `delete`: `before_value =` último valor; `after_value = null`.
- `status_change`: ambos valores definidos; el envío usa `changed_field = status` o `inspection_status`.
- Decisión final de inspección: una sola entrada `approve`/`reject` con `changed_field = overall_result`; `after_value` incluye `overall_result`, `review_decision`, `reviewed_by`, `reviewed_at` y justificación cuando corresponda. No se genera `update` ni un segundo `status_change` por pasar a `completed`.
- Override: una sola `status_change` sobre `overall_result`, con justificación y actor.
- Decisión de cierre CAPA: una sola `approve`/`reject` sobre `closure_status`; `after_value` incluye `status`, revisor, fecha, justificación y eficacia. El rechazo no genera otra `status_change` por volver a `in_progress`.
- Revisión de eficacia: entrada `review` separada sobre `effectiveness_result`.
- Una acción denegada por permisos no produce entrada.
- Las entradas no se actualizan ni eliminan desde la UI; solo una limpieza total explícita las borra.

## 5. Funciones derivadas

```js
approvalRate(inspections, stage?)
pendingInspections(inspections)
reviewQueue(inspections)
derivedDashboard(data)
quarantine(lots, nonConformances, correctiveActions)
deriveQuarantineLots(lots, nonConformances, correctiveActions)
```

### 5.1 `approvalRate(inspections, stage?)`

Devuelve `count(completed && passed) / count(completed && overall_result IN (passed, conditional, failed))`, con 0 si el denominador es 0. `conditional` cuenta en el denominador y no en el numerador. Se excluyen `draft`, `pending_review` y `overall_result = null`. Si se proporciona `stage`, se filtra por la etapa derivada del `reference_module`.

### 5.2 `pendingInspections(inspections)`

Cuenta solo `inspection_status = draft` o `pending_review`. Excluye el caso heredado `completed` con `proposed_result = conditional` y `review_decision = null`: ese registro pertenece a la bandeja, no al KPI de pendientes del dashboard.

### 5.3 `reviewQueue(inspections)`

Devuelve `pending_review` y `completed` con `proposed_result = conditional` y `review_decision = null`. Cualquier `review_decision` retira el registro, aunque `overall_result` siga siendo `conditional`. No crea entidades y debe calcularse después de la migración.

### 5.4 `derivedDashboard(data)`

Devuelve, desde colecciones existentes:

- Tasa de aprobación por etapa con `approvalRate`.
- Inspecciones pendientes con `pendingInspections` y dictámenes finales por `overall_result`.
- No conformidades abiertas por severidad de `open` y `under_review`.
- CAPA pendientes o vencidas: `due_date < hoy` y `closure_status != approved`.
- Eficacia CAPA: cierres aprobados con `effectiveness_result = effective` sobre cierres aprobados, 0 si el denominador es 0.
- Documentos en `pending_review`.
- Gráficos de resultados y Pareto derivados de inspecciones y NC.
- Actividad reciente: últimas 8 entradas de `quality_audit_log` ordenadas por `timestamp` descendente.
- Alertas de reglas activas que incumplen su umbral; informativas y sin NC.
- Accesos rápidos por rol derivados de la matriz de permisos.

No incluye tarjetas decorativas, indicadores duplicados ni cifras sin origen.

### 5.5 `quarantine(lots, nonConformances, correctiveActions)`

`deriveQuarantineLots` es el alias usado en validaciones existentes. Devuelve los lotes con al menos una NC en `open` o `under_review`; marca "Cuarentena - En tratamiento" cuando la NC tiene CAPA asociada; retira el lote cuando esas NC pasan a `closed`. No depende de que el cierre de la CAPA esté aprobado y no se persiste.

## 6. Invariantes de persistencia

- No se guarda un plan, lista o documento con estado inválido; `conditional` nunca es estado de inspección.
- No se guarda una inspección del flujo normal en `completed` sin `overall_result`. Los registros legados pueden conservar `null` y se excluyen de KPIs; no se les inventa resultado.
- No se guarda una inspección `pending_review` sin `proposed_result`.
- No se guarda `review_decision` sin `reviewed_by` y `reviewed_at`.
- No se guarda una NC automática sino desde revisión `rejected` elegible y sin NC previa; overrides y guardas no la generan.
- No se guarda una CAPA `closure_status = approved` sin `effectiveness_result` y observaciones.
- No se guarda una CAPA `closure_status = rejected` sin `closure_justification`; su `status` debe ser `in_progress`.
- No se guarda evidencia con `entity_id` inexistente ni que exceda tipo, tamaño, total o cuota.
- No se guarda una referencia de lote inválida.
- No se guarda una regla de alerta duplicada activa por `metric` + `operator`.
- No se guarda un documento `approved` sin archivo principal.
- Una operación bloqueada por permisos no escribe datos ni auditoría.

## 7. Migración

| Caso | Acción |
|---|---|
| Plan sin `status` | `approved`; `version = 1`; `version_group_id = id`. |
| Lista `active` | `approved`. |
| Lista `archived` | Se conserva como legado no seleccionable. |
| Documento `active` | `approved`. |
| Documento `under_review` | `pending_review`. |
| Documento `archived` | Se conserva como legado no seleccionable. |
| Inspección `completed` con `review_decision = null` | `legacy_completed = true`; conservar `overall_result`. Si `proposed_result = conditional` —o falta y `overall_result = conditional`, caso en que se completa— entra en `reviewQueue` sin cambiar `inspection_status`; con otro resultado es final, sin bandeja y cuenta por `overall_result`; con `overall_result = null` se excluye de KPIs. |
| Inspección `completed` con `review_decision` | No se marca como pendiente; no entra en bandeja. |
| Inspección sin `proposed_result` | Se completa con `overall_result` solo si existe; en caso contrario queda `null`. |
| CAPA `completed` sin cierre | `closure_status = pending`; `closure_requested_at = completed_at || updatedAt`. |
| CAPA sin eficacia | `effectiveness_result = null`; no se aprueba cierre sin revisión. |
| Evidencia | Se conserva y se valida el tipo ampliado. |
| Auditoría | Se conserva; se normalizan valores desconocidos sin borrar entradas. |

**Idempotencia:** una segunda ejecución no cambia registros ya migrados. La migración reporta solo cambios efectivos y se ejecuta antes de renderizar bandejas.

## 8. Errores esperados

| Código lógico | Mensaje |
|---|---|
| `PERMISSION_DENIED` | "No tienes permiso para realizar esta acción." |
| `INVALID_STATE` | "La acción no está disponible en el estado actual." |
| `INVALID_REFERENCE` | "El documento origen no existe o no es válido." |
| `NON_APPROVED_PLAN` | "Solo se pueden usar planes aprobados." |
| `NON_APPROVED_CHECKLIST` | "Solo se pueden usar listas aprobadas." |
| `MISSING_JUSTIFICATION` | "Registra la justificación para continuar." |
| `MISSING_EVIDENCE_EFFECTIVENESS` | "Registra la eficacia antes de aprobar el cierre." |
| `INVALID_DATE_RANGE` | "El rango de fechas no es válido." |
| `INVALID_EVIDENCE_TYPE` | "Solo se admiten archivos PNG, JPG o PDF." |
| `EVIDENCE_TOO_LARGE` | "El archivo supera el límite de 5 MB o el acumulado de 8 MB." |
| `QUOTA_EXCEEDED` | "No hay espacio suficiente; conserva la evidencia existente." |
| `NO_EXPORT_DATA` | "No hay datos para los filtros aplicados." |

## 9. Permisos y auditoría

- [quality-permissions.md](quality-permissions.md) es la fuente canónica de la matriz. Toda vista usa `can()` para ocultar o deshabilitar con `data-permission` y toda operación vuelve a validar con `assertCan()` antes de persistir.
- El Inspector no ve detalle individual de otros inspectores ni la bitácora; consulta su propio resultado y ejecuta acciones permitidas. El Gerente solo consulta y exporta, sin crear, editar, eliminar ni aprobar.
- El actor de auditoría es el empleado seleccionado; solo si la operación no lo expone se usa el rol activo como metadato, sin otorgar permisos adicionales.
- Las entradas de auditoría persisten tras eliminaciones permitidas y conservan `reference_module` + `reference_id` para filtrar por lote aunque el registro ya no exista.
- Un permiso denegado no cambia el estado y no genera auditoría.

## 10. Compatibilidad

- Las funciones existentes de US1–US10 se mantienen como envoltorios o se adaptan sin cambiar sus firmas públicas cuando sea posible.
- `completeInspection` se conserva para pruebas y datos legados, pero no es el flujo principal.
- `updateQualityDocument` ya no incrementa `version` en cada edición; el incremento ocurre solo al duplicar una versión aprobada.
- Los datos semilla cubren roles, estados pendientes, casos legados y CAPA con cierre y eficacia.
