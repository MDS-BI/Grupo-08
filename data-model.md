# Especificación del Modelo de Datos: Control de Calidad (Quality Control)

**Módulo:** Control de Calidad  
**Documento Base:** `erp_data_model.md`  
**Proyecto:** ERP Frontend MVP — Modelación de Sistemas (UdeC)  

**Integrantes del Grupo:**
* Plaza Palacio Eduardo Plaza 
* Ramírez Inostroza Agustín Antonio
* Llanos Leal Carla Antonia
* Valenzuela Carrasco Raquel Esmeralda
* Athens Squella Constanza Isidora
* Alvear Muñoz Benjamín Andrés

---

## 1. Visión General de la Estructura de Datos

El módulo de **Control de Calidad** estructura la captura de datos tanto preventivos (Planes y Criterios de Inspección) como operativos (Ejecución de Inspecciones, Resultados, No Conformidades y Acciones Correctivas CAPA). 

Es 100% compatible y se conecta fluidamente con el modelo relacional base del ERP (`erp_data_model.md`) mediante claves primarias sustitutas (`INT`) y claves foráneas cruzadas hacia **Logística e Inventario** (`products`, `goods_receipts`, `shipments`), **Recursos Humanos** (`employees`) y **Operaciones/Manufactura** (`production_orders`).

---

## 2. Diagrama Entidad-Relación (MER)

A continuación se presenta el esquema visual del modelo entidad-relación en sintaxis **Mermaid**, listo para visualizarse automáticamente en GitHub con sus atributos y relaciones:

```mermaid
erDiagram
    %% Tablas Externas del ERP Base
    PRODUCTS {
        int product_id PK
        int product_category_id FK
        int uom_id FK
        varchar sku
        varchar product_name
        varchar product_type
        decimal standard_cost
        boolean is_active
    }
    EMPLOYEES {
        int employee_id PK
        int department_id FK
        int job_title_id FK
        varchar first_name
        varchar last_name
        varchar email
        varchar employment_status
    }
    GOODS_RECEIPTS {
        int goods_receipt_id PK
        int purchase_order_id FK
        int warehouse_id FK
        date receipt_date
    }
    PRODUCTION_ORDERS {
        int production_order_id PK
        int product_id FK
        int warehouse_id FK
        decimal quantity_planned
        varchar status
    }
    SHIPMENTS {
        int shipment_id PK
        int sales_order_id FK
        int warehouse_id FK
        date ship_date
        varchar status
    }

    %% Tablas del Módulo de Control de Calidad
    QUALITY_INSPECTION_PLANS {
        int inspection_plan_id PK
        int product_id FK
        varchar plan_name
        varchar applicable_stage
    }
    QUALITY_INSPECTION_CRITERIA {
        int criteria_id PK
        int inspection_plan_id FK
        varchar criteria_name
        varchar expected_value
        varchar tolerance
    }
    QUALITY_INSPECTIONS {
        int inspection_id PK
        int inspection_plan_id FK
        int inspector_id FK
        varchar reference_module
        int reference_id
        date inspection_date
        varchar overall_result
    }
    QUALITY_INSPECTION_RESULTS {
        int result_id PK
        int inspection_id FK
        int criteria_id FK
        varchar measured_value
        boolean pass_fail
    }
    NON_CONFORMANCES {
        int non_conformance_id PK
        int inspection_id FK
        int product_id FK
        text description
        varchar severity
        varchar status
    }
    CORRECTIVE_ACTIONS {
        int corrective_action_id PK
        int non_conformance_id FK
        int responsible_employee_id FK
        text action_description
        date due_date
        varchar status
    }

    %% Relaciones con el ERP Base
    PRODUCTS ||--o{ QUALITY_INSPECTION_PLANS : "define plan para"
    PRODUCTS ||--o{ NON_CONFORMANCES : "afectado por"
    EMPLOYEES ||--o{ QUALITY_INSPECTIONS : "ejecuta inspeccion"
    EMPLOYEES ||--o{ CORRECTIVE_ACTIONS : "responsable de CAPA"
    
    %% Relaciones Internas de Control de Calidad
    QUALITY_INSPECTION_PLANS ||--|{ QUALITY_INSPECTION_CRITERIA : "contiene"
    QUALITY_INSPECTION_PLANS ||--o{ QUALITY_INSPECTIONS : "guia"
    QUALITY_INSPECTION_CRITERIA ||--o{ QUALITY_INSPECTION_RESULTS : "evalua con"
    QUALITY_INSPECTIONS ||--|{ QUALITY_INSPECTION_RESULTS : "registra mediciones"
    QUALITY_INSPECTIONS ||--o{ NON_CONFORMANCES : "origina"
    NON_CONFORMANCES ||--o{ CORRECTIVE_ACTIONS : "requiere solucion"

    %% Relaciones Polimórficas (Origen del Evento de Calidad)
    GOODS_RECEIPTS ||--o{ QUALITY_INSPECTIONS : "inspeccion incoming"
    PRODUCTION_ORDERS ||--o{ QUALITY_INSPECTIONS : "inspeccion in_process/final"
    SHIPMENTS ||--o{ QUALITY_INSPECTIONS : "inspeccion outgoing"
