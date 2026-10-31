import { AulasService } from './aulas.service';
import { TipoIndisponibilidadAula } from './constants/tipo-indisponibilidad-aula.constant';
import { Aula } from './entities/aula.entity';
import { IndisponibilidadAula } from './entities/indisponibilidad-aula.entity';
import { OPTIONAL_DEPS_METADATA } from '@nestjs/common/constants';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { Notificacion } from '../notificaciones/entities/notificacion.entity';

describe('D-02: Afectación de horarios y notificación docente por indisponibilidad de aula', () => {
  let service: AulasService;
  let aulaRepo: any;
  let indisponibilidadRepo: any;
  let auditoriaRepo: any;
  let dataSource: any;
  let notificacionesService: any;

  beforeEach(() => {
    aulaRepo = {
      findOne: jest.fn(),
    };
    indisponibilidadRepo = {
      create: jest.fn((dto) => ({ id: 99, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 99, ...entity })),
      find: jest.fn().mockResolvedValue([]),
    };
    auditoriaRepo = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    dataSource = {
      transaction: jest.fn((_isolation, cb) =>
        cb({
          query: jest.fn().mockResolvedValue([{ id: 10 }]),
        }),
      ),
      query: jest.fn(),
    };
    notificacionesService = {
      crear: jest.fn().mockResolvedValue({ id: 1 }),
    };

    service = new AulasService(
      aulaRepo,
      {} as any,
      {} as any,
      indisponibilidadRepo,
      { find: jest.fn().mockResolvedValue([]) } as any,
      auditoriaRepo,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { obtenerPorId: jest.fn() } as any,
      dataSource,
      notificacionesService,
    );
  });

  it('exige la dependencia de notificaciones y la conserva dentro de la transacción', async () => {
    const optional = Reflect.getMetadata(OPTIONAL_DEPS_METADATA, AulasService) ?? [];
    const parameters = Reflect.getMetadata('design:paramtypes', AulasService) ?? [];
    const notificationIndex = parameters.indexOf(NotificacionesService);
    expect(notificationIndex).toBeGreaterThanOrEqual(0);
    expect(optional).not.toContain(notificationIndex);

    const notificationRepo = { create: jest.fn((dto) => dto), save: jest.fn(async (dto) => dto) };
    const manager = {
      query: jest.fn().mockResolvedValue([{ id: 10 }]),
      getRepository: jest.fn((entity) => entity === Notificacion ? notificationRepo : {}),
    };
    dataSource.transaction.mockImplementation(async (_level, callback) => callback(manager));
    await (service as any).ejecutarOcupacionEnTransaccion([10], async (inside: AulasService) => {
      expect((inside as any).notificacionesService).toBeInstanceOf(NotificacionesService);
      expect((inside as any).ocupacionManager).toBe(manager);
    });
    expect(manager.getRepository).toHaveBeenCalledWith(Notificacion);
  });

  it('propaga un error de notificación para que la transacción pueda revertirse', async () => {
    jest.spyOn(service as any, 'obtenerEntidadPorId').mockResolvedValue({ id: 10, codigo: 'A-1', activo: true });
    (service as any).enTransaccionOcupacion = true;
    dataSource.query.mockResolvedValue([{ horarioId: 1, grupoId: 1, diaSemana: 1,
      horaInicio: '08:00:00', horaFin: '10:00:00', docenteUsuarioId: 45, carreraId: 106 }]);
    notificacionesService.crear.mockRejectedValue(new Error('Fallo de persistencia'));
    await expect(service.crearIndisponibilidadAula(10, {
      tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
      fechaHoraInicio: '2026-11-02T08:00:00',
      fechaHoraFin: '2026-11-02T12:00:00',
      motivo: 'Prueba',
    } as any, 1)).rejects.toThrow('Fallo de persistencia');
  });

  it('calcula las sesiones afectadas en un aula y emite notificaciones individuales detalladas a los docentes', async () => {
    const aula: Aula = {
      id: 10,
      codigo: 'AULA-201',
      nombre: 'Laboratorio de Informática 1',
      activo: true,
    } as Aula;

    jest.spyOn(service as any, 'obtenerEntidadPorId').mockResolvedValue(aula);
    (service as any).enTransaccionOcupacion = true;

    // Supongamos una semana de indisponibilidad por mantenimiento eléctrico:
    // Lunes 2 de noviembre de 2026 a Viernes 6 de noviembre de 2026
    const fechaInicio = '2026-11-02T08:00:00';
    const fechaFin = '2026-11-06T17:00:00';

    // Mockeamos 5 horarios de clase programados en esa aula para el profesor Carlos (usuarioId: 45)
    // Lunes (1), Martes (2), Miércoles (3), Jueves (4), Viernes (5)
    const horariosMock = [
      {
        horarioId: 101,
        grupoId: 201,
        aulaId: 10,
        diaSemana: 1, // Lunes 2026-11-02
        horaInicio: '08:00:00',
        horaFin: '10:00:00',
        numeroGrupo: '01',
        cursoCodigo: 'EIF201',
        cursoNombre: 'Programación I',
        carreraId: 106,
        docenteUsuarioId: 45,
        docenteNombre: 'Carlos Gómez',
      },
      {
        horarioId: 102,
        grupoId: 202,
        aulaId: 10,
        diaSemana: 2, // Martes 2026-11-03
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        numeroGrupo: '02',
        cursoCodigo: 'EIF203',
        cursoNombre: 'Estructuras de Datos',
        carreraId: 106,
        docenteUsuarioId: 45,
        docenteNombre: 'Carlos Gómez',
      },
      {
        horarioId: 103,
        grupoId: 201,
        aulaId: 10,
        diaSemana: 3, // Miércoles 2026-11-04
        horaInicio: '08:00:00',
        horaFin: '10:00:00',
        numeroGrupo: '01',
        cursoCodigo: 'EIF201',
        cursoNombre: 'Programación I',
        carreraId: 106,
        docenteUsuarioId: 45,
        docenteNombre: 'Carlos Gómez',
      },
      {
        horarioId: 104,
        grupoId: 202,
        aulaId: 10,
        diaSemana: 4, // Jueves 2026-11-05
        horaInicio: '10:00:00',
        horaFin: '12:00:00',
        numeroGrupo: '02',
        cursoCodigo: 'EIF203',
        cursoNombre: 'Estructuras de Datos',
        carreraId: 106,
        docenteUsuarioId: 45,
        docenteNombre: 'Carlos Gómez',
      },
      {
        horarioId: 105,
        grupoId: 203,
        aulaId: 10,
        diaSemana: 5, // Viernes 2026-11-06
        horaInicio: '14:00:00',
        horaFin: '16:00:00',
        numeroGrupo: '01',
        cursoCodigo: 'EIF205',
        cursoNombre: 'Bases de Datos',
        carreraId: 106,
        docenteUsuarioId: 45,
        docenteNombre: 'Carlos Gómez',
      },
    ];

    dataSource.query.mockResolvedValue(horariosMock);

    const dto = {
      tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
      fechaHoraInicio: fechaInicio,
      fechaHoraFin: fechaFin,
      motivo: 'Mantenimiento del cableado eléctrico e iluminación',
    };

    const resultado = await service.crearIndisponibilidadAula(10, dto as any, 1);

    expect(resultado).toBeDefined();
    expect(resultado.id).toBe(99);

    // Debe haber llamado a notificacionesService.crear exactamente 5 veces (una por cada sesión afectada en la semana)
    expect(notificacionesService.crear).toHaveBeenCalledTimes(5);

    // Verificamos la primera llamada (Lunes)
    const llamada1 = notificacionesService.crear.mock.calls[0][0];
    expect(llamada1.usuarioId).toBe(45);
    expect(llamada1.titulo).toBe('Afectación de aula por indisponibilidad');
    expect(llamada1.tipo).toBe('INDISPONIBILIDAD_AULA');
    expect(llamada1.mensaje).toContain('Programación I');
    expect(llamada1.mensaje).toContain('Grupo 01');
    expect(llamada1.mensaje).toContain('AULA-201');
    expect(llamada1.mensaje).toContain('2026-11-02');
    expect(llamada1.mensaje).toContain('08:00 a 10:00');
    expect(llamada1.mensaje).toContain('Mantenimiento del cableado eléctrico e iluminación');
    expect(llamada1.mensaje).toContain('gestione un aula alterna o coordine la reprogramación');

    // Metadatos de auditoría y trazabilidad
    expect(llamada1.metadatos).toEqual(
      expect.objectContaining({
        indisponibilidadId: 99,
        aulaId: 10,
        aulaCodigo: 'AULA-201',
        cursoCodigo: 'EIF201',
        grupoId: 201,
        horarioId: 101,
        fecha: '2026-11-02',
        horaInicio: '08:00:00',
        horaFin: '10:00:00',
      }),
    );

    // Verificamos la quinta llamada (Viernes)
    const llamada5 = notificacionesService.crear.mock.calls[4][0];
    expect(llamada5.usuarioId).toBe(45);
    expect(llamada5.mensaje).toContain('Bases de Datos');
    expect(llamada5.mensaje).toContain('2026-11-06');
    expect(llamada5.mensaje).toContain('14:00 a 16:00');
  });

  it('no notifica horarios fuera del rango horario de indisponibilidad', async () => {
    const aula: Aula = {
      id: 10,
      codigo: 'AULA-201',
      nombre: 'Laboratorio de Informática 1',
      activo: true,
    } as Aula;

    jest.spyOn(service as any, 'obtenerEntidadPorId').mockResolvedValue(aula);
    (service as any).enTransaccionOcupacion = true;

    // Indisponibilidad solo por la mañana: Lunes 2 de nov de 08:00 a 12:00
    const dto = {
      tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
      fechaHoraInicio: '2026-11-02T08:00:00',
      fechaHoraFin: '2026-11-02T12:00:00',
      motivo: 'Pintura de pared norte',
    };

    // Clase en la tarde (14:00 a 16:00) del mismo lunes: NO se solapa
    dataSource.query.mockResolvedValue([
      {
        horarioId: 106,
        grupoId: 201,
        aulaId: 10,
        diaSemana: 1,
        horaInicio: '14:00:00',
        horaFin: '16:00:00',
        numeroGrupo: '01',
        cursoCodigo: 'EIF201',
        cursoNombre: 'Programación I',
        carreraId: 106,
        docenteUsuarioId: 45,
      },
    ]);

    await service.crearIndisponibilidadAula(10, dto as any, 1);

    expect(notificacionesService.crear).not.toHaveBeenCalled();
  });

  it('no emite notificaciones duplicadas para la misma sesión exacta', async () => {
    const aula: Aula = {
      id: 10,
      codigo: 'AULA-201',
      nombre: 'Laboratorio 1',
      activo: true,
    } as Aula;

    jest.spyOn(service as any, 'obtenerEntidadPorId').mockResolvedValue(aula);
    (service as any).enTransaccionOcupacion = true;

    const dto = {
      tipo: TipoIndisponibilidadAula.EVENTO,
      fechaHoraInicio: '2026-11-02T08:00:00',
      fechaHoraFin: '2026-11-02T12:00:00',
      motivo: 'Charla institucional',
    };

    // Dos registros idénticos en base de datos devueltos por un JOIN duplicado
    dataSource.query.mockResolvedValue([
      {
        horarioId: 101,
        grupoId: 201,
        aulaId: 10,
        diaSemana: 1,
        horaInicio: '08:00:00',
        horaFin: '10:00:00',
        numeroGrupo: '01',
        cursoCodigo: 'EIF201',
        cursoNombre: 'Programación I',
        carreraId: 106,
        docenteUsuarioId: 45,
      },
      {
        horarioId: 101,
        grupoId: 201,
        aulaId: 10,
        diaSemana: 1,
        horaInicio: '08:00:00',
        horaFin: '10:00:00',
        numeroGrupo: '01',
        cursoCodigo: 'EIF201',
        cursoNombre: 'Programación I',
        carreraId: 106,
        docenteUsuarioId: 45,
      },
    ]);

    await service.crearIndisponibilidadAula(10, dto as any, 1);

    // Deduplicación efectiva: solo 1 notificación
    expect(notificacionesService.crear).toHaveBeenCalledTimes(1);
  });
});
