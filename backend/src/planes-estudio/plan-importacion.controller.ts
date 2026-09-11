import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ValidarImportacionPlanDto } from './dto/validar-importacion-plan.dto';
import { PlanImportacionService } from './plan-importacion.service';

@Controller('planes-estudio/:planId/importacion')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanImportacionController {
  constructor(private readonly service: PlanImportacionService) {}

  @Post('validar')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  validar(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: ValidarImportacionPlanDto,
  ) {
    return this.service.validar(planId, dto);
  }

  @Post('ejecutar')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  importar(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: ValidarImportacionPlanDto,
  ) {
    return this.service.importar(planId, dto);
  }
}
