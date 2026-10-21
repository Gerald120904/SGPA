# Jerarquía de usuarios y permisos por carrera

## Estado vigente

Documento actualizado el 20 de octubre de 2026 sobre la rama `Gerald`, con base en el código local pendiente de publicación.

La implementación integra jerarquía y permisos por carrera en Usuarios, Estudiantes, Cursos, Planes de estudio, Optativas, Estructura académica, frontend, Electron e IPC. Los módulos que no comprueban todavía la carrera del recurso permanecen cerrados para cuentas jerárquicas.

## Modelo de datos

- `dependencias_usuario`: responsable único de cada asistente, con estado y motivo de desactivación.
- `permisos_carrera`: permiso explícito de un usuario sobre una carrera.
- `solicitudes_cambio`: propuesta, datos, huella del recurso, estado, correlación y resultado aplicado.
- `auditoria_jerarquia`: actor, usuario afectado, acción y detalle.

Las carreras vigentes proceden de `asignaciones_academicas` con tipo `COORDINADOR_CARRERA` o `ASISTENTE_CARRERA`. El alcance efectivo exige usuario y rol activos, carrera activa, asignación vigente y permiso explícito. El asistente también necesita una dependencia activa, un coordinador activo y que ese coordinador conserve el mismo permiso.

`ADMIN_GLOBAL` conserva su alcance global. Una cuenta no puede combinar `ASISTENTE_ESTUDIANTIL` con `COORDINADOR` o `ADMIN_GLOBAL`.

## Permisos jerárquicos habilitados

La delegación por carrera se limita a:

1. `ESTUDIANTES_VER`
2. `ESTUDIANTES_GESTIONAR`
3. `CURSOS_VER`
4. `CURSOS_GESTIONAR`
5. `PLANES_ESTUDIO_VER`
6. `PLANES_ESTUDIO_GESTIONAR`
7. `OPTATIVAS_VER`
8. `OPTATIVAS_GESTIONAR`

Aulas y Periodos no son delegables por carrera. Requieren una decisión de gobernanza institucional.

## Autorización y revocación

- `AuthGuard` vuelve a consultar el usuario, sus roles y la dependencia activa.
- `RolesGuard` y `PermisosGuard` cierran por defecto las rutas que todavía no validan alcance por carrera.
- `PlanesAlcanceGuard` obtiene la carrera desde el plan persistido; no confía en un `carreraId` enviado por el cliente.
- La administración genérica de asignaciones no permite crear, editar ni desactivar asignaciones jerárquicas.
- Revocar o desactivar un coordinador desactiva sus dependencias y cuentas asistentes e invalida solicitudes pendientes.
- Revocar un asistente desactiva su dependencia e invalida sus solicitudes pendientes.

## Flujo de solicitudes

El asistente no escribe directamente los datos oficiales. La creación de una propuesta deja el recurso oficial intacto.

La aprobación bloquea el coordinador y la solicitud, exige estado `PENDIENTE`, revalida dependencia, carreras y permisos, comprueba la huella del recurso y ejecuta el aplicador, la resolución y la auditoría en la misma transacción. Si la autorización fue revocada, la solicitud se marca `INVALIDADA`. Un fallo del aplicador o de la auditoría revierte la transacción completa.

## Rutas de jerarquía

Fuente verificada: `backend/src/usuarios/jerarquia-usuarios.controller.ts`.

| Método | Ruta | Método del controlador | Rol |
|---|---|---|---|
| GET | `/jerarquia-usuarios/mis-carreras` | `misCarreras` | Administrador, coordinador o asistente |
| GET | `/jerarquia-usuarios/mis-alcances` | `misAlcances` | Coordinador |
| GET | `/jerarquia-usuarios/catalogo-estudiantes` | `catalogoEstudiantes` | Coordinador o asistente |
| GET | `/jerarquia-usuarios/catalogo-cursos` | `catalogoCursos` | Coordinador o asistente |
| GET | `/jerarquia-usuarios/catalogo-planes` | `catalogoPlanes` | Coordinador o asistente |
| PUT | `/jerarquia-usuarios/coordinadores/:id` | `configurarCoordinador` | Administrador |
| GET | `/jerarquia-usuarios/coordinadores/:id` | `obtenerCoordinador` | Administrador o coordinador autorizado |
| GET | `/jerarquia-usuarios/asistentes` | `listarMisAsistentes` | Coordinador |
| GET | `/jerarquia-usuarios/asistentes/:id` | `obtenerAsistente` | Coordinador responsable |
| GET | `/jerarquia-usuarios/auditoria/:id` | `listarAuditoria` | Administrador o coordinador autorizado |
| PUT | `/jerarquia-usuarios/asistentes/:id` | `vincularAsistente` | Coordinador responsable |
| POST | `/jerarquia-usuarios/asistentes` | `crearAsistente` | Coordinador |

## Rutas de solicitudes

Fuente verificada: `backend/src/usuarios/solicitudes-cambio.controller.ts`. Todas las rutas parten de `/solicitudes-cambio`.

### Estudiantes

| Método | Ruta | Método del controlador |
|---|---|---|
| POST | `/solicitudes-cambio/estudiantes` | `proponerEstudiante` |
| POST | `/solicitudes-cambio/estudiantes/:id/actualizar` | `proponerActualizacionEstudiante` |
| POST | `/solicitudes-cambio/estudiantes/:id/estado` | `proponerEstadoEstudiante` |
| POST | `/solicitudes-cambio/estudiantes/:id/plan` | `proponerPlanEstudiante` |
| POST | `/solicitudes-cambio/estudiantes/:id/historial-academico` | `proponerResultadoEstudiante` |
| POST | `/solicitudes-cambio/estudiantes/importacion` | `proponerImportacionEstudiantes` |

### Cursos

| Método | Ruta | Método del controlador |
|---|---|---|
| POST | `/solicitudes-cambio/cursos` | `proponerCurso` |
| POST | `/solicitudes-cambio/cursos/:id/actualizar` | `proponerActualizacionCurso` |
| POST | `/solicitudes-cambio/cursos/:id/estado` | `proponerEstadoCurso` |
| POST | `/solicitudes-cambio/cursos/:id/requisitos` | `proponerRequisitoCurso` |
| POST | `/solicitudes-cambio/cursos/:id/requisitos/:relacionId/eliminar` | `proponerEliminarRequisitoCurso` |

### Planes de estudio

| Método | Ruta | Método del controlador |
|---|---|---|
| POST | `/solicitudes-cambio/planes-estudio` | `proponerPlan` |
| POST | `/solicitudes-cambio/planes-estudio/:id/actualizar` | `proponerActualizacionPlan` |
| POST | `/solicitudes-cambio/planes-estudio/:id/estado` | `proponerEstadoPlan` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/asignaturas` | `proponerAgregarAsignatura` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/asignaturas/:id/actualizar` | `proponerActualizarAsignatura` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/asignaturas/:id/estado` | `proponerEstadoAsignatura` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/asignaturas/carga-masiva` | `proponerCargaMasivaAsignaturas` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/requisitos` | `proponerAgregarRequisitoPlan` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/requisitos/:id/eliminar` | `proponerEliminarRequisitoPlan` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/requisitos/carga-masiva` | `proponerCargaMasivaRequisitosPlan` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/salidas-academicas` | `proponerCrearSalida` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/salidas-academicas/:id/actualizar` | `proponerActualizarSalida` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/salidas-academicas/:id/estado` | `proponerEstadoSalida` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/salidas-academicas/:id/asignaturas` | `proponerAsignarAsignaturasSalida` |
| PUT | `/solicitudes-cambio/planes-estudio/:planId/regla-optativas` | `proponerGuardarReglaOptativa` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/regla-optativas/eliminar` | `proponerEliminarReglaOptativa` |
| POST | `/solicitudes-cambio/planes-estudio/:planId/importacion` | `proponerImportarPlan` |

### Optativas y resolución

| Método | Ruta | Método del controlador | Rol |
|---|---|---|---|
| POST | `/solicitudes-cambio/optativas` | `proponerOptativa` | Asistente |
| POST | `/solicitudes-cambio/optativas/:id/actualizar` | `proponerActualizacionOptativa` | Asistente |
| POST | `/solicitudes-cambio/optativas/:id/estado` | `proponerEstadoOptativa` | Asistente |
| GET | `/solicitudes-cambio/mis-solicitudes` | `listarPropias` | Asistente |
| GET | `/solicitudes-cambio/pendientes` | `listarCoordinador` | Coordinador |
| POST | `/solicitudes-cambio/:id/aprobar` | `aprobar` | Coordinador responsable |
| POST | `/solicitudes-cambio/:id/rechazar` | `rechazar` | Coordinador responsable |

## Migración y despliegue

`backend/src/migrations/2026101900000-AddHierarchicalAccess.ts` crea las cuatro tablas jerárquicas. Está registrada en `database.config.ts` y en la lista permitida por `run-migrations.js`.

- `migrationsRun` permanece desactivado.
- El ejecutor manual exige `--apply` y confirmación exacta del nombre de la base.
- `DB_SYNCHRONIZE=true` no está habilitado para las bases persistentes.
- La migración no se ha aplicado a `sgpa` ni a `sgpa_test` durante este desarrollo.
- `down()` rechaza eliminar las tablas si cualquiera contiene datos.

La activación institucional requiere respaldo verificado, ventana de despliegue y configuración inicial de carreras y permisos para las cuentas coordinadoras.

## Verificadores MySQL nativos

Los verificadores de Jerarquía, Cursos y Etapa 4 están diseñados para una instancia MySQL nativa temporal distinta del servicio habitual.

El verificador de Etapa 4 exige puerto explícito distinto de 3306 y de la fuente, UUID diferente, `datadir` bajo el directorio temporal dentro de una carpeta `sgpa-jerarquia-*`, y un esquema nuevo `sgpa_etapa4_qa*` con caracteres seguros. Un esquema preexistente provoca un fallo seguro. El script no ejecuta `DROP DATABASE` ni reutiliza esquemas anteriores. La fuente persistente se usa únicamente para identidad y `SHOW CREATE TABLE`; las escrituras se dirigen al destino temporal verificado.

## Estado por módulo

| Módulo | Estado actual | Alcance |
|---|---|---|
| Usuarios, roles, permisos y jerarquía | Integrado | Creación, invitación, dependencia, delegación, revocación y auditoría |
| Estudiantes | Integrado | Lectura filtrada y seis operaciones mediante aprobación |
| Cursos | Integrado | Cursos compartidos y cinco operaciones mediante aprobación |
| Planes de estudio | Integrado | Plan, asignaturas, requisitos, salidas, reglas e importación |
| Optativas | Integrado | Optativas disciplinarias y tres operaciones mediante aprobación |
| Estructura académica | Integrado para alcance | Consulta filtrada y bloqueo de la vía antigua |
| Profesores y perfiles | Parcial | Las rutas no integradas permanecen cerradas |
| Formularios de estudiantes | Parcial | Sin flujo jerárquico completo de propuestas |
| Oferta y proyección | Parcial | Sin flujo general de propuestas |
| Aulas y periodos | Bloqueado por gobernanza | Administración global; permisos no delegables por carrera |

## Resultados de QA

### Resultado más reciente

| Verificación | Resultado |
|---|---|
| Backend Jest | **1.240 pruebas aprobadas y 4 omitidas** |
| Frontend | **50 pruebas aprobadas** |
| Contratos IPC | **8 aprobados** |
| Build backend | Aprobado |
| Empaquetado Electron para Windows x64 | Aprobado |
| MySQL nativo temporal | Aprobado |
| QA funcional con administrador, coordinador y asistente | Aprobado |
| Revocaciones, desactivaciones, solicitudes y aprobaciones | Verificadas |

Las cuatro pruebas omitidas corresponden a casos que requieren configuración manual controlada; no son fallas.

### Resultados históricos

La auditoría anterior cerró con **1.229 pruebas backend aprobadas y 4 omitidas**. La corrección final añadió 11 pruebas para las salvaguardas del verificador MySQL, por lo que el resultado vigente es 1.240 aprobadas y 4 omitidas. Durante etapas anteriores también se registraron conteos menores de frontend porque faltaban pruebas de regresión; esos resultados quedan sustituidos por las 50 pruebas actuales. Las clasificaciones parciales o fallidas de las primeras etapas describían el estado de ese momento y no el estado actual.

## Privacidad y evidencia

- Este documento no contiene rutas absolutas de equipos, UUID, PID, credenciales ni nombres concretos de esquemas temporales.
- Las credenciales se obtienen del entorno y no se imprimen.
- Los reportes funcionales con evidencia privada permanecen fuera del repositorio.
- Los datos insertados por los verificadores son ficticios y se limitan a la instancia temporal verificada.

## Límites pendientes

- Profesores, perfiles, formularios, oferta y proyección requieren políticas de propiedad y flujos adicionales antes de abrir todas sus operaciones a cuentas jerárquicas.
- Aulas y Periodos requieren una decisión institucional antes de permitir gestión por carrera.
- Los verificadores MySQL son herramientas manuales de QA. No deben ejecutarse contra servicios persistentes ni incorporarse a un proceso automático sin aprovisionar primero una instancia temporal independiente.
