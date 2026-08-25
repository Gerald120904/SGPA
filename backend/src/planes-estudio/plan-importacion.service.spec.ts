import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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
  const asignatura = (clave: string, orden = '1', cambios = {}) => ({
    CLAVE: clave,
    CODIGO: clave,
    NOMBRE: `Asignatura ${clave}`,
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
    asignaturas: [asignatura('OPT-01')],
    requisitos: [],
    salidas: [],
    salidaAsignaturas: [],
    ...cambios,
  });

  beforeEach(() => {
    planRepository = { findOne: jest.fn().mockResolvedValue(plan) };
    bloqueRepository = { count: jest.fn().mockResolvedValue(0) };
    asignaturaRepository = { count: jest.fn().mockResolvedValue(0) };
    salidaRepository = { count: jest.fn().mockResolvedValue(0) };
    dataSource = { transaction: jest.fn() };
    service = new PlanImportacionService(
      planRepository as unknown as Repository<PlanEstudio>,
      bloqueRepository as unknown as Repository<BloquePlan>,
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
      salidaRepository as unknown as Repository<SalidaAcademica>,
      dataSource as unknown as DataSource,
    );
  });

  it('valida una asignatura curricular sin requerir un curso existente', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          {
            ...asignatura('A01'),
            CODIGO: 'EIF200',
            NOMBRE: 'Programación I',
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

  it('detecta una asignatura sin código indicando la fila', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          {
            ...asignatura('A01'),
            __fila: 4,
            CODIGO: '',
          },
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'ASIGNATURA_SIN_CODIGO',
          hoja: 'ASIGNATURAS',
          fila: 4,
        }),
      ]),
    );
  });

  it('detecta una asignatura sin nombre', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          {
            ...asignatura('A01'),
            NOMBRE: '',
          },
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'ASIGNATURA_SIN_NOMBRE' }),
      ]),
    );
  });

  it('detecta códigos curriculares duplicados aunque las claves sean distintas', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          asignatura('A01', '1', { CODIGO: 'EIF200' }),
          asignatura('A02', '2', { CODIGO: 'eif200' }),
        ],
      }),
    );
    expect(resultado.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'CODIGO_ASIGNATURA_DUPLICADO' }),
      ]),
    );
  });

  it('detecta bloques inexistentes y claves duplicadas', async () => {
    const resultado = await service.validar(
      1,
      dto({
        asignaturas: [
          asignatura('OPT-01', '1', { BLOQUE: 'NO-EXISTE', __fila: 7 }),
          asignatura('OPT-01', '2'),
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
          asignatura('A', '1'),
          asignatura('B', '2'),
          asignatura('C', '3'),
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

  it('importa la información curricular sin crear ni vincular cursos', async () => {
    jest.spyOn(service, 'validar').mockResolvedValue({
      valido: true,
      puedeImportar: true,
      totalErrores: 0,
      totalAdvertencias: 0,
      resumen: {
        bloques: 1,
        asignaturas: 2,
        requisitos: 1,
        salidas: 0,
        asignacionesSalidas: 0,
      },
      errores: [],
      advertencias: [],
    });

    const planRepo = {
      findOne: jest.fn().mockResolvedValue(plan),
    };
    const bloqueRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) =>
        datos.map((item: object, indice: number) => ({
          id: indice + 10,
          ...item,
        })),
      ),
    };
    const asignaturaRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) =>
        datos.map((item: object, indice: number) => ({
          id: indice + 20,
          ...item,
        })),
      ),
    };
    const requisitoRepo = {
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => datos),
    };
    const salidaRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => datos),
    };
    const manager = {
      getRepository: jest
        .fn()
        .mockReturnValueOnce(planRepo)
        .mockReturnValueOnce(bloqueRepo)
        .mockReturnValueOnce(asignaturaRepo)
        .mockReturnValueOnce(requisitoRepo)
        .mockReturnValueOnce(salidaRepo),
    };
    dataSource.transaction.mockImplementation(
      async (callback: (manager: object) => Promise<unknown>) =>
        callback(manager),
    );

    const resultado = await service.importar(
      1,
      dto({
        asignaturas: [
          asignatura('A1', '1', {
            CODIGO: ' eif101 ',
            NOMBRE: ' Fundamentos ',
            CREDITOS: '4',
            TIPO: TipoPlanAsignatura.OBLIGATORIA,
          }),
          asignatura('A2', '2', {
            CODIGO: ' eif102 ',
            NOMBRE: ' Programación I ',
            CREDITOS: '4',
            TIPO: TipoPlanAsignatura.OBLIGATORIA,
          }),
        ],
        requisitos: [
          {
            ASIGNATURA_CLAVE: 'A2',
            RELACIONADA_CLAVE: 'A1',
            TIPO: 'REQUISITO',
          },
        ],
      }),
    );

    expect(asignaturaRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          planEstudioId: 1,
          cursoId: null,
          codigoReferencia: 'EIF101',
          nombreReferencia: 'Fundamentos',
          nivel: 1,
          ciclo: 1,
          orden: 1,
          creditos: 4,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
          activo: true,
        }),
        expect.objectContaining({
          cursoId: null,
          codigoReferencia: 'EIF102',
          nombreReferencia: 'Programación I',
        }),
      ]),
    );
    expect(requisitoRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        asignaturaId: 21,
        requisitoAsignaturaId: 20,
        tipo: 'REQUISITO',
      }),
    ]);
    expect(resultado).toMatchObject({
      ok: true,
      resumen: { bloques: 1, asignaturas: 2, requisitos: 1 },
    });
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
