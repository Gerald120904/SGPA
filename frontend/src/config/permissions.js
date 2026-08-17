export const ROLE_PERMISSIONS = {

  ADMINISTRADOR: [
    '*'
  ],

  COORDINADOR_ACADEMICO: [
    'dashboard',
    'estudiantes',
    'carreras',
    'cursos',
    'profesores',
    'aulas',
    'periodos',
    'proyeccion',
    'oferta'
  ]

};


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