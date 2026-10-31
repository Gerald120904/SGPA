import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthGuard } from './auth.guard';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { RolSistema } from '../constants/roles.constants';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { AuthService } from '../auth.service';

describe('D-01: Seguridad del Rol Activo y Contexto de Autorización', () => {
  describe('RolesGuard con rol activo validado', () => {
    let reflector: Reflector;
    let guard: RolesGuard;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector);
    });

    function crearContexto(user: any, rolesPermitidos: RolSistema[]): ExecutionContext {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(rolesPermitidos);
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: () => ({}),
        getClass: () => ({ name: 'TestController' }),
      } as unknown as ExecutionContext;
    }

    it('deniega acceso a ruta de ADMIN_GLOBAL si el usuario tiene ADMIN_GLOBAL y PROFESOR pero su rolActivo es PROFESOR', () => {
      const user = {
        sub: 1,
        correo: 'admin.prof@una.cr',
        roles: [RolSistema.ADMIN_GLOBAL, RolSistema.PROFESOR],
        rolActivo: RolSistema.PROFESOR,
      };

      const context = crearContexto(user, [RolSistema.ADMIN_GLOBAL]);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('permite acceso a ruta de PROFESOR si el usuario tiene ADMIN_GLOBAL y PROFESOR y su rolActivo es PROFESOR', () => {
      const user = {
        sub: 1,
        correo: 'admin.prof@una.cr',
        roles: [RolSistema.ADMIN_GLOBAL, RolSistema.PROFESOR],
        rolActivo: RolSistema.PROFESOR,
      };

      const context = crearContexto(user, [RolSistema.PROFESOR]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('permite acceso a ruta de ADMIN_GLOBAL cuando el rolActivo es ADMIN_GLOBAL', () => {
      const user = {
        sub: 1,
        correo: 'admin.prof@una.cr',
        roles: [RolSistema.ADMIN_GLOBAL, RolSistema.PROFESOR],
        rolActivo: RolSistema.ADMIN_GLOBAL,
      };

      const context = crearContexto(user, [RolSistema.ADMIN_GLOBAL]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('deniega acceso si el rolActivo no está presente en los roles permitidos de la ruta', () => {
      const user = {
        sub: 2,
        correo: 'coordinador@una.cr',
        roles: [RolSistema.COORDINADOR],
        rolActivo: RolSistema.COORDINADOR,
      };

      const context = crearContexto(user, [RolSistema.ADMIN_GLOBAL]);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('PermisosGuard con rol activo validado', () => {
    let reflector: Reflector;
    let permisosService: any;
    let guard: PermisosGuard;

    beforeEach(() => {
      reflector = new Reflector();
      permisosService = {
        usuarioTienePermisos: jest.fn(),
      };
      guard = new PermisosGuard(reflector, permisosService as any);
    });

    function crearContextoPermisos(user: any, permisosRequeridos: PermisoSistema[]): ExecutionContext {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permisosRequeridos);
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user, method: 'POST', params: {} }),
        }),
        getHandler: () => ({}),
        getClass: () => ({ name: 'UsuariosController' }),
      } as unknown as ExecutionContext;
    }

    it('no concede superusuario al usuario con ADMIN_GLOBAL si su rolActivo es PROFESOR', async () => {
      const user = {
        sub: 1,
        correo: 'admin.prof@una.cr',
        roles: [RolSistema.ADMIN_GLOBAL, RolSistema.PROFESOR],
        rolActivo: RolSistema.PROFESOR,
      };

      permisosService.usuarioTienePermisos.mockResolvedValue(false);

      const context = crearContextoPermisos(user, [PermisoSistema.USUARIOS_GESTIONAR]);
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(permisosService.usuarioTienePermisos).toHaveBeenCalledWith(1, [PermisoSistema.USUARIOS_GESTIONAR], RolSistema.PROFESOR);
    });

    it('concede superusuario inmediato cuando el rolActivo es ADMIN_GLOBAL', async () => {
      const user = {
        sub: 1,
        correo: 'admin.prof@una.cr',
        roles: [RolSistema.ADMIN_GLOBAL, RolSistema.PROFESOR],
        rolActivo: RolSistema.ADMIN_GLOBAL,
      };

      const context = crearContextoPermisos(user, [PermisoSistema.USUARIOS_GESTIONAR]);
      const res = await guard.canActivate(context);
      expect(res).toBe(true);
      expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
    });
  });

  describe('AuthGuard con invalidación de rol revocado', () => {
    let jwtService: any;
    let configService: any;
    let usuarioRepo: any;
    let guard: AuthGuard;

    beforeEach(() => {
      jwtService = {
        verifyAsync: jest.fn(),
      };
      configService = {
        get: jest.fn().mockReturnValue('test-secret'),
      };
      usuarioRepo = {
        findOne: jest.fn(),
      };
      guard = new AuthGuard(jwtService, configService, usuarioRepo as any);
    });

    const contexto = (token: string) => ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }),
    }) as unknown as ExecutionContext;

    it('rechaza JWT heredados sin rolActivo incluso si anuncian ADMIN_GLOBAL', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 10, roles: [RolSistema.ADMIN_GLOBAL], av: 1 });
      await expect(guard.canActivate(contexto('legado'))).rejects.toThrow(UnauthorizedException);
      expect(usuarioRepo.findOne).not.toHaveBeenCalled();
    });

    it('rechaza el JWT anterior tras rotar la versión persistida', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 10, rolActivo: RolSistema.ADMIN_GLOBAL, av: 1 });
      usuarioRepo.findOne.mockResolvedValue({ id: 10, activo: true, versionAutenticacion: 2,
        usuarioRoles: [{ rol: { nombre: RolSistema.ADMIN_GLOBAL, activo: true } }] });
      await expect(guard.canActivate(contexto('anterior'))).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza la petición si el rolActivo del token ya fue revocado en la base de datos', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 10,
        correo: 'prof@una.cr',
        rolActivo: RolSistema.COORDINADOR,
        av: 1,
      });

      // En la BD el rol COORDINADOR fue revocado, solo tiene PROFESOR
      usuarioRepo.findOne.mockResolvedValue({
        id: 10,
        activo: true,
        versionAutenticacion: 1,
        usuarioRoles: [
          {
            rol: {
              nombre: RolSistema.PROFESOR,
              activo: true,
            },
          },
        ],
      });

      const request: any = {
        headers: {
          authorization: 'Bearer token-con-rol-revocado',
        },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('El rol activo ya no está asignado o no está vigente.'),
      );
    });

    it('asigna rolActivo validado en request.user cuando coincide con un rol vigente', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 10,
        correo: 'prof@una.cr',
        rolActivo: RolSistema.PROFESOR,
        av: 1,
      });

      usuarioRepo.findOne.mockResolvedValue({
        id: 10,
        activo: true,
        versionAutenticacion: 1,
        usuarioRoles: [
          {
            rol: {
              nombre: RolSistema.PROFESOR,
              activo: true,
            },
          },
        ],
      });

      const request: any = {
        headers: {
          authorization: 'Bearer token-valido',
        },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      const res = await guard.canActivate(context);
      expect(res).toBe(true);
      expect(request.user.rolActivo).toBe(RolSistema.PROFESOR);
    });
  });

  describe('AuthService.cambiarRolActivo', () => {
    let usuariosService: any;
    let jwtService: any;
    let mailService: any;
    let permisosService: any;
    let authService: AuthService;

    beforeEach(() => {
      usuariosService = {
        buscarPorId: jest.fn(),
        actualizarUltimoAcceso: jest.fn(),
        rotarVersionAutenticacion: jest.fn().mockResolvedValue(2),
      };
      jwtService = {
        signAsync: jest.fn().mockResolvedValue('nuevo-jwt-token'),
      };
      mailService = {};
      permisosService = {
        obtenerPermisosEfectivos: jest.fn().mockResolvedValue([PermisoSistema.PROFESORES_VER]),
      };

      authService = new AuthService(
        usuariosService,
        jwtService,
        mailService as any,
        permisosService as any,
      );
    });

    it('rechaza cambiar a un rol que el usuario no tiene asignado', async () => {
      usuariosService.buscarPorId.mockResolvedValue({
        id: 5,
        activo: true,
        usuarioRoles: [
          {
            rol: { nombre: RolSistema.PROFESOR, activo: true },
          },
        ],
      });

      await expect(
        authService.cambiarRolActivo(5, { rol: RolSistema.ADMIN_GLOBAL }, 1),
      ).rejects.toThrow('El usuario no posee el rol solicitado o no está vigente.');
    });

    it('emite un nuevo token y usuario con rolActivo cuando el rol es válido', async () => {
      usuariosService.buscarPorId.mockResolvedValue({
        id: 5,
        cedula: '401110222',
        nombres: 'María',
        apellido1: 'Pérez',
        apellido2: 'García',
        correo: 'maria@una.cr',
        activo: true,
        usuarioRoles: [
          { rol: { nombre: RolSistema.ADMIN_GLOBAL, activo: true } },
          { rol: { nombre: RolSistema.PROFESOR, activo: true } },
        ],
      });

      const resultado = await authService.cambiarRolActivo(5, { rol: RolSistema.PROFESOR }, 1);
      expect(resultado.accessToken).toBe('nuevo-jwt-token');
      expect(resultado.usuario.rolActivo).toBe(RolSistema.PROFESOR);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 5,
          rolActivo: RolSistema.PROFESOR,
        }),
      );
      expect(permisosService.obtenerPermisosEfectivos).toHaveBeenCalledWith(
        5,
        [RolSistema.ADMIN_GLOBAL, RolSistema.PROFESOR],
        RolSistema.PROFESOR,
      );
    });
  });
});
