import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { EquivalenciasService } from './equivalencias.service';
import { CrearEquivalenciaPlanDto } from './dto/crear-equivalencia-plan.dto';
import { AplicarEquivalenciasEstudianteDto } from './dto/aplicar-equivalencias-estudiante.dto';

@Controller('planes-estudio/equivalencias')
@UseGuards(AuthGuard, PermisosGuard)
export class EquivalenciasController {
  constructor(private readonly service: EquivalenciasService) {}

  @Post()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crear(@Req() request: Request, @Body() dto: CrearEquivalenciaPlanDto) {
    return this.service.crear(request.user!.sub, dto);
  }

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listarPorPlanes(
    @Query('planOrigenId', ParseIntPipe) planOrigenId: number,
    @Query('planDestinoId', ParseIntPipe) planDestinoId: number,
  ) {
    return this.service.listarPorPlanes(planOrigenId, planDestinoId);
  }

  @Get('sugerencias/:estudianteId')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  sugerir(
    @Req() request: Request,
    @Param('estudianteId', ParseIntPipe) estudianteId: number,
    @Query('planNuevoId', ParseIntPipe) planNuevoId: number,
  ) {
    return this.service.sugerirEquivalenciasParaEstudiante(request.user!.sub, estudianteId, planNuevoId);
  }

  @Post('aplicar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  aplicar(@Req() request: Request, @Body() dto: AplicarEquivalenciasEstudianteDto) {
    return this.service.aplicarEquivalenciasEstudiante(request.user!.sub, dto);
  }
}
