import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InvitacionOutboxService } from './invitacion-outbox.service';
import { InvitacionOutbox } from './entities/invitacion-outbox.entity';
import { MailService } from '../mail/mail.service';

describe('InvitacionOutboxService', () => {
  let service: InvitacionOutboxService;
  let dataSource: { query: jest.Mock };
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
    it('permite operar en sgpa con sincronización desactivada', async () => {
      process.env.DB_DATABASE = 'sgpa';
      dataSource.query.mockResolvedValue([{ db: 'sgpa' }]);
      await expect(service.verificarDestino()).resolves.toBeUndefined();
    });

    it('permite operar en sgpa_test con sincronización desactivada', async () => {
      process.env.DB_DATABASE = 'sgpa_test';
      dataSource.query.mockResolvedValue([{ db: 'sgpa_test' }]);
      await expect(service.verificarDestino()).resolves.toBeUndefined();
    });

    it('bloquea si DB_SYNCHRONIZE es true', async () => {
      process.env.DB_SYNCHRONIZE = 'true';
      await expect(service.verificarDestino()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('bloquea si DB_DATABASE es una base no autorizada', async () => {
      process.env.DB_DATABASE = 'otra_base';
      await expect(service.verificarDestino()).rejects.toThrow(
        'Invitaciones habilitadas solo en sgpa y sgpa_test',
      );
    });

    it('bloquea si la base activa en MySQL difiere de DB_DATABASE', async () => {
      process.env.DB_DATABASE = 'sgpa';
      dataSource.query.mockResolvedValue([{ db: 'sgpa_test' }]);
      await expect(service.verificarDestino()).rejects.toThrow(
        'El destino de invitaciones no coincide',
      );
    });

    it('bloquea si la base activa en MySQL es desconocida', async () => {
      process.env.DB_DATABASE = 'sgpa';
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
      });
    });
  });
});
