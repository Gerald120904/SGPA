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

    const rolActivo = usuario?.rolActivo as RolSistema | undefined;
    if (usuario && !rolActivo) {
      throw new ForbiddenException('Falta un rol activo autorizado.');
    }

    if (usuario?.jerarquiaConfigurada === true &&
      rolActivo !== RolSistema.ADMIN_GLOBAL &&
      (rolActivo === RolSistema.COORDINADOR || rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL) &&
      !['JerarquiaUsuariosController', 'SolicitudesCambioController'].includes(context.getClass()?.name)) {
      throw new ForbiddenException('Esta ruta no verifica aún el alcance por carrera.');
    }

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    if (!usuario || !rolActivo) {
      throw new ForbiddenException(
        'El usuario no posee permisos para realizar esta operación.',
      );
    }

    const autorizado = rolesPermitidos.includes(rolActivo as RolSistema);

    if (!autorizado) {
      throw new ForbiddenException(
        'El usuario no posee permisos para realizar esta operación desde el rol activo.',
      );
    }

    return true;
  }
}
