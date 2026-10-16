import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let usuarioRepository: { findOne: jest.Mock };

  const jwtSecret = 'test-secret';

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue(jwtSecret),
    };
    usuarioRepository = {
      findOne: jest.fn(),
    };

    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      usuarioRepository as unknown as Repository<Usuario>,
    );
  });

  function crearContexto(authHeader?: string): ExecutionContext {
    const request: { headers: Record<string, string | undefined>; user?: any } = {
      headers: {
        authorization: authHeader,
      },
    };

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  describe('validación de presencia de token', () => {
    it('lanza UnauthorizedException si falta la cabecera authorization', async () => {
      const context = crearContexto(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token de acceso requerido'),
      );
    });

    it('lanza UnauthorizedException si el esquema no es Bearer', async () => {
      const context = crearContexto('Basic dXNlcjpwYXNz');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token de acceso requerido'),
      );
    });
  });

  describe('validación de firma y expiración de JWT', () => {
    it('lanza UnauthorizedException si el token es inválido', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
      const context = crearContexto('Bearer token-invalido');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token inválido o expirado'),
      );
    });

    it('lanza UnauthorizedException si el token está expirado', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      const context = crearContexto('Bearer token-expirado');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token inválido o expirado'),
      );
    });
  });

  describe('validación del claim sub', () => {
    it.each([
      ['sub ausente', {}],
      ['sub no numérico', { sub: 'no-numero' }],
      ['sub decimal', { sub: 1.5 }],
      ['sub cero', { sub: 0 }],
      ['sub negativo', { sub: -5 }],
      ['sub nulo', { sub: null }],
    ])('lanza UnauthorizedException para %s', async (_, payload) => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      const context = crearContexto('Bearer token-valido-cripto');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token con identificador de usuario inválido'),
      );
      expect(usuarioRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('validación del estado en base de datos', () => {
    it('lanza UnauthorizedException si el usuario no existe en la base de datos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 999,
        correo: 'inexistente@sgpa.local',
        roles: ['PROFESOR'],
      });
      usuarioRepository.findOne.mockResolvedValue(null);

      const context = crearContexto('Bearer token-usuario-eliminado');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Usuario inexistente o no autorizado'),
      );
      expect(usuarioRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
        select: { id: true, activo: true },
      });
    });

    it('lanza UnauthorizedException si la cuenta del usuario está inactiva', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 15,
        correo: 'desactivado@sgpa.local',
        roles: ['COORDINADOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 15,
        activo: false,
      });

      const context = crearContexto('Bearer token-usuario-desactivado');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Usuario inactivo'),
      );
      expect(usuarioRepository.findOne).toHaveBeenCalledWith({
        where: { id: 15 },
        select: { id: true, activo: true },
      });
    });

    it('permite el acceso si el usuario existe y está activo, asignando request.user', async () => {
      const payload = {
        sub: 1,
        correo: 'admin@sgpa.local',
        roles: ['ADMIN_GLOBAL'],
      };
      jwtService.verifyAsync.mockResolvedValue(payload);
      usuarioRepository.findOne.mockResolvedValue({
        id: 1,
        activo: true,
      });

      const context = crearContexto('Bearer token-valido');
      const request = context.switchToHttp().getRequest();

      const resultado = await guard.canActivate(context);

      expect(resultado).toBe(true);
      expect(request.user).toEqual(payload);
      expect(usuarioRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, activo: true },
      });
    });

    it('consulta únicamente campos id y activo sin relaciones pesadas', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 42,
        correo: 'usuario@sgpa.local',
        roles: ['PROFESOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 42,
        activo: true,
      });

      const context = crearContexto('Bearer token-valido');
      await guard.canActivate(context);

      const queryParams = usuarioRepository.findOne.mock.calls[0][0];
      expect(queryParams.select).toEqual({ id: true, activo: true });
      expect(queryParams.relations).toBeUndefined();
    });
  });
});
