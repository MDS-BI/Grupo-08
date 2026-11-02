# Tareas: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Entrada**: [plan.md](plan.md), [data-model.md](data-model.md), [spec.md](spec.md)  
**Contratos**: [quality-storage.md](contracts/quality-storage.md), [inspection-engine.md](contracts/inspection-engine.md)  
**Fuente de verdad**: `specs/002-quality-control-module/`. Los documentos de la raíz son históricos.

**Convenciones**: `[x]` completado; `[ ]` pendiente; `[P]` paralelizable con otras tareas de la misma fase. Las pruebas deben escribirse antes o junto con la implementación; ninguna tarea de implementación se cierra sin su prueba asociada.

## Responsables y fechas por fase

| Fase | Responsable principal | Apoyo | Fecha objetivo |
| :--- | :--- | :--- | :--- |
| Fase 1: Documentación y modelo | Analista de datos | Documentación | Octubre - primera semana de noviembre |
| Fase 2: Especificación y planificación | Documentación | Analista de datos | Semana 1-2 de noviembre |
| Fase 3: Implementación frontend | Desarrollo frontend | QA | Semana 3-4 de noviembre |
| Fase 4: Pruebas, integración y cierre | QA | Desarrollo frontend / Documentación | Semana del 30 de noviembre |

## Fase 1: Documentación y modelo — Completada

- [x] **T001** Corregir en `data-model.md` los tipos de `expected_value`, `tolerance` y `measured_value` a numéricos; agregar `unit`, `comparison_type` e `is_critical`.
- [x] **T002** Unificar el vocabulario entre README, MER, plan, spec y `data-model.md` usando una sola fuente de verdad (`quality_inspection_*`).
- [x] **T003** Reflejar `Historias-Usuarios.md` en `spec.md` con prioridades y criterios Dado/Cuando/Entonces.
- [x] **T004** Resolver la decisión entre identificadores `INT` y `string`, y entre `localStorage` y un servicio compartido; documentarla en `plan.md` y `contracts/`.
- [x] **T005** Marcar las copias de `plan.md` y `data-model.md` en la raíz como documentos históricos y redirigir a `specs/002-quality-control-module/`.
- [x] **T006** Mantener alineados `contracts/quality-storage.md` y `contracts/inspection-engine.md` con el modelo corregido.

## Fase 2: Especificación y planificación — En curso

- [x] **T010** Definir el alcance MVP y las exclusiones (inventario, proveedores, devoluciones, IoT, valorización monetaria y métricas por línea).
- [x] **T011** Escribir criterios de aceptación Dado/Cuando/Entonces por historia: lotes pendientes, planes, inspecciones, no conformidades, CAPA, revisión, cuarentena, dashboard e historial.
- [x] **T012** Asignar responsables por fase y fechas de entrega en `tasks.md`.
- [x] **T013** Crear y actualizar el checklist de requisitos en `checklists/requirements.md`.
- [ ] **T014** Acordar y definir los datos semilla de productos, empleados, recepciones, órdenes y despachos en `src/seed-data.js`.

## Fase 3: Implementación frontend

### Base e integración

- [ ] **T020** Restaurar o implementar el código del módulo base (`index.html` y `src/`) ausente desde el commit `a0062c0`. Bloquea toda la fase.
- [ ] **T021** [P] Adaptar `module-config.js` con el nombre, términos y color de acento de Control de Calidad.
- [ ] **T022** Extender `storage.js` con las colecciones de calidad, los campos del contrato y las operaciones `loadCollection`, `saveCollection`, `addRecord`, `updateRecord`, `deleteRecord` y `deleteRelated`.
- [ ] **T023** Implementar la validación de `reference_module` + `reference_id` contra las colecciones externas y el rechazo de referencias huérfanas.
- [ ] **T024** [P] Cargar `src/seed-data.js` en el entorno de demo y pruebas.
- [ ] **T025** [P] Escribir pruebas unitarias de almacenamiento, cascadas de eliminación y validación de referencias (`tests/unit/`).

### Planes y criterios

- [ ] **T030** Implementar `quality-plan-config.js` como vista maestro-detalle de planes por producto y etapa.
- [ ] **T031** Permitir crear, editar y eliminar criterios con valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- [ ] **T032** Validar que un plan requiera producto, nombre, etapa canónica y al menos un criterio, y que los criterios tengan tipos válidos.
- [ ] **T033** Bloquear edición y eliminación de planes/criterios con inspecciones históricas; permitir duplicar el plan para crear una nueva versión.
- [ ] **T034** [P] Escribir pruebas unitarias de validación, bloqueo histórico y duplicación de planes (`tests/unit/`).

### Lotes pendientes

- [ ] **T040** Implementar `pending-lots.js` con la tabla de ID de lote, producto, fecha, estado y acción "Inspeccionar".
- [ ] **T041** Derivar los lotes pendientes comparando documentos origen externos con inspecciones `completed`; una inspección `draft` no marca el lote como inspeccionado.
- [ ] **T042** [P] Escribir pruebas de derivación de lotes pendientes y de actualización tras completar una inspección.

### Motor de inspección

- [ ] **T050** Implementar en `inspection-engine.js` la función pura `evaluateInspection(plan, measurements)`.
- [ ] **T051** Calcular `pass_fail` por criterio según `range`, `min`, `max` o `boolean`, con tolerancias inclusivas.
- [ ] **T052** Derivar `overall_result` solo cuando la inspección esté completa; devolver `status: "incomplete"` y `missing_criteria_ids` cuando falte una medición.
- [ ] **T053** Implementar la pantalla de inspección: selector de origen, inspector, fecha, estado `draft`/`completed` y formulario de mediciones.
- [ ] **T054** Bloquear el ingreso manual de `pass_fail` y `overall_result`.
- [ ] **T055** Implementar el cambio de dictamen con `override_justification`, `overridden_by` y `override_at`; bloquear `passed` con criterios críticos fallidos o sin medición.
- [ ] **T056** [P] Escribir pruebas unitarias del motor: comparaciones, límites inclusivos, inspección incompleta y dictamen (`tests/unit/`).
- [ ] **T057** [P] Escribir pruebas de integración del flujo de inspección: referencia huérfana, borrador, completado y override (`tests/integration/`).

### No conformidades y CAPA

- [ ] **T060** Generar un borrador de no conformidad cuando `overall_result = failed`, con descripción autogenerada, producto del plan, tipo de defecto `other`, severidad `major` y estado `open`; exigir descripción no vacía.
- [ ] **T061** Implementar `non-conformance-capa.js` con clasificación de tipo de defecto, severidad y estado de la no conformidad.
- [ ] **T062** Permitir crear acciones CAPA con responsable, descripción, causa raíz, tipo de acción (`resampling`, `rework`, `other`), `due_date` y estado.
- [ ] **T063** Marcar visualmente las acciones CAPA vencidas sin cambiar su estado automáticamente.
- [ ] **T064** [P] Escribir pruebas de no conformidad automática, descripción obligatoria y validación de CAPA (`tests/integration/`).

### Revisión condicional y cuarentena

- [ ] **T070** Implementar la bandeja de revisión para inspecciones `conditional` con marca visible y acceso al cambio de dictamen.
- [ ] **T071** Implementar la pestaña de cuarentena con ID de lote, producto, severidad, tipo de defecto y acceso a la acción CAPA; mostrar "Cuarentena - En tratamiento" cuando exista CAPA.
- [ ] **T072** [P] Escribir pruebas de revisión condicional y derivación de cuarentena (`tests/integration/`).

### Dashboard e historial

- [ ] **T080** Implementar `dashboard.js` con tasa de aprobación, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes (`draft`).
- [ ] **T081** Agregar el análisis de Pareto de productos y etapas con mayor concentración de no conformidades.
- [ ] **T082** Implementar `inspection-history.js` con filtros por lote (documento origen) y rango de fechas.
- [ ] **T083** Agregar la acción de limpiar filtros y la validación de rango de fechas inválido.
- [ ] **T084** Implementar estados vacíos claros en dashboard, lotes pendientes, cuarentena, historial y revisión condicional.
- [ ] **T085** Restringir el detalle individual por inspector al rol de jefatura y mostrar métricas agregadas por producto o etapa.
- [ ] **T086** [P] Escribir pruebas de dashboard, historial, filtros, estados vacíos, eficacia CAPA y restricción por rol (`tests/integration/`).

## Fase 4: Pruebas, calidad, integración y cierre

- [ ] **T090** Definir y configurar lint, formato y análisis estático; agregar los comandos al `package.json`.
- [ ] **T091** Revisar accesibilidad y consistencia de UX: navegación por teclado, etiquetas, mensajes de error, confirmaciones y estados de carga.
- [ ] **T092** Ejecutar pruebas de rendimiento y usabilidad: 10 criterios en menos de 3 minutos; con hasta 500 inspecciones, consultas y dashboard en menos de 2 segundos; búsqueda filtrada en menos de 1 segundo percibido.
- [ ] **T093** Cubrir con pruebas de integración el flujo completo lote pendiente → inspección → no conformidad → CAPA → historial.
- [ ] **T094** Probar el rechazo de referencias huérfanas, identificadores inválidos y operaciones de eliminación bloqueadas.
- [ ] **T095** Verificar que `npm run dev` ejecuta la aplicación, `npm test` pasa la suite y los comandos de calidad no tienen errores bloqueantes.
- [ ] **T096** Actualizar el README con el flujo del módulo, datos semilla, estados y reglas de integridad.
- [ ] **T097** Ejecutar la versión integrada con el módulo base y validar la navegación entre vistas.
- [ ] **T098** Preparar la presentación de 5 minutos, medir la tasa de éxito del flujo completo en la demo (objetivo ≥ 90 %) y realizar la coevaluación.
- [ ] **T099** Re-ejecutar `/speckit.analyze` y confirmar que no quedan hallazgos críticos ni altos.

## Dependencias

- T014 y T020 bloquean toda la Fase 3.
- T022–T023 bloquean T030–T033, T040–T041, T050–T055 y T060–T062.
- T033 depende de T030–T032.
- T040–T041 dependen de T022–T024.
- T050–T052 bloquean T053–T055, T060 y T070.
- T060–T062 bloquean T063, T070–T071 y T080–T081.
- T080–T085 bloquean T086.
- T090–T094 bloquean T095 y T097.
- T020 y T097 requieren restaurar el código del módulo base.

## Fuera del MVP

- Bloqueo automático de inventario.
- Calificación de proveedores.
- Inspección de devoluciones (`returns_rma`).
- Integración IoT y captura automatizada de mediciones.
- Valorización monetaria de no calidad y métricas por línea de producción.
