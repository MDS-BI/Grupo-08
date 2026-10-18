# Plan de Trabajo: Módulo ERP de Control de Calidad

**Asignatura:** Modelación de Sistemas (580211) — Universidad de Concepción   
**Metodología:** Spec-Driven Development (Speckit)   
**Entrega:** Avance de Repositorio (Revisión Intermedia) — Octubre 2026

---

## 1\. Resumen Ejecutivo y Alcance del Módulo

El **Módulo de Control de Calidad** es una extensión fundamental del software ERP institucional. Su propósito principal es garantizar la conformidad de los productos y procesos a lo largo de toda la cadena de valor: desde la recepción de materias primas por compras, pasando por el proceso de fabricación, hasta la liberación final previa al despacho.

El objetivo de este proyecto es desarrollar un **Producto Mínimo Viable (MVP)** funcional a nivel de **Frontend (interfaz de usuario interactiva)** , que permita a los usuarios operar los flujos rutinarios de gestión de calidad, manteniendo total compatibilidad con el modelo relacional base del ERP ( `erp_data_model.md`).

---

## 2\. Definición de Usuarios y Casos de Uso (Personas)

| Rol / Persona                                      | Descripción y Necesidades                                                                                                     | Acciones Clave en el Módulo                                                                                                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inspector de Calidad** (Operativo)               | Personal técnico encargado de realizar mediciones directas en terreno (recepción de insumos, líneas de producción o almacén). | \- Registrar eventos de inspección asociados a recepciones, órdenes de producción o despachos.- Ingresar valores medidos comparándolos contra tolerancias esperadas.- Emitir alertas automáticas si una prueba falla ( `pass_fail = false`). |
| **Jefe de Calidad / Planta** (Táctico)             | Encargado de definir los estándares de calidad de la empresa y asegurar la resolución de desviaciones.                        | \- Diseñar y actualizar Planes de Inspección y Criterios por producto.- Aprobar o gestionar No Conformidades (NC).- Asignar Acciones Correctivas (CAPA) a empleados responsables con fechas límite.                                          |
| **Gerente de Operaciones / Auditor** (Estratégico) | Directivo que evalúa el desempeño global de calidad, cumplimiento normativo y tendencias de defectos.                         | \- Visualizar el Dashboard de KPIs de Calidad (% de aprobación, Pareto de defectos).- Auditar la trazabilidad de lotes y evaluar la confiabilidad de proveedores e inspectores.                                                              |

---

## 3\. Arquitectura del MVP Frontend y Pantallas

El prototipo web se desarrollará modularmente en Frontend integrando las siguientes vistas y herramientas:

1. **Panel de Calidad (Página Principal)** :

  * Panel de control visual con indicadores clave de desempeño (KPIs): Tasa de aprobación general, No Conformidades abiertas por severidad, e inspecciones pendientes.
  * Gráficos interactivos: Análisis de Pareto de principales defectos y tendencia temporal de fallas.
2. **Gestión de Planes de Inspección y Criterios** :

  * Vista para listar y crear planos ( `quality_inspection_plans`) asignados a productos específicos ( `product_id`).
  * Formulario de configuración de criterios ( `quality_inspection_criteria`), definiendo valores esperados, parámetros y rangos de tolerancia por etapa ( `incoming`, `in_process`, `final`).
3. **Módulo de Ejecución de Inspección en Línea** :

  * Formulario dinámico de inspección ( `quality_inspections`) que se adapta según el documento de origen mediante referencia polimórfica:  
    * **Recepción de Compra** ( `goods_receipts`)
    * **Orden de Producción** ( `production_orders`)
    * **Despacho / Embarque** ( `shipments`)
  * Registro línea por línea de mediciones reales ( `quality_inspection_results`) con validación automática instantánea.
4. **Gestión de No Conformidades y Acciones Correctivas (CAPA)** :

  * Tabla de seguimiento de No Conformidades ( `non_conformances`), permitiendo clasificar la severidad ( `minor`, `major`, `critical`) y cambiar su estado ( `open`, `under_review`, `closed`).
  * Panel de Acciones Correctivas ( `corrective_actions`) para asignar responsables ( `responsible_employee_id`) y monitorear fechas de vencimiento.

---

## 4\. Análisis de Riesgos de Datos, Sesgos y Aspectos Éticos

En consonancia con las exigencias del proyecto de Modelación de Sistemas, se han identificado tres dimensiones críticas de sesgos y riesgos en el manejo de datos de calidad:

1. **Manual de Sesgo de Inspección / Subjetividad del Inspector** :

  * *Riesgo:* La evaluación cualitativa o la toma de muestras manuales pueden presentar variabilidad humana o signos de confirmación por parte de inspectores específicos.
  * *Mitigación en el Sistema:* Implementación de criterios cuantitativos estandarizados con rangos numéricos rígidos, registro obligatorio del ID del inspector ( `inspector_id`) y protocolos de auditoría/segunda firma para No Conformidades críticas.
2. **Protección de Datos Sensibles y Desempeño de Empleados** :

  * *Riesgo:* Asociar directamente tasas de fallas o correctivas no resultados a nombres de empleados puede generar ambientes acciones punitivas o vulnerar la privacidad del personal.
  * *Mitigación en el Sistema:* Control de acceso basado en roles (RBAC). Los tableros ejecutivos muestran métricas agregadas y anonimizadas; solo el Jefe de Planta tiene visibilidad de las asignaciones individuales de CAPA.
3. **Incentivos Contrapuestos (Producción vs. Calidad)** :

  * *Riesgo:* Presión operativa para liberar lotes defectuosos en periodos de alta demanda.
  * *Mitigación en el Sistema:* Bloqueo sistémico automático en la base de datos: si un resultado de inspección resulta reprobado ( `pass_fail = false`), la orden de producción o recepción queda en estado congelado/cuarentena en la interfaz.

---

## 5\. Plan de Trabajo y Cronograma de Desarrollo

| Fase       | Hito / Entregable                             | Actividades Clave                                                                                                                                                                             | Fecha Límite                       |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Fase 1** | **Avance de Repositorio (Intermedio)**        | \- Definición de la estructura de datos ( `data-model.md`).- Elaboración del Modelo Entidad-Relación (MER) en Mermaid.- Redacción y publicación del Plan de Trabajo ( `plan.md`).             | **20 de Octubre** *(Jueves 15:00)* |
| **Fase 2** | **Especificaciones y Tareas (Speckit)**       | \- Redacción de Historias de Usuario detalladas ( `spec.md`).- Desglose de tareas de desarrollo frontend ( `tasks.md`).- Creación de Issues en GitHub para seguimiento de decisiones.         | **Semana 1-2 de Noviembre**        |
| **Fase 3** | **Desarrollo del Mockup MVP (Frontend)**      | \- Maquetación de la interfaz web (Dashboard, Inspecciones, CAPA).- Simulación de interacción de datos con componentes React/Vue/HTML.- Pruebas de usabilidad y navegación entre componentes. | **Semana 3-4 de Noviembre**        |
| **Fase 4** | **Cierre, Demostración y Presentación Final** | \- Publicación final en repositorio GitHub.- Preparación de diapositivas para la presentación de 5 minutos.- Defensa oral del MVP y coevaluación del equipo.                                  | **Semana del 30 de Noviembre**     |
