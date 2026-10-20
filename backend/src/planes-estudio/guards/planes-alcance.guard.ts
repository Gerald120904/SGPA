import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlcanceJerarquicoService } from '../../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { PlanEstudio } from '../entities/plan-estudio.entity';

/** Autoriza siempre a partir de la carrera persistida del plan padre. */
@Injectable()
export class PlanesAlcanceGuard implements CanActivate {
  constructor(
    @Optional() @InjectRepository(PlanEstudio) private readonly planes?: Repository<PlanEstudio>,
    @Optional() private readonly alcance?: AlcanceJerarquicoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.user?.jerarquiaConfigurada !== true) return true;
    const usuarioId = Number(request.user?.sub);
    if (!Number.isInteger(usuarioId)) throw new ForbiddenException('Usuario no autenticado.');
    if (!this.alcance || !this.planes) throw new ForbiddenException('El alcance acadÃ©mico no estÃ¡ disponible.');
    const tipo = await this.alcance.tipoCuentaJerarquica(usuarioId);
    if (!tipo) return true;

    const escritura = request.method !== 'GET';
    if (escritura && tipo === 'ASISTENTE_ESTUDIANTIL') {
      throw new ForbiddenException('La escritura del asistente requiere una solicitud aprobada.');
    }

    let carreraId: number | undefined;
    const planId = Number(request.params?.planId ?? request.params?.id);
    if (Number.isInteger(planId) && planId > 0) {
      const plan = await this.planes.findOne({ where: { id: planId }, select: { id: true, carreraId: true } });
      if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
      carreraId = plan.carreraId;
    } else if (escritura && Number.isInteger(Number(request.body?.carreraId))) {
      carreraId = Number(request.body.carreraId);
    } else if (!escritura) {
      return true; // El listado aplica su filtro dentro de la consulta del servicio.
    }

    const permiso = escritura ? PermisoSistema.PLANES_ESTUDIO_GESTIONAR : PermisoSistema.PLANES_ESTUDIO_VER;
    const autorizado = carreraId !== undefined && (
      await this.alcance.puedeEjecutar(usuarioId, permiso, carreraId) ||
      (!escritura && await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carreraId))
    );
    if (!autorizado) throw new ForbiddenException('Plan fuera de las carreras autorizadas.');
    return true;
  }
}
