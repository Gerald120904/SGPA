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

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    // Los módulos restantes todavía no verifican carrera y propiedad en cada recurso.
    // Hasta integrarlos, se bloquean para cuentas jerárquicas.
    if (usuario?.jerarquiaConfigurada === true && Array.isArray(usuario.roles) && !usuario.roles.includes(RolSistema.ADMIN_GLOBAL) &&
      (usuario.roles.includes(RolSistema.ASISTENTE_ESTUDIANTIL) || usuario.roles.includes(RolSistema.COORDINADOR))) {
      const moduloConAlcance = ['EstudiantesController', 'CursosController', 'CursoRequisitosController',
        'PlanesEstudioController', 'PlanAsignaturasController', 'PlanRequisitosController',
        'SalidasAcademicasController', 'PlanResumenController', 'PlanValidacionesController',
        'PlanImportacionController', 'PlanReglasOptativasController', 'OptativasController']
        .includes(context.getClass()?.name);
      const soloLecturaAsistente = request.method === 'GET';
      if (!moduloConAlcance || (usuario.roles.includes(RolSistema.ASISTENTE_ESTUDIANTIL) && !soloLecturaAsistente)) {
        throw new ForbiddenException('Esta operación requiere alcance por carrera aún no integrado.');
      }
    }

    if (!requeridos || requeridos.length === 0) return true;
    if (!usuario || !Number.isInteger(usuario.sub)) {
      throw new ForbiddenException('No posee permisos para realizar esta operacion.');
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

    if (!autorizado && usuario.jerarquiaConfigurada === true && request.method === 'GET' &&
      ((['CursosController', 'CursoRequisitosController'].includes(context.getClass()?.name) &&
        requeridos.length === 1 && requeridos[0] === PermisoSistema.CURSOS_VER &&
        await this.permisosService.usuarioTienePermisos(usuario.sub, [PermisoSistema.CURSOS_GESTIONAR])) ||
       (context.getClass()?.name.startsWith('Plan') || context.getClass()?.name === 'SalidasAcademicasController') &&
        requeridos.length === 1 && requeridos[0] === PermisoSistema.PLANES_ESTUDIO_VER &&
        await this.permisosService.usuarioTienePermisos(usuario.sub, [PermisoSistema.PLANES_ESTUDIO_GESTIONAR]))) {
      return true;
    }

    if (!autorizado) {
      throw new ForbiddenException(
        'No posee permisos para realizar esta operación.',
      );
    }

    return true;
  }
}
