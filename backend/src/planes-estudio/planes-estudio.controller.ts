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
import { ActualizarPlanEstudioDto } from './dto/actualizar-plan-estudio.dto';
import { CambiarEstadoPlanEstudioDto } from './dto/cambiar-estado-plan-estudio.dto';
import { CrearPlanEstudioDto } from './dto/crear-plan-estudio.dto';
import { PlanesEstudioService } from './planes-estudio.service';

@Controller('planes-estudio')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PlanesEstudioController {
  constructor(private readonly planesEstudioService: PlanesEstudioService) {}

  @Get()
  listar() {
    return this.planesEstudioService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.planesEstudioService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearPlanEstudioDto) {
    return this.planesEstudioService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPlanEstudioDto,
  ) {
    return this.planesEstudioService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanEstudioDto,
  ) {
    return this.planesEstudioService.cambiarEstado(id, dto.activo);
  }
}
