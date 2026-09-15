import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { ImportarEstudiantesDto } from './dto/importar-estudiantes.dto';
import { RegistrarResultadoAcademicoDto } from './dto/registrar-resultado-academico.dto';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';

describe('EstudiantesImportacionService', () => {
  const carrera = { id: 1, activo: true } as Carrera;
  const plan = { id: 2, carreraId: 1, activo: true } as PlanEstudio;
  const periodo = { id: 3, codigo: '2026-I' } as PeriodoAcademico;
  const asignatura = {
    id: 4,
    planEstudioId: 2,
    cursoId: 10,
    activo: true,
    curso: { id: 10, codigo: 'EIF101' },
  } as PlanAsignatura;
  let estudianteRepository: jest.Mocked<Repository<Estudiante>>;
  let historialRepository: jest.Mocked<
    Repository<HistorialAcademicoEstudiante>
  >;
  let carreraRepository: jest.Mocked<Repository<Carrera>>;
  let planRepository: jest.Mocked<Repository<PlanEstudio>>;
  let asignaturaRepository: jest.Mocked<Repository<PlanAsignatura>>;
  let periodoRepository: jest.Mocked<Repository<PeriodoAcademico>>;
  let alcance: jest.Mocked<EstructuraAcademicaService>;
  let dataSource: jest.Mocked<DataSource>;
  let service: EstudiantesImportacionService;

  const dto = (cambios: Partial<ImportarEstudiantesDto> = {}) => ({
    carreraId: 1,
    planEstudioId: 2,
    estudiantes: [
      {
        fila: 2,
        cedula: '001234567',
        nombres: ' Ana ',
        apellido1: ' Solís ',
        apellido2: null,
        correoInstitucional: 'ANA@UNA.AC.CR',
        telefono: '08880000',
        periodoIngresoCodigo: '2026-i',
        asignaturasAprobadas: ['eif101'],
      },
    ],
    ...cambios,
  });

  beforeEach(() => {
    estudianteRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<Estudiante>>;
    historialRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<HistorialAcademicoEstudiante>>;
    carreraRepository = {
      findOne: jest.fn().mockResolvedValue(carrera),
    } as unknown as jest.Mocked<Repository<Carrera>>;
    planRepository = {
      findOne: jest.fn().mockResolvedValue(plan),
    } as unknown as jest.Mocked<Repository<PlanEstudio>>;
    asignaturaRepository = {
      find: jest.fn().mockResolvedValue([asignatura]),
    } as unknown as jest.Mocked<Repository<PlanAsignatura>>;
    periodoRepository = {
      find: jest.fn().mockResolvedValue([periodo]),
    } as unknown as jest.Mocked<Repository<PeriodoAcademico>>;
    alcance = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<EstructuraAcademicaService>;
    dataSource = {
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;
    service = new EstudiantesImportacionService(
      estudianteRepository,
      historialRepository,
      carreraRepository,
      planRepository,
      asignaturaRepository,
      periodoRepository,
      alcance,
      dataSource,
    );
  });

  it('previsualiza un archivo válido sin escribir', async () => {
    const resultado = await service.validar(9, dto());
    expect(resultado.resumen).toEqual({
      total: 1,
      crear: 1,
      actualizar: 0,
      sinCambios: 0,
      errores: 0,
      aprobacionesNuevas: 1,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('detecta cédulas repetidas dentro del archivo', async () => {
    const entrada = dto();
    entrada.estudiantes.push({ ...entrada.estudiantes[0], fila: 3 });
    const resultado = await service.validar(9, entrada);
    expect(resultado.resumen.errores).toBe(2);
  });

  it('detecta correos repetidos dentro del archivo', async () => {
    const entrada = dto();
    entrada.estudiantes.push({
      ...entrada.estudiantes[0],
      fila: 3,
      cedula: '999',
    });
    const resultado = await service.validar(9, entrada);
    expect(resultado.filas.every((fila) => fila.accion === 'ERROR')).toBe(true);
  });

  it('rechaza correo existente para otra cédula', async () => {
    estudianteRepository.find.mockResolvedValue([
      {
        id: 8,
        cedula: 'OTRA',
        correoInstitucional: 'ana@una.ac.cr',
      } as Estudiante,
    ]);
    const resultado = await service.validar(9, dto());
    expect(resultado.filas[0].errores[0]).toContain('otra cédula');
  });

  it('reporta una asignatura inexistente', async () => {
    const entrada = dto();
    entrada.estudiantes[0].asignaturasAprobadas = ['NO-EXISTE'];
    const resultado = await service.validar(9, entrada);
    expect(resultado.filas[0].errores[0]).toContain('no pertenece');
  });

  it('reporta una asignatura ambigua', async () => {
    asignaturaRepository.find.mockResolvedValue([
      asignatura,
      { ...asignatura, id: 5 },
    ]);
    const resultado = await service.validar(9, dto());
    expect(resultado.filas[0].errores[0]).toContain('ambigua');
  });

  it('reporta un período de ingreso inválido', async () => {
    periodoRepository.find.mockResolvedValue([]);
    const resultado = await service.validar(9, dto());
    expect(resultado.filas[0].errores[0]).toContain('período');
  });

  it('rechaza un estudiante existente en otra carrera o plan', async () => {
    estudianteRepository.find.mockResolvedValue([
      {
        id: 8,
        cedula: '001234567',
        correoInstitucional: 'ana@una.ac.cr',
        carreraId: 99,
        planEstudioId: 88,
        periodoIngresoId: 3,
      } as Estudiante,
    ]);
    const resultado = await service.validar(9, dto());
    expect(resultado.filas[0].errores[0]).toContain('otra carrera o plan');
  });

  it('clasifica como ACTUALIZAR si añade aprobaciones a un estudiante compatible', async () => {
    estudianteRepository.find.mockResolvedValue([
      {
        id: 8,
        cedula: '001234567',
        nombres: 'Ana',
        apellido1: 'Solís',
        apellido2: null,
        correoInstitucional: 'ana@una.ac.cr',
        telefono: '08880000',
        carreraId: 1,
        planEstudioId: 2,
        periodoIngresoId: 3,
      } as Estudiante,
    ]);
    const resultado = await service.validar(9, dto());
    expect(resultado.filas[0].accion).toBe('ACTUALIZAR');
    expect(resultado.filas[0].cambiosDatos).toEqual([]);
  });

  it('detecta y reporta cambios de datos personales cuando el estudiante ya existe', async () => {
    estudianteRepository.find.mockResolvedValue([
      {
        id: 8,
        cedula: '001234567',
        nombres: 'Ana María',
        apellido1: 'Solís',
        apellido2: 'Pérez',
        correoInstitucional: 'ana.antiguo@una.ac.cr',
        telefono: '88881111',
        carreraId: 1,
        planEstudioId: 2,
        periodoIngresoId: 3,
      } as Estudiante,
    ]);
    const entrada = dto();
    entrada.estudiantes[0].asignaturasAprobadas = []; // Sin nuevas asignaturas
    const resultado = await service.validar(9, entrada);
    expect(resultado.filas[0].accion).toBe('ACTUALIZAR');
    expect(resultado.filas[0].cambiosDatos).toEqual([
      { campo: 'nombres', actual: 'Ana María', nuevo: 'Ana' },
      { campo: 'apellido2', actual: 'Pérez', nuevo: null },
      {
        campo: 'correoInstitucional',
        actual: 'ana.antiguo@una.ac.cr',
        nuevo: 'ana@una.ac.cr',
      },
      { campo: 'telefono', actual: '88881111', nuevo: '08880000' },
    ]);
  });

  it('detalla los cambios de datos personales en la previsualización', async () => {
    estudianteRepository.find.mockResolvedValue([
      {
        id: 8,
        cedula: '001234567',
        nombres: 'Ana',
        apellido1: 'Solís',
        apellido2: null,
        correoInstitucional: 'ana@una.ac.cr',
        telefono: '88881111',
        carreraId: 1,
        planEstudioId: 2,
        periodoIngresoId: 3,
      } as Estudiante,
    ]);
    const entrada = dto();
    entrada.estudiantes[0].telefono = '88882222';
    const resultado = await service.validar(9, entrada);
    expect(resultado.filas[0]).toMatchObject({
      accion: 'ACTUALIZAR',
      cambiosDatos: [
        { campo: 'telefono', actual: '88881111', nuevo: '88882222' },
      ],
    });
  });

  it('es idempotente cuando la aprobación ya existe por curso', async () => {
    estudianteRepository.find.mockResolvedValue([
      {
        id: 8,
        cedula: '001234567',
        nombres: 'Ana',
        apellido1: 'Solís',
        apellido2: null,
        correoInstitucional: 'ana@una.ac.cr',
        telefono: '08880000',
        carreraId: 1,
        planEstudioId: 2,
        periodoIngresoId: 3,
      } as Estudiante,
    ]);
    historialRepository.find.mockResolvedValue([
      {
        estudianteId: 8,
        planAsignaturaId: 99,
        resultado: ResultadoAcademico.APROBADO,
        planAsignatura: { id: 99, cursoId: 10 },
      } as HistorialAcademicoEstudiante,
    ]);
    const resultado = await service.validar(9, dto());
    expect(resultado.filas[0].accion).toBe('SIN_CAMBIOS');
    expect(resultado.resumen.aprobacionesNuevas).toBe(0);
  });

  it('ejecuta aprobaciones Excel con período nulo', async () => {
    const save = jest.fn(async (valor) => ({ ...valor, id: 20 }));
    const create = jest.fn((valor) => valor);
    const update = jest.fn();
    dataSource.transaction.mockImplementation(async (callback) =>
      callback({
        getRepository: (entity: unknown) =>
          entity === Estudiante ? { save, create, update } : { save, create },
      } as never),
    );
    const resultado = await service.ejecutar(9, dto());
    expect(resultado).toMatchObject({
      creados: 1,
      aprobacionesNuevas: 1,
      errores: 0,
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        periodoId: null,
        resultado: ResultadoAcademico.APROBADO,
        fuenteRegistro: FuenteRegistroAcademico.EXCEL,
      }),
    );
  });

  it('rechaza usuarios sin alcance académico', async () => {
    alcance.tieneAlcanceSobreCarrera.mockResolvedValue(false);
    await expect(service.validar(9, dto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza un plan que pertenece a otra carrera', async () => {
    planRepository.findOne.mockResolvedValue({ ...plan, carreraId: 99 });
    await expect(service.validar(9, dto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mantiene obligatorio el período en el DTO manual', async () => {
    const manual = Object.assign(new RegistrarResultadoAcademicoDto(), {
      planAsignaturaId: 4,
      resultado: ResultadoAcademico.APROBADO,
      origenAcademico: 'CURSADO',
    });
    const errores = await validate(manual);
    expect(errores.some((error) => error.property === 'periodoId')).toBe(true);
  });

  it('la segunda ejecución del mismo contenido no vuelve a escribir', async () => {
    const existente = {
      id: 8,
      cedula: '001234567',
      nombres: 'Ana',
      apellido1: 'Solís',
      apellido2: null,
      correoInstitucional: 'ana@una.ac.cr',
      telefono: '08880000',
      carreraId: 1,
      planEstudioId: 2,
      periodoIngresoId: 3,
    } as Estudiante;
    estudianteRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([existente]);
    historialRepository.find.mockResolvedValueOnce([
      {
        estudianteId: 8,
        planAsignaturaId: 4,
        resultado: ResultadoAcademico.APROBADO,
        planAsignatura: asignatura,
      } as HistorialAcademicoEstudiante,
    ]);
    const save = jest.fn(async (valor) => ({ ...valor, id: 8 }));
    dataSource.transaction.mockImplementation(async (callback) =>
      callback({
        getRepository: () => ({
          save,
          create: (valor: unknown) => valor,
          update: jest.fn(),
        }),
      } as never),
    );
    await service.ejecutar(9, dto());
    const segundo = await service.ejecutar(9, dto());
    expect(segundo).toMatchObject({
      creados: 0,
      actualizados: 0,
      aprobacionesNuevas: 0,
      sinCambios: 1,
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
