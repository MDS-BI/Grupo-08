# Plan de Desarrollo: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Estado**: Borrador  
**Metodología**: Spec-Driven Development (Speckit)  
**Modelo de datos**: [data-model.md](data-model.md)  
**Módulo base relacionado**: [001-erp-base-module](../001-erp-base-module/)  
**Historias de usuario**: [Historias-Usuarios.md](../../Historias-Usuarios.md) (migrar a `spec.md`)

## 1. Resumen

Desarrollar un módulo ERP para gestionar planes y criterios de inspección, registrar inspecciones y resultados, documentar no conformidades y dar seguimiento a acciones correctivas o preventivas (CAPA). El módulo se integra con productos, empleados, recepciones, órdenes de producción y despachos de los módulos correspondientes.

El objetivo del MVP es demostrar el flujo completo de calidad: definir un plan, ejecutar una inspección con evaluación automática de tolerancias, generar una no conformidad cuando corresponda y cerrar el ciclo con una acción CAPA.

## 2. Problema y solución

**Problema.** En muchas empresas los controles de calidad se registran en planillas aisladas del flujo operativo. Esto permite que materias primas defectuosas entren a producción, que lotes con fallas sigan procesándose o que productos defectuosos lleguen al cliente, generando devoluciones, mermas y pérdida de trazabilidad ante auditorías (por ejemplo, ISO 9001).

**Solución.** Un módulo transversal de Control de Calidad que cubre las etapas `incoming`, `in_process` y `final`, con planes y criterios configurables, evaluación automática de tolerancias, registro de no conformidades y seguimiento CAPA. El MVP será una aplicación frontend con persistencia local, coherente con el módulo base ERP.

## 3. Clientes y usuarios

**Cliente objetivo.** Empresas manufactureras, industriales o distribuidoras de mediano y gran tamaño con inventarios físicos y cadenas de suministro integradas, que necesitan estandarizar el control técnico de sus lotes y reducir costos por fallas de calidad.

| Rol | Necesidad principal | Acciones en el módulo |
| :--- | :--- | :--- |
| **Inspector de Calidad** | Registrar mediciones y detectar desviaciones en terreno. | Crear inspecciones, ingresar resultados por criterio, ejecutar la evaluación automática y reportar no conformidades. |
| **Jefe de Calidad / Planta** | Definir estándares y resolver desviaciones. | Crear y mantener planes y criterios, clasificar no conformidades, aprobar liberaciones y asignar acciones CAPA. |
| **Gerente de Operaciones / Auditor** | Evaluar desempeño y cumplimiento normativo. | Consultar KPIs, revisar el historial de inspecciones y auditar la trazabilidad y los plazos CAPA. |

## 4. Alcance funcional del MVP

- Mantener planes de inspección asociados a un producto y a una etapa operativa.
- Definir criterios, valores esperados y tolerancias para cada plan.
- Registrar inspecciones con su origen, fecha, inspector y dictamen general.
- Almacenar el resultado de cada criterio evaluado y calcular `pass_fail` automáticamente.
- Registrar no conformidades con severidad y estado, originadas por una inspección reprobada.
- Gestionar acciones CAPA con responsable, fecha límite y estado.
- Consultar un dashboard con indicadores y un historial filtrable de inspecciones.
- Conservar trazabilidad desde la inspección y sus resultados hasta el cierre de una no conformidad.

**Fuera del MVP (escalabilidad futura):** bloqueo automático de inventario, calificación de proveedores, inspección de devoluciones (`returns_rma`) e integración IoT. Se documentan como evolución, no como alcance de esta entrega.

## 5. Vistas del MVP

1. **Dashboard de Calidad.** KPIs de aprobación, no conformidades abiertas por severidad, CAPA vencidas e inspecciones pendientes. Incluye análisis de Pareto de productos con mayor tasa de defectos.
2. **Configurador de planes y criterios.** Vista maestro-detalle para crear planes por producto y etapa, y definir criterios con valor esperado y tolerancia.
3. **Motor de inspección.** Selector del documento origen, formulario de mediciones y evaluación automática de cada criterio contra `expected_value ± tolerance`.
4. **Gestor de no conformidades y CAPA.** Generación de no conformidades, clasificación de severidad y panel de acciones con responsable, vencimiento y estado.
5. **Historial y filtros.** Búsqueda por lote o documento origen, rango de fechas y limpieza de filtros.

## 6. Alineación con el modelo de datos

La fuente de verdad es [data-model.md](data-model.md). Las entidades del módulo son:

| Entidad | Propósito |
| :--- | :--- |
| `quality_inspection_plans` | Plan de inspección por producto y etapa. |
| `quality_inspection_criteria` | Criterios, valor esperado y tolerancia de cada plan. |
| `quality_inspections` | Evento de inspección y su dictamen general. |
| `quality_inspection_results` | Medición y resultado por criterio. |
| `non_conformances` | Desviación detectada y su severidad/estado. |
| `corrective_actions` | Acción CAPA, responsable, vencimiento y estado. |

**Enumeraciones canónicas** (deben usarse de forma idéntica en código, datos y pruebas):

| Campo | Valores permitidos |
| :--- | :--- |
| `applicable_stage` | `incoming`, `in_process`, `final` |
| `overall_result` | `passed`, `failed`, `conditional` |
| `severity` | `minor`, `major`, `critical` |
| `non_conformances.status` | `open`, `under_review`, `closed` |
| `corrective_actions.status` | `pending`, `in_progress`, `completed` |
| `reference_module` | `goods_receipt`, `production_order`, `shipment` |

**Reglas de negocio del MVP:**

- `pass_fail` se calcula automáticamente comparando `measured_value` con `expected_value` y `tolerance`; no se ingresa manualmente.
- `overall_result` es `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones menores y `passed` si todos los criterios cumplen.
- Una inspección con `overall_result = failed` genera un borrador de no conformidad.
- El jefe de calidad puede cambiar el dictamen solo con justificación registrada; no puede aprobar una inspección con criterios críticos fallidos.
- Toda acción CAPA debe tener responsable y `due_date`; una acción vencida se marca como tal en el dashboard.

**Corrección pendiente del modelo.** `expected_value`, `tolerance` y `measured_value` están declarados como `VARCHAR`. Para cumplir la evaluación automática deben migrarse a un tipo numérico, agregar unidad de medida y tipo de comparación (rango, mínimo, máximo o booleano). Esta corrección debe hacerse en `data-model.md` antes de implementar el motor de tolerancias.

## 7. Integración con el módulo base

Este es el riesgo principal señalado en el feedback y debe resolverse antes de la versión integrada.

**Situación actual:**

- El módulo base (`specs/001-erp-base-module`) es una aplicación Vite con JavaScript vanilla y persistencia en `localStorage`.
- Sus registros usan identificadores `string` (`entity_id`), no claves `INT` autoincrementales.
- El modelo de calidad de `data-model.md` está expresado como modelo relacional con claves `INT` y tablas de otros módulos (`products`, `employees`, `goods_receipts`, `production_orders`, `shipments`).
- El archivo `erp_data_model.md` citado en la documentación anterior no existe en el repositorio. La referencia válida es [001-erp-base-module/data-model.md](../001-erp-base-module/data-model.md).

**Decisión propuesta para el MVP:** usar identificadores `string` y colecciones en `localStorage`, manteniendo el modelo relacional como diseño lógico. Si se opta por `INT`, debe existir una capa de mapeo entre ambos mundos. En ningún caso se debe afirmar compatibilidad total hasta que el contrato esté acordado.

**Reglas de integración:**

- `reference_module` debe pertenecer al catálogo canónico y `reference_id` debe existir en la colección correspondiente; una referencia huérfana invalida la inspección.
- Productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas: este módulo no las crea. Para pruebas y demo se usarán datos semilla acordados.
- La integración se considerará lograda cuando una inspección pueda vincularse a un origen válido, consultar producto e inspector, registrar resultados y no conformidades, y mantener el seguimiento CAPA sin referencias huérfanas.

**Bloqueo técnico actual.** El código del módulo base (`index.html` y `src/`) no está en el repositorio: fue eliminado en el commit `a0062c0`. Antes de ejecutar una versión integrada hay que restaurarlo (`git restore --source=a0062c0^ -- index.html src`) o implementarlo desde las especificaciones y pruebas existentes. Sin este paso no es posible cumplir el hito de "versión integrada de prueba".

## 8. KPIs y análisis

- **Tasa de aprobación por etapa (Yield Rate):** inspecciones `passed` sobre el total ejecutado en cada `applicable_stage`.
- **Control de desviación:** comparación numérica entre `measured_value` y los límites definidos por `expected_value` y `tolerance`.
- **Valorización de no calidad:** cruce de no conformidades abiertas con `products.standard_cost` para estimar el impacto financiero.
- **Eficacia CAPA:** porcentaje de acciones `completed` dentro de `due_date`.
- **Pareto de defectos:** productos y etapas con mayor concentración de no conformidades.

## 9. Riesgos y mitigación

1. **Sesgo del inspector.** La evaluación manual puede favorecer la aprobación de lotes al límite. Mitigación: `pass_fail` calculado por el sistema y bloqueo de aprobación con criterios críticos fallidos.
2. **Privacidad y desempeño individual.** Asociar fallas a personas puede generar ambientes punitivos. Mitigación: métricas agregadas por producto, etapa o línea; acceso individual solo para jefatura.
3. **Presión operativa.** Urgencia por despachar lotes defectuosos. Mitigación: estado retenido/cuarentena visible y obligación de gestionar la no conformidad.
4. **Integración de datos.** Diferencias de identificadores y almacenamiento entre módulos. Mitigación: contrato explícito, capa de mapeo y datos semilla para pruebas.
5. **Alcance excesivo.** Agregar inventario, proveedores o IoT antes de cerrar el flujo básico. Mitigación: mantener esas capacidades fuera del MVP.

## 10. Etapas de desarrollo y cronograma

| Fase | Entregable | Actividades clave | Fecha |
| :--- | :--- | :--- | :--- |
| **Fase 1** | Repositorio y modelo inicial | Ubicar `plan.md` y `data-model.md` dentro de `specs/002`, MER en Mermaid y definición del alcance. Corregir observaciones del feedback. | Octubre (entregado con observaciones) |
| **Fase 2** | Especificaciones y tareas | Migrar las historias a `spec.md`, agregar prioridades y criterios Dado/Cuando/Entonces; crear `tasks.md` y repartir tareas. | Semana 1-2 de noviembre |
| **Fase 3** | Mockup MVP frontend | Implementar dashboard, planes, inspecciones, no conformidades y CAPA; evaluación automática de tolerancias; datos semilla. | Semana 3-4 de noviembre |
| **Fase 4** | Cierre, demo y defensa | Versión integrada, pruebas, README actualizado, presentación de 5 minutos y coevaluación. | Semana del 30 de noviembre |

## 11. Criterios de aceptación e integración

El módulo se considerará terminado cuando:

- La aplicación ejecute con `npm run dev` y la suite pase con `npm test`.
- Se pueda crear un plan con criterios y ejecutar una inspección asociada a un origen válido.
- La evaluación de tolerancias calcule `pass_fail` y `overall_result` sin intervención manual.
- Una inspección reprobada genere una no conformidad y permita crear una acción CAPA con responsable y vencimiento.
- El dashboard y el historial reflejen los datos registrados.
- No existan referencias huérfanas ni errores de integridad al navegar entre vistas.

## 12. Trazabilidad con el feedback

| Observación del feedback | Acción en este plan |
| :--- | :--- |
| `plan` y `data-model` deben estar dentro de `specs` | Este plan vive en `specs/002-quality-control-module/` y se restauró `data-model.md` en la misma carpeta. |
| "Ojo con la integración" | Sección 7: contrato, identificadores, validación polimórfica y bloqueo del código base. |
| Trabajar en los specs e historias de usuario | Fase 2: migrar `Historias-Usuarios.md` a `spec.md` con formato Speckit. |
| Dividirse las historias y tareas | Fase 2: crear `tasks.md` con responsables y entregas semanales. |
| Ejecutar una versión integrada de prueba | Fase 3 y sección 11; requiere restaurar el módulo base (sección 7). |

## 13. Pendientes antes de implementar

- Migrar `Historias-Usuarios.md` a `spec.md` y crear `tasks.md` y checklist.
- Resolver la decisión entre identificadores `INT` y `string`, y entre `localStorage` y un servicio compartido.
- Corregir en `data-model.md` los tipos de `expected_value`, `tolerance` y `measured_value`, y agregar unidad y tipo de comparación.
- Restaurar o implementar el código del módulo base (`index.html` y `src/`).
- Unificar el vocabulario: el README usa "lote" y un MER con `LOTE_PRODUCCION`; este plan y `data-model.md` usan `quality_inspection_*`. Debe quedar una sola fuente de verdad.
- Eliminar las copias duplicadas de `plan.md` y `data-model.md` en la raíz para evitar dos versiones distintas.
