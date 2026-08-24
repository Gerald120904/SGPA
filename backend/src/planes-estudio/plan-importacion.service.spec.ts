import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Curso } from '../cursos/entities/curso.entity';
import { TipoBloquePlan } from './constants/tipo-bloque-plan.constant';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
import { PlanImportacionService } from './plan-importacion.service';

describe('PlanImportacionService', () => {
  let service: PlanImportacionService;
  let planRepository: { findOne: jest.Mock };
  let cursoRepository: { find: jest.Mock };
  let bloqueRepository: { count: jest.Mock };
  let asignaturaRepository: { count: jest.Mock };
  let salidaRepository: { count: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const plan = {
    id: 1,
    carreraId: 10,
    codigo: 'PLAN-INF',
    nombre: 'Plan Informática',
    activo: true,
  } as PlanEstudio;

  const bloque = {
    CODIGO: 'TC',
    NOMBRE: 'Tronco común',
    TIPO: TipoBloquePlan.TRONCO_COMUN,
    ORDEN: '1',
  };
  const especial = (clave: string, orden = '1', cambios = {}) => ({
    CLAVE: clave,
    CODIGO_CURSO: '',
    NOMBRE_REFERENCIA: clave,
    BLOQUE: 'TC',
    NIVEL: '1',
    CICLO: '1',
    ORDEN: orden,
    CREDITOS: '3',
    TIPO: TipoPlanAsignatura.OPTATIVA,
    ...cambios,
  });
  const dto = (cambios = {}) => ({
    bloques: [bloque],
    asignaturas: [especial('OPT-01')],
    requisitos: [],
    salidas: [],
    salidaAsignaturas: [],
    ...cambios,
  });

  beforeEach(() => {
    planRepository = { findOne: jest.fn().mockResolvedValue(plan) };
    cursoRepository = { find: jest.fn().mockResolvedValue([]) };
    bloqueRepository = { count: jest.fn().mockResolvedValue(0) };
    asignaturaRepository = { count: jest.fn().mockResolvedValue(0) };
    salidaRepository = { count: jest.fn().mockResolvedValue(0) };
    dataSource = { transaction: jest.fn() };
    service = new PlanImportacionService(
      planRepository as unknown as Repository<PlanEstudio>,
      cursoRepository as unknown as Repository<Curso>,
      bloqueRepository as unknown as Repository<BloquePlan>,
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
      salidaRepository as unknown as Repository<SalidaAcademica>,
      dataSource as unknown as DataSource,
    );
  });

  it('valida correctamente un archivo válido', async () => {
    cursoRepository.find.mockResolvedValue([
      { id: 100, codigo: 'EIF200', activo: true, carreras: [{ id: 10 }] },
    ]);
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          {
            ...especial('EIF200'),
            CODIGO_CURSO: 'EIF200',
            NOMBRE_REFERENCIA: '',
            TIPO: TipoPlanAsignatura.OBLIGATORIA,
            T: '3',
            P: '2',
            L: '0',
            EI: '7',
            HT: '12',
            HD: '5',
          },
        ],
      }),
    );
    expect(resultado).toMatchObject({
      valido: true,
      puedeImportar: true,
      totalErrores: 0,
      resumen: {
        bloques: 1,
        asignaturas: 1,
        requisitos: 0,
        salidas: 0,
        asignacionesSalidas: 0,
      },
    });
  });

  it('detecta un curso inexistente indicando la fila', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          {
            ...especial('NOEXISTE'),
            __fila: 4,
            CODIGO_CURSO: 'NOEXISTE',
            NOMBRE_REFERENCIA: '',
            TIPO: TipoPlanAsignatura.OBLIGATORIA,
          },
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'CURSO_NO_EXISTE',
          hoja: 'ASIGNATURAS',
          fila: 4,
        }),
      ]),
    );
  });

  it('detecta un curso asociado a otra carrera', async () => {
    cursoRepository.find.mockResolvedValue([
      { id: 100, codigo: 'EIF200', activo: true, carreras: [{ id: 999 }] },
    ]);
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          {
            ...especial('EIF200'),
            CODIGO_CURSO: 'EIF200',
            NOMBRE_REFERENCIA: '',
            TIPO: TipoPlanAsignatura.OBLIGATORIA,
          },
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'CURSO_NO_PERTENECE_CARRERA' }),
      ]),
    );
  });

  it('detecta bloques inexistentes y claves duplicadas', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          especial('OPT-01', '1', { BLOQUE: 'NO-EXISTE', __fila: 7 }),
          especial('OPT-01', '2'),
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'BLOQUE_NO_EXISTE', fila: 7 }),
        expect.objectContaining({ codigo: 'CLAVE_ASIGNATURA_DUPLICADA' }),
      ]),
    );
  });

  it('detecta ciclos de requisitos dentro del Excel', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          especial('A', '1'),
          especial('B', '2'),
          especial('C', '3'),
        ],
        requisitos: [
          { ASIGNATURA_CLAVE: 'A', RELACIONADA_CLAVE: 'B', TIPO: 'REQUISITO' },
          { ASIGNATURA_CLAVE: 'B', RELACIONADA_CLAVE: 'C', TIPO: 'REQUISITO' },
          { ASIGNATURA_CLAVE: 'C', RELACIONADA_CLAVE: 'A', TIPO: 'REQUISITO' },
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'CICLO_REQUISITOS' }),
      ]),
    );
  });

  it('rechaza importación completa sobre un plan que ya contiene información', async () => {
    bloqueRepository.count.mockResolvedValue(1);
    const resultado = await service.validar(1, dto());
    expect(resultado.puedeImportar).toBe(false);
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'PLAN_NO_VACIO' }),
      ]),
    );
  });

  it('no inicia la transacción si la validación tiene errores', async () => {
    jest
      .spyOn(service, 'validar')
      .mockResolvedValue({
        valido: false,
        puedeImportar: false,
        totalErrores: 1,
        totalAdvertencias: 0,
        resumen: {
          bloques: 0,
          asignaturas: 0,
          requisitos: 0,
          salidas: 0,
          asignacionesSalidas: 0,
        },
        errores: [
          {
            nivel: 'ERROR',
            codigo: 'PRUEBA',
            hoja: 'PLAN',
            mensaje: 'Error de prueba.',
          },
        ],
        advertencias: [],
      });
    await expect(service.importar(1, dto())).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('maneja un fallo inesperado dentro de la transacción', async () => {
    jest
      .spyOn(service, 'validar')
      .mockResolvedValue({
        valido: true,
        puedeImportar: true,
        totalErrores: 0,
        totalAdvertencias: 0,
        resumen: {
          bloques: 0,
          asignaturas: 0,
          requisitos: 0,
          salidas: 0,
          asignacionesSalidas: 0,
        },
        errores: [],
        advertencias: [],
      });
    dataSource.transaction.mockRejectedValue(
      new Error('Fallo de base de datos'),
    );
    await expect(service.importar(1, dto())).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
