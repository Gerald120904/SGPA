import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DependenciaUsuario } from '../../usuarios/entities/dependencia-usuario.entity';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let usuarioRepository: { findOne: jest.Mock };
  let dependenciaRepository: { findOne: jest.Mock };

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
    dependenciaRepository = { findOne: jest.fn() };

    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      usuarioRepository as unknown as Repository<Usuario>,
      dependenciaRepository as unknown as Repository<DependenciaUsuario>,
    );
  });

  it('mantiene el bloqueo jerarquico tras revocar la ultima carrera del coordinador', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 2, correo: 'coord@sgpa.local' });
    usuarioRepository.findOne.mockResolvedValue({
      id: 2, activo: true,
      usuarioRoles: [{ rol: { nombre: 'COORDINADOR', activo: true } }],
    });
    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      usuarioRepository as unknown as Repository<Usuario>,
      dependenciaRepository as unknown as Repository<DependenciaUsuario>,
    );
    const context = crearContexto('Bearer token-coordinador');
    await guard.canActivate(context);
    expect(context.switchToHttp().getRequest().user.jerarquiaConfigurada).toBe(true);
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

  describe('validación de estado y roles en base de datos (QA-002 y QA-003)', () => {
    it('rechaza un token anterior cuando el asistente perdió su dependencia', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 3, correo: 'asistente@una.cr', roles: ['ASISTENTE_ESTUDIANTIL'] });
      usuarioRepository.findOne.mockResolvedValue({ id: 3, activo: true,
        usuarioRoles: [{ rol: { nombre: 'ASISTENTE_ESTUDIANTIL', activo: true } }] });
      const dependencias = { findOne: jest.fn().mockResolvedValue(null) };
      guard = new AuthGuard(jwtService as unknown as JwtService,
        configService as unknown as ConfigService,
        usuarioRepository as unknown as Repository<Usuario>,
        dependencias as unknown as Repository<DependenciaUsuario>);
      await expect(guard.canActivate(crearContexto('Bearer token-anterior')))
        .rejects.toThrow(UnauthorizedException);
    });
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
      expect(usuarioRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 999 },
          relations: { usuarioRoles: { rol: true } },
        }),
      );
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
        usuarioRoles: [
          {
            usuarioId: 15,
            rolId: 2,
            rol: { id: 2, nombre: 'COORDINADOR', activo: true },
          },
        ],
      });

      const context = crearContexto('Bearer token-usuario-desactivado');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Usuario inactivo'),
      );
    });

    it('lanza UnauthorizedException si el usuario no tiene ningún rol asignado en base de datos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 20,
        correo: 'sinroles@sgpa.local',
        roles: ['COORDINADOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 20,
        activo: true,
        usuarioRoles: [],
      });

      const context = crearContexto('Bearer token-roles-eliminados');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Usuario sin roles asignados o activos'),
      );
    });

    it('lanza UnauthorizedException si todos los roles asignados al usuario están inactivos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 21,
        correo: 'rolesinactivos@sgpa.local',
        roles: ['COORDINADOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 21,
        activo: true,
        usuarioRoles: [
          {
            usuarioId: 21,
            rolId: 2,
            rol: { id: 2, nombre: 'COORDINADOR', activo: false },
          },
        ],
      });

      const context = crearContexto('Bearer token-rol-desactivado');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Usuario sin roles asignados o activos'),
      );
    });

    it('reemplaza los roles antiguos del token por los roles reales vigentes de la base de datos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 5,
        correo: 'usuario@sgpa.local',
        roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 5,
        activo: true,
        usuarioRoles: [
          {
            usuarioId: 5,
            rolId: 3,
            rol: { id: 3, nombre: 'PROFESOR', activo: true },
          },
        ],
      });

      const context = crearContexto('Bearer token-con-roles-viejos');
      const request = context.switchToHttp().getRequest();

      const resultado = await guard.canActivate(context);

      expect(resultado).toBe(true);
      expect(request.user.roles).toEqual(['PROFESOR']);
      expect(request.user.roles).not.toContain('ADMIN_GLOBAL');
      expect(request.user.roles).not.toContain('COORDINADOR');
    });

    it('soporta usuarios con múltiples roles activos simultáneos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 8,
        correo: 'multirrol@sgpa.local',
        roles: ['PROFESOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 8,
        activo: true,
        usuarioRoles: [
          {
            usuarioId: 8,
            rolId: 3,
            rol: { id: 3, nombre: 'PROFESOR', activo: true },
          },
          {
            usuarioId: 8,
            rolId: 2,
            rol: { id: 2, nombre: 'COORDINADOR', activo: true },
          },
        ],
      });

      const context = crearContexto('Bearer token-multirrol');
      const request = context.switchToHttp().getRequest();

      const resultado = await guard.canActivate(context);

      expect(resultado).toBe(true);
      expect(request.user.roles).toEqual(['PROFESOR', 'COORDINADOR']);
    });

    it('revoca privilegios de ADMIN_GLOBAL inmediatamente al ser retirado en base de datos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        correo: 'exadmin@sgpa.local',
        roles: ['ADMIN_GLOBAL'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 1,
        activo: true,
        usuarioRoles: [
          {
            usuarioId: 1,
            rolId: 3,
            rol: { id: 3, nombre: 'PROFESOR', activo: true },
          },
        ],
      });

      const context = crearContexto('Bearer token-admin-revocado');
      const request = context.switchToHttp().getRequest();

      const resultado = await guard.canActivate(context);

      expect(resultado).toBe(true);
      expect(request.user.roles).toEqual(['PROFESOR']);
      expect(request.user.roles.includes('ADMIN_GLOBAL')).toBe(false);
    });

    it('excluye roles inactivos cuando el usuario tiene roles mixtos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 12,
        correo: 'mixto@sgpa.local',
        roles: ['COORDINADOR', 'PROFESOR'],
      });
      usuarioRepository.findOne.mockResolvedValue({
        id: 12,
        activo: true,
        usuarioRoles: [
          {
            usuarioId: 12,
            rolId: 2,
            rol: { id: 2, nombre: 'COORDINADOR', activo: false },
          },
          {
            usuarioId: 12,
            rolId: 3,
            rol: { id: 3, nombre: 'PROFESOR', activo: true },
          },
        ],
      });

      const context = crearContexto('Bearer token-rol-mixto');
      const request = context.switchToHttp().getRequest();

      const resultado = await guard.canActivate(context);

      expect(resultado).toBe(true);
      expect(request.user.roles).toEqual(['PROFESOR']);
    });
  });
});
