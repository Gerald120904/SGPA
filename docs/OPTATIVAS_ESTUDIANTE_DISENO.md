# Diseño propuesto: optativa real por estudiante

Fecha de diseño: 4 de noviembre de 2026. La migración se aplicó posteriormente a `sgpa` el 5 de noviembre de 2026 tras un respaldo recuperable.

## Modelo previo a la migración

- `plan_asignaturas` contiene el espacio oficial, su plan, categoría y créditos. La malla debe conservar «Optativa 1», «Optativa 2», etc.
- `curso_optativas` vincula un curso real con categoría y carrera de origen. El curso aporta código y nombre. El catálogo no almacena créditos oficiales de la optativa real.
- `historial_academico_estudiantes` vincula estudiante, espacio del plan, período, resultado, origen y responsable, pero no identifica la optativa real. Cada fila es un intento histórico.
- El expediente y la evaluación de graduación leen ese historial y cuentan resultados `APROBADO` por `planAsignaturaId`. El avance temporal usa el mismo identificador.

## Datos necesarios

1. Conservar el catálogo de `curso_optativas` como identidad oficial de la asignatura real. Los créditos cursados podrán registrarse como dato del intento cuando exista fuente oficial; **no se impondrá un umbral adicional de créditos** ni se bloqueará un reconocimiento por un campo que el catálogo actual no exige. Los créditos de cumplimiento provienen del espacio del plan y se cuentan una sola vez.
2. Añadir a `historial_academico_estudiantes` una referencia nullable a `curso_optativas` e instantáneas de código, nombre y categoría. Los créditos cursados quedan nullable porque el catálogo no ofrece esa cifra. Los créditos reconocidos proceden del espacio oficial y se cuentan una sola vez.
3. Conservar `plan_asignatura_id` como referencia al espacio oficial y, mediante esa fila, al plan aplicable. Así el historial de cambios de plan permanece trazable.
4. Registrar el reconocimiento curricular por intento con estado explícito `NO_RECONOCIDO` o `RECONOCIDO`, créditos reconocidos (0 si no reconocido) y usuario/fecha de la decisión. El resultado `REPROBADO` siempre queda `NO_RECONOCIDO`. La selección del espacio la realiza el usuario autorizado cuando haya varias opciones.
5. Mantener el historial de correcciones existente: si cambia un resultado, el servicio recalcula o revoca su reconocimiento en la misma transacción y escribe auditoría. Nunca borra el intento anterior.

## Restricciones previstas

- La optativa real y el espacio deben pertenecer al alcance de carrera autorizado; el espacio debe ser tipo `OPTATIVA` y pertenecer al plan del estudiante al momento del registro.
- Los números «Optativa 1» a «Optativa 4» son espacios genéricos: **no fijan categoría**. La categoría proviene de la optativa real; la distribución del conjunto reconocido debe respetar las cantidades disciplinarias, abiertas y de sede del plan.
- La validez de la optativa para el plan se determina con las categorías y alcances ya definidos. No se inventará una lista adicional de elegibilidad ni un umbral de créditos.
- Una optativa aprobada no debe reconocer dos espacios del estudiante, incluso si hay cambio de plan, ni sumar créditos dos veces. La operación bloquea el expediente y comprueba los reconocimientos existentes en una transacción.
- La desactivación posterior del catálogo no cambia intentos ni reconocimientos ya registrados. Una nueva inscripción debe consultar la elegibilidad y estado vigentes.
- Una corrección o transición de plan conserva la instantánea, el plan anterior y la auditoría. Los reconocimientos en el plan nuevo se evalúan de nuevo sin eliminar los del plan previo.
- Los registros históricos sin referencia a optativa real siguen legibles; no se les asignará una optativa por conjetura ni se invalidarán automáticamente.

## Contratos previstos

- `RegistrarResultadoAcademicoDto` recibirá `cursoOptativoId` para un espacio optativo. El backend consultará el catálogo y generará las instantáneas. Para otro tipo de asignatura, rechazará ese campo.
- El expediente mostrará código y nombre reales junto al espacio oficial y el resultado. Solo un reconocimiento validado completa el espacio; un intento reprobado sigue visible sin completarlo.
- La malla general seguirá consultando `plan_asignaturas`; la malla personalizada combinará espacios con intentos y reconocimientos del estudiante.
- Graduación, avance, equivalencias, transiciones e importaciones consumirán una regla central de reconocimiento. Los formularios no incorporarán resultados académicos sin el flujo de autorización existente.

## Compatibilidad, migración y reversión

- Migración incremental y versionada; columnas nuevas nullable o con valor por defecto seguro. No reescribe filas históricas.
- Índice y clave foránea de `curso_optativo_id` con `ON DELETE RESTRICT`. La unicidad dentro del plan activo se comprueba transaccionalmente bloqueando al estudiante. La política de reuso entre planes requiere la decisión institucional indicada abajo.
- El `down` elimina solo estructuras añadidas si no hay datos dependientes. La reversión operativa en producción requiere respaldo y procedimiento separado. La migración 15 ya se aplicó a `sgpa` después de respaldarla; este documento no indica ejecutarla de nuevo.

## Decisiones institucionales pendientes

1. El reuso de una optativa ya reconocida en otro plan queda impedido por la regla de reconocimiento único. Si una transición curricular necesita conservar su cumplimiento en el nuevo plan, hace falta definir el procedimiento institucional que traslada el reconocimiento sin un segundo conteo.
2. ¿Quién puede autorizar un reconocimiento excepcional y con qué motivo/auditoría? Hasta definirlo, solo se aplican las reglas ordinarias.

Estas decisiones no se resolverán por suposición. Las estructuras y operaciones que dependan de ellas permanecerán pendientes hasta contar con la regla aprobada.
