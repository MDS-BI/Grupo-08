Feedback Avance 01 (26/10/26)

- plan y data-model Deben existir como una modulo de desarrollo dentro de specs
- avance se ve bien, ojo con la integracion.

Proximos pasos:
 
- rectificar puntos anteriores 
- trabajar en los specs (historias de usuario, US) para definir tareas
- dividirse las US y tareas para una siguiente iteracion (avances cada semana)
- ejecutar una version integrada de prueba

 Feedback Avance 02 (2/11/26)

- Se insiste en el manejo de los specs (revisar video). Cada carpeta debe tener toda la estructura base (y editar sobre ella con referencias claras).
- Se observan historias de usuario por cada miembro del grupo
- Evitar trabajar con modelos de IA fuera de speckit en local, porque crean ramas nuevas y se pierde la integridad del proyecto

Proximos pasos:

- crear tareas a partir de los specs
- hacer primera implmentacion, registar modificaciones/incremental y volver al spec
- dividir el grupo entre modificaciones (ajustes previos) e incremental (nueva funcionalidad)
- integrar nueva version en 2 semanas
  
Feedback Avance 03 (16/11/26)

Cambios en la especificación:

- spec.md: se agregan las sesiones de clarificación del 14 y 15/11 (rol de uso, cierre de NC, `conditional`, CAPA, FR-033 a FR-040), "Problema y Solución" y líneas "Datos:" por US. Las dos sesiones repiten el cierre de NC y la cuarentena.
- tasks.md: reescrito por US (T001–T055), la mayoría marcadas. Ninguna tarea cubre FR-033 a FR-040, y T037 (rechazo manual con motivo) ya no tiene escenario en spec.md.

Consistencia sitio–especificación:

- T053 [x] exige lint/formato, pero package.json no tiene scripts de lint (T003 sigue sin marcar).
- T004 sin marcar: existe vitest.config.mjs, pero no hay `tests/setup/setup.js`.
- T037 [x]: index.html no tiene flujo de rechazo con motivo, solo el cambio de dictamen.
- Fuera de spec: filtro "Módulo origen" en el historial (FR-022 solo pide lote y fechas).
- hacer mejoras de funcionalidad e interfaz de usuario, incluir data simulada para probar campos, incluir mejoras de estilo, transicion, navegacion, etcetera.

Presentacion de MVP final en 2 semanas.
