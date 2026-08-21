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

  const crearContexto = (roles?: string[]) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: roles ? { roles } : undefined,
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

  it('permite un usuario con un rol autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([
      RolSistema.ADMIN_GLOBAL,
    ]);

    expect(
      guard.canActivate(crearContexto([RolSistema.ADMIN_GLOBAL])),
    ).toBe(true);
  });

  it('permite cuando cualquiera de los roles del usuario está autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([
      RolSistema.COORDINADOR,
    ]);

    expect(
      guard.canActivate(
        crearContexto([
          RolSistema.PROFESOR,
          RolSistema.COORDINADOR,
        ]),
      ),
    ).toBe(true);
  });

  it('deniega un usuario con un rol no autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([
      RolSistema.ADMIN_GLOBAL,
    ]);

    expect(() =>
      guard.canActivate(crearContexto([RolSistema.COORDINADOR])),
    ).toThrow(ForbiddenException);
  });

  it('deniega una solicitud sin usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue([
      RolSistema.ADMIN_GLOBAL,
    ]);

    expect(() => guard.canActivate(crearContexto())).toThrow(
      ForbiddenException,
    );
  });
});
