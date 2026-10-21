import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AlcanceJerarquicoService } from '../../permisos/alcance-jerarquico.service';
import { PlanEstudio } from '../entities/plan-estudio.entity';
import { PlanesAlcanceGuard } from './planes-alcance.guard';

describe('PlanesAlcanceGuard', () => {
  const planes = { findOne: jest.fn() };
  const alcance = { tipoCuentaJerarquica: jest.fn(), puedeEjecutar: jest.fn() };
  let guard: PlanesAlcanceGuard;

  const contexto = (request: Record<string, unknown>) => ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PlanesAlcanceGuard(
      planes as unknown as Repository<PlanEstudio>,
      alcance as unknown as AlcanceJerarquicoService,
    );
    alcance.tipoCuentaJerarquica.mockResolvedValue('COORDINADOR');
    planes.findOne.mockResolvedValue({ id: 8, carreraId: 20 });
  });

  it('autoriza una lectura usando la carrera real del plan padre', async () => {
    alcance.puedeEjecutar.mockResolvedValueOnce(true);
    await expect(guard.canActivate(contexto({ method: 'GET', params: { planId: '8' }, user: { sub: 4, jerarquiaConfigurada: true } })))
      .resolves.toBe(true);
    expect(alcance.puedeEjecutar).toHaveBeenCalledWith(4, 'PLANES_ESTUDIO_VER', 20);
  });

  it('rechaza un ID directo cuyo plan pertenece a otra carrera', async () => {
    alcance.puedeEjecutar.mockResolvedValue(false);
    await expect(guard.canActivate(contexto({ method: 'GET', params: { id: '8' }, user: { sub: 4, jerarquiaConfigurada: true } })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza toda escritura directa de un asistente', async () => {
    alcance.tipoCuentaJerarquica.mockResolvedValue('ASISTENTE_ESTUDIANTIL');
    await expect(guard.canActivate(contexto({ method: 'PATCH', params: { planId: '8' }, user: { sub: 7, jerarquiaConfigurada: true } })))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(planes.findOne).not.toHaveBeenCalled();
  });

  it('ignora el carreraId enviado y decide con la carrera persistida', async () => {
    alcance.puedeEjecutar.mockImplementation(async (_u: number, _p: string, carreraId: number) => carreraId === 99);
    await expect(guard.canActivate(contexto({ method: 'PATCH', params: { planId: '8' },
      body: { carreraId: 99 }, user: { sub: 4, jerarquiaConfigurada: true } }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(alcance.puedeEjecutar).toHaveBeenCalledWith(4, 'PLANES_ESTUDIO_GESTIONAR', 20);
  });
});
