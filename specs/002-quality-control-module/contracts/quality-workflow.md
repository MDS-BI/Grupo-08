# Contrato de Flujos y Auditoría de Control de Calidad

## Propósito

Definir las máquinas de estado, guardas, bandejas, efectos y entradas de auditoría de planes, listas, documentos, inspecciones, no conformidades y CAPA. Las transiciones no listadas se rechazan. La fuente canónica de terminología y del contrato único de revisión es `spec.md`; la matriz de permisos es [quality-permissions.md](quality-permissions.md); el cálculo determinista es [inspection-engine.md](inspection-engine.md).

## 1. Convenciones

- `actor`: empleado seleccionado en la operación; solo si no existe se usa el rol activo como metadato, sin otorgar permisos.
- `now`: marca ISO 8601.
- Toda transición valida permisos con `assertCan()` antes de mutar.
- Toda transición persistida emite exactamente una entrada de auditoría, salvo que el contrato indique lo contrario.
- Una operación bloqueada por permiso, estado, validación o integridad no cambia el estado y no emite auditoría.
- `conditional` es un resultado, nunca un valor de `inspection_status`.
- La migración de estados legados se ejecuta antes de renderizar bandejas o vistas dependientes.

## 2. Planes de inspección

### 2.1 Estados

```text
draft ──submit──> pending_approval ──approve──> approved
  ^                    │
  │                    └──reject──> rejected
  └────────edit──────────────┘
```

### 2.2 Transiciones

| Desde | Acción | Hasta | Guardas | Efectos y auditoría |
|---|---|---|---|---|
| `draft` | `submitPlanForApproval` | `pending_approval` | ≥ 1 criterio; permiso `submit_plan`. | `submitted_by`, `submitted_at`; `status_change` con `before = draft` y `after = pending_approval`. |
| `pending_approval` | `approvePlan` | `approved` | Permiso `approve_plan`. | `reviewed_by`, `reviewed_at`; una `approve` con `changed_field = status` y metadatos de revisión en `after_value`. |
| `pending_approval` | `rejectPlan` | `rejected` | Justificación no vacía; permiso `reject_plan`. | `reviewed_by`, `reviewed_at`, `review_justification`; una `reject` sobre `status`. |
| `rejected` | `updatePlan` | `draft` | Permiso `manage_plan`. | Conserva justificación; `status_change`. |
| `approved` | `duplicatePlanVersion` | `draft` | Historial o decisión explícita; permiso `version_plan`. | Nueva versión; `create` con `after_value = { status: 'draft' }`. |

### 2.3 Bloqueos

- Editar o eliminar `approved` con inspecciones históricas; exigir nueva versión.
- Aprobar o rechazar fuera de `pending_approval`.
- Enviar sin criterios.
- Seleccionar un plan no aprobado en una inspección.

## 3. Listas de verificación

### 3.1 Estados

Igual que planes: `draft → pending_approval → approved | rejected`; `rejected → draft` al editar. `archived` es legado fuera del flujo.

### 3.2 Transiciones

| Desde | Acción | Hasta | Guardas | Efectos y auditoría |
|---|---|---|---|---|
| `draft` | `submitChecklistForApproval` | `pending_approval` | Nombre, categoría y ≥ 1 criterio; permiso `submit_checklist`. | `submitted_*`; `status_change`. |
| `pending_approval` | `approveChecklist` | `approved` | Permiso `approve_checklist`. | `reviewed_*`; una `approve` sobre `status`. |
| `pending_approval` | `rejectChecklist` | `rejected` | Justificación; permiso `reject_checklist`. | `reviewed_*`, `review_justification`; una `reject` sobre `status`. |
| `rejected` | `updateChecklist` | `draft` | Permiso `manage_checklist`. | Conserva justificación; `status_change`. |
| `approved` | `duplicateChecklistVersion` | `draft` | Historial; permiso `version_checklist`. | Nueva versión; `create`. |

### 3.3 Bloqueos

- Editar o eliminar `approved` con evaluaciones o inspecciones históricas.
- Seleccionar una lista no `approved`, incluida `archived`.
- Aprobar sin criterios.

## 4. Documentos

### 4.1 Estados

```text
draft ──submit──> pending_review ──approve──> approved
  ^                    │
  │                    └──reject──> rejected
  └────────edit──────────────┘
```

`under_review` es legado equivalente a `pending_review`; `archived` queda fuera del flujo.

### 4.2 Transiciones

| Desde | Acción | Hasta | Guardas | Efectos y auditoría |
|---|---|---|---|---|
| `draft` | `submitDocumentForReview` | `pending_review` | Campos obligatorios, archivo previsualizable y responsable existente; permiso `submit_document`. | `submitted_*`; `status_change`. |
| `pending_review` | `approveDocument` | `approved` | Archivo previsualizable; permiso `approve_document`. | `reviewed_*`; una `approve` sobre `status`. |
| `pending_review` | `rejectDocument` | `rejected` | Justificación; permiso `reject_document`. | `reviewed_*`, `review_justification`; una `reject` sobre `status`. |
| `rejected` | `updateQualityDocument` | `draft` | Permiso `edit_document`. | Conserva justificación; `status_change`. |
| `approved` | `duplicateDocumentVersion` | `draft` | Permiso `version_document`. | Nueva versión; `create`. |

### 4.3 Bloqueos

- Editar un `approved` en la misma versión.
- Aprobar sin archivo principal previsualizable.
- Rechazar sin justificación.
- Inspector editando fuera de `draft` o intentando aprobar/rechazar.

## 5. Inspecciones

### 5.1 Estados y casos

```text
draft ──submit──> pending_review ──review──> completed
completed (conditional, sin decisión) ──review──> completed
completed ──override──> completed
```

- Flujo normal: `draft → pending_review → completed`, con `review_decision` registrada antes o en la misma operación que fija `completed`.
- Caso heredado/excepción: `completed` con `proposed_result = conditional` y `review_decision = null` permanece en bandeja, conserva el estado y sale al registrar cualquier decisión.
- Registro `completed` con `review_decision = null` y resultado distinto de `conditional`: final, sin bandeja; cuenta por su `overall_result` conservado. Si ese resultado es `null`, se excluye de KPIs.
- `conditional` nunca sustituye a `inspection_status`.

### 5.2 Transiciones

| Desde | Acción | Hasta | Guardas | Efectos y auditoría |
|---|---|---|---|---|
| `draft` | `submitInspectionForReview` | `pending_review` | Mediciones completas; plan y lista `approved`; permiso `submit_inspection`. | Calcula `proposed_result`; deja `overall_result = null`; `submitted_*`; una `status_change` con `changed_field = inspection_status`. |
| `pending_review` | `reviewInspection(approved)` | `completed` | Sin críticos fallidos ni mediciones faltantes; justificación si difiere del propuesto; permiso `review_inspection`. | `overall_result = passed`, `review_decision = approved`, `reviewed_*`; una `approve` sobre `overall_result`; sale de bandeja; sin NC. |
| `pending_review` | `reviewInspection(approved_conditional)` | `completed` | Sin críticos fallidos ni mediciones faltantes; justificación obligatoria; permiso `review_inspection`. | `overall_result = conditional`, `review_decision = approved_conditional`, `reviewed_*`; una `approve` sobre `overall_result`; sale de bandeja; sin NC. |
| `pending_review` | `reviewInspection(rejected)` | `completed` | Justificación; permiso `review_inspection`. | `overall_result = failed`, `review_decision = rejected`, `reviewed_*`; una `reject` sobre `overall_result`; NC si no existe; sale de bandeja. |
| `completed` condicional sin decisión | `reviewInspection(approved)` | `completed` | Sin críticos fallidos ni mediciones faltantes; permiso `review_inspection`. | Fija `passed` y decisión; una `approve`; conserva `completed`; sale de bandeja. |
| `completed` condicional sin decisión | `reviewInspection(approved_conditional)` | `completed` | Sin críticos fallidos ni mediciones faltantes; justificación; permiso `review_inspection`. | Fija `conditional` y decisión; una `approve`; conserva `completed`; sale de bandeja. |
| `completed` condicional sin decisión | `reviewInspection(rejected)` | `completed` | Justificación; permiso `review_inspection`. | Fija `failed` y decisión; una `reject`; NC si no existe; conserva `completed`; sale de bandeja. |
| `completed` | `overrideInspection` | `completed` | Justificación; no `passed` con críticos fallidos o mediciones faltantes; permiso `override_inspection`. | `override_*`; una `status_change` sobre `overall_result`; sin NC. |

### 5.3 Reglas de inspección

- `pending_review` no se edita, no cuenta en KPIs, no libera el lote y el Inspector no modifica mediciones ni criterios.
- `pending_inspections` del dashboard cuenta `draft` y `pending_review`; excluye el legado condicional sin decisión, que solo está en bandeja.
- `approval_rate` usa solo `completed` con resultado final; `conditional` está en el denominador y no en el numerador; `overall_result = null` se excluye.
- La bandeja incluye `pending_review` y `completed` condicional sin `review_decision`; cualquier decisión la retira, aunque el resultado siga siendo `conditional`.
- `approved` y `approved_conditional` exigen ausencia de críticos fallidos y de mediciones faltantes. La guarda no genera NC.
- La justificación es obligatoria cuando la decisión difiere del propuesto o es condicional/reprobada.
- La entrada de decisión incluye en `after_value` el resultado, la decisión, el revisor y la fecha; no se genera una segunda `update` ni un `status_change` por el paso a `completed`.
- El override posterior genera una sola `status_change` sobre `overall_result` y nunca una NC.

## 6. Bandejas

| Bandeja | Estado origen | Contador | Acción siguiente | Rol |
|---|---|---|---|---|
| Planes y listas | `pending_approval` | Pendientes por tipo | Previsualizar, aprobar o rechazar | Jefe de Calidad |
| Documentos | `pending_review` | Documentos pendientes | Previsualizar, aprobar o rechazar | Jefe de Calidad |
| Inspecciones | `pending_review` y `completed` con `proposed_result = conditional` y `review_decision = null` | Inspecciones pendientes | Revisar y emitir dictamen final | Jefe de Calidad |
| Cierres CAPA | `status = completed` y `closure_status = pending` | Cierres pendientes | Registrar eficacia, aprobar o rechazar | Jefe de Calidad |

Todas se agrupan bajo la única entrada `quality-approvals`. Ningún registro en `pending_approval`, `pending_review` ni ningún legado condicional sin decisión puede quedar sin bandeja accesible. Los contadores se actualizan sin recargar, el estado vacío ofrece la acción contextual y la migración se ejecuta antes de listar.

## 7. No conformidades

- El borrador automático se crea solo cuando `review_decision = rejected` (`overall_result = failed`) desde `pending_review` o desde el legado condicional sin decisión, y no existe NC previa.
- La descripción se autogenera desde los criterios incumplidos, es editable y no puede quedar vacía; producto y lote se toman del origen; `defect_type = other`, `severity = major`, `status = open`.
- La creación manual desde el formulario es válida sin exigir una inspección reprobada.
- Estados: `open → under_review → closed`. Cerrar fija `status = closed` y no exige cierre aprobado de las CAPA.
- La cuarentena es una vista derivada de NC `open` o `under_review`; el lote sale cuando esas NC pasan a `closed`.
- Una inspección con NC no se elimina; al eliminar una NC se eliminan en cascada sus CAPA y evidencia.

## 8. CAPA

### 8.1 Estados

```text
pending ──start──> in_progress ──complete──> completed
completed ──request closure──> closure_status = pending
closure_status: pending ──approve──> approved
                         └──reject──> rejected (status = in_progress)
```

### 8.2 Transiciones

| Desde | Acción | Hasta | Guardas | Efectos y auditoría |
|---|---|---|---|---|
| `pending` | `updateCorrectiveAction` | `in_progress` | Permiso `edit_capa`. | `start_date`; `status_change`. |
| `in_progress` | `complete_capa` | `completed` | Permiso `complete_capa`. | `completed_at`; `closure_status = pending`; `status_change`. |
| `completed` con cierre `pending` | `requestCapaClosure` | `completed` con cierre `pending` | Permiso `request_capa_closure`. | `closure_requested_at`; `status_change`. |
| Cierre `pending` | Registro de eficacia | Cierre `pending` | Solo Jefe; `effective` o `not_effective` con observaciones. | `effectiveness_*`; una `review` sobre `effectiveness_result`, separada de la decisión. |
| Cierre `pending` con eficacia | `reviewCapaClosure(approved)` | Cierre `approved` | Solo Jefe; eficacia y observaciones presentes. | `closure_reviewed_*`; una `approve` sobre `closure_status`. |
| Cierre `pending` | `reviewCapaClosure(rejected)` | Cierre `rejected` y `status = in_progress` | Solo Jefe; justificación. | `closure_reviewed_*`, `closure_justification`; una `reject` sobre `closure_status`, sin otra `status_change`. |

### 8.3 Reglas de CAPA

- `status = completed` significa ejecución reportada, no cierre aprobado.
- Solo el Jefe aprueba o rechaza el cierre y registra la eficacia.
- Aprobar sin revisión de eficacia está bloqueado.
- Rechazar fija `closure_status = rejected` y devuelve `status = in_progress` en la misma entrada `reject`.
- Una CAPA con cierre aprobado deja de contarse como vencida.
- La revisión de eficacia y la decisión de cierre son dos entradas distintas: `review` y `approve`/`reject`.

## 9. Auditoría

### 9.1 Entidades y acciones

```text
entity_type: inspection_plan | checklist | document | inspection | non_conformance | corrective_action
action: create | update | review | approve | reject | status_change | delete
```

### 9.2 Mapa de eventos

| Evento | `action` | `changed_field` | `before_value` | `after_value` |
|---|---|---|---|---|
| Alta | `create` | Estado inicial | `null` | Estado inicial, por ejemplo `{ status: 'draft' }`. |
| Edición | `update` | Campo modificado | Valor anterior | Valor nuevo. |
| Envío a revisión | `status_change` | `status` o `inspection_status` | Estado anterior | Estado nuevo. |
| Nota de revisión | `review` | `review_justification` | Anterior | Nueva. |
| Decisión final de inspección | `approve` o `reject` | `overall_result` | Resultado anterior | `{ overall_result, review_decision, reviewed_by, reviewed_at, justification }`. |
| Decisión de plan, lista o documento | `approve` o `reject` | `status` | Estado anterior | `{ status, reviewed_by, reviewed_at, review_justification }`. |
| Decisión de cierre CAPA | `approve` o `reject` | `closure_status` | Cierre anterior | `{ closure_status, status, closure_reviewed_by, closure_reviewed_at, closure_justification, effectiveness_result }`. |
| Revisión de eficacia | `review` | `effectiveness_result` | Anterior | `{ effectiveness_result, effectiveness_observations, effectiveness_reviewed_by, effectiveness_reviewed_at }`. |
| Override de inspección | `status_change` | `overall_result` | Resultado anterior | `{ overall_result, overridden_by, override_at, override_justification }`. |
| Cambio operativo | `status_change` | Campo de estado | Anterior | Nuevo. |
| Eliminación | `delete` | Estado o campo aplicable | Último valor | `null`. |

### 9.3 Reglas de no duplicación

- Envío a revisión: una sola `status_change`.
- Decisión final de inspección: una sola `approve`/`reject`; no `update` ni segundo `status_change` por pasar a `completed`.
- Override posterior: una sola `status_change` sobre `overall_result`.
- Decisión de cierre CAPA: una sola `approve`/`reject`; el rechazo no genera otra `status_change` por volver a `in_progress`.
- Eficacia CAPA: entrada `review` separada de la decisión de cierre.
- Permiso denegado: sin auditoría y sin cambio de estado.
- Eliminaciones permitidas: la entrada `delete` persiste tras borrar el registro y conserva lote, actor y fecha.

### 9.4 Actor

- Se usa el empleado de la operación (`inspector_id`, `overridden_by`, responsable CAPA o empleado del formulario de evidencia).
- Si no hay empleado, se usa el rol activo de `erp_quality:viewer_role` como metadato.
- El rol activo no habilita permisos por sí mismo.

## 10. Pruebas de flujo

- Plan: crear → criterios → enviar → rechazar → editar → enviar → aprobar → versionar.
- Lista: crear → enviar → aprobar → seleccionar en inspección; intentar usar una no aprobada.
- Documento: crear → enviar → rechazar → editar → enviar → aprobar → versionar; Inspector bloqueado en aprobación.
- Inspección: borrador incompleto → completo → enviar → aprobado/condicional/rechazado → NC solo en rechazo elegible; override sin NC.
- Bandeja: pendiente normal y legado condicional entran; legado con otro resultado no entra; cualquier decisión retira el registro sin cambiar `completed` en el legado.
- KPI: `pending_inspections` excluye el legado en bandeja; `approval_rate` excluye `pending_review` y `overall_result = null` y cuenta `conditional` solo en denominador.
- CAPA: crear → completar → solicitar cierre → rechazar con `closure_status = rejected` y `status = in_progress` → ejecutar → registrar eficacia → aprobar; eficacia antes de aprobar.
- NC y cuarentena: cerrar NC sin CAPA aprobada; lote sale de cuarentena; CAPA aprobada deja de contar como vencida.
- Auditoría: una entrada por decisión, metadatos de revisión en `after_value`, eficacia separada, conservación tras eliminación y bloqueo sin auditoría.
- Permisos: cada acción de la matriz, contexto de estado, rol cambiado y operación revalidada.
