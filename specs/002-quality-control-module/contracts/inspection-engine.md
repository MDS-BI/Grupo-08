# Contrato del Motor de Inspección

## Propósito

Define la evaluación determinista de criterios, el cálculo de `proposed_result`, la derivación de `overall_result`, la bandeja de revisión, el disparador de no conformidad y la forma de la auditoría. Es una capa pura: no lee ni escribe `localStorage`, no renderiza interfaz, no aplica permisos y no persiste registros. Devuelve valores y descriptores de efectos que la capa de almacenamiento ejecuta después de validar permisos con `assertCan()`.

La fuente canónica de terminología es `spec.md`. `conditional` es un resultado, nunca un valor de `inspection_status`.

## 1. Entradas y funciones

```js
evaluateInspection({ plan, checklist, measurements, options })
deriveProposedResult(results)
deriveFinalResult(proposedResult, reviewDecision, context)
deriveOverrideResult(inspection, targetResult, context)
isReviewQueueItem(inspection)
isPendingInspection(inspection)
shouldCreateNonConformance(inspection, priorNonConformances, context)
approvalRate(inspections, stage)
auditEventForDecision(inspection, reviewDecision, context)
```

- `plan`: plan `approved` con criterios `criteria_id`, `expected_value`, `tolerance`, `unit`, `comparison_type` e `is_critical`.
- `checklist`: opcional; lista `approved`. Si se entrega, sus criterios también se evalúan.
- `measurements`: `{ criteria_id, measured_value }` por cada criterio evaluado.
- `options.strict`: default `true`. Con `false` se permite evaluación parcial, pero nunca habilita envío a revisión.
- `context`: incluye como mínimo `sourceStatus`, `hasCriticalFailures`, `hasMissingMeasurements`, `justification`, `actor` y `now` cuando aplica.
- Todas las funciones son puras y deterministas: los mismos datos producen el mismo valor y el mismo orden de arreglos.

## 2. Evaluación por criterio

| `comparison_type` | Regla de cumplimiento |
|---|---|
| `range` | `expected_value - tolerance <= measured_value <= expected_value + tolerance`. |
| `min` | `measured_value >= expected_value`. |
| `max` | `measured_value <= expected_value`. |
| `boolean` | `measured_value` coincide con `expected_value` con codificación `1 = cumple`, `0 = no cumple`. |

Las tolerancias son inclusivas: un valor exactamente en el límite se considera cumplido. `measured_value` vacío, no numérico, `NaN` o `Infinity` invalida la evaluación y se reporta en `invalid_criteria_ids`.

```js
{ criteria_id, measured_value, pass_fail, is_critical }
```

`pass_fail` siempre se calcula; la entrada manual está prohibida.

## 3. Completitud

Una inspección está completa solo si hay una medición numérica válida para todos los criterios del plan y de la lista.

```js
{
  status: 'incomplete',
  missing_criteria_ids: [],
  invalid_criteria_ids: [],
  proposed_result: null,
  overall_result: null,
  results: []
}
```

- La interfaz mantiene `inspection_status = draft` y no habilita "Enviar a revisión".
- No se inventan mediciones ni dictámenes por defecto.
- Con `options.strict = false` se pueden devolver resultados parciales para vista previa, pero `proposed_result` sigue siendo `null`.

## 4. Dictamen propuesto

Solo cuando la inspección está completa:

```js
{
  status: 'complete',
  proposed_result: 'passed' | 'conditional' | 'failed',
  overall_result: null,
  results: [],
  failed_criteria_ids: [],
  critical_failed_criteria_ids: []
}
```

Reglas:

- `failed` si falla al menos un criterio crítico.
- `conditional` si no hay fallos críticos y falla al menos un criterio no crítico.
- `passed` si todos los criterios se evalúan y cumplen.
- `overall_result` permanece `null`; solo se deriva en revisión.
- El motor no genera NC.

## 5. Revisión final

```js
deriveFinalResult(proposedResult, reviewDecision, context)
```

### 5.1 Elegibilidad

La revisión final solo es válida si `context.sourceStatus` es:

- `pending_review`; o
- `completed` con `proposed_result = conditional` y `review_decision = null` (caso heredado/excepción).

Un registro `completed` con `review_decision = null` y resultado distinto de `conditional` es final: no entra en bandeja y cualquier cambio posterior se modela con `deriveOverrideResult`, no con una nueva revisión.

### 5.2 Mapeo y guardas

| `reviewDecision` | `overall_result` | Guardas |
|---|---|---|
| `approved` | `passed` | Sin criterios críticos fallidos y sin mediciones faltantes. Si el propuesto era `conditional` o `failed`, la justificación es obligatoria por diferencia. |
| `approved_conditional` | `conditional` | Sin criterios críticos fallidos y sin mediciones faltantes. Justificación obligatoria por ser condicional y cuando difiera del propuesto. |
| `rejected` | `failed` | Justificación obligatoria. Es el único disparador de NC automática, si además se cumplen las condiciones de la sección 7. |

- `approved` no puede convertir en `passed` una inspección con críticos fallidos o sin medición; la guarda bloquea y no genera NC.
- Si solo hay desviaciones no críticas, la decisión coherente es `approved_conditional`; si el Jefe elige `approved`, debe quedar registrada la justificación de la diferencia y el resultado es `passed`.
- `review_decision`, `reviewed_by`, `reviewed_at` y `review_justification` se fijan en la operación de persistencia junto con `overall_result`.
- Desde `pending_review`, la persistencia fija `inspection_status = completed`. Desde el legado condicional, conserva `completed`. En ningún caso se registra una auditoría adicional por ese cambio de estado.

### 5.3 Resultado devuelto

```js
{
  overall_result: 'passed' | 'conditional' | 'failed',
  review_decision: 'approved' | 'approved_conditional' | 'rejected',
  next_status: 'completed',
  justification_required: true | false,
  nc_trigger: true | false,
  audit: auditDescriptor
}
```

## 6. Override posterior

```js
deriveOverrideResult(inspection, targetResult, context)
```

- Exige `inspection_status = completed`, justificación no vacía, `actor` y `now`.
- Rechaza `passed` con críticos fallidos o mediciones faltantes.
- No permite dejar el dictamen igual que el actual; ese caso se reporta como sin cambio.
- Conserva `inspection_status = completed`.
- Nunca genera NC, incluso si `targetResult = failed`.
- Devuelve `override_justification`, `overridden_by` y `override_at` para persistir.
- Devuelve un único descriptor de auditoría `status_change` sobre `overall_result`; no emite `update` ni una segunda decisión `approve`/`reject`.

## 7. Bandeja de revisión, NC y KPIs

```js
isReviewQueueItem(inspection)
```

Devuelve `true` para:

- `inspection_status = pending_review`; o
- `inspection_status = completed`, `proposed_result = conditional` y `review_decision = null`.

Devuelve `false` para cualquier otro registro `completed`, incluido el legado con resultado distinto de `conditional`. La bandeja no depende únicamente de `legacy_completed`: esa marca solo identifica el origen migrado. Cualquier `review_decision` registrada retira el registro de la bandeja, aunque el resultado final sea `conditional`.

```js
shouldCreateNonConformance(inspection, priorNonConformances, context)
```

Devuelve `true` solo si se cumplen todas estas condiciones:

1. La decisión se emite desde `pending_review` o desde el legado `completed` condicional sin decisión.
2. `review_decision = rejected` y, por tanto, `overall_result = failed`.
3. No existe una NC asociada previa.

Devuelve `false` para `approved`, `approved_conditional`, overrides, cambios manuales, la guarda de críticos fallidos o sin medición y la creación manual de NC. Cuando es `true`, el descriptor de NC usa descripción autogenerada de los criterios incumplidos, producto y lote del origen, `defect_type = other`, `severity = major`, `status = open` y descripción editable no vacía.

```js
isPendingInspection(inspection)
```

Devuelve `true` solo para `draft` o `pending_review`. El legado `completed` condicional sin decisión se gestiona en la bandeja y no cuenta como pendiente del dashboard.

```js
approvalRate(inspections, stage)
```

Calcula `count(completed && passed) / count(completed && overall_result IN (passed, conditional, failed))`, con 0 si el denominador es 0. `conditional` está en el denominador y fuera del numerador. `draft`, `pending_review` y `overall_result = null` no participan. Si se indica `stage`, el filtro se aplica sobre la etapa derivada del `reference_module`.

## 8. Integración con operaciones de storage

- `submitInspectionForReview` valida permiso, llama a `evaluateInspection`, guarda resultados y `proposed_result` y registra `status_change`.
- `reviewInspection` valida permiso y elegibilidad, llama a `deriveFinalResult`, persiste decisión y estado, ejecuta el descriptor de NC si corresponde y registra una sola entrada de decisión.
- `overrideInspection` valida permiso, llama a `deriveOverrideResult` y registra una sola `status_change`.
- La UI muestra por separado el dictamen propuesto y el final. El estado `approved_conditional` se etiqueta visualmente como "Aprobado" y su resultado como "Condicional".

## 9. Auditoría devuelta por el motor

```js
auditEventForDecision(inspection, reviewDecision, context)
```

Devuelve un descriptor con:

- `action = approve` si la decisión es `approved` o `approved_conditional`; `reject` si es `rejected`.
- `changed_field = overall_result`.
- `before_value = overall_result` previo, que puede ser `null`.
- `after_value` con `overall_result`, `review_decision`, `reviewed_by`, `reviewed_at` y justificación cuando corresponda.
- `actor`: empleado de la operación o rol activo como metadato.
- `timestamp = context.now`.
- `justification`: requerida por las guardas de la sección 5.

Reglas: no se devuelve descriptor para permisos denegados; no se devuelve un `status_change` adicional por pasar a `completed`; el override devuelve una sola `status_change` sobre `overall_result`. La capa de storage conserva la entrada tras eliminaciones permitidas y mantiene `reference_module` + `reference_id` para filtrar por lote.

## 10. Pruebas obligatorias

- Cada `comparison_type` con valor exactamente en el límite de tolerancia.
- Mediciones faltantes, vacías, no numéricas, `NaN` e `Infinity`: sin `proposed_result` y sin cambio de estado.
- Combinaciones de fallos críticos y no críticos para `passed`, `conditional` y `failed`.
- `approved` bloqueado con críticos fallidos o mediciones faltantes.
- `approved` con propuesto `conditional`, sin críticos y con justificación: permitido y con resultado `passed`.
- `approved_conditional` con solo desviaciones no críticas y con justificación obligatoria.
- `rejected` con NC solo desde origen elegible y sin NC previa.
- Override a `failed` después de `completed`: sin NC y con una sola `status_change`.
- Guarda de críticos fallidos o sin medición: sin NC.
- Bandeja: `pending_review` y legado condicional sin decisión entran; legado con otro resultado no entra; cualquier decisión los retira sin retroceder el estado.
- Dashboard: `pendingInspections` cuenta `draft` y `pending_review`, excluye el legado condicional en bandeja; `pending_review` no participa en `approvalRate`; `conditional` está solo en el denominador; `overall_result = null` se excluye; denominador 0 devuelve 0.
- Auditoría: una sola entrada de decisión con metadatos de revisión en `after_value`; sin `update` ni `status_change` duplicados; permiso denegado sin auditoría.
- Determinismo: mismas entradas producen el mismo resultado y el mismo orden de efectos.
