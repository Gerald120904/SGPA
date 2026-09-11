import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { CargaMasivaPlanRequisitosDto } from './dto/carga-masiva-plan-requisitos.dto';
import { CrearPlanRequisitoDto } from './dto/crear-plan-requisito.dto';
import { PlanRequisitosService } from './plan-requisitos.service';

@Controller('planes-estudio/:planId/requisitos')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanRequisitosController {
  constructor(private readonly planRequisitosService: PlanRequisitosService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.planRequisitosService.listar(planId);
  }

  @Post()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearPlanRequisitoDto,
  ) {
    return this.planRequisitosService.crear(planId, dto);
  }

  @Post('carga-masiva')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cargaMasiva(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CargaMasivaPlanRequisitosDto,
  ) {
    return this.planRequisitosService.cargaMasiva(planId, dto);
  }

  @Delete(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  eliminar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planRequisitosService.eliminar(planId, id);
  }
}
