import { BadRequestException } from '@nestjs/common';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { OrigenAcademico } from './constants/origen-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';

interface ResultadoImportadoInput {
  estudianteId: number;
  planAsignaturaId: number;
  periodoId: number | null;
  resultado: ResultadoAcademico;
  fuenteRegistro: FuenteRegistroAcademico;
  registradoPorUsuarioId: number;
}

export function crearDatosResultadoImportado(input: ResultadoImportadoInput) {
  if (
    input.periodoId === null &&
    (input.resultado !== ResultadoAcademico.APROBADO ||
      ![
        FuenteRegistroAcademico.EXCEL,
        FuenteRegistroAcademico.GOOGLE_FORMS,
      ].includes(input.fuenteRegistro))
  ) {
    throw new BadRequestException(
      'Un resultado sin período solo puede ser una aprobación importada.',
    );
  }
  return {
    ...input,
    origenAcademico: OrigenAcademico.NO_ESPECIFICADO,
    observaciones: null,
  };
}
