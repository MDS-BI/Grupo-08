# Contrato del Motor de Inspección

## Propósito

Define cómo se evalúan los criterios de un plan de inspección y cómo se deriva el dictamen global, de modo que la lógica sea determinista, testeable y no dependa de la interfaz.

## Entrada

`evaluateInspection(plan, measurements)` recibe:

- `plan`: plan con sus criterios; cada criterio incluye `criteria_id`, `expected_value`, `tolerance`, `unit`, `comparison_type` e `is_critical`.
- `measurements`: lista de `{ criteria_id, measured_value }` con un valor numérico por criterio.

## Evaluación por criterio

Para cada criterio se calcula `pass_fail` según `comparison_type`:

- `range`: cumple si `expected_value - tolerance <= measured_value <= expected_value + tolerance`.
- `min`: cumple si `measured_value >= expected_value`.
- `max`: cumple si `measured_value <= expected_value`.
- `boolean`: cumple si `measured_value` coincide con `expected_value` (1 = cumple, 0 = no cumple).

Las tolerancias son inclusivas en ambos límites.

## Inspección incompleta

Una inspección está completa solo si existe una medición numérica para todos los criterios del plan.

- Si falta la medición de cualquier criterio o algún valor no es numérico, el motor devuelve `status: "incomplete"`, la lista `missing_criteria_ids` y `overall_result: null`.
- La interfaz debe guardar o mantener la inspección como `draft` y no debe habilitar el dictamen.
- No existe un dictamen `passed` con criterios sin evaluar.

## Dictamen global

Cuando la inspección está completa, `overall_result` se deriva de los resultados:

- `failed`: falla al menos un criterio crítico.
- `conditional`: no falla ningún criterio crítico y existe al menos una desviación en criterios no críticos.
- `passed`: todos los criterios se evalúan y cumplen.

## Salida

```text
{
  status: "complete" | "incomplete",
  results: [
    { criteria_id, measured_value, pass_fail }
  ],
  missing_criteria_ids: [],
  overall_result: "passed" | "failed" | "conditional" | null
}
```

## Reglas

- `pass_fail` y `overall_result` nunca se reciben como entrada; siempre se calculan.
- Los valores deben ser numéricos; una medición no numérica se rechaza con un error de validación.
- La evaluación es pura: no lee ni escribe `localStorage` ni modifica el DOM.
- El cambio manual del dictamen por el jefe de calidad se registra fuera del motor, con `override_justification`, `overridden_by` y `override_at`.
- El cambio manual nunca puede convertir en `passed` una inspección con criterios críticos fallidos o sin medición.
- Una inspección con `overall_result = failed` habilita la creación de un borrador de no conformidad.
- Una inspección con `overall_result = conditional` se marca para revisión y no crea no conformidad.
