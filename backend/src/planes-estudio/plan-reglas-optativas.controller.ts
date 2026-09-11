import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { GuardarReglaOptativaPlanDto } from './dto/guardar-regla-optativa-plan.dto';
import { PlanReglasOptativasService } from './plan-reglas-optativas.service';

@Controller('planes-estudio/:planId/regla-optativas')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanReglasOptativasController {
  constructor(private readonly service: PlanReglasOptativasService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  obtener(
    @Param('planId', ParseIntPipe)
    planId: number,
  ) {
    return this.service.obtener(planId);
  }

  @Put()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  guardar(
    @Param('planId', ParseIntPipe)
    planId: number,
    @Body()
    dto: GuardarReglaOptativaPlanDto,
  ) {
    return this.service.guardar(planId, dto);
  }

  @Delete()
  @HttpCode(204)
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  async eliminar(
    @Param('planId', ParseIntPipe)
    planId: number,
  ) {
    await this.service.eliminar(planId);
  }
}
