# Modelo de Datos: Módulo de Control de Calidad

**Módulo:** Control de Calidad  
**Proyecto:** ERP Frontend MVP — Modelación de Sistemas (UdeC)  
**Modelo relacionado:** [Módulo Base ERP](../001-erp-base-module/data-model.md)

## 1. Propósito y alcance

Este documento define las estructuras de datos para gestionar el control de calidad preventivo y operativo: planes y criterios de inspección, inspecciones, resultados, no conformidades y acciones correctivas o preventivas (CAPA). Además, modela la evidencia documental adjunta a inspecciones y no conformidades y las reglas de alerta configurables sobre los indicadores del dashboard.

El módulo se integra con productos, empleados, recepciones, órdenes de producción y despachos. Estas entidades son dependencias de otros módulos ERP; no se consideran creadas por este modelo de Control de Calidad. El "lote" de las historias de usuario se representa mediante el documento origen (`reference_module` + `reference_id`); no existe una entidad de lote separada.

## 2. Diagrama entidad-relación
![Modelo Entidad-Relación](mer.png)

```mermaid
erDiagram
    PRODUCTS {
        string product_id PK
    }
    EMPLOYEES {
        string employee_id PK
    }
    GOODS_RECEIPTS {
        string goods_receipt_id PK
    }
    PRODUCTION_ORDERS {
        string production_order_id PK
    }
    SHIPMENTS {
        string shipment_id PK
    }

    QUALITY_INSPECTION_PLANS {
        string inspection_plan_id PK
        string product_id FK
        varchar plan_name
        varchar applicable_stage
        boolean is_locked
    }
    QUALITY_INSPECTION_CRITERIA {
        string criteria_id PK
        string inspection_plan_id FK
        varchar criteria_name
        decimal expected_value
        decimal tolerance
        varchar unit
        varchar comparison_type
        boolean is_critical
        boolean is_locked
    }
    QUALITY_INSPECTIONS {
        string inspection_id PK
        string inspection_plan_id FK
        string inspector_id FK
        varchar reference_module
        string reference_id
        date inspection_date
        varchar inspection_status
        varchar overall_result
        text override_justification
        varchar overridden_by
        timestamp override_at
    }
    QUALITY_INSPECTION_RESULTS {
        string result_id PK
        string inspection_id FK
        string criteria_id FK
        decimal measured_value
        boolean pass_fail
    }
    NON_CONFORMANCES {
        string non_conformance_id PK
        string inspection_id FK
        string product_id FK
        text description
        varchar defect_type
        varchar severity
        varchar status
    }
    CORRECTIVE_ACTIONS {
        string corrective_action_id PK
        string non_conformance_id FK
        string responsible_employee_id FK
        text action_description
        text root_cause
        varchar action_type
        date due_date
        varchar status
    }
    QUALITY_EVIDENCE {
        string evidence_id PK
        string entity_type
        string entity_id
        varchar file_name
        varchar mime_type
        int size_bytes
        text data_url
        string uploaded_by
        timestamp uploaded_at
    }
    QUALITY_ALERT_RULES {
        string alert_rule_id PK
        varchar metric
        varchar operator
        decimal threshold
        varchar severity
        boolean is_active
    }

    PRODUCTS ||--o{ QUALITY_INSPECTION_PLANS : "define plan para"
    PRODUCTS ||--o{ NON_CONFORMANCES : "producto afectado"
    EMPLOYEES ||--o{ QUALITY_INSPECTIONS : "ejecuta"
    EMPLOYEES ||--o{ CORRECTIVE_ACTIONS : "responsable"
    QUALITY_INSPECTION_PLANS ||--|{ QUALITY_INSPECTION_CRITERIA : "contiene"
    QUALITY_INSPECTION_PLANS ||--o{ QUALITY_INSPECTIONS : "guia"
    QUALITY_INSPECTION_CRITERIA ||--o{ QUALITY_INSPECTION_RESULTS : "se evalua en"
    QUALITY_INSPECTIONS ||--|{ QUALITY_INSPECTION_RESULTS : "registra"
    QUALITY_INSPECTIONS ||--o{ NON_CONFORMANCES : "origina"
    NON_CONFORMANCES ||--o{ CORRECTIVE_ACTIONS : "requiere"
    QUALITY_INSPECTIONS ||--o{ QUALITY_EVIDENCE : "evidencia de"
    NON_CONFORMANCES ||--o{ QUALITY_EVIDENCE : "evidencia de"
    GOODS_RECEIPTS ||--o{ QUALITY_INSPECTIONS : "referencia polimorfica"
    PRODUCTION_ORDERS ||--o{ QUALITY_INSPECTIONS : "referencia polimorfica"
    SHIPMENTS ||--o{ QUALITY_INSPECTIONS : "referencia polimorfica"
```

Las relaciones desde recepciones, órdenes de producción y despachos representan referencias polimórficas: `reference_module` identifica el módulo de origen y `reference_id` identifica su registro. No son claves foráneas convencionales y requieren validación de la aplicación o una estrategia de integración equivalente.

> **Nota de implementación.** El diagrama usa identificadores `string` para reflejar el MVP frontend con `localStorage`, coherente con el módulo base. Si se implementa el diseño relacional lógico con claves `INT`, debe existir una capa de mapeo explícita `INT ↔ string` documentada en [contracts/quality-storage.md](contracts/quality-storage.md). Las reglas de negocio y cardinalidades no cambian.

## 3. Diccionario de datos

### 3.1 `quality_inspection_plans`

Define las pautas de control aplicables a un producto.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `inspection_plan_id` | STRING | PK | Autogenerado | Identificador único del plan. |
| `product_id` | STRING | FK | `products.product_id` | Producto al que se aplica el plan. |
| `plan_name` | VARCHAR | — | Not Null | Nombre descriptivo del plan. |
| `applicable_stage` | VARCHAR | — | `incoming`, `in_process`, `final` | Etapa en que se aplica la inspección. |
| `is_locked` | BOOLEAN | — | Default `false` | Indica que el plan tiene inspecciones históricas y no puede editarse ni eliminarse. |

### 3.2 `quality_inspection_criteria`

Detalla los parámetros que deben evaluarse para un plan.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `criteria_id` | STRING | PK | Autogenerado | Identificador único del criterio. |
| `inspection_plan_id` | STRING | FK | `quality_inspection_plans.inspection_plan_id` | Plan al que pertenece el criterio. |
| `criteria_name` | VARCHAR | — | Not Null | Variable o parámetro que se evalúa (por ejemplo, peso, pH o dimensión). |
| `expected_value` | DECIMAL | — | Not Null | Valor o límite estándar de referencia. |
| `tolerance` | DECIMAL | — | Not Null, >= 0 | Margen de tolerancia permitido para `range`. |
| `unit` | VARCHAR | — | Not Null | Unidad de medida (kg, °C, mm, etc.). |
| `comparison_type` | VARCHAR | — | `range`, `min`, `max`, `boolean` | Regla de comparación aplicada al medir. |
| `is_critical` | BOOLEAN | — | Not Null | Indica si el incumplimiento genera `failed`. |
| `is_locked` | BOOLEAN | — | Default `false` | Indica que el criterio tiene resultados históricos y no puede editarse ni eliminarse. |

### 3.3 `quality_inspections`

Registra un evento de inspección.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `inspection_id` | STRING | PK | Autogenerado | Identificador único de la inspección. |
| `inspection_plan_id` | STRING | FK | `quality_inspection_plans.inspection_plan_id` | Plan utilizado. |
| `inspector_id` | STRING | FK | `employees.employee_id` | Empleado que ejecuta la inspección. |
| `reference_module` | VARCHAR | Polimórfica | `goods_receipt`, `production_order`, `shipment` | Módulo del registro inspeccionado. |
| `reference_id` | STRING | Polimórfica | ID del registro origen | Identificador del lote/documento inspeccionado. |
| `inspection_date` | DATE | — | Not Null | Fecha de realización. |
| `inspection_status` | VARCHAR | — | `draft`, `completed` | Estado del registro de inspección. |
| `overall_result` | VARCHAR | — | `passed`, `failed`, `conditional`; Null mientras `draft` | Dictamen global derivado. |
| `override_justification` | TEXT | — | Obligatorio si cambia el dictamen | Motivo registrado del cambio manual. |
| `overridden_by` | VARCHAR | — | Obligatorio si cambia el dictamen | Usuario o rol que autoriza el cambio. |
| `override_at` | TIMESTAMP | — | Obligatorio si cambia el dictamen | Fecha y hora del cambio de dictamen. |

### 3.4 `quality_inspection_results`

Almacena las mediciones de cada criterio evaluado durante una inspección.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `result_id` | STRING | PK | Autogenerado | Identificador único del resultado. |
| `inspection_id` | STRING | FK | `quality_inspections.inspection_id` | Inspección a la que pertenece. |
| `criteria_id` | STRING | FK | `quality_inspection_criteria.criteria_id` | Criterio evaluado. |
| `measured_value` | DECIMAL | — | Not Null | Valor numérico obtenido en la medición. |
| `pass_fail` | BOOLEAN | — | Not Null, calculado | Indica si el criterio se cumple. |

### 3.5 `non_conformances`

Registra desviaciones o defectos detectados.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `non_conformance_id` | STRING | PK | Autogenerado | Identificador único de la no conformidad. |
| `inspection_id` | STRING | FK | `quality_inspections.inspection_id` | Inspección en la que se detectó. |
| `product_id` | STRING | FK | `products.product_id` | Producto afectado, tomado del plan. |
| `description` | TEXT | — | Not Null, no vacío | Descripción de la anomalía; autogenerada y editable. |
| `defect_type` | VARCHAR | — | `dimensional`, `functional`, `packaging`, `other` | Tipo de defecto; por defecto `other` al autogenerarse. |
| `severity` | VARCHAR | — | `minor`, `major`, `critical` | Nivel de impacto; por defecto `major` al autogenerarse. |
| `status` | VARCHAR | — | `open`, `under_review`, `closed` | Estado de resolución; por defecto `open`. |

### 3.6 `corrective_actions`

Define las acciones correctivas o preventivas (CAPA) asociadas a no conformidades.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `corrective_action_id` | STRING | PK | Autogenerado | Identificador único de la acción. |
| `non_conformance_id` | STRING | FK | `non_conformances.non_conformance_id` | No conformidad que origina la acción. |
| `responsible_employee_id` | STRING | FK | `employees.employee_id` | Empleado responsable. |
| `action_description` | TEXT | — | Not Null | Medida que se debe aplicar. |
| `root_cause` | TEXT | — | Not Null | Causa raíz identificada. |
| `action_type` | VARCHAR | — | `resampling`, `rework`, `other` | Tipo de acción a ejecutar. |
| `due_date` | DATE | — | Not Null | Fecha límite de implementación. |
| `status` | VARCHAR | — | `pending`, `in_progress`, `completed` | Estado de la acción. |

### 3.7 `quality_evidence`

Almacena los archivos de respaldo adjuntos a inspecciones o no conformidades.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `evidence_id` | STRING | PK | Autogenerado | Identificador único de la evidencia. |
| `entity_type` | VARCHAR | Polimórfica | `inspection`, `non_conformance` | Tipo de registro al que se vincula. |
| `entity_id` | STRING | Polimórfica | ID de la inspección o no conformidad existente | Registro al que pertenece la evidencia. |
| `file_name` | VARCHAR | — | Not Null | Nombre original del archivo. |
| `mime_type` | VARCHAR | — | Not Null; `image/png`, `image/jpeg`, `application/pdf` | Tipo de archivo permitido. |
| `size_bytes` | INT | — | Not Null, > 0 y <= 5242880 | Tamaño del archivo (máximo 5 MB). |
| `data_url` | TEXT | — | Not Null; data URL base64 | Contenido del archivo para descarga local. |
| `uploaded_by` | STRING | — | Not Null | Empleado o usuario que adjunta la evidencia. |
| `uploaded_at` | TIMESTAMP | — | Not Null | Fecha y hora de la carga. |

**Restricción acumulada:** la suma de `size_bytes` de toda la colección no debe superar 8 MB; si una carga excede ese límite o la cuota de `localStorage`, se rechaza y se conserva la evidencia existente.

### 3.8 `quality_alert_rules`

Define umbrales configurables sobre los indicadores del dashboard de calidad.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `alert_rule_id` | STRING | PK | Autogenerado | Identificador único de la regla. |
| `metric` | VARCHAR | — | `approval_rate`, `open_non_conformances`, `overdue_capa`, `capa_effectiveness`, `pending_inspections` | Indicador del dashboard que se evalúa. |
| `operator` | VARCHAR | — | `lt`, `lte`, `gt`, `gte`, `eq` | Operador de comparación del umbral. |
| `threshold` | DECIMAL | — | Not Null; rango según la métrica | Valor límite de la regla. |
| `severity` | VARCHAR | — | `info`, `warning`, `critical` | Severidad de la alerta. |
| `is_active` | BOOLEAN | — | Default `true` | Indica si la regla se evalúa en el dashboard. |

**Rangos de umbral:** `approval_rate` y `capa_effectiveness` admiten 0–100; `open_non_conformances`, `overdue_capa` y `pending_inspections` admiten valores ≥ 0.

### 3.9 `quality_audit_log`

Bitácora inmutable de altas, ediciones, cambios de estado y eliminaciones sobre inspecciones, no conformidades y acciones CAPA.

| Columna | Tipo | Clave | Referencia / Restricción | Descripción |
|---|---|---|---|---|
| `id` | STRING | PK | Autogenerado | Identificador de la entrada de auditoría. |
| `entity_type` | VARCHAR | — | `inspection`, `non_conformance`, `corrective_action` | Tipo de entidad auditada. |
| `entity_id` | STRING | — | Not Null | Identificador de la entidad, conservado tras la eliminación. |
| `reference_module` | VARCHAR | — | Not Null | Módulo origen del lote. |
| `reference_id` | STRING | — | Not Null | Documento origen; permite filtrar aunque la entidad ya no exista. |
| `action` | VARCHAR | — | `create`, `update`, `status_change`, `delete` | Operación registrada. |
| `changed_field` | VARCHAR | — | Not Null | Campo modificado. |
| `before_value` | JSON | — | `null` en `create` | Valor anterior. |
| `after_value` | JSON | — | `null` en `delete` | Valor nuevo. |
| `actor` | STRING | — | Not Null | Empleado de la operación; en su defecto el rol activo como metadato. |
| `timestamp` | TIMESTAMP | — | Not Null; ISO 8601 | Fecha y hora del cambio. |
| `justification` | TEXT | — | Opcional | Motivo del cambio de dictamen cuando aplica. |

**Regla de conservación:** las entradas `delete` persisten tras eliminaciones permitidas, incluida la eliminación directa de CAPA y las cascadas de FR-026. El cambio de dictamen emite una sola entrada `status_change` sobre `overall_result`, sin duplicarla como `update` genérico.

## 4. Integración con otros módulos

| Dato de Control de Calidad | Módulo de destino | Propósito |
|---|---|---|
| `quality_inspection_plans.product_id` | Logística: `products.product_id` | Asociar planes de inspección al catálogo de productos. |
| `quality_inspections.inspector_id` | Recursos Humanos: `employees.employee_id` | Identificar al inspector responsable. |
| `quality_inspections.reference_module` + `reference_id` | Compras, Manufactura o Despachos | Mantener trazabilidad con recepciones, órdenes de producción y despachos. |
| `non_conformances.product_id` | Logística: `products.product_id` | Identificar el producto afectado. |
| `corrective_actions.responsible_employee_id` | Recursos Humanos: `employees.employee_id` | Asignar la ejecución de la acción CAPA. |

### Consideraciones de integración

- El [modelo de datos del módulo base](../001-erp-base-module/data-model.md) define `Entity` y `Document`, pero no define las tablas `products`, `employees`, `goods_receipts`, `production_orders` ni `shipments`. Esas referencias dependen de los módulos correspondientes y no deben considerarse implementadas por este documento.
- El MVP usa identificadores `string` y `localStorage`. El modelo relacional con `INT` se conserva como diseño lógico; cualquier implementación relacional requiere una capa de mapeo explícita.
- El campo polimórfico `reference_id` no puede garantizar por sí solo la existencia del registro de origen mediante una clave foránea relacional. La integración debe validar el par `reference_module` y `reference_id`.
- La implementación de este modelo requiere integrar las dependencias externas; documentar las relaciones no agrega esas entidades ni cambia el código de la aplicación.

## 5. Reglas de negocio e integridad

- **Habilitación de planes:** un plan sin al menos un criterio no se habilita para iniciar inspecciones.
- **Evaluación:** `pass_fail` se calcula según `comparison_type`:
  - `range`: `expected_value - tolerance <= measured_value <= expected_value + tolerance`.
  - `min`: `measured_value >= expected_value`.
  - `max`: `measured_value <= expected_value`.
  - `boolean`: `measured_value` coincide con `expected_value` (1 = cumple, 0 = no cumple).
- **Inspección incompleta:** si falta la medición de cualquier criterio o el valor no es numérico, la inspección permanece `draft` y no tiene `overall_result`.
- **Dictamen:** con la inspección completa, `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos cumplen.
- **Cambio manual:** el Jefe de Calidad puede cambiar `overall_result` solo con `override_justification`, `overridden_by` y `override_at`; nunca puede establecer `passed` si existe un criterio crítico fallido o sin medición.
- **Revisión condicional:** `conditional` se muestra en la bandeja de revisión y no genera no conformidad automática.
- **No conformidad automática:** una inspección `failed` genera un borrador `open` con tipo de defecto `other`, severidad `major`, producto del plan y descripción autogenerada de los criterios incumplidos.
- **CAPA vencida:** una acción con `due_date` anterior a la fecha actual y `status != completed` se marca como vencida sin cambiar su estado.
- **Bloqueo histórico:** un plan o criterio con resultados de inspección asociados tiene `is_locked = true` y no puede editarse ni eliminarse; el plan se duplica para crear una nueva versión.
- **Eliminación:** plan sin inspecciones elimina sus criterios en cascada; inspección sin no conformidad elimina sus resultados y su evidencia en cascada; inspección con no conformidad no se elimina; no conformidad elimina sus CAPA y su evidencia en cascada.
- **Lotes pendientes:** se derivan de los documentos origen externos que no tienen una inspección `completed`; una inspección `draft` no marca el lote como inspeccionado.
- **Cuarentena:** un lote con al menos una no conformidad en estado `open` o `under_review` se muestra como retenido/en cuarentena; si tiene una CAPA asociada se muestra "Cuarentena - En tratamiento".
- **Exportación:** es una vista derivada de los datos consultados. El historial en CSV UTF-8 incluye una columna `resultados` con `criterio:medido:cumple` separado por `;`, respeta los filtros activos y el resumen usa los mismos KPIs del dashboard; no se persiste una entidad de exportación.
- **Evidencia:** un archivo se vincula a una inspección o no conformidad existente mediante `entity_type` + `entity_id`; se aceptan solo PNG/JPG/PDF de hasta 5 MB por archivo, con un máximo acumulado de 8 MB y manejo de cuota, y se rechazan tipos no permitidos, contenido vacío y vínculos a registros inexistentes.
- **Alertas:** una regla activa se evalúa contra el KPI indicado al abrir o actualizar el dashboard; se validan indicadores, operadores, severidades y rangos (0–100 en tasas, ≥ 0 en conteos), y no se permite más de una regla activa por `metric` + `operator`.
- **Desactivación de alertas:** una regla desactivada (`is_active = false`) o eliminada deja de mostrar su alerta; si se elimina, se retira del almacenamiento sin afectar otras reglas.
- **Cascada de evidencia:** la evidencia se elimina en cascada con su inspección (sin no conformidad) o con su no conformidad; si la inspección tiene no conformidad, su eliminación se bloquea y la evidencia permanece. Las alertas son informativas y no generan no conformidades ni bloqueos.

## 6. Trazabilidad de no conformidades y CAPA

Los resultados de inspección permiten identificar criterios incumplidos. Una inspección puede originar no conformidades, y cada no conformidad puede tener acciones correctivas o preventivas con responsable, causa raíz, tipo de acción, fecha límite y estado. Este encadenamiento conserva la trazabilidad desde la medición hasta la resolución.
