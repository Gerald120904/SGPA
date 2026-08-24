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
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarPlanAsignaturaDto } from './dto/actualizar-plan-asignatura.dto';
import { CambiarEstadoPlanAsignaturaDto } from './dto/cambiar-estado-plan-asignatura.dto';
import { CargaMasivaPlanAsignaturasDto } from './dto/carga-masiva-plan-asignaturas.dto';
import { CrearPlanAsignaturaDto } from './dto/crear-plan-asignatura.dto';
import { PlanAsignaturasService } from './plan-asignaturas.service';

@Controller('planes-estudio/:planId/asignaturas')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanAsignaturasController {
  constructor(
    private readonly planAsignaturasService: PlanAsignaturasService,
  ) {}

  @Get()
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.planAsignaturasService.listar(planId);
  }

  @Post('carga-masiva')
  cargaMasiva(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CargaMasivaPlanAsignaturasDto,
  ) {
    return this.planAsignaturasService.cargaMasiva(planId, dto);
  }

  @Get(':id')
  obtenerPorId(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planAsignaturasService.obtenerPorId(planId, id);
  }

  @Post()
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearPlanAsignaturaDto,
  ) {
    return this.planAsignaturasService.crear(planId, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPlanAsignaturaDto,
  ) {
    return this.planAsignaturasService.actualizar(planId, id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanAsignaturaDto,
  ) {
    return this.planAsignaturasService.cambiarEstado(planId, id, dto.activo);
  }
}
