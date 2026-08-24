import { TipoBloquePlan } from './constants/tipo-bloque-plan.constant';
import { BloquesPlanController } from './bloques-plan.controller';
import { BloquesPlanService } from './bloques-plan.service';

describe('BloquesPlanController', () => {
  let controller: BloquesPlanController;
  let service: {
    listar: jest.Mock;
    obtenerPorId: jest.Mock;
    crear: jest.Mock;
    actualizar: jest.Mock;
    cambiarEstado: jest.Mock;
  };

  beforeEach(() => {
    service = {
      listar: jest.fn(),
      obtenerPorId: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      cambiarEstado: jest.fn(),
    };
    controller = new BloquesPlanController(
      service as unknown as BloquesPlanService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lista los bloques de un plan', async () => {
    const respuesta = [{ id: 1, codigo: 'TC', nombre: 'Tronco común' }];
    service.listar.mockResolvedValue(respuesta);
    await expect(controller.listar(10)).resolves.toEqual(respuesta);
    expect(service.listar).toHaveBeenCalledWith(10);
  });

  it('obtiene un bloque por id dentro del plan', async () => {
    const respuesta = {
      id: 5,
      planEstudioId: 10,
      codigo: 'TC',
      nombre: 'Tronco común',
    };
    service.obtenerPorId.mockResolvedValue(respuesta);
    await expect(controller.obtenerPorId(10, 5)).resolves.toEqual(respuesta);
    expect(service.obtenerPorId).toHaveBeenCalledWith(10, 5);
  });

  it('crea un bloque dentro del plan', async () => {
    const dto = {
      codigo: 'TC',
      nombre: 'Tronco común',
      tipo: TipoBloquePlan.TRONCO_COMUN,
      orden: 1,
      descripcion: 'Bloque principal',
    };
    const respuesta = { id: 5, planEstudioId: 10, ...dto, activo: true };
    service.crear.mockResolvedValue(respuesta);
    await expect(controller.crear(10, dto)).resolves.toEqual(respuesta);
    expect(service.crear).toHaveBeenCalledWith(10, dto);
  });

  it('actualiza un bloque del plan', async () => {
    const dto = {
      nombre: 'Énfasis',
      tipo: TipoBloquePlan.ENFASIS,
      orden: 2,
      descripcion: 'Bloque actualizado',
    };
    const respuesta = {
      id: 5,
      planEstudioId: 10,
      codigo: 'ENF',
      ...dto,
      activo: true,
    };
    service.actualizar.mockResolvedValue(respuesta);
    await expect(controller.actualizar(10, 5, dto)).resolves.toEqual(respuesta);
    expect(service.actualizar).toHaveBeenCalledWith(10, 5, dto);
  });

  it('cambia el estado de un bloque', async () => {
    const respuesta = {
      id: 5,
      planEstudioId: 10,
      codigo: 'TC',
      nombre: 'Tronco común',
      activo: false,
    };
    service.cambiarEstado.mockResolvedValue(respuesta);
    await expect(
      controller.cambiarEstado(10, 5, { activo: false }),
    ).resolves.toEqual(respuesta);
    expect(service.cambiarEstado).toHaveBeenCalledWith(10, 5, false);
  });
});
