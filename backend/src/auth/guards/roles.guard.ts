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

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    if (usuario?.jerarquiaConfigurada === true &&
      !usuario.roles?.includes(RolSistema.ADMIN_GLOBAL) &&
      (usuario.roles?.includes(RolSistema.COORDINADOR) || usuario.roles?.includes(RolSistema.ASISTENTE_ESTUDIANTIL)) &&
      !['JerarquiaUsuariosController', 'SolicitudesCambioController'].includes(context.getClass()?.name)) {
      throw new ForbiddenException('Esta ruta no verifica aún el alcance por carrera.');
    }

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

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
