import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
import { PlanResumenService } from './plan-resumen.service';

describe('PlanResumenService', () => {
  let service: PlanResumenService;
  const planRepository = { findOne: jest.fn() };
  const asignaturaRepository = { find: jest.fn() };
  const bloqueRepository = { find: jest.fn() };
  const requisitoRepository = { find: jest.fn() };
  const salidaRepository = { find: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanResumenService(
      planRepository as unknown as Repository<PlanEstudio>,
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
      bloqueRepository as unknown as Repository<BloquePlan>,
      requisitoRepository as unknown as Repository<PlanRequisito>,
      salidaRepository as unknown as Repository<SalidaAcademica>,
    );
  });

  it('rechaza un plan inexistente', async () => {
    planRepository.findOne.mockResolvedValue(null);
    await expect(service.obtener(999)).rejects.toThrow(NotFoundException);
  });

  it('calcula los totales del plan usando solo asignaturas activas', async () => {
    const activa1 = {
      id: 10,
      planEstudioId: 1,
      bloqueId: 1,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      horasTeoria: 2,
      horasPractica: 2,
      horasLaboratorio: 0,
      horasGira: null,
      horasEstudioIndependiente: 4,
      horasTotales: 8,
      horasDocente: 4,
      activo: true,
    } as PlanAsignatura;
    const activa2 = {
      id: 11,
      planEstudioId: 1,
      bloqueId: 1,
      nivel: 1,
      ciclo: 1,
      orden: 2,
      creditos: 4,
      horasTeoria: 3,
      horasPractica: 2,
      horasLaboratorio: 0,
      horasGira: null,
      horasEstudioIndependiente: 7,
      horasTotales: 12,
      horasDocente: 5,
      activo: true,
    } as PlanAsignatura;
    const inactiva = {
      id: 12,
      planEstudioId: 1,
      bloqueId: null,
      nivel: 1,
      ciclo: 2,
      orden: 1,
      creditos: 3,
      activo: false,
    } as PlanAsignatura;
    planRepository.findOne.mockResolvedValue({
      id: 1,
      codigo: 'PLAN-1',
      nombre: 'Plan 1',
      activo: true,
      carrera: { id: 1, codigo: 'INF', nombre: 'Informática' },
    });
    asignaturaRepository.find.mockResolvedValue([activa1, activa2, inactiva]);
    bloqueRepository.find.mockResolvedValue([
      {
        id: 1,
        codigo: 'TC',
        nombre: 'Tronco común',
        tipo: 'TRONCO_COMUN',
        orden: 1,
        activo: true,
      },
    ]);
    requisitoRepository.find.mockResolvedValue([
      { tipo: TipoRequisito.REQUISITO },
      { tipo: TipoRequisito.CORREQUISITO },
    ]);
    salidaRepository.find.mockResolvedValue([
      {
        id: 1,
        codigo: 'DIP',
        nombre: 'Diplomado',
        tipo: 'DIPLOMADO',
        activo: true,
        creditosRequeridos: 7,
        orden: 1,
        asignaturas: [activa1, activa2],
      },
    ]);

    const resultado = await service.obtener(1);

    expect(resultado.asignaturas).toEqual({
      total: 3,
      activas: 2,
      inactivas: 1,
      sinBloque: 0,
    });
    expect(resultado.creditos.total).toBe(7);
    expect(resultado.horas).toEqual({
      teoria: 5,
      practica: 4,
      laboratorio: 0,
      gira: 0,
      estudioIndependiente: 11,
      totales: 20,
      docente: 9,
    });
    expect(resultado.relaciones).toEqual({ requisitos: 1, correquisitos: 1 });
    expect(resultado.ciclos).toEqual([
      { nivel: 1, ciclo: 1, cantidadAsignaturas: 2, creditos: 7 },
    ]);
    expect(resultado.salidas[0]).toEqual(
      expect.objectContaining({ creditosAsociados: 7, cumpleCreditos: true }),
    );
  });
});
