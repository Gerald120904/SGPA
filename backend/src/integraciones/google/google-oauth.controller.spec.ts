import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthService } from './google-oauth.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { PermisosService } from '../../permisos/permisos.service';
import { PERMISOS_KEY } from '../../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { RolSistema } from '../../auth/constants/roles.constants';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('GoogleOauthController', () => {
  let controller: GoogleOauthController;
  let service: {
    generarUrlAutorizacion: jest.Mock;
    obtenerEstado: jest.Mock;
    procesarCallback: jest.Mock;
    desconectar: jest.Mock;
  };
  let permisosGuard: PermisosGuard;
  let permisosService: { usuarioTienePermisos: jest.Mock };
  let reflector: Reflector;

  beforeEach(async () => {
    service = {
      generarUrlAutorizacion: jest.fn(),
      obtenerEstado: jest.fn(),
      procesarCallback: jest.fn(),
      desconectar: jest.fn(),
    };

    permisosService = {
      usuarioTienePermisos: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleOauthController],
      providers: [
        {
          provide: GoogleOauthService,
          useValue: service,
        },
        {
          provide: PermisosService,
          useValue: permisosService,
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
        Reflector,
        PermisosGuard,
      ],
    }).compile();

    controller = module.get<GoogleOauthController>(GoogleOauthController);
    permisosGuard = module.get<PermisosGuard>(PermisosGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function crearContexto(
    handler: (...args: any[]) => any,
    user: any,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => GoogleOauthController,
      switchToHttp: () => ({
        getRequest: () => ({ user } as unknown as Request),
        getResponse: () => ({} as Response),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Metadatos y Guards de Rutas', () => {
    it('callback no requiere JWT (no tiene AuthGuard ni PermisosGuard)', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        GoogleOauthController.prototype.callback,
      );
      expect(guards).toBeUndefined();

      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        GoogleOauthController.prototype.callback,
      );
      expect(permisos).toBeUndefined();
    });

    it('/iniciar sí requiere JWT y permiso FORMULARIOS_ESTUDIANTES_CREAR', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        GoogleOauthController.prototype.iniciar,
      );
      expect(guards).toEqual([AuthGuard, PermisosGuard]);

      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        GoogleOauthController.prototype.iniciar,
      );
      expect(permisos).toEqual([PermisoSistema.FORMULARIOS_ESTUDIANTES_CREAR]);
    });

    it('/estado sí requiere permiso FORMULARIOS_ESTUDIANTES_VER', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        GoogleOauthController.prototype.obtenerEstado,
      );
      expect(guards).toEqual([AuthGuard, PermisosGuard]);

      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        GoogleOauthController.prototype.obtenerEstado,
      );
      expect(permisos).toEqual([PermisoSistema.FORMULARIOS_ESTUDIANTES_VER]);
    });

    it('/desconectar sí requiere permiso FORMULARIOS_ESTUDIANTES_GESTIONAR', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        GoogleOauthController.prototype.desconectar,
      );
      expect(guards).toEqual([AuthGuard, PermisosGuard]);

      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        GoogleOauthController.prototype.desconectar,
      );
      expect(permisos).toEqual([
        PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR,
      ]);
    });

    it('ADMIN_GLOBAL conserva bypass en rutas protegidas', async () => {
      const context = crearContexto(
        GoogleOauthController.prototype.iniciar,
        {
          sub: 1,
          roles: [RolSistema.ADMIN_GLOBAL],
        },
      );

      const canActivate = await permisosGuard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
    });

    it('Usuario sin permiso requerido es rechazado con ForbiddenException', async () => {
      permisosService.usuarioTienePermisos.mockResolvedValue(false);

      const context = crearContexto(
        GoogleOauthController.prototype.iniciar,
        {
          sub: 10,
          roles: [RolSistema.PROFESOR],
        },
      );

      await expect(permisosGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Métodos del controlador', () => {
    it('iniciar delega en GoogleOauthService con req.user.sub', async () => {
      const mockReq = { user: { sub: 7 } } as Request;
      service.generarUrlAutorizacion.mockResolvedValue({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?test',
      });

      const res = await controller.iniciar(mockReq);

      expect(service.generarUrlAutorizacion).toHaveBeenCalledWith(7);
      expect(res).toEqual({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?test',
      });
    });

    it('obtenerEstado delega en GoogleOauthService con req.user.sub', async () => {
      const mockReq = { user: { sub: 8 } } as Request;
      service.obtenerEstado.mockResolvedValue({
        conectado: true,
        googleEmail: 'user@sgpa.cr',
        conectadoAt: new Date(),
      });

      const res = await controller.obtenerEstado(mockReq);

      expect(service.obtenerEstado).toHaveBeenCalledWith(8);
      expect(res.conectado).toBe(true);
    });

    it('callback envía HTML y cabecera Content-Type', async () => {
      const htmlEsperado = '<h2>Google conectado correctamente</h2>';
      service.procesarCallback.mockResolvedValue(htmlEsperado);

      const setHeaderMock = jest.fn();
      const sendMock = jest.fn();
      const mockRes = {
        setHeader: setHeaderMock,
        send: sendMock,
      } as unknown as Response;

      await controller.callback('auth_code', 'state_val', mockRes);

      expect(service.procesarCallback).toHaveBeenCalledWith(
        'auth_code',
        'state_val',
      );
      expect(setHeaderMock).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
      expect(sendMock).toHaveBeenCalledWith(htmlEsperado);
    });

    it('desconectar delega en GoogleOauthService con req.user.sub', async () => {
      const mockReq = { user: { sub: 9 } } as Request;
      service.desconectar.mockResolvedValue(undefined);

      const res = await controller.desconectar(mockReq);

      expect(service.desconectar).toHaveBeenCalledWith(9);
      expect(res).toEqual({
        mensaje: 'Conexión con Google desvinculada exitosamente',
      });
    });
  });
});
