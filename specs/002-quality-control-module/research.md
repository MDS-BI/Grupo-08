# Investigación: Módulo de Control de Calidad

## Decisión: Reutilizar la base Vite con HTML, CSS y JavaScript vanilla

**Justificación**: El módulo de Control de Calidad es una extensión del [módulo base ERP](../001-erp-base-module/plan.md), que ya usa Vite con JavaScript vanilla, CSS separado y persistencia en `localStorage`. Mantener el mismo stack evita duplicar infraestructura, conserva el marco visual (`shell.js`) y permite que el motor de tolerancias se implemente como lógica pura, fácil de probar con Vitest y jsdom.

## Alternativas consideradas

- **Framework de interfaz (React, Vue, Svelte)**: ofrece componentes más estructurados, pero añade dependencias y una curva de integración que no se justifica para el MVP ni para convivir con el módulo base.
- **Backend con base de datos relacional**: sería lo natural para el modelo `INT` de `data-model.md`, pero está fuera del alcance del MVP frontend; obligaría a implementar autenticación, API y despliegue.
- **Persistencia en `localStorage` con identificadores `string`**: es la opción coherente con el módulo base y permite validar el flujo completo sin backend. El modelo relacional se conserva como diseño lógico.

## Decisiones adicionales

- **Evaluación de tolerancias en código, no en la vista.** `pass_fail` se calcula comparando `measured_value` contra `expected_value`, `tolerance` y `comparison_type` (`range`, `min`, `max`, `boolean`) en una función pura de `inspection-engine.js`; nunca se captura manualmente.
- **Tipos numéricos para mediciones.** `expected_value`, `tolerance` y `measured_value` se tratan como números (con unidad y tipo de comparación); `data-model.md` ya refleja los tipos numéricos.
- **Inspección incompleta.** Si falta la medición de cualquier criterio o el valor no es numérico, la inspección queda en `draft` y no tiene `overall_result`; no se inventa un dictamen.
- **`overall_result` derivado.** El dictamen se obtiene de los resultados: `failed` si falla al menos un criterio crítico, `conditional` si solo hay desviaciones no críticas y `passed` si todos cumplen. El cambio manual del jefe de calidad exige justificación, usuario y fecha, y nunca permite `passed` con criterios críticos fallidos o sin medición.
- **Identificadores `string` y colecciones en `localStorage`.** Decisión adoptada para el MVP, coherente con el contrato del módulo base (`id`, `entity_id`, marcas de tiempo ISO). El modelo `INT` se mantiene como diseño lógico con una capa de mapeo documentada.
- **Referencias polimórficas validadas.** `reference_module` debe pertenecer a `goods_receipt`, `production_order` o `shipment`, y `reference_id` debe existir en la colección correspondiente; una referencia huérfana invalida la inspección.
- **Lote = documento origen.** No se crea una entidad de lote separada. Los lotes pendientes se derivan comparando documentos origen externos con inspecciones `completed`; la cuarentena se deriva de no conformidades `open`/`under_review`.
- **Datos semilla acordados.** Productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas; para demo y pruebas se cargan desde `src/seed-data.js`.
- **Métricas agregadas.** El dashboard reporta tasas, Pareto, CAPA vencidas y eficacia CAPA por producto o etapa; el detalle individual se reserva a jefatura para evitar sesgos punitivos.
