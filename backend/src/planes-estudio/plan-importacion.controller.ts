import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ValidarImportacionPlanDto } from './dto/validar-importacion-plan.dto';
import { PlanImportacionService } from './plan-importacion.service';

@Controller('planes-estudio/:planId/importacion')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanImportacionController {
  constructor(private readonly service: PlanImportacionService) {}

  @Post('validar')
  validar(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: ValidarImportacionPlanDto,
  ) {
    return this.service.validar(planId, dto);
  }

  @Post('ejecutar')
  importar(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: ValidarImportacionPlanDto,
  ) {
    return this.service.importar(planId, dto);
  }
}
