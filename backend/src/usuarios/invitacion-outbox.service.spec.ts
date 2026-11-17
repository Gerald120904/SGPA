import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InvitacionOutboxService } from './invitacion-outbox.service';
import { InvitacionOutbox } from './entities/invitacion-outbox.entity';
import { MailService } from '../mail/mail.service';

describe('InvitacionOutboxService', () => {
  let service: InvitacionOutboxService;
  let dataSource: {
    query: jest.Mock;
    options: { type: string; database?: string; synchronize?: boolean };
    isInitialized: boolean;
  };
  let repositorio: Partial<Repository<InvitacionOutbox>>;
  let mailService: Partial<MailService>;
  const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SGPA_INVITATION_ENCRYPTION_KEY = validKey;
    process.env.DB_SYNCHRONIZE = 'false';
    process.env.DB_DATABASE = 'sgpa';

    dataSource = {
      options: { type: 'mysql', database: 'sgpa', synchronize: false },
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ db: 'sgpa' }]),
    };
    repositorio = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mailService = {
      enviarInvitacion: jest.fn().mockResolvedValue(undefined),
    };

    service = new InvitacionOutboxService(
      repositorio as Repository<InvitacionOutbox>,
      dataSource as unknown as DataSource,
      mailService as MailService,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('verificarDestino', () => {
    it('permite operar en sgpa con sincronizaciÃ³n desactivada', async () => {
      dataSource.options.database = 'sgpa';
      dataSource.query.mockResolvedValue([{ db: 'sgpa' }]);
      await expect(service.verificarDestino()).resolves.toBeUndefined();
    });

    it('permite operar en sgpa_test con sincronizaciÃ³n desactivada', async () => {
      dataSource.options.database = 'sgpa_test';
      dataSource.query.mockResolvedValue([{ db: 'sgpa_test' }]);
      await expect(service.verificarDestino()).resolves.toBeUndefined();
    });

    it('permite DB_SYNCHRONIZE=true si TypeORM tiene sincronizacion efectiva desactivada', async () => {
      process.env.DB_SYNCHRONIZE = 'true';
      await expect(service.verificarDestino()).resolves.toBeUndefined();
    });

    it('bloquea si TypeORM tiene sincronizacion efectiva activada', async () => {
      dataSource.options.synchronize = true;
      await expect(service.verificarDestino()).rejects.toThrow(ServiceUnavailableException);
    });

    it('bloquea si la conexion no esta inicializada', async () => {
      dataSource.isInitialized = false;
      await expect(service.verificarDestino()).rejects.toThrow(ServiceUnavailableException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('bloquea si falla la consulta de la base activa', async () => {
      dataSource.query.mockRejectedValue(new Error('connection error'));
      await expect(service.verificarDestino()).rejects.toThrow('No se pudo verificar la base de datos para invitaciones.');
    });

    it('bloquea si la sincronizacion efectiva no esta definida', async () => {
      dataSource.options.synchronize = undefined;
      await expect(service.verificarDestino()).rejects.toThrow(ServiceUnavailableException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('bloquea si la base configurada esta ausente', async () => {
      dataSource.options.database = undefined;
      await expect(service.verificarDestino()).rejects.toThrow(ServiceUnavailableException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('bloquea si DB_DATABASE es una base no autorizada', async () => {
      dataSource.options.database = 'otra_base';
      await expect(service.verificarDestino()).rejects.toThrow(
        'Invitaciones habilitadas solo en sgpa y sgpa_test',
      );
    });

    it('bloquea si la base activa en MySQL difiere de DB_DATABASE', async () => {
      dataSource.options.database = 'sgpa';
      dataSource.query.mockResolvedValue([{ db: 'sgpa_test' }]);
      await expect(service.verificarDestino()).rejects.toThrow(
        'El destino de invitaciones no coincide',
      );
    });

    it('bloquea si la base activa en MySQL es desconocida', async () => {
      dataSource.options.database = 'sgpa';
      dataSource.query.mockResolvedValue([{ db: 'produccion_externa' }]);
      await expect(service.verificarDestino()).rejects.toThrow(
        'El destino de invitaciones no coincide',
      );
    });
  });

  describe('clave y cifrado AES-256-GCM', () => {
    it('falla si falta la clave de cifrado', () => {
      delete process.env.SGPA_INVITATION_ENCRYPTION_KEY;
      expect(() => (service as any).clave()).toThrow(
        'Falta la clave de cifrado de invitaciones.',
      );
    });

    it('falla si la clave no tiene 64 caracteres hex', () => {
      process.env.SGPA_INVITATION_ENCRYPTION_KEY = 'invalida';
      expect(() => (service as any).clave()).toThrow(
        'Falta la clave de cifrado de invitaciones.',
      );
    });

    it('cifra y descifra correctamente un enlace con AAD', () => {
      const enlaceOriginal = 'https://sgpa.una.ac.cr/auth/invitacion#correo=test@una.ac.cr&token=abc';
      const usuarioId = 42;
      const tokenHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const cifrado = (service as any).cifrar(enlaceOriginal, usuarioId, tokenHash);
      expect(typeof cifrado).toBe('string');
      expect(cifrado).not.toBe(enlaceOriginal);

      const entradaSimulada = {
        enlaceCifrado: cifrado,
        usuarioId,
        tokenHash,
      } as InvitacionOutbox;

      const descifrado = (service as any).descifrar(entradaSimulada);
      expect(descifrado).toBe(enlaceOriginal);
    });

    it('rechaza descifrado si se altera el usuarioId o tokenHash (AAD)', () => {
      const enlaceOriginal = 'https://sgpa.una.ac.cr/auth/invitacion#token=abc';
      const cifrado = (service as any).cifrar(enlaceOriginal, 1, 'hash-a');

      const entradaAlterada = {
        enlaceCifrado: cifrado,
        usuarioId: 2, // alterado
        tokenHash: 'hash-a',
      } as InvitacionOutbox;

      expect(() => (service as any).descifrar(entradaAlterada)).toThrow();
    });
  });

  describe('procesarPendiente', () => {
    it('procesa la invitaci?n PENDIENTE existente sin rotar ni crear otra fila', async () => {
      const entrada = { id: 5, usuarioId: 10, estado: 'PENDIENTE', intentos: 0,
        expiraEn: new Date(Date.now() + 60_000), enlaceCifrado: 'cifrado' };
      (repositorio.findOne as jest.Mock).mockResolvedValue(entrada);
      const procesar = jest.spyOn(service, 'procesarId').mockResolvedValue('ENVIADA');
      await expect(service.procesarPendiente(10)).resolves.toBe('ENVIADA');
      expect(procesar).toHaveBeenCalledWith(5);
      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('no reintenta autom?ticamente un resultado incierto y reporta estado actual', async () => {
      (repositorio.findOne as jest.Mock).mockResolvedValue({ estado: 'INCIERTA' });
      const procesar = jest.spyOn(service, 'procesarId');
      await expect(service.procesarPendiente(10)).resolves.toBe('INCIERTA');
      expect(procesar).not.toHaveBeenCalled();
    });

    it('no ejecuta el trabajador autom?tico cuando est? deshabilitado', async () => {
      process.env.SGPA_INVITATION_OUTBOX_ENABLED = 'false';
      await service.procesarPendientes();
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(repositorio.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('obtenerEstado', () => {
    it('retorna SIN_INVITACION si no hay registro', async () => {
      (repositorio.findOne as jest.Mock).mockResolvedValue(null);
      const res = await service.obtenerEstado(99);
      expect(res).toEqual({ estado: 'SIN_INVITACION' });
    });

    it('retorna el detalle si existe registro', async () => {
      const expira = new Date();
      (repositorio.findOne as jest.Mock).mockResolvedValue({
        estado: 'PENDIENTE',
        intentos: 1,
        expiraEn: expira,
        enviadoEn: null,
      });
      const res = await service.obtenerEstado(10);
      expect(res).toEqual({
        estado: 'PENDIENTE',
        intentos: 1,
        expiraEn: expira,
        enviadoEn: null,
        puedeProcesar: false,
      });
    });
  });
});
