# Contrato de Almacenamiento de Control de Calidad

## Propósito

El módulo almacena sus registros localmente en el navegador con `localStorage`, usando identificadores `string` y marcas de tiempo ISO, de forma coherente con el [contrato del módulo base](../../001-erp-base-module/contracts/entity-storage.md). El modelo relacional de `data-model.md` se conserva como diseño lógico; si se adopta, debe existir una capa de mapeo explícita `INT ↔ string`.

## Colecciones

Cada colección se persiste como una lista bajo su propia clave:

- `quality_inspection_plans`
- `quality_inspection_criteria`
- `quality_inspections`
- `quality_inspection_results`
- `non_conformances`
- `corrective_actions`

## Formas de los Datos

### Plan de inspección

- `id`: cadena única.
- `inspection_plan_id`: cadena única, generada automáticamente.
- `product_id`: cadena que referencia un producto existente en las dependencias externas.
- `plan_name`: cadena no vacía.
- `applicable_stage`: `incoming` | `in_process` | `final`.
- `is_locked`: booleano; `true` si el plan tiene inspecciones históricas.
- `createdAt` / `updatedAt`: marcas de tiempo ISO.

### Criterio de inspección

- `id`: cadena única.
- `criteria_id`: cadena única, generada automáticamente.
- `inspection_plan_id`: cadena de un plan existente.
- `criteria_name`: cadena no vacía.
- `expected_value`: número.
- `tolerance`: número no negativo.
- `unit`: cadena no vacía.
- `comparison_type`: `range` | `min` | `max` | `boolean`.
- `is_critical`: booleano.
- `is_locked`: booleano; `true` si el criterio tiene resultados históricos.
- `createdAt` / `updatedAt`: marcas de tiempo ISO.

### Inspección

- `id`: cadena única.
- `inspection_id`: cadena única, generada automáticamente.
- `inspection_plan_id`: cadena de un plan existente.
- `inspector_id`: cadena de un empleado existente en las dependencias externas.
- `reference_module`: `goods_receipt` | `production_order` | `shipment`.
- `reference_id`: cadena que debe existir en la colección del módulo indicado.
- `inspection_date`: cadena de fecha válida (`YYYY-MM-DD`).
- `inspection_status`: `draft` | `completed`.
- `overall_result`: `passed` | `failed` | `conditional`; `null` mientras `inspection_status = draft`.
- `override_justification`: cadena opcional; obligatoria si el jefe de calidad cambia el dictamen.
- `overridden_by`: cadena opcional; obligatoria si cambia el dictamen.
- `override_at`: marca de tiempo ISO opcional; obligatoria si cambia el dictamen.
- `createdAt` / `updatedAt`: marcas de tiempo ISO.

### Resultado de inspección

- `id`: cadena única.
- `result_id`: cadena única, generada automáticamente.
- `inspection_id`: cadena de una inspección existente.
- `criteria_id`: cadena de un criterio existente.
- `measured_value`: número.
- `pass_fail`: booleano calculado; nunca se ingresa manualmente.
- `createdAt` / `updatedAt`: marcas de tiempo ISO.

### No conformidad

- `id`: cadena única.
- `non_conformance_id`: cadena única, generada automáticamente.
- `inspection_id`: cadena de una inspección existente.
- `product_id`: cadena de un producto existente, tomada del plan.
- `description`: cadena no vacía; autogenerada y editable.
- `defect_type`: `dimensional` | `functional` | `packaging` | `other`; por defecto `other` al autogenerarse.
- `severity`: `minor` | `major` | `critical`; por defecto `major` al autogenerarse.
- `status`: `open` | `under_review` | `closed`; por defecto `open`.
- `createdAt` / `updatedAt`: marcas de tiempo ISO.

### Acción CAPA

- `id`: cadena única.
- `corrective_action_id`: cadena única, generada automáticamente.
- `non_conformance_id`: cadena de una no conformidad existente.
- `responsible_employee_id`: cadena de un empleado existente.
- `action_description`: cadena no vacía.
- `root_cause`: cadena no vacía.
- `action_type`: `resampling` | `rework` | `other`.
- `due_date`: cadena de fecha válida (`YYYY-MM-DD`).
- `status`: `pending` | `in_progress` | `completed`.
- `createdAt` / `updatedAt`: marcas de tiempo ISO.

## Operaciones

- `loadCollection(name)`: devuelve la lista persistida de la colección.
- `saveCollection(name, records)`: persiste la lista completa.
- `addRecord(name, record)`: añade un registro generando su identificador.
- `updateRecord(name, id, updates)`: actualiza un registro existente y su `updatedAt`.
- `deleteRecord(name, id)`: elimina un registro por id.
- `deleteRelated(name, foreignKey, id)`: elimina registros dependientes (por ejemplo, resultados de una inspección o CAPA de una no conformidad).
- `derivePendingLots(externalDocuments, inspections)`: devuelve los documentos origen sin inspección `completed`.
- `deriveQuarantineLots(nonConformances, correctiveActions)`: devuelve los lotes con no conformidad `open`/`under_review` y el estado de tratamiento CAPA.

## Expectativas de Validación

- Un plan sin `product_id` existente, `plan_name`, etapa canónica o al menos un criterio debe rechazarse o no habilitarse para inspecciones.
- Un criterio con `expected_value`, `tolerance`, `unit` o `comparison_type` inválidos debe rechazarse.
- Una inspección con `reference_module` no canónico o `reference_id` inexistente debe rechazarse antes de persistir.
- `pass_fail` y `overall_result` deben ser derivados y no aceptarse como entrada directa.
- Una inspección no puede pasar a `completed` si falta la medición de cualquier criterio o algún valor no es numérico; permanece `draft`.
- Una inspección con criterios críticos fallidos o sin medición no puede guardarse como `passed`, incluso con justificación. Los cambios de dictamen permitidos registran `override_justification`, `overridden_by` y `override_at`.
- El borrador de no conformidad generado por `failed` debe tener descripción no vacía, producto del plan, tipo de defecto `other`, severidad inicial `major` y estado `open`.
- Toda acción CAPA debe tener `responsible_employee_id`, `action_description`, `root_cause`, `action_type` y `due_date`.
- Un plan o criterio con resultados históricos (`is_locked = true`) no puede editarse ni eliminarse.
- Eliminar un plan sin inspecciones debe eliminar sus criterios; eliminar una inspección sin no conformidad debe eliminar sus resultados; eliminar una inspección con no conformidad debe bloquearse; eliminar una no conformidad debe eliminar sus acciones CAPA.
- Las operaciones deben preservar el orden de la lista y actualizar las marcas de tiempo.
- Las vistas de dashboard, lotes pendientes, cuarentena, historial y revisión condicional deben mostrar un estado vacío claro cuando no haya registros.

## Expectativas de Integración

- Productos, empleados, recepciones, órdenes de producción y despachos no se crean en este módulo; se validan contra datos semilla (`src/seed-data.js`) o colecciones externas.
- El "lote" es el documento origen (`reference_module` + `reference_id`); no existe una colección `lots`.
- Los lotes pendientes se calculan comparando los documentos origen externos con las inspecciones `completed`.
- Si se adopta el modelo `INT` de `data-model.md`, el contrato debe ampliarse con una capa de mapeo explícita entre identificadores.
