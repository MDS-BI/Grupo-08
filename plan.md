* # Plan de Trabajo: Módulo ERP de Control de Calidad (Quality Control)

**Asignatura:** Modelación de Sistemas (580211) — Universidad de Concepción  
**Grupo:** Grupo 08  
**Metodología:** Spec-Driven Development (Speckit)  
**Entrega:** Avance de Repositorio (Revisión Intermedia) — Octubre 2026  

**Integrantes del Grupo:**
* Plaza Palacios Eduardo Andres
* Ramírez Inostroza Agustín Antonio
* Llanos Leal Carla Antonia
* Valenzuela Carrasco Raquel Esmeralda
* Athens Squella Constanza Isidora
* Alvear Muñoz Benjamín Andrés

---

## 1. Problema Abordado, Solución y Alcance del Módulo

* **Problema:** En muchas empresas productivas y logísticas, los controles de calidad se registran en planillas aisladas del flujo operativo. Esto provoca que materias primas defectuosas entren a producción, que lotes con fallas sigan procesándose o que productos defectuosos lleguen al cliente final, generando altos costos por devoluciones (`returns_rma`), mermas y pérdida de trazabilidad ante auditorías (como ISO 9001).
* **Solución Propuesta (MVP Frontend):** El **Módulo de Control de Calidad (Quality Control)** es una extensión transversal del software ERP. Su propósito es garantizar la conformidad de productos y procesos en toda la cadena de valor: desde la recepción de insumos por compras (`incoming`), pasando por manufactura (`in_process`), hasta la liberación previa al despacho (`final`). El MVP ofrecerá una interfaz interactiva (Frontend) para operar los flujos rutinarios de calidad con validación automática de tolerancias y compatibilidad total con el modelo relacional base (`erp_data_model.md`).

---

## 2. Definición de Clientes y Usuarios (Personas)

* **Cliente Objetivo (Comprador del ERP):** Empresas manufactureras, industriales o distribuidoras de mediano y gran tamaño que operan con inventarios físicos y cadenas de suministro integradas, y que requieren estandarizar el control técnico de sus lotes y reducir costos por fallas de calidad.

* **Usuarios Directos de la Plataforma:**

| Rol / Persona | Descripción y Necesidades | Acciones Clave en el Módulo y Tablas Asociadas |
| :--- | :--- | :--- |
| **Inspector de Calidad** (Operativo) | Personal técnico encargado de realizar mediciones directas en terreno (bodega de recepción, líneas de producción o despacho). | - Registrar eventos de inspección (`quality_inspections`) asociados a recepciones, órdenes de producción o despachos.<br>- Ingresar valores medidos (`quality_inspection_results`) comparándolos contra tolerancias esperadas.<br>- Emitir alertas automáticas si una prueba falla (`pass_fail = false`). |
| **Jefe de Calidad / Planta** (Táctico) | Encargado de definir los estándares de calidad de la empresa y asegurar la resolución de desviaciones. | - Diseñar y actualizar Planes de Inspección (`quality_inspection_plans`) y Criterios (`quality_inspection_criteria`) por producto.<br>- Clasificar y gestionar No Conformidades (`non_conformances`).<br>- Asignar Acciones Correctivas (`corrective_actions`) a empleados responsables (`employees`) con fechas límite (`due_date`). |
| **Gerente de Operaciones / Auditor** (Estratégico) | Directivo que evalúa el desempeño global de calidad, cumplimiento normativo y tendencias de defectos. | - Visualizar el Dashboard de KPIs de Calidad (% de aprobación, Pareto de defectos, costos de no calidad).<br>- Auditar la trazabilidad de lotes y evaluar el cumplimiento de plazos CAPA. |

---

## 3. Arquitectura del MVP Frontend y Complejidad de la Herramienta

El prototipo web se desarrollará modularmente en Frontend integrando 4 vistas principales, reglas de negocio automatizadas y métodos de análisis cuantitativo:

### 3.1 Vistas y Funcionalidades Interactivas
1. **Dashboard de Calidad (Página Principal)**:
   * Panel de control visual con indicadores clave de desempeño (KPIs): Tasa de aprobación general (*First Pass Yield*), No Conformidades abiertas por severidad (`minor`, `major`, `critical`), acciones correctivas vencidas e inspecciones pendientes.
   * Gráficos interactivos: Análisis de Pareto de productos (`products`) con mayor tasa de defectos y distribución de fallas por etapa operativa.
2. **Configurador de Planes de Inspección y Criterios**:
   * Vista maestro-detalle para listar y crear planes (`quality_inspection_plans`) asignados a productos del catálogo (`product_id`).
   * Formulario dinámico de criterios (`quality_inspection_criteria`), definiendo parámetros, valores nominales esperados (`expected_value`) y márgenes de tolerancia (`tolerance`) según la etapa (`incoming`, `in_process`, `final`).
3. **Motor de Ejecución de Inspección Polimórfica en Línea**:
   * Selector inteligente de documento origen mediante referencia polimórfica (`reference_module` + `reference_id`):
     * **Recepción de Compra** (`goods_receipts`)
     * **Orden de Producción** (`production_orders`)
     * **Despacho / Embarque** (`shipments`)
   * **Evaluador Automático de Tolerancias:** Al ingresar cada medición (`measured_value`), la herramienta evalúa automáticamente si se encuentra dentro del rango `expected_value ± tolerance`, asignando el booleano `pass_fail` (`true`/`false`) en tiempo real y determinando el dictamen global (`overall_result`).
4. **Gestor de No Conformidades y Flujo CAPA**:
   * Generación automática de borradores de No Conformidad (`non_conformances`) cuando una inspección resulta reprobada (`overall_result = 'failed'`), permitiendo clasificar su severidad y estado (`open`, `under_review`, `closed`).
   * Panel de Acciones Correctivas (`corrective_actions`) para asignar responsables desde el maestro de RRHH (`responsible_employee_id`), fijar fechas límite (`due_date`) y monitorear su avance (`pending`, `in_progress`, `completed`).

### 3.2 Método de Análisis y Variables Críticas
* **Tasa de Aprobación por Etapa (Yield Rate):** Proporción de inspecciones con `overall_result = 'passed'` sobre el total de inspecciones ejecutadas en cada `applicable_stage`.
* **Control de Desviación de Parámetros:** Comparación numérica entre `measured_value` y los límites de control definidos por `expected_value` y `tolerance` para detectar tendencias antes de que ocurran fallas críticas.
* **Valorización de No Calidad:** Cruce entre los productos con `non_conformances` abiertas y su costo estándar (`products.standard_cost`) para estimar el impacto financiero de los lotes retenidos.
* **Eficacia de Resolución CAPA:** Porcentaje de acciones correctivas cerradas (`status = 'completed'`) dentro del plazo establecido (`due_date`).

---

## 4. Análisis de Riesgos de Datos, Sesgos y Escalabilidad

### 4.1 Manejo de Riesgos de Datos y Mitigación de Sesgos
1. **Sesgo de Inspección Manual / Subjetividad del Inspector**:
   * *Riesgo:* La evaluación manual puede presentar variabilidad humana o sesgos de confirmación para aprobar lotes al límite de la norma.
   * *Mitigación en el Sistema:* Criterios cuantitativos estandarizados donde el sistema calcula y bloquea automáticamente el campo `pass_fail` según el valor medido, impidiendo aprobar manualmente (`overall_result = 'passed'`) una orden con criterios críticos fallidos.
2. **Protección de Datos Sensibles y Desempeño de Empleados**:
   * *Riesgo:* Asociar directamente tasas de fallas o atrasos en acciones correctivas a nombres de trabajadores (`inspector_id`, `responsible_employee_id`) puede generar ambientes punitivos o vulnerar la privacidad laboral.
   * *Mitigación en el Sistema:* Control de visualización basado en roles. Los dashboards estratégicos muestran métricas agregadas por línea, lote o producto; solo la jefatura directa visualiza las asignaciones individuales para gestión operativa.
3. **Incentivos Contrapuestos (Producción/Ventas vs. Calidad)**:
   * *Riesgo:* Presión operativa para despachar o procesar lotes defectuosos en periodos de alta demanda.
   * *Mitigación en el Sistema:* Alerta y bloqueo visual de estado en la interfaz: toda recepción, orden de producción o despacho con `overall_result = 'failed'` queda marcado en estado retenido/cuarentena hasta que se gestione su No Conformidad.

### 4.2 Escalabilidad y Desarrollo Futuro
El uso del patrón polimórfico (`reference_module`, `reference_id`) y la conexión con las tablas maestras permiten escalar el MVP hacia:
* **Bloqueo automático en Inventario (`inventory_stock`):** Conectar las inspecciones fallidas para mover automáticamente el stock afectado a `quantity_reserved` o a una ubicación física de cuarentena (`warehouse_locations`).
* **Evaluación de Proveedores (`vendors`) y Devoluciones (`returns_rma`):** Cruzar fallas en `goods_receipts` con `purchase_orders` para calificar proveedores automáticamente, e incorporar `'rma'` como nuevo módulo polimórfico para inspeccionar devoluciones de clientes.
* **Integración IoT:** Captura automática del campo `measured_value` desde instrumentos de medición digitales en planta (balanzas, sensores de temperatura o calibres digitales).

---

## 5. Plan de Trabajo y Cronograma de Desarrollo

| Fase | Hito / Entregable | Actividades Clave | Fecha Límite |
| :--- | :--- | :--- | :--- |
| **Fase 1** | **Avance de Repositorio (Intermedio - 10%)** | - Definición de la estructura de datos y compatibilidad (`data-model.md`).<br>- Elaboración del Modelo Entidad-Relación (MER) en Mermaid.<br>- Redacción y publicación del Plan de Trabajo (`plan.md`). | **Jueves 22 de Octubre (15:00 hrs)** |
| **Fase 2** | **Especificaciones y Tareas (Speckit)** | - Redacción de Historias de Usuario detalladas (`spec.md`).<br>- Desglose de tareas de desarrollo frontend (`tasks.md`).<br>- Creación de Issues en GitHub para seguimiento de decisiones. | **Semana 1-2 de Noviembre** |
| **Fase 3** | **Desarrollo del Mockup MVP (Frontend)** | - Maquetación de la interfaz web (Dashboard, Planes, Inspecciones, CAPA).<br>- Simulación de interacción de datos consistentes con `erp_data_model.md`.<br>- Pruebas de validación automática de tolerancias y navegación. | **Semana 3-4 de Noviembre** |
| **Fase 4** | **Cierre, Demo y Presentación Final (20%)** | - Publicación final en repositorio GitHub e instrucciones en `README.md`.<br>- Preparación de presentación de 5 minutos (expositor aleatorio).<br>- Defensa oral del MVP y coevaluación del equipo. | **Semana del 30 de Noviembre** |
