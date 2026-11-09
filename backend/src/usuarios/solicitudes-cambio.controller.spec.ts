import { BadRequestException } from '@nestjs/common';
import { SolicitudesCambioController } from './solicitudes-cambio.controller';
import { SolicitudesCambioService } from './solicitudes-cambio.service';
import { EstadoPlanEstudio } from '../planes-estudio/constants/estado-plan-estudio.constant';

describe('Propuesta de estado de plan', () => {
  const service = { proponerCambiarEstadoPlan: jest.fn() };
  const controller = new SolicitudesCambioController(service as unknown as SolicitudesCambioService);
  const request = { user: { sub: 12 } } as any;

  beforeEach(() => jest.clearAllMocks());

  it('interpreta EN_TRANSICION aunque activo permanezca verdadero para continuidad', () => {
    controller.proponerEstadoPlan(request, 7, {
      estado: EstadoPlanEstudio.EN_TRANSICION, activo: true, motivo: 'Cierre de admisiones',
    });
    expect(service.proponerCambiarEstadoPlan).toHaveBeenCalledWith(12, 7, false, 'Cierre de admisiones');
  });

  it('rechaza el archivo definitivo si la propuesta solo puede expresar cierre ordinario', () => {
    expect(() => controller.proponerEstadoPlan(request, 7, {
      estado: EstadoPlanEstudio.CERRADO, activo: false, motivo: 'Archivo definitivo',
    })).toThrow(BadRequestException);
    expect(service.proponerCambiarEstadoPlan).not.toHaveBeenCalled();
  });
});
