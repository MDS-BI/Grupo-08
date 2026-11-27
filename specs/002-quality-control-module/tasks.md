# Tareas: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Entrada**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md)  
**Contratos**: [quality-storage.md](contracts/quality-storage.md), [inspection-engine.md](contracts/inspection-engine.md), [quality-permissions.md](contracts/quality-permissions.md), [quality-workflow.md](contracts/quality-workflow.md)
**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/  
**Pruebas**: Incluidas por mandato de la constitución (Principio II, Test-First). Toda funcionalidad de FR-001–FR-083 debe contar con prueba unitaria, de integración o de UI escrita antes o junto al código; SC-001, SC-006, SC-010, SC-012 y SC-016 requieren instrumentación, y SC-008/SC-024 se verifican con lista de cotejo y resultados anónimos de demo.
**Dependencias de pruebas**: Cuando exista un par explícito prueba/implementación, la prueba bloquea su implementación: T099→T100, T101→T102, T103→T104, T105→T106, T107→T108, T109→T110, T111→T112, T113→T114, T115→T116→T135, T117→T118, T119→T120, T121→T122, T123→T124, T125→T126, T127→US2, T128→US10 y T129→T130. Las implementaciones US4/US8/US10/US2/US14 no se integran sin sus pruebas bloqueantes. T144 habilita los helpers de la matriz visual; T145–T148 se ejecutan antes de T136/T138/T143.
**Quality gates**: Cada entrega exige `npm test`, lint, `format:check`, build, verificación de UX y trazabilidad FR/SC; T131–T148 cierran la matriz visual US15, los contenedores derivados, la trazabilidad y el gate final. T142 debe completarse antes de depender de lint/format.
**Organización**: Las tareas conservan sus IDs históricos; no se renumera T001–T130. Las tareas nuevas usan T131 en adelante y se agrupan por historia o gate para permitir implementación y prueba independientes.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencia de tareas incompletas).
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1–US15) o `Quality` para gates transversales.
- Cada descripción incluye la ruta de archivo exacta y, cuando aplica, los FR/SC verificados.

## Convenciones de rutas

- Proyecto único: `src/` y `tests/` en la raíz del repositorio.
- Lógica pura de dominio en `src/`; vistas del módulo en `src/components/`.
- Pruebas unitarias en `tests/unit/`; pruebas de integración en `tests/integration/`.

---

## Fase 1: Setup (Infraestructura compartida)

**Propósito**: Restaurar la base Vite y preparar el entorno del módulo de calidad.

- [x] T001 Restaurar o implementar el código del módulo base ausente (`index.html`, `src/main.js`, `src/app.js`, `src/styles.css`, `src/components/shell.js`) desde `git restore --source=a0062c0^ -- index.html src` o según las especificaciones existentes.
- [x] T002 [P] Crear `src/seed-data.js` con datos semilla de productos, empleados, recepciones, órdenes de producción y despachos.
- [x] T003 [P] Configurar lint, formato y análisis estático en `package.json` y archivos de configuración en la raíz del repositorio. (Superseded por T094; conservada como histórica).
- [x] T004 [P] Configurar el entorno de pruebas Vitest con jsdom en `vitest.config.mjs` y `tests/setup/setup.js`. (Superseded por T095; conservada como histórica).

---

## Fase 2: Foundational (Prerrequisitos bloqueantes)

**Propósito**: Infraestructura de datos e integración que debe existir antes de cualquier historia de usuario.

**⚠️ CRÍTICO**: Ninguna historia de usuario puede iniciar hasta completar esta fase.

- [x] T005 Extender `src/storage.js` con las seis colecciones base de calidad (`quality_inspection_plans`, `quality_inspection_criteria`, `quality_inspections`, `quality_inspection_results`, `non_conformances`, `corrective_actions`) y las operaciones `loadCollection`, `saveCollection`, `addRecord`, `updateRecord`, `deleteRecord` y `deleteRelated` del contrato; `quality_evidence` y `quality_alert_rules` se añaden en T070/T076.
- [x] T006 Implementar en `src/storage.js` la validación de `reference_module` (`goods_receipt`, `production_order`, `shipment`) y la existencia de `reference_id` contra las colecciones externas, rechazando referencias huérfanas.
- [x] T007 Implementar en `src/storage.js` las funciones `derivePendingLots(externalDocuments, inspections)` y `deriveQuarantineLots(nonConformances, correctiveActions)`.
- [x] T008 Registrar y conectar las vistas de calidad en `src/app.js` y `src/module-config.js`, incluyendo nombre, términos y navegación del módulo.
- [x] T009 [P] Escribir pruebas unitarias de CRUD de almacenamiento, cascadas de eliminación y validación de referencias en `tests/unit/storage.test.js`.
- [x] T010 [P] Escribir pruebas unitarias de derivación de lotes pendientes y lotes en cuarentena en `tests/unit/derivations.test.js`.
- [x] T119 [P] [US11] Escribir pruebas unitarias de migración idempotente de planes, listas, documentos, inspecciones y CAPA en `tests/unit/quality-migrations.test.js` (FR-065): planes sin estado → `approved`, listas `active` → `approved`, `under_review` → `pending_review`, `archived` conservado como legado no seleccionable, inspecciones `completed` condicionales sin decisión marcadas para bandeja y CAPA con `status` y `closure_status` separados.
- [x] T120 [US11] Crear `src/quality-migrations.js` y ejecutarlo desde `src/storage.js` antes de renderizar cualquier bandeja o vista dependiente, sin perder criterios, evaluaciones, archivos ni historial (FR-065).

**Checkpoint**: La base de almacenamiento, integración, derivaciones y migración está lista; las historias pueden iniciar en paralelo.

---

## Fase 3: User Story 1 - Configurar planes y criterios de inspección (Priority: P1) 🎯 MVP

**Goal**: Permitir al Jefe de Calidad crear y mantener planes de inspección con criterios, valores esperados, tolerancias, unidades, tipos de comparación y criticidad.

**Independent Test**: Crear un plan para un producto y etapa, agregar criterios con valor esperado y tolerancia, enviarlo a aprobación, aprobarlo y verificar que solo entonces queda disponible para ejecutar inspecciones.

### Pruebas para User Story 1

- [x] T011 [P] [US1] Escribir pruebas unitarias de validación de planes/criterios, bloqueo histórico y duplicación en `tests/unit/quality-plan-config.test.js`.

### Implementación para User Story 1

- [x] T012 [US1] Implementar en `src/components/quality-plan-config.js` las funciones de validación de plan (nombre, producto existente, etapa canónica, al menos un criterio) y de criterio (valores numéricos, tolerancia no negativa, unidad no vacía, tipo de comparación canónico).
- [x] T013 [US1] Implementar en `src/components/quality-plan-config.js` la vista maestro-detalle de planes por producto y etapa.
- [x] T014 [US1] Implementar en `src/components/quality-plan-config.js` el alta, edición y eliminación de criterios con valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- [x] T015 [US1] Implementar en `src/components/quality-plan-config.js` la habilitación de planes solo cuando tengan al menos un criterio y validaciones con mensajes de error visibles.
- [x] T016 [US1] Implementar en `src/components/quality-plan-config.js` el bloqueo de edición/eliminación de planes y criterios con inspecciones históricas y la duplicación de plan como nueva versión.
- [x] T017 [US1] Agregar en `src/components/quality-plan-config.js` el estado vacío claro cuando no existan planes o criterios.

**Checkpoint**: User Story 1 está completa y es testeable de forma independiente.

---

## Fase 4: User Story 2 - Identificar lotes pendientes y ejecutar una inspección con evaluación automática (Priority: P2)

**Goal**: Mostrar lotes pendientes y permitir registrar mediciones en una inspección vinculada a un documento origen, calculando automáticamente `pass_fail` y `proposed_result`, con `overall_result` pendiente de la revisión del Jefe de Calidad.

**Independent Test**: Abrir la lista de lotes pendientes, iniciar una inspección sobre un origen válido, ingresar mediciones y comprobar que el dictamen se calcula sin intervención manual.

### Pruebas para User Story 2

- [x] T018 [P] [US2] Escribir pruebas unitarias del motor de tolerancias (comparaciones `range`, `min`, `max`, `boolean`, límites inclusivos, inspección incompleta y dictamen) en `tests/unit/inspection-engine.test.js`.
- [x] T019 [P] [US2] Escribir pruebas de integración del flujo de inspección (referencia huérfana, borrador, `pending_review`, decisión final y permanencia del lote como pendiente hasta `completed`) en `tests/integration/inspection-flow.test.js`.

### Implementación para User Story 2

- [x] T020 [P] [US2] Implementar la función pura `evaluateInspection(inspection)` en `src/inspection-engine.js`, leyendo plan, lista, documento origen y mediciones, devolviendo `status = pending_review`, `results`, `missing_criteria_ids` y `proposed_result` (`passed|conditional|failed`) según `contracts/inspection-engine.md`, sin fijar `overall_result` ni generar NC.
- [x] T021 [P] [US2] Implementar en `src/components/pending-lots.js` la tabla de lotes pendientes con ID de lote, producto, fecha, estado y acción "Inspeccionar".
- [x] T022 [US2] Implementar en `src/components/inspection-engine.js` el formulario de inspección con selector de origen, inspector, fecha, plan `approved`, lista `approved` y estado `draft → pending_review`, mostrando `proposed_result` solo como propuesto y bloqueando la edición manual de `overall_result`.
- [x] T023 [US2] Integrar en `src/components/inspection-engine.js` la evaluación automática de mediciones usando `src/inspection-engine.js`, bloqueando el ingreso manual de `pass_fail` y `overall_result`.
- [x] T024 [US2] Implementar en `src/components/inspection-engine.js` la permanencia en `draft` cuando falte una medición o el valor no sea numérico, y el rechazo de referencias huérfanas o no permitidas.
- [x] T025 [US2] Persistir en `src/storage.js` `status = pending_review`, `proposed_result`, `results` y `review_decision = null`, manteniendo el lote como pendiente hasta que exista una decisión final y la inspección quede `completed`.
- [x] T026 [US2] Agregar en `src/components/pending-lots.js` y `src/components/inspection-engine.js` los estados vacíos y mensajes de validación correspondientes.
- [x] T056 [P] [US2] Escribir pruebas de integración de coincidencia de plan por producto y etapa derivada del origen, y de reanudación de borrador existente sin duplicado, en `tests/integration/inspection-flow.test.js` (FR-033, FR-036).
- [x] T057 [US2] Implementar en `src/components/inspection-engine.js` el filtrado de planes y listas `approved` por `product_id` del documento origen y `applicable_stage` derivada de `reference_module` (`goods_receipt` → `incoming`, `production_order` → `in_process`, `shipment` → `final`), rechazando cualquier otro estado (FR-033, FR-067, SC-020).
- [x] T058 [US2] Implementar en `src/components/inspection-engine.js` la reanudación del borrador `draft` existente para el mismo `reference_module`, `reference_id` e `inspection_plan_id`, conservando sus mediciones y sin crear un duplicado; si existen varios, reanudar el más reciente y advertir la inconsistencia (FR-036).
- [x] T059 [US2] Implementar en `src/components/pending-lots.js` y `src/app.js` la preselección del documento origen al usar la acción "Inspeccionar" y la apertura de la vista de inspecciones con ese origen (FR-040).

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente.

---

## Fase 5: User Story 3 - Registrar no conformidades y acciones CAPA (Priority: P3)

**Goal**: Generar no conformidades solo desde la revisión rechazada del Jefe de Calidad y permitir asignar acciones CAPA trazables.

**Independent Test**: Reproducir una inspección revisada como `rejected`, verificar la no conformidad autogenerada con descripción, y asignar una acción CAPA con responsable, causa raíz, tipo de acción y vencimiento; verificar que un override manual a `failed` no genera NC.

### Pruebas para User Story 3

- [x] T027 [P] [US3] Escribir pruebas de integración de creación manual de no conformidad, descripción obligatoria, validación de CAPA, detección de vencimiento y ausencia de NC por override en `tests/integration/non-conformance-capa.test.js`; la NC automática por `review_decision = rejected` queda cubierta por T121/T122 (FR-015, FR-034, FR-060, SC-003, SC-004).

### Implementación para User Story 3

- [x] T028 [US3] Implementar en `src/components/non-conformance-capa.js` la creación manual de no conformidad con descripción obligatoria, producto y lote del origen, tipo `other`, severidad `major` y estado `open`; NO generar NC por la guarda de críticos fallidos ni por overrides manuales. La generación automática desde `reviewInspection()` con `review_decision = rejected`, incluido el caso heredado `completed` condicional sin decisión, queda reservada a T122 y se verifica en T121 (FR-015, FR-034, SC-003).
- [x] T029 [US3] Implementar en `src/components/non-conformance-capa.js` la clasificación y edición de no conformidad (descripción obligatoria, tipo de defecto, severidad y estado).
- [x] T030 [US3] Implementar en `src/components/non-conformance-capa.js` el formulario de acciones CAPA con responsable, descripción, causa raíz, tipo de acción, `due_date` y estado.
- [x] T031 [US3] Implementar en `src/components/non-conformance-capa.js` la marca visual de acciones CAPA vencidas sin cambiar automáticamente su estado.
- [x] T032 [US3] Implementar en `src/storage.js` las reglas de integridad y trazabilidad: bloquear eliminación de inspección con no conformidad y eliminar CAPA en cascada al eliminar una no conformidad.
- [x] T033 [US3] Agregar en `src/components/non-conformance-capa.js` los estados vacíos y mensajes de validación de no conformidad y CAPA.
- [x] T060 [P] [US3] Escribir prueba de integración que verifique que una acción CAPA registra `completed_at` al pasar a `completed` y que no lo registra en otros estados, en `tests/integration/non-conformance-capa.test.js` (FR-038).
- [x] T061 [US3] Implementar en `src/storage.js` y `src/components/non-conformance-capa.js` la marca temporal `completed_at` al fijar una acción CAPA en `completed`, conservándola al actualizar otros campos (FR-038).

**Checkpoint**: La detección de fallas se convierte en no conformidad y acción CAPA trazable.

---

## Fase 6: User Story 4 - Revisar dictamen, inspecciones condicionales y lotes en cuarentena (Priority: P4)

**Goal**: Revisar inspecciones `pending_review` y el caso heredado condicional sin decisión, fijar el dictamen final con justificación registrada y gestionar cuarentena.

**Independent Test**: Abrir una inspección pendiente, intentar aprobarla con criterios críticos fallidos (bloqueo), registrar `rejected` con justificación, verificar una sola entrada de auditoría, y revisar un lote en cuarentena.

### Pruebas para User Story 4

- [x] T034 [P] [US4] Escribir pruebas de integración de decisión final, bloqueo de `approved` con críticos fallidos o sin medición, caso heredado condicional, retiro de bandeja, entrada única de auditoría y derivación de cuarentena en `tests/integration/review-quarantine.test.js` (FR-014, FR-029, FR-032, FR-037, FR-050, SC-021).

### Implementación para User Story 4

- [x] T035 [US4] Implementar en `src/components/non-conformance-capa.js` la bandeja de revisión con inspecciones `pending_review` y `completed` con `proposed_result = conditional` y `review_decision = null`, marcadas como pendientes del Jefe de Calidad, sin retroceder el caso heredado a `pending_review`, y retiradas al registrar cualquier `review_decision`. (Parcial; alcance completo en T123/T124).
- [x] T036 [US4] Implementar en `src/components/non-conformance-capa.js` el override posterior sobre una inspección `completed` con `override_justification`, `overridden_by` y `override_at`, bloqueando `passed` con criterios críticos fallidos o sin medición, conservando `completed`, NO generando NC y emitiendo una sola entrada `status_change` sobre `overall_result` (FR-034, FR-050, SC-003).
- [x] T037 [US4] Implementar en `src/components/non-conformance-capa.js` el flujo de rechazo manual con confirmación y motivo obligatorio antes de guardar. (Superseded por T096; conservada como histórica).
- [x] T038 [US4] Implementar en `src/components/non-conformance-capa.js` la pestaña de cuarentena con ID de lote, producto, severidad, tipo de defecto, acceso a CAPA y estado "Cuarentena - En tratamiento" cuando exista una acción.
- [x] T039 [US4] Agregar en `src/components/non-conformance-capa.js` los estados vacíos de revisión condicional y cuarentena.
- [x] T062 [P] [US4] Escribir prueba de integración que confirme que el cambio manual de dictamen a `failed` no genera no conformidad y conserva la inspección en `completed`, en `tests/integration/review-quarantine.test.js` (FR-034).

**Checkpoint**: Las desviaciones condicionales y los lotes retenidos se resuelven con evidencia registrada.

---

## Fase 7: User Story 5 - Consultar el dashboard de calidad (Priority: P5)

**Goal**: Mostrar indicadores agregados de aprobación, no conformidades, CAPA vencidas, eficacia CAPA, inspecciones pendientes y Pareto de defectos.

**Independent Test**: Con datos de inspecciones y no conformidades cargados, abrir el dashboard y verificar que los indicadores coinciden con los registros.

### Pruebas para User Story 5

- [x] T040 [P] [US5] Escribir pruebas de integración de KPIs, eficacia CAPA, inspecciones pendientes, Pareto y restricción por rol en `tests/integration/quality-dashboard.test.js`.

### Implementación para User Story 5

- [x] T041 [P] [US5] Implementar en `src/components/dashboard.js` los KPIs de tasa de aprobación por etapa según `count(completed && overall_result = passed) / count(completed && overall_result IN (passed, conditional, failed))`, con `0` si el denominador es `0` y `conditional` solo en denominador; no conformidades abiertas por severidad; CAPA vencidas; eficacia CAPA (cierres aprobados con `effectiveness_result = effective` / cierres aprobados, con `0` sin cierres aprobados); e inspecciones pendientes `draft` + `pending_review`, excluyendo el caso heredado `completed` condicional sin decisión y sin contabilizar `pending_review` en KPIs de resultados (FR-020, FR-039, SC-005).
- [x] T042 [US5] Implementar en `src/components/dashboard.js` el análisis de Pareto de productos y etapas con mayor concentración de no conformidades.
- [x] T043 [US5] Implementar en `src/components/dashboard.js` las métricas agregadas por producto o etapa y restringir el detalle individual por inspector al rol de jefatura.
- [x] T044 [US5] Agregar en `src/components/dashboard.js` estados vacíos claros cuando no existan datos.
- [x] T063 [P] [US5] Escribir prueba de integración del selector "Rol de uso" (`erp_quality:viewer_role`), su persistencia en `localStorage`, el re-render al cambiar, la restricción del detalle por inspector al rol `jefe_calidad` y el bloqueo de acciones no permitidas sin alterar el estado, en `tests/integration/quality-dashboard.test.js` (FR-028, FR-051, FR-066, SC-017).
- [x] T064 [US5] Implementar en `src/components/dashboard.js` el selector "Rol de uso" (`jefe_calidad`, `inspector`, `gerente`), su persistencia en `localStorage` bajo `erp_quality:viewer_role` y el re-render al cambiar, aplicando `src/permissions.js` para ocultar o deshabilitar acciones no permitidas, bloquear invocaciones directas con `assertCan()` y mostrar `permission-notice`; el Inspector ve solo su propio resultado individual y no ve bitácora, bandejas ni detalle individual de otros inspectores; el Gerente ve solo lectura y exportación; el detalle individual por inspector queda limitado al rol `jefe_calidad` (FR-028, FR-051–FR-054, FR-066, SC-017, SC-033).

**Checkpoint**: El dashboard refleja fielmente los registros del módulo.

---

## Fase 8: User Story 6 - Auditar el historial de inspecciones (Priority: P6)

**Goal**: Permitir filtrar el historial por lote (documento origen) y rango de fechas, con limpieza de filtros y validación.

**Independent Test**: Aplicar filtros de lote y fechas sobre un historial con datos y verificar que la tabla muestra solo los registros coincidentes.

### Pruebas para User Story 6

- [x] T045 [P] [US6] Escribir pruebas de integración de filtros por lote, rango de fechas, limpieza, rango inválido y estado vacío en `tests/integration/inspection-history.test.js`.

### Implementación para User Story 6

- [x] T046 [US6] Implementar en `src/components/inspection-history.js` la tabla del historial con trazabilidad desde la inspección hasta la no conformidad y sus acciones CAPA.
- [x] T047 [US6] Implementar en `src/components/inspection-history.js` los filtros por lote (documento origen) y rango de fechas, incluyendo la validación de rango inválido (desde posterior a hasta).
- [x] T048 [US6] Agregar en `src/components/inspection-history.js` la acción visible de limpiar filtros y el estado vacío de la vista.

**Checkpoint**: Las seis historias base están funcionales e independientemente verificables.

---

## Fase 9: User Story 7 - Exportar reportes de calidad para auditoría (Priority: P7)

**Goal**: Permitir exportar el historial filtrado de inspecciones y el resumen de indicadores del dashboard, respetando los filtros activos.

**Independent Test**: Aplicar filtros de lote y fechas, exportar y verificar que el archivo contiene solo los registros coincidentes; probar filtros inválidos y ausencia de datos.

**Datos**: `quality_inspections`, `quality_inspection_results`, `non_conformances`, `corrective_actions`

### Pruebas para User Story 7

- [x] T065 [P] [US7] Escribir pruebas de integración de exportación del historial filtrado (incluida la columna `resultados`) y del resumen de KPIs, incluyendo filtros inválidos y ausencia de datos, en `tests/integration/quality-export.test.js` (FR-041, FR-042, SC-012).

### Implementación para User Story 7

- [x] T066 [US7] Implementar en `src/components/inspection-history.js` la exportación CSV UTF-8 del historial filtrado con lote, producto, plan, etapa, fecha, inspector, dictamen, estado y una columna `resultados` (`criterio:medido:cumple` separado por `;`), respetando los filtros activos y bloqueando rangos de fechas inválidos (FR-041).
- [x] T067 [US7] Implementar en `src/components/dashboard.js` la exportación CSV del resumen de KPIs (tasa por etapa, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes) e informar cuando no haya datos (FR-042).
- [x] T068 [US7] Implementar en `src/components/quality-utils.js` el generador de nombre de archivo y descarga CSV reutilizable (módulo, fecha de generación y filtros aplicados) para historial y dashboard (FR-041, FR-042).

**Checkpoint**: US7 queda exportable y verificable de forma independiente.

---

## Fase 10: User Story 8 - Adjuntar evidencia a inspecciones y no conformidades (Priority: P8)

**Goal**: Permitir adjuntar, listar, descargar y eliminar evidencia asociada a inspecciones y no conformidades, con validación de tipo y tamaño.

**Independent Test**: Adjuntar un archivo permitido a una inspección y a su no conformidad, verificar que queda listado y descargable, y comprobar el rechazo de archivos inválidos y las cascadas.

**Datos**: `quality_inspections`, `non_conformances`, `quality_evidence`

### Pruebas para User Story 8

- [x] T069 [P] [US8] Escribir pruebas de integración de adjuntar, listar, previsualizar, descargar y eliminar evidencia en inspecciones y no conformidades, incluyendo tipo/tamaño inválido, límite acumulado/cuota, conservación de evidencia previa y cascadas, en `tests/integration/quality-evidence.test.js` (FR-043, FR-044, SC-013, SC-015).

### Implementación para User Story 8

- [x] T070 [US8] Extender `src/storage.js` con la colección `quality_evidence` (nombre, tipo, tamaño, contenido data URL base64, autor, fecha y vínculo polimórfico a inspección, no conformidad, CAPA o documento), sus operaciones CRUD, la validación de MIME `image/png`/`image/jpeg`/`application/pdf`, 5 MB por archivo, 8 MB acumulados, manejo de `QuotaExceededError` sin perder evidencia previa y validación del vínculo; el archivo principal de documentos conserva su validación de 10 MB (FR-043, FR-044, SC-015).
- [x] T071 [US8] Implementar en `src/components/inspection-engine.js` la carga de evidencia en inspecciones `draft`/`completed` con validación de MIME PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados, cuota y autor (FR-043).
- [x] T072 [US8] Implementar en `src/components/non-conformance-capa.js` la carga, autor, previsualización, descarga y visualización de evidencia en no conformidades y CAPA con los mismos límites y validaciones (FR-043, FR-044).
- [x] T073 [US8] Implementar en `src/storage.js` las reglas de cascada y bloqueo de evidencia al eliminar inspecciones, no conformidades, CAPA o documentos, y en `src/components/inspection-history.js` el listado, previsualización y descarga de la evidencia vinculada (FR-026, FR-044, SC-013).
- [x] T074 [US8] Agregar en `src/components/inspection-engine.js` y `src/components/non-conformance-capa.js` los estados vacíos y mensajes de validación de evidencia.

**Checkpoint**: La evidencia queda trazable, validada y disponible para auditoría.

---

## Fase 11: User Story 9 - Configurar alertas y umbrales de calidad (Priority: P9)

**Goal**: Permitir configurar reglas de alerta sobre los indicadores del dashboard y mostrar las alertas cuyo umbral se incumple.

**Independent Test**: Configurar umbrales de tasa de aprobación y CAPA vencidas, cargar datos que los incumplan y verificar que el dashboard muestra las alertas; probar umbrales inválidos y reglas duplicadas.

**Datos**: `quality_inspections`, `non_conformances`, `corrective_actions`, `quality_alert_rules`

### Pruebas para User Story 9

- [x] T075 [P] [US9] Escribir pruebas de integración de configuración de reglas de alerta, validación de catálogo/rango, rechazo de duplicados, activación/desactivación/eliminación y visualización de alertas en el dashboard, en `tests/integration/quality-alerts.test.js` (FR-045, FR-046, FR-047, SC-014).

### Implementación para User Story 9

- [x] T076 [US9] Extender `src/storage.js` con la colección `quality_alert_rules` (indicador, operador, umbral, severidad y estado activo) y la validación de catálogos, rango por indicador (0–100 en tasas, ≥ 0 en conteos) y duplicados activos por indicador y operador (FR-045).
- [x] T077 [US9] Implementar en `src/components/dashboard.js` el formulario de configuración de reglas de alerta, con mensajes de validación visibles y acciones de activar, desactivar y eliminar (FR-045, FR-047).
- [x] T078 [US9] Implementar en `src/components/dashboard.js` la evaluación de reglas activas contra los KPIs y la visualización de alertas con indicador, valor actual, umbral y severidad, excluyendo reglas desactivadas o eliminadas (FR-046, FR-047).
- [x] T079 [US9] Persistir las reglas de alerta (activas e inactivas) entre sesiones y recalcular las alertas al abrir o actualizar el dashboard (FR-046, FR-047).

**Checkpoint**: Las alertas reflejan los umbrales configurados y los datos almacenados.

---

## Fase 12: User Story 10 - Auditar cambios sobre registros de calidad (Priority: P10)

**Goal**: Conservar y consultar una bitácora de altas, ediciones, cambios de estado y eliminaciones sobre inspecciones, no conformidades y acciones CAPA, con usuario, fecha, campo modificado y justificación.

**Independent Test**: Generar una inspección desde un lote semilla, cambiar su dictamen con justificación, cerrar la NC correspondiente, fijar una CAPA en `completed` y verificar que la bitácora muestra esas acciones al filtrar por lote y rango de fechas, sin duplicar la entrada del override.

**Datos**: `quality_audit_log` (nueva colección), `quality_inspections`, `non_conformances`, `corrective_actions`

**Dependencias**: Foundational (Fase 2) y US2/US3/US4 para generar los registros auditados; US7 para reutilizar convenciones de exportación si se amplía la vista. No bloquea US1–US9.

> Nota: `spec.md` y `plan.md` ya fueron sincronizados con US10 (FR-048–FR-050, SC-016, clarificaciones y §4–§6/§13–§14); T092 cubre la documentación de soporte restante.

### Pruebas para User Story 10

- [x] T083 [P] [US10] Escribir pruebas unitarias de validación y consulta de `quality_audit_log` (catálogos `inspection_plan`/`checklist`/`document`/`inspection`/`non_conformance`/`corrective_action` y acciones `create`/`update`/`review`/`approve`/`reject`/`status_change`/`delete`, campos obligatorios, marca temporal ISO y rechazo de entrada duplicada de override) en `tests/unit/quality-audit-log.test.js` (FR-048, FR-062, SC-023).
- [x] T084 [P] [US10] Escribir pruebas de integración del flujo completo de bitácora (alta de inspección, override con justificación, cierre de NC, CAPA en `completed`, eliminación permitida, filtros por lote/tipo/rango y rango inválido) en `tests/integration/quality-audit-log.test.js`.

### Implementación para User Story 10

- [x] T085 [US10] Extender `src/storage.js` con la colección `quality_audit_log` bajo la clave `erp_quality:quality_audit_log`, los catálogos `AUDIT_ENTITIES` (`inspection_plan`, `checklist`, `document`, `inspection`, `non_conformance`, `corrective_action`) y `AUDIT_ACTIONS` (`create`, `update`, `review`, `approve`, `reject`, `status_change`, `delete`), y las funciones `appendAuditEntry`, `findAuditEntries` y `clearAuditEntries` (esta última solo para pruebas), validando campos obligatorios —incluidos `reference_module` + `reference_id`, `actor`, `changed_field` y `before_value`/`after_value` con semántica `null` de FR-049— y timestamp ISO.
- [x] T086 [US10] Registrar entradas desde `submitPlanForApproval`, `approvePlan`, `rejectPlan`, `submitChecklistForApproval`, `approveChecklist`, `rejectChecklist`, `submitDocumentForReview`, `approveDocument`, `rejectDocument`, `reviewInspection`, `reviewCapaClosure`, `addInspection`, `updateInspection`, `deleteInspection`, `addNonConformance`, `updateNonConformance`, `deleteNonConformance`, `addCorrectiveAction`, `updateCorrectiveAction` y `deleteCorrectiveAction` en `src/storage.js`, capturando lote (`reference_module` + `reference_id`), campo modificado con valor anterior/nuevo, actor (empleado de la operación; solo en su defecto el rol activo como metadato) y justificación. El envío a revisión usa `status_change`; la decisión final usa una sola entrada `approve` o `reject` con `changed_field = overall_result`, sin `update` ni `status_change` duplicados; cada override posterior usa una sola `status_change`; una acción denegada por permisos NO registra auditoría (FR-048, FR-050, FR-062, SC-016).
- [x] T087 [US10] Conservar la entrada `delete` tras las eliminaciones permitidas en `deleteInspection`, `deleteNonConformance`, `deleteCorrectiveAction`, listas y documentos de `src/storage.js` (incluida la eliminación directa de CAPA y las cascadas al eliminar una NC), con `after_value = null`, sin alterar las cascadas de resultados, evidencia y CAPA de FR-026 (FR-049, FR-062).
- [x] T088 [P] [US10] Crear en `src/components/quality-audit-log.js` la función pura `filterAuditEntries(entries, filters)` para filtrar por lote (`reference_module` + `reference_id`), `entity_type` y rango de fechas sobre `timestamp`, rechazando `desde > hasta` y exponiendo la limpieza de filtros.
- [x] T089 [US10] Implementar en `src/components/quality-audit-log.js` la vista de bitácora con columnas Entidad, ID de registro, Acción, Campo modificado (anterior/nuevo), Usuario, Fecha/Hora y Justificación, incluyendo estado vacío y mensajes de validación visibles.
- [x] T090 [US10] Registrar la vista `quality-audit-log` en `QUALITY_VIEWS` y `showQuality()` de `src/app.js`, añadir el botón `nav-quality-audit` en `index.html` y conectar el renderizado inicial desde `src/components/quality-audit-log.js`.
- [x] T091 [P] [US10] Añadir en `src/styles.css` los estilos de la tabla de bitácora, los badges por acción y el estado vacío, reutilizando los tokens y patrones de `src/components/inspection-history.js`.
- [x] T092 [P] [US10] Actualizar `specs/002-quality-control-module/data-model.md`, `specs/002-quality-control-module/contracts/quality-storage.md`, `specs/002-quality-control-module/quickstart.md` y `README.md` con la colección `quality_audit_log`, sus catálogos, la regla de conservación tras eliminación y el paso de validación de la bitácora.
- [x] T093 [US10] Ejecutar `npm test` y `npm run build` y validar el flujo independiente con los datos semilla de `src/seed-data.js` (lote → inspección → NC → CAPA → bitácora filtrada), comprobando que no aparecen referencias huérfanas ni entradas duplicadas y verificando SC-016 (consulta filtrada en menos de 2 segundos con hasta 500 inspecciones).

**Checkpoint**: US10 queda implementada y verificable de forma independiente; las entradas permanecen tras eliminaciones permitidas y la bitácora respeta los filtros y el rango de fechas.

### Ejemplo de paralelización para User Story 10

```bash
# Pruebas en archivos distintos, sin depender de la implementación:
Task: "Escribir pruebas unitarias en tests/unit/quality-audit-log.test.js"
Task: "Escribir pruebas de integración en tests/integration/quality-audit-log.test.js"

# En paralelo, el filtro puro y los estilos:
Task: "Crear filterAuditEntries en src/components/quality-audit-log.js"
Task: "Añadir estilos de bitácora en src/styles.css"
```

---

## Fase 13: User Story 11 - Gestionar roles y permisos (Priority: P11)

### Pruebas para User Story 11

- [x] T099 [P] [US11] Escribir pruebas unitarias de `can()`, `assertCan()`, matriz canónica de `contracts/quality-permissions.md` y bloqueo sin cambio de estado ni auditoría para acciones no permitidas, incluyendo Inspector sin bitácora, bandejas ni detalle ajeno y Gerente solo lectura/exportación, en `tests/unit/permissions.test.js` (FR-051–FR-054, FR-066, SC-017, SC-033).
- [x] T101 [US11] Escribir pruebas de integración del cambio de rol activo, persistencia en `erp_quality:viewer_role`, re-render, recálculo de acciones y retiro de permisos del rol anterior en vistas abiertas en `tests/integration/quality-permissions.test.js` (FR-028, FR-051–FR-054, FR-066, SC-017).

### Implementación para User Story 11

- [x] T100 [P] [US11] Crear `src/permissions.js` con la matriz canónica `jefe_calidad`/`inspector`/`gerente` de `contracts/quality-permissions.md`, `can()`, `assertCan()` y el evento `quality:role-changed`; el Inspector ve solo su propio resultado individual y el Gerente solo operaciones de consulta y exportación (FR-051–FR-054).
- [x] T102 [US11] Integrar la matriz en `src/app.js`, `src/components/dashboard.js`, `src/components/review-queue.js`, `src/components/quality-audit-log.js` y acciones de todas las vistas, ocultando o deshabilitando acciones no permitidas, bloqueando invocaciones directas sin alterar estado ni registrar auditoría y mostrando `permission-notice` (FR-051–FR-054, FR-066, SC-017, SC-033).

**Checkpoint**: La matriz de permisos rige todas las acciones visibles e invocables por rol.

## Fase 14: User Story 12 - Aprobar planes y listas (Priority: P12)

### Pruebas para User Story 12

- [x] T103 [P] [US12] Escribir pruebas de transiciones `draft → pending_approval → approved|rejected` y regreso a `draft` al editar rechazados en `tests/unit/quality-status.test.js` (FR-055, FR-056, FR-057, SC-019, SC-026).
- [x] T105 [US12] Escribir pruebas de inmutabilidad y versionado de planes/listas aprobados con historial en `tests/integration/quality-workflow.test.js` (FR-055, FR-056, FR-067, SC-027).

### Implementación para User Story 12

- [x] T104 [US12] Crear `src/quality-status.js` con transiciones y guardas para planes y listas, e integrarlo en `src/components/quality-plan-config.js` y `src/components/checklist-manager.js`.
- [x] T106 [US12] Crear `src/components/review-queue.js` y registrar bandejas de planes/listas `pending_approval`, con `review`, `approve`, `reject`, justificación, revisor y fecha (FR-057, FR-064).

**Checkpoint**: Planes y listas solo se usan cuando están aprobados y conservan su historial al versionarse.

## Fase 15: User Story 13 - Gestionar documentos de calidad (Priority: P13)

### Pruebas para User Story 13

- [x] T107 [P] [US13] Escribir pruebas del ciclo documental `draft → pending_review → approved|rejected`, versionado y evidencia en `tests/integration/quality-documents.test.js` (FR-059, SC-019, SC-026, SC-027).
- [x] T109 [US13] Escribir pruebas de visibilidad documental por rol, previsualización de `pending_review`, bloqueo de solo lectura para Gerente y ocultamiento de aprobaciones para Inspector en `tests/integration/quality-permissions.test.js` (FR-052–FR-054, FR-059, FR-076, SC-033).

### Implementación para User Story 13

- [x] T108 [US13] Implementar en `src/components/quality-document-manager.js` el ciclo documental completo con `document_id`, versión, responsable, archivo/evidencia, aprobación, rechazo y nueva versión.
- [x] T110 [US13] Implementar la bandeja de documentos `pending_review`, la visibilidad por rol y los bloques de edición para Gerente y documentos aprobados.

**Checkpoint**: Los documentos son versionados, revisables y visibles según permisos.

## Fase 16: User Story 14 - Cerrar CAPA con eficacia (Priority: P14)

### Pruebas para User Story 14

- [x] T111 [P] [US14] Escribir pruebas de cierre CAPA: `completed → closure_status=pending`, eficacia obligatoria, aprobación/rechazo y retorno a `in_progress` en `tests/integration/capa-closure.test.js` (FR-061, SC-022).
- [x] T113 [US14] Escribir pruebas del KPI de eficacia usando `cierres aprobados con effectiveness_result = effective / cierres aprobados`, con `0` cuando no haya cierres aprobados, en `tests/integration/quality-dashboard.test.js` (FR-020, SC-005, SC-014).

### Implementación para User Story 14

- [x] T112 [US14] Implementar en `src/components/non-conformance-capa.js` y `src/storage.js` `effectiveness_result`, observaciones, `reviewCapaClosure()` y justificación de rechazo.
- [x] T114 [US14] Actualizar `src/components/dashboard.js` para usar la fórmula de eficacia documentada y el estado vacío cuando no haya cierres aprobados.
- [x] T129 [US14] Escribir pruebas de integración de la bandeja de cierres CAPA con `closure_status = pending` en `tests/integration/capa-closure.test.js`, incluyendo acceso solo para `jefe_calidad`, eficacia obligatoria, aprobación/rechazo con justificación, retorno a `in_progress` al rechazar y salida de la bandeja al registrar la decisión (FR-038, FR-040, FR-061, FR-064, SC-018, SC-022).
- [x] T130 [US14] Implementar en `src/components/review-queue.js`, `src/components/non-conformance-capa.js` y `src/app.js` la bandeja de cierres CAPA pendientes, reutilizando `reviewCapaClosure()` de T112, restringiendo el acceso a `jefe_calidad` mediante `src/permissions.js`, exigiendo eficacia antes de aprobar, devolviendo `status = in_progress` al rechazar con justificación y conectando la navegación desde Control de Calidad (FR-038, FR-040, FR-061, FR-064, SC-018, SC-022).

**Checkpoint**: Ningún cierre de CAPA se aprueba sin revisión de eficacia y decisión de jefatura, y toda bandeja de cierre es accesible desde Control de Calidad.

## Fase 17: User Story 15 - Estados, acciones y mensajes consistentes (Priority: P15)

### Pruebas para User Story 15

- [x] T115 [P] [US15] Escribir, solo en `tests/integration/quality-ui-consistency.test.js`, las pruebas de etiquetas exactas `Borrador`, `Pendiente`, `Aprobado`, `Rechazado` y `Vencido`, etiquetas secundarias de resultado `Aprobado`/`Condicional`/`Reprobado`, acciones disponibles por estado/rol, confirmaciones, errores comprensibles y actualización sin recarga; T116 y T135 implementan el componente y su integración, no estas pruebas (FR-063, FR-064, FR-083, SC-025, SC-029, SC-038).
- [x] T117 [US15] Escribir pruebas de estados vacíos, mensajes de ayuda y limpieza de filtros en dashboard, lotes pendientes, cuarentena, historial, bandejas, bitácora, exportación, evidencia y alertas (FR-024, FR-049, FR-064, FR-073, SC-037).

### Implementación para User Story 15

- [x] T116 [US15] Crear únicamente `src/components/status-badge.js` y `src/components/permission-notice.js` con API para etiquetas exactas, leyenda, texto/color/icono de tokens semánticos y avisos de permiso; no integrarlos en vistas ni repetir pruebas: T135 consume esta API y T115 verifica el contrato (FR-070, FR-083, SC-029, SC-038).
- [x] T118 [US15] Conectar mensajes, estados vacíos, limpieza de filtros, deshabilitación durante cargas y actualización sin recarga en `src/app.js`, `src/styles.css` y `specs/002-quality-control-module/quickstart.md` (FR-063, FR-072, FR-073, SC-025, SC-030).

**Checkpoint**: Estados, acciones, mensajes y estados vacíos son consistentes en todo el módulo. La cobertura visual completa se cierra en Fase 18 con T131–T138.

## Cierre de brechas del análisis (US2, US4, US8, US10, US14)

### Pruebas para revisión final y bandejas

- [x] T121 [P] [US4] Escribir pruebas de integración de `reviewInspection(inspection, decision, justification, reviewer)` en `tests/integration/inspection-review.test.js`: transición `pending_review → completed`, decisión heredada `completed` condicional sin retroceso, decisiones `approved`/`approved_conditional`/`rejected`, mapeo a `overall_result`, guarda de críticos fallidos o sin medición, justificación obligatoria cuando difiera del propuesto o sea condicional/reprobado, revisor y fecha, NC automática solo en `rejected`, salida de bandeja al registrar `review_decision`, exclusión de KPIs hasta `completed` y una sola entrada `approve`/`reject` (FR-014, FR-015, FR-020, FR-029, FR-032, FR-037, FR-039, FR-050, FR-058, SC-021).
- [x] T123 [P] [US4] Escribir pruebas de integración de la bandeja de inspecciones pendientes (`pending_review` y `completed` con `proposed_result = conditional`, `review_decision = null` y `legacy_completed` cuando corresponda) en `tests/integration/quality-review-queue.test.js`, incluyendo acceso solo para `jefe_calidad`, acciones aprobar/rechazar con justificación, retiro al registrar cualquier `review_decision`, ausencia de NC en decisiones condicionales y navegación desde Control de Calidad (FR-014, FR-029, FR-037, FR-040, FR-064, SC-018, SC-021).

### Implementación para revisión final y bandejas

- [x] T122 [US4] Implementar `reviewInspection(inspection, decision, justification, reviewer)` en `src/inspection-engine.js` y `src/storage.js`: aceptar `pending_review` o el caso heredado `completed` con `proposed_result = conditional` y `review_decision = null`, conservar `completed` en el heredado, bloquear `approved` con críticos fallidos o sin medición, guardar `review_decision`, `reviewed_by`, `reviewed_at` y `review_justification`, derivar `overall_result` con el mapeo de FR-014, generar borrador de NC solo en `rejected`, retirar la inspección de la bandeja y emitir una sola entrada `approve`/`reject` sobre `overall_result`.
- [x] T124 [US4] Implementar en `src/components/review-queue.js` y `src/app.js` la bandeja de inspecciones pendientes (`pending_review` y `completed` con `proposed_result = conditional` y `review_decision = null`), sin retroceder el caso heredado a `pending_review`, con acciones aprobar/rechazar, justificación y navegación desde Control de Calidad, reutilizando `reviewInspection()` y `src/permissions.js`.

### Pruebas e implementación de evidencia, approved-only y auditoría

- [x] T125 [US8] Escribir pruebas de integración de evidencia en CAPA y documentos en `tests/integration/quality-evidence.test.js`: carga, MIME PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados y cuota, vínculo polimórfico, autor, previsualización, descarga y cascadas/bloqueos al eliminar (FR-026, FR-043, FR-044, SC-013, SC-015).
- [x] T126 [US8] Extender `src/storage.js`, `src/components/non-conformance-capa.js` y `src/components/quality-document-manager.js` para adjuntar, listar, previsualizar, descargar y eliminar evidencia en CAPA y documentos con las mismas validaciones, cuota y reglas de cascada que inspecciones y no conformidades.
- [x] T127 [US2] Escribir prueba de integración que rechace inspecciones iniciadas con plan o lista en estado distinto de `approved` en `tests/integration/inspection-flow.test.js` (FR-033, FR-067, SC-020).
- [x] T128 [US10] Escribir pruebas de integración de auditoría para aprobación/rechazo de planes, listas, documentos, inspecciones y cierres CAPA, con actor, fecha, decisión, justificación, una sola entrada para la decisión final, una sola `status_change` por override, ausencia de entrada cuando el permiso es denegado y conservación tras eliminaciones permitidas, en `tests/integration/quality-audit-log.test.js` (FR-048–FR-050, FR-051–FR-054, FR-062, SC-016, SC-023).

**Checkpoint**: La revisión final, las bandejas, la evidencia extendida, el filtro `approved` y la auditoría completa quedan verificables antes de la verificación visual y el gate final.

---

## Fase 18: Verificación visual transversal de US15

**Propósito**: Comprobar que las 15 pantallas de la matriz visual cumplen identidad visual, roles, responsive y accesibilidad antes del cierre.

- [x] T144 [P] [US15] Crear `tests/support/quality-dom.js` con helpers para montar cada pantalla por rol y ancho, aplicar filtros, consultar `aria-current`, encabezado, acción principal, columnas clave, foco visible y ausencia de desplazamiento horizontal; T131, T133 y T138 reutilizan estos helpers (FR-068–FR-077, SC-028–SC-040).
- [x] T131 [P] [US15] Escribir `tests/integration/quality-visual-matrix.test.js`, usando T144, con el recorrido de 15 pantallas × 3 roles × anchos 1024/768/360 px: título, descripción de propósito, indicador de rol, navegación de Control de Calidad, una sola acción principal, jerarquía de acciones, menú de 5 categorías/12 entradas/IDs exactos sin alias ni duplicados, dashboard exacto sin tarjetas decorativas ni cifras sin origen, etiquetas textuales, estados vacíos, carga, foco visible, contraste, columnas clave, búsqueda sobre el conjunto filtrado y ausencia de desplazamiento horizontal global (FR-068–FR-083, SC-028–SC-040).
- [x] T132 [P] [US15] Ajustar `index.html`, `src/app.js`, `src/module-config.js` y `src/components/shell.js` para el menú lateral único con categorías `GENERAL`, `GESTIÓN DE CALIDAD`, `DOCUMENTACIÓN`, `ANÁLISIS` y `ADMINISTRACIÓN`, las 12 entradas con IDs `quality-dashboard`, `quality-search`, `quality-plans`, `quality-checklists`, `quality-inspections`, `quality-non-conformances`, `quality-capa`, `quality-documents`, `quality-approvals`, `quality-reports`, `quality-entities` y `quality-settings`, `aria-current`, texto activo y acceso a toda la funcionalidad previa (FR-040, FR-077, SC-034, SC-040).
- [x] T145 [P] [US15] Escribir y pasar `tests/integration/search-entities.test.js`, e implementar `src/components/search-bar.js` e integrarlo en `src/app.js` para `quality-search`: búsqueda insensible a mayúsculas sobre columnas visibles del conjunto ya filtrado, sin consultar otras colecciones ni crear registros; T136 reutiliza el componente (FR-077, FR-080, SC-034, SC-039, SC-040).
- [x] T146 [P] [US15] Escribir y pasar `tests/integration/quality-reports.test.js`, e implementar `src/components/quality-reports.js` para `quality-reports`: contenedor de solo lectura que reutiliza exportaciones CSV, gráficos y filtros existentes de US5/US6/US7, mostrando filtros activos y estado vacío sin crear nuevas fuentes de datos (FR-041, FR-042, FR-077, FR-078, SC-012, SC-034, SC-040).
- [x] T147 [P] [US15] Escribir y pasar `tests/integration/quality-entities.test.js`, e implementar `src/components/entity-list.js` para `quality-entities`: consulta de solo lectura de productos, empleados y orígenes ya cargados, con búsqueda sobre el conjunto visible y sin acciones de creación, edición ni eliminación (FR-077, SC-034, SC-040).
- [x] T148 [P] [US15] Escribir y pasar `tests/integration/quality-settings.test.js`, e implementar `src/components/quality-settings.js` para `quality-settings`: selector de rol de US11 y configuración, desactivación y eliminación de reglas de alerta de US9, sin duplicar dashboard, sesión ni permisos (FR-028, FR-045, FR-077, SC-034, SC-040).
- [x] T133 [P] [US15] Aplicar en `src/styles.css` y `src/quality-styles.css` los tokens exactos de superficie, fondo, texto, borde, primario, interacción, aprobación, pendiente, rechazo y foco, radios de 10 px/8 px, espaciado múltiplo de 4 px, tipografía `system-ui` 14 px/1.5 e iconos SVG 18 px con `stroke-width: 1.8`, reorganizando tablas y formularios en los tres anchos sin pérdida de datos (FR-068, FR-069, FR-074, FR-075, FR-079, SC-028–SC-032, SC-036, SC-039).
- [x] T134 [US15] Reorganizar `src/components/dashboard.js` según la matriz del dashboard: encabezado de bienvenida, tarjetas derivadas de FR-020, inspecciones pendientes y con dictamen final, NC abiertas, CAPA pendientes/vencidas, documentos pendientes, gráficos derivados de registros, últimas 8 entradas de `quality_audit_log`, accesos rápidos por rol y alertas activas, sin duplicados ni cifras sin origen (FR-020, FR-039, FR-078, SC-035).
- [x] T135 [US15] Integrar en las 15 pantallas la API creada por T116 y comprobar solo su presencia visual, leyenda cuando convivan estados, texto/color/icono semánticos y diferencias visuales por rol; no reimplementar componentes, no repetir las pruebas de T115 y no duplicar la verificación funcional de permisos (FR-070, FR-076, FR-083, SC-029, SC-033, SC-038).
- [x] T136 [P] [US15] Unificar encabezados, filtros, buscador insensible a mayúsculas sobre columnas visibles del conjunto ya filtrado, estados y zona única de acciones en las tablas de lotes, inspecciones, NC, CAPA, documentos, historial, bitácora, bandejas y reportes, conservando columnas clave (FR-080, SC-039).
- [x] T137 [P] [US15] Completar título, descripción breve de propósito, una sola acción principal, agrupación y revelación progresiva de formularios, mensajes de ayuda junto al campo, estados vacíos con acción contextual y deshabilitación/carga en operaciones de guardado, envío, aprobación, rechazo, eliminación, exportación y carga (FR-069, FR-072, FR-073, FR-081, FR-082, SC-030, SC-037).
- [x] T138 [US15] Ejecutar la pasada de accesibilidad y responsive sobre T131: orden de tabulación lógico, foco visible de 2 px con offset de 2 px, contraste WCAG 2.1 AA, etiquetas legibles y ausencia de desplazamiento horizontal de toda la página en 1024/768/360 px (FR-074, FR-075, SC-032).

**Checkpoint**: US15 queda verificable en 15 pantallas × 3 roles × 3 anchos; los contenedores de búsqueda, reportes, entidades y configuración quedan implementados y verificados sin duplicar funcionalidad ni contradecir la matriz de permisos.

---

## Fase 19: Polish y preocupaciones transversales

**Propósito**: Documentación, regresión y consistencia final después de US1–US15 y el cierre de brechas.

- [x] T049 [P] Actualizar `README.md` con el flujo del módulo de calidad, datos semilla, enumeraciones canónicas, reglas de integridad y menú de 5 categorías/12 entradas.
- [x] T050 [P] Revisar accesibilidad y consistencia de UX en `src/styles.css` y `src/components/`: navegación por teclado, etiquetas, mensajes de error, confirmaciones y estados de carga, reutilizando T133–T138.
- [x] T051 Validar rendimiento con hasta 500 inspecciones: consultas y dashboard en menos de 2 segundos y búsqueda filtrada en menos de 1 segundo percibido, usando la instrumentación de T139 y `specs/002-quality-control-module/quickstart.md`.
- [x] T052 Escribir la prueba de integración del flujo completo lote pendiente → inspección → revisión rechazada → no conformidad → CAPA → historial en `tests/integration/full-flow.test.js`.
- [x] T054 Ejecutar la validación funcional de `specs/002-quality-control-module/quickstart.md` con `npm run dev`, incluyendo el recorrido visual de US15.
- [x] T080 [P] Actualizar `specs/002-quality-control-module/data-model.md`, `specs/002-quality-control-module/contracts/quality-storage.md`, `specs/002-quality-control-module/quickstart.md` y `specs/002-quality-control-module/plan.md` con las entidades `quality_evidence` y `quality_alert_rules`, las vistas de exportación/evidencia/alertas y sus KPIs asociados.
- [x] T081 [P] Ampliar `README.md` con exportación CSV (columna `resultados`), tipos y límites de evidencia (PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados, `QuotaExceededError`) y configuración, desactivación y eliminación de reglas de alerta.
- [x] T082 Validar el rendimiento de exportación con hasta 500 inspecciones en menos de 2 segundos, según SC-012, T139 y `specs/002-quality-control-module/quickstart.md`.

---

## Fase 20: Trazabilidad y quality gates finales

**Propósito**: Verificar instrumentación, criterios de demo, trazabilidad FR/SC, tooling y gate de entrega.

- [x] T139 [P] [Quality] Añadir instrumentación de tiempo a `tests/integration/inspection-flow.test.js` (SC-001), `tests/integration/inspection-history.test.js` (SC-006), `tests/integration/quality-dashboard.test.js` (SC-010), `tests/integration/quality-export.test.js` (SC-012) y `tests/integration/quality-audit-log.test.js` (SC-016), con hasta 500 inspecciones semilla cuando aplique.
- [x] T140 [P] [Quality] Registrar en `specs/002-quality-control-module/quickstart.md` la lista de cotejo del facilitador y el procedimiento de resultados anónimos para SC-008 y SC-024, indicando que no son aserciones automatizables.
- [x] T141 [P] [Quality] Verificar que FR-001–FR-083 y SC-001–SC-040 tengan al menos una tarea, prueba o verificación asociada, actualizar la matriz siguiente y corregir cualquier hueco sin duplicar tareas.
- [x] T142 [Quality] Verificar la configuración de lint y formato en `package.json` y archivos de configuración de la raíz: instalar las dependencias declaradas y ejecutar `npm run lint` y `npm run format:check` sin errores; queda completado antes de T053, T055 y T143.
- [x] T053 [Quality] Ejecutar `npm test`, `npm run lint`, `npm run format:check`, análisis estático definido en `package.json` y `npm run build` después de T142; corregir cualquier error bloqueante.
- [x] T055 [Quality] Ejecutar `/speckit.analyze` sobre `spec.md`, `plan.md` y `tasks.md` después de completar T001–T148 excepto T055 y T143, y confirmar que no quedan hallazgos CRITICAL ni HIGH.
- [ ] T143 [Quality] Gate final: ejecutar `npm test`, `npm run lint`, `npm run format:check`, `npm run build` y `git diff --check`; confirmar T131–T148 completados en los tres anchos, T053 y T055 en verde, T140 completado y T141 sin huecos antes de declarar la feature implementada.

### Matriz de trazabilidad FR/SC

| Requisitos | Verificación principal | Tareas |
|---|---|---|
| FR-001, FR-002, FR-003, FR-004 | Planes y criterios con validación, estados e integridad histórica | T011–T016, T103–T106, T127, T141 |
| FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013 | Origen válido, medición automática y `proposed_result` sin `overall_result` manual | T018–T026, T056–T059, T121, T122 |
| FR-014, FR-015, FR-016, FR-017, FR-018, FR-019 | Decisión final, NC solo por rechazo, CAPA y vencimientos | T027–T036, T060–T062, T111, T112, T121, T122 |
| FR-020, FR-021, FR-022, FR-023 | KPIs, Pareto, filtros y limpieza del historial | T040–T048, T063, T064, T113, T134, T139 |
| FR-024, FR-025, FR-026, FR-027 | Estados vacíos, persistencia, lotes y cuarentena | T007, T026, T033, T044, T074, T117, T118 |
| FR-028, FR-029, FR-030, FR-031, FR-032 | Rol activo, permisos, bandeja de inspecciones y revisión | T035, T063, T064, T099–T102, T123, T124, T135 |
| FR-033, FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-040 | Plan/lista `approved`, borrador, override, legacy, navegación | T057–T059, T062, T121–T124, T127, T129, T130, T132 |
| FR-041, FR-042, FR-043, FR-044 | Exportación CSV y evidencia vinculada con cuota | T065–T074, T125, T126, T136, T146 |
| FR-045, FR-046, FR-047 | Reglas de alerta activas, visualización y baja | T075–T079, T134, T148 |
| FR-048, FR-049, FR-050 | Bitácora, conservación y decisión única de auditoría | T083–T087, T093, T128, T139 |
| FR-051, FR-052, FR-053, FR-054 | Matriz de permisos por rol y bloqueo sin cambiar estado | T063, T064, T099–T102, T109, T130, T135, T148 |
| FR-055, FR-056, FR-057 | Ciclo de planes/listas, rechazo y bandeja de aprobaciones | T011–T016, T103–T106, T119, T120 |
| FR-058, FR-059, FR-060, FR-061, FR-062 | Flujo de inspección, documentos, NC, CAPA y auditoría de revisiones | T018–T036, T107–T110, T121, T122, T128–T130 |
| FR-063, FR-064, FR-065, FR-066, FR-067 | Mensajes, bandejas, migración, acciones y solo `approved` | T049, T050, T103–T106, T115–T118, T119, T120, T127 |
| FR-068, FR-069, FR-070, FR-071, FR-072, FR-073 | Tokens, encabezados, etiquetas, bandejas, carga y estados vacíos | T115–T118, T131–T133, T135, T137, T144–T148 |
| FR-074, FR-075, FR-076, FR-077 | Accesibilidad, responsive, diferencias visuales por rol y menú | T099–T102, T131–T133, T135, T138, T144–T148 |
| FR-078, FR-079, FR-080, FR-081, FR-082, FR-083 | Dashboard exacto, tablas, formularios, secciones y etiquetas | T134, T136, T137, T115, T116, T135, T146, T147 |
| SC-001, SC-002, SC-003, SC-004, SC-005, SC-006, SC-007 | Tiempo de inspección, cálculo, NC, CAPA, dashboard, búsqueda y origen | T018–T027, T040–T048, T139 |
| SC-008, SC-009, SC-010, SC-011 | Demo guiada, trazabilidad, rendimiento e integridad histórica | T052, T119, T120, T139, T140 |
| SC-012, SC-013, SC-014, SC-015, SC-016, SC-017 | Exportación, evidencia, alertas, cuota, auditoría y permisos | T065–T079, T083–T093, T099–T102, T125, T126, T128, T139, T146 |
| SC-018, SC-019, SC-020, SC-021, SC-022, SC-023 | Bandejas, aprobaciones, flujo final, CAPA, bitácora y versionado | T103–T110, T121–T124, T128–T130 |
| SC-024, SC-025, SC-026, SC-027 | Comprensión de estados, mensajes, rechazo y versiones aprobadas | T103–T106, T115–T118, T140 |
| SC-028, SC-029, SC-030, SC-031, SC-032, SC-033, SC-034 | Estructura visual, etiquetas, carga, bandejas, accesibilidad y menú | T131–T133, T135, T138, T144–T148 |
| SC-035, SC-036, SC-037, SC-038, SC-039, SC-040 | Dashboard, tokens, secciones, etiquetas, columnas y conservación funcional | T132, T134–T137, T145–T148 |

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Setup (Fase 1)**: Sin dependencias; puede iniciar de inmediato. T001 bloquea todo el desarrollo.
- **Foundational (Fase 2)**: Depende de Setup. T005–T008 y T119–T120 bloquean todas las historias de usuario.
- **Historias de Usuario (Fases 3–17: US1–US15)**: Dependen de Foundational; US10 se ejecuta después de US9 y antes de US11 porque US11 gobierna los permisos de bandejas y bitácora.
- **Cierre de brechas (después de Fase 17)**: T121–T130 se ejecutan antes de las tareas visuales y del gate final; las pruebas T121, T123, T125, T127, T128 y T129 bloquean sus implementaciones o integraciones.
- **Verificación visual (Fase 18)**: T144 crea los helpers y precede a T131, T133 y T138; T131 se escribe antes de T132–T138 y depende de US11–US14 y del cierre de brechas; T145–T148 implementan los contenedores derivados del menú antes de T136/T138/T143; el resto de T132–T138 no introducen funcionalidad nueva.
- **Polish (Fase 19)**: Depende de US1–US15, cierre de brechas y verificación visual; T053 se ejecuta en Fase 20 después de T142.
- **Quality gates (Fase 20)**: T139–T143 y T055 se ejecutan al final; T142 precede a T053, T055 y T143; T053 precede a T055; T055 se ejecuta después de T001–T148 excepto T055/T143 y antes de T143, que confirma T131–T148, T053 y T055.

### Dependencias entre historias

- **US1 (P1)**: Puede iniciar tras Foundational; no depende de otras historias.
- **US2 (P2)**: Depende de US1 para disponer de planes con criterios; también puede probarse con datos semilla.
- **US3 (P3)**: Depende de US2 y de la decisión de revisión `rejected` de US4 para la NC automática, que se cierra en T121/T122; T027/T028 cubren creación manual sin inspección reprobada y ausencia de NC por override.
- **US4 (P4)**: Depende de US2 y US3 (inspecciones `conditional`, no conformidades y CAPA).
- **US5 (P5)**: Depende de US2, US3 y US4 para tener datos que agregar.
- **US6 (P6)**: Depende de US2–US4 para mostrar historial con trazabilidad completa.
- **US7 (P7)**: Depende de US2 y US6 para exportar inspecciones, resultados e historial filtrado.
- **US8 (P8)**: Depende de US2 y US3 para adjuntar evidencia a inspecciones y no conformidades.
- **US9 (P9)**: Depende de US5 para evaluar reglas de alerta contra los KPIs del dashboard.
- **US10 (P10)**: Depende de US2–US4 para generar registros auditados y de US7 para reutilizar convenciones de exportación; no bloquea US1–US9.
- **US11 (P11)**: Depende de Foundational y de T119–T120; habilita la matriz que todas las demás historias deben respetar.
- **US12 (P12)**: Depende de US11 para aplicar permisos en bandejas y de T119–T120 para estados migrados; precede a US13 y US15.
- **US13 (P13)**: Depende de US11 y US12 para reutilizar bandejas, versionado y visibilidad por rol.
- **US14 (P14)**: Depende de US3 y US11 para revisión de eficacia, decisión de jefatura y KPI de eficacia; incluye T129/T130 para la bandeja de cierre CAPA después de T112.
- **US15 (P15)**: Depende de US11–US14, T121–T130 y de las bandejas de planes, listas, documentos, inspecciones y cierres CAPA. T115–T118 unifican estados y mensajes; T144 habilita los helpers visuales; T145–T148 implementan los contenedores de búsqueda, reportes, entidades y configuración derivados de funcionalidad existente; T131–T138 verifican la matriz visual completa sin duplicar la verificación funcional de permisos.
- **Cobertura adicional (T056–T064)**: cierran brechas detectadas en el análisis dentro de su historia (US2: FR-033/FR-036/FR-040; US3: FR-038; US4: FR-034; US5: FR-028); cada tarea de prueba precede a su implementación.
- **Cierre de brechas (T121–T130)**: T121/T122 cierran revisión final de inspecciones y la NC automática por `rejected` (US4); T123/T124 bandejas de inspección (US4); T125/T126 evidencia en CAPA/documentos (US8/US13); T127 validación `approved` de plan/lista (US2); T128 auditoría completa (US10); T129/T130 bandeja de cierre CAPA dentro de US14, después de T112. T121, T123, T125, T127, T128 y T129 se completan antes de integrar T122, T124, T126, US2, US10 y T130 respectivamente.
- **Trazabilidad y gates (T131–T148)**: T144 habilita los helpers de la matriz; T131 habilita T132–T138; T145–T148 implementan los contenedores derivados; T139 instrumenta SC temporales; T140 documenta SC no automatizables; T141 cierra la matriz FR/SC; T142 valida tooling; T053 ejecuta gates intermedios; T055 reanaliza artefactos; T143 es el gate final.

### Dentro de cada historia

- Las pruebas se escriben antes y deben fallar antes de implementar.
- Modelos/validaciones antes que servicios y vistas.
- Implementación central antes de integración.
- Una historia debe completarse y validarse antes de avanzar a la siguiente prioridad (si se trabaja secuencialmente).

### Oportunidades de paralelización

- T002, T003 y T004 pueden ejecutarse en paralelo tras T001; T003/T004 quedan supersedidas por T094/T095.
- T009, T010 y T119 pueden ejecutarse en paralelo tras T005–T008.
- Las pruebas [P] de cada historia pueden escribirse en paralelo con otras tareas de prueba.
- US5 y US6 pueden abordarse en paralelo por desarrolladores distintos una vez que US2–US4 generen datos.
- T049, T050, T080 y T081 pueden ejecutarse en paralelo en Polish.
- T056, T060, T062 y T063 pueden escribirse en paralelo (archivos de prueba distintos) antes de sus tareas de implementación asociadas.
- T065, T069 y T075 pueden escribirse en paralelo (archivos de prueba distintos).
- US7, US8, US9 y US10 pueden abordarse en paralelo una vez que US2–US6 generen datos y KPIs; en US10, T083/T084 y T088/T091/T092 son paralelizables.
- T099, T103, T107, T111 y T115 pueden escribirse en paralelo (archivos de prueba distintos); T100/T104/T108/T112/T116 pueden implementarse en paralelo tras sus pruebas; T119/T120 permanecen en Foundational.
- T121 y T123 pueden escribirse en paralelo (archivos de prueba distintos); T122/T124/T126/T130 se implementan después de sus pruebas; T125, T127, T128 y T129 comparten archivos con tareas previas y no se marcan como paralelas.
- T131, T133, T136 y T137 pueden ejecutarse en paralelo tras T144; T145–T148 pueden ejecutarse en paralelo entre sí tras T131 y antes de T136/T138; T132, T134, T135 y T138 se coordinan para no competir por `src/app.js`, `src/styles.css` ni `src/components/dashboard.js`.
- T139, T140 y T141 pueden ejecutarse en paralelo; T142 ya está completado y precede a T053, T055 y T143; T053 precede a T055, y T143 cierra todo.

---

## Ejemplo de paralelización: User Story 2

```bash
# Motor puro y vista de pendientes son archivos distintos y sin dependencia entre sí:
Task: "Implementar evaluateInspection(inspection) en src/inspection-engine.js"
Task: "Implementar la tabla de lotes pendientes en src/components/pending-lots.js"

# En paralelo, las pruebas de la historia:
Task: "Pruebas unitarias del motor en tests/unit/inspection-engine.test.js"
Task: "Pruebas de integración del flujo en tests/integration/inspection-flow.test.js"
```

## Ejemplo de paralelización: User Story 5 y User Story 6

```bash
# Con datos de US2–US4 disponibles, dos desarrolladores trabajan en paralelo:
Task: "Implementar KPIs y Pareto en src/components/dashboard.js"
Task: "Implementar tabla y filtros del historial en src/components/inspection-history.js"
```

---

## Estrategia de implementación

### MVP primero (solo User Story 1)

1. Completar Fase 1: Setup.
2. Completar Fase 2: Foundational (CRÍTICO, bloquea todas las historias).
3. Completar Fase 3: User Story 1.
4. **DETENER y VALIDAR**: probar la configuración de planes y criterios de forma independiente.
5. Desplegar o demostrar si está listo.

### Entrega incremental

1. Completar Setup + Foundational, incluida la migración T119/T120 → base lista.
2. Agregar US1 → probar → demo.
3. Agregar US2 → probar → demo (flujo operativo de inspección).
4. Agregar US3 → probar → cierre de ciclo con no conformidad y CAPA.
5. Agregar US4 → probar → revisión y cuarentena.
6. Agregar US5 → probar → dashboard gerencial.
7. Agregar US6 → probar → historial.
8. Agregar US7 → probar → exportación CSV.
9. Agregar US8 → probar → evidencia adjunta.
10. Agregar US9 → probar → alertas de umbral.
11. Agregar US10 → probar → bitácora filtrable.
12. Agregar US11 → US14 → probar → permisos, aprobaciones, documentos y cierres CAPA.
13. Cerrar brechas T121–T130 → probar → revisión final, bandejas, evidencia extendida y auditoría.
14. Agregar US15, helpers T144 y contenedores T145–T148, y matriz visual T131–T138 → verificar 15 pantallas × 3 roles × 3 anchos.
15. Polish y quality gates finales T139–T142, T053, T055 y cierre T143.

### Estrategia con equipo paralelo

1. El equipo completa Setup + Foundational en conjunto.
2. Con la base lista:
   - Desarrollador A: US1 → US2.
   - Desarrollador B: pruebas transversales y US3.
   - Desarrollador C: US4 una vez existan inspecciones condicionales y no conformidades.
3. US5 y US6 se integran al final, cuando existan datos reales de los flujos anteriores.

---

## Notas

- `[P]` indica tareas en archivos distintos y sin dependencias pendientes.
- `[USx]` mapea cada tarea a su historia de usuario y `[Quality]` a gates transversales para trazabilidad.
- Cada historia debe ser completable y testeable de forma independiente.
- Verificar que las pruebas fallen antes de implementar (constitución, Principio II).
- No editar ni eliminar planes/criterios con inspecciones históricas; duplicar para versionar.
- La NC automática nace solo de `review_decision = rejected`; los overrides y la guarda de críticos no la generan.
- `approval_rate` usa FR-039; `pending_inspections = draft + pending_review`, sin el caso heredado condicional sin decisión.
- La matriz de trazabilidad FR/SC de esta sección se actualiza con T141; ninguna funcionalidad se elimina durante la reorganización visual.
- Evitar tareas vagas, conflictos de archivo y dependencias cruzadas que rompan la independencia.
- Los documentos de la raíz (`plan.md`, `data-model.md`) son históricos; la fuente de verdad es `specs/002-quality-control-module/`.

---

## Registro de Modificaciones (Feedback)

Correcciones derivadas del feedback Avance 03 (16/11/26), arreglos A1–A4 y A8 del Equipo A. El estado se verificó contra el código y las pruebas presentes en `src/` y `tests/`.

- [x] T094 [A1] Configurar los scripts de lint, formato y análisis estático en `package.json` para que T053 sea ejecutable (corrige la brecha heredada de T003).
- [x] T095 [A2] Crear `tests/setup/setup.js` y registrarlo en `vitest.config.mjs` para completar el entorno de pruebas (corrige la brecha heredada de T004).
- [x] T096 [A3] Implementar el flujo de rechazo manual con confirmación y motivo obligatorio en `src/components/non-conformance-capa.js`, con su escenario en `tests/integration/review-quarantine.test.js`; actualmente solo existe el cambio de dictamen con `override_justification`.
- [x] T097 [A4] Mantener y probar el filtro "Módulo origen" en el historial: `currentFilters`, `filterInspections` y `clearHistoryFilters` en `src/components/inspection-history.js`, cubierto por `tests/integration/inspection-history.test.js`.
- [x] T098 [A8] Mejoras funcionales y de interfaz solicitadas: datos simulados en `src/seed-data.js`, estilos, transiciones y navegación en `src/styles.css`, `src/app.js` y `src/components/shell.js`, con cobertura en `tests/integration/workspace-shell.test.js`, `tests/integration/relabeling.test.js` y `tests/integration/search-entities.test.js`.

Actualización 24/11/26: sincronización con `spec.md` y `plan.md` aprobados. Se conservaron los IDs T001–T130, se movió la migración T119/T120 a Foundational, se reordenó Polish después de US15, se corrigieron NC/KPI/auditoría/permisos/evidencia, se añadieron T131–T148 para matriz visual, contenedores derivados, trazabilidad y quality gates, se separó la NC manual de la automática, se eliminó el ciclo T055/T143, se fijó el orden T142→T053→T055→T143 y se incorporó la matriz de trazabilidad FR/SC.
