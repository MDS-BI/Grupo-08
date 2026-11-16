# Quality Control Requirements Checklist: Módulo de Control de Calidad

**Purpose**: Validate the completeness, clarity, consistency, measurability, and coverage of the Control de Calidad requirements before implementation.
**Created**: 2026-11-01
**Feature**: [spec.md](../spec.md)
**Scope**: Requirements quality only; this checklist does not verify implementation behavior.
**Depth**: Standard
**Audience**: Reviewer / QA

## Requirement Completeness

- [x] CHK001 Are lifecycle requirements defined for inspection plans and criteria across creation, editing, duplication, locking, and deletion? [Completeness, Spec §FR-001, §FR-026] — Sí: FR-001/FR-026, US1 escenarios 4–6 y reglas de bloqueo/duplicación/cascada están definidos; `storage.js` y `quality-plan-config.js` reflejan el modelo.
- [x] CHK002 Are inspection state requirements complete for `draft` and `completed`, including allowed transitions? [Completeness, Spec §FR-005, §FR-012] — Sí: estados `draft`/`completed`, permanencia en `draft` si incompleta y derivación de dictamen solo al completar (FR-005/012/013); `inspection-engine.js` y `storage.js` lo contemplan.
- [x] CHK003 Are pending-lot derivation requirements complete regarding source documents, completed inspections, and `draft` inspections? [Completeness, Spec §FR-030, §Assumptions] — Sí: lotes pendientes = orígenes externos sin inspección `completed`, `draft` no inspecciona y se reanuda (FR-030/036, §Assumptions); `derivePendingLots` y vista `pending-lots.js`.
- [x] CHK004 Are quarantine entry and exit requirements fully specified for lots and their non-conformities? [Completeness, Spec §FR-031, §US4] — Sí: entra/mantiene con NC `open`/`under_review`, “En tratamiento” si hay CAPA, sale al cerrar NC (FR-031/035, US4.5–7); `deriveQuarantineLots`.
- [x] CHK005 Are the full lifecycle requirements for `conditional` inspections defined: entry, review action, and exit? [Completeness, Spec §FR-029, §US4] — Sí: se genera por evaluación, va a bandeja sin NC, se resuelve por cambio de dictamen con auditoría y sale cuando deja de ser `conditional` (FR-029/037, US4.4); implementado en vista de revisión/override.
- [x] CHK006 Are CAPA requirements complete for creation, overdue identification, and closure? [Completeness, Spec §FR-017, §FR-018, §FR-019] — Sí: creación/asociación, campos obligatorios, estados `pending/in_progress/completed`, vencimiento y cierre con `completed_at` (FR-017/018/019/038); `isCapaOverdue` y formularios CAPA.

## Requirement Clarity

- [x] CHK007 Is "lote" defined unambiguously and used consistently across stories, requirements, and assumptions? [Clarity, Spec §Clarifications, §Assumptions] — Sí: “lote” = documento origen `reference_module`+`reference_id`, sin entidad separada (clarificación, §Assumptions, data-model §1).
- [x] CHK008 Is "inspección pendiente" quantified by a specific state rather than subjective wording? [Clarity, Spec §Clarifications, §FR-020] — Sí: inspección pendiente = inspección en estado `draft` (clarificación, FR-020, dashboard/KPIs).
- [x] CHK009 Are dictamen requirements unambiguous when any criterion lacks a numeric measurement? [Clarity, Spec §FR-012, §FR-013] — Sí: sin medición numérica completa no hay dictamen y la inspección permanece `draft` (FR-012/013, contrato `inspection-engine`).
- [x] CHK010 Is the manual dictamen-override permission explicitly bounded so that `passed` is never allowed with critical failures or missing measurements? [Clarity, Spec §FR-014, §FR-032] — Sí: override exige justificación/usuario/fecha y prohíbe `passed` con críticos fallidos o sin medición (FR-014/032, US4.1–2); `canOverrideInspection`.
- [x] CHK011 Are default values and mandatory fields for auto-generated non-conformities explicitly specified? [Clarity, Spec §FR-015] — Sí: NC autogenerada `failed` con descripción autogenerada editable no vacía, producto del plan, tipo `other`, severidad `major`, estado `open` (FR-015, US3.1–2).
- [x] CHK012 Are CAPA required fields, allowed action types, and allowed statuses explicitly enumerated? [Clarity, Spec §FR-017, §FR-018, Plan §6] — Sí: responsable, descripción, causa raíz, tipo `resampling|rework|other`, `due_date`; estados `pending|in_progress|completed` (FR-017/018/038, Plan §6, data-model §3.6).

## Requirement Consistency

- [x] CHK013 Do plan and criterion lock rules align with deletion and cascade rules? [Consistency, Spec §FR-026, §Edge Cases] — Sí: bloqueados con historial; sin historial cascada plan→criterios y inspección→resultados; NC elimina CAPA y bloquea eliminación de inspección (FR-026, edge cases).
- [x] CHK014 Do inspection state and dictamen requirements align across spec, plan, and tasks? [Consistency, Spec §FR-005, §FR-012, Plan §6, Tasks T052] — Sí: `draft/completed` y `passed/failed/conditional`/`null` coherentes en spec, plan §6, data-model/contratos y tareas/flujo implementado.
- [x] CHK015 Do non-conformity statuses and quarantine conditions align without overlap or contradiction? [Consistency, Spec §FR-016, §FR-031, Data Model §3.5] — Sí: cuarentena derivada de NC `open`/`under_review` y salida en `closed`; sin entidad de cuarentena separada (FR-016/031/035).
- [x] CHK016 Do role-based visibility requirements align across functional requirements and assumptions? [Consistency, Spec §FR-028, §Assumptions] — Sí: selector de rol persistido, métricas agregadas para todos y detalle por inspector solo `jefe_calidad` (FR-028, §Assumptions, dashboard).
- [x] CHK017 Are story priorities coherent with the stated dependencies and delivery phases? [Consistency, Spec §US1–§US6, Plan §11] — Sí: P1→P6 sigue dependencias funcionales y fases/orden de tareas (plan §11, tasks dependencias US1–US6).
- [x] CHK018 Do performance targets align between success criteria, plan acceptance criteria, and validation tasks? [Consistency, Spec §SC-006, §SC-010, Plan §12, Tasks T092] — Sí: <1s percibido en búsqueda filtrada y <2s con hasta 500 inspecciones para consultas/dashboard (SC-006/010, plan §12, quickstart/T051). Nota: task ID de validación referenciado varía en el checklist original (“T092”), pero el criterio de rendimiento está especificado y mapeado (p.ej. T051).

## Acceptance Criteria Quality

- [x] CHK019 Are all success criteria expressed with measurable thresholds or percentages? [Measurability, Spec §SC-001–§SC-011] — Sí: SC-001–SC-011 usan tiempos, porcentajes (100%/0%/90%) o condiciones cuantificables.
- [x] CHK020 Is the denominator and time window for the approval-rate indicator explicitly defined? [Measurability, Spec §FR-020, Plan §9] — Sí: tasa = inspecciones `passed` / total de inspecciones `completed` (FR-039, plan §9), por etapa; `conditional` cuenta en denominador, no en numerador.
- [x] CHK021 Is the CAPA-effectiveness formula explicit enough to be computed consistently? [Measurability, Spec §FR-020, Plan §9] — Sí: porcentaje de acciones `completed` dentro de `due_date` (FR-020, plan §9, dashboard).
- [x] CHK022 Are empty-state requirements objectively testable for dashboard, pending lots, quarantine, history, and conditional review? [Measurability, Spec §FR-024, Tasks T084] — Sí: FR-024 exige estados vacíos claros en dashboard, lotes pendientes, cuarentena, historial y revisión condicional (reflejado en componentes). Nota: referencia de tarea original (“T084”) difiere de numeración actual, pero el requisito es medible.
- [x] CHK023 Is the 500-inspection performance condition paired with a concrete response threshold? [Measurability, Spec §SC-010, Plan §12] — Sí: consultas y dashboard <2s con hasta 500 inspecciones (SC-010, plan §12).

## Scenario Coverage

- [x] CHK024 Are primary flows defined for every role named in the specification? [Coverage, Spec §US1–§US6, Plan §3] — Sí: Inspector (US2), Jefe de Calidad (US1/3/4), Gerente/Auditor (US5/6) con acciones y escenarios por rol.
- [x] CHK025 Are alternate flows defined for `conditional` review, manual override, and manual rejection? [Coverage, Spec §US4] — Sí: bandeja `conditional`, cambio de dictamen con justificación/bloqueos y rechazo manual con confirmación/motivo (US4, tasks/contratos/vistas).
- [x] CHK026 Are exception and recovery flows defined for invalid sources, missing measurements, rejected saves, and invalid date ranges? [Coverage, Spec §Edge Cases, §US2 Scenario 7, §US6] — Sí: origen inválido/huérfano, mediciones faltantes/no numéricas, validaciones de guardado y rango de fechas inválido (edge cases, US2.7–9, US6.5).
- [x] CHK027 Are non-functional requirements covered for persistence, performance, accessibility, and role-restricted visibility? [Coverage, Spec §SC-005, §SC-010, §FR-027, §FR-028] — Sí: persistencia local (FR-027/SC-005), rendimiento (SC-006/010), visibilidad por rol (FR-028) y accesibilidad prevista en plan/tareas de cierre (T050) como preocupación de UX.

## Edge Case Coverage

- [x] CHK028 Are boundary cases for inclusive tolerances and exact limits explicitly defined? [Edge Case, Spec §FR-010] — Sí: límites inclusivos y medición exactamente en el límite = cumplida (FR-010, edge case, contrato motor).
- [x] CHK029 Are deletion edge cases defined for plans, criteria, inspections, non-conformities, and CAPA? [Edge Case, Spec §FR-026, §Edge Cases] — Sí: bloqueos y cascadas detallados para cada entidad (FR-026, edge cases, data-model §5).
- [x] CHK030 Are expired CAPA, invalid date ranges, and closed non-conformity cases addressed? [Edge Case, Spec §FR-019, §FR-023, §US6] — Sí: CAPA vencida sin cambio automático de estado, rango inválido rechazado y cierre de NC saca de cuarentena (FR-019/023/035, US6.5).
- [x] CHK031 Is behavior defined for a plan with no criteria and for an inspection that cannot obtain a dictamen? [Edge Case, Spec §FR-002, §FR-013] — Sí: plan sin criterios no habilitable/no usable y inspección incompleta permanece `draft` sin dictamen (FR-002/013, edge cases).

## Dependencies & Assumptions

- [x] CHK032 Are external dependencies and their validation requirements documented for products, employees, and source documents? [Dependency, Spec §FR-006, Plan §7] — Sí: productos/empleados/recepciones/órdenes/despachos como dependencias externas con validación de existencia y referencia polimórfica (FR-006/007/033, plan §7).
- [x] CHK033 Is the seed-data dependency documented and assigned to a concrete deliverable? [Dependency, Plan §7, Tasks T014] — Sí: datos semilla acordados en `src/seed-data.js` y tarea/setup asociada (plan §7, tasks T002; referencia T014 del checklist original no coincide con numeración actual pero el entregable existe).
- [x] CHK034 Is the base-module restoration dependency documented as a prerequisite for integrated validation? [Dependency, Plan §7, §14, Tasks T020] — Sí: restauración/base integrada documentada como riesgo/prerrequisito y validación integrada prevista (plan §7/§14, tasks T001/T054); código base ya presente en repo.
- [x] CHK035 Are the identifier strategy and local-storage assumption explicitly justified and bounded? [Assumption, Plan §7, Spec §Assumptions] — Sí: MVP con `localStorage`, IDs `string`, modelo relacional lógico con mapeo documentado y alcance acotado (plan §7, §Assumptions, contratos).

## Ambiguities & Conflicts

- [x] CHK036 Are there any remaining conflicts between approval rules and override rules across requirements and contracts? [Conflict, Spec §FR-013, §FR-014, Contracts] — No se observan conflictos: no aprobar con críticos fallidos/sin medición ni por override a `passed`; coherente en FR-013/014, US4, contrato storage/motor.
- [x] CHK037 Is the defect-type taxonomy fully defined and consistently referenced in requirements and plan enums? [Clarity, Spec §FR-016, Plan §6] — Sí: `dimensional|functional|packaging|other` definido y consistente (FR-016, plan §6, data-model, storage).
- [x] CHK038 Are "lote pendiente" and "inspección pendiente" clearly distinguished in all view requirements? [Consistency, Spec §FR-020, §FR-030] — Sí: lote pendiente = origen sin inspección `completed` (FR-030); inspección pendiente = `draft` (FR-020/clarificación), usados en vistas correspondientes.
- [x] CHK039 Are out-of-scope exclusions explicit and consistent between the specification and the plan? [Clarity, Spec §Fuera de Alcance, Plan §4, §9] — Sí: exclusiones (bloqueo automático inventario, proveedores, devoluciones, IoT, creación de maestras, valorización/líneas) alineadas en spec y plan.

## Traceability

- [x] CHK040 Does every functional and non-functional requirement have at least one acceptance scenario or validation task mapped to it? [Traceability, Spec §FR-001–§FR-032, §SC-001–§SC-011, Tasks] — Sí: FR/SC mapeados a US1–US6, escenarios de aceptación y tareas/pruebas por flujo (spec, plan §12, tasks). Requisitos añadidos FR-033–FR-040 en spec también tienen cobertura en historias/escenarios y artefactos de tareas/componentes.

## Notes

- Checklist actualizado como validación de calidad de requisitos (B6) a partir de `spec.md`, `plan.md`, `data-model.md`, contratos, `tasks.md` y revisión de `src/`/`tests/`; no se modificaron otros archivos del repositorio.
- Nota: algunas referencias de tareas citadas en el checklist original (p.ej. T092, T084, T014, T020) no coinciden con la numeración vigente de `tasks.md`; las justificaciones se vinculan al requisito/artefacto equivalente actual.
