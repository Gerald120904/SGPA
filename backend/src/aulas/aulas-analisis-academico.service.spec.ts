import { BadRequestException } from '@nestjs/common';
import { AulasAnalisisAcademicoService } from './aulas-analisis-academico.service';
import { AulasService } from './aulas.service';
import { ConflictosAcademicosService } from '../oferta-academica/conflictos-academicos.service';

describe('AulasAnalisisAcademicoService', () => {
  const evaluacionActual = {
    aulaId: 7,
    apta: true,
    requiereAutorizacionSobrecupo: false,
    motivo: null,
  };
  const analisisAcademico = {
    resultado: 'INDETERMINADA',
    coincidencias: [{ origen: 'CLASE', id: 3 }],
    historicos: [],
    zonaHoraria: 'America/Costa_Rica',
  };
  const aulas = { evaluarAulaParaAsignacion: jest.fn() };
  const conflictos = { analizar: jest.fn() };
  const service = new AulasAnalisisAcademicoService(
    aulas as unknown as AulasService,
    conflictos as unknown as ConflictosAcademicosService,
  );
  const dto = {
    periodoId: 2,
    fechaHoraInicio: '2027-10-18T14:00:00Z',
    fechaHoraFin: '2027-10-18T15:00:00Z',
    cantidadEstudiantes: 20,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    aulas.evaluarAulaParaAsignacion.mockResolvedValue(evaluacionActual);
    conflictos.analizar.mockResolvedValue(analisisAcademico);
  });

  it('conserva filtros y traduce UTC a hora local institucional', async () => {
    await expect(service.analizar(7, dto)).resolves.toEqual({
      evaluacionActual,
      analisisAcademico,
    });
    expect(aulas.evaluarAulaParaAsignacion).toHaveBeenCalledWith(7, {
      ...dto,
      fechaHoraInicio: '2027-10-18T08:00:00-06:00',
      fechaHoraFin: '2027-10-18T09:00:00-06:00',
    });
    expect(conflictos.analizar).toHaveBeenCalledWith({
      aulaId: 7,
      fecha: '2027-10-18',
      horaInicio: '08:00',
      horaFin: '09:00',
    });
  });

  it('mantiene explícitamente la clasificación indeterminada', async () => {
    const resultado = await service.analizar(7, dto);
    expect(resultado.analisisAcademico.resultado).toBe('INDETERMINADA');
    expect(resultado.evaluacionActual.apta).toBe(true);
  });

  it.each([
    ['sin zona', '2027-10-18T08:00:00'],
    ['segundos no representables por Aulas', '2027-10-18T08:00:01-06:00'],
    ['fecha inválida', '2027-99-18T08:00:00-06:00'],
  ])('rechaza %s antes de consultar', async (_caso, fechaHoraInicio) => {
    await expect(
      service.analizar(7, { ...dto, fechaHoraInicio }),
    ).rejects.toThrow(BadRequestException);
    expect(aulas.evaluarAulaParaAsignacion).not.toHaveBeenCalled();
    expect(conflictos.analizar).not.toHaveBeenCalled();
  });

  it('rechaza rangos que cruzan el día local', async () => {
    await expect(
      service.analizar(7, {
        ...dto,
        fechaHoraInicio: '2027-10-18T23:00:00-06:00',
        fechaHoraFin: '2027-10-19T00:00:00-06:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('propaga fallos de lectura sin concluir disponibilidad', async () => {
    conflictos.analizar.mockRejectedValue({ code: 'ER_BAD_FIELD_ERROR' });
    await expect(service.analizar(7, dto)).rejects.toMatchObject({
      code: 'ER_BAD_FIELD_ERROR',
    });
  });
});
