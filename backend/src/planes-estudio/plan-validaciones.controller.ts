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
import { PlanValidacionesService } from './plan-validaciones.service';

@Controller('planes-estudio/:planId/validaciones')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanValidacionesController {
  constructor(private readonly service: PlanValidacionesService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  validar(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.validar(planId);
  }
}
