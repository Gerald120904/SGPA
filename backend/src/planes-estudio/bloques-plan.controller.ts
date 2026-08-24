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
import { ActualizarBloquePlanDto } from './dto/actualizar-bloque-plan.dto';
import { CambiarEstadoBloquePlanDto } from './dto/cambiar-estado-bloque-plan.dto';
import { CrearBloquePlanDto } from './dto/crear-bloque-plan.dto';
import { BloquesPlanService } from './bloques-plan.service';

@Controller('planes-estudio/:planId/bloques')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class BloquesPlanController {
  constructor(private readonly bloquesPlanService: BloquesPlanService) {}

  @Get()
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.bloquesPlanService.listar(planId);
  }

  @Get(':id')
  obtenerPorId(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bloquesPlanService.obtenerPorId(planId, id);
  }

  @Post()
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearBloquePlanDto,
  ) {
    return this.bloquesPlanService.crear(planId, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarBloquePlanDto,
  ) {
    return this.bloquesPlanService.actualizar(planId, id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoBloquePlanDto,
  ) {
    return this.bloquesPlanService.cambiarEstado(planId, id, dto.activo);
  }
}
