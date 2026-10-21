# SGPA-QA-004 — Reglas de optativas en Planes de estudio

## Diagnóstico

La tabla `reglas_optativas_plan` del entorno de pruebas tenía cuatro columnas y no incluía `cantidad_disciplinarias`, `cantidad_abiertas` ni `cantidad_sede`. La causa verificada era el desajuste entre esas columnas esperadas por TypeORM y el esquema existente. Antes de migrar, la tabla tenía cero filas.

El esquema previo tenía la clave primaria de `id`, dos índices únicos preexistentes sobre `plan_estudio_id` y la clave foránea hacia `planes_estudio.id` con cascada en actualización y eliminación. La migración conserva esos elementos y los campos legados `minimo_disciplinarias_propias` y `maximo_otras_areas`.

## Migración aplicada

Se aplicó exclusivamente `AddOptativeRuleCounts2026101500000` a `sgpa_test`, con `DB_SYNCHRONIZE=false`. Agrega las tres columnas como `SMALLINT UNSIGNED NOT NULL DEFAULT 0`; si una columna ya existe, valida su definición antes de continuar. No elimina ni transforma columnas legadas, no actualiza filas y no cambia índices ni relaciones. `down()` falla deliberadamente para evitar borrar valores que se configuren después.

El runner exige `--apply` y `--confirm-database` igual a `DB_DATABASE`. Verifica que la única migración configurada sea QA-004 y consulta las pendientes antes de ejecutar; cualquier migración ajena detiene el proceso. La configuración mantiene `migrationsRun: false` y fuerza `synchronize: false` al ejecutar el runner. Una segunda ejecución confirmó que no había migraciones pendientes.

## Respaldo y conservación

Se restauró y verificó el respaldo SQL corregido en una instancia nativa temporal de MySQL, independiente del servicio y de `sgpa_test`. El respaldo recuperó 48 tablas y 171 filas, con claves, índices y relaciones. La instancia temporal se cerró después de verificarla.

Tras QA-004, `sgpa_test` contiene 49 tablas y 172 filas: las 48 tablas y 171 filas originales, más la tabla de historial de migraciones y el registro de QA-004. La tabla `reglas_optativas_plan` quedó con cero filas tras retirar las filas temporales creadas por las pruebas. No hubo cambios en la base institucional.

## Resultados QA-004

- **API-143:** GET de regla respondió HTTP 200.
- **API-144:** PUT respondió HTTP 200; los valores 1/2/3 se guardaron y se leyeron de vuelta.
- **API-145:** DELETE respondió HTTP 204; la regla temporal quedó eliminada.
- **EST-PLAN-GET-011:** Ver plan y el diálogo Optativas cargaron sin error HTTP 500.
- **PLAN-REGLA-001:** la interfaz guardó y recargó las cantidades 1/2/3.
- **PLAN-REGLA-002:** la interfaz eliminó la regla cuando el plan no tenía optativas activas. Una prueba unitaria confirma que la eliminación se bloquea cuando hay optativas activas.
- **API-151:** GET de validaciones respondió HTTP 200. Con una regla de 1/2/3 y cero optativas activas, devolvió los tres incumplimientos de cantidad esperados.
- **EST-PLAN-GET-013:** Revisar plan respondió sin error y mostró cero errores y cero advertencias después de retirar la regla temporal.
- **PLAN-003:** Electron abrió Ver plan y mostró el detalle del plan sin el error reportado.

Pasaron 37 pruebas unitarias en 7 suites, incluidas migración, runner, configuración, reglas y validaciones. `git diff --check` también pasó. Las funciones Importar y Plantilla no se modificaron.

## Límites de alcance

La migración y las verificaciones se realizaron únicamente en `sgpa_test`; no se consultó ni modificó la base institucional. Los casos API-141, API-142, PLAN-IMP-001 y PLAN-IMP-002, previstos para retirada, no se modificaron. No se hizo push ni merge; los cambios se mantienen en la rama local aislada de QA-004.
