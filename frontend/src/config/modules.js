export const MODULES = [

  /* =======================================================
     PRINCIPAL
     ======================================================= */

{
  id: 'home',
  title: 'Sistema de Gestión y Proyección Académica',
  navLabel: 'Inicio',
  route: '/home',
  icon: 'house',
  section: 'Principal',
  description:
    'Resumen general del sistema'
},

{
  id: 'dashboard',
  title: 'Dashboard',
  navLabel: 'Panel de gestión',
  route: '/dashboard',
  icon: 'layout-dashboard',
  section: 'Principal',
  description:
    'Acceso a los módulos del sistema'
},


  /* =======================================================
     GESTIÓN ACADÉMICA
     ======================================================= */

  {
    id: 'estudiantes',
    title: 'Estudiantes',
    route: '/estudiantes',
    icon: 'users',
    section: 'Gestión académica',
    description:
      'Gestión de estudiantes y avance curricular'
  },

  {
    id: 'carreras',
    title: 'Carreras',
    route: '/carreras',
    icon: 'graduation-cap',
    section: 'Gestión académica',
    description:
      'Administración de carreras y planes académicos'
  },

  {
    id: 'planes-estudio',
    title: 'Planes de estudio',
    route: '/planes-estudio',
    icon: 'clipboard-list',
    section: 'Gestión académica',
    description:
      'Planes académicos y estructura curricular'
  },

  {
    id: 'cursos',
    title: 'Cursos',
    route: '/cursos',
    icon: 'book-open',
    section: 'Gestión académica',
    description:
      'Cursos, malla curricular y requisitos'
  },

  {
    id: 'profesores',
    title: 'Profesores',
    route: '/profesores',
    icon: 'briefcase',
    section: 'Gestión académica',
    description:
      'Gestión docente y disponibilidad'
  },

  {
    id: 'aulas',
    title: 'Aulas',
    route: '/aulas',
    icon: 'door-open',
    section: 'Gestión académica',
    description:
      'Espacios, capacidades y disponibilidad'
  },

  {
    id: 'periodos',
    title: 'Periodos académicos',
    route: '/periodos',
    icon: 'calendar-days',
    section: 'Gestión académica',
    description:
      'Administración de periodos y ciclos académicos'
  },

  {
    id: 'oferta',
    title: 'Oferta académica',
    route: '/oferta',
    icon: 'clipboard-list',
    section: 'Gestión académica',
    description:
      'Planificación de grupos, horarios y oferta'
  },


  /* =======================================================
     PLANIFICACIÓN
     ======================================================= */

  {
    id: 'proyeccion',
    title: 'Proyección',
    route: '/proyeccion',
    icon: 'line-chart',
    section: 'Planificación',
    description:
      'Proyección de matrícula y análisis de demanda'
  },


  /* =======================================================
     ADMINISTRACIÓN
     ======================================================= */

  {
    id: 'usuarios',
    title: 'Usuarios',
    route: '/usuarios',
    icon: 'user-cog',
    section: 'Administración',
    description:
      'Usuarios, roles y acceso al sistema'
  }

];


export function obtenerModuloPorRuta(
  route
) {

  return MODULES.find(
    (module) =>
      module.route === route
  );

}


export function obtenerModuloPorId(
  id
) {

  return MODULES.find(
    (module) =>
      module.id === id
  );

}
