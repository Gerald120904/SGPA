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
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CargaMasivaPlanRequisitosDto } from './dto/carga-masiva-plan-requisitos.dto';
import { CrearPlanRequisitoDto } from './dto/crear-plan-requisito.dto';
import { PlanRequisitosService } from './plan-requisitos.service';

@Controller('planes-estudio/:planId/requisitos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanRequisitosController {
  constructor(private readonly planRequisitosService: PlanRequisitosService) {}

  @Get()
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.planRequisitosService.listar(planId);
  }

  @Post()
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearPlanRequisitoDto,
  ) {
    return this.planRequisitosService.crear(planId, dto);
  }

  @Post('carga-masiva')
  cargaMasiva(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CargaMasivaPlanRequisitosDto,
  ) {
    return this.planRequisitosService.cargaMasiva(planId, dto);
  }

  @Delete(':id')
  eliminar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planRequisitosService.eliminar(planId, id);
  }
}
