import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PlanResumenService } from './plan-resumen.service';

@Controller('planes-estudio/:planId/resumen')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanResumenController {
  constructor(private readonly service: PlanResumenService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  obtener(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.obtener(planId);
  }
}
