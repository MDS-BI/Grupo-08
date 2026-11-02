# Inicio Rápido: Módulo de Control de Calidad

## Configuración

1. Instale las dependencias con `npm install`.
2. Restaure o implemente el código del módulo base (`index.html` y `src/`), ausente en el repositorio desde el commit `a0062c0`.
3. Inicie el servidor de desarrollo con `npm run dev`.
4. Abra la URL local de Vite en un navegador.

## Flujo de Usuario Principal

1. Aterrice en el **Dashboard de Calidad** y revise los KPIs: tasa de aprobación, no conformidades abiertas por severidad, CAPA vencidas, eficacia CAPA e inspecciones pendientes.
2. Abra **Lotes pendientes** y use la acción "Inspeccionar" sobre un lote (documento origen) sin inspección completada.
3. Cree un **plan de inspección** para un producto y una etapa (`incoming`, `in_process` o `final`), si aún no existe.
4. Agregue **criterios** al plan con valor esperado, tolerancia, unidad, tipo de comparación y criticidad.
5. Ejecute una **inspección** seleccionando un documento origen válido y registrando al inspector.
6. Ingrese las mediciones por criterio; el sistema calcula `pass_fail` y `overall_result` automáticamente cuando todos los criterios tienen medición numérica.
7. Si una medición falta o no es numérica, la inspección queda en `draft` y no obtiene dictamen.
8. Si la inspección resulta `failed`, se genera un borrador de **no conformidad** con descripción obligatoria; clasifique su tipo de defecto y severidad.
9. Si resulta `conditional`, revísela en la bandeja de revisión del Jefe de Calidad; no se genera no conformidad.
10. Cree una **acción CAPA** con responsable, descripción, causa raíz, tipo de acción y fecha límite.
11. Revise la pestaña de **cuarentena** para lotes con no conformidades abiertas y asigne o consulte su CAPA.
12. Consulte el **historial**, filtre por lote (documento origen) y rango de fechas, y limpie los filtros.
13. Recargue la página para confirmar que los datos persisten en `localStorage`.

## Validación

- Verifique que un plan exige producto y etapa canónicos.
- Verifique que cada criterio exige valor esperado, tolerancia, unidad y tipo de comparación.
- Verifique que `pass_fail` se calcula y no puede editarse manualmente.
- Verifique que una inspección sin medición de algún criterio permanece en `draft`.
- Verifique que una inspección con `reference_module` no canónico o `reference_id` inexistente se rechaza.
- Verifique que una inspección con criterios críticos fallidos o sin medición no puede aprobarse, ni siquiera con justificación.
- Verifique que un cambio de dictamen exige justificación, usuario y fecha.
- Verifique que una inspección `conditional` aparece en revisión y no genera no conformidad.
- Verifique que una inspección `failed` genera una no conformidad con descripción no vacía y tipo de defecto `other` por defecto.
- Verifique que toda acción CAPA exige responsable, descripción, causa raíz, tipo de acción y `due_date`.
- Verifique que un lote con no conformidad abierta aparece en cuarentena.
- Verifique que los planes y criterios con inspecciones históricas no se pueden editar ni eliminar.
- Verifique que el dashboard y el historial reflejan los datos registrados sin referencias huérfanas.
- Verifique que las vistas muestran estados vacíos claros cuando no hay datos.

## Integración con el Módulo Base

El módulo de calidad consume el marco y el almacenamiento del módulo base:

1. Productos, empleados, recepciones, órdenes de producción y despachos son dependencias externas; no se crean desde Control de Calidad.
2. Para demo y pruebas se cargan datos semilla desde `src/seed-data.js`.
3. El par `reference_module` + `reference_id` se valida contra la colección correspondiente antes de guardar la inspección.
4. El "lote" es el documento origen; no existe una colección de lotes separada.
5. El MVP usa identificadores `string` en `localStorage`; el modelo `INT` de `data-model.md` queda como diseño lógico con mapeo documentado.

Consulte `specs/002-quality-control-module/` para la especificación completa.
