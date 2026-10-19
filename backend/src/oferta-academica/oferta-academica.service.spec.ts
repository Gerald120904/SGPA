import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Grupo } from './entities/grupo.entity';
import { HorarioGrupo } from './entities/horario-grupo.entity';
import { OfertaAcademicaService } from './oferta-academica.service';

describe('OfertaAcademicaService: lectura de grupos y horarios', () => {
  const grupoRepository = { find: jest.fn() };
  const horarioRepository = { find: jest.fn() };
  let service: OfertaAcademicaService;

  const grupo = (changes: Record<string, unknown> = {}) =>
    ({
      id: 10,
      cursoId: 5,
      periodoId: 7,
      profesorId: 91,
      numeroGrupo: '01',
      tipoGrupo: 'REGISTRADO',
      cupoMaximo: 25,
      estado: 'VALOR_ALMACENADO_SIN_INTERPRETAR',
      curso: { id: 5, codigo: 'MAT-100', nombre: 'Matemática' },
      periodo: {
        id: 7,
        codigo: '2027-I',
        fechaInicio: '2027-01-01',
        fechaFin: '2027-06-30',
      },
      horarios: [],
      ...changes,
    }) as unknown as Grupo;

  const horario = (changes: Record<string, unknown> = {}) =>
    ({
      id: 20,
      grupoId: 10,
      aulaId: 3,
      diaSemana: 1,
      horaInicio: '08:00:00',
      horaFin: '10:00:00',
      aula: { id: 3, codigo: 'A-03', nombre: 'Aula 3' },
      grupo: grupo(),
      ...changes,
    }) as unknown as HorarioGrupo;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OfertaAcademicaService(
      grupoRepository as unknown as Repository<Grupo>,
      horarioRepository as unknown as Repository<HorarioGrupo>,
    );
  });

  it('lee grupos, curso, período, horarios múltiples y estado textual original', async () => {
    grupoRepository.find.mockResolvedValue([
      grupo({
        horarios: [
          horario({ id: 22, diaSemana: 3, horaInicio: '10:00:00' }),
          horario({ id: 20, diaSemana: 1 }),
        ],
      }),
      grupo({ id: 11, numeroGrupo: '02', profesorId: null }),
    ]);

    const result = await service.listarGrupos();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      curso: { id: 5, codigo: 'MAT-100' },
      periodo: { id: 7, fechaInicio: '2027-01-01', fechaFin: '2027-06-30' },
      numeroGrupo: '01',
      estado: 'VALOR_ALMACENADO_SIN_INTERPRETAR',
      profesorIdLegado: 91,
    });
    expect(result[0].horarios.map((item) => item.id)).toEqual([20, 22]);
    expect(result[0].horarios[0].aula).toEqual({
      id: 3,
      codigo: 'A-03',
      nombre: 'Aula 3',
    });
    expect(result[1]).toMatchObject({
      numeroGrupo: '02',
      profesorIdLegado: null,
    });
    expect(JSON.stringify(result)).not.toContain('profesorUsuarioId');
    expect(horarioRepository.find).not.toHaveBeenCalled();
  });

  it('mantiene un horario sin aula como nulo', async () => {
    grupoRepository.find.mockResolvedValue([
      grupo({ horarios: [horario({ aulaId: null, aula: null })] }),
    ]);

    const result = await service.listarGrupos();

    expect(result[0].horarios[0].aula).toBeNull();
  });

  it('convierte lunes y domingo al convenio MySQL 1–7 y acota por período', async () => {
    horarioRepository.find.mockResolvedValue([]);

    await service.consultarHorariosAulaEnFecha(3, '2027-01-04');
    await service.consultarHorariosAulaEnFecha(3, '2027-01-03');

    const monday = horarioRepository.find.mock.calls[0][0];
    const sunday = horarioRepository.find.mock.calls[1][0];
    expect(monday.where).toMatchObject({ aulaId: 3, diaSemana: 1 });
    expect(sunday.where).toMatchObject({ aulaId: 3, diaSemana: 7 });
    expect(monday.where.grupo.periodo.fechaInicio.value).toBe('2027-01-04');
    expect(monday.where.grupo.periodo.fechaFin.value).toBe('2027-01-04');
  });

  it('devuelve horarios contiguos sin decidir si ocupan aula', async () => {
    horarioRepository.find.mockResolvedValue([
      horario(),
      horario({ id: 21, horaInicio: '10:00:00', horaFin: '12:00:00' }),
    ]);

    const result = await service.consultarHorariosAulaEnFecha(3, '2027-01-04');

    expect(result.map((item) => item.horario.horaInicio)).toEqual([
      '08:00:00',
      '10:00:00',
    ]);
    expect(result[0].grupo.estado).toBe('VALOR_ALMACENADO_SIN_INTERPRETAR');
    expect(result[0]).not.toHaveProperty('ocupaAula');
  });

  it('rechaza fechas y aulas inválidas antes de consultar', async () => {
    await expect(
      service.consultarHorariosAulaEnFecha(0, '2027-01-04'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.consultarHorariosAulaEnFecha(3, '2027-02-30'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.consultarHorariosAulaEnFecha(3, '04/01/2027'),
    ).rejects.toThrow(BadRequestException);
    expect(horarioRepository.find).not.toHaveBeenCalled();
  });

  it('señala asociaciones incompletas en vez de devolver información libre', async () => {
    grupoRepository.find.mockResolvedValue([grupo({ curso: null })]);
    await expect(service.listarGrupos()).rejects.toThrow(
      InternalServerErrorException,
    );
    horarioRepository.find.mockResolvedValue([horario({ aula: null })]);
    await expect(
      service.consultarHorariosAulaEnFecha(3, '2027-01-04'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('expone error explícito cuando falta la tabla de grupos', async () => {
    grupoRepository.find.mockRejectedValue({
      driverError: { code: 'ER_NO_SUCH_TABLE' },
    });

    await expect(service.listarGrupos()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('propaga fallos de consulta desconocidos', async () => {
    horarioRepository.find.mockRejectedValue(new Error('Conexión fallida'));

    await expect(
      service.consultarHorariosAulaEnFecha(3, '2027-01-04'),
    ).rejects.toThrow('Conexión fallida');
  });
});
