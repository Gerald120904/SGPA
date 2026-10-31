import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '../constants/roles.constants';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let guard: RolesGuard;

  const crearContexto = (roles?: string[], rolActivo?: RolSistema) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: roles ? { roles, rolActivo: rolActivo ?? roles[0] } : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite endpoints sin roles definidos', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(crearContexto())).toBe(true);
  });

  it('cierra rutas sin decorador de roles a cuentas jerarquicas', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = {
      getHandler: jest.fn(), getClass: jest.fn().mockReturnValue(class OtroController {}),
      switchToHttp: () => ({ getRequest: () => ({
        user: { roles: [RolSistema.COORDINADOR], rolActivo: RolSistema.COORDINADOR, jerarquiaConfigurada: true },
      }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permite un usuario con un rol autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([RolSistema.ADMIN_GLOBAL]);

    expect(guard.canActivate(crearContexto([RolSistema.ADMIN_GLOBAL]))).toBe(
      true,
    );
  });

  it('permite cuando cualquiera de los roles del usuario está autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([RolSistema.COORDINADOR]);

    expect(
      guard.canActivate(
        crearContexto([RolSistema.PROFESOR, RolSistema.COORDINADOR], RolSistema.COORDINADOR),
      ),
    ).toBe(true);
  });

  it('deniega un usuario con un rol no autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([RolSistema.ADMIN_GLOBAL]);

    expect(() =>
      guard.canActivate(crearContexto([RolSistema.COORDINADOR])),
    ).toThrow(ForbiddenException);
  });

  it('deniega una solicitud sin usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue([RolSistema.ADMIN_GLOBAL]);

    expect(() => guard.canActivate(crearContexto())).toThrow(
      ForbiddenException,
    );
  });

  it('deniega acceso cuando el rol requerido fue revocado y el usuario conserva otros roles', () => {
    // Endpoint requiere COORDINADOR, pero al usuario le revocaron COORDINADOR y solo conserva PROFESOR
    reflector.getAllAndOverride.mockReturnValue([RolSistema.COORDINADOR]);

    expect(() =>
      guard.canActivate(crearContexto([RolSistema.PROFESOR])),
    ).toThrow(ForbiddenException);
  });

  it('permite acceso al rol legítimo conservado tras la revocación de otro rol', () => {
    // Endpoint requiere PROFESOR, el usuario perdió COORDINADOR pero conserva PROFESOR
    reflector.getAllAndOverride.mockReturnValue([RolSistema.PROFESOR]);

    expect(guard.canActivate(crearContexto([RolSistema.PROFESOR]))).toBe(true);
  });

  it('deniega acceso si la lista de roles del usuario está vacía (todos los roles fueron revocados)', () => {
    reflector.getAllAndOverride.mockReturnValue([RolSistema.PROFESOR]);

    expect(() => guard.canActivate(crearContexto([]))).toThrow(
      ForbiddenException,
    );
  });
});
