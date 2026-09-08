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
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GuardarReglaOptativaPlanDto } from './dto/guardar-regla-optativa-plan.dto';
import { PlanReglasOptativasService } from './plan-reglas-optativas.service';

@Controller('planes-estudio/:planId/regla-optativas')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanReglasOptativasController {
  constructor(private readonly service: PlanReglasOptativasService) {}

  @Get()
  obtener(
    @Param('planId', ParseIntPipe)
    planId: number,
  ) {
    return this.service.obtener(planId);
  }

  @Put()
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
  async eliminar(
    @Param('planId', ParseIntPipe)
    planId: number,
  ) {
    await this.service.eliminar(planId);
  }
}
