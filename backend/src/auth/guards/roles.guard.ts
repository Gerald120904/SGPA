import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '../constants/roles.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<RolSistema[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    if (!usuario || !Array.isArray(usuario.roles)) {
      throw new ForbiddenException(
        'El usuario no posee permisos para realizar esta operación.',
      );
    }

    const autorizado = usuario.roles.some((rol: string) =>
      rolesPermitidos.includes(rol as RolSistema),
    );

    if (!autorizado) {
      throw new ForbiddenException(
        'El usuario no posee permisos para realizar esta operación.',
      );
    }

    return true;
  }
}
