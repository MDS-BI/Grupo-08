# Feature Specification: Módulo de Control de Calidad

**Feature Branch**: `002-quality-control-module`

**Created**: 2026-11-01

**Status**: Draft

**Updated**: 2026-11-22 — se añadieron las historias US7–US9 (exportación, evidencia y alertas), US10 (bitácora de auditoría) y se resolvieron las decisiones de contenido/límites de evidencia, alcance del CSV, catálogos y rangos de alertas, desactivación/eliminación de reglas y numeración única de tareas.

**Input**: User description: "Añadir la especificación del módulo de Control de Calidad a `specs/002-quality-control-module`, a partir de `plan.md`, `data-model.md`, `Historias-Usuarios.md` y el feedback del proyecto."

## Clarifications

### Session 2026-11-01

- Q: ¿Qué volumen de inspecciones debe soportar el módulo sin degradar la experiencia de consulta y dashboard? → A: Hasta 500 inspecciones; consultas y dashboard deben responder en menos de 2 segundos.
- Q: Cuando una inspección obtiene el dictamen `conditional` (solo desviaciones no críticas), ¿qué debe ocurrir? → A: Queda marcada en la bandeja de revisión del Jefe de Calidad, sin generar no conformidad.
- Q: ¿Qué representa un "lote" en este módulo? → A: El documento origen identificado por `reference_module` + `reference_id` (`goods_receipt`, `production_order` o `shipment`). No existe una entidad de lote separada.
- Q: ¿Qué es una "inspección pendiente"? → A: Una inspección guardada en estado `draft` que aún no tiene dictamen final.
- Q: ¿Puede el Jefe de Calidad aprobar una inspección con criterios críticos fallidos o sin medición? → A: No. Puede cambiar el dictamen con justificación registrada, pero nunca a `passed` en esos casos.
- Q: ¿Qué datos debe contener el borrador de no conformidad generado automáticamente? → A: Descripción autogenerada a partir de los criterios incumplidos (editable y obligatoria), producto tomado del plan, tipo de defecto inicial `other`, severidad inicial `major` y estado `open`.
- Q: ¿Qué datos exige una acción CAPA? → A: Responsable, descripción de la acción, causa raíz, tipo de acción (`resampling`, `rework` u `other`) y fecha límite.

### Session 2026-11-14

- Q: ¿Qué plan de inspección debe poder seleccionarse y validarse para un documento origen dado? → A: Debe coincidir con el producto y la etapa del origen; la etapa se deriva del módulo de origen (`goods_receipt` → `incoming`, `production_order` → `in_process`, `shipment` → `final`) y el producto se toma del documento origen.
- Q: Sin autenticación multiusuario en el MVP, ¿cómo se determina el usuario y el rol activo? → A: Mediante un selector "Rol de uso" en el dashboard (`jefe_calidad`, `inspector`, `gerente`), persistido en `localStorage`; el rol solo restringe el detalle individual por inspector (exclusivo de `jefe_calidad`) y no habilita ni registra otras acciones.
- Q: ¿Qué efecto tiene cambiar el dictamen de una inspección existente (por ejemplo, a `failed`) por parte del Jefe de Calidad? → A: Registra justificación, usuario y fecha y conserva la inspección en estado `completed`; el cambio de dictamen no genera una no conformidad, que solo se crea al completar una inspección con dictamen `failed`.
- Q: ¿Cuándo y cómo se cierra una no conformidad y sale el lote de cuarentena? → A: El cierre se registra fijando el estado de la no conformidad en `closed` (sin exigir que sus acciones CAPA estén `completed`); la cuarentena es una vista derivada y el lote sale de ella cuando sus no conformidades dejan de estar en `open` o `under_review`.
- Q: Si un lote ya tiene una inspección en estado `draft`, ¿qué debe ocurrir cuando el Inspector inicia una inspección para ese mismo lote? → A: Se reanuda el borrador existente del mismo origen y plan, conservando las mediciones ya ingresadas y sin crear un duplicado.

### Session 2026-11-15

- Q: ¿Cuándo y bajo qué condiciones se cierra una no conformidad (NC)? → A: El cierre se registra fijando el estado de la NC en `closed` desde el formulario de no conformidades (estados `open`, `under_review`, `closed`); el código no ejecuta un cierre automático ni valida que las acciones CAPA estén `completed` para permitirlo.
- Q: ¿Cuándo sale un lote del estado de cuarentena? → A: La cuarentena es una vista derivada: el lote figura mientras alguna de sus no conformidades esté en `open` o `under_review`, y sale de la vista cuando esas no conformidades pasan a `closed`.
- Q: ¿Cómo termina o se resuelve una inspección con estado `conditional`? → A: Permanece `completed` y se lista en la bandeja de revisión del Jefe de Calidad; se resuelve cambiando su dictamen con justificación, usuario y fecha, y deja de listarse cuando su dictamen ya no es `conditional`.
- Q: ¿Cambiar un dictamen existente a `failed` genera automáticamente una no conformidad? → A: No. La no conformidad automática solo se genera al completar una inspección con dictamen `failed`; el cambio de dictamen únicamente actualiza el dictamen y su auditoría, sin crear una no conformidad.
- Q: ¿Cuáles son los estados de una acción CAPA y qué rol o condición la cierra? → A: Estados `pending`, `in_progress` y `completed`; se cierra fijando el estado en `completed` desde el formulario de CAPA, lo que registra la marca temporal de finalización. El código no restringe ese cambio por rol.
- Q: ¿El estado `conditional` se contabiliza dentro del cálculo de la tasa de aprobación (KPI)? → A: Sí. Cuenta en el denominador (todas las inspecciones `completed`) pero no en el numerador (solo `passed`), por lo que se considera no aprobada y reduce la tasa.
- Q: ¿Cómo se selecciona o cambia el rol de usuario activo (selector del dashboard)? → A: Con el selector "Rol de uso" (`jefe_calidad`, `inspector`, `gerente`), cuyo valor se persiste en `localStorage` (`erp_quality:viewer_role`) y vuelve a renderizar el dashboard al cambiar; el rol solo restringe el detalle individual por inspector, exclusivo de `jefe_calidad`.
- Q: ¿Cómo funciona la navegación hacia Control de Calidad desde el módulo base del ERP (001)? → A: Mediante el grupo "Control de Calidad" de la barra lateral, que alterna la vista de calidad seleccionada y oculta las vistas del módulo base; la acción "Inspeccionar" de lotes pendientes abre la vista de inspecciones con el documento origen preseleccionado.

### Session 2026-11-17

- Q: ¿La evidencia adjunta debe guardar el contenido del archivo para permitir su descarga? → A: Sí, como data URL base64 en `localStorage`, con un límite acumulado de 8 MB y manejo de `QuotaExceededError` sin perder la evidencia ya almacenada.
- Q: ¿Qué tipos y tamaño máximo acepta la evidencia? → A: Solo PNG, JPG/JPEG y PDF, con un máximo de 5 MB por archivo; se rechaza cualquier otro tipo o tamaño.
- Q: ¿Qué catálogo y rangos deben validarse en las reglas de alerta? → A: Indicadores `approval_rate` (0–100), `open_non_conformances` (≥ 0), `overdue_capa` (≥ 0), `capa_effectiveness` (0–100) y `pending_inspections` (≥ 0); operadores `lt`, `lte`, `gt`, `gte`, `eq`; severidad `info`, `warning`, `critical`.
- Q: ¿El CSV del historial debe incluir los resultados por criterio? → A: Sí, una fila por inspección con las columnas de inspección y una columna `resultados` que resuma cada criterio como `criterio:medido:cumple` separado por `;`.
- Q: ¿Se pueden desactivar o eliminar las reglas de alerta? → A: Sí; al desactivarlas (`is_active = false`) o eliminarlas, su alerta deja de mostrarse y la regla se conserva o se retira del almacenamiento según la acción.

### Session 2026-11-22

- Q: ¿Qué actor se registra en la bitácora si no hay autenticación multiusuario? → A: El empleado seleccionado en la operación (`inspector_id`, `overridden_by` o responsable CAPA); solo si la operación no expone un empleado se usa el rol activo de `erp_quality:viewer_role` como metadato de auditoría, sin habilitar ni restringir acciones (FR-028).
- Q: ¿Cómo se identifica el lote en una entrada de bitácora tras eliminar el registro auditado? → A: Cada entrada persiste `reference_module` + `reference_id` del documento origen, de modo que el filtro por lote sigue funcionando aunque la inspección, la NC o la CAPA ya no existan.
- Q: ¿Qué significan valor anterior y valor nuevo en `create` y `delete`? → A: En `create`, valor anterior es `null` y valor nuevo es el estado inicial; en `delete`, valor anterior es el último valor y valor nuevo es `null`; en `update` y `status_change` ambos están definidos.
- Q: ¿Se permite eliminar directamente una acción CAPA? → A: Sí, desde el formulario de CAPA; su entrada `delete` permanece en la bitácora y no altera la cascada de FR-026 al eliminar la no conformidad.
- Q: ¿Cómo deben resolverse los IDs duplicados T056–T060 entre las fases y el "Registro de Modificaciones" de `tasks.md`? → A: Renumerar las entradas del registro histórico como T094–T098.

## Problema y Solución

**Problema.** En muchas empresas los controles de calidad se registran en planillas aisladas del flujo operativo. Esto permite que materias primas defectuosas entren a producción, que lotes con fallas sigan procesándose o que productos defectuosos lleguen al cliente, generando devoluciones, mermas y pérdida de trazabilidad ante auditorías (por ejemplo, ISO 9001).

**Solución.** Un módulo transversal de Control de Calidad que cubre las etapas `incoming`, `in_process` y `final`, con planes y criterios configurables, identificación de lotes pendientes, evaluación automática de tolerancias, registro de no conformidades, cuarentena y seguimiento CAPA. El MVP será una aplicación frontend con persistencia local, coherente con el módulo base ERP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar planes y criterios de inspección (Priority: P1)

Como Jefe de Calidad, quiero crear y mantener planes de inspección asociados a un producto y a una etapa operativa, definiendo los criterios, valores esperados y tolerancias que deberán cumplirse, para estandarizar el control técnico de los lotes.

**Why this priority**: Sin planes ni criterios no existe una referencia contra la cual inspeccionar; es la base de todo el flujo de calidad.

**Independent Test**: Crear un plan para un producto y etapa, agregar criterios con valor esperado y tolerancia, y verificar que el plan queda disponible para ejecutar inspecciones.

Datos: `quality_inspection_plans`, `quality_inspection_criteria`, `products`

**Acceptance Scenarios**:

1. **Given** un producto existente y una etapa válida, **When** el Jefe de Calidad crea un plan con nombre, **Then** el plan se guarda y queda disponible para inspecciones.
2. **Given** un plan existente, **When** se agrega un criterio con valor esperado, tolerancia, unidad, tipo de comparación y criticidad, **Then** el criterio queda asociado al plan.
3. **Given** un plan o criterio con campos obligatorios incompletos, **When** se intenta guardar, **Then** el sistema muestra un error de validación y no persiste el registro.
4. **Given** un plan sin inspecciones asociadas, **When** el Jefe de Calidad lo edita o elimina, **Then** los cambios se reflejan y sus criterios se actualizan o eliminan en cascada.
5. **Given** un plan o criterio con inspecciones históricas, **When** el Jefe de Calidad intenta editarlo o eliminarlo, **Then** el sistema bloquea la operación e informa que debe duplicar el plan para crear una nueva versión.
6. **Given** un plan bloqueado por tener inspecciones, **When** el Jefe de Calidad lo duplica, **Then** se crea un nuevo plan editable con los mismos criterios y sin alterar el historial.

---

### User Story 2 - Identificar lotes pendientes y ejecutar una inspección con evaluación automática (Priority: P2)

Como Inspector de Calidad, quiero ver los lotes pendientes de revisión y registrar las mediciones de una inspección vinculada a un lote o documento origen, para que el sistema evalúe automáticamente cada criterio y determine el dictamen.

**Why this priority**: Es el núcleo operativo del módulo; sin identificación de lotes ni inspecciones no se detectan desviaciones ni se generan no conformidades.

**Independent Test**: Abrir la lista de lotes pendientes, iniciar una inspección sobre un origen válido, ingresar mediciones y comprobar que el dictamen se calcula sin intervención manual.

Datos: `quality_inspections`, `quality_inspection_results`, `quality_inspection_plans`, `quality_inspection_criteria`, `products`, `employees`, `goods_receipts`, `production_orders`, `shipments`

**Acceptance Scenarios**:

1. **Given** documentos origen cargados, **When** el Inspector abre la vista de lotes pendientes, **Then** la tabla muestra ID de lote, producto, fecha y estado, incluyendo solo los lotes sin inspección completada.
2. **Given** la tabla de lotes pendientes, **When** el Inspector usa la acción "Inspeccionar", **Then** se abre el formulario de inspección con el lote preseleccionado; si ya existe un borrador para ese origen y plan, se reanuda con las mediciones conservadas en lugar de crear uno nuevo.
3. **Given** un plan habilitado y un documento origen existente cuyo producto y etapa coinciden con el plan, **When** el Inspector registra la inspección con fecha e inspector, **Then** la inspección se guarda en estado `draft` asociada a un plan y a un origen válido.
4. **Given** una inspección en curso, **When** el Inspector ingresa un valor medido numérico por criterio, **Then** el sistema calcula el cumplimiento comparando el valor con el valor esperado, la tolerancia y el tipo de comparación.
5. **Given** todos los criterios evaluados, **When** el sistema completa la inspección, **Then** el dictamen es `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos cumplen.
6. **Given** una medición exactamente en el límite de la tolerancia, **When** se evalúa, **Then** el criterio se considera cumplido.
7. **Given** una inspección con algún criterio sin medición o con valor no numérico, **When** el Inspector intenta completarla, **Then** el sistema no emite dictamen y conserva o informa el estado `draft` con los criterios faltantes.
8. **Given** un origen inexistente o no válido, **When** se intenta guardar la inspección, **Then** el sistema rechaza el registro y lo explica.
9. **Given** un dictamen calculado, **When** el usuario intenta modificarlo manualmente, **Then** el sistema lo impide salvo el flujo de revisión del Jefe de Calidad descrito en la historia 4.
10. **Given** una inspección completada, **When** se actualiza la vista de lotes pendientes, **Then** el lote deja de aparecer como pendiente y la inspección queda disponible en el historial.

---

### User Story 3 - Registrar no conformidades y acciones CAPA (Priority: P3)

Como Jefe de Calidad, quiero que una inspección reprobada origine una no conformidad con descripción obligatoria y permita asignar una acción correctiva o preventiva con responsable y fecha límite, para cerrar el ciclo de mejora.

**Why this priority**: Convierte una detección en una acción concreta y trazable; sin esto el módulo solo registraría fallas.

**Independent Test**: Reproducir una inspección reprobada y verificar que se crea una no conformidad con descripción y que se puede asignar una acción CAPA con responsable, causa raíz, tipo de acción y vencimiento.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`, `employees`

**Acceptance Scenarios**:

1. **Given** una inspección con dictamen `failed`, **When** se completa, **Then** el sistema genera un borrador de no conformidad con descripción autogenerada de los criterios incumplidos, producto del plan, tipo de defecto `other`, severidad `major` y estado `open`.
2. **Given** un borrador de no conformidad, **When** se intenta guardar sin descripción, **Then** el sistema muestra un error de validación y no persiste el registro.
3. **Given** una no conformidad, **When** se clasifica, **Then** se registran su tipo de defecto (`dimensional`, `functional`, `packaging`, `other`), severidad (`minor`, `major`, `critical`) y estado (`open`, `under_review`, `closed`).
4. **Given** una no conformidad abierta, **When** se crea una acción CAPA, **Then** el sistema exige responsable, descripción, causa raíz, tipo de acción (`resampling`, `rework`, `other`) y fecha límite.
5. **Given** una acción CAPA con fecha límite vencida y estado distinto de `completed`, **When** se consulta, **Then** el sistema la identifica como vencida.
6. **Given** una inspección y su no conformidad, **When** se revisa el historial, **Then** se conserva la trazabilidad desde la medición hasta el cierre de la acción CAPA.
7. **Given** una inspección con dictamen `conditional`, **When** se completa, **Then** queda en la bandeja de revisión del Jefe de Calidad y no se genera una no conformidad automática.

---

### User Story 4 - Revisar dictamen, inspecciones condicionales y lotes en cuarentena (Priority: P4)

Como Jefe de Calidad, quiero revisar las inspecciones condicionales y los lotes retenidos, cambiar el dictamen con justificación registrada y asignar acciones CAPA, para resolver desviaciones antes de liberar o rechazar el lote definitivamente.

**Why this priority**: Aporta control y evidencia ante auditorías, pero depende de que ya existan inspecciones reprobadas o condicionales.

**Independent Test**: Abrir una inspección reprobada, intentar aprobarla con criterios críticos fallidos y verificar el bloqueo; luego cambiar el dictamen con justificación y comprobar el registro de usuario y fecha; finalmente revisar un lote en cuarentena.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`

**Acceptance Scenarios**:

1. **Given** una inspección con criterios críticos fallidos o sin medición, **When** el Jefe de Calidad intenta aprobarla, **Then** el sistema lo bloquea y explica el motivo.
2. **Given** una inspección reprobada o condicional, **When** el Jefe de Calidad cambia el dictamen, **Then** el sistema exige una justificación, registra usuario y fecha del cambio, y no permite `passed` si hay criterios críticos fallidos o sin medición.
3. **Given** una inspección `completed`, **When** el Jefe de Calidad cambia su dictamen a `failed` con justificación, **Then** el sistema fija el dictamen en `failed`, registra justificación, usuario y fecha, conserva la inspección en estado `completed` y no genera una no conformidad automática.
4. **Given** una inspección `conditional`, **When** se abre la bandeja de revisión, **Then** aparece marcada como pendiente de revisión del Jefe de Calidad.
5. **Given** un lote con no conformidad `open` o `under_review`, **When** se abre la pestaña de cuarentena, **Then** la tabla muestra ID de lote, producto, severidad y tipo de defecto, y permite abrir la acción CAPA correspondiente.
6. **Given** un lote en cuarentena sin CAPA, **When** el Jefe de Calidad asigna una acción, **Then** el lote se muestra como "Cuarentena - En tratamiento".
7. **Given** una no conformidad abierta o en revisión, **When** el Jefe de Calidad cambia su estado a `closed`, **Then** la no conformidad queda `closed` y el lote deja de aparecer en cuarentena, sin exigir que sus acciones CAPA estén `completed`.

---

### User Story 5 - Consultar el dashboard de calidad (Priority: P5)

Como Gerente de Operaciones, quiero ver indicadores agregados de aprobación, no conformidades, CAPA vencidas, eficacia CAPA e inspecciones pendientes, para evaluar el desempeño de la calidad y priorizar acciones.

**Why this priority**: Aporta visibilidad gerencial, pero requiere datos generados por los flujos anteriores.

**Independent Test**: Con datos de inspecciones y no conformidades cargados, abrir el dashboard y verificar que los indicadores coinciden con los registros.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`

**Acceptance Scenarios**:

1. **Given** inspecciones completadas, **When** se abre el dashboard, **Then** se muestra la tasa de aprobación por etapa.
2. **Given** no conformidades abiertas, **When** se abre el dashboard, **Then** se muestra su cantidad por severidad.
3. **Given** acciones CAPA con fecha límite vencida, **When** se abre el dashboard, **Then** se muestran como vencidas.
4. **Given** inspecciones en estado `draft`, **When** se abre el dashboard, **Then** se muestran como inspecciones pendientes.
5. **Given** acciones CAPA registradas, **When** se abre el dashboard, **Then** se muestra el porcentaje de acciones `completed` dentro de `due_date`.
6. **Given** no conformidades registradas, **When** se consulta el análisis de Pareto, **Then** se identifican los productos y etapas con mayor concentración de defectos.

---

### User Story 6 - Auditar el historial de inspecciones (Priority: P6)

Como Gerente de Operaciones, quiero filtrar el historial de inspecciones por lote (documento origen) y rango de fechas, para encontrar evaluaciones pasadas y verificar el cumplimiento normativo.

**Why this priority**: Facilita auditoría y consulta, pero no bloquea el flujo operativo del MVP.

**Independent Test**: Aplicar filtros de lote y fechas sobre un historial con datos y verificar que la tabla muestra solo los registros coincidentes.

Datos: `quality_inspections`, `quality_inspection_results`

**Acceptance Scenarios**:

1. **Given** un historial con inspecciones, **When** se filtra por ID de lote (documento origen), **Then** la tabla muestra solo los registros coincidentes.
2. **Given** un historial con inspecciones, **When** se aplica un rango de fechas, **Then** la tabla se actualiza a los registros del rango.
3. **Given** filtros aplicados, **When** se usa la acción de limpiar filtros, **Then** la tabla vuelve a mostrar todos los registros.
4. **Given** un historial sin datos o sin coincidencias, **When** se abre la vista, **Then** se muestra un estado vacío claro con una acción para limpiar filtros.
5. **Given** un rango de fechas inválido (desde posterior a hasta), **When** se intenta aplicar, **Then** el sistema informa el error y no aplica el filtro.

---

### User Story 7 - Exportar reportes de calidad para auditoría (Priority: P7)

Como Jefe de Calidad o Gerente de Operaciones, quiero exportar el historial de inspecciones y los indicadores del dashboard respetando los filtros activos, para compartir evidencia y realizar análisis externos sin depender del sistema.

**Why this priority**: Facilita auditorías y respaldo documental sobre datos ya generados; no bloquea el flujo operativo del MVP.

**Independent Test**: Aplicar filtros en el historial, exportar y verificar que el archivo contiene únicamente los registros coincidentes con las columnas esperadas.

Datos: `quality_inspections`, `quality_inspection_results`, `non_conformances`, `corrective_actions`

**Acceptance Scenarios**:

1. **Given** un historial con filtros de lote y fechas aplicados, **When** el Jefe de Calidad exporta, **Then** el archivo contiene solo las inspecciones y resultados que cumplen los filtros, con lote, producto, plan, etapa, fecha, inspector, dictamen, estado y una columna `resultados` con cada criterio medido.
2. **Given** el dashboard con indicadores calculados, **When** el Gerente exporta el resumen, **Then** el archivo incluye tasa de aprobación por etapa, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes.
3. **Given** filtros inválidos (desde posterior a hasta), **When** se intenta exportar, **Then** el sistema bloquea la exportación y muestra el error.
4. **Given** ausencia de registros para los filtros aplicados, **When** se intenta exportar, **Then** se informa que no hay datos y no se genera un archivo vacío.
5. **Given** una exportación generada, **When** se descarga, **Then** el nombre del archivo incluye el módulo, la fecha de generación y los filtros aplicados.

---

### User Story 8 - Adjuntar evidencia a inspecciones y no conformidades (Priority: P8)

Como Inspector de Calidad, quiero adjuntar imágenes o documentos de respaldo a una inspección y a una no conformidad, para conservar evidencia verificable ante auditorías y revisiones internas.

**Why this priority**: Refuerza la trazabilidad y la evidencia documental; depende de que existan inspecciones y no conformidades.

**Independent Test**: Adjuntar un archivo permitido a una inspección completada y a su no conformidad, y verificar que la evidencia queda listada y descargable desde el historial.

Datos: `quality_inspections`, `non_conformances`, `quality_evidence`

**Acceptance Scenarios**:

1. **Given** una inspección en estado `draft` o `completed`, **When** el Inspector adjunta un archivo con tipo y tamaño permitidos, **Then** la evidencia queda asociada a la inspección con nombre, tipo, tamaño, autor y fecha.
2. **Given** una no conformidad existente, **When** se adjunta un archivo válido, **Then** la evidencia queda asociada a la no conformidad y visible en su detalle.
3. **Given** un archivo con tipo distinto de PNG/JPG/PDF, tamaño superior a 5 MB o una carga que excede 8 MB acumulados o la cuota, **When** se intenta adjuntar, **Then** el sistema rechaza la operación y explica el motivo.
4. **Given** una inspección o no conformidad con evidencia, **When** se consulta el historial, **Then** la evidencia se lista y puede descargarse conservando su vínculo.
5. **Given** una inspección sin no conformidad con evidencia adjunta, **When** se elimina la inspección, **Then** su evidencia se elimina en cascada; si tiene no conformidad, la eliminación se bloquea.
6. **Given** una no conformidad con evidencia y acciones CAPA, **When** se elimina la no conformidad, **Then** se eliminan en cascada su evidencia y sus acciones CAPA.

---

### User Story 9 - Configurar alertas y umbrales de calidad (Priority: P9)

Como Jefe de Calidad, quiero definir umbrales para los indicadores del dashboard y recibir alertas cuando se incumplen, para priorizar desviaciones antes de que afecten la operación.

**Why this priority**: Mejora la reacción proactiva, pero depende de que existan inspecciones, no conformidades y CAPA registradas.

**Independent Test**: Configurar umbrales de tasa de aprobación y de CAPA vencidas, cargar datos que los incumplan y verificar que el dashboard muestra las alertas correspondientes.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`, `quality_alert_rules`

**Acceptance Scenarios**:

1. **Given** el dashboard de calidad, **When** el Jefe de Calidad crea una regla de alerta con indicador, operador, umbral y severidad, **Then** la regla se guarda y queda activa.
2. **Given** una regla activa, **When** los datos del dashboard incumplen el umbral, **Then** se muestra una alerta con el indicador, valor actual, umbral y severidad.
3. **Given** una regla activa, **When** los datos cumplen el umbral, **Then** no se muestra la alerta correspondiente.
4. **Given** una regla con umbral no numérico o fuera de rango, **When** se intenta guardar, **Then** el sistema muestra un error de validación y no la persiste.
5. **Given** reglas configuradas, **When** se recarga la aplicación, **Then** las reglas y sus alertas se recalculan y permanecen disponibles.
6. **Given** una regla que ya no se necesita, **When** el Jefe de Calidad la desactiva o elimina, **Then** deja de mostrarse la alerta asociada.

---

### User Story 10 - Auditar cambios sobre registros de calidad (Priority: P10)

Como Gerente de Operaciones (rol `gerente`), quiero consultar una bitácora de los cambios realizados sobre inspecciones, no conformidades y acciones CAPA —qué cambió, quién lo hizo, cuándo y por qué—, para demostrar trazabilidad ante una auditoría incluso cuando el registro ya fue eliminado.

**Why this priority**: Complementa US3, US4, US6 y US7: actualmente solo quedan registrados el cambio de dictamen y el cierre de CAPA, mientras que el resto de altas, ediciones y eliminaciones no son consultables. No bloquea el flujo operativo del MVP.

**Independent Test**: Generar una inspección, cambiar su dictamen con justificación, cerrar la NC correspondiente y verificar que la bitácora muestra las tres acciones filtrando por lote y rango de fechas.

Datos: `quality_audit_log` (nueva colección: entidad (`inspection`/`non_conformance`/`corrective_action`), ID de registro, `reference_module` + `reference_id` del lote, acción (`create`/`update`/`status_change`/`delete`), campo modificado, valor anterior, valor nuevo, usuario/actor, marca temporal ISO y justificación), `quality_inspections`, `non_conformances`, `corrective_actions`

**Acceptance Scenarios**:

1. **Given** inspecciones, no conformidades o acciones CAPA creadas o editadas, **When** se abre la bitácora, **Then** se listan entradas con entidad, ID de registro, acción (`create`, `update`, `status_change` o `delete`), campo modificado con valor anterior y nuevo, usuario y fecha.
2. **Given** un cambio de dictamen con justificación, **When** se consulta la bitácora, **Then** aparecen la justificación, el usuario y la fecha, sin generar una segunda entrada duplicada.
3. **Given** una no conformidad cerrada o una acción CAPA fijada en `completed`, **When** se consulta la bitácora, **Then** se registra el cambio de estado y su marca temporal.
4. **Given** una eliminación permitida (inspección sin no conformidad, CAPA eliminada directamente o no conformidad con CAPA en cascada), **When** se elimina el registro, **Then** su entrada de auditoría permanece consultable aunque el registro ya no exista.
5. **Given** varias entradas en la bitácora, **When** se filtra por lote (documento origen), tipo de entidad o rango de fechas, **Then** se muestran solo las coincidencias, con una acción para limpiar filtros y un estado vacío claro cuando no haya resultados.
6. **Given** un rango de fechas inválido (desde posterior a hasta), **When** se intenta aplicar, **Then** se informa el error y no se modifica la vista, igual que en US6.

---

### Edge Cases

- Medición exactamente igual a un límite de tolerancia: se considera dentro del rango.
- Medición no numérica o vacía en cualquier criterio: la inspección no puede completarse ni obtener dictamen.
- Inspección con un documento origen que no existe o pertenece a un módulo no permitido: se rechaza.
- Inspección con dictamen `conditional`: se marca para revisión y no genera no conformidad automática.
- Inspección `draft` sin dictamen: se muestra como pendiente y no participa en la tasa de aprobación.
- Plan o criterio con inspecciones históricas: no se puede editar ni eliminar; se debe duplicar el plan para crear una nueva versión.
- Plan o criterio sin inspecciones: se puede editar o eliminar; la eliminación de un plan elimina sus criterios en cascada.
- Plan sin criterios: no puede usarse para iniciar una inspección.
- Intento de aprobar una inspección con criterios críticos fallidos o sin medición: se bloquea y se informa el motivo.
- Acción CAPA sin responsable, descripción, causa raíz, tipo de acción o fecha límite: se rechaza.
- Acción CAPA cuya fecha límite ya pasó: se marca como vencida, sin cambiar automáticamente su estado.
- Cierre de una no conformidad: se registra fijando su estado en `closed` desde el formulario (sin exigir CAPA `completed`); al cerrarse, el lote deja de aparecer en cuarentena.
- Rango de fechas inválido en el historial (desde posterior a hasta): se informa y no se aplica el filtro.
- Eliminación de una inspección con no conformidad asociada: se bloquea para preservar la trazabilidad.
- Eliminación de una no conformidad con acciones CAPA: se eliminan sus acciones CAPA en cascada.
- Eliminación de una inspección sin no conformidades: se eliminan sus resultados en cascada.
- Consulta de métricas individuales por inspector sin rol de jefatura: se limita al nivel agregado.
- Lote sin inspección completada: se muestra como pendiente, aunque exista una inspección en estado `draft`; al inspeccionarlo se reanuda el borrador del mismo origen y plan.
- Origen y plan con más de una inspección `draft` por datos previos: se reanuda la más reciente y se advierte la inconsistencia sin crear otra.
- Cambio manual del dictamen de una inspección existente a `failed`: no genera una no conformidad automática; solo completar una inspección con dictamen `failed` la genera.
- Exportación sin registros coincidentes: se informa la ausencia de datos y no se genera un archivo vacío.
- Exportación con filtros inválidos: se bloquea y se informa el error, igual que en la consulta del historial.
- Evidencia con tipo distinto de PNG/JPG/PDF o tamaño superior a 5 MB: se rechaza con un mensaje que indica el motivo.
- Evidencia que supera el límite acumulado de 8 MB o la cuota de `localStorage`: se rechaza y se conserva la evidencia ya almacenada.
- Eliminación de una inspección o no conformidad con evidencia: se aplican las mismas reglas de cascada y bloqueo que para sus resultados y acciones CAPA.
- Exportación del historial: incluye una columna `resultados` con `criterio:medido:cumple` por cada criterio y mantiene las columnas de la inspección.
- Regla de alerta con umbral no numérico o fuera del rango de su indicador: se rechaza y no se persiste.
- Segunda regla de alerta para el mismo indicador y operador: se rechaza para evitar alertas duplicadas.
- Regla de alerta desactivada o eliminada: deja de mostrarse su alerta; si se elimina, se retira del almacenamiento.
- Regla de alerta incumplida: la alerta es informativa y no bloquea operaciones ni genera no conformidades automáticas.
- `quality_audit_log` conserva `reference_module` + `reference_id` aunque el registro auditado ya no exista; el filtro por lote sigue funcionando.
- Valor anterior/nuevo en la bitácora: `create` usa anterior `null` y nuevo = estado inicial; `delete` usa anterior = último valor y nuevo `null`; `update`/`status_change` registran ambos.
- Eliminación directa de una CAPA: permitida desde el formulario de CAPA; su entrada `delete` permanece y no altera la cascada de FR-026 al eliminar la no conformidad.
- Rango de fechas inválido en la bitácora (desde posterior a hasta): se informa y no se aplica, igual que en US6.
- Cambio de dictamen con justificación: genera una sola entrada `status_change`, sin una segunda entrada `update` duplicada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir crear, editar, duplicar y eliminar planes de inspección asociados a un producto y a una etapa operativa, respetando las reglas de integridad histórica.
- **FR-002**: El sistema MUST validar que cada plan tenga nombre, producto existente, etapa perteneciente a `incoming`, `in_process` o `final` y al menos un criterio antes de habilitarse para inspecciones.
- **FR-003**: El sistema MUST permitir definir criterios por plan con nombre, valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- **FR-004**: El sistema MUST validar que los criterios tengan valor esperado y tolerancia numéricos, tolerancia no negativa, unidad no vacía y tipo de comparación perteneciente a `range`, `min`, `max` o `boolean`.
- **FR-005**: El sistema MUST permitir registrar inspecciones con plan, inspector, fecha, documento origen y estado (`draft`, `completed`).
- **FR-006**: El sistema MUST validar que el origen de la inspección pertenezca a recepción, orden de producción o despacho, y que el registro referenciado exista.
- **FR-007**: El sistema MUST rechazar inspecciones con referencias a registros inexistentes o a módulos de origen no permitidos.
- **FR-008**: El sistema MUST permitir ingresar un valor medido numérico por cada criterio del plan.
- **FR-009**: El sistema MUST calcular automáticamente el cumplimiento de cada criterio según el tipo de comparación: `range`, `min`, `max` o `boolean`.
- **FR-010**: El sistema MUST considerar cumplido un criterio cuyo valor medido se encuentre exactamente en un límite de tolerancia.
- **FR-011**: El sistema MUST impedir el ingreso o la edición manual del cumplimiento por criterio y del dictamen general, salvo el flujo de revisión con justificación.
- **FR-012**: El sistema MUST derivar el dictamen general únicamente cuando la inspección esté completa: `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos los criterios se evalúan y cumplen.
- **FR-013**: El sistema MUST impedir completar una inspección con criterios sin medición o con valores no numéricos, y MUST impedir aprobar una inspección con criterios críticos fallidos.
- **FR-014**: El sistema MUST permitir al Jefe de Calidad cambiar el dictamen de una inspección reprobada o condicional solo con una justificación registrada, almacenando usuario y fecha del cambio; nunca MUST permitir `passed` si existen criterios críticos fallidos o sin medición.
- **FR-015**: El sistema MUST generar un borrador de no conformidad cuando una inspección completa resulte `failed`, con descripción autogenerada de los criterios incumplidos, producto tomado del plan, tipo de defecto inicial `other`, severidad inicial `major` y estado `open`; la descripción MUST ser editable y no vacía.
- **FR-016**: El sistema MUST permitir clasificar la no conformidad por tipo de defecto (`dimensional`, `functional`, `packaging`, `other`), severidad (`minor`, `major`, `critical`) y estado (`open`, `under_review`, `closed`).
- **FR-017**: El sistema MUST permitir crear acciones CAPA asociadas a una no conformidad con estado (`pending`, `in_progress`, `completed`).
- **FR-018**: El sistema MUST exigir responsable, descripción, causa raíz, tipo de acción (`resampling`, `rework`, `other`) y fecha límite en toda acción CAPA.
- **FR-019**: El sistema MUST identificar como vencidas las acciones CAPA cuya fecha límite haya pasado y cuyo estado no sea `completed`.
- **FR-020**: El sistema MUST mostrar un dashboard con tasa de aprobación por etapa, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA (porcentaje de acciones `completed` dentro de `due_date`) e inspecciones pendientes (`draft`).
- **FR-021**: El sistema MUST mostrar un análisis de Pareto de productos y etapas con mayor concentración de no conformidades.
- **FR-022**: El sistema MUST permitir filtrar el historial de inspecciones por lote (documento origen) y rango de fechas.
- **FR-023**: El sistema MUST ofrecer una acción visible para limpiar los filtros del historial.
- **FR-024**: El sistema MUST mostrar estados vacíos claros cuando no existan registros o resultados para los filtros aplicados en dashboard, lotes pendientes, cuarentena, historial, revisión condicional, exportación, evidencia y alertas.
- **FR-025**: El sistema MUST conservar la trazabilidad desde la inspección y sus resultados hasta el cierre de la no conformidad y sus acciones CAPA.
- **FR-026**: El sistema MUST preservar la integridad de los datos con las siguientes reglas: planes o criterios con inspecciones históricas no se editan ni eliminan; una inspección con no conformidad no se elimina; una no conformidad con CAPA elimina sus CAPA en cascada; una inspección sin no conformidad elimina sus resultados en cascada; la evidencia se elimina en cascada con su inspección (sin no conformidad) o con su no conformidad, y permanece cuando la eliminación de la inspección está bloqueada.
- **FR-027**: El sistema MUST mantener disponibles los datos registrados entre sesiones de uso.
- **FR-028**: El sistema MUST ofrecer en el dashboard de calidad un selector "Rol de uso" con los valores `jefe_calidad`, `inspector` y `gerente`, MUST persistir el valor seleccionado en `localStorage` (`erp_quality:viewer_role`) y MUST volver a renderizar el dashboard al cambiarlo. Las métricas agregadas MUST mostrarse a todos los roles y el detalle individual por inspector MUST quedar limitado al rol `jefe_calidad`; el rol seleccionado MUST NOT habilitar ni restringir otras acciones.
- **FR-029**: El sistema MUST marcar las inspecciones con dictamen `conditional` en una bandeja de revisión del Jefe de Calidad, sin generar una no conformidad automática.
- **FR-030**: El sistema MUST mostrar una vista de lotes pendientes con ID de lote, producto, fecha, estado y una acción para iniciar la inspección.
- **FR-031**: El sistema MUST mostrar en una vista o pestaña de cuarentena los lotes con no conformidades en estado `open` o `under_review`, incluyendo ID de lote, producto, severidad, tipo de defecto y acceso a la acción CAPA.
- **FR-032**: El sistema MUST registrar usuario y fecha cuando el Jefe de Calidad cambia un dictamen, y MUST conservar ese registro en el historial.
- **FR-033**: El sistema MUST permitir seleccionar solo planes cuyo producto y etapa coincidan con el documento origen, derivando la etapa del módulo de origen (`goods_receipt` → `incoming`, `production_order` → `in_process`, `shipment` → `final`) y tomando el producto del documento origen.
- **FR-034**: El sistema MUST NOT generar una no conformidad al cambiar manualmente el dictamen de una inspección existente (incluido a `failed`); la inspección MUST conservarse en estado `completed` y la generación automática de una no conformidad MUST ocurrir únicamente al completar una inspección con dictamen `failed`.
- **FR-035**: El sistema MUST permitir cerrar una no conformidad fijando su estado en `closed` desde el formulario de no conformidades, sin condicionar el cierre a que sus acciones CAPA estén `completed`. La cuarentena MUST derivarse de las no conformidades en estado `open` o `under_review`: el lote MUST mostrarse mientras exista alguna, MUST mostrarse como "Cuarentena - En tratamiento" cuando la no conformidad tenga al menos una acción CAPA, y MUST dejar de mostrarse cuando esas no conformidades pasen a `closed`.
- **FR-036**: El sistema MUST reanudar el borrador existente cuando se inicie una inspección para un origen y plan que ya tienen una inspección `draft`, conservando sus mediciones y sin crear un duplicado.
- **FR-037**: El sistema MUST resolver una inspección con dictamen `conditional` mediante el cambio de dictamen del Jefe de Calidad (con justificación, usuario y fecha), conservando la inspección en estado `completed`, y MUST retirarla de la bandeja de revisión cuando su dictamen deje de ser `conditional`.
- **FR-038**: El sistema MUST permitir fijar el estado de una acción CAPA (`pending`, `in_progress`, `completed`) desde el formulario de CAPA; al pasar a `completed` MUST registrar la marca temporal de finalización, y el cambio de estado MUST NOT estar restringido por rol.
- **FR-039**: El sistema MUST calcular la tasa de aprobación como la proporción de inspecciones `passed` sobre el total de inspecciones `completed`, de modo que las inspecciones `conditional` cuenten en el denominador pero no como aprobadas.
- **FR-040**: El sistema MUST permitir navegar a Control de Calidad desde el grupo "Control de Calidad" de la barra lateral del módulo base, alternando la vista de calidad seleccionada y ocultando las vistas del módulo base; la acción "Inspeccionar" de la vista de lotes pendientes MUST abrir la vista de inspecciones con el documento origen preseleccionado.
- **FR-041**: El sistema MUST permitir exportar en CSV UTF-8 el historial filtrado de inspecciones y resultados, con lote, producto, plan, etapa, fecha, inspector, dictamen, estado y una columna `resultados` que resuma cada criterio como `criterio:medido:cumple` separado por `;`, respetando los filtros activos, y MUST bloquear la exportación cuando los filtros sean inválidos.
- **FR-042**: El sistema MUST permitir exportar el resumen de indicadores del dashboard (tasa de aprobación por etapa, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes) y MUST informar cuando no haya datos para exportar.
- **FR-043**: El sistema MUST permitir adjuntar evidencia a inspecciones y no conformidades, registrando nombre, tipo, tamaño, autor (empleado seleccionado en el formulario de evidencia), fecha y contenido como data URL base64; MUST aceptar solo `image/png`, `image/jpeg` y `application/pdf` de hasta 5 MB por archivo, MUST rechazar cualquier otro tipo o tamaño, y MUST rechazar cargas que superen el límite acumulado de 8 MB o la cuota de almacenamiento, conservando la evidencia existente.
- **FR-044**: El sistema MUST conservar el vínculo de la evidencia con su inspección o no conformidad en el historial, aplicar las reglas de cascada y bloqueo de FR-026 al eliminar registros con evidencia, y MUST permitir descargar la evidencia vinculada.
- **FR-045**: El sistema MUST permitir configurar reglas de alerta con indicador perteneciente a `approval_rate`, `open_non_conformances`, `overdue_capa`, `capa_effectiveness` o `pending_inspections`; operador perteneciente a `lt`, `lte`, `gt`, `gte` o `eq`; umbral numérico dentro del rango del indicador (0–100 para tasas y ≥ 0 para conteos); y severidad perteneciente a `info`, `warning` o `critical`; MUST validar el rango del umbral y MUST rechazar una segunda regla activa para el mismo indicador y operador.
- **FR-046**: El sistema MUST evaluar las reglas de alerta activas contra los datos actuales y MOSTRAR en el dashboard las alertas incumplidas con indicador, valor actual, umbral y severidad; las reglas MUST persistir entre sesiones y MUST NOT bloquear operaciones ni generar no conformidades automáticas.
- **FR-047**: El sistema MUST permitir desactivar una regla de alerta (`is_active = false`) o eliminarla; al desactivarla o eliminarla MUST dejar de mostrarse su alerta y, si se elimina, MUST retirar la regla del almacenamiento conservando el resto de reglas.
- **FR-048**: El sistema MUST registrar en `quality_audit_log` cada alta, edición, cambio de estado y eliminación permitida sobre inspecciones (`inspection`), no conformidades (`non_conformance`) y acciones CAPA (`corrective_action`), con `entity_type`, `entity_id`, `reference_module` + `reference_id` del lote, `action` perteneciente a `create`, `update`, `status_change` o `delete`, `changed_field`, `before_value`, `after_value`, `actor`, `timestamp` ISO y `justification` cuando aplique. El actor MUST ser el empleado seleccionado en la operación (`inspector_id`, `overridden_by` o responsable CAPA); solo si la operación no expone empleado, el rol activo de `erp_quality:viewer_role` se usa como metadato sin habilitar ni restringir acciones.
- **FR-049**: El sistema MUST conservar las entradas de auditoría tras eliminaciones permitidas (incluida la eliminación directa de una CAPA y las cascadas de FR-026), MUST interpretar `before_value = null` en `create` y `after_value = null` en `delete`, y MUST permitir filtrar la bitácora por lote (`reference_module` + `reference_id`), `entity_type` y rango de fechas sobre `timestamp`, con acción visible para limpiar filtros y estado vacío claro cuando no haya coincidencias.
- **FR-050**: El sistema MUST emitir una sola entrada `status_change` para el cambio de dictamen con justificación de FR-014/FR-032, sin duplicarla como `update` genérico, y MUST rechazar un rango de fechas inválido (`desde > hasta`) informando el error sin modificar la vista, igual que en US6.

### Key Entities *(include if feature involves data)*

- **Plan de inspección**: Define las pautas de control de un producto para una etapa operativa; agrupa criterios y se asocia a las inspecciones ejecutadas. No se edita ni elimina si tiene inspecciones históricas.
- **Criterio de inspección**: Parámetro evaluado dentro de un plan, con valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- **Inspección**: Evento de control con fecha, inspector, documento origen, estado (`draft`, `completed`) y dictamen general derivado. El cambio manual de dictamen registra justificación, usuario y fecha.
- **Resultado de inspección**: Medición de un criterio dentro de una inspección y su cumplimiento calculado.
- **No conformidad**: Desviación detectada por una inspección reprobada, con descripción, producto, tipo de defecto, severidad y estado.
- **Acción CAPA**: Medida correctiva o preventiva asociada a una no conformidad, con responsable, descripción, causa raíz, tipo de acción, fecha límite y estado.
- **Lote pendiente**: Documento origen sin inspección completada; se deriva de las dependencias externas y no se almacena como entidad propia.
- **Producto, empleado, recepción, orden de producción y despacho**: Datos maestros y transaccionales externos al módulo; se consultan y validan, pero no se crean desde Control de Calidad.
- **Evidencia de calidad**: Archivo de respaldo asociado a una inspección o a una no conformidad, con nombre, tipo, tamaño, autor, fecha y contenido local; solo PNG/JPG/PDF de hasta 5 MB por archivo y 8 MB acumulados.
- **Regla de alerta de calidad**: Umbral configurable sobre un indicador del dashboard, con indicador, operador, valor límite, severidad y estado activo.
- **Entrada de bitácora de auditoría**: Registro inmutable de una acción sobre inspección, NC o CAPA, con lote persistido, entidad, acción, campo y valores anterior/nuevo, actor, marca temporal ISO y justificación; permanece tras la eliminación del registro auditado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un inspector puede completar una inspección de hasta 10 criterios en menos de 3 minutos desde que selecciona el origen hasta que guarda el dictamen.
- **SC-002**: El 100 % de los cumplimientos por criterio y dictámenes generales son calculados por el sistema; no se acepta ningún ingreso manual de esos valores.
- **SC-003**: El 100 % de las inspecciones reprobadas genera un borrador de no conformidad asociado con descripción no vacía.
- **SC-004**: El 100 % de las acciones CAPA registradas incluye responsable, descripción, causa raíz, tipo de acción y fecha límite.
- **SC-005**: El dashboard refleja los indicadores de inspecciones, no conformidades, CAPA vencidas, eficacia CAPA e inspecciones pendientes sin diferencias respecto de los registros almacenados.
- **SC-006**: Una búsqueda en el historial con filtros de lote y fechas devuelve únicamente registros coincidentes en menos de 1 segundo percibido por el usuario.
- **SC-007**: El 0 % de las inspecciones guardadas queda con referencias a documentos origen inexistentes o no permitidos.
- **SC-008**: Al menos el 90 % de los usuarios que participan en la demo completan el flujo lote pendiente → inspección → no conformidad → CAPA sin ayuda del facilitador.
- **SC-009**: La trazabilidad completa de una inspección hasta el cierre de su acción CAPA puede demostrarse en una sola consulta al historial.
- **SC-010**: El módulo mantiene respuestas de consulta y dashboard en menos de 2 segundos con hasta 500 inspecciones almacenadas.
- **SC-011**: El 100 % de los planes y criterios con inspecciones históricas bloquea su edición y eliminación, y el 100 % de las inspecciones completadas deja de aparecer como lote pendiente.
- **SC-012**: El 100 % de las exportaciones respeta los filtros activos y finaliza en menos de 2 segundos con hasta 500 inspecciones almacenadas.
- **SC-013**: El 100 % de las evidencias adjuntas queda vinculada a su inspección o no conformidad y disponible para descarga desde el historial.
- **SC-014**: El 100 % de las alertas mostradas corresponde a reglas activas cuyo umbral se incumple con los datos almacenados, sin diferencias respecto de los registros.
- **SC-015**: El 100 % de las cargas de evidencia que superan el límite acumulado de 8 MB o la cuota de almacenamiento se rechaza sin perder la evidencia previamente almacenada.
- **SC-016**: El 100 % de las altas, ediciones, cambios de estado y eliminaciones permitidas sobre inspecciones, no conformidades y CAPA queda registrado en la bitácora con lote, actor, marca temporal y justificación cuando corresponda, sin entradas duplicadas para el override; la consulta filtrada devuelve solo coincidencias en menos de 2 segundos con hasta 500 inspecciones almacenadas.

## Fuera de Alcance

- Bloqueo automático de inventario.
- Calificación de proveedores.
- Inspección de devoluciones o `returns_rma`.
- Integración con dispositivos IoT o captura automatizada de mediciones.
- Creación de productos, empleados, recepciones, órdenes de producción o despachos desde este módulo.
- Valorización monetaria de no calidad y métricas por línea de producción en el MVP; se documentan como evolución futura.
- Exportación masiva de todas las colecciones o integración con herramientas de BI.
- Firma digital, edición o versionado avanzado de la evidencia adjunta.
- Notificaciones por correo, SMS o mensajería externa derivadas de las alertas de calidad.

## Assumptions

- El módulo se usa en una sola organización y no requiere autenticación multiusuario en el MVP; el usuario y rol activos se seleccionan en la interfaz y se persisten localmente; el rol solo restringe el detalle individual por inspector y, en su defecto, se usa como metadato de auditoría sin habilitar otras acciones.
- La numeración de tareas en `tasks.md` es única dentro de la feature; las entradas históricas del "Registro de Modificaciones" usan T094–T098 para no colisionar con T056–T060 de las fases.
- Los productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas provistas como datos semilla para pruebas y demo.
- Las tolerancias se interpretan como límites inclusivos y los valores medidos son numéricos.
- El volumen esperado es de hasta 500 inspecciones almacenadas; volúmenes mayores quedan fuera del MVP.
- El MVP cubre un único espacio de trabajo y no contempla integración en tiempo real con otros sistemas.
- El término "lote" usado en las historias de usuario equivale al documento origen de la inspección (`reference_module` + `reference_id`); no existe una entidad de lote separada.
- Los lotes pendientes se derivan comparando los documentos origen disponibles con las inspecciones completadas; una inspección `draft` no marca el lote como inspeccionado.
- Las métricas individuales por inspector son accesibles solo al rol de jefatura; el resto de los roles ve datos agregados por producto o etapa.
- La versión integrada con el módulo base requiere restaurar o implementar el código base existente antes de la demo final.
- La evidencia se limita a `image/png`, `image/jpeg` y `application/pdf`, con máximo de 5 MB por archivo y 8 MB acumulados; se almacena localmente como data URL base64 en el MVP.
- Las exportaciones se generan en formato CSV con codificación UTF-8; la exportación del historial incluye una columna `resultados` con `criterio:medido:cumple` separado por `;`.
- Las reglas de alerta se evalúan al abrir o actualizar el dashboard y no en tiempo real; se pueden desactivar o eliminar.
- Las alertas son informativas y no bloquean operaciones ni generan no conformidades automáticas.
