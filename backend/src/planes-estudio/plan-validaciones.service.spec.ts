import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PlanValidacionesService } from './plan-validaciones.service';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
describe('PlanValidacionesService', () => {
  let service: PlanValidacionesService;
  const planes = { findOne: jest.fn() },
    asignaturas = { find: jest.fn() },
    bloques = { find: jest.fn() },
    requisitos = { find: jest.fn() },
    salidas = { find: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanValidacionesService(
      planes as unknown as Repository<PlanEstudio>,
      asignaturas as unknown as Repository<PlanAsignatura>,
      bloques as unknown as Repository<BloquePlan>,
      requisitos as unknown as Repository<PlanRequisito>,
      salidas as unknown as Repository<SalidaAcademica>,
    );
  });
  it('rechaza un plan inexistente', async () => {
    planes.findOne.mockResolvedValue(null);
    await expect(service.validar(99)).rejects.toThrow(NotFoundException);
  });
  it('detecta advertencias y curso duplicado', async () => {
    planes.findOne.mockResolvedValue({ id: 1 });
    asignaturas.find.mockResolvedValue([
      {
        id: 1,
        cursoId: 10,
        curso: { codigo: 'MAT030' },
        bloqueId: null,
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
        cursoId: 10,
        curso: { codigo: 'MAT030' },
        bloqueId: 1,
        nivel: 1,
        ciclo: 2,
        activo: true,
        horasTotales: null,
      },
    ]);
    bloques.find.mockResolvedValue([{ id: 1, nombre: 'TC', activo: true }]);
    requisitos.find.mockResolvedValue([]);
    salidas.find.mockResolvedValue([]);
    const r = await service.validar(1);
    expect(r.valido).toBe(false);
    expect(r.advertencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'ASIGNATURA_SIN_BLOQUE' }),
        expect.objectContaining({ codigo: 'HORAS_NO_COINCIDEN' }),
      ]),
    );
    expect(r.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'CURSO_DUPLICADO' }),
      ]),
    );
  });
});
