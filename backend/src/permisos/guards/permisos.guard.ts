import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '../../auth/constants/roles.constants';
import { PERMISOS_KEY } from '../decorators/permisos.decorator';
import { PermisoSistema } from '../constants/permisos.constant';
import { PermisosService } from '../permisos.service';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosService: PermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<PermisoSistema[]>(
      PERMISOS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    if (!usuario || !Number.isInteger(usuario.sub)) {
      throw new ForbiddenException(
        'No posee permisos para realizar esta operación.',
      );
    }

    // ADMIN_GLOBAL conserva superusuario.
    if (
      Array.isArray(usuario.roles) &&
      usuario.roles.includes(RolSistema.ADMIN_GLOBAL)
    ) {
      return true;
    }

    const autorizado = await this.permisosService.usuarioTienePermisos(
      usuario.sub,
      requeridos,
    );

    if (!autorizado) {
      throw new ForbiddenException(
        'No posee permisos para realizar esta operación.',
      );
    }

    return true;
  }
}
