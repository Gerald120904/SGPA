import { ConflictException } from '@nestjs/common';
import { TransicionesCurricularesController } from './transiciones-curriculares.controller';

describe('TransicionesCurricularesController', () => {
  it('impide la ejecución definitiva antes de llamar al servicio', () => {
    const service = { ejecutarTransicion: jest.fn() };
    const controller = new TransicionesCurricularesController(service as any);

    expect(() => controller.ejecutar({ user: { sub: 1 } } as any, {
      carreraId: 1,
      planOrigenId: 1,
      planDestinoId: 2,
      estudianteIds: [1],
      motivo: 'Prueba de bloqueo',
    })).toThrow(ConflictException);
    expect(service.ejecutarTransicion).not.toHaveBeenCalled();
  });
});
