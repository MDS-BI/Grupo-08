# Inicio Rápido: Módulo de Control de Calidad

**Actualizado:** 2026-11-24
**Uso:** guía de validación manual después de implementar el plan. No sustituye las pruebas automatizadas.
**Fuente canónica:** [spec.md](spec.md), especialmente glosario, contratos canónicos, US15, FR-001–FR-083 y SC-001–SC-040.

## 1. Configuración

1. Instala dependencias con `npm install`.
2. Inicia el servidor con `npm run dev`.
3. Abre la URL local de Vite, por defecto `http://localhost:5173`.
4. Si necesitas datos limpios, borra las claves `erp_quality:*` en DevTools o usa la acción de limpieza de demo del Jefe de Calidad.
5. Confirma que `migrateQualityData()` se ejecuta antes de mostrar bandejas o vistas con estados migrados.
6. Para la verificación automatizada, ejecuta `npm test` y `npm run lint`. Esta guía no ejecuta esos comandos por ti.

**Datos semilla esperados:** productos, empleados, recepciones, órdenes de producción y despachos; planes, listas, documentos, inspecciones, NC, CAPA, evidencia, reglas de alerta y auditoría de ejemplo.

## 2. Roles de prueba

Cambia el selector "Rol de uso" del dashboard. El valor se guarda en `erp_quality:viewer_role`; si falta o es inválido, el rol inicial es `jefe_calidad`. El indicador de rol debe estar visible en todas las pantallas y no constituye autenticación real.

| Rol | Uso esperado |
|---|---|
| `jefe_calidad` | Ve todo el detalle, bandejas y bitácora; crea, aprueba, rechaza, revisa, overridea, cierra CAPA y configura alertas. |
| `inspector` | Ejecuta inspecciones, adjunta evidencia, crea NC, propone y ejecuta CAPA, y ve solo el resultado de sus propias inspecciones. No ve bitácora, bandejas de aprobación ni detalle individual de otros inspectores. |
| `gerente` | Consulta dashboard, historial, cuarentena, CAPA y bitácora en modo solo lectura; exporta reportes e historial. No crea, edita, elimina ni aprueba. |

Toda acción pasa por `can()`/`assertCan()`. La interfaz oculta o deshabilita con `data-permission`; si se invoca una acción bloqueada, aparece el mensaje del permiso requerido, el registro no cambia y no se escribe auditoría.

## 3. Escenario A: plan, lista y documento aprobados

1. Como `jefe_calidad`, crea un plan con producto, etapa y campos obligatorios. Sin criterios no puede enviarse a aprobación.
2. Envía el plan a `pending_approval`; verifica que aparece en la bandeja de planes y listas.
3. Apruébalo; confirma que solo ahora se ofrece en el formulario de inspección.
4. Repite con una lista de verificación: `draft → pending_approval → approved`. Comprueba que solo `approved` se ofrece para ejecutar inspecciones.
5. Rechaza otra lista con justificación; edítala y confirma que vuelve a `draft`, conserva el motivo y requiere nuevo envío.
6. Como `inspector`, crea un documento con código, nombre, categoría, responsable y archivo principal válido de hasta 10 MB.
7. Edita el borrador; verifica que sigue en `draft` y que `version` no cambia.
8. Envía a revisión; debe aparecer en la bandeja de documentos del Jefe. Previsualiza y aprueba como `jefe_calidad`.
9. Intenta editar el aprobado; debe bloquear y ofrecer nueva versión.
10. Como `inspector`, intenta aprobar/rechazar; la acción no debe estar disponible. Como `gerente`, confirma modo solo lectura.

## 4. Escenario B: inspección normal y pending KPI

1. Como `inspector`, abre **Lotes pendientes** y usa "Inspeccionar". Si ya existe borrador para el mismo origen y plan, se reanuda sin duplicar.
2. Selecciona un plan y una lista `approved` cuyo producto y etapa coincidan con el origen. Los estados `draft`, `pending_approval`, `rejected` y `archived` no deben aparecer.
3. Deja una medición vacía, no numérica, `NaN` o `Infinity`: el envío permanece deshabilitado y la inspección sigue en `draft` sin `proposed_result`.
4. Completa todas las mediciones y adjunta evidencia válida. Comprueba que un valor exactamente en el límite de tolerancia se considera cumplido.
5. Envía a revisión. Verifica:
   - `inspection_status = pending_review`;
   - `proposed_result` calculado;
   - `overall_result = null` y `review_decision = null`;
   - el lote sigue pendiente;
   - la inspección cuenta en `pending_inspections`, pero no en `approval_rate` ni en ningún KPI de resultados.
6. Como `jefe_calidad`, abre la bandeja y revisa criterios, mediciones, propuesto, evidencia y NC antes de decidir.
7. Aprueba una inspección sin críticos fallidos: queda `completed`, `review_decision = approved`, `overall_result = passed`.
8. Aprueba condicionalmente una con solo desviaciones no críticas: queda `completed`, `review_decision = approved_conditional`, `overall_result = conditional`, con justificación. Visualmente el estado dice "Aprobado" y el resultado "Condicional".
9. Prueba `approved` con propuesto `conditional`, sin críticos y con justificación: se permite y el resultado es `passed`.
10. Intenta aprobar con críticos fallidos o medición faltante, incluso con justificación: debe bloquearse. La guarda no crea NC.
11. Rechaza una inspección con justificación: queda `completed`, `review_decision = rejected`, `overall_result = failed`, con borrador de NC si no existía.
12. Como `inspector` o `gerente`, intenta revisar: la acción debe estar bloqueada y se explica que corresponde al Jefe.

## 5. Escenario C: NC automática, override y legado

1. Verifica que el rechazo desde `pending_review` crea una NC con descripción autogenerada y editable, producto y lote del origen, `defect_type = other`, `severity = major` y `status = open`.
2. Repite el rechazo sobre una inspección que ya tiene NC: no debe crear una segunda NC.
3. Confirma que `approved`, `approved_conditional`, una condicional sin decisión y la guarda de críticos no crean NC.
4. Como `jefe_calidad`, cambia el dictamen de una inspección `completed` a `failed` con justificación: conserva `completed`, registra una sola `status_change` sobre `overall_result` y no genera NC.
5. Carga datos legados con una inspección `completed`, `proposed_result = conditional` y `review_decision = null`:
   - aparece en la bandeja de revisiones;
   - conserva `inspection_status = completed`;
   - no cuenta en `pending_inspections`;
   - no genera NC;
   - al registrar `approved`, `approved_conditional` o `rejected`, sale de la bandeja, aunque el resultado siga siendo `conditional`.
6. Carga un legado `completed` con `review_decision = null` y resultado distinto de `conditional`: no va a bandeja, es final y cuenta por su `overall_result` conservado.
7. Carga un legado con `overall_result = null`: confirma que se excluye de KPIs y que no se le asigna un resultado inventado.
8. Recarga la aplicación: la migración no duplica ni omite registros.

## 6. Escenario D: dashboard y KPI

1. Con inspecciones `passed`, `conditional`, `failed`, `pending_review`, `draft` y legadas, abre el dashboard con los tres roles.
2. Verifica `approval_rate` por etapa: `count(completed && passed) / count(completed && overall_result IN (passed, conditional, failed))`, con 0 si el denominador es 0. `conditional` debe estar en el denominador y no en el numerador.
3. Verifica `pending_inspections = draft + pending_review`. El legado condicional en bandeja no debe sumar aquí.
4. Comprueba que `pending_review` no libera lote ni participa en resultados finales.
5. Verifica NC abiertas por severidad de `open` y `under_review`; CAPA vencidas con `due_date < hoy` y `closure_status != approved`; eficacia como cierres aprobados efectivos sobre cierres aprobados, con 0 si no hay cierres aprobados.
6. Confirma que los KPI agregados son visibles para los tres roles, pero el detalle individual por inspector solo lo ve `jefe_calidad`.
7. Comprueba que `actividad reciente` muestra las últimas 8 entradas de `quality_audit_log` ordenadas por `timestamp` descendente, sin crear entidad nueva.
8. Aplica una regla de alerta que incumpla su umbral: debe informar indicador, valor actual, umbral y severidad textual, sin bloquear ni generar NC.

## 7. Escenario E: CAPA, cierre y cuarentena

1. Desde una NC, crea una CAPA con responsable, descripción, causa raíz, tipo (`resampling`, `rework` u `other`) y fecha límite. Sin esos datos se rechaza.
2. Como `inspector`, reporta ejecución y marca `status = completed`; debe quedar `closure_status = pending` y aparecer en la bandeja de cierres.
3. Como `jefe_calidad`, intenta aprobar sin eficacia: debe bloquearse.
4. Registra `effective` o `not_effective` con observaciones. Confirma que la revisión de eficacia es una entrada `review` separada de la decisión de cierre.
5. Rechaza un cierre con justificación: `closure_status = rejected` y `status = in_progress`. No debe existir una segunda `status_change` por volver a `in_progress`.
6. Completa de nuevo, registra eficacia y aprueba el cierre: deja de contarse como vencida.
7. Cierra la NC sin exigir CAPA aprobada; el lote debe salir de cuarentena.
8. Verifica cuarentena derivada: lote con NC `open` o `under_review` aparece; con CAPA se muestra "Cuarentena - En tratamiento"; con NC `closed` desaparece.
9. Como `inspector` o `gerente`, intenta aprobar un cierre: la acción no está disponible y se informa que corresponde al Jefe.

## 8. Escenario F: auditoría

1. Realiza altas, ediciones, envíos, aprobaciones, rechazos, eficacia CAPA, overrides y una eliminación permitida.
2. Abre la bitácora y filtra por lote, entidad y rango de fechas. Prueba un rango `desde > hasta`: debe mostrar error sin cambiar la vista.
3. Confirma que cada envío registra una `status_change` con `changed_field = status` o `inspection_status`.
4. Confirma que cada decisión final de inspección tiene una sola entrada `approve`/`reject` con `changed_field = overall_result`. El valor nuevo debe incluir `overall_result`, `review_decision`, `reviewed_by`, `reviewed_at` y justificación cuando corresponda.
5. Verifica que no existe una segunda `update` ni un `status_change` adicional por pasar la inspección a `completed`.
6. Verifica que el override genera una sola `status_change` sobre `overall_result`.
7. Comprueba que la eficacia CAPA usa `review` y que la decisión de cierre usa una sola `approve`/`reject` sobre `closure_status`.
8. En `create`, confirma `before_value = null` y `after_value =` estado inicial. En `delete`, confirma `before_value =` último valor y `after_value = null`.
9. Tras eliminar un registro permitido, la entrada `delete` debe permanecer y el filtro por lote debe seguir funcionando.
10. Intenta una acción sin permiso: no cambia el estado y no aparece ninguna entrada nueva.
11. Como `inspector`, confirma que no ve la bitácora; como `gerente`, que solo la consulta.

## 9. Escenario G: evidencia extendida

1. Adjunta PNG, JPG y PDF válidos a inspección, NC, CAPA y documento. Cada evidencia debe conservar nombre, tipo, tamaño, autor, fecha, vista previa, descarga y vínculo.
2. Intenta adjuntar otro tipo de archivo o un archivo mayor a 5 MB: debe rechazarse con el motivo.
3. Supera 8 MB acumulados o la cuota de `localStorage`: debe rechazarse sin perder la evidencia ya almacenada.
4. Confirma que el archivo principal del documento conserva su validación y límite de 10 MB, distinto de la cuota de evidencia.
5. Elimina una inspección sin NC: sus resultados y evidencia se eliminan en cascada y queda `delete`.
6. Intenta eliminar una inspección con NC: debe bloquearse y conservar evidencia.
7. Elimina una NC: CAPA y evidencia se eliminan en cascada; elimina una CAPA directamente y confirma que su entrada `delete` permanece.

## 10. Escenario H: permisos e interacción

1. Cambia de rol con una vista o formulario abierto: indicador, acciones y contenido sensible al rol se recalculan sin conservar permisos anteriores.
2. Revisa que cada control tiene `data-permission`; las acciones no permitidas están ocultas o deshabilitadas con `aria-disabled` y mensaje.
3. Invoca una acción bloqueada por código: debe lanzar `PERMISSION_DENIED`, sin persistencia ni auditoría.
4. Confirma que el Inspector no ve detalle individual de otros inspectores ni bitácora, pero sí su propio resultado completado.
5. Confirma que el Gerente ve "Modo solo lectura", KPI, reportes, historial, cuarentena, CAPA y bitácora, sin controles de escritura.
6. Comprueba que cada operación importante muestra carga o acciones deshabilitadas y termina con confirmación o error, sin recargar la página.
7. Verifica que los errores de validación aparecen junto al campo y en un resumen, sin perder los datos ingresados.

## 11. Escenario I: diseño visual US15

US15 no crea entidades: verifica presentación, no persistencia adicional.

### 11.1 Recorrido obligatorio

Recorre las 15 pantallas con los tres roles y los tres anchos `1024 px`, `768 px` y `360 px`:

1. Dashboard
2. Lotes pendientes
3. Planes y criterios
4. Listas de verificación
5. Documentos
6. Ejecución de inspección
7. Revisión de inspecciones
8. Aprobaciones pendientes
9. No conformidades
10. CAPA
11. Cuarentena
12. Historial
13. Bitácora
14. Exportación
15. Alertas

En cada combinación pantalla/rol/ancho comprueba título, descripción breve, indicador de rol, navegación, una sola acción principal, acciones secundarias coherentes, sin desplazamiento horizontal de toda la página, tablas/formularios reorganizados y columnas o datos clave accesibles.

### 11.2 Menú lateral

Verifica cinco categorías y 12 entradas únicas, sin alias "Panel", "Dashboard" ni `quality-panel`, con la sección activa resaltada por texto y `aria-current`:

| Categoría | Entrada | ID exacto |
|---|---|---|
| GENERAL | Inicio / Dashboard | `quality-dashboard` |
| GENERAL | Búsqueda | `quality-search` |
| GESTIÓN DE CALIDAD | Planes de calidad | `quality-plans` |
| GESTIÓN DE CALIDAD | Listas de verificación | `quality-checklists` |
| GESTIÓN DE CALIDAD | Inspecciones | `quality-inspections` |
| GESTIÓN DE CALIDAD | No conformidades | `quality-non-conformances` |
| GESTIÓN DE CALIDAD | Acciones CAPA | `quality-capa` |
| DOCUMENTACIÓN | Documentos | `quality-documents` |
| DOCUMENTACIÓN | Aprobaciones pendientes | `quality-approvals` |
| ANÁLISIS | Reportes | `quality-reports` |
| ADMINISTRACIÓN | Entidades | `quality-entities` |
| ADMINISTRACIÓN | Configuración | `quality-settings` |

Confirma que todas las funciones previas siguen accesibles desde el menú o desde un acceso rápido equivalente.

### 11.3 Dashboard exacto

El dashboard debe contener exactamente estos elementos, sin tarjetas decorativas, indicadores duplicados ni cifras sin origen:

- Encabezado de bienvenida con rol activo.
- Tarjetas de tasa de aprobación, NC abiertas, CAPA vencidas, eficacia CAPA e inspecciones pendientes.
- Inspecciones pendientes y dictámenes finales separados.
- No conformidades abiertas por severidad.
- CAPA pendientes o vencidas y documentos pendientes.
- Gráficos derivados de resultados y Pareto.
- Actividad reciente con las últimas 8 entradas de auditoría.
- Accesos rápidos por rol y alertas con umbral y severidad textuales.

Accesos rápidos esperados: Jefe a Aprobaciones pendientes, Revisión de inspecciones, Cierres CAPA y Reportes; Inspector a Lotes pendientes, Ejecución de inspección, Listas aprobadas y Registro de NC/CAPA; Gerente a Dashboard, Historial, Reportes y Bitácora en solo lectura.

### 11.4 Tokens y etiquetas

Verifica estilos calculados exactos:

| Token | Valor |
|---|---|
| `surface` | `#ffffff` |
| `background` | `#f2f4f8` |
| `text` | `#17233b` |
| `text-muted` | `#475569` |
| `border` | `#dde3ec` |
| `primary` | `#1e40af` |
| `interaction` | `#2563eb` |
| `approved` | `#166534` sobre `#dcfce7` |
| `pending` | `#92400e` sobre `#fef3c7` |
| `rejected` | `#b91c1c` sobre `#fee2e2` |
| `radius-card` | `10 px` |
| `radius-control` | `8 px` |
| `space-unit` | `4 px` |
| `typography` | `system-ui`, cuerpo `14 px/1.5` |
| `icon` | SVG `18 px`, `stroke-width: 1.8` |
| foco | `2 px` con offset de `2 px` |

Verifica etiquetas textuales exactas "Borrador", "Pendiente", "Aprobado", "Rechazado" y "Vencido", reforzadas con color o icono. En resultados usa "Aprobado", "Condicional" y "Reprobado"; `approved_conditional` conserva el estado "Aprobado" y muestra el resultado "Condicional". El color nunca es el único indicador y las listas con más de dos estados incluyen leyenda o etiquetas autoexplicativas.

### 11.5 Columnas, búsqueda, estados y accesibilidad

Comprueba columnas o datos clave por pantalla según la matriz del spec: lote/producto/fecha/estado en lotes; esperado/tolerancia/medido/resultado en ejecución; propuesto/final/revisor/fecha/justificación en revisión; severidad/estado/lote/responsable en NC; NC/responsable/estado/`closure_status`/vencimiento/eficacia en CAPA; lote/fecha/inspector/plan/etapa/dictamen/estado/resultados en historial; fecha/actor/entidad/acción/lote/campo/anterior/nuevo/justificación en bitácora.

Aplica un filtro y luego busca un término presente solo fuera del conjunto filtrado: no debe aparecer. El buscador solo filtra el conjunto ya cargado y filtrado de la vista activa, con coincidencia insensible a mayúsculas sobre columnas visibles.

Comprueba además:

- estado vacío con texto explicativo y acción contextual en cada bandeja y listado;
- estado de carga o acciones deshabilitadas desde el inicio de guardar, enviar, aprobar, eliminar, exportar o revisar;
- orden de tabulación lógico, foco visible y etiquetas legibles;
- contraste WCAG 2.1 AA de al menos 4.5:1 para texto normal y 3:1 para texto grande y componentes interactivos;
- formularios extensos con campos esenciales primero y revelación progresiva;
- ningún botón sin acción ni elemento decorativo sin utilidad.

### 11.6 Estados de carga y acciones deshabilitadas (T118)

Comprueba este comportamiento al guardar borrador, completar o enviar una inspección, aprobar, rechazar, eliminar, exportar, cargar evidencia y revisar cierres CAPA:

1. Desde el primer instante de la operación, con objetivo no mayor a 300 ms (FR-072), la acción queda deshabilitada con `aria-disabled`/`data-permission` o aparece texto e icono de carga. No hay operaciones silenciosas.
2. El estado de carga se mantiene hasta la resolución: el registro cambia y aparece el mensaje de confirmación o el error comprensible, sin recargar la página (SC-025, SC-030).
3. Si falla, la acción se habilita de nuevo, no se persiste el cambio y se conservan los datos ingresados; los errores aparecen junto al campo y en un resumen (sección 10, punto 7).
4. Si la operación está bloqueada por permiso, se informa el permiso requerido, no cambia el estado y no se escribe auditoría.
5. Cambiar de rol con una vista o formulario abierto recalcula indicador, contenido y acciones: no quedan botones habilitados del rol anterior (FR-066).
6. Repite la comprobación con los tres roles y los tres anchos: el indicador de carga no desplaza la página ni oculta el foco visible.

### 11.7 Recorrido funcional manual con `npm run dev` (T054)

Ejecuta este recorrido contra la aplicación en vivo. Complementa, no sustituye, los escenarios A–I ni las pruebas automáticas:

1. Ejecuta `npm run dev` (tras `npm install` si aplica), abre `http://localhost:5173` y confirma la migración idempotente de la sección 1.
2. Como `jefe_calidad`, recorre las 12 entradas de la sección 11.2: cada ID abre su pantalla, la sección activa queda resaltada y no aparecen alias "Panel", "Dashboard" ni `quality-panel`.
3. En **Inicio / Dashboard** verifica los elementos exactos de 11.3, los accesos rápidos del Jefe y la exportación de KPIs a CSV.
4. Crea y aprueba un plan y una lista, y aprueba un documento (escenario A); confirma que solo las versiones `approved` se ofrecen en la ejecución.
5. En **Lotes pendientes** ejecuta una inspección con mediciones y evidencia válida, y envíala a revisión (escenario B); aplica la comprobación de carga de 11.6.
6. En **Aprobaciones pendientes**, como Jefe, revisa y emite `approved`, `approved_conditional` y `rejected`; comprueba que el legado condicional sin decisión sale de la bandeja sin retroceder a `pending_review` (escenarios B y C).
7. Recorre **No conformidades**, **CAPA** y **Cuarentena**: NC automática, cierre con eficacia, rechazo de cierre y salida del lote de cuarentena (escenario E).
8. En **Historial** aplica filtros de lote y fechas, busca sobre el conjunto filtrado, exporta el CSV con la columna `resultados` y abre la **Bitácora** (escenarios D y F).
9. Usa **Búsqueda**, **Reportes**, **Entidades** y **Configuración**: comprueba que derivan de datos existentes; en Configuración crea, desactiva y elimina una regla de alerta, y verifica en **Alertas** del dashboard que solo se muestran las activas que incumplen su umbral.
10. Cambia a `inspector` y luego a `gerente` con una vista abierta: confirma la matriz visual de 11.4/11.5, el mensaje de permiso y el modo solo lectura del Gerente (escenario H).
11. Repite los pasos 2–10 en `1024 px`, `768 px` y `360 px`: sin desplazamiento horizontal de toda la página, columnas o datos clave accesibles, foco visible y contraste AA (11.1 y 11.5).
12. Anota cada desviación con pantalla, rol, ancho e ID de menú; corrígela y vuelve a ejecutar el recorrido antes de declarar completada la validación.

## 12. Validación de rendimiento (T051, T082, T139)

Preparación: genera hasta **500 inspecciones** semilla en `erp_quality:quality_inspections` (con resultados, planes y lotes válidos), guarda una copia del `localStorage` original y restaura los datos al terminar. Repite cada medición sobre el mismo conjunto.

La instrumentación de T139 registra el tiempo transcurrido en estas pruebas de integración; ejecútalas con `npx vitest run` y anota el valor medido. No se promedian mediciones para ocultar un caso que supere el umbral:

| Criterio | Instrumentación (T139) | Umbral |
| :--- | :--- | :--- |
| SC-001, inspección de hasta 10 criterios | `tests/integration/inspection-flow.test.js` | < 3 min desde seleccionar el origen hasta guardar el dictamen. |
| SC-006, búsqueda en historial con filtros de lote y fechas | `tests/integration/inspection-history.test.js` | < 1 s percibido. |
| SC-010, consultas y dashboard con 500 inspecciones | `tests/integration/quality-dashboard.test.js` | < 2 s. |
| SC-012, exportación del historial filtrado | `tests/integration/quality-export.test.js` | < 2 s y 100 % de respeto de los filtros. |
| SC-016, consulta filtrada de bitácora | `tests/integration/quality-audit-log.test.js` | < 2 s y sin entradas duplicadas. |

Comprobación manual complementaria con `npm run dev`:

1. Con las 500 inspecciones cargadas, marca el inicio en consola (`performance.mark('inicio')`), abre el dashboard y mide hasta que KPIs y actividad reciente estén visibles: < 2 s (SC-010).
2. En Historial aplica filtros de lote y fechas y busca un término presente solo en el conjunto filtrado: < 1 s (SC-006); el buscador no consulta otras colecciones.
3. Exporta el CSV con los filtros activos: < 2 s (SC-012) y comprueba que la columna `resultados` contiene solo las filas filtradas.
4. Filtra la bitácora por lote, entidad y rango de fechas: < 2 s (SC-016).
5. Registra cada resultado con la plantilla `Criterio | Inspecciones | Tiempo medido | Umbral | Resultado`. Si alguna medición supera el umbral, la validación no pasa.

## 13. Criterios de demo no automatizables (T140)

**SC-008 y SC-024 no son aserciones automatizables**: no se sustituyen por `npm test` ni por aserciones de Vitest. Se verifican con lista de cotejo del facilitador y resultados anónimos de los participantes; cada uno exige al menos 90 % sin ayuda (spec.md, "Measurable Outcomes").

### 13.1 Lista de cotejo del facilitador

Marca una casilla por participante. "Sin ayuda" significa que el facilitador no indica la acción, el botón ni la ruta; cualquier pista cuenta como ayuda.

| Participante | SC-008: lote → inspección → NC → CAPA sin ayuda | SC-024: identifica estado y siguiente acción sin ayuda | Observaciones |
| :--- | :--- | :--- | :--- |
| P1 | [ ] | [ ] | |
| P2 | [ ] | [ ] | |
| P3 | [ ] | [ ] | |

Para SC-008, comprueba sin intervención: elegir un lote pendiente y pulsar **Inspeccionar**; seleccionar plan y lista `approved`; completar mediciones y enviar a revisión; como Jefe, rechazar con justificación y verificar la NC; crear la CAPA con responsable, causa raíz, tipo y fecha límite.

Para SC-024, presenta en orden aleatorio una inspección `draft` ("Borrador"), una `pending_review` ("Pendiente"), una `completed` con resultado "Condicional" y una "Reprobado", además de una CAPA "Vencida". Cada participante debe nombrar el estado visible y la siguiente acción disponible según su rol, sin ayuda.

### 13.2 Procedimiento de resultados anónimos

1. Antes de la demo, explica el objetivo, que la participación es voluntaria y que no se registrarán nombres, correos ni IDs de inspector.
2. Cada participante entrega una ficha sin identificación con `SC-008 completó sin ayuda: sí/no`, `SC-024 identificó estado y acción: sí/no` y, si recibió ayuda, el punto donde la recibió, sin asociarlo a la persona.
3. El facilitador cuenta las fichas y calcula `porcentaje = fichas «sí» / fichas entregadas × 100` por separado para SC-008 y SC-024. Cada criterio se cumple solo con un porcentaje ≥ 90 %.
4. Publica únicamente el agregado en la plantilla `Criterio | Participantes | Sin ayuda | Porcentaje | Umbral | Resultado`; no publiques fichas individuales ni las cruces con el inspector que ejecutó la inspección de la demo.
5. Si el porcentaje es menor a 90 %, anota la pantalla o acción con más ayuda, repite la medición en otra sesión y no marques el criterio como superado por inferencia a partir de pruebas automáticas.

## 14. Criterios de salida

La validación se considera completa cuando:

- Un plan, una lista y un documento completan su ciclo de aprobación con justificación y auditoría.
- Una inspección nueva recorre `draft → pending_review → completed` con `review_decision` y `overall_result` derivado.
- `pending_review` no cuenta en KPIs ni libera lote; `pending_inspections` excluye el legado condicional en bandeja.
- `approval_rate` aplica la fórmula FR-039, con `conditional` solo en denominador y 0 si el denominador es 0.
- El rechazo elegible genera una NC; overrides, condicionales, guardas y cambios manuales no.
- El legado condicional sin decisión está en bandeja, conserva `completed` y sale con cualquier decisión; otros legados son finales; `overall_result = null` se excluye de KPIs.
- Una CAPA con cierre rechazado queda `closure_status = rejected` y `status = in_progress`; la eficacia es obligatoria y se audita por separado.
- La NC puede cerrarse sin CAPA aprobada y la cuarentena se deriva correctamente.
- La bitácora cumple `create`/`delete`, una sola decisión, sin duplicados por `completed`, y una sola `status_change` en override; no hay auditoría para acciones denegadas.
- Los permisos coinciden con la matriz canónica: Inspector sin bitácora ni detalle ajeno; Gerente solo lectura/exportación.
- La evidencia cumple PNG/JPG/PDF, 5 MB por archivo, 8 MB acumulados/cuota y documento principal de 10 MB.
- Las 15 pantallas × 3 roles × 3 anchos, el menú de 5 categorías/12 IDs, el dashboard exacto, los tokens, las etiquetas, las columnas clave, la búsqueda filtrada, estados vacíos, carga, foco y contraste AA cumplen lo verificado en la sección 11.
- No se eliminó ninguna funcionalidad existente tras la reorganización visual.
- Los datos persisten tras recargar y la migración es idempotente.
- Toda operación importante muestra carga o acciones deshabilitadas desde el inicio (objetivo ≤ 300 ms) y termina con confirmación o error sin recargar (T118, FR-072, SC-025, SC-030).
- El recorrido funcional manual con `npm run dev` de la sección 11.7 cubre las 15 pantallas de US15 con sus 12 IDs de menú, los tres roles y los tres anchos (T054).
- Con hasta 500 inspecciones, dashboard y exportación terminan en menos de 2 s, la búsqueda filtrada en menos de 1 s y la bitácora filtrada en menos de 2 s, con los tiempos de la instrumentación de T139 (T051, T082, SC-006, SC-010, SC-012, SC-016).
- SC-008 y SC-024 quedan registrados con lista de cotejo del facilitador y resultados anónimos ≥ 90 %, marcados explícitamente como no automatizables (T140).
- `npm test` pasa sin errores.
- `npm run lint` pasa sin errores.
