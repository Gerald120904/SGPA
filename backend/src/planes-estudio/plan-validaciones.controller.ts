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
import { PlanValidacionesService } from './plan-validaciones.service';
@Controller('planes-estudio/:planId/validaciones')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanValidacionesController {
  constructor(private readonly service: PlanValidacionesService) {}
  @Get() validar(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.validar(planId);
  }
}
