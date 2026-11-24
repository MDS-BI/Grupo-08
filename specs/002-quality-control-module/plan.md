# Implementation Plan: Módulo de Control de Calidad

**Branch**: `002-quality-control-module` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-quality-control-module/spec.md`

**Note**: Plan completado por `/speckit.plan`. Las tareas de implementación se generan con `/speckit.tasks` y no se crean ni modifican aquí.

## Summary

### Objetivo y alcance

Implementar el módulo de Control de Calidad como una aplicación frontend única con persistencia en `localStorage`, coherente con el ERP base. El MVP cubre planes y criterios, ejecución de inspecciones, revisión y dictamen final, no conformidades, cuarentena, CAPA con aprobación de cierre y eficacia, evidencia, dashboard, historial, exportación, alertas, bitácora, roles y permisos. No incluye backend, autenticación real ni base de datos.

La fuente canónica de comportamiento es `spec.md`; las decisiones de implementación se consolidan en `research.md`. La matriz de permisos se toma de `contracts/quality-permissions.md` y el rol activo se persiste en `erp_quality:viewer_role` sin autenticar usuarios. Las decisiones críticas de NC, KPI, auditoría, estados legacy y etiquetas visuales se aplican desde la planificación, no se dejan para el momento de codificar.

US15 es una verificación transversal, no una entrega aislada: cada historia se valida en las 15 pantallas de la matriz visual con los tres roles (`jefe_calidad`, `inspector`, `gerente`) y en los anchos 1024 px, 768 px y 360 px. Esa verificación cubre menú, dashboard, tokens, columnas y búsqueda, bandejas, responsive y accesibilidad WCAG 2.1 AA.

### Trazabilidad US1–US15

| US | Entrega verificable | Decisiones críticas trazadas |
|---|---|---|
| US1 | Planes y criterios con ciclo `draft → pending_approval → approved/rejected`, versionado y solo planes `approved` seleccionables. | Edición bloqueada con historial; duplicar como nueva versión `draft`. |
| US2 | Lotes pendientes y ejecución de inspección con plan y lista `approved`, medición por criterio y envío a `pending_review`. | `proposed_result` calculado; `overall_result` pendiente; reanudar borrador del mismo origen y plan. |
| US3 | No conformidades autogeneradas o manuales, evidencia y acciones CAPA con responsable, causa raíz, tipo y vencimiento. | La NC automática solo nace de `review_decision = rejected`; cierre de NC no exige CAPA aprobada. |
| US4 | Revisión del Jefe, guarda de críticos fallidos o sin medición, bandeja de inspecciones y cuarentena derivada. | Decisión única `approve`/`reject`; caso heredado condicional sin decisión se resuelve en bandeja sin retroceder de estado. |
| US5 | Dashboard con KPIs, gráficos, actividad reciente, alertas y accesos rápidos por rol. | `approval_rate` según FR-039; `pending_inspections = draft + pending_review`, sin el caso heredado condicional. |
| US6 | Historial filtable por lote y rango de fechas, con limpieza de filtros y estado vacío. | Búsqueda solo sobre el conjunto ya filtrado de la vista activa. |
| US7 | Exportación CSV del historial filtrado y del resumen del dashboard. | Respeta filtros válidos, incluye `criterio:medido:cumple` y bloquea exportación sin datos o con rango inválido. |
| US8 | Evidencia PNG/JPG/PDF vinculada a inspección, NC, CAPA y documento, con previsualización y descarga. | 5 MB por archivo, 8 MB acumulados y `QuotaExceededError` sin pérdida de evidencia previa. |
| US9 | Reglas de alerta configurables, desactivables y eliminables, evaluadas sobre KPIs del dashboard. | Alertas informativas y locales; nunca bloquean ni generan NC. |
| US10 | Bitácora filtrable por lote, entidad y fechas, con actor, valores y justificación. | Envío `status_change`; decisión final una sola entrada `approve`/`reject` sobre `overall_result`; override posterior una sola `status_change`; permiso denegado sin auditoría; entradas persisten tras borrado. |
| US11 | Matriz única de permisos aplicada en UI y operaciones, con indicador de rol y recálculo al cambiar de rol. | Fuente canónica `contracts/quality-permissions.md`; Inspector sin detalle individual ajeno ni bitácora; Gerente solo lectura/exportación; rol no autentica. |
| US12 | Listas de verificación con envío, aprobación, rechazo, justificación y bandeja de pendientes. | Solo `approved` se ofrecen en inspecciones; rechazada vuelve a `draft` al editarse. |
| US13 | Documentos con código, versión, archivo, revisión y bandeja de pendientes con previsualización. | `pending_review` se gestiona en `quality-approvals`; `approved` se modifica solo mediante nueva versión. |
| US14 | Cierres CAPA en bandeja con revisión de eficacia, aprobación o rechazo del Jefe. | `closure_status` separado de `status`; eficacia requerida antes de aprobar; rechazo devuelve `status = in_progress`. |
| US15 | Recorrido de verificación de 15 pantallas × 3 roles × anchos 1024/768/360 px. | Menú de 5 categorías y 12 entradas con IDs exactos; dashboard sin duplicados; tokens exactos; columnas y búsqueda sobre conjunto filtrado; bandejas con contador; WCAG AA y responsive. |

## Technical Context

**Language/Version**: JavaScript ES2022, HTML semántico y CSS existente (`src/styles.css` y `src/quality-styles.css`).

**Primary Dependencies**: Vite para desarrollo y build; Vitest + jsdom para pruebas; ESLint y Prettier como tooling del repositorio.

**Storage**: `localStorage` con colecciones JSON, marcas temporales ISO, evidencia como data URL base64 y rol activo en `erp_quality:viewer_role`.

**Testing**: Vitest + jsdom con `npm test`; cobertura unitaria de lógica pura, integración de flujos y recorridos de UI/UX; `npm run lint` y `npm run format:check` como controles de calidad.

**Target Platform**: navegadores modernos con `localStorage`, `Blob`, `FileReader` y `crypto.randomUUID` o fallback equivalente.

**Project Type**: aplicación web frontend; un único proyecto Vite (`single Vite project`) en la raíz del repositorio, sin paquetes `backend`, `frontend` ni `api`.

**Performance Goals**: dashboard y consultas ≤ 2 s con 500 inspecciones; búsqueda ≤ 1 s; exportación ≤ 2 s; feedback visual de operaciones en ≤ 300 ms.

**Constraints**: evidencia de 5 MB por archivo y 8 MB acumulados con manejo de `QuotaExceededError`; sin backend ni autenticación real; el rol activo persiste en `erp_quality:viewer_role` y no otorga permisos fuera de la matriz.

**Scale/Scope**: hasta 500 inspecciones almacenadas; 15 pantallas, 3 roles y 3 anchos de verificación; menú de 5 categorías y 12 entradas; una sola organización y un solo espacio de trabajo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación en el plan | Estado |
|---|---|---|
| I. Code Quality & Maintainability | Lógica pura en `permissions.js`, `quality-status.js`, `inspection-engine.js` y `quality-migrations.js`; una sola matriz de permisos y una sola fuente de transiciones; módulos pequeños y dependencias existentes. | PASS |
| II. Test-First & Verification | Pruebas unitarias e integración planificadas antes o junto a cada cambio; regresión US1–US15; verificación explícita de US15 en 15 pantallas × 3 roles × 3 anchos. | PASS |
| III. User Experience Consistency | Tokens, menú, dashboard, bandejas, columnas, etiquetas, mensajes, estados vacíos y accesibilidad se rigen por `spec.md`; `status-badge.js` y `permission-notice.js` unifican feedback. | PASS |
| IV. Performance & Reliability | Cálculos en memoria sobre un conjunto acotado de 500 registros, paginación/filtros en vista, validación previa de cuota y sin round-trips de red. | PASS |
| Quality Standards | ESLint, Prettier, `git diff --check` y documentación de contratos actualizada cuando cambie el comportamiento; decisiones complejas registradas en `research.md`. | PASS |
| Development Workflow | Incrementos pequeños con criterios verificables; las tareas se derivan con `/speckit.tasks`; pruebas y validación de UX son obligatorias antes de cerrar cada entrega. | PASS |

**Resultado del gate**: PASS como gate de planificación. Este PASS no declara la feature implementada ni completa: las tareas de implementación quedan para `/speckit.tasks` y se ejecutan después. Las pruebas y la verificación de UX son obligatorias; mientras existan tareas pendientes de implementación, el estado de entrega es NO PASS. Esta distinción corrige el hallazgo N-01 sin ocultar trabajo pendiente.

**Re-check after Phase 1**: PASS. Tras la fase de diseño se mantiene un único proyecto Vite, la lógica compleja sigue aislada en módulos puros, no aparecen violaciones nuevas y se conservan las mismas obligaciones de pruebas y UX. Tampoco en este re-check se interpreta PASS como implementación terminada.

## Project Structure

### Documentation (this feature)

```text
specs/002-quality-control-module/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── inspection-engine.md
│   ├── quality-permissions.md
│   ├── quality-storage.md
│   └── quality-workflow.md
├── checklists/
│   ├── quality-control.md
│   └── requirements.md
├── mer.png
└── tasks.md
```

`tasks.md` se conserva sin modificaciones en esta entrega; su regeneración corresponde a `/speckit.tasks`.

### Source Code (repository root)

```text
package.json
vitest.config.mjs
eslint.config.mjs
src/
├── main.js
├── app.js
├── storage.js
├── inspection-engine.js
├── module-config.js
├── seed-data.js
├── styles.css
├── quality-styles.css
├── permissions.js (nuevo)
├── quality-status.js (nuevo)
├── quality-migrations.js (nuevo)
├── speckit_template/
│   └── __init__.py
└── components/
    ├── capa-manager.js
    ├── checklist-manager.js
    ├── csv.js
    ├── custom-fields.js
    ├── dashboard.js
    ├── document-form.js
    ├── document-list.js
    ├── entity-form.js
    ├── entity-list.js
    ├── evidence.js
    ├── inspection-engine.js
    ├── inspection-history.js
    ├── non-conformance-capa.js
    ├── pending-lots.js
    ├── quality-audit-log.js
    ├── quality-document-manager.js
    ├── quality-plan-config.js
    ├── quality-reports.js
    ├── quality-settings.js
    ├── quality-utils.js
    ├── search-bar.js
    ├── shell.js
    ├── review-queue.js (nuevo)
    ├── status-badge.js (nuevo)
    └── permission-notice.js (nuevo)

tests/
├── setup/
│   └── setup.js
├── support/
│   └── quality-dom.js
├── unit/
│   ├── derivations.test.js
│   ├── inspection-engine.test.js
│   ├── module-config.test.js
│   ├── quality-audit-log.test.js
│   ├── quality-plan-config.test.js
│   ├── quality-storage.test.js
│   ├── storage.test.js
│   ├── permissions.test.js (nueva)
│   ├── quality-status.test.js (nueva)
│   └── quality-migrations.test.js (nueva)
└── integration/
    ├── add-document.test.js
    ├── capa-manager.test.js
    ├── create-entity.test.js
    ├── custom-fields.test.js
    ├── dashboard.test.js
    ├── edit-delete-entity.test.js
    ├── full-flow.test.js
    ├── inspection-flow.test.js
    ├── inspection-history.test.js
    ├── manage-document.test.js
    ├── manage-tabs.test.js
    ├── non-conformance-capa.test.js
    ├── quality-alerts.test.js
    ├── quality-audit-log.test.js
    ├── quality-checklists.test.js
    ├── quality-dashboard.test.js
    ├── quality-documents.test.js
    ├── quality-evidence.test.js
    ├── quality-export.test.js
    ├── quality-reports.test.js
    ├── quality-settings.test.js
    ├── relabeling.test.js
    ├── review-quarantine.test.js
    ├── search-entities.test.js
    ├── workspace-shell.test.js
    ├── inspection-review.test.js (nueva)
    ├── quality-review-queue.test.js (nueva)
    ├── quality-ui-consistency.test.js (nueva)
    ├── quality-responsive.test.js (nueva)
    └── quality-visual-matrix.test.js (nueva)
```

Los archivos sin marca son existentes; las marcas `(nuevo)` y `(nueva)` identifican los planificados. `review-queue.js` concentra las cuatro bandejas de la "Matriz de bandejas" bajo `quality-approvals`; `status-badge.js` y `permission-notice.js` sirven a las 15 pantallas. La verificación 15 × 3 × 3 se registra en `quality-visual-matrix.test.js` con apoyo de `quality-responsive.test.js` y `quality-ui-consistency.test.js`.

**Structure Decision**: se adopta un único proyecto Vite (`single Vite project`) en la raíz del repositorio. No se crean `backend/`, `frontend/` ni `api/` porque no hay servidor, base de datos ni autenticación real. La lógica de dominio pura vive en módulos de `src/`, las vistas en `src/components/` y las pruebas unitarias y de integración en `tests/`. Los módulos nuevos son envoltorios necesarios para permisos, estados, migración y bandejas; no introducen paquetes ni un segundo proyecto.

## Complexity Tracking

No se identifican violaciones de la constitución que requieran justificación. No se añaden excepciones ni justificaciones inventadas.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Ninguna | No aplica: el gate de planificación está en PASS sin excepciones. | No aplica: no se reclama ninguna excepción. |
