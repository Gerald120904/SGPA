export const ROLE_PERMISSIONS = {

  ADMINISTRADOR: [
    '*'
  ],

  COORDINADOR_ACADEMICO: [
    'home',
    'dashboard',
    'estudiantes',
    'carreras',
    'cursos',
    'profesores',
    'aulas',
    'periodos',
    'oferta',
    'proyeccion'
  ]

};


/*
 * IMPORTANTE:
 *
 * Esto solamente controla la visibilidad
 * de opciones en frontend.
 *
 * La autorización real debe ser validada
 * también por NestJS.
 */

export function puedeAcceder(
  rol,
  modulo
) {

  const permisos =
    ROLE_PERMISSIONS[rol] || [];


  return (
    permisos.includes('*') ||
    permisos.includes(modulo)
  );

}