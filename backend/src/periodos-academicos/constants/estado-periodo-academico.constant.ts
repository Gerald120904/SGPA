export enum EstadoPeriodoAcademico {
  BORRADOR = 'BORRADOR',
  EN_PREPARACION = 'EN_PREPARACION',
  EN_CURSO = 'EN_CURSO',
  CERRADO = 'CERRADO',
  CANCELADO = 'CANCELADO',
}

export const ESTADOS_PERIODO_ACADEMICO = Object.values(
  EstadoPeriodoAcademico,
);
