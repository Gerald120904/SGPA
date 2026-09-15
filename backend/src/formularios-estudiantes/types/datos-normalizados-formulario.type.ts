export interface AsignaturaAprobadaFormulario {
  planAsignaturaId: number;
  cursoId: number;
  codigo: string;
}

export interface DatosNormalizadosFormulario {
  primerNombre: string;
  segundoNombre: string | null;

  primerApellido: string;
  segundoApellido: string | null;

  identificacion: string;
  correoEstudiantil: string;
  contacto: string | null;

  periodoIngresoId: number;

  asignaturasAprobadas: AsignaturaAprobadaFormulario[];

  optativasNoDisciplinarias: string | null;

  requiereRevisionOptativas: boolean;
}
