# Tareas: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Entrada**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md)  
**Contratos**: [quality-storage.md](contracts/quality-storage.md), [inspection-engine.md](contracts/inspection-engine.md)  
**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/  
**Pruebas**: Incluidas por mandato de la constitución (Principio II, Test-First). Cada tarea de implementación debe tener su prueba asociada escrita antes o junto con el código.  
**Organización**: Las tareas se agrupan por historia de usuario para permitir implementación y prueba independientes.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencia de tareas incompletas).
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1–US9).
- Cada descripción incluye la ruta de archivo exacta.

## Convenciones de rutas

- Proyecto único: `src/` y `tests/` en la raíz del repositorio.
- Lógica pura de dominio en `src/`; vistas del módulo en `src/components/`.
- Pruebas unitarias en `tests/unit/`; pruebas de integración en `tests/integration/`.

---

## Fase 1: Setup (Infraestructura compartida)

**Propósito**: Restaurar la base Vite y preparar el entorno del módulo de calidad.

- [x] T001 Restaurar o implementar el código del módulo base ausente (`index.html`, `src/main.js`, `src/app.js`, `src/styles.css`, `src/components/shell.js`) desde `git restore --source=a0062c0^ -- index.html src` o según las especificaciones existentes.
- [x] T002 [P] Crear `src/seed-data.js` con datos semilla de productos, empleados, recepciones, órdenes de producción y despachos.
- [ ] T003 [P] Configurar lint, formato y análisis estático en `package.json` y archivos de configuración en la raíz del repositorio.
- [ ] T004 [P] Configurar el entorno de pruebas Vitest con jsdom en `vitest.config.mjs` y `tests/setup/setup.js`.

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

**Checkpoint**: La base de almacenamiento, integración y derivaciones está lista; las historias pueden iniciar en paralelo.

---

## Fase 3: User Story 1 - Configurar planes y criterios de inspección (Priority: P1) 🎯 MVP

**Goal**: Permitir al Jefe de Calidad crear y mantener planes de inspección con criterios, valores esperados, tolerancias, unidades, tipos de comparación y criticidad.

**Independent Test**: Crear un plan para un producto y etapa, agregar criterios con valor esperado y tolerancia, y verificar que el plan queda disponible para ejecutar inspecciones.

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

**Goal**: Mostrar lotes pendientes y permitir registrar mediciones en una inspección vinculada a un documento origen, calculando automáticamente `pass_fail` y `overall_result`.

**Independent Test**: Abrir la lista de lotes pendientes, iniciar una inspección sobre un origen válido, ingresar mediciones y comprobar que el dictamen se calcula sin intervención manual.

### Pruebas para User Story 2

- [x] T018 [P] [US2] Escribir pruebas unitarias del motor de tolerancias (comparaciones `range`, `min`, `max`, `boolean`, límites inclusivos, inspección incompleta y dictamen) en `tests/unit/inspection-engine.test.js`.
- [x] T019 [P] [US2] Escribir pruebas de integración del flujo de inspección (referencia huérfana, borrador, completado y actualización de lotes pendientes) en `tests/integration/inspection-flow.test.js`.

### Implementación para User Story 2

- [x] T020 [P] [US2] Implementar la función pura `evaluateInspection(plan, measurements)` en `src/inspection-engine.js`, devolviendo `status`, `results`, `missing_criteria_ids` y `overall_result` según el contrato.
- [x] T021 [P] [US2] Implementar en `src/components/pending-lots.js` la tabla de lotes pendientes con ID de lote, producto, fecha, estado y acción "Inspeccionar".
- [x] T022 [US2] Implementar en `src/components/inspection-engine.js` el formulario de inspección con selector de origen, inspector, fecha, plan y estado `draft`/`completed`.
- [x] T023 [US2] Integrar en `src/components/inspection-engine.js` la evaluación automática de mediciones usando `src/inspection-engine.js`, bloqueando el ingreso manual de `pass_fail` y `overall_result`.
- [x] T024 [US2] Implementar en `src/components/inspection-engine.js` la permanencia en `draft` cuando falte una medición o el valor no sea numérico, y el rechazo de referencias huérfanas o no permitidas.
- [x] T025 [US2] Persistir resultados de inspección en `src/storage.js` y retirar el lote de la vista de pendientes al completar la inspección.
- [x] T026 [US2] Agregar en `src/components/pending-lots.js` y `src/components/inspection-engine.js` los estados vacíos y mensajes de validación correspondientes.
- [ ] T056 [P] [US2] Escribir pruebas de integración de coincidencia de plan por producto y etapa derivada del origen, y de reanudación de borrador existente sin duplicado, en `tests/integration/inspection-flow.test.js` (FR-033, FR-036).
- [ ] T057 [US2] Implementar en `src/components/inspection-engine.js` el filtrado de planes habilitados por `product_id` del documento origen y `applicable_stage` derivada de `reference_module` (`goods_receipt` → `incoming`, `production_order` → `in_process`, `shipment` → `final`) (FR-033).
- [ ] T058 [US2] Implementar en `src/components/inspection-engine.js` la reanudación del borrador `draft` existente para el mismo `reference_module`, `reference_id` e `inspection_plan_id`, conservando sus mediciones y sin crear un duplicado; si existen varios, reanudar el más reciente y advertir la inconsistencia (FR-036).
- [ ] T059 [US2] Implementar en `src/components/pending-lots.js` y `src/app.js` la preselección del documento origen al usar la acción "Inspeccionar" y la apertura de la vista de inspecciones con ese origen (FR-040).

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente.

---

## Fase 5: User Story 3 - Registrar no conformidades y acciones CAPA (Priority: P3)

**Goal**: Generar no conformidades a partir de inspecciones reprobadas y permitir asignar acciones CAPA trazables.

**Independent Test**: Reproducir una inspección reprobada, verificar la no conformidad autogenerada con descripción, y asignar una acción CAPA con responsable, causa raíz, tipo de acción y vencimiento.

### Pruebas para User Story 3

- [x] T027 [P] [US3] Escribir pruebas de integración de no conformidad automática, descripción obligatoria, validación de CAPA y detección de vencimiento en `tests/integration/non-conformance-capa.test.js`.

### Implementación para User Story 3

- [x] T028 [US3] Implementar en `src/components/non-conformance-capa.js` la generación automática de no conformidad cuando `overall_result = failed`, con descripción autogenerada, producto del plan, tipo `other`, severidad `major` y estado `open`.
- [x] T029 [US3] Implementar en `src/components/non-conformance-capa.js` la clasificación y edición de no conformidad (descripción obligatoria, tipo de defecto, severidad y estado).
- [x] T030 [US3] Implementar en `src/components/non-conformance-capa.js` el formulario de acciones CAPA con responsable, descripción, causa raíz, tipo de acción, `due_date` y estado.
- [x] T031 [US3] Implementar en `src/components/non-conformance-capa.js` la marca visual de acciones CAPA vencidas sin cambiar automáticamente su estado.
- [x] T032 [US3] Implementar en `src/storage.js` las reglas de integridad y trazabilidad: bloquear eliminación de inspección con no conformidad y eliminar CAPA en cascada al eliminar una no conformidad.
- [x] T033 [US3] Agregar en `src/components/non-conformance-capa.js` los estados vacíos y mensajes de validación de no conformidad y CAPA.
- [ ] T060 [P] [US3] Escribir prueba de integración que verifique que una acción CAPA registra `completed_at` al pasar a `completed` y que no lo registra en otros estados, en `tests/integration/non-conformance-capa.test.js` (FR-038).
- [ ] T061 [US3] Implementar en `src/storage.js` y `src/components/non-conformance-capa.js` la marca temporal `completed_at` al fijar una acción CAPA en `completed`, conservándola al actualizar otros campos (FR-038).

**Checkpoint**: La detección de fallas se convierte en no conformidad y acción CAPA trazable.

---

## Fase 6: User Story 4 - Revisar dictamen, inspecciones condicionales y lotes en cuarentena (Priority: P4)

**Goal**: Revisar inspecciones condicionales y lotes retenidos, cambiar dictámenes con justificación registrada y gestionar cuarentena.

**Independent Test**: Abrir una inspección reprobada, intentar aprobarla con criterios críticos fallidos (bloqueo), cambiar el dictamen con justificación y revisar un lote en cuarentena.

### Pruebas para User Story 4

- [x] T034 [P] [US4] Escribir pruebas de integración de cambio de dictamen, bloqueo de aprobación, revisión condicional y derivación de cuarentena en `tests/integration/review-quarantine.test.js`.

### Implementación para User Story 4

- [x] T035 [US4] Implementar en `src/components/non-conformance-capa.js` la bandeja de revisión con las inspecciones `conditional` marcadas como pendientes del Jefe de Calidad.
- [x] T036 [US4] Implementar en `src/components/non-conformance-capa.js` el cambio manual de dictamen con `override_justification`, `overridden_by` y `override_at`, bloqueando `passed` con criterios críticos fallidos o sin medición.
- [x] T037 [US4] Implementar en `src/components/non-conformance-capa.js` el flujo de rechazo manual con confirmación y motivo obligatorio antes de guardar.
- [x] T038 [US4] Implementar en `src/components/non-conformance-capa.js` la pestaña de cuarentena con ID de lote, producto, severidad, tipo de defecto, acceso a CAPA y estado "Cuarentena - En tratamiento" cuando exista una acción.
- [x] T039 [US4] Agregar en `src/components/non-conformance-capa.js` los estados vacíos de revisión condicional y cuarentena.
- [ ] T062 [P] [US4] Escribir prueba de integración que confirme que el cambio manual de dictamen a `failed` no genera no conformidad y conserva la inspección en `completed`, en `tests/integration/review-quarantine.test.js` (FR-034).

**Checkpoint**: Las desviaciones condicionales y los lotes retenidos se resuelven con evidencia registrada.

---

## Fase 7: User Story 5 - Consultar el dashboard de calidad (Priority: P5)

**Goal**: Mostrar indicadores agregados de aprobación, no conformidades, CAPA vencidas, eficacia CAPA, inspecciones pendientes y Pareto de defectos.

**Independent Test**: Con datos de inspecciones y no conformidades cargados, abrir el dashboard y verificar que los indicadores coinciden con los registros.

### Pruebas para User Story 5

- [x] T040 [P] [US5] Escribir pruebas de integración de KPIs, eficacia CAPA, inspecciones pendientes, Pareto y restricción por rol en `tests/integration/quality-dashboard.test.js`.

### Implementación para User Story 5

- [x] T041 [P] [US5] Implementar en `src/components/dashboard.js` los KPIs de tasa de aprobación por etapa, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes (`draft`).
- [x] T042 [US5] Implementar en `src/components/dashboard.js` el análisis de Pareto de productos y etapas con mayor concentración de no conformidades.
- [x] T043 [US5] Implementar en `src/components/dashboard.js` las métricas agregadas por producto o etapa y restringir el detalle individual por inspector al rol de jefatura.
- [x] T044 [US5] Agregar en `src/components/dashboard.js` estados vacíos claros cuando no existan datos.
- [ ] T063 [P] [US5] Escribir prueba de integración del selector "Rol de uso" (`erp_quality:viewer_role`), su persistencia en `localStorage`, el re-render al cambiar y la restricción del detalle por inspector al rol `jefe_calidad`, en `tests/integration/quality-dashboard.test.js` (FR-028).
- [ ] T064 [US5] Implementar en `src/components/dashboard.js` el selector "Rol de uso" (`jefe_calidad`, `inspector`, `gerente`), su persistencia en `localStorage` bajo `erp_quality:viewer_role` y el re-render del dashboard al cambiar, sin habilitar ni restringir otras acciones (FR-028).

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

- [x] T069 [P] [US8] Escribir pruebas de integración de adjuntar, listar, descargar y eliminar evidencia en inspecciones y no conformidades, incluyendo tipo/tamaño inválido, límite acumulado/cuota y cascadas, en `tests/integration/quality-evidence.test.js` (FR-043, FR-044, SC-013, SC-015).

### Implementación para User Story 8

- [x] T070 [US8] Extender `src/storage.js` con la colección `quality_evidence` (nombre, tipo, tamaño, contenido data URL base64, autor, fecha y vínculo polimórfico a inspección o no conformidad), sus operaciones CRUD, la validación de MIME PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados y manejo de cuota, y la validación del vínculo (FR-043, FR-044, SC-015).
- [x] T071 [US8] Implementar en `src/components/inspection-engine.js` la carga de evidencia en inspecciones `draft`/`completed` con validación de MIME PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados, cuota y autor (FR-043).
- [x] T072 [US8] Implementar en `src/components/non-conformance-capa.js` la carga, autor y visualización de evidencia en no conformidades con los mismos límites y validaciones (FR-043).
- [x] T073 [US8] Implementar en `src/storage.js` las reglas de cascada y bloqueo de evidencia al eliminar inspecciones o no conformidades, y en `src/components/inspection-history.js` el listado y descarga de la evidencia vinculada (FR-044, FR-026).
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

## Fase 12: Polish y preocupaciones transversales

**Propósito**: Mejoras que afectan a múltiples historias y cierre del módulo.

- [x] T049 [P] Actualizar `README.md` con el flujo del módulo de calidad, datos semilla, enumeraciones canónicas y reglas de integridad.
- [ ] T050 [P] Revisar accesibilidad y consistencia de UX en `src/styles.css` y `src/components/`: navegación por teclado, etiquetas, mensajes de error, confirmaciones y estados de carga.
- [x] T051 Validar rendimiento con hasta 500 inspecciones: consultas y dashboard en menos de 2 segundos, búsqueda filtrada en menos de 1 segundo percibido, según `quickstart.md`.
- [x] T052 Escribir la prueba de integración del flujo completo lote pendiente → inspección → no conformidad → CAPA → historial en `tests/integration/full-flow.test.js`.
- [x] T053 Ejecutar `npm test`, los comandos de lint/formato/análisis estático definidos en `package.json` y `npm run build`; corregir cualquier error bloqueante.
- [ ] T054 Ejecutar la validación funcional de `specs/002-quality-control-module/quickstart.md` con `npm run dev`.
- [ ] T055 Ejecutar `/speckit.analyze` sobre `specs/002-quality-control-module/spec.md` y confirmar que no quedan hallazgos críticos ni altos.
- [x] T080 [P] Actualizar `data-model.md`, `contracts/quality-storage.md`, `quickstart.md` y `plan.md` con las entidades `quality_evidence` y `quality_alert_rules`, las vistas de exportación/evidencia/alertas y sus KPIs asociados.
- [x] T081 [P] Ampliar `README.md` con exportación CSV (columna `resultados`), tipos y límites de evidencia (PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados y cuota) y configuración, desactivación y eliminación de reglas de alerta.
- [ ] T082 Validar el rendimiento de exportación con hasta 500 inspecciones en menos de 2 segundos, según SC-012 y `quickstart.md`.

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Setup (Fase 1)**: Sin dependencias; puede iniciar de inmediato. T001 bloquea todo el desarrollo.
- **Foundational (Fase 2)**: Depende de Setup. T005–T008 bloquean todas las historias de usuario.
- **Historias de Usuario (Fases 3–11)**: Dependen de Foundational.
- **Polish (Fase 12)**: Depende de que las historias deseadas estén completas.

### Dependencias entre historias

- **US1 (P1)**: Puede iniciar tras Foundational; no depende de otras historias.
- **US2 (P2)**: Depende de US1 para disponer de planes con criterios; también puede probarse con datos semilla.
- **US3 (P3)**: Depende de US2 (inspección `failed`).
- **US4 (P4)**: Depende de US2 y US3 (inspecciones `conditional`, no conformidades y CAPA).
- **US5 (P5)**: Depende de US2, US3 y US4 para tener datos que agregar.
- **US6 (P6)**: Depende de US2–US4 para mostrar historial con trazabilidad completa.
- **US7 (P7)**: Depende de US2 y US6 para exportar inspecciones, resultados e historial filtrado.
- **US8 (P8)**: Depende de US2 y US3 para adjuntar evidencia a inspecciones y no conformidades.
- **US9 (P9)**: Depende de US5 para evaluar reglas de alerta contra los KPIs del dashboard.
- **Cobertura adicional (T056–T064)**: cierran brechas detectadas en el análisis dentro de su historia (US2: FR-033/FR-036/FR-040; US3: FR-038; US4: FR-034; US5: FR-028); cada tarea de prueba precede a su implementación.

### Dentro de cada historia

- Las pruebas se escriben antes y deben fallar antes de implementar.
- Modelos/validaciones antes que servicios y vistas.
- Implementación central antes de integración.
- Una historia debe completarse y validarse antes de avanzar a la siguiente prioridad (si se trabaja secuencialmente).

### Oportunidades de paralelización

- T002, T003 y T004 pueden ejecutarse en paralelo tras T001.
- T009 y T010 pueden ejecutarse en paralelo.
- Las pruebas [P] de cada historia pueden escribirse en paralelo con otras tareas de prueba.
- US5 y US6 pueden abordarse en paralelo por desarrolladores distintos una vez que US2–US4 generen datos.
- T049 y T050 pueden ejecutarse en paralelo al cierre.
- T056, T060, T062 y T063 pueden escribirse en paralelo (archivos de prueba distintos) antes de sus tareas de implementación asociadas.
- T065, T069 y T075 pueden escribirse en paralelo (archivos de prueba distintos).
- US7, US8 y US9 pueden abordarse en paralelo una vez que US2–US6 generen datos y KPIs; T080 y T081 pueden ejecutarse en paralelo al cierre.

---

## Ejemplo de paralelización: User Story 2

```bash
# Motor puro y vista de pendientes son archivos distintos y sin dependencia entre sí:
Task: "Implementar evaluateInspection(plan, measurements) en src/inspection-engine.js"
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

1. Completar Setup + Foundational → base lista.
2. Agregar US1 → probar → demo.
3. Agregar US2 → probar → demo (flujo operativo de inspección).
4. Agregar US3 → probar → cierre de ciclo con no conformidad y CAPA.
5. Agregar US4 → probar → revisión y cuarentena.
6. Agregar US5 → probar → dashboard gerencial.
7. Agregar US6 → probar → auditoría e historial.
8. Agregar US7 → probar → exportación CSV.
9. Agregar US8 → probar → evidencia adjunta.
10. Agregar US9 → probar → alertas de umbral.
11. Polish y validación final.

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
- `[USx]` mapea cada tarea a su historia de usuario para trazabilidad.
- Cada historia debe ser completable y testeable de forma independiente.
- Verificar que las pruebas fallen antes de implementar (constitución, Principio II).
- No editar ni eliminar planes/criterios con inspecciones históricas; duplicar para versionar.
- Evitar tareas vagas, conflictos de archivo y dependencias cruzadas que rompan la independencia.
- Los documentos de la raíz (`plan.md`, `data-model.md`) son históricos; la fuente de verdad es `specs/002-quality-control-module/`.

---

## Registro de Modificaciones (Feedback)

Correcciones derivadas del feedback Avance 03 (16/11/26), arreglos A1–A4 y A8 del Equipo A. El estado se verificó contra el código y las pruebas presentes en `src/` y `tests/`.

- [ ] T056 [A1] Configurar los scripts de lint, formato y análisis estático en `package.json` para que T053 sea ejecutable (T003 continúa sin marcar en `package.json`).
- [ ] T057 [A2] Crear `tests/setup/setup.js` y registrarlo en `vitest.config.mjs` para completar el entorno de pruebas (T004 continúa sin marcar y el archivo no existe en `tests/`).
- [ ] T058 [A3] Implementar el flujo de rechazo manual con confirmación y motivo obligatorio en `src/components/non-conformance-capa.js`, con su escenario en `tests/integration/review-quarantine.test.js`; actualmente solo existe el cambio de dictamen con `override_justification`.
- [x] T059 [A4] Mantener y probar el filtro "Módulo origen" en el historial: `currentFilters`, `filterInspections` y `clearHistoryFilters` en `src/components/inspection-history.js`, cubierto por `tests/integration/inspection-history.test.js`.
- [x] T060 [A8] Mejoras funcionales y de interfaz solicitadas: datos simulados en `src/seed-data.js`, estilos, transiciones y navegación en `src/styles.css`, `src/app.js` y `src/components/shell.js`, con cobertura en `tests/integration/workspace-shell.test.js`, `tests/integration/relabeling.test.js` y `tests/integration/search-entities.test.js`.
