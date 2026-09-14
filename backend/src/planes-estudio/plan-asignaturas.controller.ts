import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarPlanAsignaturaDto } from './dto/actualizar-plan-asignatura.dto';
import { CambiarEstadoPlanAsignaturaDto } from './dto/cambiar-estado-plan-asignatura.dto';
import { CargaMasivaPlanAsignaturasDto } from './dto/carga-masiva-plan-asignaturas.dto';
import { CrearPlanAsignaturaDto } from './dto/crear-plan-asignatura.dto';
import { PlanAsignaturasService } from './plan-asignaturas.service';

@Controller('planes-estudio/:planId/asignaturas')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanAsignaturasController {
  constructor(
    private readonly planAsignaturasService: PlanAsignaturasService,
  ) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.planAsignaturasService.listar(planId);
  }

  @Post('carga-masiva')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cargaMasiva(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CargaMasivaPlanAsignaturasDto,
  ) {
    return this.planAsignaturasService.cargaMasiva(planId, dto);
  }

  @Get(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  obtenerPorId(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planAsignaturasService.obtenerPorId(planId, id);
  }

  @Post()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearPlanAsignaturaDto,
  ) {
    return this.planAsignaturasService.crear(planId, dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  actualizar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPlanAsignaturaDto,
  ) {
    return this.planAsignaturasService.actualizar(planId, id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cambiarEstado(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanAsignaturaDto,
  ) {
    return this.planAsignaturasService.cambiarEstado(planId, id, dto.activo);
  }
}
