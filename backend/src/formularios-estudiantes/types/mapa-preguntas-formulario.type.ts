export interface OpcionAsignaturaFormulario {
  planAsignaturaId: number;
  cursoId: number;
  codigo: string;
}

export interface MapaPreguntasFormulario {
  primerNombre: {
    questionId: string;
  };

  segundoNombre: {
    questionId: string;
  };

  primerApellido: {
    questionId: string;
  };

  segundoApellido: {
    questionId: string;
  };

  identificacion: {
    questionId: string;
  };

  correoEstudiantil: {
    questionId: string;
  };

  contacto: {
    questionId: string;
  };

  periodoIngreso: {
    questionId: string;
    opciones: Record<string, number>;
  };

  asignaturasAprobadas: {
    questionId: string;
    opciones: Record<string, OpcionAsignaturaFormulario>;
  };

  optativasNoDisciplinarias: {
    questionId: string;
  };
}
