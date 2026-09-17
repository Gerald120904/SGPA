import { BadRequestException } from '@nestjs/common';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { crearDatosResultadoImportado } from './resultado-importado.factory';

describe('crearDatosResultadoImportado', () => {
  it('permite una aprobación Excel sin período', () => {
    expect(
      crearDatosResultadoImportado({
        estudianteId: 1,
        planAsignaturaId: 2,
        periodoId: null,
        resultado: ResultadoAcademico.APROBADO,
        fuenteRegistro: FuenteRegistroAcademico.EXCEL,
        registradoPorUsuarioId: 3,
      }),
    ).toMatchObject({ periodoId: null, resultado: 'APROBADO' });
  });

  it('no permite importar un REPROBADO sin período', () => {
    expect(() =>
      crearDatosResultadoImportado({
        estudianteId: 1,
        planAsignaturaId: 2,
        periodoId: null,
        resultado: ResultadoAcademico.REPROBADO,
        fuenteRegistro: FuenteRegistroAcademico.EXCEL,
        registradoPorUsuarioId: 3,
      }),
    ).toThrow(BadRequestException);
  });

  it('no permite una fuente manual sin período', () => {
    expect(() =>
      crearDatosResultadoImportado({
        estudianteId: 1,
        planAsignaturaId: 2,
        periodoId: null,
        resultado: ResultadoAcademico.APROBADO,
        fuenteRegistro: FuenteRegistroAcademico.MANUAL,
        registradoPorUsuarioId: 3,
      }),
    ).toThrow(BadRequestException);
  });
});
