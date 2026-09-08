import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { PlanValidacionesService } from './plan-validaciones.service';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';

describe('PlanValidacionesService', () => {
  let service: PlanValidacionesService;
  const planes = { findOne: jest.fn() },
    asignaturas = { find: jest.fn() },
    requisitos = { find: jest.fn() },
    salidas = { find: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanValidacionesService(
      planes as unknown as Repository<PlanEstudio>,
      asignaturas as unknown as Repository<PlanAsignatura>,
      requisitos as unknown as Repository<PlanRequisito>,
      salidas as unknown as Repository<SalidaAcademica>,
    );
  });

  it('rechaza un plan inexistente', async () => {
    planes.findOne.mockResolvedValue(null);
    await expect(service.validar(99)).rejects.toThrow(NotFoundException);
  });

  it('detecta advertencias y código curricular duplicado para asignaturas obligatorias', async () => {
    planes.findOne.mockResolvedValue({ id: 1 });
    asignaturas.find.mockResolvedValue([
      {
        id: 1,
        cursoId: null,
        curso: null,
        codigoReferencia: 'MAT030',
        nombreReferencia: 'Matemática',
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        nivel: 1,
        ciclo: 1,
        activo: true,
        horasTeoria: 3,
        horasPractica: 2,
        horasLaboratorio: 0,
        horasGira: null,
        horasEstudioIndependiente: 7,
        horasTotales: 11,
      },
      {
        id: 2,
        cursoId: null,
        curso: null,
        codigoReferencia: 'mat030',
        nombreReferencia: 'Matemática repetida',
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        nivel: 1,
        ciclo: 2,
        activo: true,
        horasTotales: null,
      },
    ]);
    requisitos.find.mockResolvedValue([]);
    salidas.find.mockResolvedValue([]);
    const r = await service.validar(1);
    expect(r.valido).toBe(false);
    expect(r.advertencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'HORAS_NO_COINCIDEN' }),
      ]),
    );
    expect(r.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'CODIGO_ASIGNATURA_DUPLICADO' }),
      ]),
    );
  });

  it('permite asignaturas de tipo OPTATIVA y GENERAL con el mismo código', async () => {
    planes.findOne.mockResolvedValue({ id: 1 });
    asignaturas.find.mockResolvedValue([
      {
        id: 10,
        cursoId: null,
        curso: null,
        codigoReferencia: 'OPT',
        nombreReferencia: 'Optativo I',
        tipo: TipoPlanAsignatura.OPTATIVA,
        nivel: 3,
        ciclo: 1,
        activo: true,
        horasTotales: null,
      },
      {
        id: 11,
        cursoId: null,
        curso: null,
        codigoReferencia: 'OPT',
        nombreReferencia: 'Optativo II',
        tipo: TipoPlanAsignatura.OPTATIVA,
        nivel: 3,
        ciclo: 2,
        activo: true,
        horasTotales: null,
      },
      {
        id: 12,
        cursoId: null,
        curso: null,
        codigoReferencia: 'EST GEN',
        nombreReferencia: 'Estudios Generales I',
        tipo: TipoPlanAsignatura.GENERAL,
        nivel: 1,
        ciclo: 1,
        activo: true,
        horasTotales: null,
      },
      {
        id: 13,
        cursoId: null,
        curso: null,
        codigoReferencia: 'EST GEN',
        nombreReferencia: 'Estudios Generales II',
        tipo: TipoPlanAsignatura.GENERAL,
        nivel: 1,
        ciclo: 2,
        activo: true,
        horasTotales: null,
      },
    ]);
    requisitos.find.mockResolvedValue([]);
    salidas.find.mockResolvedValue([]);

    const r = await service.validar(1);
    const codigosError = r.errores.map((item) => item.codigo);
    expect(codigosError).not.toContain('CODIGO_ASIGNATURA_DUPLICADO');
    expect(r.valido).toBe(true);
  });

  it('detecta una asignatura activa sin código curricular', async () => {
    planes.findOne.mockResolvedValue({ id: 1 });
    asignaturas.find.mockResolvedValue([
      {
        id: 3,
        cursoId: null,
        curso: null,
        codigoReferencia: null,
        nombreReferencia: 'Seminario',
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        nivel: 1,
        ciclo: 1,
        activo: true,
        horasTotales: null,
      },
    ]);
    requisitos.find.mockResolvedValue([]);
    salidas.find.mockResolvedValue([]);

    const r = await service.validar(1);

    expect(r.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'ASIGNATURA_SIN_CODIGO',
          asignaturaId: 3,
        }),
      ]),
    );
  });

  it('detecta una asignatura activa sin nombre curricular', async () => {
    planes.findOne.mockResolvedValue({ id: 1 });
    asignaturas.find.mockResolvedValue([
      {
        id: 4,
        cursoId: null,
        curso: null,
        codigoReferencia: 'SEM101',
        nombreReferencia: null,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        nivel: 1,
        ciclo: 1,
        activo: true,
        horasTotales: null,
      },
    ]);
    requisitos.find.mockResolvedValue([]);
    salidas.find.mockResolvedValue([]);

    const r = await service.validar(1);

    expect(r.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'ASIGNATURA_SIN_NOMBRE',
          asignaturaId: 4,
        }),
      ]),
    );
  });

  it('mantiene compatibilidad con código y nombre de un curso ya vinculado', async () => {
    planes.findOne.mockResolvedValue({ id: 1 });
    asignaturas.find.mockResolvedValue([
      {
        id: 5,
        cursoId: 20,
        curso: { codigo: 'LEG101', nombre: 'Asignatura legada' },
        codigoReferencia: null,
        nombreReferencia: null,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        nivel: 1,
        ciclo: 1,
        activo: true,
        horasTotales: null,
      },
    ]);
    requisitos.find.mockResolvedValue([]);
    salidas.find.mockResolvedValue([]);

    const r = await service.validar(1);

    const codigosError = r.errores.map((item) => item.codigo);
    expect(codigosError).not.toContain('ASIGNATURA_SIN_CODIGO');
    expect(codigosError).not.toContain('ASIGNATURA_SIN_NOMBRE');
    expect(r.valido).toBe(true);
  });
});
