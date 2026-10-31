import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '../../auth/constants/roles.constants';
import { PERMISOS_KEY } from '../decorators/permisos.decorator';
import { PermisoSistema } from '../constants/permisos.constant';
import { PermisosService } from '../permisos.service';
import { AlcanceJerarquicoService } from '../alcance-jerarquico.service';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosService: PermisosService,
    @Optional()
    private readonly alcanceJerarquico?: AlcanceJerarquicoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<PermisoSistema[]>(
      PERMISOS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    const rolActivo = usuario?.rolActivo as RolSistema | undefined;
    if (usuario && !rolActivo) {
      throw new ForbiddenException('Falta un rol activo autorizado.');
    }

    // Los módulos restantes todavía no verifican carrera y propiedad en cada recurso.
    // Hasta integrarlos, se bloquean para cuentas jerárquicas.
    if (usuario?.jerarquiaConfigurada === true && rolActivo !== RolSistema.ADMIN_GLOBAL &&
      (rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL || rolActivo === RolSistema.COORDINADOR)) {
      const moduloConAlcance = ['EstudiantesController', 'EstudiantesImportacionController', 'CarrerasController', 'CursosController', 'CursoRequisitosController',
        'PlanesEstudioController', 'PlanAsignaturasController', 'PlanRequisitosController',
        'SalidasAcademicasController', 'PlanResumenController', 'PlanValidacionesController',
        'PlanImportacionController', 'PlanReglasOptativasController', 'OptativasController']
        .includes(context.getClass()?.name);
      const soloLecturaAsistente = request.method === 'GET' ||
        (context.getClass()?.name === 'EstudiantesImportacionController' && request.url.includes('/validar'));
      if (!moduloConAlcance || (rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL && !soloLecturaAsistente)) {
        throw new ForbiddenException('Esta operación requiere alcance por carrera aún no integrado.');
      }

      if (context.getClass()?.name === 'CarrerasController') {
        if (request.method === 'POST') {
          throw new ForbiddenException('La creación de carreras está reservada para el administrador global.');
        }
        if (request.params?.id) {
          if (!this.alcanceJerarquico) {
            throw new ForbiddenException('No se pudo verificar el alcance de carreras.');
          }
          const id = Number(request.params.id);
          const autorizadas = await this.alcanceJerarquico.obtenerCarrerasAutorizadas(usuario.sub);
          if (!autorizadas.includes(id)) {
            throw new ForbiddenException('No posee acceso a esta carrera.');
          }
          if (request.method === 'PATCH') {
            const puede = await this.alcanceJerarquico.puedeEjecutar(usuario.sub, PermisoSistema.CARRERAS_GESTIONAR, id);
            if (!puede) {
              throw new ForbiddenException('No posee permiso para modificar esta carrera.');
            }
          }
        }
      }
    }

    if (!requeridos || requeridos.length === 0) return true;
    if (!usuario || !Number.isInteger(usuario.sub) || !rolActivo) {
      throw new ForbiddenException('No posee permisos para realizar esta operacion.');
    }

    // ADMIN_GLOBAL conserva superusuario sólo desde el espacio ADMIN_GLOBAL activo.
    if (rolActivo === RolSistema.ADMIN_GLOBAL) {
      return true;
    }

    const autorizado = await this.permisosService.usuarioTienePermisos(
      usuario.sub,
      requeridos,
      rolActivo,
    );

    if (!autorizado && usuario.jerarquiaConfigurada === true && request.method === 'GET' &&
      ((['CursosController', 'CursoRequisitosController'].includes(context.getClass()?.name) &&
        requeridos.length === 1 && requeridos[0] === PermisoSistema.CURSOS_VER &&
        await this.permisosService.usuarioTienePermisos(usuario.sub, [PermisoSistema.CURSOS_GESTIONAR], rolActivo)) ||
       (context.getClass()?.name.startsWith('Plan') || context.getClass()?.name === 'SalidasAcademicasController') &&
        requeridos.length === 1 && requeridos[0] === PermisoSistema.PLANES_ESTUDIO_VER &&
        await this.permisosService.usuarioTienePermisos(usuario.sub, [PermisoSistema.PLANES_ESTUDIO_GESTIONAR], rolActivo))) {
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
