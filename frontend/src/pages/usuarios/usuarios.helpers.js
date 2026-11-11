/**
 * SGPA — Funciones puras de roles, permisos y filtrado de Usuarios.
 * FRONTEND-REF-MASTER
 */

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

export const INFORMACION_PERMISOS = Object.freeze({
  PROFESORES_VER: {
    nombre: 'Ver profesores',
    descripcion: 'Permite consultar información administrativa de profesores.',
  },
  PROFESORES_GESTIONAR: {
    nombre: 'Gestionar profesores',
    descripcion: 'Permite registrar, actualizar y administrar profesores.',
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
    descripcion: 'Permite consultar aulas y su disponibilidad.',
  },
  AULAS_GESTIONAR: {
    nombre: 'Gestionar aulas',
    descripcion: 'Permite registrar y administrar aulas e inventario.',
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
    nombre: 'Gestionar perfiles docentes',
    descripcion: 'Permite crear y actualizar perfiles y requisitos.',
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
});

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
    const texto = `${usuario.nombre || ''} ${usuario.email || ''} ${usuario.cedula || ''} ${roles} ${carreras}`.toLowerCase();
    return texto.includes(query);
  });
}
