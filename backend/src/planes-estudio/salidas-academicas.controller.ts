import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarAsignaturasSalidaDto } from './dto/actualizar-asignaturas-salida.dto';
import { ActualizarSalidaAcademicaDto } from './dto/actualizar-salida-academica.dto';
import { CambiarEstadoSalidaAcademicaDto } from './dto/cambiar-estado-salida-academica.dto';
import { CrearSalidaAcademicaDto } from './dto/crear-salida-academica.dto';
import { SalidasAcademicasService } from './salidas-academicas.service';

@Controller('planes-estudio/:planId/salidas-academicas')
@UseGuards(AuthGuard, PermisosGuard)
export class SalidasAcademicasController {
  constructor(private readonly service: SalidasAcademicasService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.listar(planId);
  }

  @Get(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  obtener(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.obtenerPorId(planId, id);
  }

  @Post()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearSalidaAcademicaDto,
  ) {
    return this.service.crear(planId, dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  actualizar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarSalidaAcademicaDto,
  ) {
    return this.service.actualizar(planId, id, dto);
  }

  @Put(':id/asignaturas')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  reemplazarAsignaturas(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAsignaturasSalidaDto,
  ) {
    return this.service.reemplazarAsignaturas(planId, id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cambiarEstado(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoSalidaAcademicaDto,
  ) {
    return this.service.cambiarEstado(planId, id, dto.activo);
  }
}
