# Feature Specification: Módulo de Control de Calidad

**Feature Branch**: `002-quality-control-module`

**Created**: 2026-11-01

**Status**: Draft

**Updated**: 2026-11-23 — tercera etapa de mejora: se resolvieron conflictos de alcance, trazabilidad y medibilidad de la especificación; se añadieron US11–US15 (roles y permisos, aprobación de listas de verificación, gestión documental, cierre de CAPA y consistencia de experiencia de usuario), se extendieron US1–US4, US8 y US10 para cubrir el flujo de revisión/aprobación, se incorporaron requisitos verificables de diseño visual y UX por pantalla y por rol en US15, FR-068–FR-083 y SC-028–SC-040, se documentó la reorganización del menú lateral, el rediseño del dashboard, la paleta semántica, la densidad de información y el inventario de componentes reutilizables y a rediseñar, y se actualizaron los requisitos funcionales, entidades, criterios de éxito, dependencias y supuestos asociados.

**Input**: User description: "Añadir la especificación del módulo de Control de Calidad a `specs/002-quality-control-module`, a partir de `plan.md`, `data-model.md`, `Historias-Usuarios.md` y el feedback del proyecto."

## Clarifications

### Session 2026-11-01

- Q: ¿Qué volumen de inspecciones debe soportar el módulo sin degradar la experiencia de consulta y dashboard? → A: Hasta 500 inspecciones; consultas y dashboard deben responder en menos de 2 segundos.
- Q: Cuando una inspección obtiene `proposed_result = conditional` (solo desviaciones no críticas), ¿qué debe ocurrir? → A: Queda en `pending_review` en el flujo normal, o en el caso heredado `completed` con `review_decision = null`, y se lista en la bandeja de revisión del Jefe de Calidad sin generar no conformidad.
- Q: ¿Qué representa un "lote" en este módulo? → A: El documento origen identificado por `reference_module` + `reference_id` (`goods_receipt`, `production_order` o `shipment`). No existe una entidad de lote separada.
- Q: ¿Qué es una "inspección pendiente"? → A: Una inspección en `draft` o `pending_review` que aún no tiene `review_decision`. Para el dashboard se agrupan ambas; para la bandeja de revisión se listan las `pending_review` y el caso heredado `completed` con `proposed_result = conditional` y `review_decision = null`.
- Q: ¿Puede el Jefe de Calidad aprobar una inspección con criterios críticos fallidos o sin medición? → A: No. Puede cambiar el dictamen con justificación registrada, pero nunca a `passed` en esos casos.
- Q: ¿Qué datos debe contener el borrador de no conformidad generado automáticamente? → A: Descripción autogenerada a partir de los criterios incumplidos (editable y obligatoria), producto tomado del plan, tipo de defecto inicial `other`, severidad inicial `major` y estado `open`.
- Q: ¿Qué datos exige una acción CAPA? → A: Responsable, descripción de la acción, causa raíz, tipo de acción (`resampling`, `rework` u `other`) y fecha límite.

### Session 2026-11-14

- Q: ¿Qué plan de inspección debe poder seleccionarse y validarse para un documento origen dado? → A: Debe coincidir con el producto y la etapa del origen; la etapa se deriva del módulo de origen (`goods_receipt` → `incoming`, `production_order` → `in_process`, `shipment` → `final`) y el producto se toma del documento origen.
- Q: Sin autenticación multiusuario en el MVP, ¿cómo se determina el usuario y el rol activo? → A: Mediante un selector "Rol de uso" en el dashboard (`jefe_calidad`, `inspector`, `gerente`), persistido en `localStorage`; en esa etapa el rol solo restringía el detalle individual por inspector. La segunda etapa (sesión 2026-11-23) amplía el rol a una matriz de permisos que restringe las acciones de aprobación y edición.
- Q: ¿Qué efecto tiene cambiar el dictamen de una inspección existente (por ejemplo, a `failed`) por parte del Jefe de Calidad? → A: Registra justificación, usuario y fecha y conserva la inspección en estado `completed`; el cambio manual posterior u override no genera una no conformidad. La no conformidad automática se crea cuando la revisión emite `review_decision = rejected` (`overall_result = failed`) desde `pending_review` o desde el caso heredado `completed` condicional sin decisión, y no existe una previa. La guarda de críticos fallidos o sin medición impide aprobaciones como `passed`, pero por sí sola no genera NC.
- Q: ¿Cuándo y cómo se cierra una no conformidad y sale el lote de cuarentena? → A: El cierre se registra fijando el estado de la no conformidad en `closed` (sin exigir que el cierre de sus acciones CAPA esté aprobado); la cuarentena es una vista derivada y el lote sale de ella cuando sus no conformidades dejan de estar en `open` o `under_review`.
- Q: Si un lote ya tiene una inspección en estado `draft`, ¿qué debe ocurrir cuando el Inspector inicia una inspección para ese mismo lote? → A: Se reanuda el borrador existente del mismo origen y plan, conservando las mediciones ya ingresadas y sin crear un duplicado.

### Session 2026-11-15

- Q: ¿Cuándo y bajo qué condiciones se cierra una no conformidad (NC)? → A: El cierre se registra fijando el estado de la NC en `closed` desde el formulario de no conformidades (estados `open`, `under_review`, `closed`); el código no ejecuta un cierre automático ni exige que el cierre de las acciones CAPA esté aprobado para permitirlo.
- Q: ¿Cuándo sale un lote del estado de cuarentena? → A: La cuarentena es una vista derivada: el lote figura mientras alguna de sus no conformidades esté en `open` o `under_review`, y sale de la vista cuando esas no conformidades pasan a `closed`.
- Q: ¿Cómo termina o se resuelve una inspección con `proposed_result = conditional` (o `overall_result = conditional` en datos heredados)? → A: En el flujo normal, el Inspector la envía en `pending_review` y el Jefe de Calidad emite `review_decision` antes de `completed`. El caso heredado `completed` con `review_decision = null` permanece en la bandeja de revisión; se resuelve registrando `approved`, `approved_conditional` o `rejected` con justificación, revisor y fecha, y deja de listarse en cuanto existe `review_decision`, aunque el resultado final sea `conditional`.
- Q: ¿Cambiar un dictamen existente a `failed` genera automáticamente una no conformidad? → A: No. La no conformidad automática solo se genera cuando la revisión del Jefe de Calidad emite `rejected` (`overall_result = failed`) y no existe una NC previa; un override o cambio manual posterior solo actualiza el dictamen y su auditoría, sin crear una no conformidad.
- Q: ¿Cuáles son los estados de una acción CAPA y qué rol o condición la cierra? → A: Los estados de ejecución son `pending`, `in_progress` y `completed`; en la primera etapa se fijaba `completed` desde el formulario y se registraba la marca temporal de finalización. La segunda etapa (sesión 2026-11-23) añade `closure_status` y reserva la aprobación o rechazo del cierre al Jefe de Calidad.
- Q: ¿El resultado `conditional` se contabiliza dentro del cálculo de la tasa de aprobación (KPI)? → A: Sí. Cuenta en el denominador de resultados finales (`inspection_status = completed` con `overall_result = conditional`) pero no en el numerador (solo `overall_result = passed`), por lo que se considera no aprobada y reduce la tasa. Las inspecciones `draft`, `pending_review` y las que tengan `overall_result = null` no participan según FR-039.
- Q: ¿Cómo se selecciona o cambia el rol de usuario activo (selector del dashboard)? → A: Con el selector "Rol de uso" (`jefe_calidad`, `inspector`, `gerente`), cuyo valor se persiste en `localStorage` (`erp_quality:viewer_role`) y vuelve a renderizar las vistas al cambiar; la segunda etapa aplica además la matriz de permisos de FR-051–FR-054.
- Q: ¿Cómo funciona la navegación hacia Control de Calidad desde el módulo base del ERP (001)? → A: Mediante el grupo "Control de Calidad" de la barra lateral, que alterna la vista de calidad seleccionada y oculta las vistas del módulo base; la acción "Inspeccionar" de lotes pendientes abre la vista de inspecciones con el documento origen preseleccionado.

### Session 2026-11-17

- Q: ¿La evidencia adjunta debe guardar el contenido del archivo para permitir su descarga? → A: Sí, como data URL base64 en `localStorage`, con un límite acumulado de 8 MB y manejo de `QuotaExceededError` sin perder la evidencia ya almacenada.
- Q: ¿Qué tipos y tamaño máximo acepta la evidencia? → A: Solo PNG, JPG/JPEG y PDF, con un máximo de 5 MB por archivo; se rechaza cualquier otro tipo o tamaño.
- Q: ¿Qué catálogo y rangos deben validarse en las reglas de alerta? → A: Indicadores `approval_rate` (0–100), `open_non_conformances` (≥ 0), `overdue_capa` (≥ 0), `capa_effectiveness` (0–100) y `pending_inspections` (≥ 0); operadores `lt`, `lte`, `gt`, `gte`, `eq`; severidad `info`, `warning`, `critical`.
- Q: ¿El CSV del historial debe incluir los resultados por criterio? → A: Sí, una fila por inspección con las columnas de inspección y una columna `resultados` que resuma cada criterio como `criterio:medido:cumple` separado por `;`.
- Q: ¿Se pueden desactivar o eliminar las reglas de alerta? → A: Sí; al desactivarlas (`is_active = false`) o eliminarlas, su alerta deja de mostrarse y la regla se conserva o se retira del almacenamiento según la acción.

### Session 2026-11-22

- Q: ¿Qué actor se registra en la bitácora si no hay autenticación multiusuario? → A: El empleado seleccionado en la operación (`inspector_id`, `overridden_by` o responsable CAPA); solo si la operación no expone un empleado se usa el rol activo de `erp_quality:viewer_role` como metadato de auditoría, sin que ese metadato otorgue por sí mismo permisos distintos a los de la matriz del rol (FR-028/FR-048).
- Q: ¿Cómo se identifica el lote en una entrada de bitácora tras eliminar el registro auditado? → A: Cada entrada persiste `reference_module` + `reference_id` del documento origen, de modo que el filtro por lote sigue funcionando aunque la inspección, la NC o la CAPA ya no existan.
- Q: ¿Qué significan valor anterior y valor nuevo en `create` y `delete`? → A: En `create`, valor anterior es `null` y valor nuevo es el estado inicial; en `delete`, valor anterior es el último valor y valor nuevo es `null`; en `update` y `status_change` ambos están definidos.
- Q: ¿Se permite eliminar directamente una acción CAPA? → A: Sí, desde el formulario de CAPA; su entrada `delete` permanece en la bitácora y no altera la cascada de FR-026 al eliminar la no conformidad.
- Q: ¿Cómo deben resolverse los IDs duplicados T056–T060 entre las fases y el "Registro de Modificaciones" de `tasks.md`? → A: Renumerar las entradas del registro histórico como T094–T098.

### Session 2026-11-23

- Q: ¿Cómo se aplican los permisos sin autenticación multiusuario? → A: Con una matriz central de permisos evaluada por el rol activo de `erp_quality:viewer_role`; la interfaz oculta o deshabilita las acciones no permitidas y cada operación vuelve a validar el permiso antes de persistir, mostrando un mensaje explicativo sin alterar el estado. El rol no crea cuentas ni autentica usuarios reales.
- Q: ¿"Lista de verificación" es una entidad distinta del plan de inspección? → A: Sí. Se mantienen dos artefactos existentes: `quality_checklists` (plantillas de verificación con criterios y evaluaciones) y `quality_inspection_plans` (planes con criterios medibles). Una inspección puede seleccionar un plan y una lista de verificación aprobada; solo las listas `approved` se ofrecen para ejecutar inspecciones.
- Q: ¿Qué transiciones tiene una lista de verificación? → A: `draft` → `pending_approval` → `approved` o `rejected`; una lista rechazada vuelve a `draft` al editarla y requiere una nueva revisión. El rechazo exige justificación; la aprobación y el rechazo registran revisor y fecha. Los estados legados `active` y `archived` se interpretan como `approved` y fuera del flujo de aprobación, respectivamente.
- Q: ¿Qué transiciones tiene un plan de inspección? → A: Las mismas que una lista de verificación (`draft`, `pending_approval`, `approved`, `rejected`); solo los planes `approved` se ofrecen para inspecciones y un plan aprobado con inspecciones históricas se versiona duplicándolo.
- Q: ¿Cuál es el flujo de una inspección? → A: `draft` → `pending_review` → `completed`. El motor calcula un dictamen propuesto; el Inspector envía la inspección a revisión y el Jefe de Calidad emite el dictamen final `approved`, `approved_conditional` o `rejected`, con justificación cuando difiere del propuesto. La inspección no cuenta en los KPIs ni libera el lote hasta estar `completed`.
- Q: ¿Qué ocurre si el Jefe de Calidad rechaza una inspección? → A: La inspección queda `completed` con `overall_result = failed`; si no existe una no conformidad asociada, se genera el borrador de no conformidad con la descripción de los criterios incumplidos. Si el Jefe cambia un dictamen propuesto, la justificación es obligatoria, y un override posterior no genera otra NC.
- Q: ¿Cómo se aprueba el cierre de una acción CAPA? → A: El responsable reporta la ejecución con `status = completed` y, opcionalmente, evidencia; el cierre queda en `closure_status = pending`. El Jefe de Calidad lo aprueba o rechaza con justificación. Un rechazo devuelve la acción a `in_progress` y exige nueva ejecución. La revisión de eficacia se registra como `effective` o `not_effective` con observaciones antes de aprobar el cierre.
- Q: ¿Qué estados y campos tiene un documento de calidad? → A: `draft`, `pending_review`, `approved` y `rejected`; conserva código (`document_id`), nombre, tipo/categoría, versión, fecha de creación, responsable, archivo adjunto y metadatos de revisión (revisor, fecha y justificación). El estado legado `under_review` equivale a `pending_review`; `archived` queda fuera del nuevo flujo de aprobación.
- Q: ¿Qué tipos de documento se admiten? → A: Se reutiliza el catálogo existente `manual`, `procedure`, `regulation`, `certificate`, `specification` y `other`; el tipo se muestra como categoría del documento.
- Q: ¿Qué evidencia puede asociarse en esta etapa? → A: Inspecciones, no conformidades, acciones CAPA y documentos (`entity_type` ampliado con `corrective_action` y `document`). La evidencia de calidad mantiene PNG/JPG/PDF, 5 MB por archivo y 8 MB acumulados; el archivo principal de un documento conserva su límite existente de 10 MB.
- Q: ¿Qué indicadores de auditoría cubren listas, planes y documentos? → A: `entity_type` se amplía a `inspection_plan`, `checklist` y `document`, y `action` incorpora `review`, `approve` y `reject` además de `create`, `update`, `status_change` y `delete`, con justificación cuando corresponda.
- Q: ¿Qué ocurre si un rol no autorizado intenta una acción? → A: La acción no se ejecuta, se muestra un mensaje que explica el permiso requerido y el estado no cambia; la acción tampoco se ofrece en la interfaz. No se registra como cambio en la bitácora.
- Q: ¿Cómo se evita que existan pendientes de aprobación sin pantalla de revisión? → A: Todo estado `pending_approval` o `pending_review` debe tener una bandeja o pantalla de revisión accesible para el Jefe de Calidad; si un elemento entra en ese estado, la bandeja correspondiente debe mostrarlo y permitir aprobarlo o rechazarlo.
- Q: ¿Cómo se documenta el diseño visual sin implementar componentes ni modificar código en esta etapa? → A: Como requisitos funcionales, criterios de aceptación, criterios de éxito e inventario de componentes dentro de `spec.md`, concentrados en US15, FR-068–FR-083 y SC-028–SC-040. Esta revisión documental no cambia código por sí misma; los requisitos son obligatorios para la implementación del módulo y deben trasladarse a `plan.md` y `tasks.md` en una entrega posterior autorizada.
- Q: ¿Qué debe considerarse una pantalla del módulo para verificar el diseño visual? → A: Dashboard, lotes pendientes, planes y criterios, listas de verificación, documentos, ejecución de inspección, revisión de inspecciones, bandejas de pendientes, no conformidades, CAPA, cuarentena, historial, bitácora, exportación y alertas.
- Q: ¿El color es suficiente para distinguir estados y severidades? → A: No. Todo estado o severidad debe mostrar una etiqueta textual y puede usar color o icono como refuerzo; el color nunca es el único indicador.
- Q: ¿Qué criterios de accesibilidad visual se exigen para la verificación? → A: Contraste mínimo WCAG 2.1 AA para texto y controles, foco visible, orden de tabulación lógico, etiquetas de formulario legibles y estados que no dependan solo del color.
- Q: ¿Cómo se refleja el rol activo en cada pantalla? → A: Mediante un indicador visible del rol activo en el encabezado de todas las vistas, sin sustituir el selector "Rol de uso" del dashboard ni otorgar permisos adicionales.
- Q: ¿Cómo debe reorganizarse el menú lateral? → A: En cinco categorías —GENERAL, GESTIÓN DE CALIDAD, DOCUMENTACIÓN, ANÁLISIS y ADMINISTRACIÓN— con una sola entrada por destino, etiqueta activa visible y conservación de todas las funciones existentes; "Panel" y "Dashboard" se unifican en una única entrada "Inicio / Dashboard".
- Q: ¿Cómo se mapean las entradas nuevas del menú con la funcionalidad existente? → A: "Búsqueda" agrupa los buscadores y filtros ya definidos en lotes, historial y bitácora; "Reportes" agrupa exportaciones y resúmenes existentes; "Entidades" ofrece consulta de solo lectura de datos maestros referenciados; "Configuración" agrupa reglas de alerta y selector de rol. Ninguna entrada crea una entidad nueva ni elimina una operación previa.
- Q: ¿Qué debe priorizar el dashboard rediseñado? → A: Encabezado de bienvenida, indicadores esenciales, inspecciones pendientes y con dictamen final, no conformidades abiertas, CAPA pendientes o vencidas, documentos pendientes, gráficos de resultados, actividad reciente y accesos rápidos por rol, evitando tarjetas decorativas o indicadores duplicados.
- Q: ¿Qué identidad visual debe aplicarse? → A: Fondo claro, azul oscuro como color principal, azul para interacción, verde para aprobación, amarillo o naranja para pendiente, rojo para rechazo o problema, tarjetas de bordes suaves, espaciado uniforme, tipografía legible e iconos sencillos y consistentes, reforzando siempre los estados con texto.
- Q: ¿Qué hacer con formularios extensos y tablas densas? → A: Agrupar campos en bloques lógicos con revelación progresiva, y mostrar tablas con filtros, buscador, estados visibles y acciones; la información esencial debe verse primero y el detalle debe solicitarse solo cuando aporte valor.
- Q: ¿Qué anchos de pantalla deben verificarse? → A: Escritorio desde 1024 px, tablet de 768 a 1023 px y móvil de 360 a 767 px; tablas y formularios deben reorganizarse sin perder acciones, columnas clave ni legibilidad.
- Q: ¿La reorganización visual puede eliminar funcionalidades? → A: No. Toda pantalla y acción actual debe seguir accesible desde el nuevo menú o desde un acceso rápido equivalente; la reorganización cambia etiquetas, agrupación y jerarquía, no el alcance funcional.
- Q: ¿Qué significa "regla documentada" en FR-068? → A: El "Sistema visual de referencia y verificación" incorporado en `spec.md`; allí se definen tokens, escalas, menú, dashboard, columnas clave, bandejas y métodos de verificación.
- Q: ¿Qué significa "búsqueda sobre los registros mostrados"? → A: El buscador filtra únicamente el conjunto ya cargado y filtrado de la vista activa, por coincidencia insensible a mayúsculas sobre las columnas visibles; no consulta otras colecciones ni crea resultados nuevos.
- Q: ¿Qué es "actividad reciente"? → A: Las últimas 8 entradas de `quality_audit_log` ordenadas por `timestamp` descendente; muestra entidad, acción, actor y fecha, sin crear una entidad nueva.
- Q: ¿Qué son "accesos rápidos por rol"? → A: Enlaces a vistas ya especificadas, sin funcionalidad nueva: Jefe de Calidad accede a Aprobaciones pendientes, Revisión de inspecciones, Cierres CAPA y Reportes; Inspector a Lotes pendientes, Ejecución de inspección, Listas aprobadas y Registro de NC/CAPA; Gerente a Dashboard, Historial, Reportes y Bitácora en solo lectura.
- Q: ¿Cuál es el rol activo inicial? → A: `jefe_calidad` cuando no exista un valor válido en `erp_quality:viewer_role`; se conserva el valor guardado válido y el comportamiento no constituye autenticación real.
- Q: ¿Cuándo debe ejecutarse la migración de estados legacy? → A: Antes de renderizar cualquier bandeja o vista que dependa de estados migrados, de modo que ningún registro quede omitido por estados antiguos no normalizados.

### Glosario canónico de estados y decisiones

Esta sección es la fuente canónica de terminología para inspecciones, planes, listas, documentos y CAPA. Ningún requisito usa `conditional` como estado de inspección.

| Campo | Artefacto | Enumeración / valores | Significado |
|---|---|---|---|
| `status` | Plan, lista y documento de calidad | Plan/lista: `draft`, `pending_approval`, `approved`, `rejected`; documento: `draft`, `pending_review`, `approved`, `rejected` | Ciclo de vida del artefacto. En planes, listas y documentos la decisión se conserva en `status` con `reviewed_by`, `reviewed_at` y `review_justification`; `review_decision` es exclusivo de inspecciones. `under_review` es legado equivalente a `pending_review` y `archived` queda fuera del flujo de aprobación. |
| `inspection_status` | Inspección | `draft`, `pending_review`, `completed` | Estado del flujo de ejecución/revisión. No es un dictamen. |
| `proposed_result` | Inspección | `passed`, `conditional`, `failed`; `null` en `draft` | Dictamen calculado por el motor al enviar la inspección a revisión. |
| `overall_result` | Inspección | `passed`, `conditional`, `failed`; `null` hasta la decisión final en el flujo normal | Resultado final. Se fija por la revisión según `review_decision`. |
| `review_decision` | Inspección | `approved`, `approved_conditional`, `rejected`; `null` antes de la revisión | Decisión del Jefe de Calidad. Mapeo: `approved → passed`, `approved_conditional → conditional`, `rejected → failed`. |
| `status` / `closure_status` | CAPA | `pending`, `in_progress`, `completed` / `pending`, `approved`, `rejected` | `completed` significa ejecución reportada, no cierre aprobado. |

Convenciones:

- Flujo normal de inspección: `draft → pending_review → completed`; `review_decision` se registra antes de `completed` y la inspección no cuenta en KPIs ni libera el lote hasta `completed`.
- Caso heredado/excepción: una inspección `completed` con `proposed_result = conditional` y `review_decision = null` permanece en la bandeja de revisión hasta que se registre una decisión; no constituye el flujo normal y no retrocede a `pending_review`. Los datos migrados sin revisión se identifican con `legacy_completed = true` y conservan `overall_result`.
- "Inspecciones pendientes" del dashboard/KPI son `draft` y `pending_review`; la bandeja de aprobaciones incluye además el caso heredado/excepción `completed` condicional sin `review_decision`.
- `approved`, `approved_conditional` y `rejected` son decisiones; `passed`, `conditional` y `failed` son resultados. `conditional` nunca se usa como valor de `inspection_status`.

## Problema y Solución

**Problema.** En muchas empresas los controles de calidad se registran en planillas aisladas del flujo operativo. Esto permite que materias primas defectuosas entren a producción, que lotes con fallas sigan procesándose o que productos defectuosos lleguen al cliente, generando devoluciones, mermas y pérdida de trazabilidad ante auditorías (por ejemplo, ISO 9001).

**Solución.** Un módulo transversal de Control de Calidad que cubre las etapas `incoming`, `in_process` y `final`, con planes y criterios configurables, listas de verificación aprobables, identificación de lotes pendientes, evaluación automática de tolerancias, registro de no conformidades, cuarentena y seguimiento CAPA. La segunda etapa incorpora roles con permisos diferenciados, flujos de revisión y aprobación para planes, listas de verificación, documentos e inspecciones, aprobación del cierre de CAPA y una experiencia de usuario consistente con estados y acciones visibles. El diseño visual se especifica como requisitos verificables por pantalla y por rol —menú simplificado, dashboard priorizado, jerarquía de tarjetas, tablas y formularios, densidad controlada, paleta semántica, adaptabilidad y accesibilidad—. La edición de esta especificación no modifica componentes, interfaz ni código; sin embargo, US15, FR-068–FR-083 y SC-028–SC-040 son obligatorios para la implementación y deben incorporarse a la planificación y a las tareas antes de ejecutar `/speckit.implement`. La reorganización conserva todas las funcionalidades existentes y solo cambia su agrupación, etiquetado y jerarquía. El MVP será una aplicación frontend con persistencia local, coherente con el módulo base ERP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar planes y criterios de inspección (Priority: P1)

Como Jefe de Calidad, quiero crear y mantener planes de inspección asociados a un producto y a una etapa operativa, definiendo los criterios, valores esperados y tolerancias que deberán cumplirse, y gestionar su ciclo de vida de aprobación, para estandarizar el control técnico de los lotes y asegurar que solo se usen planes aprobados.

**Why this priority**: Sin planes ni criterios no existe una referencia contra la cual inspeccionar; es la base de todo el flujo de calidad y el punto de partida del control de versiones.

**Independent Test**: Crear un plan para un producto y etapa, agregar criterios con valor esperado y tolerancia, enviarlo a aprobación, aprobarlo y verificar que solo entonces queda disponible para ejecutar inspecciones.

Datos: `quality_inspection_plans`, `quality_inspection_criteria`, `products`; se añaden `status` (`draft`, `pending_approval`, `approved`, `rejected`), `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at` y `review_justification`.

**Acceptance Scenarios**:

1. **Given** un producto existente y una etapa válida, **When** el Jefe de Calidad crea un plan con nombre, **Then** el plan se guarda en estado `draft` y no queda disponible para inspecciones hasta ser aprobado.
2. **Given** un plan existente, **When** se agrega un criterio con valor esperado, tolerancia, unidad, tipo de comparación y criticidad, **Then** el criterio queda asociado al plan.
3. **Given** un plan o criterio con campos obligatorios incompletos, **When** se intenta guardar, **Then** el sistema muestra un error de validación y no persiste el registro.
4. **Given** un plan sin inspecciones asociadas, **When** el Jefe de Calidad lo edita o elimina, **Then** los cambios se reflejan y sus criterios se actualizan o eliminan en cascada.
5. **Given** un plan o criterio con inspecciones históricas, **When** el Jefe de Calidad intenta editarlo o eliminarlo, **Then** el sistema bloquea la operación e informa que debe duplicar el plan para crear una nueva versión.
6. **Given** un plan bloqueado por tener inspecciones, **When** el Jefe de Calidad lo duplica, **Then** se crea un nuevo plan en estado `draft` con los mismos criterios y sin alterar el historial.
7. **Given** un plan `draft` con al menos un criterio, **When** el Jefe de Calidad lo envía a aprobación, **Then** el plan pasa a `pending_approval` y aparece en la bandeja de revisión del Jefe de Calidad.
8. **Given** un plan `pending_approval`, **When** el Jefe de Calidad lo aprueba, **Then** el plan pasa a `approved` y queda disponible para seleccionarlo en una inspección.
9. **Given** un plan `pending_approval`, **When** el Jefe de Calidad lo rechaza con justificación, **Then** el plan pasa a `rejected`, la justificación queda visible y el plan no se ofrece para inspecciones.
10. **Given** un plan `rejected`, **When** el Jefe de Calidad lo edita, **Then** vuelve a `draft`, conserva la justificación del rechazo y requiere un nuevo envío a aprobación.
11. **Given** un plan `approved` con inspecciones históricas, **When** el Jefe de Calidad intenta modificar sus criterios, **Then** el sistema bloquea la edición y exige duplicarlo como nueva versión `draft`.

---

### User Story 2 - Identificar lotes pendientes y ejecutar una inspección con evaluación automática (Priority: P2)

Como Inspector de Calidad, quiero ver los lotes pendientes y registrar las mediciones de una inspección vinculada a un lote o documento origen, seleccionando un plan y una lista de verificación aprobados, adjuntando evidencia y registrando no conformidades, para que el sistema evalúe automáticamente cada criterio y envíe la inspección a revisión del Jefe de Calidad.

**Why this priority**: Es el núcleo operativo del módulo; sin identificación de lotes, listas aprobadas ni inspecciones no se detectan desviaciones ni se generan no conformidades.

**Independent Test**: Abrir la lista de lotes pendientes, iniciar una inspección sobre un origen válido con plan y lista aprobados, ingresar mediciones, adjuntar evidencia, registrar una no conformidad y enviar a revisión; comprobar el dictamen propuesto y el estado `pending_review`.

Datos: `quality_inspections`, `quality_inspection_results`, `quality_inspection_plans`, `quality_inspection_criteria`, `quality_checklists`, `non_conformances`, `quality_evidence`, `products`, `employees`, `goods_receipts`, `production_orders`, `shipments`. La inspección incorpora `checklist_id`, `inspection_status` (`draft`, `pending_review`, `completed`), `proposed_result`, `overall_result` y metadatos de revisión (`review_decision`, `reviewed_by`, `reviewed_at`, `review_justification`).

**Acceptance Scenarios**:

1. **Given** documentos origen cargados, **When** el Inspector abre la vista de lotes pendientes, **Then** la tabla muestra ID de lote, producto, fecha y estado, incluyendo solo los lotes sin inspección completada.
2. **Given** la tabla de lotes pendientes, **When** el Inspector usa la acción "Inspeccionar", **Then** se abre el formulario de inspección con el lote preseleccionado; si ya existe un borrador para ese origen y plan, se reanuda con las mediciones conservadas en lugar de crear uno nuevo.
3. **Given** un plan `approved` y una lista de verificación `approved`, y un documento origen cuyo producto y etapa coinciden con el plan, **When** el Inspector registra la inspección con fecha e inspector, **Then** la inspección se guarda en estado `draft` asociada al plan, a la lista y a un origen válido.
4. **Given** una inspección en curso, **When** el Inspector ingresa un valor medido numérico por criterio, **Then** el sistema calcula el cumplimiento comparando el valor con el valor esperado, la tolerancia y el tipo de comparación.
5. **Given** todos los criterios evaluados, **When** el Inspector envía la inspección a revisión, **Then** el sistema calcula un dictamen propuesto: `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos cumplen; el dictamen final queda pendiente de la revisión del Jefe de Calidad.
6. **Given** una medición exactamente en el límite de la tolerancia, **When** se evalúa, **Then** el criterio se considera cumplido.
7. **Given** una inspección con algún criterio sin medición o con valor no numérico, **When** el Inspector intenta enviarla a revisión, **Then** el sistema no emite dictamen ni cambia de estado y conserva `draft`, informando los criterios faltantes.
8. **Given** un origen inexistente o no válido, **When** se intenta guardar la inspección, **Then** el sistema rechaza el registro y lo explica.
9. **Given** un dictamen calculado, **When** el usuario intenta modificarlo manualmente, **Then** el sistema lo impide salvo el flujo de revisión del Jefe de Calidad descrito en la historia 4.
10. **Given** una inspección `completed` tras la revisión, **When** se actualiza la vista de lotes pendientes, **Then** el lote deja de aparecer como pendiente y la inspección queda disponible en el historial.
11. **Given** planes o listas de verificación en estado `draft`, `pending_approval` o `rejected`, **When** el Inspector abre el formulario de inspección, **Then** esos elementos no se ofrecen como opciones; solo se listan los `approved`.
12. **Given** una inspección `draft` o `pending_review`, **When** el Inspector adjunta fotografías o documentos y registra una no conformidad, **Then** la evidencia y la no conformidad quedan asociadas a la inspección y visibles en su detalle.
13. **Given** una inspección con criterios completos, evidencia y no conformidades registradas, **When** el Inspector usa la acción "Enviar a revisión", **Then** la inspección pasa a `pending_review`, deja de aceptar cambios en mediciones y criterios y aparece en la bandeja de revisión del Jefe de Calidad.
14. **Given** una inspección `pending_review`, **When** se consulta el dashboard o la vista de lotes pendientes, **Then** no se contabiliza en la tasa de aprobación y el lote sigue pendiente hasta que exista un dictamen final.
15. **Given** una inspección `pending_review`, **When** el Inspector intenta aprobarla, rechazarla o cambiar su dictamen, **Then** la acción no está disponible y el sistema informa que la revisión corresponde al Jefe de Calidad.

---

### User Story 3 - Registrar no conformidades y acciones CAPA (Priority: P3)

Como Inspector de Calidad, con supervisión del Jefe de Calidad, quiero que una inspección reprobada origine una no conformidad con descripción obligatoria y permita registrar su producto o lote, gravedad, evidencias y responsable, y asociar una o más acciones correctivas o preventivas con responsable, fecha límite y evidencia, para cerrar el ciclo de mejora.

**Why this priority**: Convierte una detección en una acción concreta y trazable; sin esto el módulo solo registraría fallas.

**Independent Test**: Reproducir una inspección reprobada, verificar la no conformidad autogenerada, asignarle responsable y evidencia, asociar una acción CAPA con responsable, causa raíz, tipo de acción y vencimiento, y comprobar su trazabilidad.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`, `quality_evidence`, `employees`; la no conformidad incorpora `reference_module` + `reference_id` del lote y `responsible_employee_id`; la CAPA incorpora evidencia, `closure_status` y revisión de eficacia.

**Acceptance Scenarios**:

1. **Given** una inspección `pending_review` o el caso heredado `completed` condicional sin decisión, **When** el Jefe de Calidad emite `rejected` con `overall_result = failed`, **Then** el sistema genera un borrador de no conformidad con descripción autogenerada de los criterios incumplidos, producto y lote del origen, tipo de defecto `other`, severidad `major` y estado `open`.
2. **Given** un borrador de no conformidad, **When** se intenta guardar sin descripción, **Then** el sistema muestra un error de validación y no persiste el registro.
3. **Given** una no conformidad, **When** se clasifica, **Then** se registran su tipo de defecto (`dimensional`, `functional`, `packaging`, `other`), severidad (`minor`, `major`, `critical`), estado (`open`, `under_review`, `closed`) y el responsable asignado.
4. **Given** una no conformidad abierta, **When** se crea una acción CAPA, **Then** el sistema exige responsable, descripción, causa raíz, tipo de acción (`resampling`, `rework`, `other`) y fecha límite, y permite adjuntar evidencia.
5. **Given** una acción CAPA con fecha límite vencida y cierre no aprobado, **When** se consulta, **Then** el sistema la identifica como vencida.
6. **Given** una inspección y su no conformidad, **When** se revisa el historial, **Then** se conserva la trazabilidad desde la medición hasta la aprobación del cierre de la acción CAPA.
7. **Given** una inspección `completed` con `proposed_result = conditional` y `review_decision = null`, **When** el Jefe de Calidad abre su bandeja, **Then** la inspección aparece como pendiente y no se genera una no conformidad automática; **When** registra cualquier `review_decision`, **Then** sale de la bandeja.
8. **Given** una inspección `draft` o `pending_review`, o un registro originado fuera de una inspección reprobada, **When** el Inspector o el Jefe de Calidad crea manualmente una no conformidad desde el formulario, **Then** el sistema exige descripción no vacía, inspección asociada cuando exista, producto o lote, severidad y responsable, permite adjuntar evidencia y conserva la creación manual como camino válido sin depender de un dictamen automático.
9. **Given** una no conformidad, **When** se asocian varias acciones CAPA, **Then** todas quedan vinculadas a la misma no conformidad y visibles en su detalle.
10. **Given** una no conformidad con evidencias, **When** se consulta su detalle, **Then** las evidencias se listan y permiten descarga.
11. **Given** una acción CAPA en ejecución, **When** el responsable la marca como `completed` con evidencia, **Then** la acción queda pendiente de aprobación de cierre y no se considera cerrada hasta el dictamen del Jefe de Calidad (US14).
12. **Given** altas y cambios de no conformidades y CAPA, **When** se consulta la bitácora, **Then** se registran usuario, fecha, estado y justificación cuando corresponda.

---

### User Story 4 - Revisar dictamen, resultados condicionales y lotes en cuarentena (Priority: P4)

Como Jefe de Calidad, quiero revisar las inspecciones enviadas a revisión y las inspecciones con resultado condicional, emitir una decisión final aprobada, aprobada condicional o reprobada con justificación registrada, y gestionar los lotes retenidos, para resolver desviaciones antes de liberar o rechazar el lote definitivamente.

**Why this priority**: Aporta control y evidencia ante auditorías, pero depende de que ya existan inspecciones enviadas a revisión o condicionales.

**Independent Test**: Abrir una inspección en `pending_review`, intentar aprobarla con criterios críticos fallidos y verificar el bloqueo; emitir un dictamen final con justificación y comprobar el registro de revisor, usuario y fecha; finalmente revisar un lote en cuarentena.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`; la inspección conserva `review_decision`, `reviewed_by`, `reviewed_at` y `review_justification`.

**Acceptance Scenarios**:

1. **Given** una inspección con criterios críticos fallidos o sin medición, **When** el Jefe de Calidad intenta emitir `approved` (resultado final `passed`), **Then** el sistema lo bloquea y explica el motivo.
2. **Given** una inspección con `overall_result = failed` o con `proposed_result/overall_result = conditional`, **When** el Jefe de Calidad cambia el dictamen mediante revisión u override, **Then** el sistema exige una justificación, registra usuario y fecha del cambio, y no permite `approved` ni `overall_result = passed` si hay criterios críticos fallidos o sin medición.
3. **Given** una inspección `completed`, **When** el Jefe de Calidad cambia su dictamen a `failed` con justificación, **Then** el sistema fija el dictamen en `failed`, registra justificación, usuario y fecha, conserva la inspección en estado `completed` y no genera una no conformidad automática.
4. **Given** una inspección `pending_review` o `completed` con `proposed_result = conditional` y `review_decision = null`, **When** se abre la bandeja de revisión, **Then** aparece marcada como pendiente de revisión del Jefe de Calidad.
5. **Given** un lote con no conformidad `open` o `under_review`, **When** se abre la pestaña de cuarentena, **Then** la tabla muestra ID de lote, producto, severidad y tipo de defecto, y permite abrir la acción CAPA correspondiente.
6. **Given** un lote en cuarentena sin CAPA, **When** el Jefe de Calidad asigna una acción, **Then** el lote se muestra como "Cuarentena - En tratamiento".
7. **Given** una no conformidad abierta o en revisión, **When** el Jefe de Calidad cambia su estado a `closed`, **Then** la no conformidad queda `closed` y el lote deja de aparecer en cuarentena, sin exigir que sus acciones CAPA tengan el cierre aprobado.
8. **Given** una inspección `pending_review`, **When** el Jefe de Calidad abre su detalle, **Then** visualiza criterios, mediciones, dictamen propuesto, evidencia y no conformidades asociadas antes de emitir el dictamen.
9. **Given** una inspección `pending_review` sin criterios críticos fallidos, **When** el Jefe de Calidad emite `approved`, **Then** la inspección pasa a `completed` con dictamen final `passed`.
10. **Given** una inspección `pending_review` con solo desviaciones no críticas, **When** el Jefe de Calidad emite `approved_conditional`, **Then** la inspección pasa a `completed` con dictamen final `conditional` y queda sujeta a seguimiento.
11. **Given** una inspección `pending_review` o `completed` con `proposed_result = conditional` y `review_decision = null`, **When** el Jefe de Calidad emite `rejected` con justificación, **Then** la inspección pasa o permanece `completed` con `overall_result = failed`; si no existe no conformidad asociada, se genera su borrador automático. Ningún override posterior genera otra NC.
12. **Given** una inspección `pending_review`, **When** el Jefe de Calidad emite cualquier dictamen final, **Then** el sistema registra `review_decision`, revisor y fecha, y exige justificación cuando el dictamen difiere del propuesto o es condicional/reprobado.
13. **Given** una inspección `pending_review`, **When** el Inspector o el Gerente de Operaciones intentan revisarla o emitir dictamen, **Then** la acción no está disponible y el sistema explica que corresponde al Jefe de Calidad.
14. **Given** una revisión de inspección, **When** se consulta la bitácora, **Then** se registra una única entrada `approve` o `reject` con dictamen, revisor, fecha y justificación, sin duplicar la entrada de cambio de estado.

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
4. **Given** inspecciones en estado `draft` o `pending_review`, **When** se abre el dashboard, **Then** se muestran como inspecciones pendientes, sin contabilizarse aún en la tasa de aprobación.
5. **Given** cierres de CAPA aprobados, **When** se abre el dashboard, **Then** se muestra eficacia como cierres aprobados con `effectiveness_result = effective` sobre el total de cierres aprobados, con 0 cuando no haya cierres aprobados.
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

### User Story 8 - Adjuntar evidencia a inspecciones, no conformidades, CAPA y documentos (Priority: P8)

Como Inspector de Calidad y Jefe de Calidad, quiero adjuntar imágenes o documentos de respaldo a una inspección, una no conformidad, una acción CAPA y un documento de calidad, para conservar evidencia verificable ante auditorías y revisiones internas.

**Why this priority**: Refuerza la trazabilidad y la evidencia documental; depende de que existan inspecciones, no conformidades y acciones CAPA.

**Independent Test**: Adjuntar un archivo permitido a una inspección, a su no conformidad, a una acción CAPA y a un documento, y verificar que la evidencia queda listada y descargable desde el detalle correspondiente.

Datos: `quality_inspections`, `non_conformances`, `corrective_actions`, `quality_documents`, `quality_evidence`; `entity_type` se amplía a `inspection`, `non_conformance`, `corrective_action` y `document`.

**Acceptance Scenarios**:

1. **Given** una inspección en estado `draft`, `pending_review` o `completed`, **When** el Inspector adjunta un archivo con tipo y tamaño permitidos, **Then** la evidencia queda asociada a la inspección con nombre, tipo, tamaño, autor y fecha.
2. **Given** una no conformidad existente, **When** se adjunta un archivo válido, **Then** la evidencia queda asociada a la no conformidad y visible en su detalle.
3. **Given** un archivo con tipo distinto de PNG/JPG/PDF, tamaño superior a 5 MB o una carga que excede 8 MB acumulados o la cuota, **When** se intenta adjuntar, **Then** el sistema rechaza la operación y explica el motivo.
4. **Given** una inspección, no conformidad, CAPA o documento con evidencia, **When** se consulta su detalle o el historial, **Then** la evidencia se lista y puede previsualizarse y descargarse conservando su vínculo.
5. **Given** una inspección sin no conformidad con evidencia adjunta, **When** se elimina la inspección, **Then** su evidencia se elimina en cascada; si tiene no conformidad, la eliminación se bloquea.
6. **Given** una no conformidad con evidencia y acciones CAPA, **When** se elimina la no conformidad, **Then** se eliminan en cascada su evidencia y sus acciones CAPA.
7. **Given** una acción CAPA en ejecución, **When** el responsable adjunta evidencia de la ejecución, **Then** la evidencia queda asociada a la acción y disponible para la revisión de cierre del Jefe de Calidad.
8. **Given** una acción CAPA con evidencia, **When** se elimina la acción, **Then** su evidencia se elimina en cascada y la entrada de auditoría permanece.
9. **Given** un documento de calidad, **When** se permite adjuntar su archivo principal, **Then** el archivo se conserva con nombre, tipo, tamaño, autor y fecha, y se puede previsualizar antes de aprobar o rechazar.
10. **Given** evidencia adicional de un documento, **When** se adjunta un archivo de calidad válido, **Then** queda asociada al documento y visible en su detalle.
11. **Given** un documento eliminado o una versión reemplazada, **When** se consulta la evidencia, **Then** se aplican las reglas de conservación y cascada definidas para documentos y su auditoría.

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

Como Gerente de Operaciones (rol `gerente`) y Jefe de Calidad, quiero consultar una bitácora de los cambios realizados sobre planes, listas de verificación, documentos, inspecciones, no conformidades y acciones CAPA —qué cambió, quién lo creó, modificó, revisó, aprobó o rechazó, cuándo y por qué—, para demostrar trazabilidad ante una auditoría incluso cuando el registro ya fue eliminado.

**Why this priority**: Complementa US1–US4, US6, US8 y US12–US14: el flujo de revisión y aprobación de la segunda etapa requiere demostrar autoría, decisión y justificación en cada artefacto. No bloquea el flujo operativo del MVP.

**Independent Test**: Crear un plan o lista, enviarlo a aprobación, aprobarlo; crear un documento, enviarlo a revisión y rechazarlo con justificación; revisar una inspección y aprobar el cierre de una CAPA; verificar que la bitácora muestra todas las acciones filtrando por lote y rango de fechas.

Datos: `quality_audit_log` (entidad (`inspection_plan`/`checklist`/`document`/`inspection`/`non_conformance`/`corrective_action`), ID de registro, `reference_module` + `reference_id` del lote cuando aplique, acción (`create`/`update`/`review`/`approve`/`reject`/`status_change`/`delete`), campo modificado, valor anterior, valor nuevo, usuario/actor, marca temporal ISO y justificación), `quality_inspection_plans`, `quality_checklists`, `quality_documents`, `quality_inspections`, `non_conformances`, `corrective_actions`

**Acceptance Scenarios**:

1. **Given** planes, listas, documentos, inspecciones, no conformidades o acciones CAPA creados o editados, **When** se abre la bitácora, **Then** se listan entradas con entidad, ID de registro, acción (`create`, `update`, `review`, `approve`, `reject`, `status_change` o `delete`), campo modificado con valor anterior y nuevo, usuario y fecha.
2. **Given** un cambio de dictamen con justificación, **When** se consulta la bitácora, **Then** aparecen la justificación, el usuario y la fecha, sin generar una segunda entrada duplicada.
3. **Given** una no conformidad cerrada, una acción CAPA con ejecución reportada o un cierre de CAPA aprobado, **When** se consulta la bitácora, **Then** se registra el cambio de estado y su marca temporal.
4. **Given** una eliminación permitida (inspección sin no conformidad, CAPA eliminada directamente o no conformidad con CAPA en cascada), **When** se elimina el registro, **Then** su entrada de auditoría permanece consultable aunque el registro ya no exista.
5. **Given** varias entradas en la bitácora, **When** se filtra por lote (documento origen), tipo de entidad o rango de fechas, **Then** se muestran solo las coincidencias, con una acción para limpiar filtros y un estado vacío claro cuando no haya resultados.
6. **Given** un rango de fechas inválido (desde posterior a hasta), **When** se intenta aplicar, **Then** se informa el error y no se modifica la vista, igual que en US6.
7. **Given** un plan o una lista de verificación enviada a aprobación, **When** el Jefe de Calidad la aprueba o rechaza con justificación, **Then** la bitácora registra `review`/`approve`/`reject`, el revisor, la fecha y la justificación.
8. **Given** un documento creado, modificado, enviado a revisión, aprobado o rechazado, **When** se consulta la bitácora, **Then** se registran el actor, la fecha, el estado y la justificación cuando corresponda.
9. **Given** una inspección revisada por el Jefe de Calidad, **When** se consulta la bitácora, **Then** se registra una única entrada `approve` o `reject` con dictamen final, revisor, fecha y justificación, sin duplicar el cambio de estado.
10. **Given** una acción CAPA cuyo cierre se aprueba o rechaza, **When** se consulta la bitácora, **Then** se registran la decisión, la justificación, el revisor y la fecha, además del cambio de estado.
11. **Given** una operación intentada por un rol no autorizado, **When** se rechaza, **Then** no se registra como cambio en la bitácora y el estado del registro permanece intacto.
12. **Given** registros de planes, listas y documentos eliminados, **When** se filtra la bitácora por su identificador o fecha, **Then** las entradas de auditoría siguen disponibles aunque el registro ya no exista.

---

### User Story 11 - Gestionar roles y permisos de uso (Priority: P11)

Como responsable del módulo de calidad, quiero que el rol activo determine qué acciones puede realizar cada usuario, para separar responsabilidades y evitar que se aprueben, rechacen o modifiquen registros sin autorización.

**Why this priority**: Es la base de los flujos de aprobación de la segunda etapa; sin permisos, cualquier rol podría aprobar o cerrar registros que debe revisar el Jefe de Calidad.

**Independent Test**: Cambiar el rol activo entre `jefe_calidad`, `inspector` y `gerente` y verificar que las acciones disponibles, los botones visibles y los mensajes de rechazo coinciden con la matriz de permisos.

Datos: `erp_quality:viewer_role` (rol activo persistido), `employees` (actor de la operación cuando corresponda), entidades de planes, listas, documentos, inspecciones, no conformidades y CAPA.

**Acceptance Scenarios**:

1. **Given** la aplicación abierta sin un valor válido en `erp_quality:viewer_role`, **When** se renderiza una vista, **Then** el rol inicial es `jefe_calidad`, ese valor se persiste y las acciones se muestran según la matriz de permisos.
2. **Given** la aplicación abierta, **When** el usuario cambia el "Rol de uso" a `jefe_calidad`, `inspector` o `gerente`, **Then** el rol se persiste en `localStorage` y las vistas vuelven a renderizarse con las acciones permitidas.
3. **Given** el rol `jefe_calidad`, **When** se consultan las acciones disponibles, **Then** puede crear y editar planes y listas, aprobarlos o rechazarlos, aprobar o rechazar documentos e inspecciones, supervisar no conformidades y aprobar o rechazar el cierre de CAPA.
4. **Given** el rol `inspector`, **When** se consultan las acciones disponibles, **Then** puede ejecutar inspecciones, completar listas aprobadas, registrar evidencias, crear no conformidades y proponer acciones CAPA, pero no puede aprobar ni rechazar planes, listas, documentos, inspecciones ni cierres de CAPA.
5. **Given** el rol `gerente`, **When** se consultan las acciones disponibles, **Then** puede consultar indicadores, reportes, resultados de inspecciones, lotes en cuarentena y estado de CAPA en modo solo lectura, sin crear, editar, eliminar ni aprobar registros.
6. **Given** un rol sin permiso para una acción, **When** el usuario intenta ejecutarla, **Then** la acción no se ofrece o se muestra deshabilitada y, si se invoca, el sistema la bloquea con un mensaje que indica el permiso requerido, sin cambiar el estado.
7. **Given** una acción permitida, **When** se ejecuta, **Then** el sistema registra al actor (empleado seleccionado o rol activo cuando no exista empleado) y la fecha en la bitácora.
8. **Given** un elemento pendiente de aprobación o revisión, **When** el rol activo no es `jefe_calidad`, **Then** el elemento se muestra en modo lectura con su estado, sin acciones de aprobar o rechazar.
9. **Given** un cambio de rol durante la sesión, **When** se vuelve a una vista con un formulario en curso, **Then** las acciones se recalculan según el nuevo rol y no se conserva ningún permiso del rol anterior.

**Matriz de permisos**:

| Acción | Jefe de Calidad | Inspector de Calidad | Gerente de Operaciones |
|---|---|---|---|
| Consultar dashboard, indicadores, reportes e historial | Sí | Sí, con detalle propio limitado | Sí, solo lectura |
| Crear y editar planes y listas de verificación | Sí | No | No |
| Enviar planes y listas a aprobación | Sí | No | No |
| Aprobar o rechazar planes y listas | Sí | No | No |
| Crear y editar documentos | Sí | Sí, en borrador | No |
| Enviar documentos a revisión | Sí | Sí | No |
| Aprobar o rechazar documentos | Sí | No | No |
| Ejecutar inspecciones y completar listas aprobadas | Sí | Sí | No |
| Adjuntar evidencia | Sí | Sí | No |
| Crear no conformidades | Sí | Sí | No |
| Crear o proponer acciones CAPA | Sí | Sí | No |
| Aprobar o rechazar el cierre de CAPA y su eficacia | Sí | No | No |
| Configurar alertas | Sí | No | No |
| Exportar reportes e historial | Sí | No | Sí |
| Eliminar registros | Según reglas de integridad | Solo borradores sin historial | No |

**Dependencias**: Habilita US1, US2, US4, US12, US13 y US14. Depende de la infraestructura de persistencia y de la selección de empleado existente.

---

### User Story 12 - Gestionar listas de verificación con flujo de aprobación (Priority: P12)

Como Jefe de Calidad, quiero crear, editar, enviar a aprobación y aprobar o rechazar listas de verificación, para asegurar que solo las listas validadas se usen al ejecutar inspecciones.

**Why this priority**: Evita que listas incompletas o no revisadas se usen en inspecciones y refuerza el control documental exigido por auditorías.

**Independent Test**: Crear una lista con criterios, enviarla a aprobación, aprobarla y verificar que aparece disponible para inspecciones; rechazar otra lista con justificación y comprobar que no se ofrece hasta corregirla y reenviarla.

Datos: `quality_checklists` (nombre, descripción, categoría, criterios, evaluaciones, `status`, `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_justification`), `employees`.

**Acceptance Scenarios**:

1. **Given** el rol `jefe_calidad`, **When** crea una lista con nombre y categoría, **Then** la lista se guarda en estado `draft`; la descripción y los criterios pueden completarse antes de enviarla a aprobación (escenario 3).
2. **Given** una lista `draft`, **When** el Jefe de Calidad agrega, edita o elimina criterios, **Then** los cambios se guardan y la lista permanece en `draft`.
3. **Given** una lista `draft` sin criterios o con campos obligatorios vacíos, **When** se intenta enviar a aprobación, **Then** el sistema muestra un error de validación y no cambia el estado.
4. **Given** una lista `draft` con al menos un criterio, **When** el Jefe de Calidad la envía a aprobación, **Then** pasa a `pending_approval` y aparece en la bandeja de revisión de listas.
5. **Given** una lista `pending_approval`, **When** el Jefe de Calidad abre su revisión, **Then** visualiza nombre, categoría, descripción, criterios y historial de versiones antes de decidir.
6. **Given** una lista `pending_approval`, **When** el Jefe de Calidad la aprueba, **Then** pasa a `approved` y se registran revisor y fecha.
7. **Given** una lista `pending_approval`, **When** el Jefe de Calidad la rechaza, **Then** pasa a `rejected` y exige una justificación no vacía que queda visible.
8. **Given** una lista `rejected`, **When** el Jefe de Calidad la edita, **Then** vuelve a `draft`, conserva la justificación del rechazo y requiere un nuevo envío a aprobación.
9. **Given** una lista `draft`, `pending_approval` o `rejected`, **When** el Inspector abre el formulario de inspección o la vista de evaluación, **Then** la lista no se ofrece como opción.
10. **Given** una lista `approved`, **When** el Inspector selecciona la lista para una inspección o evaluación, **Then** la lista queda disponible y sus evaluaciones se asocian a la versión aprobada.
11. **Given** una lista `approved` con evaluaciones o inspecciones históricas, **When** el Jefe de Calidad intenta modificar sus criterios, **Then** el sistema bloquea la edición y exige duplicarla como una nueva lista `draft` versionada.
12. **Given** una lista aprobada, rechazada o enviada a revisión, **When** se consulta la bitácora, **Then** se registran las acciones, el actor, la fecha y la justificación cuando corresponda.

**Dependencias**: Depende de US11 (permisos del Jefe de Calidad) y de la infraestructura de listas existente; habilita la selección de listas aprobadas en US2 y se audita con US10.

---

### User Story 13 - Gestionar documentos de calidad con revisión y aprobación (Priority: P13)

Como Jefe de Calidad o Inspector de Calidad, quiero crear y mantener documentos de calidad con código, versión, tipo, responsable y archivo adjunto, y que el Jefe de Calidad los revise, apruebe o rechace con justificación, para controlar la documentación vigente y su trazabilidad.

**Why this priority**: La documentación de calidad debe estar controlada y aprobada antes de usarse como referencia; el módulo ya cuenta con un administrador documental que debe completarse con el flujo de revisión.

**Independent Test**: Crear un documento con archivo, enviarlo a revisión, previsualizarlo, aprobarlo y verificar el estado y la auditoría; rechazar otro documento con justificación y comprobar que vuelve a borrador al editarlo.

Datos: `quality_documents` (documento código `document_id`, nombre, tipo/categoría, descripción, versión, fecha de creación, responsable, archivo, `status`, `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_justification`), `quality_evidence`, `employees`.

**Acceptance Scenarios**:

1. **Given** el rol `jefe_calidad` o `inspector`, **When** se crea un documento con nombre, tipo/categoría, código, versión, fecha de creación, responsable y archivo adjunto válido, **Then** el documento se guarda en estado `draft`.
2. **Given** un documento `draft`, **When** se modifican sus datos o su archivo, **Then** los cambios se guardan y el documento permanece en `draft`.
3. **Given** un documento `draft` con campos obligatorios incompletos, archivo inválido o responsable inexistente, **When** se intenta enviar a revisión, **Then** el sistema muestra un error de validación y no cambia el estado.
4. **Given** un documento `draft` completo, **When** se envía a revisión, **Then** pasa a `pending_review` y aparece en la bandeja de documentos pendientes del Jefe de Calidad.
5. **Given** un documento `pending_review`, **When** el Jefe de Calidad abre su detalle, **Then** puede visualizar o previsualizar el archivo y sus metadatos antes de aprobarlo o rechazarlo.
6. **Given** un documento `pending_review`, **When** el Jefe de Calidad lo aprueba, **Then** pasa a `approved` y se registran revisor y fecha.
7. **Given** un documento `pending_review`, **When** el Jefe de Calidad lo rechaza, **Then** pasa a `rejected` y exige una justificación no vacía que queda visible.
8. **Given** un documento `rejected`, **When** se edita, **Then** vuelve a `draft`, conserva la justificación del rechazo y requiere un nuevo envío a revisión.
9. **Given** un documento `approved`, **When** se requiere modificarlo, **Then** el sistema exige crear una nueva versión `draft` y conserva la versión aprobada y su historial.
10. **Given** cualquier documento, **When** se consulta el listado, **Then** se muestra su estado con una etiqueta visible y se puede filtrar por estado, tipo y responsable.
11. **Given** un documento con archivo adjunto o evidencia adicional, **When** se consulta su detalle, **Then** el archivo y la evidencia se listan y permiten previsualización o descarga.
12. **Given** un documento creado, modificado, enviado a revisión, aprobado o rechazado, **When** se consulta la bitácora, **Then** se registran el actor, la fecha, el estado y la justificación cuando corresponda.

**Dependencias**: Depende de US11 y del administrador documental existente; se complementa con US8 para archivos y evidencias, y con US10 para auditoría.

---

### User Story 14 - Aprobar el cierre y evaluar la eficacia de acciones CAPA (Priority: P14)

Como Jefe de Calidad, quiero revisar la ejecución y la evidencia de una acción CAPA, aprobar o rechazar su cierre y registrar su eficacia, para asegurar que la acción resolvió la no conformidad antes de considerarla terminada.

**Why this priority**: El estado `completed` de una CAPA no garantiza que la acción haya sido efectiva; la aprobación del cierre y la revisión de eficacia completan el ciclo de mejora.

**Independent Test**: Marcar una CAPA como `completed` con evidencia, aprobar su cierre con eficacia `effective` y verificar la trazabilidad; rechazar el cierre de otra CAPA con justificación y comprobar que vuelve a `in_progress`.

Datos: `corrective_actions` (responsable, descripción, causa raíz, tipo, fecha límite, estado, avance, evidencia, `closure_status`, `closure_requested_at`, `closure_reviewed_by`, `closure_reviewed_at`, `closure_justification`, `effectiveness_result`, `effectiveness_reviewed_by`, `effectiveness_reviewed_at`, `effectiveness_observations`), `quality_evidence`, `employees`.

**Acceptance Scenarios**:

1. **Given** una acción CAPA `pending` o `in_progress`, **When** el responsable registra la ejecución y la marca como `completed`, con evidencia cuando se aporte, **Then** la acción queda con `closure_status = pending` y aparece en la bandeja de cierre de CAPA del Jefe de Calidad.
2. **Given** una acción CAPA con `closure_status = pending`, **When** se abre su detalle, **Then** se muestran responsable, descripción, causa raíz, fecha límite, estado, evidencia y revisión de eficacia.
3. **Given** una acción CAPA con `closure_status = pending`, **When** el Jefe de Calidad registra la eficacia como `effective` o `not_effective` con observaciones, **Then** la revisión queda almacenada con revisor y fecha.
4. **Given** una acción CAPA con revisión de eficacia registrada, **When** el Jefe de Calidad aprueba el cierre, **Then** `closure_status` pasa a `approved`, se registran revisor, fecha y justificación si corresponde, y la acción se considera cerrada.
5. **Given** una acción CAPA con `closure_status = pending`, **When** el Jefe de Calidad rechaza el cierre con justificación, **Then** `closure_status` pasa a `rejected`, la acción vuelve a `in_progress` y el responsable debe ejecutar nuevas acciones.
6. **Given** una acción CAPA sin revisión de eficacia, **When** el Jefe de Calidad intenta aprobar su cierre, **Then** el sistema lo bloquea y solicita registrar la eficacia.
7. **Given** una acción CAPA con fecha límite vencida y cierre no aprobado, **When** se consulta el dashboard o la vista de CAPA, **Then** se identifica como vencida.
8. **Given** una acción CAPA con cierre aprobado, **When** se consulta el dashboard, **Then** deja de contarse como vencida y se refleja su eficacia.
9. **Given** una acción CAPA, **When** el Inspector o el Gerente intentan aprobar o rechazar su cierre, **Then** la acción no está disponible y el sistema informa que corresponde al Jefe de Calidad.
10. **Given** una acción CAPA con evidencia, **When** se consulta su detalle, **Then** la evidencia se lista y permite su descarga.
11. **Given** una acción CAPA ejecutada, cerrada o con cierre rechazado, **When** se consulta la bitácora, **Then** se registran las decisiones, el revisor, la fecha y la justificación cuando corresponda.

**Dependencias**: Depende de US3 (CAPA y evidencia), US11 (permisos) y US10 (auditoría); complementa US4 y US5.

---

### User Story 15 - Operar con diseño visual, estados, acciones y mensajes consistentes (Priority: P15)

Como usuario de cualquier rol, quiero que cada pantalla tenga una organización visual predecible, un estado legible, acciones adecuadas a mi rol y mensajes que expliquen qué ocurrió, para saber qué puedo hacer, qué falta y qué significa cada situación sin revisar pantallas ocultas.

**Why this priority**: La segunda etapa agrega varios estados de revisión y aprobación; sin consistencia visual, accesibilidad y mensajes, los pendientes pueden quedar sin tratamiento o los usuarios pueden creer que una acción se guardó cuando no ocurrió.

**Independent Test**: Recorrer cada pantalla listada en la matriz visual con los tres roles y verificar que el encabezado, las acciones, los estados, los mensajes, los estados vacíos, la carga, el foco y el contraste cumplen los criterios; además, verificar que todo pendiente tiene bandeja accesible para el Jefe de Calidad y que el Gerente solo ve acciones de lectura y exportación.

Datos: todas las vistas y entidades del módulo; no introduce una entidad nueva.

**Acceptance Scenarios**:

1. **Given** un registro en cualquier estado, **When** se muestra en un listado o detalle, **Then** el estado se representa con una etiqueta visible y un texto legible, reforzado por color o icono (texto, color e icono en los tokens semánticos de aprobación, pendiente y rechazo) sin que el color sea el único indicador.
2. **Given** un registro en estado `pending_approval` o `pending_review`, **When** el rol autorizado abre su bandeja, **Then** encuentra el registro con una acción clara para revisarlo, aprobarlo o rechazarlo y con el contador de pendientes actualizado.
3. **Given** un estado pendiente, **When** no existe una pantalla de revisión para el rol autorizado, **Then** se considera un defecto de experiencia y el sistema no debe permitir entrar en ese estado sin habilitar la bandeja correspondiente.
4. **Given** una acción no permitida para el rol activo, **When** se muestra la pantalla, **Then** la acción se oculta o deshabilita con una explicación del permiso requerido y el estado no cambia si se invoca.
5. **Given** una operación exitosa de creación, edición, envío, aprobación, rechazo o cierre, **When** finaliza, **Then** se muestra un mensaje de confirmación y la lista o el detalle reflejan el nuevo estado sin recargar la página.
6. **Given** una operación con datos inválidos, **When** se intenta guardar, **Then** se muestran errores junto a los campos afectados y un resumen claro, sin perder los datos ingresados.
7. **Given** una vista sin registros o sin coincidencias, **When** se abre, **Then** se muestra un estado vacío con texto explicativo y una acción para limpiar filtros o crear el primer registro según el rol.
8. **Given** una operación bloqueada por permisos, validación o integridad, **When** se rechaza, **Then** el estado del registro no cambia y el mensaje explica el motivo.
9. **Given** una navegación desde una bandeja de pendientes, **When** el usuario abre un registro y luego vuelve, **Then** regresa a la bandeja con los filtros aplicados y el estado actualizado.
10. **Given** un cambio de estado en cualquier flujo, **When** se actualiza la vista, **Then** las acciones disponibles se recalculan según el nuevo estado y el rol activo.
11. **Given** cualquier pantalla del módulo, **When** se abre, **Then** muestra título de la vista, indicador del rol activo, navegación de Control de Calidad y jerarquía de acciones primaria y secundaria coherente con la matriz de permisos.
12. **Given** una tabla o lista con varios estados, **When** se visualiza en 1024 px, 768 px o 360 px, **Then** incluye leyenda o etiquetas autoexplicativas, conserva las columnas clave o las hace accesibles mediante una expansión controlada, y no produce desplazamiento horizontal de toda la página ni desordena formularios o acciones.
13. **Given** una operación de guardado, carga, exportación o revisión, **When** está en curso, **Then** la interfaz muestra un estado de carga o acciones deshabilitadas y, al terminar, muestra confirmación o error; una operación no puede quedar sin retroalimentación.
14. **Given** un usuario que navega con teclado, **When** recorre una pantalla, **Then** el orden de tabulación es lógico, el foco es visible, los campos tienen etiquetas legibles y el contraste cumple WCAG 2.1 AA.
15. **Given** el dashboard, **When** se abre con cada rol, **Then** los KPI agregados y las alertas son visibles para los tres roles; el detalle individual por Inspector y la configuración de alertas solo se ofrecen al Jefe de Calidad; el Gerente no ve acciones de edición.
16. **Given** una bandeja de revisión, **When** la abre el Jefe de Calidad, **Then** muestra el contador de pendientes, filtros, acciones de aprobar y rechazar con justificación y un estado vacío cuando no queden ítems; el Inspector y el Gerente no ven acciones de aprobación.
17. **Given** la ejecución de una inspección, **When** la abre un Inspector o el Jefe de Calidad, **Then** solo se ofrecen planes y listas `approved`, los criterios muestran valor esperado, tolerancia, medición y resultado con etiqueta, y las acciones de evidencia, no conformidad y envío a revisión están visibles según el estado; el Gerente accede solo a resultados ya completados desde dashboard, historial o detalle.
18. **Given** una no conformidad, una CAPA o un lote en cuarentena, **When** se consulta con cualquier rol, **Then** se distinguen visualmente severidad, estado, vencimiento y cierre aprobado, con texto además de color; el Inspector puede crear o ejecutar según permisos, el Jefe puede supervisar y aprobar, y el Gerente solo consulta.
19. **Given** la bitácora, el historial o la exportación, **When** se usan filtros, **Then** los filtros activos, el rango aplicado y el número de resultados son visibles, existe una acción para limpiar filtros y el estado vacío o el bloqueo por filtros inválidos se explica antes de exportar.
20. **Given** un cambio de rol activo desde el dashboard, **When** se vuelve a cualquier pantalla abierta, **Then** el indicador de rol, las acciones y el contenido sensible al rol se recalculan sin conservar controles del rol anterior.
21. **Given** el menú lateral, **When** se abre con cualquier rol, **Then** muestra una sola entrada por destino agrupada en las cinco categorías definidas, con identificadores de destino únicos, sin alias independientes "Panel", "Dashboard" ni `quality-panel` (se conserva la entrada única "Inicio / Dashboard"), con la sección activa resaltada por texto y color, y sin eliminar ninguna funcionalidad existente.
22. **Given** el dashboard, **When** se abre, **Then** muestra los elementos y fuentes definidos en la "Matriz del dashboard", con 0 tarjetas decorativas, 0 indicadores duplicados y 0 cifras sin origen en los registros.
23. **Given** cualquier sección, **When** se aplica la identidad visual, **Then** los estilos calculados coinciden con los tokens de la "Matriz de tokens visuales"; el color semántico se refuerza con etiqueta textual y, como mínimo, color o icono según FR-070, con texto, color e icono en los tokens de aprobación, pendiente y rechazo.
24. **Given** una tabla de cualquier sección, **When** se consulta, **Then** muestra las columnas clave de la "Matriz de columnas clave y búsqueda", aplica el buscador solo al conjunto ya filtrado de esa vista y conserva filtros, estados y acciones en una sola zona de acción.
25. **Given** un formulario extenso, **When** se abre, **Then** muestra primero los campos esenciales definidos para esa operación, agrupa el resto en bloques con revelación progresiva y mantiene validaciones y ayuda junto al campo sin duplicar los escenarios funcionales 6 y 10.
26. **Given** una sección con poca información relevante, **When** se renderiza, **Then** muestra título, descripción breve, una acción principal y un estado vacío o texto de ayuda; el 0 % de los elementos decorativos o botones sin acción se considera conforme.
27. **Given** un registro en `draft`, `pending_approval` o `pending_review`, `approved`, `rejected` o una CAPA vencida, **When** se muestra en cualquier lista o detalle, **Then** usa exactamente las etiquetas "Borrador", "Pendiente", "Aprobado", "Rechazado" o "Vencido" según FR-083, reforzadas con color o icono y con leyenda cuando convivan varios estados.
28. **Given** una aplicación sin valor válido en `erp_quality:viewer_role`, **When** se abre cualquier pantalla, **Then** el indicador de rol muestra `jefe_calidad`, el valor se persiste y no se interpreta como autenticación real.

**Matriz visual por pantalla y rol**:

| Pantalla | Jefe de Calidad | Inspector de Calidad | Gerente de Operaciones | Criterio visual verificable |
|---|---|---|---|---|
| Dashboard | Ve todos los KPI, detalle individual, aprobaciones y configuración de alertas | Ve KPI agregados y detalle propio; sin configuración de alertas | Ve KPI, alertas y reportes en solo lectura | Encabezado de bienvenida; tarjetas con título, valor, periodo y estado; gráficos, actividad reciente y accesos rápidos por rol; alertas con umbral y severidad textual; sin tarjetas decorativas |
| Lotes pendientes | Consulta y puede iniciar inspección | Consulta y ejecuta inspección desde la acción principal | Consulta en solo lectura | Lista con lote, producto, fecha y estado; acción "Inspeccionar" visible solo para roles autorizados |
| Planes y criterios | Crea, edita, envía, aprueba y rechaza; ve justificaciones | Consulta planes `approved` en solo lectura | Consulta planes `approved` en solo lectura | Estado, versión, criterios y justificación de rechazo visibles; acciones agrupadas por estado |
| Listas de verificación | Crea, edita, envía, aprueba y rechaza | Consulta y completa listas `approved` | Consulta listas `approved` en solo lectura | Categoría, criterios, evaluaciones y estado visibles; solo listas aprobadas se ofrecen para ejecutar |
| Documentos | Crea, edita, envía, previsualiza, aprueba y rechaza | Crea y edita borradores, envía y previsualiza | Consulta documentos `approved` en solo lectura | Código, tipo, versión, responsable, archivo y estado visibles; previsualización antes de aprobar |
| Ejecución de inspección | Puede ejecutar y revisar según flujo | Ingresa mediciones, adjunta evidencia, registra NC y envía a revisión | Sin acceso de ejecución; consulta resultados completos en dashboard, historial o detalle | Criterios con esperado, tolerancia, medido y resultado; progreso y acciones de guardado, evidencia y envío claramente diferenciadas |
| Revisión de inspecciones | Emite dictamen final con justificación cuando corresponda | Consulta el resultado de sus inspecciones en solo lectura | Consulta resultados finales en solo lectura | Dictamen propuesto y final diferenciados; revisor, fecha y justificación visibles; acciones de decisión solo para jefatura |
| Aprobaciones pendientes | Ve contadores y revisa planes, listas, documentos, inspecciones y cierres CAPA desde una sola entrada | No ve bandejas de aprobación; ve el estado de sus envíos | No ve bandejas de aprobación | Contador por tipo de pendiente, filtros, estado vacío y acceso directo al detalle; una sola entrada de menú sin duplicar destinos |
| No conformidades | Supervisa, clasifica y cierra | Registra y edita NC según permisos | Consulta en solo lectura | Severidad, tipo, estado, lote y responsables con etiqueta; estado de cuarentena comprensible sin color |
| CAPA | Aprueba o rechaza cierre y eficacia | Ejecuta, reporta y adjunta evidencia | Consulta estado y eficacia en solo lectura | Estado de ejecución y `closure_status` separados; fecha límite y vencimiento visibles; justificación de rechazo legible |
| Cuarentena | Ve lotes y su tratativa | Ve lotes y acciones permitidas sobre NC | Consulta en solo lectura | Estado "Cuarentena - En tratamiento" diferenciado; lote, severidad y CAPA asociada visibles |
| Historial | Consulta toda la trazabilidad y exporta | Consulta registros permitidos; sin exportación | Consulta y exporta en solo lectura | Filtros de lote y fechas, número de resultados y columna de resultados por criterio claramente identificados |
| Bitácora | Consulta y filtra la bitácora completa | No ve bitácora | Consulta en modo lectura | Actor, fecha, entidad, acción, lote, valores anterior y nuevo, y justificación legibles; filtros activos visibles |
| Exportación | Exporta dashboard e historial filtrado | No ve acciones de exportación | Exporta reportes e historial en solo lectura | Formato CSV, filtros aplicados y aviso de ausencia de datos visibles antes y después de la acción |
| Alertas | Configura, desactiva y elimina reglas | Ve alertas en dashboard; sin configuración | Ve alertas en dashboard en solo lectura | Regla activa, indicador, operador, umbral y severidad visibles; alerta desactivada deja de mostrarse |

**Correspondencia del menú lateral con funcionalidad existente**:

| Categoría | Entrada | Funcionalidad existente que conserva | Regla de no duplicación |
|---|---|---|---|
| GENERAL | Inicio / Dashboard | US5, US9 y accesos rápidos de US1–US4 | Única entrada principal; se eliminan los duplicados "Panel", "Dashboard" o `quality-panel` si existieran, conservando la etiqueta "Inicio / Dashboard" |
| GENERAL | Búsqueda | Buscadores y filtros de lotes, historial y bitácora (US2, US6, US10) | No crea registros; reutiliza filtros ya definidos |
| GESTIÓN DE CALIDAD | Planes de calidad | US1 y planes de US12 | Una sola vista de planes y criterios |
| GESTIÓN DE CALIDAD | Listas de verificación | US12 | No se confunde con planes |
| GESTIÓN DE CALIDAD | Inspecciones | US2 y US4 | Agrupa ejecución y revisión sin dos entradas de menú |
| GESTIÓN DE CALIDAD | No conformidades | US3 | Incluye cuarentena derivada sin entrada separada |
| GESTIÓN DE CALIDAD | Acciones CAPA | US3 y US14 | Incluye ejecución, evidencia y cierre |
| DOCUMENTACIÓN | Documentos | US13 | Una sola vista de documentos y versiones |
| DOCUMENTACIÓN | Aprobaciones pendientes | Bandejas de US1, US4, US12, US13 y US14 | Una sola entrada con pestañas o secciones internas por tipo de pendiente |
| ANÁLISIS | Reportes | US7, resumen de US5 y gráficos de US5/US6 | Reutiliza exportaciones y gráficos existentes |
| ADMINISTRACIÓN | Entidades | Consulta de productos, empleados y orígenes usados por US1, US2 y US8 | Solo lectura; no crea entidades ni modifica datos maestros |
| ADMINISTRACIÓN | Configuración | Reglas de alerta de US9 y selector de rol de US11 | No duplica dashboard ni apertura de sesión |

**Dependencias**: Es transversal a US1–US14; debe verificarse junto con cada flujo de aprobación y con FR-028, FR-040, FR-051–FR-054, FR-063–FR-083 y SC-028–SC-040, según la tabla "Dependencias entre historias".

---

### Dependencias entre historias

| Historia | Depende de | Habilita / se relaciona con |
|---|---|---|
| US1 - Planes y criterios | Infraestructura de planes y criterios | US2, US4, US12 (flujo equivalente) y US15 |
| US2 - Ejecución de inspección | US1, US12 (plan y lista `approved`) | US3, US4, US5, US8 y US15 |
| US3 - No conformidades y CAPA | US2 | US4, US5, US8 (evidencia), US10 y US14 |
| US4 - Revisión de inspecciones | US2, US11 | US3 (rechazo final), US5, US10 y US15 |
| US5 - Dashboard | US2, US3, US14 | US7, US9 y US10 |
| US6 - Historial | US2 | US7 y US10 |
| US7 - Exportación | US5, US6 | US10 (convenciones de consulta) |
| US8 - Evidencia | US2, US3, US14; se complementa con US13 para documentos | US10, US13 y US15 |
| US9 - Alertas | US5 | US10 y US15 |
| US10 - Bitácora | US1–US4, US8, US12–US14 | Transversal a todas las aprobaciones |
| US11 - Roles y permisos | Infraestructura de rol activo | US1, US2, US4, US12, US13 y US14 |
| US12 - Listas de verificación | US11 | US2, US10 y US15 |
| US13 - Documentos | US8, US11 | US10 y US15 |
| US14 - Cierre de CAPA | US3, US8, US11 | US5, US10 y US15 |
| US15 - Diseño visual y experiencia de usuario | US1–US14 | Verificación transversal de todos los flujos, pantallas y roles |

**Regla de orden sugerido**: US11 → US1/US12 → US2 → US3 → US14 → US13 → US8 → US4 → US5/US6/US7/US9 → US10, con US15 verificado en cada entrega.

---

### Edge Cases

- Medición exactamente igual a un límite de tolerancia: se considera dentro del rango.
- Medición no numérica o vacía en cualquier criterio: la inspección no puede enviarse a revisión, no obtiene `proposed_result` y permanece `draft`.
- Inspección con un documento origen que no existe o pertenece a un módulo no permitido: se rechaza.
- Inspección con `proposed_result = conditional` o `overall_result = conditional`: se marca para revisión si `review_decision = null` y no genera no conformidad automática.
- Inspección `draft` sin dictamen: se muestra como pendiente y no participa en la tasa de aprobación.
- Plan o criterio con inspecciones históricas: no se puede editar ni eliminar; se debe duplicar el plan para crear una nueva versión.
- Plan o criterio sin inspecciones: se puede editar o eliminar; la eliminación de un plan elimina sus criterios en cascada.
- Plan sin criterios: no puede usarse para iniciar una inspección.
- Intento de aprobar una inspección con criterios críticos fallidos o sin medición: se bloquea y se informa el motivo.
- Acción CAPA sin responsable, descripción, causa raíz, tipo de acción o fecha límite: se rechaza.
- Acción CAPA cuya fecha límite ya pasó: se marca como vencida, sin cambiar automáticamente su estado.
- Cierre de una no conformidad: se registra fijando su estado en `closed` desde el formulario (sin exigir que el cierre de la CAPA esté aprobado); al cerrarse, el lote deja de aparecer en cuarentena.
- Rango de fechas inválido en el historial (desde posterior a hasta): se informa y no se aplica el filtro.
- Eliminación de una inspección con no conformidad asociada: se bloquea para preservar la trazabilidad.
- Eliminación de una no conformidad con acciones CAPA: se eliminan sus acciones CAPA en cascada.
- Eliminación de una inspección sin no conformidades: se eliminan sus resultados en cascada.
- Consulta de métricas individuales por inspector sin rol de jefatura: se limita al nivel agregado.
- Lote sin inspección completada: se muestra como pendiente, aunque exista una inspección en estado `draft`; al inspeccionarlo se reanuda el borrador del mismo origen y plan.
- Origen y plan con más de una inspección `draft` por datos previos: se reanuda la más reciente y se advierte la inconsistencia sin crear otra.
- Cambio manual u override del dictamen de una inspección ya `completed` a `failed`: no genera una no conformidad automática; la generación ocurre solo cuando la revisión emite `rejected` (`overall_result = failed`) desde `pending_review` o desde el caso heredado `completed` condicional sin decisión, y solo si no existe una no conformidad asociada.
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
- Creación manual de una no conformidad sin inspección reprobada: permitida para Inspector o Jefe de Calidad cuando se capturan descripción, producto o lote, severidad y responsable.
- `erp_quality:viewer_role` ausente o con un valor distinto de `jefe_calidad`, `inspector` o `gerente`: se usa `jefe_calidad` como rol inicial y se persiste ese valor válido.
- Datos legados con estados antiguos al abrir una bandeja: la normalización de FR-065 se ejecuta antes de listar pendientes, sin duplicar ni omitir registros.
- Búsqueda de tabla con filtros activos: solo se considera el conjunto ya filtrado de la vista activa; no se consultan otras colecciones ni se crean resultados nuevos.
- `quality_audit_log` conserva `reference_module` + `reference_id` aunque el registro auditado ya no exista; el filtro por lote sigue funcionando.
- Valor anterior/nuevo en la bitácora: `create` usa anterior `null` y nuevo = estado inicial; `delete` usa anterior = último valor y nuevo `null`; `update`/`status_change` registran ambos.
- Eliminación directa de una CAPA: permitida desde el formulario de CAPA; su entrada `delete` permanece y no altera la cascada de FR-026 al eliminar la no conformidad.
- Rango de fechas inválido en la bitácora (desde posterior a hasta): se informa y no se aplica, igual que en US6.
- Decisión final de revisión con justificación: genera una sola entrada `approve` o `reject` con `changed_field = overall_result`; el override posterior genera una sola entrada `status_change` sobre `overall_result`; no se genera una segunda entrada `update` ni un `status_change` duplicado por el paso a `completed`.
- Acción de un rol no autorizado: se oculta o deshabilita; si se invoca, se bloquea con un mensaje y no se registra como cambio de estado.
- Elemento en `pending_approval` o `pending_review` sin bandeja de revisión para el Jefe de Calidad: se considera un estado inválido y no debe generarse.
- Envío a aprobación de un plan o lista sin criterios o con campos obligatorios vacíos: se rechaza y se conserva `draft`.
- Aprobación de una lista o plan sin revisión previa: se rechaza; el estado debe ser `pending_approval`.
- Edición de un plan o lista `approved` con historial: se bloquea y se exige duplicar como nueva versión `draft`.
- Edición de una lista o plan `rejected`: vuelve a `draft`, conserva la justificación del rechazo y requiere nuevo envío.
- Selección de una lista o plan no aprobado en una inspección: no se ofrece y, si se fuerza, se rechaza.
- Inspección en `pending_review`: no se contabiliza en KPIs, no libera el lote y el Inspector no puede modificar sus mediciones ni criterios.
- Inspección revisada por el Jefe de Calidad sin justificación cuando el dictamen difiere del propuesto, es condicional o es reprobado: se rechaza la revisión.
- Inspección rechazada por el Jefe de Calidad sin no conformidad asociada: se genera el borrador de no conformidad; un cambio manual posterior a `completed` no genera otro borrador.
- Inspector o Gerente intentando emitir dictamen de inspección: se bloquea por permisos.
- Documento `pending_review` sin previsualización disponible: se bloquea la aprobación hasta poder visualizar el archivo o sus metadatos.
- Documento `approved` que se intenta modificar en la misma versión: se bloquea y se exige crear una nueva versión.
- Documento `rejected` sin justificación: no se permite el rechazo.
- CAPA marcada `completed` sin revisión de eficacia: el Jefe de Calidad no puede aprobar su cierre.
- CAPA con cierre rechazado: vuelve a `in_progress` y conserva la justificación del rechazo.
- CAPA con cierre aprobado: deja de contarse como vencida y refleja su eficacia en el dashboard.
- Eliminación de una lista o documento aprobado con evaluaciones o historial: se bloquea; se exige nueva versión.
- Evidencia adjunta a CAPA o documento: se aplican las reglas de tipo, tamaño y cascada de la evidencia de calidad.
- Registro de decisión final (`approve`/`reject`) en la bitácora: incluye actor, fecha y justificación, sin duplicar la entrada de cambio de estado.
- Estado, severidad o resultado representado únicamente con color: se considera un defecto visual y debe corregirse con etiqueta textual o icono.
- Pantalla con controles visibles que no corresponden al rol activo: se considera un defecto de permisos visuales aunque la operación esté bloqueada al invocarse.
- Bandeja con contador en cero y sin estado vacío o acción siguiente: se considera incompleta y debe mostrar el mensaje y la acción contextual definidos en US15.
- Vista con desplazamiento horizontal de toda la página a 1024 px, 768 px o 360 px, o con tablas y formularios desordenados: se considera un incumplimiento de FR-075 y SC-032.
- Operación que finaliza sin mensaje de confirmación, error o estado de carga: se considera un incumplimiento de FR-072 y SC-030.
- Menú con dos entradas que llevan al mismo destino, como "Panel" y "Dashboard": se considera un incumplimiento de FR-077 y SC-034.
- Botón visible sin acción asociada o elemento decorativo sin utilidad: se considera un incumplimiento de FR-082 y SC-037.
- Formulario que muestra todos sus campos cuando la información no es necesaria en ese momento: se considera un incumplimiento de FR-081 y SC-037.
- Estado `draft`, `pending_approval`, `pending_review`, `approved`, `rejected` o CAPA vencida sin etiqueta textual: se considera un incumplimiento de FR-083 y SC-038.

## Requirements *(mandatory)*

### Contrato único de revisión y auditoría

Esta sección es la fuente canónica para FR-014, FR-032, FR-037, FR-050, FR-058 y FR-062:

1. El envío a revisión registra una entrada `status_change` con `changed_field = status` (o `inspection_status` para inspecciones), entidad, identificador, actor, fecha y estado anterior/nuevo.
2. La decisión final de una inspección registra una sola entrada con `action = approve` o `reject`, `changed_field = overall_result`, valor anterior y nuevo, actor, marca temporal ISO y justificación cuando sea obligatoria; `review_decision` queda reflejado en el valor nuevo de la misma entrada. Las decisiones de planes, listas, documentos y cierre de CAPA usan `status` o `closure_status` según corresponda.
3. La decisión final no genera una segunda entrada `update` ni `status_change` para el mismo cambio; el paso a `completed` no se audita por separado. Los overrides posteriores usan una sola entrada `status_change` sobre `overall_result`. FR-014, FR-032, FR-037, FR-050, FR-058 y FR-062 se rigen por esta regla.
4. El actor es el empleado seleccionado en la operación; solo si no existe, se usa el rol activo como metadato sin habilitar permisos adicionales.
5. Una acción rechazada por permisos no cambia el estado y no genera entrada de auditoría.
6. Toda entrada permanece tras eliminaciones permitidas del registro auditado.

### Matriz única de integridad y retención

Esta sección es la fuente canónica para FR-026, FR-044, FR-049 y FR-062:

| Situación | Regla | Consecuencia en auditoría |
|---|---|---|
| Plan o criterio con inspecciones históricas | Bloquear edición y eliminación; exigir duplicar el plan como nueva versión `draft` | Se conserva el historial de la versión original |
| Plan o criterio sin inspecciones | Permitir edición y eliminación; los criterios se eliminan en cascada con el plan | La eliminación queda registrada |
| Lista o documento `approved` con evaluaciones, archivo o historial | Bloquear edición y eliminación en la misma versión; exigir nueva versión | Se conserva la versión aprobada y su historial |
| Inspección con no conformidad | Bloquear eliminación para preservar trazabilidad | No se registra una eliminación que no ocurrió |
| Inspección sin no conformidad | Permitir eliminación; resultados y evidencia se eliminan en cascada | La eliminación queda registrada |
| No conformidad con CAPA o evidencia | Permitir eliminación; CAPA y evidencia se eliminan en cascada | La eliminación y las cascadas quedan registradas |
| CAPA con evidencia | Permitir eliminación directa; evidencia se elimina en cascada | La entrada `delete` permanece |
| Eliminación bloqueada por integridad | No eliminar ningún registro ni evidencia vinculada | Se informa el bloqueo; no se genera `delete` |

### Validación común de planes y listas

Esta sección es la fuente canónica para FR-001, FR-002, FR-055, FR-056 y FR-067:

| Artefacto | Campos obligatorios para guardar | Requisito para enviar a aprobación | Regla de uso |
|---|---|---|---|
| Plan de inspección | Nombre, producto existente y etapa `incoming`/`in_process`/`final`; los criterios son opcionales en `draft` | Estado `draft` y al menos un criterio completo con valor esperado, tolerancia no negativa, unidad y tipo válido | Solo `approved` puede seleccionarse en una inspección |
| Lista de verificación | Nombre y categoría; la descripción y los criterios son opcionales en `draft` | Estado `draft` y al menos un criterio con descripción y evaluación definida | Solo `approved` puede completarse en una inspección |
| Ambos | Identificador, versión, estado y metadatos de revisión cuando aplique | Rechazo previo vuelve a `draft` y exige nuevo envío | Una versión `approved` con historial no se edita ni elimina; se duplica |

### Reglas de verificación

- Toda funcionalidad descrita en FR-001–FR-083 y todo SC implementable debe contar con una prueba escrita antes o junto con el código que lo implementa.
- La verificación de US1–US14 se realiza con pruebas unitarias, de integración y de extremo a extremo según la naturaleza del requisito.
- La verificación de US15 se realiza además con recorridos por las 15 pantallas de la matriz visual, los tres roles y los tres anchos definidos en FR-075.
- SC-001, SC-006, SC-010, SC-012 y SC-016 requieren instrumentación de tiempo; SC-008 y SC-024 son desenlaces de demostración no automatizables y se verifican con lista de cotejo del facilitador y resultados anónimos de los participantes.
- Ninguna entrega se considera completada sin pruebas relevantes en verde, verificación de UX y actualización documental de los artefactos afectados.

### Sistema visual de referencia y verificación

Esta sección es la fuente canónica para FR-068–FR-083, US15 y SC-028–SC-040. Define los tokens, destinos de navegación, composición del dashboard, columnas clave, bandejas y métodos de verificación, e incorpora por referencia la "Matriz visual por pantalla y rol" de US15. Toda diferencia visual entre pantallas MUST estar justificada en esta sección o en esa matriz; fuera de esas secciones no se aceptan reglas visuales sustitutas.

#### Matriz de tokens visuales

| Token | Valor | Uso | Verificación |
|---|---|---|---|
| `surface` | `#ffffff` | Fondo de tarjetas, tablas, formularios y menús | Estilos calculados de los contenedores |
| `background` | `#f2f4f8` | Fondo general del módulo | Estilo calculado del contenedor raíz |
| `text` | `#17233b` | Texto principal y títulos | Contraste mínimo 4.5:1 sobre `surface` y `background` |
| `text-muted` | `#475569` | Texto secundario, ayudas y metadatos | Contraste mínimo 4.5:1 sobre su fondo |
| `border` | `#dde3ec` | Bordes de tarjetas, tablas y controles | Borde visible en estados normales |
| `primary` | `#1e40af` | Encabezados, franjas de identidad y acentos estructurales | Un solo acento primario por sección |
| `interaction` | `#2563eb` | Enlaces, foco y acciones principales | Foco visible de 2 px con offset de 2 px |
| `approved` | `#166534` sobre `#dcfce7` | Etiqueta "Aprobado" | Texto, color e icono presentes |
| `pending` | `#92400e` sobre `#fef3c7` | Etiqueta "Pendiente" | Texto, color e icono presentes |
| `rejected` | `#b91c1c` sobre `#fee2e2` | Etiquetas "Rechazado" y "Vencido" | Texto, color e icono presentes |
| `radius-card` | `10 px` | Tarjetas y paneles | Radio aplicado a contenedores |
| `radius-control` | `8 px` | Botones, campos y selector de rol | Radio aplicado a controles interactivos |
| `space-unit` | `4 px` | Márgenes, paddings y separaciones | Espaciado múltiplo de 4 px |
| `typography` | `system-ui`, cuerpo `14 px/1.5` | Texto de interfaz | Familia y tamaño calculados |
| `icon` | SVG `18 px`, `stroke-width: 1.8` | Iconos de acciones y estados | Tamaño y trazo calculados |

#### Matriz de destinos del menú

| Categoría | Entrada | ID de destino | Funcionalidad conservada | Regla de no duplicación |
|---|---|---|---|---|
| GENERAL | Inicio / Dashboard | `quality-dashboard` | US5, US9 y accesos rápidos | Única entrada principal; no usar alias `Panel`, `Dashboard` ni `quality-panel` |
| GENERAL | Búsqueda | `quality-search` | Buscadores y filtros de US2, US6 y US10 | No crea registros ni consultas nuevas |
| GESTIÓN DE CALIDAD | Planes de calidad | `quality-plans` | US1 y planes de US12 | Una sola vista de planes y criterios |
| GESTIÓN DE CALIDAD | Listas de verificación | `quality-checklists` | US12 | No se confunde con planes |
| GESTIÓN DE CALIDAD | Inspecciones | `quality-inspections` | US2 y US4 | Agrupa ejecución y revisión sin dos entradas |
| GESTIÓN DE CALIDAD | No conformidades | `quality-non-conformances` | US3 | Incluye cuarentena derivada sin entrada separada |
| GESTIÓN DE CALIDAD | Acciones CAPA | `quality-capa` | US3 y US14 | Incluye ejecución, evidencia y cierre |
| DOCUMENTACIÓN | Documentos | `quality-documents` | US13 | Una sola vista de documentos y versiones |
| DOCUMENTACIÓN | Aprobaciones pendientes | `quality-approvals` | Bandejas de US1, US4, US12, US13 y US14 | Una sola entrada con secciones internas por tipo |
| ANÁLISIS | Reportes | `quality-reports` | US7, resumen de US5 y gráficos de US5/US6 | Reutiliza exportaciones y gráficos existentes |
| ADMINISTRACIÓN | Entidades | `quality-entities` | Consulta de maestros referenciados | Solo lectura; no crea ni edita entidades |
| ADMINISTRACIÓN | Configuración | `quality-settings` | Reglas de alerta de US9 y selector de rol de US11 | No duplica dashboard ni sesión |

#### Matriz del dashboard

| Elemento | Contenido obligatorio | Fuente | Regla |
|---|---|---|---|
| Encabezado de bienvenida | Texto de bienvenida y rol activo | Rol persistido en `erp_quality:viewer_role` | No otorga permisos por sí mismo |
| Tarjetas de indicadores | Tasa de aprobación, no conformidades abiertas, CAPA vencidas, eficacia CAPA e inspecciones pendientes | FR-020 sobre colecciones existentes | Una tarjeta por indicador; sin duplicados |
| Inspecciones pendientes | Conteo de `draft` y `pending_review`; no incluye el caso heredado `completed` condicional sin decisión, que se gestiona en la bandeja | `quality_inspections` | Enlaza a `quality-inspections` y `quality-approvals` |
| Dictámenes finales | Conteo de inspecciones `completed` por resultado final | `quality_inspections` | No mezcla propuesto y final |
| No conformidades abiertas | Conteo por severidad de `open` y `under_review` | `non_conformances` | Enlaza a `quality-non-conformances` |
| CAPA pendientes o vencidas | Conteo por `closure_status` y fecha límite | `corrective_actions` | "Vencido" exige texto además de color |
| Documentos pendientes | Conteo de `pending_review` | `quality_documents` | Enlaza a `quality-approvals` |
| Gráficos de resultados | Distribución de resultados y Pareto de productos/etapas | Inspecciones y no conformidades | Sin series decorativas ni cifras sin origen |
| Actividad reciente | Últimas 8 entradas con entidad, acción, actor y fecha | `quality_audit_log` ordenado por `timestamp` descendente | No crea entidad nueva |
| Accesos rápidos por rol | Enlaces a vistas existentes según FR-051–FR-054 | Roles `jefe_calidad`, `inspector`, `gerente` | Sin funcionalidad nueva |
| Alertas | Indicador, operador, umbral y severidad textuales | Reglas activas de FR-045–FR-047 | Informativas; no bloquean |

Los accesos rápidos son: Jefe de Calidad a Aprobaciones pendientes, Revisión de inspecciones, Cierres CAPA y Reportes; Inspector a Lotes pendientes, Ejecución de inspección, Listas aprobadas y Registro de NC/CAPA; Gerente a Dashboard, Historial, Reportes y Bitácora en solo lectura.

#### Matriz de columnas clave y búsqueda

La búsqueda de cada tabla aplica sobre el conjunto ya cargado y filtrado de la vista activa, por coincidencia insensible a mayúsculas en las columnas visibles; no consulta otras colecciones ni crea resultados.

| Pantalla | Columnas o datos clave visibles o accesibles mediante expansión | Búsqueda o filtro aplicable |
|---|---|---|
| Dashboard | Título, valor, periodo y estado de cada tarjeta | No aplica; filtros de alertas activas |
| Lotes pendientes | Lote, producto, fecha, estado y acción "Inspeccionar" | Buscador sobre lote, producto y estado cargados |
| Planes y criterios | Nombre, producto, etapa, versión, estado, criterios y justificación | Buscador sobre planes cargados y filtro por estado |
| Listas de verificación | Nombre, categoría, criterios, evaluaciones y estado | Buscador sobre listas cargadas y filtro por estado |
| Documentos | Código, tipo, versión, responsable, archivo y estado | Buscador sobre documentos cargados y filtro por estado |
| Ejecución de inspección | Criterio, esperado, tolerancia, medido, resultado y evidencia | Filtro de criterios sobre la inspección cargada |
| Revisión de inspecciones | Lote, inspector, dictamen propuesto, dictamen final, revisor, fecha y justificación | Buscador sobre inspecciones cargadas |
| Aprobaciones pendientes | Tipo, entidad, estado, fecha y solicitante | Filtro por tipo de pendiente y buscador sobre la sección cargada |
| No conformidades | Lote, tipo, severidad, estado, responsable y CAPA asociada | Buscador sobre NC cargadas y filtro por severidad |
| CAPA | NC, responsable, estado, `closure_status`, fecha límite, vencimiento y eficacia | Buscador sobre CAPA cargadas y filtro por vencimiento |
| Cuarentena | Lote, producto, severidad, CAPA asociada y estado "Cuarentena - En tratamiento" | Buscador sobre lotes cargados en cuarentena |
| Historial | Lote, fecha, inspector, plan, etapa, dictamen, estado y resultados por criterio | Filtros de lote y fechas más buscador sobre resultados cargados |
| Bitácora | Fecha, actor, entidad, acción, lote, campo, anterior, nuevo y justificación | Filtros de lote, entidad y fechas más buscador sobre entradas cargadas |
| Exportación | Filtros activos, número de resultados y formato CSV | No aplica; vista previa de filtros antes de exportar |
| Alertas | Indicador, operador, umbral, severidad y estado activo | Buscador sobre reglas cargadas |

#### Matriz de bandejas

| Bandeja | Estado origen | Contador | Filtros | Acción siguiente | Rol |
|---|---|---|---|---|---|
| Planes y listas | `pending_approval` | Pendientes por tipo | Tipo, producto y etapa | Previsualizar, aprobar o rechazar | Jefe de Calidad |
| Documentos | `pending_review` | Documentos pendientes | Tipo y responsable | Previsualizar, aprobar o rechazar | Jefe de Calidad |
| Inspecciones | `pending_review` y `completed` con `proposed_result = conditional` y `review_decision = null` | Inspecciones pendientes | Lote, inspector y fecha | Revisar y emitir dictamen final | Jefe de Calidad |
| Cierres CAPA | `status = completed` y `closure_status = pending` | Cierres pendientes | Responsable, vencimiento y eficacia | Registrar eficacia, aprobar o rechazar | Jefe de Calidad |

Todas las bandejas se agrupan bajo `quality-approvals` con secciones internas; el contador se actualiza sin recargar, el estado vacío ofrece la acción contextual y ningún pendiente queda sin bandeja accesible para el Jefe de Calidad.

#### Matriz de métodos de verificación

| Requisito | Método | Evidencia mínima |
|---|---|---|
| FR-001–FR-083 | Prueba unitaria, de integración o frontend según aplicabilidad, escrita antes o junto con el código | Pruebas en verde y trazabilidad FR–prueba |
| US15 | Recorrido de las 15 pantallas × 3 roles × 3 anchos (1024, 768 y 360 px) | Lista de cotejo por pantalla, rol y ancho |
| SC-001 | Cronómetro instrumentado desde selección de origen hasta guardado de dictamen con 10 criterios | Tiempo registrado menor a 3 minutos |
| SC-006 | Búsqueda instrumentada con filtros de lote y fechas | Solo coincidencias y tiempo menor a 1 segundo |
| SC-010, SC-012, SC-016 | Instrumentación con hasta 500 inspecciones semilla | Tiempos registrados y conteos de bitácora |
| SC-008, SC-024 | Lista de cotejo del facilitador y resultados anónimos de demo | Porcentaje de participantes sin ayuda |
| SC-028–SC-040 | Verificación de estilos calculados, URLs/IDs de destino, jerarquía visual, recorrido visual y pruebas de regresión | Capturas o registro de cotejo por criterio |

### Functional Requirements

- **FR-001**: El sistema MUST permitir crear, editar, duplicar y eliminar planes de inspección asociados a un producto y a una etapa operativa, respetando la "Validación común de planes y listas", las reglas de integridad histórica de la "Matriz única de integridad y retención" y gestionando su estado (`draft`, `pending_approval`, `approved`, `rejected`).
- **FR-002**: El sistema MUST validar que cada plan tenga nombre, producto existente, etapa perteneciente a `incoming`, `in_process` o `final` y al menos un criterio antes de enviarlo a aprobación o habilitarlo para inspecciones, según la "Validación común de planes y listas"; solo los planes `approved` MUST ofrecerse para inspeccionar.
- **FR-003**: El sistema MUST permitir definir criterios por plan con nombre, valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- **FR-004**: El sistema MUST validar que los criterios tengan valor esperado y tolerancia numéricos, tolerancia no negativa, unidad no vacía y tipo de comparación perteneciente a `range`, `min`, `max` o `boolean`.
- **FR-005**: El sistema MUST permitir registrar inspecciones con plan aprobado, lista de verificación aprobada, inspector, fecha, documento origen y estado (`draft`, `pending_review`, `completed`).
- **FR-006**: El sistema MUST validar que el origen de la inspección pertenezca a recepción, orden de producción o despacho, y que el registro referenciado exista.
- **FR-007**: El sistema MUST rechazar inspecciones con referencias a registros inexistentes o a módulos de origen no permitidos.
- **FR-008**: El sistema MUST permitir ingresar un valor medido numérico por cada criterio del plan.
- **FR-009**: El sistema MUST calcular automáticamente el cumplimiento de cada criterio según el tipo de comparación: `range`, `min`, `max` o `boolean`.
- **FR-010**: El sistema MUST considerar cumplido un criterio cuyo valor medido se encuentre exactamente en un límite de tolerancia.
- **FR-011**: El sistema MUST impedir el ingreso o la edición manual del cumplimiento por criterio y del dictamen general, salvo el flujo de revisión con justificación.
- **FR-012**: El sistema MUST derivar `proposed_result` únicamente cuando todos los criterios estén evaluados al enviar la inspección a revisión (`inspection_status = pending_review`): `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos los criterios se evalúan y cumplen; `overall_result` MUST fijarse únicamente en la revisión del Jefe de Calidad según FR-014.
- **FR-013**: El sistema MUST impedir enviar a revisión una inspección con criterios sin medición o con valores no numéricos, y MUST impedir `review_decision = approved` (y por tanto `overall_result = passed`) cuando existan criterios críticos fallidos o sin medición. Esta guarda NO genera una no conformidad por sí sola; la NC automática se rige por FR-015/FR-034.
- **FR-014**: El sistema MUST permitir solo al rol `jefe_calidad` revisar una inspección en `pending_review` o en `completed` con `proposed_result = conditional` y `review_decision = null`, y emitir `review_decision = approved`, `approved_conditional` o `rejected`, con justificación obligatoria cuando difiera del propuesto o sea condicional/reprobado; MUST registrar `review_decision`, `reviewed_by` y `reviewed_at`, y MUST NOT permitir `approved` (ni `overall_result = passed`) si existen criterios críticos fallidos o sin medición. La decisión se refleja en `overall_result` según el mapeo `approved → passed`, `approved_conditional → conditional`, `rejected → failed`, aplicando el "Contrato único de revisión y auditoría".
- **FR-015**: El sistema MUST generar un borrador de no conformidad cuando la revisión del Jefe de Calidad emita `review_decision = rejected` con `overall_result = failed` desde `pending_review` o desde el caso heredado `completed` con `proposed_result = conditional` y `review_decision = null`, con descripción autogenerada de los criterios incumplidos, producto y lote del origen, tipo de defecto inicial `other`, severidad inicial `major` y estado `open`; la descripción MUST ser editable y no vacía. La guarda de criterios críticos fallidos o sin medición de FR-013/FR-014 NO genera NC por sí sola; un override posterior tampoco genera NC (FR-034).
- **FR-016**: El sistema MUST permitir clasificar la no conformidad por tipo de defecto (`dimensional`, `functional`, `packaging`, `other`), severidad (`minor`, `major`, `critical`), estado (`open`, `under_review`, `closed`), producto o lote y responsable asignado.
- **FR-017**: El sistema MUST permitir crear acciones CAPA asociadas a una no conformidad con estado (`pending`, `in_progress`, `completed`) y cierre (`closure_status`: `pending`, `approved`, `rejected`), además de evidencia y revisión de eficacia.
- **FR-018**: El sistema MUST exigir responsable, descripción, causa raíz, tipo de acción (`resampling`, `rework`, `other`) y fecha límite en toda acción CAPA; MUST permitir adjuntar evidencia de ejecución.
- **FR-019**: El sistema MUST identificar como vencidas las acciones CAPA cuya fecha límite haya pasado y cuyo cierre no esté `approved`, sin cambiar automáticamente su estado.
- **FR-020**: El sistema MUST mostrar un dashboard con tasa de aprobación por etapa calculada según FR-039, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA (porcentaje de cierres aprobados con `effectiveness_result = effective` sobre el total de cierres aprobados; 0 cuando no haya cierres aprobados), e inspecciones pendientes (`draft` y `pending_review`, sin incluir en este conteo el caso heredado `completed` condicional sin decisión, que se gestiona en la bandeja). Las inspecciones `pending_review` MUST mostrarse como trabajo pendiente, pero MUST NOT participar en la tasa de aprobación ni en ningún KPI de resultados hasta quedar `completed`.
- **FR-021**: El sistema MUST mostrar un análisis de Pareto de productos y etapas con mayor concentración de no conformidades.
- **FR-022**: El sistema MUST permitir filtrar el historial de inspecciones por lote (documento origen) y rango de fechas.
- **FR-023**: El sistema MUST ofrecer una acción visible para limpiar los filtros del historial.
- **FR-024**: El sistema MUST mostrar estados vacíos claros cuando no existan registros o resultados para los filtros aplicados en dashboard, lotes pendientes, cuarentena, historial, revisión de inspecciones, revisión de planes y listas, revisión de documentos, cierre de CAPA, exportación, evidencia y alertas.
- **FR-025**: El sistema MUST conservar la trazabilidad desde la inspección y sus resultados hasta el cierre de la no conformidad y hasta la decisión de cierre de sus acciones CAPA (`approved` o `rejected`), incluyendo la revisión de eficacia, sin exigir que el cierre de la CAPA esté aprobado para cerrar la no conformidad.
- **FR-026**: El sistema MUST preservar la integridad de los datos aplicando la "Matriz única de integridad y retención": planes o criterios con inspecciones históricas no se editan ni eliminan; listas o documentos `approved` con evaluaciones o historial no se editan ni eliminan en la misma versión; una inspección con no conformidad no se elimina; una no conformidad con CAPA elimina sus CAPA en cascada; una inspección sin no conformidad elimina sus resultados en cascada; la evidencia se elimina en cascada con su inspección (sin no conformidad), no conformidad, CAPA o documento, y permanece cuando la eliminación está bloqueada.
- **FR-027**: El sistema MUST mantener disponibles los datos registrados entre sesiones de uso.
- **FR-028**: El sistema MUST ofrecer en el dashboard de calidad un selector "Rol de uso" con los valores `jefe_calidad`, `inspector` y `gerente`, MUST usar `jefe_calidad` como valor inicial cuando no exista un valor válido en `localStorage` (`erp_quality:viewer_role`), MUST persistir el valor seleccionado y MUST volver a renderizar las vistas al cambiarlo. El rol activo MUST aplicar la matriz de permisos de FR-051–FR-054: las acciones no permitidas MUST ocultarse o deshabilitarse y MUST bloquearse si se invocan, mostrando un mensaje. Las métricas agregadas MUST mostrarse a todos los roles y el detalle individual por inspector MUST quedar limitado al rol `jefe_calidad`.
- **FR-029**: El sistema MUST marcar en la sección de inspecciones de la bandeja de aprobaciones pendientes del Jefe de Calidad, según la "Matriz de bandejas", toda inspección sin `review_decision`: las `pending_review` y el caso heredado `completed` con `proposed_result = conditional`, `review_decision = null` y `legacy_completed = true` cuando corresponda. La bandeja MUST retirar la inspección cuando se registre cualquier `review_decision` final (`approved`, `approved_conditional` o `rejected`), inclusive cuando el resultado final sea `conditional`; las inspecciones con resultado `conditional` MUST NOT generar una no conformidad automática, mientras que `review_decision = rejected` (`overall_result = failed`) MUST generar el borrador de no conformidad cuando no exista una.
- **FR-030**: El sistema MUST mostrar una vista de lotes pendientes con ID de lote, producto, fecha, estado y una acción para iniciar la inspección; un lote MUST seguir pendiente mientras no tenga una inspección `completed`.
- **FR-031**: El sistema MUST mostrar en una vista o pestaña de cuarentena los lotes con no conformidades en estado `open` o `under_review`, incluyendo ID de lote, producto, severidad, tipo de defecto y acceso a la acción CAPA.
- **FR-032**: El sistema MUST registrar revisor, usuario, fecha y justificación cuando el Jefe de Calidad emite o cambia un dictamen, y MUST conservar ese registro en el historial según el "Contrato único de revisión y auditoría".
- **FR-033**: El sistema MUST permitir seleccionar solo planes `approved` y listas de verificación `approved` cuyo producto y etapa coincidan con el documento origen, derivando la etapa del módulo de origen (`goods_receipt` → `incoming`, `production_order` → `in_process`, `shipment` → `final`) y tomando el producto del documento origen.
- **FR-034**: El sistema MUST NOT generar una no conformidad al cambiar manualmente el dictamen de una inspección ya `completed` (incluido a `failed`); la inspección MUST conservarse en estado `completed`, y la generación automática de una no conformidad MUST ocurrir solo cuando la revisión emita `review_decision = rejected` (`overall_result = failed`) desde `pending_review` o desde la excepción `completed` condicional sin decisión, y no exista una NC previa.
- **FR-035**: El sistema MUST permitir cerrar una no conformidad fijando su estado en `closed` desde el formulario de no conformidades, sin condicionar el cierre a que sus acciones CAPA tengan el cierre aprobado. La cuarentena MUST derivarse de las no conformidades en estado `open` o `under_review`: el lote MUST mostrarse mientras exista alguna, MUST mostrarse como "Cuarentena - En tratamiento" cuando la no conformidad tenga al menos una acción CAPA, y MUST dejar de mostrarse cuando esas no conformidades pasen a `closed`.
- **FR-036**: El sistema MUST reanudar el borrador existente cuando se inicie una inspección para un origen y plan que ya tienen una inspección `draft`, conservando sus mediciones y sin crear un duplicado.
- **FR-037**: El sistema MUST resolver una inspección `pending_review`, o como excepción/legado `completed` con `proposed_result = conditional` y `review_decision = null`, mediante la revisión del Jefe de Calidad, aplicando el "Contrato único de revisión y auditoría" (con justificación, revisor y fecha cuando corresponda); la inspección `pending_review` MUST quedar en estado `completed` tras el dictamen final y la excepción `completed` MUST conservar ese estado; en ambos casos MUST retirarse de la bandeja en cuanto se registre `review_decision`, sin importar si el resultado final es `passed`, `conditional` o `failed`.
- **FR-038**: El sistema MUST permitir fijar el estado de una acción CAPA (`pending`, `in_progress`, `completed`) desde el formulario de CAPA; al pasar a `completed` MUST registrar la marca temporal de finalización y dejar el cierre en `closure_status = pending`; la aprobación o rechazo del cierre MUST quedar restringida al Jefe de Calidad.
- **FR-039**: El sistema MUST calcular la tasa de aprobación por etapa como `count(inspection_status = completed AND overall_result = passed) / count(inspection_status = completed AND overall_result IN (passed, conditional, failed))`, con 0 cuando el denominador sea 0; las inspecciones con `overall_result = conditional` cuentan en el denominador pero no en el numerador, y las inspecciones `draft`, `pending_review` o con `overall_result = null` no participan hasta tener resultado final según FR-020.
- **FR-040**: El sistema MUST permitir navegar a Control de Calidad desde el grupo "Control de Calidad" de la barra lateral del módulo base, alternando la vista de calidad seleccionada y ocultando las vistas del módulo base; dentro de ese grupo, el menú lateral MUST organizarse según FR-077; la acción "Inspeccionar" de la vista de lotes pendientes MUST abrir la vista de inspecciones con el documento origen preseleccionado, y las bandejas de revisión de planes, listas, documentos, inspecciones y cierre de CAPA MUST ser accesibles desde la navegación de calidad.
- **FR-041**: El sistema MUST permitir exportar en CSV UTF-8 el historial filtrado de inspecciones y resultados, con lote, producto, plan, etapa, fecha, inspector, dictamen, estado y una columna `resultados` que resuma cada criterio como `criterio:medido:cumple` separado por `;`, respetando los filtros activos, y MUST bloquear la exportación cuando los filtros sean inválidos.
- **FR-042**: El sistema MUST permitir exportar el resumen de indicadores del dashboard (tasa de aprobación por etapa, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes) y MUST informar cuando no haya datos para exportar.
- **FR-043**: El sistema MUST permitir adjuntar evidencia a inspecciones, no conformidades, acciones CAPA y documentos, registrando nombre, tipo, tamaño, autor (empleado seleccionado en el formulario de evidencia), fecha y contenido como data URL base64; MUST aceptar solo `image/png`, `image/jpeg` y `application/pdf` de hasta 5 MB por archivo para evidencia de calidad, MUST rechazar cualquier otro tipo o tamaño, y MUST rechazar cargas que superen el límite acumulado de 8 MB o la cuota de almacenamiento, conservando la evidencia existente. El archivo principal de un documento conserva su validación y límite propios.
- **FR-044**: El sistema MUST conservar el vínculo de la evidencia con su inspección, no conformidad, acción CAPA o documento en el historial, aplicar la "Matriz única de integridad y retención" al eliminar registros con evidencia, y MUST permitir previsualizar y descargar la evidencia vinculada.
- **FR-045**: El sistema MUST permitir configurar reglas de alerta con indicador perteneciente a `approval_rate`, `open_non_conformances`, `overdue_capa`, `capa_effectiveness` o `pending_inspections`; operador perteneciente a `lt`, `lte`, `gt`, `gte` o `eq`; umbral numérico dentro del rango del indicador (0–100 para tasas y ≥ 0 para conteos); y severidad perteneciente a `info`, `warning` o `critical`; MUST validar el rango del umbral y MUST rechazar una segunda regla activa para el mismo indicador y operador.
- **FR-046**: El sistema MUST evaluar las reglas de alerta activas contra los datos actuales y MOSTRAR en el dashboard las alertas incumplidas con indicador, valor actual, umbral y severidad; las reglas MUST persistir entre sesiones y MUST NOT bloquear operaciones ni generar no conformidades automáticas.
- **FR-047**: El sistema MUST permitir desactivar una regla de alerta (`is_active = false`) o eliminarla; al desactivarla o eliminarla MUST dejar de mostrarse su alerta y, si se elimina, MUST retirar la regla del almacenamiento conservando el resto de reglas.
- **FR-048**: El sistema MUST registrar en `quality_audit_log` cada alta, edición, revisión, aprobación, rechazo, cambio de estado y eliminación permitida sobre planes (`inspection_plan`), listas (`checklist`), documentos (`document`), inspecciones (`inspection`), no conformidades (`non_conformance`) y acciones CAPA (`corrective_action`), con `entity_type`, `entity_id`, `reference_module` + `reference_id` del lote cuando aplique, `action` perteneciente a `create`, `update`, `review`, `approve`, `reject`, `status_change` o `delete`, `changed_field`, `before_value`, `after_value`, `actor`, `timestamp` ISO y `justification` cuando aplique. El actor MUST ser el empleado seleccionado en la operación (`inspector_id`, `overridden_by`, responsable CAPA o empleado del formulario); solo si la operación no expone empleado, el rol activo de `erp_quality:viewer_role` se usa como metadato sin habilitar ni restringir acciones.
- **FR-049**: El sistema MUST conservar las entradas de auditoría tras eliminaciones permitidas según la "Matriz única de integridad y retención" (incluida la eliminación directa de una CAPA, la de listas o documentos sin historial y las cascadas de FR-026), MUST interpretar `before_value = null` en `create` y `after_value = null` en `delete`, y MUST permitir filtrar la bitácora por lote (`reference_module` + `reference_id`), `entity_type` (incluyendo `inspection_plan`, `checklist` y `document`) y rango de fechas sobre `timestamp`, con acción visible para limpiar filtros y estado vacío claro cuando no haya coincidencias; MUST rechazar un rango de fechas inválido (`desde > hasta`) informando el error sin modificar la vista, igual que en US6.
- **FR-050**: El sistema MUST emitir una sola entrada de auditoría para el dictamen final y su justificación de FR-014/FR-032, con `action = approve` o `reject` y `changed_field = overall_result` según el "Contrato único de revisión y auditoría", sin duplicarla como `update` ni `status_change`.
- **FR-051**: El sistema MUST definir una matriz de permisos para los roles `jefe_calidad`, `inspector` y `gerente`, aplicar esa matriz en todas las vistas y operaciones, y MUST bloquear con un mensaje cualquier acción no permitida sin alterar el estado ni registrar un cambio.
- **FR-052**: El rol `jefe_calidad` MUST poder crear y editar planes y listas; aprobarlos o rechazarlos; aprobar o rechazar documentos e inspecciones; supervisar no conformidades; aprobar o rechazar el cierre y la eficacia de CAPA; configurar alertas; exportar reportes y consultar todo el detalle.
- **FR-053**: El rol `inspector` MUST poder ejecutar inspecciones, completar listas `approved`, registrar evidencia, crear no conformidades y proponer acciones CAPA; MUST NOT poder aprobar ni rechazar planes, listas, documentos, inspecciones ni cierres de CAPA.
- **FR-054**: El rol `gerente` MUST poder consultar en modo solo lectura los indicadores, reportes, resultados de inspecciones, lotes en cuarentena y estado de las CAPA; MUST NOT crear, editar, eliminar, aprobar ni rechazar registros.
- **FR-055**: El sistema MUST gestionar el ciclo de vida de un plan de inspección según la "Validación común de planes y listas": `draft` → `pending_approval` → `approved` o `rejected`; MUST exigir los campos obligatorios y al menos un criterio para enviarlo a aprobación; MUST permitir al Jefe de Calidad aprobarlo o rechazarlo con justificación, registrando revisor y fecha; MUST devolverlo a `draft` al editar uno rechazado; y MUST bloquear la edición de un plan `approved` con inspecciones históricas, exigiendo duplicarlo como nueva versión.
- **FR-056**: El sistema MUST gestionar el ciclo de vida de una lista de verificación según la "Validación común de planes y listas": `draft` → `pending_approval` → `approved` o `rejected`; MUST exigir nombre, categoría y al menos un criterio para enviarla a aprobación; MUST permitir al Jefe de Calidad aprobarla o rechazarla con justificación, registrando revisor y fecha; MUST devolverla a `draft` al editar una rechazada; y MUST bloquear la edición de una lista `approved` con evaluaciones o inspecciones históricas, exigiendo duplicarla como nueva versión.
- **FR-057**: El sistema MUST mostrar en la sección de planes y listas de la bandeja de aprobaciones pendientes del Jefe de Calidad, según la "Matriz de bandejas", los elementos `pending_approval`, con previsualización de nombre, categoría, descripción y criterios, y MUST registrar las acciones `review`, `approve` y `reject` en la bitácora con su justificación.
- **FR-058**: El sistema MUST gestionar el flujo de inspección `draft` → `pending_review` → `completed`; el Inspector MUST poder seleccionar plan y lista `approved`, identificar el lote o producto, completar criterios, registrar resultados, adjuntar evidencia, registrar no conformidades y enviar a revisión; el Jefe de Calidad MUST emitir `approved`, `approved_conditional` o `rejected` con las reglas de FR-014 y el "Contrato único de revisión y auditoría"; y una inspección `pending_review` MUST NOT contar en KPIs ni liberar el lote.
- **FR-059**: El sistema MUST gestionar documentos de calidad con código (`document_id`), nombre, tipo/categoría, versión, fecha de creación, responsable, estado (`draft`, `pending_review`, `approved`, `rejected`) y archivo/evidencia; MUST permitir crear y editar borradores, enviarlos a revisión, mostrar los documentos `pending_review` en la sección de documentos de la bandeja de aprobaciones pendientes con previsualización, aprobar o rechazar con justificación y registrar revisor y fecha; MUST devolver a `draft` un documento rechazado al editarlo y MUST exigir una nueva versión para modificar uno `approved`.
- **FR-060**: El sistema MUST permitir registrar no conformidades con descripción no vacía, producto o lote, severidad, responsable y estado; la inspección asociada MUST capturarse cuando exista, y la evidencia MUST poder adjuntarse sin ser obligatoria. MUST permitir asociar una o más acciones CAPA, la creación manual desde el formulario de no conformidades por el Inspector o el Jefe de Calidad sin exigir una inspección reprobada, y su supervisión por el Jefe de Calidad.
- **FR-061**: El sistema MUST gestionar el cierre y la eficacia de las acciones CAPA: al marcar `completed` MUST dejar el cierre en `pending`; el Jefe de Calidad MUST registrar la eficacia (`effective` o `not_effective`) con observaciones y aprobar o rechazar el cierre con justificación; un rechazo MUST devolver la acción a `in_progress`; y MUST impedir aprobar el cierre sin revisión de eficacia.
- **FR-062**: El sistema MUST registrar en la bitácora las acciones de revisión, aprobación y rechazo de planes, listas, documentos, inspecciones y cierres de CAPA, con actor, fecha, decisión y justificación, aplicando el "Contrato único de revisión y auditoría" y conservando las entradas tras eliminaciones permitidas según la "Matriz única de integridad y retención".
- **FR-063**: El sistema MUST mostrar en cada registro su estado con una etiqueta legible, ofrecer acciones claras según el estado y el rol, mostrar mensajes de confirmación o error después de cada operación importante, y actualizar listados y detalles sin recargar la página.
- **FR-064**: El sistema MUST NOT permitir que un registro entre en `pending_approval` o `pending_review` sin una bandeja o pantalla de revisión accesible para el Jefe de Calidad; toda bandeja MUST cumplir la "Matriz de bandejas", listar los pendientes con acciones de aprobar y rechazar y conservar una sola entrada de menú para todas las secciones.
- **FR-065**: El sistema MUST conservar los datos existentes al introducir los nuevos estados: los planes legados sin estado MUST considerarse `approved` para no interrumpir inspecciones; las listas y documentos legados MUST migrarse a un estado válido (`active` → `approved`; `under_review` → `pending_review`; `archived` se conserva como legado no seleccionable fuera del flujo de aprobación) sin perder criterios, evaluaciones, archivos ni historial. La normalización MUST ejecutarse antes de renderizar cualquier bandeja o vista dependiente de estos estados.
- **FR-066**: El sistema MUST recalcular las acciones disponibles al cambiar el rol activo y MUST NOT conservar permisos del rol anterior en formularios o vistas abiertas.
- **FR-067**: El sistema MUST ofrecer solo planes y listas `approved` en el formulario de inspección y MUST rechazar cualquier intento de usar un plan o lista en otro estado; MUST conservar la versión aprobada y el historial al crear una nueva versión, según la "Validación común de planes y listas".
- **FR-068**: El sistema MUST aplicar los tokens y reglas definidos en "Sistema visual de referencia y verificación" en todas las pantallas enumeradas en la matriz de US15: tipografía, espaciado, alineación, iconografía, bordes, colores de estado y jerarquía de encabezados; el sistema MUST NOT usar una convención distinta sin una excepción documentada en esa sección.
- **FR-069**: Toda pantalla MUST mostrar un encabezado con título, descripción breve de propósito, indicador del rol activo y navegación de Control de Calidad; MUST presentar una sola acción principal y el resto como acciones secundarias, con etiquetas coherentes con el estado del registro y la matriz de permisos.
- **FR-070**: Todo estado, dictamen, severidad y resultado MUST representarse con una etiqueta textual legible y puede reforzarse con color o icono; las etiquetas de los tokens semánticos `approved`, `pending` y `rejected` de la "Matriz de tokens visuales" MUST incluir texto, color e icono; el color MUST NOT ser el único indicador y toda lista con más de dos estados MUST ofrecer leyenda o etiquetas autoexplicativas.
- **FR-071**: Cada bandeja de pendientes MUST cumplir la "Matriz de bandejas" con contador actualizado, filtros, acceso directo al detalle, estado vacío y acción siguiente; todo registro en `pending_approval` o `pending_review`, y toda inspección `completed` con `proposed_result = conditional` y `review_decision = null` (caso legado/excepción, sin retroceder a `pending_review`), MUST listarse en la bandeja correspondiente para el Jefe de Calidad.
- **FR-072**: Toda operación de guardado, envío, aprobación, rechazo, eliminación, exportación o carga MUST mostrar un estado de carga o acciones deshabilitadas desde la primera actualización de la interfaz, con objetivo no mayor a 300 ms, y MUST emitir confirmación o error al finalizar, sin dejar el estado sin retroalimentación visible.
- **FR-073**: Toda vista sin registros o sin coincidencias MUST mostrar un estado vacío con texto explicativo y una acción contextual para limpiar filtros, crear el primer registro o cambiar de bandeja según el rol y el permiso vigente.
- **FR-074**: Toda pantalla MUST permitir navegación por teclado con orden lógico y foco visible de 2 px con offset de 2 px, MUST mostrar etiquetas legibles en formularios y controles, y MUST cumplir contraste de al menos 4.5:1 para texto normal y 3:1 para texto grande y componentes interactivos según WCAG 2.1 AA; la información crítica MUST NOT depender únicamente del color.
- **FR-075**: El diseño de cada pantalla MUST adaptarse a escritorio desde 1024 px, tablet de 768 a 1023 px y móvil de 360 a 767 px sin desplazamiento horizontal de toda la página, conservando accesibles el encabezado, la navegación, las acciones principales y los datos o columnas clave definidos para esa pantalla en la "Matriz de columnas clave y búsqueda"; tablas y formularios MUST reorganizarse en bloques o expansiones controladas sin perder información ni funcionalidad.
- **FR-076**: La diferencia de permisos MUST reflejarse visualmente en todas las pantallas según la matriz de US15: el Jefe de Calidad MUST ver bandejas y acciones de decisión; el Inspector MUST ver acciones de ejecución y envío, pero MUST NOT ver acciones de aprobación; el Gerente MUST ver contenido en solo lectura y acciones de consulta o exportación, sin controles de creación, edición, eliminación ni aprobación.
- **FR-077**: El sistema MUST mostrar un menú lateral único con las cinco categorías, las 12 entradas y los identificadores de destino definidos en la "Matriz de destinos del menú"; MUST NOT duplicar identificadores de destino ni mostrar alias independientes "Panel", "Dashboard" o `quality-panel`, conservando la única entrada "Inicio / Dashboard"; MUST resaltar la sección activa con `aria-current` y etiqueta textual, y MUST conservar el acceso a todas las funciones existentes según la correspondencia documentada en US15.
- **FR-078**: El dashboard MUST presentar exactamente los elementos y fuentes definidos en la "Matriz del dashboard": encabezado de bienvenida, tarjetas de los indicadores de FR-020, inspecciones pendientes y con dictamen final, no conformidades abiertas, CAPA pendientes o vencidas, documentos pendientes de aprobación, gráficos derivados de registros existentes, actividad reciente derivada de `quality_audit_log` y accesos rápidos por rol derivados de la matriz de permisos; MUST NOT incluir tarjetas decorativas, indicadores duplicados ni cifras sin origen en los registros.
- **FR-079**: El sistema MUST aplicar en todas las secciones los tokens definidos en la "Matriz de tokens visuales": superficie `#ffffff`, fondo `#f2f4f8`, texto `#17233b`, texto secundario `#475569`, borde `#dde3ec`, primario `#1e40af`, interacción `#2563eb`, aprobación `#166534` sobre `#dcfce7`, pendiente `#92400e` sobre `#fef3c7`, rechazo o problema `#b91c1c` sobre `#fee2e2`, foco `#2563eb`, radio de `10 px` en tarjetas y `8 px` en controles, espaciado múltiplo de `4 px`, tipografía system-ui con cuerpo mínimo de `14 px/1.5` e iconos SVG de `18 px` con `stroke-width: 1.8`. El significado del color MUST reforzarse con etiqueta textual legible y, como mínimo, color o icono según FR-070; en los tokens semánticos de aprobación, pendiente y rechazo MUST aplicarse texto, color e icono.
- **FR-080**: Toda tabla MUST presentar encabezados claros, filtros, buscador sobre el conjunto ya filtrado de la vista activa, estados visibles y una sola zona de acciones; MUST conservar los datos o columnas clave definidos en la "Matriz de columnas clave y búsqueda", MUST aplicar coincidencia insensible a mayúsculas sobre columnas visibles y MUST NOT crear nuevas fuentes de datos ni repetir la misma acción o columna en varios lugares de la misma vista.
- **FR-081**: Todo formulario con información agrupable MUST dividirse en bloques lógicos con revelación progresiva, mostrando primero como campos esenciales los obligatorios para guardar o enviar la operación según FR-001–FR-067, y permitiendo acceder al detalle solo cuando sea necesario; MUST conservar etiquetas, validaciones, ayuda contextual y errores junto al campo, sin exigir de entrada datos que aún no aportan valor a la operación.
- **FR-082**: Cada sección MUST mostrar un título claro, una descripción breve de su propósito, una sola acción principal visible, información organizada, mensajes de ayuda cuando sean necesarios y estados reconocibles; el sistema MUST NOT mostrar formularios vacíos sin explicación, botones sin acción asociada ni elementos decorativos que no aporten utilidad.
- **FR-083**: El sistema MUST representar visualmente los estados `draft` como "Borrador", `pending_approval`/`pending_review`/`closure_status = pending` como "Pendiente", `approved`/`approved_conditional`/cierre aprobado como "Aprobado", `rejected`/rechazo de cierre como "Rechazado" y CAPA vencida como "Vencido", usando etiqueta textual reforzada con color o icono y leyenda cuando convivan varios estados; el color MUST NOT ser el único indicador.

### Inventario de componentes visuales *(entrada para planificación, no implementación)*

| Componente | Clasificación | Referencia funcional | Módulo destino | Archivo previsto | Prueba asociada | Estado |
|---|---|---|---|---|---|---|
| Encabezado de vista con título, rol y navegación | Reutilizable con ajuste | US15, FR-069 | Todas las vistas | `src/components/shell.js` | `tests/integration/workspace-shell.test.js` | Pendiente |
| Tarjetas de indicadores | Reutilizable con ajuste | US5, FR-078 | `quality-dashboard` | `src/components/dashboard.js` | `tests/integration/quality-dashboard.test.js` | Pendiente |
| Bandeja de aprobaciones pendientes | Reutilizable con ajuste | FR-057, FR-064, FR-071 | `quality-approvals` | `src/components/quality-review-queue.js` (nuevo) | `tests/integration/quality-review-queue.test.js` (nueva) | Pendiente |
| Tabla con filtros, estados y acciones | Reutilizable con ajuste | FR-022, FR-023, FR-080 | Todas las tablas | `src/components/entity-list.js`, `src/components/inspection-history.js`, `src/components/quality-audit-log.js` | `tests/integration/search-entities.test.js`, `tests/integration/inspection-history.test.js`, `tests/integration/quality-audit-log.test.js` | Pendiente |
| Mensajes de confirmación, error y estados vacíos | Reutilizable | FR-024, FR-072, FR-073 | Todas las vistas | `src/components/quality-utils.js` | `tests/integration/relabeling.test.js` | Pendiente |
| Formularios con validación y ayuda | Reutilizable con ajuste | US15, FR-074, FR-081 | Planes, listas, documentos, NC, CAPA y configuración | `src/components/entity-form.js`, `src/components/document-form.js`, `src/components/quality-settings.js` | `tests/integration/manage-tabs.test.js`, `tests/integration/quality-settings.test.js` | Pendiente |
| Gráficos de resultados y Pareto | Reutilizable con ajuste | FR-021, FR-078 | `quality-dashboard`, `quality-reports` | `src/components/dashboard.js`, `src/components/quality-reports.js` | `tests/integration/quality-dashboard.test.js`, `tests/integration/quality-reports.test.js` | Pendiente |
| Navegación lateral | Rediseñar | FR-040, FR-077 | Menú de Control de Calidad | `src/components/shell.js`, `src/module-config.js` | `tests/integration/workspace-shell.test.js`, `tests/unit/module-config.test.js` | Pendiente |
| Dashboard | Rediseñar | FR-020, FR-021, FR-078 | `quality-dashboard` | `src/components/dashboard.js` | `tests/integration/quality-dashboard.test.js` | Pendiente |
| Sistema de estados visuales | Rediseñar | FR-070, FR-083 | Todas las vistas | `src/components/quality-utils.js`, `src/quality-styles.css` | `tests/integration/relabeling.test.js` | Pendiente |
| Paleta, tipografía, iconografía y espaciado | Rediseñar | FR-068, FR-079 | Todas las vistas | `src/quality-styles.css` | `tests/integration/quality-ui-consistency.test.js` (nueva) | Pendiente |
| Layout adaptable | Rediseñar | FR-075, SC-032, SC-039 | Todas las vistas | `src/quality-styles.css` | `tests/integration/quality-responsive.test.js` (nueva) | Pendiente |
| Búsqueda | Nuevo contenedor visual | FR-077, US2, US6, US10 | `quality-search` | `src/components/search-bar.js`, `src/app.js` | `tests/integration/search-entities.test.js` | Pendiente |
| Reportes | Nuevo contenedor visual | FR-041, FR-042, FR-077 | `quality-reports` | `src/components/quality-reports.js`, `src/components/csv.js` | `tests/integration/quality-reports.test.js`, `tests/integration/quality-export.test.js` | Pendiente |
| Entidades | Nuevo contenedor visual | FR-077 | `quality-entities` | `src/components/entity-list.js` | `tests/integration/search-entities.test.js`, `tests/integration/create-entity.test.js` | Pendiente |
| Configuración | Nuevo contenedor visual | FR-028, FR-045, FR-077 | `quality-settings` | `src/components/quality-settings.js` | `tests/integration/quality-settings.test.js`, `tests/integration/quality-alerts.test.js` | Pendiente |
| Actividad reciente y accesos rápidos por rol | Nuevos componentes a especificar | FR-078 | `quality-dashboard` | `src/components/dashboard.js` | `tests/integration/quality-dashboard.test.js` | Pendiente |

### Key Entities *(include if feature involves data)*

- **Rol de usuario y matriz de permisos**: Rol activo (`jefe_calidad`, `inspector`, `gerente`) persistido en `localStorage` y matriz que define las acciones permitidas por rol; no constituye autenticación real.
- **Plan de inspección**: Define las pautas de control de un producto para una etapa operativa; agrupa criterios y se asocia a las inspecciones ejecutadas. Tiene estado (`draft`, `pending_approval`, `approved`, `rejected`), metadatos de envío y revisión, y no se edita ni elimina si tiene inspecciones históricas; solo los aprobados se usan en inspecciones.
- **Criterio de inspección**: Parámetro evaluado dentro de un plan, con valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
- **Lista de verificación**: Plantilla de control con nombre, categoría, descripción, criterios y evaluaciones; tiene estado (`draft`, `pending_approval`, `approved`, `rejected`), metadatos de envío y revisión, y solo las aprobadas se ofrecen para inspecciones o evaluaciones. Se conserva como entidad existente (`quality_checklists`) y no se duplica con los planes.
- **Documento de calidad**: Documento controlado con código (`document_id`), nombre, tipo/categoría, descripción, versión, fecha de creación, responsable, archivo/evidencia y estado (`draft`, `pending_review`, `approved`, `rejected`), además de revisor, fecha y justificación de la decisión.
- **Inspección**: Evento de control con fecha, inspector, plan y lista de verificación aprobados, documento origen, `inspection_status` (`draft`, `pending_review`, `completed`), `proposed_result`, `overall_result` y `review_decision` (`approved`, `approved_conditional`, `rejected`). La revisión registra `reviewed_by`, `reviewed_at` y `review_justification`.
- **Resultado de inspección**: Medición de un criterio dentro de una inspección y su cumplimiento calculado.
- **No conformidad**: Desviación detectada por una inspección con `overall_result = failed` por rechazo en revisión o registrada manualmente, con descripción, producto o lote, tipo de defecto, severidad, estado, responsable y evidencia opcional; puede tener varias acciones CAPA.
- **Acción CAPA**: Medida correctiva o preventiva asociada a una no conformidad, con responsable, descripción, causa raíz, tipo de acción, fecha límite, estado, evidencia, cierre (`pending`, `approved`, `rejected`) y revisión de eficacia (`effective`, `not_effective`).
- **Lote pendiente**: Documento origen sin inspección completada; se deriva de las dependencias externas y no se almacena como entidad propia.
- **Producto, empleado, recepción, orden de producción y despacho**: Datos maestros y transaccionales externos al módulo; se consultan y validan, pero no se crean desde Control de Calidad.
- **Evidencia de calidad**: Archivo de respaldo asociado a una inspección, no conformidad, acción CAPA o documento, con nombre, tipo, tamaño, autor, fecha y contenido local; solo PNG/JPG/PDF de hasta 5 MB por archivo y 8 MB acumulados.
- **Regla de alerta de calidad**: Umbral configurable sobre un indicador del dashboard, con indicador, operador, valor límite, severidad y estado activo.
- **Bandeja de revisión**: Vista derivada que agrupa planes, listas, documentos, inspecciones y cierres de CAPA en estado pendiente para el Jefe de Calidad; no se almacena como entidad propia.
- **Entrada de bitácora de auditoría**: Registro inmutable de una acción sobre plan, lista, documento, inspección, NC o CAPA, con lote persistido cuando aplique, entidad, acción (`create`, `update`, `review`, `approve`, `reject`, `status_change`, `delete`), campo y valores anterior/nuevo, actor, marca temporal ISO y justificación; permanece tras la eliminación del registro auditado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un inspector puede completar una inspección de hasta 10 criterios en menos de 3 minutos desde que selecciona el origen hasta que guarda el dictamen, con el tiempo medido mediante instrumentación.
- **SC-002**: El 100 % de los cumplimientos por criterio y del `proposed_result` son calculados por el sistema; el `overall_result` se registra solo como consecuencia de la revisión del Jefe de Calidad y no se acepta ingreso manual de valores calculados.
- **SC-003**: El 100 % de las inspecciones con `overall_result = failed` obtenido por `rejected` en revisión genera un borrador de no conformidad asociado con descripción no vacía; el 0 % de los cambios manuales posteriores a `completed`, incluidos los cambios a `failed`, genera NC automática.
- **SC-004**: El 100 % de las acciones CAPA registradas incluye responsable, descripción, causa raíz, tipo de acción y fecha límite.
- **SC-005**: El dashboard refleja los indicadores de inspecciones, no conformidades, CAPA vencidas, eficacia CAPA e inspecciones pendientes sin diferencias respecto de los registros almacenados.
- **SC-006**: Una búsqueda en el historial con filtros de lote y fechas devuelve únicamente registros coincidentes en menos de 1 segundo percibido por el usuario, con el tiempo medido mediante instrumentación.
- **SC-007**: El 0 % de las inspecciones guardadas queda con referencias a documentos origen inexistentes o no permitidos.
- **SC-008**: Al menos el 90 % de los usuarios que participan en la demo completan el flujo lote pendiente → inspección → no conformidad → CAPA sin ayuda del facilitador; se verifica con lista de cotejo del facilitador y resultados anónimos, no con una aserción automatizable.
- **SC-009**: La trazabilidad completa de una inspección hasta el cierre de su acción CAPA puede demostrarse en una sola consulta al historial.
- **SC-010**: El módulo mantiene respuestas de consulta y dashboard en menos de 2 segundos con hasta 500 inspecciones almacenadas, con el tiempo medido mediante instrumentación.
- **SC-011**: El 100 % de los planes y criterios con inspecciones históricas bloquea su edición y eliminación, y el 100 % de las inspecciones completadas deja de aparecer como lote pendiente.
- **SC-012**: El 100 % de las exportaciones respeta los filtros activos y finaliza en menos de 2 segundos con hasta 500 inspecciones almacenadas, con el tiempo medido mediante instrumentación.
- **SC-013**: El 100 % de las evidencias adjuntas queda vinculada a su inspección o no conformidad y disponible para descarga desde el historial.
- **SC-014**: El 100 % de las alertas mostradas corresponde a reglas activas cuyo umbral se incumple con los datos almacenados, sin diferencias respecto de los registros.
- **SC-015**: El 100 % de las cargas de evidencia que superan el límite acumulado de 8 MB o la cuota de almacenamiento se rechaza sin perder la evidencia previamente almacenada.
- **SC-016**: El 100 % de las altas, ediciones, cambios de estado y eliminaciones permitidas sobre inspecciones, no conformidades y CAPA queda registrado en la bitácora con lote, actor, marca temporal y justificación cuando corresponda, sin entradas duplicadas para el override; la consulta filtrada devuelve solo coincidencias en menos de 2 segundos con hasta 500 inspecciones almacenadas, con el tiempo medido mediante instrumentación.
- **SC-017**: El 100 % de las acciones se ajusta a la matriz funcional de permisos por rol de FR-051–FR-054; el 0 % de las acciones no autorizadas se ejecuta y todas muestran un mensaje explicativo sin alterar el estado.
- **SC-018**: El 100 % de los registros en `pending_approval` o `pending_review` aparece en la sección correspondiente de la bandeja de aprobaciones pendientes definida en la "Matriz de bandejas" y accesible para el Jefe de Calidad; el 0 % queda como pendiente sin pantalla de revisión.
- **SC-019**: El 100 % de las aprobaciones y rechazos de planes, listas y documentos registra revisor, fecha y justificación cuando corresponda.
- **SC-020**: El 0 % de las inspecciones iniciadas usa un plan o una lista de verificación no aprobada.
- **SC-021**: El 100 % de las inspecciones nuevas pasa por `pending_review` y recibe `review_decision` del Jefe de Calidad antes de considerarse `completed`; el caso legado/excepción `completed` con `review_decision = null` y `proposed_result = conditional` se resuelve en la bandeja sin revertir a `pending_review`. El 100 % de las inspecciones `pending_review` aparece como trabajo pendiente y el 0 % participa en KPIs de resultados antes de completarse.
- **SC-022**: El 100 % de los cierres de CAPA cuenta con revisión de eficacia y decisión del Jefe de Calidad; el 100 % de los rechazos registra justificación y devuelve la acción a `in_progress`.
- **SC-023**: El 100 % de las altas, ediciones, revisiones, aprobaciones, rechazos, cambios de estado y eliminaciones permitidas sobre planes, listas y documentos queda registrado en la bitácora con actor, fecha y justificación cuando corresponda.
- **SC-024**: Al menos el 90 % de los usuarios que participan en la demo identifica el estado de un registro y la siguiente acción disponible sin ayuda del facilitador; se verifica con lista de cotejo del facilitador y resultados anónimos, no con una aserción automatizable.
- **SC-025**: El 100 % de las operaciones importantes finaliza con un mensaje de confirmación o error comprensible y actualiza el estado visible del registro sin recargar la página.
- **SC-026**: El 100 % de los planes, listas y documentos rechazados vuelve a `draft` al editarse y exige un nuevo envío a revisión.
- **SC-027**: El 100 % de los planes, listas y documentos aprobados con historial bloquea su edición o eliminación en la misma versión y exige crear una nueva versión.
- **SC-028**: El 100 % de las 15 pantallas de la matriz de US15 cumple con título, indicador de rol activo, navegación de Control de Calidad y jerarquía de acciones primaria y secundaria; el 0 % omite estos elementos al ser verificada con los tres roles.
- **SC-029**: El 100 % de los estados, dictámenes, severidades y resultados visibles incluye una etiqueta textual legible; el 0 % se comunica solo por color y el 100 % de las listas con más de dos valores ofrece leyenda o etiquetas autoexplicativas.
- **SC-030**: El 100 % de las operaciones importantes muestra estado de carga o acciones deshabilitadas desde el inicio y hasta la resolución, sin operaciones silenciosas ni permanencia en un estado indeterminado; la confirmación o el error final se rigen por SC-025.
- **SC-031**: El 100 % de los registros `pending_approval`, `pending_review` y de las inspecciones `completed` con `proposed_result = conditional` y `review_decision = null` aparece en la bandeja correspondiente con contador actualizado para el Jefe de Calidad; el 0 % queda sin pantalla de revisión o sin acción de aprobación y rechazo.
- **SC-032**: El 100 % de las pantallas cumple contraste WCAG 2.1 AA, foco visible de 2 px con offset de 2 px, orden de tabulación lógico y etiquetas legibles en formularios y controles; el 0 % presenta desplazamiento horizontal de toda la página en 1024 px, 768 px y 360 px.
- **SC-033**: El 100 % de la matriz visual por rol se cumple: Jefe de Calidad ve bandejas y decisiones, Inspector ve ejecución sin aprobaciones, y Gerente ve solo lectura y exportación; el 0 % de los controles visibles contradice esa matriz visual, sin duplicar la verificación funcional de SC-017.
- **SC-034**: El menú lateral contiene el 100 % de las cinco categorías, las 12 entradas y los IDs de destino definidos en la "Matriz de destinos del menú", con 0 IDs duplicados y 0 alias "Panel", "Dashboard" o `quality-panel` como entradas independientes; la sección activa es visible por `aria-current` y texto en el 100 % de los casos.
- **SC-035**: El dashboard incluye el 100 % de los elementos y fuentes definidos en la "Matriz del dashboard", con 0 tarjetas decorativas o indicadores duplicados y 0 cifras sin origen en los registros almacenados.
- **SC-036**: El 100 % de las secciones aplica los tokens de la "Matriz de tokens visuales" con valores calculados iguales a los definidos, y el 0 % usa colores semánticos fuera del significado definido para aprobación, pendiente, rechazo o problema.
- **SC-037**: El 100 % de las secciones muestra título, descripción breve de propósito, una sola acción principal y estados reconocibles; el 0 % contiene botones sin acción, formularios vacíos sin explicación o elementos decorativos sin utilidad, y el 100 % de los formularios extensos usa agrupación y revelación progresiva.
- **SC-038**: El 100 % de los estados `draft`, pendiente, aprobado, rechazado y vencido usa exactamente las etiquetas "Borrador", "Pendiente", "Aprobado", "Rechazado" y "Vencido" definidas en FR-083, reforzadas con color o icono; el 0 % depende solo del color.
- **SC-039**: El 100 % de las pantallas mantiene organización, acciones, columnas o datos clave de la "Matriz de columnas clave y búsqueda" y campos accesibles en 1024 px, 768 px y 360 px; el 0 % presenta tablas o formularios desordenados o pierde información y funcionalidad en esos anchos.
- **SC-040**: El 0 % de las funcionalidades existentes se elimina tras la reorganización visual; el 100 % de las entradas del menú se corresponde con funcionalidad ya especificada o con un contenedor de solo lectura derivado de ella, y el 100 % de las acciones previas sigue accesible desde el menú o un acceso rápido equivalente.

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
- Autenticación real, SSO, gestión de usuarios, contraseñas o asignación persistente de roles por persona.
- Flujos de aprobación multinivel, delegación de aprobaciones o aprobación por comité.
- Firma digital de aprobaciones y sellado de tiempo certificado.
- Integración con gestores documentales externos o repositorios corporativos.
- Comparación de versiones (diff) o edición colaborativa de documentos.

## Assumptions

- El módulo se usa en una sola organización y no requiere autenticación multiusuario en el MVP; el usuario y el rol activos se seleccionan en la interfaz y se persisten localmente. El rol activo se aplica mediante una matriz de permisos que sí restringe las acciones; no representa una cuenta autenticada. Si no existe un valor válido en `erp_quality:viewer_role`, el rol inicial es `jefe_calidad`.
- La numeración de tareas en `tasks.md` es única dentro de la feature; las entradas históricas del "Registro de Modificaciones" usan T094–T098 para no colisionar con T056–T060 de las fases.
- Los productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas provistas como datos semilla para pruebas y demo.
- Las tolerancias se interpretan como límites inclusivos y los valores medidos son numéricos.
- El volumen esperado es de hasta 500 inspecciones almacenadas; volúmenes mayores quedan fuera del MVP.
- La verificación visual se realiza en tres anchos: 1024 px para escritorio, 768 px para tablet y 360 px para móvil; en ninguno debe existir desplazamiento horizontal de toda la página, tablas o formularios desordenados, ni pérdida de acciones o columnas clave.
- Esta revisión documental no cambia código por sí misma; los requisitos de US15, FR-068–FR-083 y SC-028–SC-040, junto con el inventario de componentes, son obligatorios para la implementación y deben trasladarse a `plan.md` y `tasks.md` en una entrega posterior autorizada.
- El MVP cubre un único espacio de trabajo y no contempla integración en tiempo real con otros sistemas.
- El término "lote" usado en las historias de usuario equivale al documento origen de la inspección (`reference_module` + `reference_id`); no existe una entidad de lote separada.
- Los lotes pendientes se derivan comparando los documentos origen disponibles con las inspecciones completadas; una inspección `draft` o `pending_review` no marca el lote como inspeccionado.
- Las métricas individuales por inspector son accesibles solo al rol de jefatura; el resto de los roles ve datos agregados por producto o etapa.
- La versión integrada con el módulo base requiere restaurar o implementar el código base existente antes de la demo final.
- La evidencia se limita a `image/png`, `image/jpeg` y `application/pdf`, con máximo de 5 MB por archivo y 8 MB acumulados; se almacena localmente como data URL base64 en el MVP. El archivo principal de un documento conserva su validación y límite de 10 MB.
- Las exportaciones se generan en formato CSV con codificación UTF-8; la exportación del historial incluye una columna `resultados` con `criterio:medido:cumple` separado por `;`.
- Las reglas de alerta se evalúan al abrir o actualizar el dashboard y no en tiempo real; se pueden desactivar o eliminar.
- Las alertas son informativas y no bloquean operaciones ni generan no conformidades automáticas.
- "Lista de verificación" y "plan de inspección" son artefactos distintos ya existentes (`quality_checklists` y `quality_inspection_plans`); una inspección puede usar ambos y solo se aceptan en estado `approved`.
- Los planes legados sin estado se consideran `approved` para no interrumpir las inspecciones; los estados legados `active`, `under_review` y `archived` de listas y documentos se migran a `approved`, `pending_review` y se conserva `archived` como legado no seleccionable fuera del flujo de aprobación, respectivamente, sin pérdida de datos.
- Los documentos usan el catálogo existente de tipos/categorías: `manual`, `procedure`, `regulation`, `certificate`, `specification` y `other`.
- El cierre de CAPA se modela con `closure_status` separado del estado de ejecución (`pending`, `in_progress`, `completed`), de modo que `completed` indica ejecución reportada y no cierre aprobado.
- Los planes, listas y documentos aprobados se versionan duplicándolos; la versión aprobada y su historial no se sobrescriben.
- Las acciones de revisión, aprobación y rechazo se registran con el rol activo como actor cuando no haya un empleado seleccionado, sin que ello habilite permisos distintos a los del rol.
- El Gerente de Operaciones puede exportar reportes e historial en modo solo lectura, pero no crear ni modificar registros.
