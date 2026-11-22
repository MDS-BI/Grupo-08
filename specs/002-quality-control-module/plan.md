# Plan de Desarrollo: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Estado**: Vigente  
**Metodología**: Spec-Driven Development (Speckit)  
**Actualizado**: 2026-11-22 (US7–US9 y clarificaciones de evidencia, exportación y alertas; US10 y bitácora de auditoría)
**Modelo de datos**: [data-model.md](data-model.md)  
**Módulo base relacionado**: [001-erp-base-module](../001-erp-base-module/)  
**Historias de usuario**: [Historias-Usuarios.md](../../Historias-Usuarios.md) (reflejadas y detalladas en `spec.md`)

## 1. Resumen

Desarrollar un módulo ERP para gestionar planes y criterios de inspección, identificar lotes pendientes, registrar inspecciones y resultados, documentar no conformidades y dar seguimiento a acciones correctivas o preventivas (CAPA). El módulo se integra con productos, empleados, recepciones, órdenes de producción y despachos de los módulos correspondientes. Adicionalmente, permite exportar reportes de calidad, adjuntar evidencia documental, configurar alertas sobre los indicadores del dashboard y auditar los cambios sobre registros de calidad.

El objetivo del MVP es demostrar el flujo completo de calidad: definir un plan, identificar un lote pendiente, ejecutar una inspección con evaluación automática de tolerancias, generar una no conformidad cuando corresponda, revisar inspecciones condicionales y lotes en cuarentena, cerrar el ciclo con una acción CAPA, respaldar las decisiones con evidencia adjunta, exportar la información para auditoría y alertar cuando los umbrales de calidad se incumplen.

## 2. Problema y solución

**Problema.** En muchas empresas los controles de calidad se registran en planillas aisladas del flujo operativo. Esto permite que materias primas defectuosas entren a producción, que lotes con fallas sigan procesándose o que productos defectuosos lleguen al cliente, generando devoluciones, mermas y pérdida de trazabilidad ante auditorías (por ejemplo, ISO 9001).

**Solución.** Un módulo transversal de Control de Calidad que cubre las etapas `incoming`, `in_process` y `final`, con planes y criterios configurables, identificación de lotes pendientes, evaluación automática de tolerancias, registro de no conformidades, cuarentena, seguimiento CAPA, exportación CSV, evidencia adjunta y alertas configurables sobre los indicadores. El MVP será una aplicación frontend con persistencia local, coherente con el módulo base ERP.

## 3. Clientes y usuarios

**Cliente objetivo.** Empresas manufactureras, industriales o distribuidoras de mediano y gran tamaño con inventarios físicos y cadenas de suministro integradas, que necesitan estandarizar el control técnico de sus lotes y reducir costos por fallas de calidad.

| Rol | Necesidad principal | Acciones en el módulo |
| :--- | :--- | :--- |
| **Inspector de Calidad** | Identificar lotes pendientes, registrar mediciones y adjuntar evidencia. | Ver lotes pendientes, crear inspecciones, ingresar resultados por criterio, ejecutar la evaluación automática y adjuntar evidencia. |
| **Jefe de Calidad / Planta** | Definir estándares, revisar desviaciones, resolver no conformidades y configurar alertas. | Crear y mantener planes y criterios, clasificar no conformidades, revisar inspecciones condicionales, gestionar cuarentena, asignar acciones CAPA, adjuntar evidencia y configurar reglas de alerta. |
| **Gerente de Operaciones** | Evaluar desempeño y cumplimiento normativo. | Consultar y exportar KPIs, revisar y exportar el historial de inspecciones, auditar la trazabilidad y los plazos CAPA, y consultar la bitácora de cambios. |

## 4. Alcance funcional del MVP

- Mantener planes de inspección asociados a un producto y a una etapa operativa.
- Definir criterios, valores esperados, tolerancias, unidades y tipos de comparación.
- Identificar lotes pendientes a partir de los documentos origen disponibles.
- Registrar inspecciones con su origen, fecha, inspector, estado y dictamen general.
- Almacenar el resultado de cada criterio evaluado y calcular `pass_fail` automáticamente.
- Registrar no conformidades con descripción obligatoria, tipo de defecto, severidad y estado, originadas por una inspección reprobada.
- Gestionar acciones CAPA con responsable, causa raíz, tipo de acción, fecha límite y estado.
- Revisar inspecciones condicionales y lotes en cuarentena.
- Consultar un dashboard con indicadores y un historial filtrable de inspecciones.
- Conservar trazabilidad desde la inspección y sus resultados hasta el cierre de una no conformidad.
- Exportar en CSV el historial filtrado y el resumen de indicadores del dashboard.
- Adjuntar evidencia (PNG/JPG/PDF) a inspecciones y no conformidades, con validación de tipo, 5 MB por archivo, 8 MB acumulados y cuota.
- Configurar reglas de alerta sobre los indicadores del dashboard y mostrar las alertas cuando se incumple un umbral.
- Consultar una bitácora de altas, ediciones, cambios de estado y eliminaciones sobre inspecciones, no conformidades y CAPA, filtrable por lote y rango de fechas.

**Fuera del MVP (escalabilidad futura):** bloqueo automático de inventario, calificación de proveedores, inspección de devoluciones (`returns_rma`), integración IoT, valorización monetaria de no calidad, métricas por línea de producción, exportación masiva o integración con BI, firma digital de evidencia y notificaciones externas de alertas. Se documentan como evolución, no como alcance de esta entrega.

## 5. Vistas del MVP

1. **Dashboard de Calidad.** KPIs de aprobación, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes. Incluye análisis de Pareto de productos con mayor tasa de defectos.
2. **Lotes pendientes.** Tabla de documentos origen sin inspección completada, con ID de lote, producto, fecha, estado y acción para inspeccionar.
3. **Configurador de planes y criterios.** Vista maestro-detalle para crear planes por producto y etapa, y definir criterios con valor esperado, tolerancia, unidad y tipo de comparación.
4. **Motor de inspección.** Selector del documento origen, formulario de mediciones y evaluación automática de cada criterio según `range`, `min`, `max` o `boolean`.
5. **Gestor de no conformidades y CAPA.** Generación de no conformidades con descripción obligatoria, clasificación de tipo de defecto y severidad, y panel de acciones con responsable, causa raíz, tipo de acción, vencimiento y estado.
6. **Revisión y cuarentena.** Bandeja de inspecciones `conditional` y pestaña de lotes con no conformidades abiertas, con acceso a la acción CAPA.
7. **Historial y filtros.** Búsqueda por lote (documento origen), rango de fechas y limpieza de filtros.
8. **Exportación de reportes.** Exportación CSV UTF-8 del historial filtrado (con columna `resultados` por criterio) y del resumen de KPIs, con nombre de archivo que incluye módulo, fecha de generación y filtros aplicados.
9. **Evidencia de calidad.** Carga, listado y descarga de archivos PNG/JPG/PDF de hasta 5 MB por archivo y 8 MB acumulados, con validación de tipo, tamaño, cuota y autor.
10. **Alertas de calidad.** Configuración de reglas de umbral sobre los KPIs, con indicadores, operadores y severidades canónicos, desactivación/eliminación e indicación visual de las alertas incumplidas en el dashboard.
11. **Bitácora de auditoría.** Consulta de entradas por entidad, acción, lote y rango de fechas, con campo modificado, valores anterior/nuevo, actor, justificación y estado vacío.

## 6. Alineación con el modelo de datos

La fuente de verdad es [data-model.md](data-model.md). Las entidades del módulo son:

| Entidad | Propósito |
| :--- | :--- |
| `quality_inspection_plans` | Plan de inspección por producto y etapa. |
| `quality_inspection_criteria` | Criterios, valor esperado, tolerancia, unidad y tipo de comparación. |
| `quality_inspections` | Evento de inspección, estado y dictamen general. |
| `quality_inspection_results` | Medición y resultado por criterio. |
| `non_conformances` | Desviación detectada, tipo de defecto, severidad y estado. |
| `corrective_actions` | Acción CAPA, responsable, causa raíz, tipo de acción, vencimiento y estado. |
| `quality_evidence` | Archivo de respaldo vinculado a una inspección o a una no conformidad. |
| `quality_alert_rules` | Regla de umbral configurable sobre un indicador del dashboard. |
| `quality_audit_log` | Entrada inmutable de auditoría con lote persistido, entidad, acción, campo y valores, actor, marca temporal y justificación. |

**Enumeraciones canónicas** (deben usarse de forma idéntica en código, datos y pruebas):

| Campo | Valores permitidos |
| :--- | :--- |
| `applicable_stage` | `incoming`, `in_process`, `final` |
| `inspection_status` | `draft`, `completed` |
| `overall_result` | `passed`, `failed`, `conditional` |
| `comparison_type` | `range`, `min`, `max`, `boolean` |
| `defect_type` | `dimensional`, `functional`, `packaging`, `other` |
| `severity` | `minor`, `major`, `critical` |
| `non_conformances.status` | `open`, `under_review`, `closed` |
| `corrective_actions.status` | `pending`, `in_progress`, `completed` |
| `action_type` | `resampling`, `rework`, `other` |
| `reference_module` | `goods_receipt`, `production_order`, `shipment` |
| `evidence_entity` | `inspection`, `non_conformance` |
| `alert_metric` | `approval_rate`, `open_non_conformances`, `overdue_capa`, `capa_effectiveness`, `pending_inspections` |
| `alert_operator` | `lt`, `lte`, `gt`, `gte`, `eq` |
| `alert_severity` | `info`, `warning`, `critical` |
| `audit_entity` | `inspection`, `non_conformance`, `corrective_action` |
| `audit_action` | `create`, `update`, `status_change`, `delete` |

**Reglas de negocio del MVP:**

- Un plan debe tener al menos un criterio para habilitarse para inspecciones.
- `pass_fail` se calcula automáticamente comparando `measured_value` con `expected_value`, `tolerance` y `comparison_type`; no se ingresa manualmente.
- Una inspección solo obtiene `overall_result` cuando está `completed`; si falta la medición de cualquier criterio, permanece `draft`.
- `overall_result` es `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos los criterios cumplen.
- Una inspección con `overall_result = failed` genera un borrador de no conformidad con descripción autogenerada, producto del plan, tipo de defecto `other`, severidad inicial `major` y estado `open`.
- Una inspección con `overall_result = conditional` se marca en la bandeja de revisión y no genera no conformidad.
- El jefe de calidad puede cambiar el dictamen solo con justificación registrada; no puede aprobar una inspección con criterios críticos fallidos o sin medición.
- Toda acción CAPA debe tener responsable, descripción, causa raíz, tipo de acción y `due_date`; una acción vencida se marca como tal en el dashboard.
- Toda acción sobre inspección, NC o CAPA genera una entrada de auditoría con lote persistido (`reference_module` + `reference_id`), actor y `timestamp`; el override genera una sola entrada `status_change` y las entradas sobreviven a las eliminaciones permitidas, incluida la eliminación directa de CAPA.
- Los planes y criterios con inspecciones históricas no se editan ni eliminan; se duplican para crear una nueva versión.
- La exportación se deriva de los datos consultados: el historial respeta los filtros activos, incluye una columna `resultados` con `criterio:medido:cumple` y el resumen usa los mismos KPIs del dashboard; no se persiste un archivo de exportación.
- La evidencia se vincula a una inspección o a una no conformidad existente, registra nombre, tipo, tamaño, contenido base64, autor (empleado seleccionado), fecha, y se rechaza si el tipo no es PNG/JPG/PDF, si supera 5 MB por archivo o si excede el límite acumulado de 8 MB o la cuota de `localStorage`, conservando la evidencia previa.
- La evidencia sigue las reglas de integridad: se elimina en cascada con su inspección (sin no conformidad) o con su no conformidad, y no impide el bloqueo de eliminación cuando la inspección tiene no conformidad.
- Las reglas de alerta se evalúan contra los KPIs al abrir o actualizar el dashboard; se validan indicadores (`approval_rate`, `open_non_conformances`, `overdue_capa`, `capa_effectiveness`, `pending_inspections`), operadores (`lt`, `lte`, `gt`, `gte`, `eq`), severidades (`info`, `warning`, `critical`) y rangos (0–100 para tasas, ≥ 0 para conteos); no se permite más de una regla activa por indicador y operador.
- Una regla de alerta puede desactivarse (`is_active = false`) o eliminarse; en ambos casos deja de mostrarse su alerta y, si se elimina, se retira del almacenamiento.
- Las alertas son informativas: no bloquean operaciones ni generan no conformidades automáticas.

**Modelo corregido.** `expected_value`, `tolerance` y `measured_value` son numéricos; los criterios incluyen `unit`, `comparison_type` e `is_critical`; las inspecciones incluyen `inspection_status` y los campos de auditoría del cambio de dictamen; las acciones CAPA incluyen `root_cause` y `action_type`; la evidencia se modela en `quality_evidence` con vínculo polimórfico a inspección o no conformidad; y las alertas se modelan en `quality_alert_rules` sobre los KPIs del dashboard.

## 7. Integración con el módulo base

Este es el riesgo principal señalado en el feedback y debe resolverse antes de la versión integrada.

**Situación actual:**

- El módulo base (`specs/001-erp-base-module`) es una aplicación Vite con JavaScript vanilla y persistencia en `localStorage`.
- Sus registros usan identificadores `string` (`entity_id`), no claves `INT` autoincrementales.
- El modelo de calidad de `data-model.md` está expresado como modelo relacional con claves `INT` y tablas de otros módulos (`products`, `employees`, `goods_receipts`, `production_orders`, `shipments`).
- El archivo `erp_data_model.md` citado en la documentación anterior no existe en el repositorio. La referencia válida es [001-erp-base-module/data-model.md](../001-erp-base-module/data-model.md).

**Decisión adoptada para el MVP:** usar identificadores `string` y colecciones en `localStorage`, manteniendo el modelo relacional como diseño lógico. El contrato de almacenamiento documenta el mapeo y no se afirma compatibilidad total hasta que la versión integrada esté validada.

**Reglas de integración:**

- `reference_module` debe pertenecer al catálogo canónico y `reference_id` debe existir en la colección correspondiente; una referencia huérfana invalida la inspección.
- Productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas: este módulo no las crea. Para pruebas y demo se usarán datos semilla acordados en `src/seed-data.js`.
- Los lotes pendientes se derivan comparando los documentos origen externos con las inspecciones completadas.
- La evidencia se valida contra la inspección o no conformidad existente; no crea ni modifica registros de otros módulos.
- Las reglas de alerta son locales al módulo de calidad y se evalúan con los datos ya cargados en el dashboard.
- La integración se considerará lograda cuando una inspección pueda vincularse a un origen válido, consultar producto e inspector, registrar resultados, no conformidades y evidencia, mantener el seguimiento CAPA, exportar sus datos y evaluar alertas sin referencias huérfanas.

**Estado de la integración.** El código del módulo base y del módulo de calidad ya está en el repositorio y es ejecutable. La aplicación Vite arranca desde `index.html` y `src/main.js`, que invoca `boot()` en `src/app.js`. La capa de datos está en `src/storage.js` (colecciones en `localStorage` con identificadores `string`, validación de referencias polimórficas, generación automática de no conformidades y derivación de lotes pendientes y cuarentena); el motor de tolerancias en `src/inspection-engine.js`; la configuración del módulo en `src/module-config.js`; y los datos semilla de las dependencias externas en `src/seed-data.js`. Las vistas del módulo de calidad están en `src/components/`: `dashboard.js` (KPIs y Pareto), `pending-lots.js`, `quality-plan-config.js`, `inspection-engine.js` (formulario y evaluación), `non-conformance-capa.js` (no conformidades, CAPA y cuarentena) e `inspection-history.js`, apoyadas por `shell.js` y `quality-utils.js`; los componentes del módulo base (`entity-form.js`, `entity-list.js`, `document-form.js`, `document-list.js`, `custom-fields.js`, `search-bar.js`) se reutilizan para la navegación y la administración del ERP. La suite de `tests/` (`unit/`, `integration/` y `support/`) cubre el motor de tolerancias, las derivaciones, el flujo de inspección y las vistas de calidad. La integración ya vincula inspecciones a orígenes válidos sin referencias huérfanas. US7–US10 (exportación, evidencia, alertas y bitácora) están especificadas y documentadas, pero su implementación y pruebas siguen pendientes (T065–T093); resta validar de extremo a extremo la versión integrada con los datos semilla.

## 8. Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/002-quality-control-module/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Código Fuente (raíz del repositorio)

```text
src/
├── main.js                      (punto de entrada Vite: importa estilos y arranca `boot()`)
├── styles.css
├── storage.js                   (capa de datos en `localStorage`: validaciones, derivación de lotes pendientes y cuarentena, evidencia y reglas de alerta)
├── app.js                       (arranque, navegación y conmutación entre el módulo base y las vistas de calidad)
├── module-config.js             (configuración del módulo)
├── inspection-engine.js         (motor puro de evaluación de tolerancias, sin DOM ni almacenamiento)
├── seed-data.js                 (datos semilla de productos, empleados, recepciones, órdenes y despachos)
└── components/
    ├── shell.js                  (marco del espacio de trabajo: barra superior, logotipo SVG, barra lateral, estado de módulo activo)
    ├── dashboard.js              (dashboard de calidad: KPIs, Pareto de defectos, inspecciones pendientes, exportación de KPIs y alertas de umbral)
    ├── pending-lots.js           (tabla de lotes pendientes y acción para iniciar inspección)
    ├── quality-plan-config.js    (configurador maestro-detalle de planes y criterios por producto y etapa)
    ├── inspection-engine.js      (vista de inspección: selector del origen, formulario de mediciones, evaluación y evidencia adjunta)
    ├── non-conformance-capa.js   (registro de no conformidades, evidencia, panel de acciones CAPA y pestaña de cuarentena)
    ├── inspection-history.js     (historial filtrable por lote, fechas, limpieza de filtros y exportación CSV)
    ├── quality-utils.js          (ayudantes compartidos: escape de HTML, etiquetas, consultas DOM, generación y descarga CSV)
    ├── search-bar.js             (barra de búsqueda y resultados del módulo base)
    ├── entity-form.js            (formulario de entidades del módulo base)
    ├── entity-list.js            (listado de entidades del módulo base)
    ├── document-form.js          (formulario de documentos del módulo base)
    ├── document-list.js          (listado de documentos del módulo base)
    └── custom-fields.js          (campos personalizados configurables del módulo base)

tests/
├── unit/                        (motor de tolerancias, derivaciones, configuración de módulo, planes y almacenamiento)
├── integration/                 (flujos de inspección, no conformidad/CAPA, cuarentena, dashboard, historial y módulo base)
│   ├── quality-export.test.js   (exportación CSV del historial y de KPIs)
│   ├── quality-evidence.test.js (validación, vínculo y cascada de evidencia)
│   └── quality-alerts.test.js   (reglas de alerta y evaluación de umbrales)
└── support/                     (utilidades de prueba compartidas, p. ej. `quality-dom.js`)
```

**Decisión de Estructura**: Se reutiliza la estructura del módulo base (`specs/001-erp-base-module`): una aplicación Vite simple con un único punto de entrada HTML, módulos JavaScript pequeños y un CSS separado, con persistencia en `localStorage`. Los componentes se dividen por vista del módulo — dashboard, lotes pendientes, planes y criterios, motor de inspección, no conformidades/CAPA/cuarentena, historial, exportación, evidencia y alertas — para mantener cada flujo aislado y testeable. `shell.js`, `dashboard.js` y `module-config.js` conservan el mismo rol que en el módulo base, de modo que la marca y la navegación permanezcan consistentes entre ambos módulos. El motor de tolerancias vive en `src/inspection-engine.js` y no en la vista `src/components/inspection-engine.js`, para poder cubrirlo con pruebas unitarias de `tests/unit/`.

## 9. KPIs y análisis

**KPIs del MVP:**

- **Tasa de aprobación por etapa (Yield Rate):** inspecciones `passed` sobre el total de inspecciones completadas en cada `applicable_stage`.
- **Control de desviación:** comparación numérica entre `measured_value` y los límites definidos por `expected_value`, `tolerance` y `comparison_type`.
- **Eficacia CAPA:** porcentaje de acciones `completed` dentro de `due_date`.
- **Pareto de defectos:** productos y etapas con mayor concentración de no conformidades.

**Evolución futura (fuera del MVP):**

- **Valorización de no calidad:** cruce de no conformidades abiertas con `products.standard_cost` para estimar el impacto financiero.
- **Métricas por línea de producción:** requieren una entidad de línea que no forma parte de este módulo.

## 10. Riesgos y mitigación

1. **Sesgo del inspector.** La evaluación manual puede favorecer la aprobación de lotes al límite. Mitigación: `pass_fail` calculado por el sistema y bloqueo de aprobación con criterios críticos fallidos.
2. **Privacidad y desempeño individual.** Asociar fallas a personas puede generar ambientes punitivos. Mitigación: métricas agregadas por producto o etapa; acceso individual solo para jefatura.
3. **Presión operativa.** Urgencia por despachar lotes defectuosos. Mitigación: estado retenido/cuarentena visible y obligación de gestionar la no conformidad.
4. **Integración de datos.** Diferencias de identificadores y almacenamiento entre módulos. Mitigación: contrato explícito, identificadores `string`, capa de mapeo documentada y datos semilla para pruebas.
5. **Integridad histórica.** Editar o eliminar planes usados alteraría la interpretación de inspecciones pasadas. Mitigación: bloqueo de edición/eliminación y duplicación de planes.
6. **Alcance excesivo.** Agregar inventario, proveedores, IoT o valorización monetaria antes de cerrar el flujo básico. Mitigación: mantener esas capacidades fuera del MVP.
7. **Cuota de almacenamiento local.** La evidencia en base64 puede agotar `localStorage`. Mitigación: límite de 5 MB por archivo, 8 MB acumulados, validación previa y manejo de `QuotaExceededError` sin perder evidencia existente.

## 11. Etapas de desarrollo y cronograma

| Fase | Entregable | Actividades clave | Fecha |
| :--- | :--- | :--- | :--- |
| **Fase 1** | Repositorio, modelo y especificación | Corregir `data-model.md`, unificar vocabulario, reflejar las historias en `spec.md`, resolver identificadores, alinear contratos y marcar documentos históricos. | Octubre - primera semana de noviembre |
| **Fase 2** | Planificación y datos semilla | Definir alcance, criterios de aceptación, responsables, checklist, datos semilla y contratos de almacenamiento/motor. | Semana 1-2 de noviembre |
| **Fase 3** | Mockup MVP frontend | Implementar lotes pendientes, dashboard, planes, inspecciones, no conformidades, CAPA, cuarentena, revisión condicional, exportación CSV, evidencia adjunta y alertas de umbral; evaluación automática de tolerancias; pruebas por flujo. | Semana 3-4 de noviembre |
| **Fase 4** | Cierre, calidad y demo | Pruebas de integración y rendimiento, validación de exportación/evidencia/alertas, lint/format/static analysis, versión integrada, README actualizado, presentación de 5 minutos y coevaluación. | Semana del 30 de noviembre |

## 12. Criterios de aceptación e integración

El módulo se considerará terminado cuando:

- La aplicación ejecute con `npm run dev` y la suite pase con `npm test`.
- Los comandos de lint, formato y análisis estático definidos por el equipo pasen sin errores bloqueantes.
- Se pueda identificar un lote pendiente, crear un plan con criterios y ejecutar una inspección asociada a un origen válido.
- La evaluación de tolerancias calcule `pass_fail` y `overall_result` sin intervención manual, y una inspección incompleta permanezca en `draft`.
- Una inspección reprobada genere una no conformidad con descripción obligatoria y permita crear una acción CAPA con responsable, causa raíz, tipo de acción y vencimiento.
- Una inspección condicional aparezca en la bandeja de revisión y no genere no conformidad.
- Un lote con no conformidad abierta aparezca en cuarentena y permita asignar una CAPA.
- El dashboard y el historial reflejen los datos registrados, incluyendo estados vacíos, eficacia CAPA y restricción del detalle individual por inspector al rol de jefatura.
- Las consultas del historial con hasta 500 inspecciones respondan en menos de 2 segundos y la búsqueda filtrada en menos de 1 segundo percibido.
- No existan referencias huérfanas ni errores de integridad al navegar entre vistas.
- Los planes y criterios con inspecciones históricas estén bloqueados para edición y eliminación.
- La exportación CSV del historial respete los filtros activos, incluya la columna `resultados` por criterio y el resumen exporte los mismos KPIs del dashboard, sin generar archivos vacíos.
- La evidencia quede vinculada a inspecciones y no conformidades, con validación de tipo, tamaño por archivo (5 MB), límite acumulado (8 MB) y cuota, y respete las reglas de cascada y bloqueo.
- Las alertas del dashboard correspondan a reglas activas cuyo umbral se incumple, y las reglas desactivadas o eliminadas dejen de mostrar alertas, sin bloquear operaciones ni generar no conformidades.
- La exportación de hasta 500 inspecciones finalice en menos de 2 segundos.

## 13. Trazabilidad con el feedback

| Observación del feedback | Acción en este plan |
| :--- | :--- |
| `plan` y `data-model` deben estar dentro de `specs` | Este plan vive en `specs/002-quality-control-module/` y se restauró `data-model.md` en la misma carpeta. Los documentos de la raíz quedan marcados como históricos. |
| "Ojo con la integración" | Sección 7: contrato, identificadores `string` y validación polimórfica de referencias. |
| Trabajar en los specs e historias de usuario | `Historias-Usuarios.md` se refleja en `spec.md` con prioridades y criterios Dado/Cuando/Entonces, incluyendo lotes pendientes y cuarentena. |
| Dividirse las historias y tareas | `tasks.md` incluye responsables por fase, fechas y tareas paralelizables. |
| Ejecutar una versión integrada de prueba | Fase 4 y sección 12; la versión integrada se valida con el módulo base y los datos semilla (sección 7). |
| Nuevas historias de exportación, evidencia y alertas | US7–US9 se integran en §4–§9, con FR-041–FR-047, SC-012–SC-015 y las tareas T065–T082; US10 (bitácora) queda reflejada en §4–§6, FR-048–FR-050, SC-016 y T083–T093. |

## 14. Pendientes antes de implementar

**Estado actual.** El código base y del módulo de calidad ya está en el repositorio y es ejecutable con `npm run dev`, con la suite en `npm test`. Existen `index.html`, `src/main.js`, `src/app.js`, `src/storage.js`, `src/inspection-engine.js`, `src/module-config.js` y `src/seed-data.js`; las vistas de calidad en `src/components/` (`dashboard.js`, `pending-lots.js`, `quality-plan-config.js`, `inspection-engine.js`, `non-conformance-capa.js`, `inspection-history.js`, `shell.js`, `quality-utils.js`); y las pruebas en `tests/unit/`, `tests/integration/` y `tests/support/`.

**Pendiente de implementación:** US7–US10 (exportación CSV, evidencia, alertas y bitácora de auditoría) están especificadas y documentadas en este plan, pero su código y pruebas aún no existen; corresponden a T065–T093. Las pruebas actuales cubren el flujo base, no las nuevas vistas.

**Pendientes:**
- Definir y configurar los comandos de lint, formato y análisis estático.
- Validar de extremo a extremo la versión integrada con el módulo base y los datos semilla.
- Validar la exportación con hasta 500 inspecciones en menos de 2 segundos (SC-012).
- Validar los límites de tipo y tamaño de evidencia y la evaluación de reglas de alerta en el dashboard.
- Validar la bitácora filtrada por lote y rango de fechas con hasta 500 inspecciones en menos de 2 segundos (SC-016).

## 15. Escalabilidad y desarrollo futuro

Las siguientes mejoras quedan fuera del alcance del MVP (ver §4 y `spec.md` › "Fuera de Alcance") y se apoyan en el patrón polimórfico (`reference_module` + `reference_id`) y en las referencias a las tablas maestras descritas en §7. Provienen del plan histórico de la raíz (`./plan.md`, §4.2 "Escalabilidad y Desarrollo Futuro").

### 15.1 Inventario

Bloqueo automático del stock afectado: conectar las inspecciones reprobadas para retener automáticamente el lote y moverlo a cuarentena, de modo que un origen con `overall_result = 'failed'` no siga procesándose.

- **Rol que la aprovecha**: **Jefe de Calidad** (historias 3 y 4: clasifica las no conformidades y gestiona la cuarentena hasta liberar o rechazar el lote).
- **Tabla/campo que la habilita**: `non_conformances.status` (`open`/`under_review` mantiene el lote retenido y `closed` lo libera) y `non_conformances.product_id`, sobre el lote polimórfico `quality_inspections.reference_module` + `reference_id` (data-model.md §3.3, §3.5).

### 15.2 Proveedores

Evaluación de proveedores: cruzar las fallas detectadas en las recepciones para calificar automáticamente a los proveedores.

- **Rol que la aprovecha**: **Gerente de Operaciones** (historias 5 y 6: evalúa el desempeño y audita el cumplimiento).
- **Tabla/campo que la habilita**: `quality_inspections.reference_module` con valor `goods_receipt` y `quality_inspections.overall_result`, más `non_conformances.product_id`, que enlazan cada recepción inspeccionada con el producto afectado (data-model.md §3.3, §3.5).

### 15.3 Devoluciones

Inspección de devoluciones de clientes: incorporar `returns_rma` como nuevo valor del catálogo polimórfico para reutilizar los mismos planes y criterios.

- **Rol que la aprovecha**: **Inspector de Calidad** (historia 2: registra la inspección y las mediciones), con seguimiento del **Jefe de Calidad**.
- **Tabla/campo que la habilita**: `quality_inspections.reference_module` (ampliar su catálogo canónico con `returns_rma`) junto con `reference_id` (data-model.md §3.3).

### 15.4 IoT

Captura automática de mediciones: poblar el valor medido desde instrumentos digitales (balanzas, sensores de temperatura, calibres) en lugar del ingreso manual.

- **Rol que la aprovecha**: **Inspector de Calidad** (historia 2: ingresa las mediciones por criterio).
- **Tabla/campo que la habilita**: `quality_inspection_results.measured_value` (se poblaría de forma automática; `pass_fail` se seguiría calculando) (data-model.md §3.4).
