import { Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn((datos) => ({ id: 1, ...datos })),
      save: jest.fn(async (datos) => datos),
      update: jest.fn(),
    };
    service = new NotificacionesService(repo as unknown as Repository<Notificacion>);
  });

  it('crea una notificación correctamente', async () => {
    const res = await service.crear({
      usuarioId: 10,
      carreraId: 1,
      titulo: 'Nueva solicitud',
      mensaje: 'El asistente envió una solicitud',
      tipo: 'SOLICITUD_NUEVA',
    });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 10,
      carreraId: 1,
      titulo: 'Nueva solicitud',
      leido: false,
    }));
    expect(repo.save).toHaveBeenCalled();
  });

  it('recupera la misma notificación cuando la clave de sesión ya existe', async () => {
    const existente = { id: 7, claveIdempotencia: 'aula:3:4:5:2026-11-02' };
    repo.save.mockRejectedValue({ driverError: { code: 'ER_DUP_ENTRY' } });
    repo.findOne.mockResolvedValue(existente);
    await expect(service.crear({ usuarioId: 4, titulo: 'Aviso', mensaje: 'Clase afectada',
      tipo: 'INDISPONIBILIDAD_AULA', claveIdempotencia: existente.claveIdempotencia })).resolves.toBe(existente);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { claveIdempotencia: existente.claveIdempotencia } });
  });

  it('cuenta las notificaciones no leídas de un usuario', async () => {
    repo.count.mockResolvedValue(5);
    const conteo = await service.contarNoLeidas(10);
    expect(conteo).toBe(5);
    expect(repo.count).toHaveBeenCalledWith({
      where: { usuarioId: 10, leido: false },
    });
  });

  it('marca una notificación como leída', async () => {
    const notif = { id: 1, usuarioId: 10, leido: false, leidoAt: null };
    repo.findOne.mockResolvedValue(notif);
    const res = await service.marcarComoLeida(1, 10);
    expect(res.leido).toBe(true);
    expect(res.leidoAt).toBeInstanceOf(Date);
  });
});
