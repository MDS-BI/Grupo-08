# Plan de Desarrollo: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Estado**: Borrador  
**Metodología**: Spec-Driven Development (Speckit)  
**Modelo de datos**: [data-model.md](data-model.md)  
**Módulo base relacionado**: [001-erp-base-module](../001-erp-base-module/)  
**Historias de usuario**: [Historias-Usuarios.md](../../Historias-Usuarios.md) (reflejadas y detalladas en `spec.md`)

## 1. Resumen

Desarrollar un módulo ERP para gestionar planes y criterios de inspección, identificar lotes pendientes, registrar inspecciones y resultados, documentar no conformidades y dar seguimiento a acciones correctivas o preventivas (CAPA). El módulo se integra con productos, empleados, recepciones, órdenes de producción y despachos de los módulos correspondientes.

El objetivo del MVP es demostrar el flujo completo de calidad: definir un plan, identificar un lote pendiente, ejecutar una inspección con evaluación automática de tolerancias, generar una no conformidad cuando corresponda, revisar inspecciones condicionales y lotes en cuarentena, y cerrar el ciclo con una acción CAPA.

## 2. Problema y solución

**Problema.** En muchas empresas los controles de calidad se registran en planillas aisladas del flujo operativo. Esto permite que materias primas defectuosas entren a producción, que lotes con fallas sigan procesándose o que productos defectuosos lleguen al cliente, generando devoluciones, mermas y pérdida de trazabilidad ante auditorías (por ejemplo, ISO 9001).

**Solución.** Un módulo transversal de Control de Calidad que cubre las etapas `incoming`, `in_process` y `final`, con planes y criterios configurables, identificación de lotes pendientes, evaluación automática de tolerancias, registro de no conformidades, cuarentena y seguimiento CAPA. El MVP será una aplicación frontend con persistencia local, coherente con el módulo base ERP.

## 3. Clientes y usuarios

**Cliente objetivo.** Empresas manufactureras, industriales o distribuidoras de mediano y gran tamaño con inventarios físicos y cadenas de suministro integradas, que necesitan estandarizar el control técnico de sus lotes y reducir costos por fallas de calidad.

| Rol | Necesidad principal | Acciones en el módulo |
| :--- | :--- | :--- |
| **Inspector de Calidad** | Identificar lotes pendientes y registrar mediciones en terreno. | Ver lotes pendientes, crear inspecciones, ingresar resultados por criterio y ejecutar la evaluación automática. |
| **Jefe de Calidad / Planta** | Definir estándares, revisar desviaciones y resolver no conformidades. | Crear y mantener planes y criterios, clasificar no conformidades, revisar inspecciones condicionales, gestionar cuarentena y asignar acciones CAPA. |
| **Gerente de Operaciones / Auditor** | Evaluar desempeño y cumplimiento normativo. | Consultar KPIs, revisar el historial de inspecciones y auditar la trazabilidad y los plazos CAPA. |

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

**Fuera del MVP (escalabilidad futura):** bloqueo automático de inventario, calificación de proveedores, inspección de devoluciones (`returns_rma`), integración IoT, valorización monetaria de no calidad y métricas por línea de producción. Se documentan como evolución, no como alcance de esta entrega.

## 5. Vistas del MVP

1. **Dashboard de Calidad.** KPIs de aprobación, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes. Incluye análisis de Pareto de productos con mayor tasa de defectos.
2. **Lotes pendientes.** Tabla de documentos origen sin inspección completada, con ID de lote, producto, fecha, estado y acción para inspeccionar.
3. **Configurador de planes y criterios.** Vista maestro-detalle para crear planes por producto y etapa, y definir criterios con valor esperado, tolerancia, unidad y tipo de comparación.
4. **Motor de inspección.** Selector del documento origen, formulario de mediciones y evaluación automática de cada criterio según `range`, `min`, `max` o `boolean`.
5. **Gestor de no conformidades y CAPA.** Generación de no conformidades con descripción obligatoria, clasificación de tipo de defecto y severidad, y panel de acciones con responsable, causa raíz, tipo de acción, vencimiento y estado.
6. **Revisión y cuarentena.** Bandeja de inspecciones `conditional` y pestaña de lotes con no conformidades abiertas, con acceso a la acción CAPA.
7. **Historial y filtros.** Búsqueda por lote (documento origen), rango de fechas y limpieza de filtros.

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

**Reglas de negocio del MVP:**

- Un plan debe tener al menos un criterio para habilitarse para inspecciones.
- `pass_fail` se calcula automáticamente comparando `measured_value` con `expected_value`, `tolerance` y `comparison_type`; no se ingresa manualmente.
- Una inspección solo obtiene `overall_result` cuando está `completed`; si falta la medición de cualquier criterio, permanece `draft`.
- `overall_result` es `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos los criterios cumplen.
- Una inspección con `overall_result = failed` genera un borrador de no conformidad con descripción autogenerada, producto del plan, tipo de defecto `other`, severidad inicial `major` y estado `open`.
- Una inspección con `overall_result = conditional` se marca en la bandeja de revisión y no genera no conformidad.
- El jefe de calidad puede cambiar el dictamen solo con justificación registrada; no puede aprobar una inspección con criterios críticos fallidos o sin medición.
- Toda acción CAPA debe tener responsable, descripción, causa raíz, tipo de acción y `due_date`; una acción vencida se marca como tal en el dashboard.
- Los planes y criterios con inspecciones históricas no se editan ni eliminan; se duplican para crear una nueva versión.

**Modelo corregido.** `expected_value`, `tolerance` y `measured_value` son numéricos; los criterios incluyen `unit`, `comparison_type` e `is_critical`; las inspecciones incluyen `inspection_status` y los campos de auditoría del cambio de dictamen; las acciones CAPA incluyen `root_cause` y `action_type`.

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
- La integración se considerará lograda cuando una inspección pueda vincularse a un origen válido, consultar producto e inspector, registrar resultados y no conformidades, y mantener el seguimiento CAPA sin referencias huérfanas.

**Bloqueo técnico actual.** El código del módulo base (`index.html` y `src/`) no está en el repositorio: fue eliminado en el commit `a0062c0`. Antes de ejecutar una versión integrada hay que restaurarlo (`git restore --source=a0062c0^ -- index.html src`) o implementarlo desde las especificaciones y pruebas existentes. Sin este paso no es posible cumplir el hito de "versión integrada de prueba".

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
├── main.js
├── styles.css
├── storage.js
├── app.js
├── module-config.js
├── seed-data.js                (datos semilla de productos, empleados, recepciones, órdenes y despachos)
└── components/
    ├── shell.js                  (marco del espacio de trabajo: barra superior, logotipo SVG, barra lateral, estado de módulo activo)
    ├── dashboard.js              (dashboard de calidad: KPIs, Pareto de defectos e inspecciones pendientes)
    ├── pending-lots.js           (tabla de lotes pendientes y acción para iniciar inspección)
    ├── quality-plan-config.js    (configurador maestro-detalle de planes y criterios por producto y etapa)
    ├── inspection-engine.js      (selector del origen, formulario de mediciones y evaluación automática de tolerancias)
    ├── non-conformance-capa.js   (registro de no conformidades, panel de acciones CAPA y pestaña de cuarentena)
    └── inspection-history.js     (historial filtrable por lote, fechas y limpieza de filtros)

tests/
├── unit/
├── integration/
└── setup/
```

**Decisión de Estructura**: Se reutiliza la estructura del módulo base (`specs/001-erp-base-module`): una aplicación Vite simple con un único punto de entrada HTML, módulos JavaScript pequeños y un CSS separado, con persistencia en `localStorage`. Los componentes se dividen por vista del módulo — dashboard, lotes pendientes, planes y criterios, motor de inspección, no conformidades/CAPA/cuarentena e historial — para mantener cada flujo aislado y testeable. `shell.js`, `dashboard.js` y `module-config.js` conservan el mismo rol que en el módulo base, de modo que la marca y la navegación permanezcan consistentes entre ambos módulos. El motor de tolerancias vive en `inspection-engine.js` y no en el componente de vista, para poder cubrirlo con pruebas unitarias de `tests/unit/`.

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

## 11. Etapas de desarrollo y cronograma

| Fase | Entregable | Actividades clave | Fecha |
| :--- | :--- | :--- | :--- |
| **Fase 1** | Repositorio, modelo y especificación | Corregir `data-model.md`, unificar vocabulario, reflejar las historias en `spec.md`, resolver identificadores, alinear contratos y marcar documentos históricos. | Octubre - primera semana de noviembre |
| **Fase 2** | Planificación y datos semilla | Definir alcance, criterios de aceptación, responsables, checklist, datos semilla y contratos de almacenamiento/motor. | Semana 1-2 de noviembre |
| **Fase 3** | Mockup MVP frontend | Implementar lotes pendientes, dashboard, planes, inspecciones, no conformidades, CAPA, cuarentena y revisión condicional; evaluación automática de tolerancias; pruebas por flujo. | Semana 3-4 de noviembre |
| **Fase 4** | Cierre, calidad y demo | Pruebas de integración y rendimiento, lint/format/static analysis, versión integrada, README actualizado, presentación de 5 minutos y coevaluación. | Semana del 30 de noviembre |

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

## 13. Trazabilidad con el feedback

| Observación del feedback | Acción en este plan |
| :--- | :--- |
| `plan` y `data-model` deben estar dentro de `specs` | Este plan vive en `specs/002-quality-control-module/` y se restauró `data-model.md` en la misma carpeta. Los documentos de la raíz quedan marcados como históricos. |
| "Ojo con la integración" | Sección 7: contrato, identificadores `string`, validación polimórfica y bloqueo del código base. |
| Trabajar en los specs e historias de usuario | `Historias-Usuarios.md` se refleja en `spec.md` con prioridades y criterios Dado/Cuando/Entonces, incluyendo lotes pendientes y cuarentena. |
| Dividirse las historias y tareas | `tasks.md` incluye responsables por fase, fechas y tareas paralelizables. |
| Ejecutar una versión integrada de prueba | Fase 4 y sección 12; requiere restaurar el módulo base (sección 7). |

## 14. Pendientes antes de implementar

- Restaurar o implementar el código del módulo base (`index.html` y `src/`).
- Crear `src/seed-data.js` con los datos semilla acordados.
- Definir y configurar los comandos de lint, formato y análisis estático.
- Implementar las tareas de pruebas por flujo antes de cerrar cada vista.
- Validar la versión integrada con el módulo base y los datos semilla.
