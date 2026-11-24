# Investigación: Módulo de Control de Calidad

**Actualizado**: 2026-11-24

**Alcance**: decisiones de implementación para US1–US15, derivadas de `spec.md` y de los contratos de la feature.

**Fuente canónica**: `spec.md`. La matriz de permisos canónica es `contracts/quality-permissions.md`; cualquier descripción dispersa debe interpretarse desde ese contrato.

## Decisiones y clarificaciones

### 1. Stack, proyecto único y persistencia

**Decision**: usar JavaScript ES2022, HTML semántico, el CSS existente, Vite, Vitest + jsdom y `localStorage`. El repositorio conserve un único proyecto Vite en la raíz, con `src/` y `tests/`.

**Rationale**: el módulo es una extensión del ERP base y ya existe infraestructura de build, pruebas y estilos. Cambiar de framework o separar paquetes añadiría configuración sin mejorar el alcance del MVP. Los datos se guardan como colecciones JSON con marcas temporales ISO; la evidencia se almacena como data URL base64.

**Alternatives considered**: framework de UI (React/Vue/Svelte), rechazado por reescritura y dependencias nuevas; backend con API, rechazado por estar fuera del MVP; IndexedDB, rechazado por añadir asincronía innecesaria para 500 registros; múltiples paquetes `frontend`/`backend`, rechazados por no existir servidor.

### 2. Permisos y rol activo

**Decision**: la fuente canónica es `contracts/quality-permissions.md`. El rol activo se persiste en `erp_quality:viewer_role` con valores `jefe_calidad`, `inspector` y `gerente`; si falta o es inválido se usa `jefe_calidad`. La matriz se evalúa con `can()`/`assertCan()` en UI y operaciones, y el cambio de rol emite `quality:role-changed` para recalcular vistas y formularios. El rol es un metadato de demostración: no crea cuentas, no autentica usuarios y no otorga permisos fuera de la matriz.

**Rationale**: una única matriz evita decisiones contradictorias entre vistas. Las acciones no permitidas se ocultan o deshabilitan con `data-permission`, y si se invocan por código se bloquean con un mensaje antes de mutar datos o escribir auditoría. El Inspector no ve el detalle individual de otros inspectores (`view_history_detail`) ni la bitácora (`view_audit`); ve KPIs agregados y su propio detalle. El Gerente tiene acceso de solo lectura y exportación: consulta dashboard, reportes, historial y bitácora, pero no crea, edita, elimina ni aprueba. La audiencia de auditoría usa el empleado seleccionado en la operación; solo si no existe se usa el rol activo como metadato.

**Alternatives considered**: comparar roles directamente en componentes, rechazado por duplicación y riesgo de inconsistencia; login simulado, rechazado por introducir sesiones no solicitadas; permisos solo en la UI sin revalidación en la operación, rechazado por permitir escrituras no autorizadas; usar el rol como credencial, rechazado porque no hay autenticación real.

### 3. Generación automática de no conformidad

**Decision**: la NC automática se genera SOLO cuando la revisión del Jefe emite `review_decision = rejected` con `overall_result = failed`, desde `pending_review` o desde el caso heredado `completed` condicional sin decisión, y no existe una NC asociada. Los overrides y cambios manuales posteriores sobre una inspección `completed`, incluido un cambio a `failed`, nunca generan NC. La guarda de criterios críticos fallidos o sin medición de FR-013/FR-014 bloquea aprobaciones como `passed`, pero por sí sola no crea NC.

**Rationale**: separar el disparador de la revisión formal evita duplicados y evita que una corrección posterior parezca una nueva detección. El borrador usa descripción autogenerada editable y obligatoria, producto del plan, lote del origen, tipo `other`, severidad `major` y estado `open`. La creación manual desde el formulario sigue siendo válida sin exigir una inspección reprobada.

**Alternatives considered**: generar NC desde `proposed_result = failed`, rechazado porque el dictamen propuesto no es definitivo; generar NC en cualquier `overall_result = failed`, rechazado porque incluiría overrides manuales; generar NC al detectar críticos fallidos, rechazado porque la guarda solo impide aprobar.

### 4. KPI de tasa de aprobación (FR-039)

**Decision**: `approval_rate = count(inspection_status = completed AND overall_result = passed) / count(inspection_status = completed AND overall_result IN (passed, conditional, failed))`, con valor 0 cuando el denominador es 0. `conditional` cuenta en el denominador pero no en el numerador; `draft`, `pending_review` y `overall_result = null` quedan excluidos.

**Rationale**: la tasa mide resultados finales, no trabajo en curso. Incluir `conditional` en el denominador refleja que la desviación no crítica reduce la tasa, mientras que excluir registros sin decisión evita contar inspecciones aún no liberadas. El denominador cero no debe producir `NaN` ni una cifra inventada.

**Alternatives considered**: contar `conditional` como aprobado, rechazado por contradecir FR-039; incluir `pending_review` en el denominador, rechazado porque no tiene resultado final; devolver 100 % sin resultados, rechazado por no tener origen en los registros.

### 5. Dashboard e inspecciones pendientes

**Decision**: el KPI `pending_inspections` del dashboard es `draft + pending_review`. Se excluye del conteo el caso heredado `completed` con resultado condicional y `review_decision = null`, que se gestiona en la bandeja de aprobaciones. `pending_review` se muestra como trabajo pendiente, no participa en KPIs de resultados ni libera el lote hasta estar `completed`.

**Rationale**: el dashboard y la bandeja responden preguntas distintas: el primero mide trabajo pendiente del flujo normal; la segunda agrupa todo lo que el Jefe debe decidir, incluida la excepción heredada. Evita contar dos veces el mismo registro y evita que un pendiente quede sin pantalla de revisión.

**Alternatives considered**: sumar el caso heredado al KPI, rechazado por duplicar la bandeja y alterar FR-020; ocultar `draft`, rechazado porque el lote sigue pendiente; tratar `pending_review` como resultado final, rechazado porque aún no hay `review_decision`.

### 6. Auditoría y bitácora

**Decision**: el envío a revisión registra una entrada `status_change` con `changed_field = status`, o `inspection_status` para inspecciones, con estado anterior y nuevo. La decisión final registra una sola entrada `approve` o `reject` con `changed_field = overall_result`, `before_value`, `after_value`, actor, marca temporal ISO y justificación cuando corresponda; `after_value` incluye `overall_result`, `review_decision`, `reviewed_by` y `reviewed_at`. No se generan entradas `update` ni `status_change` duplicadas por el paso a `completed`. Un override posterior genera una sola `status_change` sobre `overall_result`. Una acción rechazada por permisos no cambia el estado y no genera auditoría. Las entradas persisten tras eliminaciones permitidas y conservan `reference_module` + `reference_id` para seguir filtrando por lote aunque el registro ya no exista.

**Rationale**: el contrato único de revisión y auditoría de `spec.md` exige trazabilidad sin ruido. Una sola entrada por decisión permite reconstruir quién decidió, cuándo y por qué, sin confundir el cambio de estado con el dictamen. Conservar el lote en la entrada mantiene el filtro de bitácora útil tras borrados y cascadas.

**Alternatives considered**: registrar `update` + `status_change` para la misma decisión, rechazado por duplicidad; auditar cada apertura de detalle, rechazado por volumen innecesario; guardar solo el último estado, rechazado porque impide reconstruir la historia; auditar intentos denegados, rechazado porque no hubo cambio.

### 7. Estados legacy y excepción completada condicional

**Decision**: una inspección `completed` con `review_decision = null` y `overall_result != conditional` es legado final: no entra en bandeja y se contabiliza por su `overall_result` conservado. Una inspección `completed` condicional sin decisión entra en la bandeja del Jefe, conserva su estado `completed` y no retrocede a `pending_review`; al registrar cualquier `review_decision` sale de la bandeja, incluso si el resultado final sigue siendo `conditional`. Las inspecciones con `overall_result = null` se excluyen de KPI. Los estados legados de planes, listas y documentos se normalizan: `active → approved`, `under_review → pending_review`, `archived` se conserva como legado no seleccionable; los planes sin estado pasan a `approved`.

**Rationale**: no se puede inventar una revisión ni un cierre aprobado para datos migrados. Diferenciar el caso condicional sin decisión de los legados finales evita pendientes fantasma y mantiene la tasa de aprobación basada en resultados reales conservados.

**Alternatives considered**: enviar todo `completed` sin revisión a bandeja, rechazado por crear pendientes inexistentes; forzar `pending_review`, rechazado porque altera datos históricos; excluir todos los legados del KPI, rechazado porque descarta resultados finales válidos.

### 8. Migración idempotente

**Decision**: `quality-migrations.js` ejecuta una normalización idempotente antes de renderizar cualquier bandeja o vista dependiente de estados migrados. La migración marca `legacy_completed` cuando corresponda, conserva criterios, evaluaciones, archivos, evidencia y auditoría, y no duplica entradas al repetirse. Las CAPA `completed` sin cierre pasan a `closure_status = pending` para revisión explícita.

**Rationale**: una bandeja renderizada antes de migrar puede omitir registros con estados antiguos. La idempotencia protege recargas y evita que la migración se convierta en una fuente de datos duplicados.

**Alternatives considered**: migrar bajo demanda al abrir cada bandeja, rechazado por riesgo de omisiones; migrar en cada guardado, rechazado porque no cubre la primera carga; convertir legados en revisiones nuevas, rechazado por falsar la auditoría.

### 9. CAPA, cierre y eficacia

**Decision**: `status` (`pending`, `in_progress`, `completed`) y `closure_status` (`pending`, `approved`, `rejected`) son independientes. `completed` significa ejecución reportada, no cierre aprobado. Solo el Jefe aprueba o rechaza el cierre, y la aprobación exige una revisión de eficacia previa registrada como `effective` o `not_effective` con observaciones. Un rechazo fija `closure_status = rejected`, devuelve `status = in_progress` y exige nueva ejecución. La NC puede cerrarse sin exigir que sus CAPA tengan cierre aprobado; la cuarentena desaparece cuando sus NC pasan a `closed`.

**Rationale**: separar ejecución de cierre evita que una acción marcada por el responsable parezca validada. La eficacia es la evidencia de que la acción resolvió la desviación; exigirla antes de aprobar evita cierres sin sustento. El cierre de NC y el cierre de CAPA son decisiones distintas según FR-035.

**Alternatives considered**: aprobar cierre automáticamente al marcar `completed`, rechazado por eliminar la revisión del Jefe; permitir al Inspector aprobar su propia CAPA, rechazado por violar la matriz; exigir CAPA aprobada para cerrar la NC, rechazado por contradecir FR-035.

### 10. Diseño visual, menú, dashboard, tokens y tablas

**Decision**: se conservan las etiquetas de estado aprobado y se añaden etiquetas secundarias de resultado "Aprobado", "Condicional" y "Reprobado"; `approved_conditional` mantiene la etiqueta de estado "Aprobado" y muestra "Condicional" como resultado. El menú lateral usa exactamente 5 categorías —GENERAL, GESTIÓN DE CALIDAD, DOCUMENTACIÓN, ANÁLISIS y ADMINISTRACIÓN— y 12 entradas con IDs exactos: `quality-dashboard`, `quality-search`, `quality-plans`, `quality-checklists`, `quality-inspections`, `quality-non-conformances`, `quality-capa`, `quality-documents`, `quality-approvals`, `quality-reports`, `quality-entities` y `quality-settings`. No existen alias independientes "Panel", "Dashboard" ni `quality-panel`; la entrada única es "Inicio / Dashboard". El dashboard sigue la matriz exacta: encabezado de bienvenida, tarjetas de los KPIs de FR-020, inspecciones pendientes, dictámenes finales, NC abiertas, CAPA pendientes o vencidas, documentos pendientes, gráficos derivados, últimas 8 entradas de `quality_audit_log`, accesos rápidos por rol y alertas activas, sin duplicados ni cifras sin origen. Los tokens son exactos: `surface #ffffff`, `background #f2f4f8`, `text #17233b`, `text-muted #475569`, `border #dde3ec`, `primary #1e40af`, `interaction/foco #2563eb`, `approved #166534` sobre `#dcfce7`, `pending #92400e` sobre `#fef3c7`, `rejected #b91c1c` sobre `#fee2e2`, radios de `10 px` y `8 px`, espaciado múltiplo de `4 px`, tipografía `system-ui` `14 px/1.5` e iconos SVG `18 px` con `stroke-width: 1.8`. Toda tabla muestra encabezados, filtros, estados y una sola zona de acciones; el buscador aplica solo al conjunto ya cargado y filtrado de la vista activa, por coincidencia insensible a mayúsculas sobre columnas visibles, sin consultar otras colecciones ni crear resultados.

**Rationale**: US15, FR-068–FR-083 y SC-028–SC-040 son obligatorios y verificables. Diferenciar estado de resultado evita confundir `approved_conditional` con un rechazo. Un menú con destinos únicos conserva funcionalidad sin duplicar acciones. La matriz del dashboard y los tokens exactos permiten verificar estilos calculados y ausencia de indicadores duplicados. La búsqueda sobre el conjunto filtrado mantiene el comportamiento predecible y evita resultados huérfanos.

**Alternatives considered**: usar solo color para estados, rechazado por FR-070 y accesibilidad; duplicar "Panel" y "Dashboard", rechazado por SC-034; añadir tarjetas decorativas o KPIs inventados, rechazado por SC-035; buscar en todas las colecciones, rechazado por cambiar el conjunto de resultados de la vista; sustituir tokens por valores aproximados, rechazado por SC-036.

### 11. Responsive y accesibilidad

**Decision**: las 15 pantallas se verifican a 1024 px, 768 px y 360 px sin desplazamiento horizontal de toda la página. Tablas y formularios se reorganizan en bloques o expansiones controladas, conservando encabezado, navegación, acciones principales y columnas o datos clave. Se exige contraste WCAG 2.1 AA de 4.5:1 para texto normal y 3:1 para texto grande y componentes interactivos, foco visible de 2 px con offset de 2 px, orden de tabulación lógico y etiquetas legibles. Todo estado, severidad y resultado incluye texto, con color o icono como refuerzo.

**Rationale**: la constitución hace obligatoria la accesibilidad y US15 exige que la información sea comprensible sin depender del color. Los tres anchos cubren escritorio, tablet y móvil; conservar columnas clave evita perder funcionalidad al compactar tablas.

**Alternatives considered**: ocultar columnas sin expansión, rechazado por pérdida de información; permitir scroll horizontal global, rechazado por SC-032; verificar solo escritorio, rechazado por no cumplir FR-075.

### 12. Versionado e integridad

**Decision**: planes, listas y documentos comparten `version`, `version_group_id` y `version_of`. La primera versión usa `version = 1`, `version_group_id = id` y `version_of = null`; una nueva versión incrementa `version`, conserva el grupo y apunta a la versión anterior, en estado `draft`. Editar un borrador no incrementa la versión. Un artefacto `approved` con historial no se edita ni elimina en la misma versión; se duplica. Una inspección con NC no se elimina; sin NC elimina resultados y evidencia en cascada; una NC elimina sus CAPA y evidencia en cascada; una CAPA elimina su evidencia en cascada y conserva su entrada `delete`.

**Rationale**: el modelo mínimo cubre trazabilidad y auditoría sin crear un repositorio de versiones. La inmutabilidad de aprobados protege el historial usado por inspecciones y auditorías.

**Alternatives considered**: historial embebido en el registro, rechazado por difícil consulta; versionado por fecha, rechazado por no expresar orden ni padre; diff visual, rechazado por fuera de alcance.

### 13. Evidencia y cuota

**Decision**: la evidencia de calidad admite `image/png`, `image/jpeg` y `application/pdf`, con máximo de 5 MB por archivo y 8 MB acumulados en `localStorage`. Se guarda como data URL base64 con nombre, tipo, tamaño, autor y fecha, y se vincula a inspección, NC, CAPA o documento. Una carga que exceda tipo, tamaño, acumulado o cuota se rechaza completa y conserva la evidencia previa mediante manejo de `QuotaExceededError`. El archivo principal del documento conserva su límite existente de 10 MB.

**Rationale**: no hay backend de archivos, por lo que la validación previa es la única defensa contra pérdidas. La distinción entre archivo principal y evidencia adicional respeta el comportamiento ya implementado del administrador documental.

**Alternatives considered**: almacenar solo metadatos, rechazado porque exige descarga; aumentar la cuota sin validar, rechazado porque no resuelve `QuotaExceededError`; IndexedDB, rechazado por complejidad adicional.

### 14. Pruebas y verificación

**Decision**: las pruebas unitarias cubren matriz de permisos, transiciones de estados, migración idempotente, motor de inspección, KPI, auditoría y eficacia CAPA. Las pruebas de integración cubren cada flujo y la visibilidad de acciones por rol. US15 se verifica con recorridos de 15 pantallas × 3 roles × anchos 1024/768/360 px, registrados en `quality-visual-matrix.test.js` con apoyo de pruebas de consistencia y responsive. SC-001, SC-006, SC-010, SC-012 y SC-016 usan instrumentación de tiempo; SC-008 y SC-024 se verifican con lista de cotejo y resultados anónimos de demo porque no son aserciones automatizables. Toda entrega exige pruebas en verde, verificación de UX y documentación actualizada, además de `npm run lint` y `npm run format:check`.

**Rationale**: la constitución exige test-first y verificación explícita de UX y rendimiento. Permisos, estados y migración son las zonas con mayor riesgo de regresión; la matriz visual evita que US15 quede solo como documentación.

**Alternatives considered**: pruebas solo al final, rechazado por incumplir Test-First; verificación visual manual única, rechazado por no ser repetible; asumir rendimiento sin instrumentación, rechazado por no poder demostrar los objetivos.

### 15. Decisiones de no implementación

**Decision**: no se implementa backend, API, autenticación real, base de datos relacional, comparación de versiones (diff) ni notificaciones externas. Las alertas son informativas y locales; no bloquean operaciones ni generan NC. Tampoco se crean productos, empleados ni documentos origen desde este módulo, y no se integran dispositivos IoT ni gestores documentales externos.

**Rationale**: estos elementos están expresamente fuera de alcance en `spec.md`. Mantenerlos fuera evita introducir dependencias, sesiones, despliegue y flujos que el MVP no necesita y que contradecirían la persistencia local.

**Alternatives considered**: añadir una API ligera, rechazada porque exigiría autenticación y despliegue; usar una base de datos embebida, rechazada porque duplicaría `localStorage`; implementar diff o notificaciones, rechazados por estar fuera de alcance.

## Resolución de hallazgos del análisis

| Hallazgo | Resolución | Decisión aplicada |
|---|---|---|
| N-01: el plan declaraba PASS con tareas pendientes | El Constitution Check declara PASS solo como gate de planificación y establece NO PASS como estado de entrega mientras haya tareas pendientes. | Apartado "Resultado del gate" de `plan.md`; sección 14 de este documento; las tareas quedan para `/speckit.tasks`. |
| N-02: US15 y el sistema visual no se transfirieron a plan/tareas | `plan.md` incluye trazabilidad US15, módulos visuales, pruebas nuevas y el recorrido 15 pantallas × 3 roles × 3 anchos; `research.md` fija menú, dashboard, tokens, columnas, bandejas, responsive y accesibilidad. | Secciones 10, 11 y 14; `tasks.md` no se modifica aquí y debe regenerarse con `/speckit.tasks`. |
| I-01: T028 usa un trigger de NC obsoleto | La generación automática de NC se define solo para `review_decision = rejected` (`overall_result = failed`) en revisión formal; los overrides no generan NC. | Sección 3; el texto histórico de `tasks.md` permanece intacto en esta entrega. |
| C-01: FR/SC visuales sin tareas | Los requisitos FR-068–FR-083 y SC-028–SC-040 se traducen en componentes, pruebas y método de verificación dentro del plan; la ejecución de tareas se deriva en `/speckit.tasks`. | Secciones 10, 11 y 14; árbol de `src/components/` y `tests/` de `plan.md`. |
