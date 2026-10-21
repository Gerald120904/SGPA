import { Repository } from 'typeorm';
import { IndisponibilidadAula } from '../aulas/entities/indisponibilidad-aula.entity';
import { ReservaAula } from '../aulas/entities/reserva-aula.entity';
import {
  analizarConflictosTemporales,
  ConflictosAcademicosService,
  DatosConflictoAcademico,
  SolicitudConflictoAcademico,
} from './conflictos-academicos.service';
import { OfertaAcademicaService } from './oferta-academica.service';

describe('QA-AUL-002 Fase 4: conflictos internos', () => {
  const solicitud: SolicitudConflictoAcademico = {
    aulaId: 7,
    fecha: '2027-01-04', // lunes institucional
    horaInicio: '08:00',
    horaFin: '10:00',
  };
  const clase = (cambios: Record<string, unknown> = {}) => ({
    fecha: solicitud.fecha,
    grupo: {
      id: 11,
      curso: { id: 20, codigo: 'MAT-20', nombre: 'Matemática' },
      periodo: {
        id: 30,
        codigo: '2027-I',
        fechaInicio: '2027-01-03',
        fechaFin: '2027-01-31',
      },
      numeroGrupo: '01',
      tipoGrupo: 'QA',
      cupoMaximo: 20,
      estado: 'ESTADO_SIN_POLITICA',
      profesorIdLegado: null,
    },
    horario: {
      id: 41,
      aula: { id: 7, codigo: 'A-07', nombre: 'Aula 7' },
      diaSemana: 1,
      horaInicio: '07:00:00',
      horaFin: '09:00:00',
    },
    ...cambios,
  });
  const reserva = (cambios: Record<string, unknown> = {}) => ({
    id: 51,
    aulaId: 7,
    activo: true,
    fechaHoraInicio: new Date('2027-01-04T14:00:00Z'),
    fechaHoraFin: new Date('2027-01-04T16:00:00Z'),
    ...cambios,
  });
  const indisponibilidad = (cambios: Record<string, unknown> = {}) => ({
    id: 61,
    aulaId: 7,
    activo: true,
    fechaHoraInicio: new Date('2027-01-04T14:00:00Z'),
    fechaHoraFin: new Date('2027-01-04T16:00:00Z'),
    ...cambios,
  });
  const datos = (
    cambios: Record<string, unknown> = {},
  ): DatosConflictoAcademico =>
    ({
      horarios: [],
      reservas: [],
      indisponibilidades: [],
      ...cambios,
    }) as DatosConflictoAcademico;
  const analizar = (
    cambios: Record<string, unknown> = {},
    consulta = solicitud,
  ) => analizarConflictosTemporales(consulta, datos(cambios));

  it('detecta dos clases solapadas en la misma aula sin inventar estado ocupante', () => {
    expect(analizar({ horarios: [clase()] }).resultado).toBe('INDETERMINADA');
  });

  it('permite clases contiguas 07–09 y 09–11', () => {
    expect(
      analizar(
        { horarios: [clase()] },
        { ...solicitud, horaInicio: '09:00', horaFin: '11:00' },
      ).resultado,
    ).toBe('SIN_COINCIDENCIA');
  });

  it('distingue dos grupos del mismo curso por identificador de grupo', () => {
    const segundo = clase({
      grupo: { ...clase().grupo, id: 12, numeroGrupo: '02' },
      horario: { ...clase().horario, id: 42 },
    });
    const resultado = analizar({ horarios: [clase(), segundo] });
    expect(resultado.coincidencias.map((item) => item.grupoId)).toEqual([
      11, 12,
    ]);
  });

  it('ignora clases de otra aula y sesiones sin aula', () => {
    const otra = clase({ horario: { ...clase().horario, aula: { id: 8 } } });
    const sinAula = clase({
      horario: { ...clase().horario, id: 43, aula: null },
    });
    expect(analizar({ horarios: [otra, sinAula] }).resultado).toBe(
      'SIN_COINCIDENCIA',
    );
  });

  it('ignora clases fuera de fechas del período', () => {
    const fuera = clase({
      grupo: {
        ...clase().grupo,
        periodo: { ...clase().grupo.periodo, fechaFin: '2027-01-03' },
      },
    });
    expect(analizar({ horarios: [fuera] }).resultado).toBe('SIN_COINCIDENCIA');
  });

  it('ignora otro día semanal', () => {
    const martes = clase({ horario: { ...clase().horario, diaSemana: 2 } });
    expect(analizar({ horarios: [martes] }).resultado).toBe('SIN_COINCIDENCIA');
  });

  it('evalúa todas las sesiones de un grupo y excluye solo el horario indicado', () => {
    const otraSesion = clase({
      horario: {
        ...clase().horario,
        id: 44,
        horaInicio: '09:00:00',
        horaFin: '11:00:00',
      },
    });
    const resultado = analizarConflictosTemporales(
      { ...solicitud, excluirHorarioId: 41 },
      datos({ horarios: [clase(), otraSesion] }),
    );
    expect(resultado.coincidencias.map((item) => item.id)).toEqual([44]);
  });

  it('confirma conflicto con reserva activa y mantenimiento activo', () => {
    const resultado = analizar({
      reservas: [reserva()],
      indisponibilidades: [indisponibilidad()],
    });
    expect(resultado.resultado).toBe('CONFLICTO');
    expect(resultado.coincidencias.map((item) => item.origen)).toEqual([
      'RESERVA',
      'INDISPONIBILIDAD',
    ]);
  });

  it('devuelve ausencia de coincidencia para intervalos separados', () => {
    expect(
      analizar({
        horarios: [
          clase({
            horario: {
              ...clase().horario,
              horaInicio: '10:00:00',
              horaFin: '11:00:00',
            },
          }),
        ],
      }).resultado,
    ).toBe('SIN_COINCIDENCIA');
  });

  it('solo una configuración explícita de prueba puede clasificar un estado como ocupante', () => {
    const entrada = datos({ horarios: [clase()] });
    expect(analizarConflictosTemporales(solicitud, entrada).resultado).toBe(
      'INDETERMINADA',
    );
    expect(
      analizarConflictosTemporales(
        solicitud,
        entrada,
        new Set(['ESTADO_SIN_POLITICA']),
      ).resultado,
    ).toBe('CONFLICTO');
  });

  it('incluye fechas límite del período y convierte domingo a día 7', () => {
    const domingo = {
      ...solicitud,
      fecha: '2027-01-03',
    };
    const entrada = clase({
      fecha: domingo.fecha,
      horario: { ...clase().horario, diaSemana: 7 },
      grupo: {
        ...clase().grupo,
        periodo: {
          ...clase().grupo.periodo,
          fechaInicio: domingo.fecha,
          fechaFin: domingo.fecha,
        },
      },
    });
    expect(analizar({ horarios: [entrada] }, domingo).resultado).toBe(
      'INDETERMINADA',
    );
  });

  it('distingue fecha institucional de UTC para reservas', () => {
    const madrugadaLocal = {
      ...solicitud,
      fecha: '2027-01-04',
      horaInicio: '00:30',
      horaFin: '01:30',
    };
    const registro = reserva({
      fechaHoraInicio: new Date('2027-01-04T06:00:00Z'),
      fechaHoraFin: new Date('2027-01-04T07:00:00Z'),
    });
    expect(analizar({ reservas: [registro] }, madrugadaLocal).resultado).toBe(
      'CONFLICTO',
    );
    expect(
      analizar(
        { reservas: [registro] },
        { ...madrugadaLocal, fecha: '2027-01-03' },
      ).resultado,
    ).toBe('SIN_COINCIDENCIA');
  });

  it('conserva registros históricos sin convertirlos en conflicto', () => {
    const historica = reserva({ activo: false });
    const entrada = datos({ reservas: [historica] });
    const resultado = analizarConflictosTemporales(solicitud, entrada);
    expect(resultado.resultado).toBe('SIN_COINCIDENCIA');
    expect(resultado.coincidencias).toEqual([]);
    expect(resultado.historicos).toEqual([{ origen: 'RESERVA', id: 51 }]);
    expect(entrada.reservas[0].activo).toBe(false);
  });

  it('rechaza fecha y horas inválidas antes de consultar', () => {
    expect(() => analizar({}, { ...solicitud, fecha: '2027-02-30' })).toThrow();
    expect(() =>
      analizar({}, { ...solicitud, horaInicio: '10:00', horaFin: '09:00' }),
    ).toThrow();
  });

  it('propaga error de lectura MySQL sin tratar el aula como libre', async () => {
    const oferta = {
      consultarHorariosAulaEnFecha: jest
        .fn()
        .mockRejectedValue(new Error('MySQL no disponible')),
    };
    const reservas = { query: jest.fn().mockResolvedValue([]) };
    const indisponibilidades = { query: jest.fn().mockResolvedValue([]) };
    const service = new ConflictosAcademicosService(
      oferta as unknown as OfertaAcademicaService,
      reservas as unknown as Repository<ReservaAula>,
      indisponibilidades as unknown as Repository<IndisponibilidadAula>,
    );
    await expect(service.analizar(solicitud)).rejects.toThrow(
      'MySQL no disponible',
    );
  });

  it('consulta las tres fuentes sin escritura y clasifica el resultado', async () => {
    const oferta = {
      consultarHorariosAulaEnFecha: jest.fn().mockResolvedValue([clase()]),
    };
    const reservas = {
      query: jest.fn().mockResolvedValue([
        {
          id: 51,
          aulaId: 7,
          activo: 1,
          inicioLocal: '2027-01-04 08:00:00',
          finLocal: '2027-01-04 10:00:00',
        },
      ]),
    };
    const indisponibilidades = { query: jest.fn().mockResolvedValue([]) };
    const service = new ConflictosAcademicosService(
      oferta as unknown as OfertaAcademicaService,
      reservas as unknown as Repository<ReservaAula>,
      indisponibilidades as unknown as Repository<IndisponibilidadAula>,
    );
    expect((await service.analizar(solicitud)).resultado).toBe('CONFLICTO');
    expect(oferta.consultarHorariosAulaEnFecha).toHaveBeenCalledWith(
      7,
      solicitud.fecha,
    );
    expect(reservas.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM `reservas_aulas`'),
      [7, '2027-01-04 10:00:00', '2027-01-04 08:00:00'],
    );
    expect(indisponibilidades.query).toHaveBeenCalledTimes(1);
  });
});
