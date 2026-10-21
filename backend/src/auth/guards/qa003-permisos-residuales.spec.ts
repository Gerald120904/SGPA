import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { PermisosService } from '../../permisos/permisos.service';
import { RolSistema } from '../constants/roles.constants';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISOS_KEY } from '../../permisos/decorators/permisos.decorator';

/**
 * SGPA - QA-003 Fase 3: Análisis de Permisos Residuales
 *
 * Escenario bajo auditoría:
 * 1. Usuario tiene PROFESOR + COORDINADOR.
 * 2. Posee permisos de coordinación almacenados en usuario_permisos (ej. ESTUDIANTES_VER).
 * 3. Se le revoca el rol COORDINADOR en MySQL (tabla usuario_roles).
 * 4. Mantiene el rol PROFESOR en MySQL.
 * 5. Intenta acceder con su JWT a un endpoint protegido exclusivamente con @Permisos(ESTUDIANTES_VER).
 */
describe('QA-003 Fase 3 — Análisis de Permisos Residuales', () => {
  let authGuard: AuthGuard;
  let rolesGuard: RolesGuard;
  let permisosGuard: PermisosGuard;

  let jwtService: { verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let usuarioRepository: { findOne: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let permisosService: { usuarioTienePermisos: jest.Mock };

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
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    permisosService = {
      usuarioTienePermisos: jest.fn(),
    };

    authGuard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      usuarioRepository as unknown as Repository<Usuario>,
      { findOne: jest.fn() } as any,
    );
    rolesGuard = new RolesGuard(reflector as unknown as Reflector);
    permisosGuard = new PermisosGuard(
      reflector as unknown as Reflector,
      permisosService as unknown as PermisosService,
    );
  });

  function crearContexto(tokenHeader: string, requestState: any = {}): ExecutionContext {
    const request = {
      headers: {
        authorization: tokenHeader,
      },
      ...requestState,
    };

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  describe('Escenario: Usuario PROFESOR con rol COORDINADOR revocado y permisos residuales', () => {
    const usuarioId = 50;

    // JWT emitido previamente cuando el usuario tenía ambos roles
    const jwtPayloadAnterior = {
      sub: usuarioId,
      correo: 'docente.coordinador@sgpa.local',
      roles: [RolSistema.PROFESOR, RolSistema.COORDINADOR],
    };

    // Estado real en MySQL: COORDINADOR fue revocado de usuario_roles, solo queda PROFESOR
    const estadoUsuarioMySQL = {
      id: usuarioId,
      activo: true,
      usuarioRoles: [
        {
          usuarioId,
          rolId: 3,
          rol: { id: 3, nombre: RolSistema.PROFESOR, activo: true },
        },
      ],
    };

    it('Fase 1 demostrada: AuthGuard sincroniza los roles y elimina COORDINADOR de request.user.roles', async () => {
      jwtService.verifyAsync.mockResolvedValue(jwtPayloadAnterior);
      usuarioRepository.findOne.mockResolvedValue(estadoUsuarioMySQL);

      const context = crearContexto('Bearer token-con-coordinador');
      const request = context.switchToHttp().getRequest<any>();

      const autenticado = await authGuard.canActivate(context);

      expect(autenticado).toBe(true);
      // Los roles en request.user ahora provienen estrictamente de MySQL
      expect(request.user.roles).toEqual([RolSistema.PROFESOR]);
      expect(request.user.roles).not.toContain(RolSistema.COORDINADOR);
    });

    it('Protección por @Roles: RolesGuard bloquea el acceso a endpoints que requieren COORDINADOR', async () => {
      jwtService.verifyAsync.mockResolvedValue(jwtPayloadAnterior);
      usuarioRepository.findOne.mockResolvedValue(estadoUsuarioMySQL);

      const context = crearContexto('Bearer token-con-coordinador');
      await authGuard.canActivate(context);

      // Endpoint decorado con @Roles(RolSistema.COORDINADOR)
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ROLES_KEY) return [RolSistema.COORDINADOR];
        return undefined;
      });

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('VULNERABILIDAD RESIDUAL: Endpoint protegido ÚNICAMENTE por @Permisos autoriza acceso indebido debido a usuario_permisos no depurado', async () => {
      jwtService.verifyAsync.mockResolvedValue(jwtPayloadAnterior);
      usuarioRepository.findOne.mockResolvedValue(estadoUsuarioMySQL);

      const context = crearContexto('Bearer token-con-coordinador');

      // 1. AuthGuard valida usuario y sincroniza roles a [PROFESOR]
      const authOk = await authGuard.canActivate(context);
      expect(authOk).toBe(true);

      // 2. Endpoint decorado ÚNICAMENTE con @Permisos(ESTUDIANTES_VER), SIN @Roles
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ROLES_KEY) return undefined; // Sin restricción de rol explícita
        if (key === PERMISOS_KEY) return [PermisoSistema.ESTUDIANTES_VER];
        return undefined;
      });

      // 3. RolesGuard no interviene porque no hay roles requeridos
      const rolesOk = rolesGuard.canActivate(context);
      expect(rolesOk).toBe(true);

      // 4. En usuario_permisos todavía existe el registro residual ESTUDIANTES_VER
      // PermisosService busca en la tabla usuario_permisos y encuentra el registro activo
      permisosService.usuarioTienePermisos.mockResolvedValue(true);

      // 5. PermisosGuard ejecuta la verificación
      const permisosOk = await permisosGuard.canActivate(context);

      // ¡ACCESO CONCEDIDO INDEBIDAMENTE!
      // El usuario continúa accediendo a un recurso de coordinación porque los registros
      // en usuario_permisos no tienen relación con el rol revocado ni se han depurado.
      expect(permisosOk).toBe(true);
      expect(permisosService.usuarioTienePermisos).toHaveBeenCalledWith(usuarioId, [
        PermisoSistema.ESTUDIANTES_VER,
      ]);
    });
  });
});
