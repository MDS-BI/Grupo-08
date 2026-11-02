# Feature Specification: Módulo de Control de Calidad

**Feature Branch**: `002-quality-control-module`

**Created**: 2026-11-01

**Status**: Draft

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

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar planes y criterios de inspección (Priority: P1)

Como Jefe de Calidad, quiero crear y mantener planes de inspección asociados a un producto y a una etapa operativa, definiendo los criterios, valores esperados y tolerancias que deberán cumplirse, para estandarizar el control técnico de los lotes.

**Why this priority**: Sin planes ni criterios no existe una referencia contra la cual inspeccionar; es la base de todo el flujo de calidad.

**Independent Test**: Crear un plan para un producto y etapa, agregar criterios con valor esperado y tolerancia, y verificar que el plan queda disponible para ejecutar inspecciones.

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

**Acceptance Scenarios**:

1. **Given** documentos origen cargados, **When** el Inspector abre la vista de lotes pendientes, **Then** la tabla muestra ID de lote, producto, fecha y estado, incluyendo solo los lotes sin inspección completada.
2. **Given** la tabla de lotes pendientes, **When** el Inspector usa la acción "Inspeccionar", **Then** se abre el formulario de inspección con el lote preseleccionado.
3. **Given** un plan con criterios y un documento origen existente, **When** el Inspector registra la inspección con fecha e inspector, **Then** la inspección se guarda en estado `draft` asociada a un plan y a un origen válido.
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

**Acceptance Scenarios**:

1. **Given** una inspección con criterios críticos fallidos o sin medición, **When** el Jefe de Calidad intenta aprobarla, **Then** el sistema lo bloquea y explica el motivo.
2. **Given** una inspección reprobada o condicional, **When** el Jefe de Calidad cambia el dictamen, **Then** el sistema exige una justificación, registra usuario y fecha del cambio, y no permite `passed` si hay criterios críticos fallidos o sin medición.
3. **Given** una inspección que se rechaza manualmente, **When** el Jefe de Calidad confirma la acción, **Then** el sistema muestra una confirmación y exige el motivo de rechazo antes de guardar.
4. **Given** una inspección `conditional`, **When** se abre la bandeja de revisión, **Then** aparece marcada como pendiente de revisión del Jefe de Calidad.
5. **Given** un lote con no conformidad `open` o `under_review`, **When** se abre la pestaña de cuarentena, **Then** la tabla muestra ID de lote, producto, severidad y tipo de defecto, y permite abrir la acción CAPA correspondiente.
6. **Given** un lote en cuarentena sin CAPA, **When** el Jefe de Calidad asigna una acción, **Then** el lote se muestra como "Cuarentena - En tratamiento".

---

### User Story 5 - Consultar el dashboard de calidad (Priority: P5)

Como Gerente de Operaciones, quiero ver indicadores agregados de aprobación, no conformidades, CAPA vencidas, eficacia CAPA e inspecciones pendientes, para evaluar el desempeño de la calidad y priorizar acciones.

**Why this priority**: Aporta visibilidad gerencial, pero requiere datos generados por los flujos anteriores.

**Independent Test**: Con datos de inspecciones y no conformidades cargados, abrir el dashboard y verificar que los indicadores coinciden con los registros.

**Acceptance Scenarios**:

1. **Given** inspecciones completadas, **When** se abre el dashboard, **Then** se muestra la tasa de aprobación por etapa.
2. **Given** no conformidades abiertas, **When** se abre el dashboard, **Then** se muestra su cantidad por severidad.
3. **Given** acciones CAPA con fecha límite vencida, **When** se abre el dashboard, **Then** se muestran como vencidas.
4. **Given** inspecciones en estado `draft`, **When** se abre el dashboard, **Then** se muestran como inspecciones pendientes.
5. **Given** acciones CAPA registradas, **When** se abre el dashboard, **Then** se muestra el porcentaje de acciones `completed` dentro de `due_date`.
6. **Given** no conformidades registradas, **When** se consulta el análisis de Pareto, **Then** se identifican los productos y etapas con mayor concentración de defectos.

---

### User Story 6 - Auditar el historial de inspecciones (Priority: P6)

Como Auditor o Gerente de Operaciones, quiero filtrar el historial de inspecciones por lote (documento origen) y rango de fechas, para encontrar evaluaciones pasadas y verificar el cumplimiento normativo.

**Why this priority**: Facilita auditoría y consulta, pero no bloquea el flujo operativo del MVP.

**Independent Test**: Aplicar filtros de lote y fechas sobre un historial con datos y verificar que la tabla muestra solo los registros coincidentes.

**Acceptance Scenarios**:

1. **Given** un historial con inspecciones, **When** se filtra por ID de lote (documento origen), **Then** la tabla muestra solo los registros coincidentes.
2. **Given** un historial con inspecciones, **When** se aplica un rango de fechas, **Then** la tabla se actualiza a los registros del rango.
3. **Given** filtros aplicados, **When** se usa la acción de limpiar filtros, **Then** la tabla vuelve a mostrar todos los registros.
4. **Given** un historial sin datos o sin coincidencias, **When** se abre la vista, **Then** se muestra un estado vacío claro con una acción para limpiar filtros.
5. **Given** un rango de fechas inválido (desde posterior a hasta), **When** se intenta aplicar, **Then** el sistema informa el error y no aplica el filtro.

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
- Rango de fechas inválido en el historial (desde posterior a hasta): se informa y no se aplica el filtro.
- Eliminación de una inspección con no conformidad asociada: se bloquea para preservar la trazabilidad.
- Eliminación de una no conformidad con acciones CAPA: se eliminan sus acciones CAPA en cascada.
- Eliminación de una inspección sin no conformidades: se eliminan sus resultados en cascada.
- Consulta de métricas individuales por inspector sin rol de jefatura: se limita al nivel agregado.
- Lote sin inspección completada: se muestra como pendiente, aunque exista una inspección en estado `draft`.

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
- **FR-024**: El sistema MUST mostrar estados vacíos claros cuando no existan registros o resultados para los filtros aplicados en dashboard, lotes pendientes, cuarentena, historial y revisión condicional.
- **FR-025**: El sistema MUST conservar la trazabilidad desde la inspección y sus resultados hasta el cierre de la no conformidad y sus acciones CAPA.
- **FR-026**: El sistema MUST preservar la integridad de los datos con las siguientes reglas: planes o criterios con inspecciones históricas no se editan ni eliminan; una inspección con no conformidad no se elimina; una no conformidad con CAPA elimina sus CAPA en cascada; una inspección sin no conformidad elimina sus resultados en cascada.
- **FR-027**: El sistema MUST mantener disponibles los datos registrados entre sesiones de uso.
- **FR-028**: El sistema MUST presentar métricas agregadas por producto o etapa y limitar el detalle individual por inspector al rol de jefatura.
- **FR-029**: El sistema MUST marcar las inspecciones con dictamen `conditional` en una bandeja de revisión del Jefe de Calidad, sin generar una no conformidad automática.
- **FR-030**: El sistema MUST mostrar una vista de lotes pendientes con ID de lote, producto, fecha, estado y una acción para iniciar la inspección.
- **FR-031**: El sistema MUST mostrar en una vista o pestaña de cuarentena los lotes con no conformidades en estado `open` o `under_review`, incluyendo ID de lote, producto, severidad, tipo de defecto y acceso a la acción CAPA.
- **FR-032**: El sistema MUST registrar usuario y fecha cuando el Jefe de Calidad cambia un dictamen, y MUST conservar ese registro en el historial.

### Key Entities *(include if feature involves data)*

- **Plan de inspección**: Define las pautas de control de un producto para una etapa operativa; agrupa criterios y se asocia a las inspecciones ejecutadas. No se edita ni elimina si tiene inspecciones históricas.
- **Criterio de inspección**: Parámetro evaluado dentro de un plan, con valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- **Inspección**: Evento de control con fecha, inspector, documento origen, estado (`draft`, `completed`) y dictamen general derivado. El cambio manual de dictamen registra justificación, usuario y fecha.
- **Resultado de inspección**: Medición de un criterio dentro de una inspección y su cumplimiento calculado.
- **No conformidad**: Desviación detectada por una inspección reprobada, con descripción, producto, tipo de defecto, severidad y estado.
- **Acción CAPA**: Medida correctiva o preventiva asociada a una no conformidad, con responsable, descripción, causa raíz, tipo de acción, fecha límite y estado.
- **Lote pendiente**: Documento origen sin inspección completada; se deriva de las dependencias externas y no se almacena como entidad propia.
- **Producto, empleado, recepción, orden de producción y despacho**: Datos maestros y transaccionales externos al módulo; se consultan y validan, pero no se crean desde Control de Calidad.

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

## Fuera de Alcance

- Bloqueo automático de inventario.
- Calificación de proveedores.
- Inspección de devoluciones o `returns_rma`.
- Integración con dispositivos IoT o captura automatizada de mediciones.
- Creación de productos, empleados, recepciones, órdenes de producción o despachos desde este módulo.
- Valorización monetaria de no calidad y métricas por línea de producción en el MVP; se documentan como evolución futura.

## Assumptions

- El módulo se usa en una sola organización y no requiere autenticación multiusuario en el MVP; los roles se representan como perfiles de uso.
- Los productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas provistas como datos semilla para pruebas y demo.
- Las tolerancias se interpretan como límites inclusivos y los valores medidos son numéricos.
- El volumen esperado es de hasta 500 inspecciones almacenadas; volúmenes mayores quedan fuera del MVP.
- El MVP cubre un único espacio de trabajo y no contempla integración en tiempo real con otros sistemas.
- El término "lote" usado en las historias de usuario equivale al documento origen de la inspección (`reference_module` + `reference_id`); no existe una entidad de lote separada.
- Los lotes pendientes se derivan comparando los documentos origen disponibles con las inspecciones completadas; una inspección `draft` no marca el lote como inspeccionado.
- Las métricas individuales por inspector son accesibles solo al rol de jefatura; el resto de los roles ve datos agregados por producto o etapa.
- La versión integrada con el módulo base requiere restaurar o implementar el código base existente antes de la demo final.
