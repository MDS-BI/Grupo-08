# Contrato de Permisos de Control de Calidad

## Propósito

Este documento es la fuente canónica de la matriz de permisos del módulo, según FR-051–FR-054, FR-028, FR-066 y US11. Define una sola matriz para `jefe_calidad`, `inspector` y `gerente`, aplicable a todas las vistas y operaciones. La matriz evita reglas duplicadas y garantiza que una acción no autorizada se bloquee antes de mutar datos o escribir auditoría.

## 1. Roles

| Rol | Descripción |
|---|---|
| `jefe_calidad` | Configura, aprueba, revisa, cierra y supervisa el módulo; ve detalle individual y bandejas. |
| `inspector` | Ejecuta inspecciones, adjunta evidencia, crea NC y propone CAPA; ve solo su propio resultado individual y no ve bitácora ni bandejas de aprobación. |
| `gerente` | Consulta indicadores, reportes, historial, cuarentena, CAPA y bitácora en modo solo lectura; puede exportar reportes e historial. |

**Rol activo:** se guarda en `erp_quality:viewer_role`; si falta o es inválido, se usa `jefe_calidad` y se persiste ese valor.

**Importante:** el rol es un metadato de demostración, no una autenticación. No hay cuentas, contraseñas ni sesiones reales. El actor de auditoría puede ser un empleado distinto del rol activo; el rol nunca habilita permisos adicionales por sí mismo.

## 2. Interfaz

```js
export const ROLES = ['jefe_calidad', 'inspector', 'gerente'];

can(role, action, context = {}): boolean
assertCan(role, action, context = {}): void
permissionsFor(role): string[]
visibleActions(role, actions, context): string[]
applyPermissionState(root, role, context): void
```

- `role` debe ser uno de `ROLES`; un valor inválido devuelve `false` en `can()` y lanza `PERMISSION_DENIED` en `assertCan()`.
- `can()` es pura y no lee `localStorage`; el rol se pasa explícitamente.
- `context` puede incluir `status`, `inspectionStatus`, `proposedResult`, `reviewDecision`, `closureStatus`, `entityType`, `isOwner`, `hasHistory`, `isDraft` y `isLegacy`.
- `assertCan()` lanza `Error('PERMISSION_DENIED')` con el mensaje "No tienes permiso para realizar esta acción.".
- `getActiveRole()` y `setActiveRole()` viven en `storage.js`, leen/escriben `erp_quality:viewer_role` y emiten `quality:role-changed`.
- Ningún componente debe comparar `role === '...'`; toda decisión pasa por `can()` o `assertCan()`.

## 3. Matriz canónica de acciones

| Acción | Jefe | Inspector | Gerente | Contexto o alcance |
|---|:---:|:---:|:---:|---|
| `view_dashboard` | Sí | Sí | Sí | KPI agregados y alertas para los tres roles. |
| `view_reports` | Sí | Sí | Sí | Reportes derivados de registros existentes. |
| `export_reports` | Sí | No | Sí | Solo lectura/exportación; el Gerente no edita. |
| `view_history` | Sí | Sí | Sí | Consulta agregada; en Inspector se limita a registros permitidos. |
| `view_history_detail` | Sí | No | No | Detalle individual de cualquier inspector; exclusivo de jefatura. |
| `view_own_inspection_result` | Sí | Sí | No | Resultado individual propio, ya completado; no abre detalle de otros. |
| `export_history` | Sí | No | Sí | Respeta filtros activos. |
| `view_audit` | Sí | No | Sí | Bitácora en modo lectura; el Inspector no tiene acceso. |
| `view_approval_queues` | Sí | No | No | Única entrada `quality-approvals` con secciones por tipo de pendiente. |
| `manage_plan` | Sí | No | No | Crear y editar planes y criterios. |
| `submit_plan` | Sí | No | No | `draft` o `rejected` con criterios. |
| `approve_plan` | Sí | No | No | `pending_approval`. |
| `reject_plan` | Sí | No | No | `pending_approval`; justificación obligatoria. |
| `delete_plan` | Sí | No | No | Sin historial. |
| `version_plan` | Sí | No | No | Aprobado con historial. |
| `manage_checklist` | Sí | No | No | Crear y editar listas. |
| `submit_checklist` | Sí | No | No | `draft` o `rejected` con criterios. |
| `approve_checklist` | Sí | No | No | `pending_approval`. |
| `reject_checklist` | Sí | No | No | `pending_approval`; justificación obligatoria. |
| `delete_checklist` | Sí | No | No | Sin historial. |
| `version_checklist` | Sí | No | No | Aprobada con historial. |
| `create_document` | Sí | Sí | No | - |
| `edit_document` | Sí | Sí | No | Inspector solo en `draft`. |
| `submit_document` | Sí | Sí | No | `draft` completo y previsualizable. |
| `approve_document` | Sí | No | No | `pending_review`; archivo previsualizable. |
| `reject_document` | Sí | No | No | `pending_review`; justificación obligatoria. |
| `delete_document` | Sí | Sí | No | Inspector solo `draft` sin historial. |
| `version_document` | Sí | No | No | `approved` con historial. |
| `execute_inspection` | Sí | Sí | No | Plan y lista `approved`. |
| `submit_inspection` | Sí | Sí | No | `draft` completo. |
| `review_inspection` | Sí | No | No | `pending_review` o `completed` con `proposed_result = conditional` y `review_decision = null`. |
| `override_inspection` | Sí | No | No | `completed`; justificación obligatoria; nunca genera NC. |
| `attach_evidence` | Sí | Sí | No | Entidad existente y permitida; PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados. |
| `delete_evidence` | Sí | Sí | No | Autor o Jefe; entidad no bloqueada por integridad. |
| `create_non_conformance` | Sí | Sí | No | Inspección asociada cuando exista; la creación manual no exige reprobación. |
| `edit_non_conformance` | Sí | Sí | No | NC existente. |
| `close_non_conformance` | Sí | Sí | No | Puede cerrarse sin CAPA aprobada. |
| `delete_non_conformance` | Sí | No | No | Según integridad; en cascada elimina CAPA y evidencia. |
| `propose_capa` | Sí | Sí | No | NC existente. |
| `edit_capa` | Sí | Sí | No | CAPA existente. |
| `complete_capa` | Sí | Sí | No | Reportar ejecución; deja `closure_status = pending`. |
| `request_capa_closure` | Sí | Sí | No | `status = completed`. |
| `review_capa_closure` | Sí | No | No | `closure_status = pending`; eficacia registrada antes de aprobar. |
| `register_effectiveness` | Sí | No | No | Revisión `effective`/`not_effective` con observaciones. |
| `configure_alerts` | Sí | No | No | Crear, desactivar y eliminar reglas. |
| `delete_records` | Sí | Sí | No | Jefe según integridad; Inspector solo borradores sin historial permitidos. |
| `clear_data` | Sí | No | No | Limpieza total de demo. |

Las acciones no listadas no están permitidas para ningún rol. La generación automática de NC no es una acción de interfaz: ocurre dentro de `review_inspection` cuando se cumplen las reglas del motor.

## 4. Reglas contextuales

### 4.1 Estados de inspección

- `inspection_status` solo admite `draft`, `pending_review` y `completed`. `conditional` es resultado, nunca estado.
- `review_inspection` es válida en `pending_review` o en el caso heredado `completed` con `proposed_result = conditional` y `review_decision = null`. Cualquier decisión retira el registro de la bandeja, inclusive `approved_conditional` con resultado `conditional`.
- Un legado `completed` con resultado distinto de `conditional` es final; no admite `review_inspection`, solo `override_inspection`.
- `override_inspection` conserva `completed`, exige justificación y no genera NC aunque el resultado sea `failed`.
- La guarda de críticos fallidos o sin medición bloquea `approved` y `approved_conditional`; por sí sola no crea NC.

### 4.2 Planes, listas y documentos

- `approve_*`/`reject_*` solo son válidos en el estado pendiente correspondiente.
- `submit_*` solo es válido en `draft` o `rejected` con campos y criterios completos.
- `version_*` solo es válido en `approved` con historial; una versión aprobada no se edita en la misma versión.
- `archived` queda fuera del flujo de aprobación y no se ofrece en inspecciones.

### 4.3 CAPA

- `status` y `closure_status` son independientes. `completed` significa ejecución reportada, no cierre aprobado.
- Solo `jefe_calidad` ejecuta `review_capa_closure` y `register_effectiveness`.
- Aprobar el cierre exige eficacia registrada; rechazarlo fija `closure_status = rejected` y `status = in_progress`.
- Cerrar una NC no exige que sus CAPA tengan cierre aprobado; la cuarentena se deriva de NC `open` o `under_review`.

### 4.4 Información sensible

- `view_history_detail` permite ver el detalle individual de otros inspectores solo a jefatura.
- `view_own_inspection_result` permite al Inspector consultar el resultado de sus propias inspecciones completadas, sin exponer el detalle de terceros.
- `view_audit` es de Jefe y Gerente; el Inspector no ve la bitácora, aun en modo lectura.
- `gerente` ve KPI agregados y alertas, pero no controles de creación, edición, eliminación ni aprobación.

### 4.5 Evidencia y exportación

- La evidencia se adjunta a inspección, NC, CAPA o documento existente.
- El Inspector no elimina evidencia ajena cuando la interfaz distingue autor; el Jefe sí.
- Inspector no exporta; Jefe y Gerente exportan reportes e historial respetando filtros.

## 5. Contrato de UI

- Cada botón, enlace o control de acción declara `data-permission="action"`. Cuando la acción dependa del estado, la vista entrega el contexto a `applyPermissionState`.
- `applyPermissionState(root, role, context)` debe:
  - ocultar o deshabilitar las acciones no permitidas según `can()`;
  - añadir `aria-disabled="true"` y un título explicativo cuando se deshabilite;
  - mostrar un mensaje que indique el permiso requerido si se invoca una acción bloqueada;
  - no alterar datos, estado del registro ni auditoría.
- Las vistas de solo lectura muestran "Modo solo lectura" y no renderizan formularios editables.
- Al cambiar el rol se recalculan todas las acciones y se vuelve a renderizar la vista activa, incluidos formularios abiertos; no se conserva ningún permiso del rol anterior.
- La UI oculta o deshabilita, pero la operación vuelve a validar con `assertCan()` antes de persistir.

```js
const context = {
  inspectionStatus: inspection.inspection_status,
  proposedResult: inspection.proposed_result,
  reviewDecision: inspection.review_decision
};

if (!can(role, 'review_inspection', context)) {
  showPermissionMessage('review_inspection');
  return;
}

assertCan(role, 'review_inspection', context);
```

```html
<button data-permission="review_inspection">Revisar inspección</button>
<button data-permission="view_audit">Ver bitácora</button>
<button data-permission="view_own_inspection_result">Ver mi resultado</button>
```

## 6. Errores

| Situación | Resultado |
|---|---|
| Rol inválido | `can()` devuelve `false`; `assertCan()` lanza `PERMISSION_DENIED`. |
| Acción no permitida | Error `PERMISSION_DENIED`: "No tienes permiso para realizar esta acción." |
| Acción permitida pero estado inválido | Error `INVALID_STATE` con el motivo. |
| Acción bloqueada | No se persiste, no cambia el estado y no se escribe auditoría. |
| Intento de ver detalle ajeno o bitácora sin permiso | No se renderiza la información y se explica el permiso requerido. |

## 7. Pruebas obligatorias

- Matriz completa para los tres roles y todas las acciones, incluidas `view_history_detail`, `view_own_inspection_result`, `view_audit` y `view_approval_queues`.
- Verificación explícita: Inspector sin bitácora, sin detalle individual de otros inspectores y sin bandejas; Gerente sin escritura y con exportación permitida.
- `can()` con rol inválido devuelve `false`; `assertCan()` lanza `PERMISSION_DENIED`.
- Estados de inspección: revisión normal, revisión legada condicional sin decisión, salida de bandeja con cualquier decisión, legado no condicional final y override sin NC.
- CAPA: cierre y eficacia solo Jefe; eficacia obligatoria antes de aprobar; rechazo con `closure_status = rejected` y `status = in_progress`.
- Documento en borrador editable por Inspector; aprobado no editable.
- Cambio de rol en una vista o formulario abierto recalcula acciones y contenido sensible.
- Invocación directa de una acción bloqueada no escribe datos ni auditoría.
- `applyPermissionState` oculta o deshabilita `data-permission` con `aria-disabled` y mensaje.
