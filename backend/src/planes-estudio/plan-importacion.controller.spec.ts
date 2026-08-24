import { ValidarImportacionPlanDto } from './dto/validar-importacion-plan.dto';
import { PlanImportacionController } from './plan-importacion.controller';
import { PlanImportacionService } from './plan-importacion.service';

describe('PlanImportacionController', () => {
  let controller: PlanImportacionController;
  let service: { validar: jest.Mock; importar: jest.Mock };

  const dto: ValidarImportacionPlanDto = {
    bloques: [
      {
        CODIGO: 'TC',
        NOMBRE: 'Tronco común',
        TIPO: 'TRONCO_COMUN',
        ORDEN: '1',
      },
    ],
    asignaturas: [],
    requisitos: [],
    salidas: [],
    salidaAsignaturas: [],
  };

  beforeEach(() => {
    service = { validar: jest.fn(), importar: jest.fn() };
    controller = new PlanImportacionController(
      service as unknown as PlanImportacionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('envía el archivo al servicio para validarlo', async () => {
    const respuesta = {
      valido: true,
      puedeImportar: true,
      totalErrores: 0,
      totalAdvertencias: 0,
      resumen: {
        bloques: 1,
        asignaturas: 0,
        requisitos: 0,
        salidas: 0,
        asignacionesSalidas: 0,
      },
      errores: [],
      advertencias: [],
    };
    service.validar.mockResolvedValue(respuesta);

    const resultado = await controller.validar(1, dto);

    expect(service.validar).toHaveBeenCalledTimes(1);
    expect(service.validar).toHaveBeenCalledWith(1, dto);
    expect(resultado).toEqual(respuesta);
  });

  it('envía el archivo al servicio para ejecutar la importación', async () => {
    const respuesta = {
      ok: true,
      message: 'El plan de estudio fue importado correctamente.',
      resumen: {
        bloques: 1,
        asignaturas: 0,
        requisitos: 0,
        salidas: 0,
        asignacionesSalidas: 0,
      },
      advertencias: [],
    };
    service.importar.mockResolvedValue(respuesta);

    const resultado = await controller.importar(1, dto);

    expect(service.importar).toHaveBeenCalledTimes(1);
    expect(service.importar).toHaveBeenCalledWith(1, dto);
    expect(resultado).toEqual(respuesta);
  });
});
