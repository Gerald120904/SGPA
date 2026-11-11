/**
 * SGPA — Funciones puras de roles, permisos, validaciones de mensajes y filtrado de Usuarios.
 * FRONTEND-ORDER-003
 */

import { ROLES } from '../../config/permissions.js';

export const ROLES_VISIBLES = Object.freeze({
  ADMIN_GLOBAL: 'Administrador global',
  COORDINADOR: 'Coordinador',
  PROFESOR: 'Profesor',
  ASISTENTE_ESTUDIANTIL: 'Asistente estudiantil',
});

export function nombreVisibleRol(nombre) {
  return ROLES_VISIBLES[nombre] || nombre;
}

export function normalizarRolesUsuario(usuario) {
  if (!Array.isArray(usuario?.roles)) {
    return [];
  }
  return usuario.roles
    .map((rol) =>
      typeof rol === 'string' ? { id: null, nombre: rol, descripcion: null } : rol,
    )
    .filter((rol) => rol?.nombre);
}

export function obtenerNombreCompletoUsuario(usuario) {
  return [usuario?.nombres, usuario?.apellido1, usuario?.apellido2]
    .filter(Boolean)
    .join(' ');
}

export function usuarioEsAdminGlobal(usuario) {
  return normalizarRolesUsuario(usuario).some(
    (rol) => rol.nombre === ROLES.ADMIN_GLOBAL,
  );
}

export function obtenerCodigosPermisos(permisos) {
  return new Set(
    (Array.isArray(permisos) ? permisos : [])
      .map((item) => (typeof item === 'string' ? item : item?.permiso))
      .filter(Boolean),
  );
}

export function mensajeResultado(resultado, mensajePredeterminado) {
  if (resultado?.ok) {
    return resultado;
  }
  throw new Error(resultado?.message || mensajePredeterminado);
}

export const INFORMACION_PERMISOS = Object.freeze({
  PROFESORES_VER: {
    nombre: 'Ver profesores',
    descripcion: 'Permite consultar información administrativa de profesores.',
  },
  PROFESORES_GESTIONAR: {
    nombre: 'Gestionar profesores',
    descripcion: 'Permite registrar, actualizar y administrar profesores.',
  },
  PROFESORES_ASIGNAR: {
    nombre: 'Asignar profesores',
    descripcion: 'Permite asignar profesores dentro de los procesos académicos autorizados.',
  },
  ATESTADOS_VALIDAR: {
    nombre: 'Validar atestados',
    descripcion: 'Permite aprobar o rechazar atestados de profesores.',
  },
  PERFILES_DOCENTES_VALIDAR: {
    nombre: 'Validar perfiles docentes',
    descripcion: 'Permite aprobar, rechazar o inactivar perfiles solicitados por profesores.',
  },
  ESTUDIANTES_VER: {
    nombre: 'Ver estudiantes',
    descripcion: 'Permite consultar expedientes y listas de estudiantes.',
  },
  ESTUDIANTES_GESTIONAR: {
    nombre: 'Gestionar estudiantes',
    descripcion: 'Permite registrar, actualizar y administrar estudiantes.',
  },
  PLANES_ESTUDIO_VER: {
    nombre: 'Ver planes de estudio',
    descripcion: 'Permite consultar planes de estudio y sus asignaturas.',
  },
  PLANES_ESTUDIO_GESTIONAR: {
    nombre: 'Gestionar planes de estudio',
    descripcion: 'Permite crear y modificar planes de estudio y mallas.',
  },
  CURSOS_VER: {
    nombre: 'Ver cursos',
    descripcion: 'Permite consultar el catálogo de asignaturas.',
  },
  CURSOS_GESTIONAR: {
    nombre: 'Gestionar cursos',
    descripcion: 'Permite crear, actualizar y desactivar cursos.',
  },
  AULAS_VER: {
    nombre: 'Ver aulas',
    descripcion: 'Permite consultar aulas, equipamiento, disponibilidad y ocupación.',
  },
  AULAS_GESTIONAR: {
    nombre: 'Gestionar aulas',
    descripcion: 'Permite administrar aulas y su información operativa.',
  },
  AULAS_ASIGNAR: {
    nombre: 'Asignar aulas',
    descripcion: 'Permite evaluar y utilizar aulas dentro de procesos de asignación académica.',
  },
  OPTATIVAS_VER: {
    nombre: 'Ver optativas',
    descripcion: 'Permite consultar el catálogo de asignaturas optativas.',
  },
  OPTATIVAS_GESTIONAR: {
    nombre: 'Gestionar optativas',
    descripcion: 'Permite registrar y administrar optativas del plan.',
  },
  PERFILES_ACADEMICOS_VER: {
    nombre: 'Ver perfiles docentes',
    descripcion: 'Permite consultar perfiles docentes oficiales.',
  },
  PERFILES_ACADEMICOS_GESTIONAR: {
    nombre: 'Gestionar perfiles académicos',
    descripcion: 'Permite administrar perfiles académicos según el alcance autorizado.',
  },
  FORMULARIOS_ESTUDIANTES_CREAR: {
    nombre: 'Crear formularios',
    descripcion: 'Permite crear nuevos formularios de prematrícula.',
  },
  FORMULARIOS_ESTUDIANTES_GESTIONAR: {
    nombre: 'Gestionar formularios',
    descripcion: 'Permite publicar, sincronizar y cerrar formularios.',
  },
  FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS: {
    nombre: 'Ver respuestas de formularios',
    descripcion: 'Permite consultar respuestas y solicitudes de estudiantes.',
  },
  PROYECCION_VER: {
    nombre: 'Ver proyección académica',
    descripcion: 'Permite consultar información de proyección académica.',
  },
  PROYECCION_GESTIONAR: {
    nombre: 'Gestionar proyección académica',
    descripcion: 'Permite realizar operaciones de gestión sobre la proyección académica.',
  },
  OFERTA_VER: {
    nombre: 'Ver oferta académica',
    descripcion: 'Permite consultar la oferta académica.',
  },
  OFERTA_GESTIONAR: {
    nombre: 'Gestionar oferta académica',
    descripcion: 'Permite realizar operaciones administrativas sobre la oferta académica.',
  },
});

export function obtenerInformacionPermiso(permiso) {
  if (INFORMACION_PERMISOS[permiso]) {
    return INFORMACION_PERMISOS[permiso];
  }

  const etiquetas = {
    VER: 'Ver',
    GESTIONAR: 'Gestionar',
    VALIDAR: 'Validar',
    ASIGNAR: 'Asignar',
    AUTORIZAR: 'Autorizar',
  };

  const partes = String(permiso || '').split('_');
  const accion = partes.pop();
  const recurso = partes
    .join(' ')
    .toLocaleLowerCase('es-CR')
    .replace('academicos', 'académicos')
    .replace('academica', 'académica')
    .replace('proyeccion', 'proyección');

  const etiquetaAccion = etiquetas[accion] || accion;
  return {
    nombre: `${etiquetaAccion} ${recurso}`.trim(),
    descripcion: `Permite ${etiquetaAccion.toLocaleLowerCase('es-CR')} ${recurso}.`,
  };
}

export function obtenerPermisosSugeridosRoles(roles = [], plantillasPermisos = {}) {
  if (roles.includes(ROLES.ADMIN_GLOBAL)) {
    return new Set();
  }

  return new Set(
    roles.flatMap((rol) => plantillasPermisos?.[rol] || []),
  );
}

const PREFIJOS_MODULOS_PERMISOS = [
  ['FORMULARIOS_ESTUDIANTES_', 'Formularios de estudiantes'],
  ['PLANES_ESTUDIO_', 'Planes de estudio'],
  ['PERFILES_ACADEMICOS_', 'Perfiles académicos'],
  ['PERFILES_DOCENTES_', 'Perfiles docentes'],
  ['ESTRUCTURA_ACADEMICA_', 'Estructura académica'],
  ['PROYECCION_', 'Proyección académica'],
  ['OFERTA_', 'Oferta académica'],
  ['ESTUDIANTES_', 'Estudiantes'],
  ['PROFESORES_', 'Profesores'],
  ['CURSOS_', 'Cursos'],
  ['CARRERAS_', 'Carreras'],
  ['OPTATIVAS_', 'Optativas'],
  ['PERIODOS_', 'Períodos académicos'],
  ['AULAS_', 'Aulas'],
];

export function agruparPermisosPorModulo(codigos = []) {
  const grupos = new Map();
  for (const codigo of codigos) {
    const grupo = PREFIJOS_MODULOS_PERMISOS.find(([prefijo]) => codigo.startsWith(prefijo));
    const etiqueta = grupo?.[1] || 'Otros permisos';
    if (!grupos.has(etiqueta)) {
      grupos.set(etiqueta, []);
    }
    grupos.get(etiqueta).push(codigo);
  }
  return grupos;
}

export function obtenerEstadoSeleccionPermisosCarrera(permisos) {
  const editables = Array.from(permisos || []).filter((permiso) => !permiso.disabled);
  const seleccionados = editables.filter((permiso) => permiso.checked).length;

  return {
    checked: editables.length > 0 && seleccionados === editables.length,
    indeterminate: seleccionados > 0 && seleccionados < editables.length,
    disabled: editables.length === 0,
  };
}

export function establecerSeleccionPermisosCarrera(permisos, seleccionado) {
  Array.from(permisos || [])
    .filter((permiso) => !permiso.disabled)
    .forEach((permiso) => {
      permiso.checked = Boolean(seleccionado);
    });
}

export function filtrarListaUsuarios(usuarios = [], termino = '') {
  const query = String(termino || '').trim().toLowerCase();
  if (!query) return usuarios;

  return usuarios.filter((usuario) => {
    const roles = normalizarRolesUsuario(usuario)
      .map((r) => nombreVisibleRol(r.nombre))
      .join(' ');
    const carreras = Array.isArray(usuario.carreras)
      ? usuario.carreras.map((c) => c.nombre || c.codigo || '').join(' ')
      : '';
    const nombreCompleto = obtenerNombreCompletoUsuario(usuario);
    const texto = [
      usuario.cedula || '',
      nombreCompleto,
      usuario.nombre || '',
      usuario.correo || '',
      usuario.email || '',
      roles,
      carreras,
    ]
      .join(' ')
      .toLowerCase();
    return texto.includes(query);
  });
}

export function construirMensajeRevocacionRol(impacto, carreras = []) {
  const nombreCarrera = (id) =>
    carreras.find((c) => Number(c.id) === Number(id))?.nombre || `#${id}`;
  const permisos =
    impacto.permisosRevocados
      .map((p) => `${nombreCarrera(p.carreraId)}: ${p.permiso}`)
      .join(', ') || 'ninguno';
  const asistentes =
    impacto.rol === ROLES.COORDINADOR
      ? `${impacto.totalAsistentes || 0} dependencia(s) vigente(s), de las cuales ` +
        `${impacto.totalAsistentesActivos || 0} corresponden a cuentas activas, perderán su coordinador: ` +
        `${
          (impacto.asistentesAfectados || [])
            .map(
              (a) =>
                `${a.nombre} (#${a.id}; ${a.cuentaActiva ? 'cuenta activa' : 'cuenta inactiva'}; ${
                  a.delegaciones
                    .map((p) => `${nombreCarrera(p.carreraId)}: ${p.permiso}`)
                    .join(', ') || 'sin permisos efectivos'
                })`,
            )
            .join('; ') || 'ninguno'
        }. ` +
        'Las cuentas activas seguirán activas y podrán ingresar sin permisos. ' +
        `Se invalidarán las sesiones del coordinador y de ${impacto.sesionesInvalidadas?.length || 0} asistente(s) con acceso efectivo. `
      : '';
  return (
    `Se revocará el rol ${impacto.rol} de ${impacto.usuario}. ` +
    `Permisos y carreras afectados: ${permisos}. ${asistentes}` +
    `${impacto.totalSolicitudes} solicitud(es) afectada(s) quedarán RECHAZADAS con motivo y auditoría. ` +
    '¿Desea continuar?'
  );
}

export function construirMensajeImpactoJerarquia(impacto, nombreObjetivo, carreras = []) {
  if (!impacto?.revocados?.length) {
    return `Se actualizarán las carreras y permisos de ${nombreObjetivo}. ¿Desea continuar?`;
  }

  const detalle = impacto.revocados
    .map((item) => {
      const [carreraId, permiso] = item.split(':');
      const nombreCarrera =
        carreras.find((c) => Number(c.id) === Number(carreraId))?.nombre || `#${carreraId}`;
      return `${nombreCarrera}: ${permiso}`;
    })
    .join(', ');

  return (
    `Se revocarán a ${nombreObjetivo}: ${detalle}. ` +
    `${impacto.totalSolicitudes} solicitud(es) afectada(s) quedarán RECHAZADAS con motivo y auditoría. ` +
    'Las demás solicitudes permanecerán pendientes. ¿Desea continuar?'
  );
}
