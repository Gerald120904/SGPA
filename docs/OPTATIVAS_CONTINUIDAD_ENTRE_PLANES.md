# Continuidad de optativas reales entre planes — diseño pendiente de aprobación

Fecha de trabajo: 4 de noviembre de 2026. Este documento prepara la integración; no autoriza ni ejecuta reconocimientos automáticos en un plan nuevo.

## Situación actual

Cada fila de `historial_academico_estudiantes` representa un intento. El intento optativo identifica al estudiante, plan y espacio originales, asignatura real, período, resultado y estado de reconocimiento. La aprobación histórica debe permanecer en esa fila. Una optativa reprobada o una aprobación repetida sin reconocimiento no puede alimentar un traslado. El servicio actual impide registrar por segunda vez la misma optativa reconocida para el estudiante. Las equivalencias y transiciones bloquean su aplicación a espacios genéricos, y la importación rechaza aprobaciones de espacios optativos sin asignatura real identificada.

## Relación propuesta

Crear, después de aprobación institucional, una entidad separada `reconocimientos_optativos_plan` que **referencie** el `historial_academico_estudiantes.id` del intento aprobado original. No copiar el intento ni insertar una nueva aprobación. Cada relación contendría estudiante, plan destino, espacio oficial destino (`plan_asignatura_id`), optativa real (identidad del catálogo más instantánea histórica), estado de trámite, origen (equivalencia, reingreso, cambio de plan, transición o importación), regla/equivalencia aplicada cuando exista, solicitante, autoridad que decide, fecha y motivo. Conservar una bitácora inmutable de propuestas, aprobaciones, rechazos, revocaciones y reasignaciones.

El estado inicial sería `PROPUESTO`. Solo una resolución autorizada podría convertirlo en reconocimiento efectivo. El historial original conservaría el resultado académico, período, calificación y sus correcciones. La relación de destino sería una **proyección curricular**, sin créditos académicos nuevos ni segundo intento. El cálculo de créditos usaría la identidad del intento original y contaría como máximo una vez en la evaluación correspondiente. La malla oficial seguiría leyendo únicamente los espacios del plan.

## Validaciones antes de resolver una propuesta

1. Bloquear transaccionalmente al estudiante y cargar el intento original. Exigir resultado aprobado o reconocimiento académico válido, curso real identificado y estado histórico coherente. Rechazar reprobaciones e intentos duplicados no reconocidos.
2. Comprobar que plan y espacio destino pertenecen al estudiante y que el espacio es una optativa genérica. Verificar elegibilidad del curso y distribución por categoría **del plan destino**, sin asignar una categoría al número de espacio.
3. Impedir dos relaciones efectivas para el mismo espacio y estudiante, y dos usos efectivos de la misma asignatura real. Si la optativa puede llenar varios espacios, registrar la elección explícita del usuario autorizado.
4. Revisar los reconocimientos del plan de origen y del destino. No sumar créditos de ambas proyecciones. El efecto sobre un reconocimiento anterior necesita la política institucional indicada abajo; hasta entonces la propuesta permanece sin efecto.
5. Registrar decisión, motivo, actor y fecha en la auditoría. No reescribir ni borrar intentos originales.

## Puntos de integración

| Flujo | Preparación segura | Aplicación futura condicionada |
| --- | --- | --- |
| Equivalencias | Simular candidatos desde intentos aprobados reconocidos y mostrar optativa, categoría, plan y espacio originales. | Crear propuesta ligada al intento original; resolver tras validar plan destino. |
| Reingreso | Recuperar historial sin copiar intentos. | Elegir plan aplicable y proponer relaciones para espacios elegibles. |
| Cambio de plan | Mantener historial y cambio de plan ya auditados. | Resolver cada relación antes de mostrar un espacio destino como cumplido. |
| Transición curricular | Excluir intentos optativos no reconocidos y mantener el bloqueo actual del espacio genérico. | Sustituir el bloqueo solo por un flujo de propuesta y resolución explícita. |
| Importación | Exigir código de optativa real, período, resultado e identidad del origen. | Vincular un intento original existente si se trata de traslado; no importarlo otra vez como aprobación. |
| Expediente y avance | Mostrar intento original y propuesta por separado. | Mostrar la relación destino y su estado; cumplir el espacio únicamente al quedar efectiva. |
| Graduación | Mantener el conteo único actual. | Leer solo relaciones efectivas del plan evaluado y deduplicar por asignatura real. |

## Decisiones institucionales pendientes

- Autoridad y procedimiento para reconocer en el plan nuevo una optativa ya reconocida en el anterior; efecto del reconocimiento del plan anterior al aprobar el traslado.
- Criterios para resolver varias asignaciones elegibles, equivalencias uno a varios, cambios de categoría entre planes y casos con códigos históricos sin identidad de catálogo verificable.
- Alcance de los créditos en evaluaciones históricas de planes anteriores frente al plan nuevo. Ningún flujo actual debe inferir esta regla.

Hasta recibir esas decisiones, no se añade una migración de traslado ni se convierte ninguna propuesta en reconocimiento efectivo. La migración local existente `2026110400000-AddOptativaRealHistorialEstudiante` solo registra la optativa real y el reconocimiento del intento en su plan original.
