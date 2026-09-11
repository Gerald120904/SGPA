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
import { ActualizarPlanEstudioDto } from './dto/actualizar-plan-estudio.dto';
import { CambiarEstadoPlanEstudioDto } from './dto/cambiar-estado-plan-estudio.dto';
import { CrearPlanEstudioDto } from './dto/crear-plan-estudio.dto';
import { PlanesEstudioService } from './planes-estudio.service';

@Controller('planes-estudio')
@UseGuards(AuthGuard, PermisosGuard)
export class PlanesEstudioController {
  constructor(private readonly planesEstudioService: PlanesEstudioService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listar() {
    return this.planesEstudioService.listar();
  }

  @Get(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.planesEstudioService.obtenerPorId(id);
  }

  @Post()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crear(@Body() dto: CrearPlanEstudioDto) {
    return this.planesEstudioService.crear(dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPlanEstudioDto,
  ) {
    return this.planesEstudioService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanEstudioDto,
  ) {
    return this.planesEstudioService.cambiarEstado(id, dto.activo);
  }
}
