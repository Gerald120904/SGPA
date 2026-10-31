export interface OpcionAsignaturaFormulario {
  planAsignaturaId: number;
  cursoId: number;
  codigo: string;
  nombre?: string;
}

interface PreguntaFormulario {
  questionId: string;
}

interface DatosPersonalesFormulario {
  primerNombre: PreguntaFormulario;
  segundoNombre: PreguntaFormulario;
  primerApellido: PreguntaFormulario;
  segundoApellido: PreguntaFormulario;
  identificacion: PreguntaFormulario;
  correoEstudiantil: PreguntaFormulario;
  contacto: PreguntaFormulario;
  optativasNoDisciplinarias: PreguntaFormulario;
}

export interface MapaPreguntasFormularioV1 extends DatosPersonalesFormulario {
  version?: 1;
  periodoIngreso: PreguntaFormulario & {
    opciones: Record<string, number>;
  };
  asignaturasAprobadas: PreguntaFormulario & {
    opciones: Record<string, OpcionAsignaturaFormulario>;
  };
}

export interface GrupoAsignaturasFormularioV2 {
  nivel: number;
  ciclo: number;
  questionId: string;
  opciones: Record<string, OpcionAsignaturaFormulario>;
}

export interface MapaPreguntasFormularioV2 extends DatosPersonalesFormulario {
  version: 2;
  ingreso: {
    anio: PreguntaFormulario;
    ciclo: PreguntaFormulario;
    periodos: Record<string, number>;
  };
  asignaturasAprobadas: {
    grupos: GrupoAsignaturasFormularioV2[];
  };
}

export type MapaPreguntasFormulario =
  MapaPreguntasFormularioV1 | MapaPreguntasFormularioV2;
