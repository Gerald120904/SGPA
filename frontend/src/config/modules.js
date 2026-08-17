export const MODULES = [

  {
    id: 'dashboard',
    title: 'Dashboard',
    route: '/dashboard',
    icon: 'layout-dashboard',
    section: null
  },

  {
    id: 'usuarios',
    title: 'Usuarios',
    route: '/usuarios',
    icon: 'users',
    section: 'Gestión'
  },

  {
    id: 'estudiantes',
    title: 'Estudiantes',
    route: '/estudiantes',
    icon: 'graduation-cap',
    section: 'Gestión'
  },

  {
    id: 'carreras',
    title: 'Carreras',
    route: '/carreras',
    icon: 'school',
    section: 'Gestión'
  },

  {
    id: 'cursos',
    title: 'Cursos',
    route: '/cursos',
    icon: 'book-open',
    section: 'Gestión'
  },

  {
    id: 'profesores',
    title: 'Profesores',
    route: '/profesores',
    icon: 'briefcase',
    section: 'Gestión'
  },

  {
    id: 'aulas',
    title: 'Aulas',
    route: '/aulas',
    icon: 'door-open',
    section: 'Gestión'
  },

  {
    id: 'periodos',
    title: 'Periodos académicos',
    route: '/periodos',
    icon: 'calendar-days',
    section: 'Gestión'
  },

  {
    id: 'proyeccion',
    title: 'Proyección',
    route: '/proyeccion',
    icon: 'line-chart',
    section: 'Planificación'
  },

  {
    id: 'oferta',
    title: 'Oferta académica',
    route: '/oferta',
    icon: 'clipboard-list',
    section: 'Planificación'
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