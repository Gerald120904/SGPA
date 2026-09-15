import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import { GoogleOauthService } from './google-oauth.service';
import { GoogleConexionUsuario } from './entities/google-conexion-usuario.entity';
import { GoogleOauthEstado } from './entities/google-oauth-estado.entity';

describe('GoogleOauthService', () => {
  let service: GoogleOauthService;
  let googleConexionRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let googleOauthEstadoRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  const ENCRYPTION_KEY_HEX =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    googleConexionRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    };

    googleOauthEstadoRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    };

    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'GOOGLE_OAUTH_CLIENT_ID':
            return 'test-client-id';
          case 'GOOGLE_OAUTH_CLIENT_SECRET':
            return 'test-client-secret';
          case 'GOOGLE_OAUTH_REDIRECT_URI':
            return 'http://127.0.0.1:3000/integraciones/google/oauth/callback';
          case 'GOOGLE_TOKEN_ENCRYPTION_KEY':
            return ENCRYPTION_KEY_HEX;
          default:
            return undefined;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOauthService,
        {
          provide: getRepositoryToken(GoogleConexionUsuario),
          useValue: googleConexionRepo,
        },
        {
          provide: getRepositoryToken(GoogleOauthEstado),
          useValue: googleOauthEstadoRepo,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<GoogleOauthService>(GoogleOauthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generarUrlAutorizacion', () => {
    it('genera state aleatorio, solo almacena hash del state y PKCE guarda codeVerifier cifrado', async () => {
      const mockVerifier = 'mock_pkce_code_verifier_1234567890';
      const mockChallenge = 'mock_pkce_code_challenge_1234567890';

      jest
        .spyOn(OAuth2Client.prototype, 'generateCodeVerifierAsync')
        .mockResolvedValue({
          codeVerifier: mockVerifier,
          codeChallenge: mockChallenge,
        });

      let generatedAuthUrl = '';
      jest
        .spyOn(OAuth2Client.prototype, 'generateAuthUrl')
        .mockImplementation((opts: any) => {
          generatedAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?state=${opts.state}&code_challenge=${opts.code_challenge}`;
          return generatedAuthUrl;
        });

      const usuarioId = 42;
      const beforeCall = Date.now();
      const resultado = await service.generarUrlAutorizacion(usuarioId);

      expect(resultado.url).toBe(generatedAuthUrl);
      expect(googleOauthEstadoRepo.create).toHaveBeenCalledTimes(1);

      const estadoCreado = googleOauthEstadoRepo.create.mock.calls[0][0];
      expect(estadoCreado.usuarioId).toBe(usuarioId);
      expect(estadoCreado.usadoAt).toBeNull();

      // State hash debe ser de 64 caracteres hex (SHA-256)
      expect(estadoCreado.stateHash).toHaveLength(64);
      expect(estadoCreado.stateHash).toMatch(/^[0-9a-f]{64}$/);

      // codeVerifier guardado cifrado (no texto plano)
      expect(estadoCreado.codeVerifierCifrado).not.toBe(mockVerifier);
      expect(estadoCreado.codeVerifierCifrado.split('.')).toHaveLength(3);

      // State expira en aproximadamente 10 minutos
      const diezMinMs = 10 * 60 * 1000;
      const expiraMs = estadoCreado.expiraAt.getTime();
      expect(expiraMs).toBeGreaterThanOrEqual(beforeCall + diezMinMs - 1000);
      expect(expiraMs).toBeLessThanOrEqual(Date.now() + diezMinMs + 1000);

      expect(googleOauthEstadoRepo.save).toHaveBeenCalledWith(estadoCreado);
    });
  });

  describe('procesarCallback', () => {
    it('callback rechaza state inexistente', async () => {
      googleOauthEstadoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.procesarCallback('any_code', 'invalid_state'),
      ).rejects.toThrow(BadRequestException);
    });

    it('callback rechaza state expirado o ya usado', async () => {
      // Si la consulta en TypeORM no encuentra fila activa (usadoAt = null y expiraAt > now)
      googleOauthEstadoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.procesarCallback('valid_code', 'expired_or_used_state'),
      ).rejects.toThrow(BadRequestException);
    });

    it('callback rechaza si no hay refresh_token en primera conexión', async () => {
      const plainVerifier = 'my_test_code_verifier';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(ENCRYPTION_KEY_HEX, 'hex'),
        iv,
      );
      let enc = cipher.update(plainVerifier, 'utf8', 'hex');
      enc += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      const codeVerifierCifrado = `${iv.toString('hex')}.${tag}.${enc}`;

      googleOauthEstadoRepo.findOne.mockResolvedValue({
        id: 1,
        usuarioId: 10,
        stateHash: 'mockHash',
        codeVerifierCifrado,
        expiraAt: new Date(Date.now() + 60000),
        usadoAt: null,
      });

      jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
        tokens: {
          access_token: 'at_123',
          id_token: 'valid_id_token',
          refresh_token: undefined,
        },
      } as any);

      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({ email: 'test@example.com', sub: 'sub-100' }),
      } as any);

      googleConexionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.procesarCallback('code123', 'state123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('id_token inválido o ausente rechaza la conexión', async () => {
      const plainVerifier = 'my_test_code_verifier';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(ENCRYPTION_KEY_HEX, 'hex'),
        iv,
      );
      let enc = cipher.update(plainVerifier, 'utf8', 'hex');
      enc += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      const codeVerifierCifrado = `${iv.toString('hex')}.${tag}.${enc}`;

      googleOauthEstadoRepo.findOne.mockResolvedValue({
        id: 1,
        usuarioId: 10,
        stateHash: 'mockHash',
        codeVerifierCifrado,
        expiraAt: new Date(Date.now() + 60000),
        usadoAt: null,
      });

      jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
        tokens: {
          access_token: 'at_123',
          refresh_token: '1//refresh_token_abc',
          id_token: undefined,
        },
      } as any);

      await expect(
        service.procesarCallback('code123', 'state123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('conexión correcta guarda email + sub + refresh token cifrado', async () => {
      const plainVerifier = 'my_test_code_verifier';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(ENCRYPTION_KEY_HEX, 'hex'),
        iv,
      );
      let enc = cipher.update(plainVerifier, 'utf8', 'hex');
      enc += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      const codeVerifierCifrado = `${iv.toString('hex')}.${tag}.${enc}`;

      const oauthEstadoMock = {
        id: 1,
        usuarioId: 25,
        stateHash: 'mockHash',
        codeVerifierCifrado,
        expiraAt: new Date(Date.now() + 60000),
        usadoAt: null,
      };
      googleOauthEstadoRepo.findOne.mockResolvedValue(oauthEstadoMock);

      jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
        tokens: {
          access_token: 'at_123',
          refresh_token: '1//refresh_token_secret',
          id_token: 'valid_id_token',
        },
      } as any);

      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          email: 'profesor@sgpa.cr',
          sub: 'google_subject_999',
        }),
      } as any);

      googleConexionRepo.findOne.mockResolvedValue(null);

      const html = await service.procesarCallback('code123', 'state123');

      expect(html).toContain('Google conectado correctamente');
      expect(oauthEstadoMock.usadoAt).toBeInstanceOf(Date);
      expect(googleOauthEstadoRepo.save).toHaveBeenCalledWith(oauthEstadoMock);

      expect(googleConexionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 25,
          googleEmail: 'profesor@sgpa.cr',
          googleSubject: 'google_subject_999',
          activo: true,
        }),
      );

      const conexionGuardada = googleConexionRepo.save.mock.calls[0][0];
      expect(conexionGuardada.refreshTokenCifrado).not.toBe(
        '1//refresh_token_secret',
      );
      expect(conexionGuardada.refreshTokenCifrado.split('.')).toHaveLength(3);
    });

    it('reconexión conserva refresh token anterior si Google no entrega uno nuevo', async () => {
      const plainVerifier = 'my_test_code_verifier';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(ENCRYPTION_KEY_HEX, 'hex'),
        iv,
      );
      let enc = cipher.update(plainVerifier, 'utf8', 'hex');
      enc += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      const codeVerifierCifrado = `${iv.toString('hex')}.${tag}.${enc}`;

      googleOauthEstadoRepo.findOne.mockResolvedValue({
        id: 1,
        usuarioId: 30,
        stateHash: 'mockHash',
        codeVerifierCifrado,
        expiraAt: new Date(Date.now() + 60000),
        usadoAt: null,
      });

      jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
        tokens: {
          access_token: 'at_123',
          id_token: 'valid_id_token',
          refresh_token: undefined, // Google no devolvió refresh token en reconexión
        },
      } as any);

      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          email: 'reconnect@sgpa.cr',
          sub: 'google_subject_888',
        }),
      } as any);

      const conexionPrevia = {
        id: 5,
        usuarioId: 30,
        googleEmail: 'antiguo@sgpa.cr',
        googleSubject: 'google_subject_888',
        refreshTokenCifrado: 'iv_existente.tag_existente.cipher_existente',
        activo: true,
        conectadoAt: new Date(Date.now() - 100000),
        revocadoAt: null,
      };
      googleConexionRepo.findOne.mockResolvedValue(conexionPrevia);

      await service.procesarCallback('code123', 'state123');

      expect(conexionPrevia.googleEmail).toBe('reconnect@sgpa.cr');
      expect(conexionPrevia.refreshTokenCifrado).toBe(
        'iv_existente.tag_existente.cipher_existente',
      );
      expect(googleConexionRepo.save).toHaveBeenCalledWith(conexionPrevia);
    });
  });

  describe('obtenerEstado', () => {
    it('obtenerEstado no devuelve tokens', async () => {
      googleConexionRepo.findOne.mockResolvedValue({
        id: 1,
        usuarioId: 15,
        googleEmail: 'usuario@sgpa.cr',
        refreshTokenCifrado: 'iv.tag.cifrado',
        conectadoAt: new Date(),
        activo: true,
      });

      const estado = await service.obtenerEstado(15);

      expect(estado).toEqual({
        conectado: true,
        googleEmail: 'usuario@sgpa.cr',
        conectadoAt: expect.any(Date),
      });
      expect(estado).not.toHaveProperty('refreshTokenCifrado');
      expect(estado).not.toHaveProperty('refreshToken');
    });
  });

  describe('desconectar', () => {
    it('desconectar borra refresh token local e inactiva conexión', async () => {
      const revokeSpy = jest
        .spyOn(OAuth2Client.prototype, 'revokeToken')
        .mockResolvedValue({} as any);

      const plainToken = '1//refresh_token_para_borrar';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(ENCRYPTION_KEY_HEX, 'hex'),
        iv,
      );
      let enc = cipher.update(plainToken, 'utf8', 'hex');
      enc += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      const tokenCifrado = `${iv.toString('hex')}.${tag}.${enc}`;

      const conexionExistente = {
        id: 1,
        usuarioId: 15,
        googleEmail: 'usuario@sgpa.cr',
        refreshTokenCifrado: tokenCifrado,
        activo: true,
        revocadoAt: null,
      };
      googleConexionRepo.findOne.mockResolvedValue(conexionExistente);

      await service.desconectar(15);

      expect(revokeSpy).toHaveBeenCalledWith(plainToken);
      expect(conexionExistente.activo).toBe(false);
      expect(conexionExistente.refreshTokenCifrado).toBeNull();
      expect(conexionExistente.revocadoAt).toBeInstanceOf(Date);
      expect(googleConexionRepo.save).toHaveBeenCalledWith(conexionExistente);
    });

    it('desconectar lanza NotFoundException si no hay conexión', async () => {
      googleConexionRepo.findOne.mockResolvedValue(null);

      await expect(service.desconectar(99)).rejects.toThrow(NotFoundException);
    });
  });
});
