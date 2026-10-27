# Plan de Desarrollo: Módulo de Control de Calidad

**Módulo**: `002-quality-control-module`  
**Estado**: Borrador  
**Modelo de datos**: [data-model.md](data-model.md)  
**Módulo base relacionado**: [001-erp-base-module](../001-erp-base-module/)

## Resumen

Desarrollar un módulo ERP para gestionar planes y criterios de inspección, registrar inspecciones y resultados, documentar no conformidades y dar seguimiento a acciones correctivas o preventivas (CAPA). El módulo debe integrarse con los registros de productos, empleados, recepciones, órdenes de producción y despachos de los módulos correspondientes.

## Alcance funcional

- Mantener planes de inspección asociados a productos y etapas operativas.
- Definir criterios, valores esperados y tolerancias para cada plan.
- Registrar inspecciones, su origen, fecha, inspector y dictamen general.
- Almacenar el resultado de cada criterio evaluado.
- Registrar no conformidades y gestionar acciones CAPA con responsable, vencimiento y estado.
- Conservar trazabilidad desde la inspección y sus resultados hasta la resolución de una no conformidad.

## Contexto técnico y dependencias

El repositorio contiene una aplicación base en JavaScript con Vite y persistencia local en el navegador. La estrategia de almacenamiento y la interfaz del módulo de calidad deben acordarse con la arquitectura existente antes de implementar; este plan no implica cambios en el código.

El modelo de calidad depende de entidades de Logística, Recursos Humanos, Compras, Manufactura y Despachos que no están definidas en el modelo de datos del módulo base. La integración debe acordar los contratos de esas entidades, los tipos de identificador y la validación del par polimórfico `reference_module` / `reference_id`.

## Etapas de desarrollo

1. **Definir historias de usuario y contratos**: precisar actores, flujos, criterios de aceptación y reglas para cada entidad del modelo.
2. **Acordar la integración entre módulos**: confirmar las tablas de origen, los tipos y mapeos de identificadores, las reglas de integridad y cómo validar las referencias polimórficas.
3. **Implementar el modelo y las reglas**: crear las operaciones de persistencia y validaciones conforme a [data-model.md](data-model.md).
4. **Construir los flujos de usuario**: desarrollar las pantallas para planes, inspecciones, resultados, no conformidades y acciones CAPA siguiendo los patrones del módulo base.
5. **Integrar y probar**: ejecutar una versión integrada y verificar los flujos completos desde la inspección hasta el cierre de las acciones, incluyendo referencias a los módulos externos.

## Criterio de integración

El módulo se considerará integrado cuando una inspección pueda vincularse con un registro de origen válido, consultar el producto e inspector correspondientes, registrar resultados y no conformidades, y mantener el seguimiento de las acciones CAPA sin referencias huérfanas. Las dependencias externas deben estar disponibles en el entorno de prueba o sustituirse por datos de prueba acordados.

## Pendientes antes de implementar

- Definir las historias de usuario y tareas de la siguiente iteración.
- Confirmar si los identificadores del módulo de calidad serán `INT` o se alinearán con los identificadores `string` del módulo base.
- Acordar los contratos de integración para productos, empleados, recepciones, órdenes de producción y despachos.
- Definir si la persistencia será local como en el módulo base o si usará un servicio compartido.
