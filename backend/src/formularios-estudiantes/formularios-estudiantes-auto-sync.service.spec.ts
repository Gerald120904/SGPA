import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { FormulariosEstudiantesAutoSyncService } from './formularios-estudiantes-auto-sync.service';

describe('FormulariosEstudiantesAutoSyncService', () => {
  let service: FormulariosEstudiantesAutoSyncService;
  let formularioRepository: {
    find: jest.Mock;
  };
  let syncService: {
    sincronizarFormulario: jest.Mock;
  };

  beforeEach(() => {
    formularioRepository = {
      find: jest.fn(),
    };
    syncService = {
      sincronizarFormulario: jest.fn(),
    };

    service = new FormulariosEstudiantesAutoSyncService(
      formularioRepository as never,
      syncService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sincroniza todos los formularios PUBLICADOS', async () => {
    const form1 = { id: 1, estado: EstadoFormularioEstudiante.PUBLICADO };
    const form2 = { id: 2, estado: EstadoFormularioEstudiante.PUBLICADO };

    formularioRepository.find.mockResolvedValue([form1, form2]);
    syncService.sincronizarFormulario
      .mockResolvedValueOnce({ nuevas: 2 })
      .mockResolvedValueOnce({ nuevas: 0 });

    await service.sincronizarAutomaticamente();

    expect(formularioRepository.find).toHaveBeenCalledWith({
      where: {
        estado: EstadoFormularioEstudiante.PUBLICADO,
      },
    });
    expect(syncService.sincronizarFormulario).toHaveBeenNthCalledWith(1, form1);
    expect(syncService.sincronizarFormulario).toHaveBeenNthCalledWith(2, form2);
  });

  it('continúa con el siguiente formulario si uno falla con excepción', async () => {
    const form1 = { id: 1, estado: EstadoFormularioEstudiante.PUBLICADO };
    const form2 = { id: 2, estado: EstadoFormularioEstudiante.PUBLICADO };

    formularioRepository.find.mockResolvedValue([form1, form2]);
    syncService.sincronizarFormulario
      .mockRejectedValueOnce(new Error('Token expirado'))
      .mockResolvedValueOnce({ nuevas: 1 });

    await service.sincronizarAutomaticamente();

    expect(syncService.sincronizarFormulario).toHaveBeenCalledTimes(2);
  });

  it('evita ejecuciones concurrentes si una iteración sigue activa', async () => {
    formularioRepository.find.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
    );

    const promesa1 = service.sincronizarAutomaticamente();
    const promesa2 = service.sincronizarAutomaticamente();

    await Promise.all([promesa1, promesa2]);

    expect(formularioRepository.find).toHaveBeenCalledTimes(1);
  });
});
