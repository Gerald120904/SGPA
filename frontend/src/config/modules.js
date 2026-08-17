export const MODULES = [

  {
    id: 'dashboard',
    title: 'Dashboard',
    route: '/dashboard',
    icon: 'layout-dashboard',
    section: null,
    description: 'Resumen general del sistema'
  },

  {
    id: 'usuarios',
    title: 'Usuarios',
    route: '/usuarios',
    icon: 'users',
    section: 'Gestión',
    description: 'Administración de cuentas y accesos'
  },

  {
    id: 'estudiantes',
    title: 'Estudiantes',
    route: '/estudiantes',
    icon: 'graduation-cap',
    section: 'Gestión',
    description: 'Gestión y avance curricular'
  },

  {
    id: 'carreras',
    title: 'Carreras',
    route: '/carreras',
    icon: 'school',
    section: 'Gestión',
    description: 'Carreras y estructura académica'
  },

  {
    id: 'cursos',
    title: 'Cursos',
    route: '/cursos',
    icon: 'book-open',
    section: 'Gestión',
    description: 'Malla, cursos y requisitos'
  },

  {
    id: 'profesores',
    title: 'Profesores',
    route: '/profesores',
    icon: 'briefcase',
    section: 'Gestión',
    description: 'Docentes y disponibilidad'
  },

  {
    id: 'aulas',
    title: 'Aulas',
    route: '/aulas',
    icon: 'door-open',
    section: 'Gestión',
    description: 'Espacios, capacidad y disponibilidad'
  },

  {
    id: 'periodos',
    title: 'Periodos académicos',
    route: '/periodos',
    icon: 'calendar-days',
    section: 'Gestión',
    description: 'Administración de ciclos académicos'
  },

  {
    id: 'proyeccion',
    title: 'Proyección',
    route: '/proyeccion',
    icon: 'line-chart',
    section: 'Planificación',
    description: 'Demanda y planificación académica'
  },

  {
    id: 'oferta',
    title: 'Oferta académica',
    route: '/oferta',
    icon: 'clipboard-list',
    section: 'Planificación',
    description: 'Grupos, horarios y oferta académica'
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