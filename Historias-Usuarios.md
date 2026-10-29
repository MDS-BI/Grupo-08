Historias Usuarios
US-01: Visualización de Lotes Pendientes
Historia de Usuario: Como inspector de calidad, quiero visualizar una tabla con todos los lotes de producción en estado "Pendiente de Revisión" para identificar rápidamente qué productos debo inspeccionar en mi turno.
Criterios de Aceptación:
​La interfaz frontend debe renderizar una tabla con las columnas: ID de Lote, Producto, Fecha de Producción y Estado.
​Por defecto, la vista debe cargar y mostrar exclusivamente los lotes que mantengan el estado "Pendiente".
​Cada fila debe incluir un botón de "Inspeccionar" que redirija a la vista del formulario de pruebas.

​US-02: Ingreso de Parámetros de Prueba
Historia de Usuario: Como inspector de calidad, quiero ingresar los resultados numéricos de las pruebas de laboratorio de un lote para documentar su evaluación técnica en el sistema.
Criterios de Aceptación:
​El formulario debe incluir campos de entrada (inputs) para registrar métricas específicas (como peso, temperatura o medidas) conectadas al data-model.
​Si se ingresa un valor que excede los márgenes de tolerancia permitidos, el campo debe resaltarse visualmente (ej. en color rojo) para alertar al usuario.
​El sistema no debe permitir el envío del formulario si hay campos de métricas vacíos.

​US-03: Dictamen Final del Lote
Historia de Usuario: Como supervisor de calidad, quiero cambiar el estado final del lote a "Aprobado" o "Rechazado" para determinar si el producto puede avanzar al inventario general.
Criterios de Aceptación:
​La interfaz debe tener un menú desplegable o botones dedicados para establecer la decisión final.
​Al seleccionar "Rechazado", el sistema debe desplegar una ventana emergente (modal) solicitando confirmación antes de guardar.
​Debe registrarse en el historial la fecha, hora y el usuario que emitió el dictamen.

​US-04: Reporte de Defectos y No Conformidad
Historia de Usuario: Como supervisor de calidad, quiero registrar un comentario obligatorio cuando un lote es rechazado para informar detalladamente al departamento de producción sobre las fallas encontradas.
Criterios de Aceptación:
​Al marcar un dictamen negativo, debe aparecer un área de texto (textarea) etiquetada como "Motivo de Rechazo".
​El botón de "Guardar Dictamen" debe permanecer deshabilitado hasta que se ingrese al menos un comentario en este campo.
​Tras guardar, el frontend debe renderizar un mensaje de éxito tipo notificación (toast) validando el registro.

​US-05: Historial y Filtrado de Inspecciones
Historia de Usuario: Como gerente de operaciones, quiero aplicar filtros de búsqueda en el registro histórico de inspecciones para auditar el rendimiento y encontrar rápidamente evaluaciones de lotes pasados.
Criterios de Aceptación:
​La pantalla de historial debe incluir un buscador por "ID de Lote" y selectores de rango de fechas (desde/hasta).
​La tabla de resultados debe actualizarse para mostrar únicamente los registros que coincidan con los filtros aplicados.
​Debe existir un botón visible de "Limpiar Filtros" que restaure la tabla a su vista original con todos los registros.

US-06: Gestión de Lotes en Cuarentena y Acciones Correctivas (CAPA)
Historia de Usuario: Como jefatura de calidad, quiero revisar los lotes retenidos en cuarentena y asignar una acción correctiva (CAPA) con responsable y plazo, para asegurar el tratamiento de no conformidades antes de autorizar o rechazar su liberación definitiva.
Criterios de Aceptación:
La interfaz debe incluir una vista o pestaña exclusiva de "Lotes en Cuarentena" mostrando ID de lote, nivel de criticidad y tipo de defecto detectado.
Cada fila debe contar con un botón "Asignar CAPA" que abra un modal para ingresar la causa raíz, la acción a tomar (re-muestreo o reproceso) y la fecha límite.
El sistema debe validar que los campos de la acción correctiva no queden vacíos y actualizar visualmente la etiqueta del lote a "Cuarentena - En Tratamiento" tras guardar.
