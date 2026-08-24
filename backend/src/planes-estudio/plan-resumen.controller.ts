import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlanResumenService } from './plan-resumen.service';

@Controller('planes-estudio/:planId/resumen')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanResumenController {
  constructor(private readonly service: PlanResumenService) {}

  @Get()
  obtener(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.obtener(planId);
  }
}
