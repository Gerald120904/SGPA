/** Estado único compartido por los controladores del módulo de Cursos. */
export const estadoCursos = {
  cursos: [],
  carrerasDisponibles: [],
  planesDisponibles: [],
  carreraSeleccionadaId: null,
  planCarreraSeleccionado: null,
  asignaturasPlanCarrera: [],
  requisitosPlanCarrera: [],
  instanciaActual: 0,
  seleccionCarreraActual: 0,
  paginaCursos: 1,
};

export function reiniciarEstadoCursos() {
  estadoCursos.cursos = [];
  estadoCursos.carrerasDisponibles = [];
  estadoCursos.planesDisponibles = [];
  estadoCursos.carreraSeleccionadaId = null;
  estadoCursos.planCarreraSeleccionado = null;
  estadoCursos.asignaturasPlanCarrera = [];
  estadoCursos.requisitosPlanCarrera = [];
  estadoCursos.paginaCursos = 1;
}
