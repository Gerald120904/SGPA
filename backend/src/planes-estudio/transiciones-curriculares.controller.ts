import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { TransicionesCurricularesService } from './transiciones-curriculares.service';
import { SimularTransicionDto } from './dto/simular-transicion.dto';
import { EjecutarTransicionDto } from './dto/ejecutar-transicion.dto';
import { RevertirTransicionDto } from './dto/revertir-transicion.dto';
import { CrearConvalidacionExternaDto } from './dto/crear-convalidacion-externa.dto';
import { DecidirConvalidacionExternaDto } from './dto/decidir-convalidacion-externa.dto';
import { VerificarEvidenciaConvalidacionExternaDto } from './dto/verificar-evidencia-convalidacion-externa.dto';

@Controller('planes-estudio/transiciones')
@UseGuards(AuthGuard, PermisosGuard)
export class TransicionesCurricularesController {
  constructor(
    private readonly transicionesService: TransicionesCurricularesService,
  ) {}

  @Get('poblacion')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  consultarPoblacion(
    @Req() request: Request,
    @Query('planOrigenId', ParseIntPipe) planOrigenId: number,
    @Query('carreraId') carreraId?: string,
  ) {
    const cId = carreraId ? parseInt(carreraId, 10) : undefined;
    return this.transicionesService.consultarPoblacionEstudiantil(
      request.user!.sub,
      planOrigenId,
      cId,
    );
  }

  @Post('simular')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  simular(
    @Req() request: Request,
    @Body() dto: SimularTransicionDto,
  ) {
    return this.transicionesService.simularTransicion(request.user!.sub, dto);
  }

  @Post('convalidaciones-externas')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  solicitarConvalidacionExterna(@Req() request: Request, @Body() dto: CrearConvalidacionExternaDto) {
    return this.transicionesService.solicitarConvalidacionExterna(request.user!.sub, dto);
  }

  @Get('convalidaciones-externas')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listarConvalidacionesExternas(@Req() request: Request, @Query('carreraId') carreraId?: string,
    @Query('estado') estado?: string) {
    const cId = carreraId ? parseInt(carreraId, 10) : undefined;
    return this.transicionesService.listarConvalidacionesExternas(request.user!.sub, cId, estado as any);
  }

  @Get('convalidaciones-externas/:id/auditoria')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  auditarConvalidacionExterna(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.transicionesService.auditarConvalidacionExterna(request.user!.sub, id);
  }

  @Post('convalidaciones-externas/:id/verificar-evidencia')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  verificarEvidenciaConvalidacionExterna(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerificarEvidenciaConvalidacionExternaDto) {
    return this.transicionesService.verificarEvidenciaConvalidacionExterna(request.user!.sub, id, dto);
  }

  @Post('convalidaciones-externas/:id/decision')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  decidirConvalidacionExterna(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecidirConvalidacionExternaDto) {
    return this.transicionesService.decidirConvalidacionExterna(request.user!.sub, id, dto);
  }

  @Post('ejecutar')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  ejecutar(@Req() request: Request, @Body() dto: EjecutarTransicionDto) {
    return this.transicionesService.ejecutarTransicion(request.user!.sub, dto);
  }
  @Post('auditoria/:auditoriaId/revertir')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  revertir(
    @Req() request: Request,
    @Param('auditoriaId', ParseIntPipe) auditoriaId: number,
    @Body() dto: RevertirTransicionDto,
  ) {
    return this.transicionesService.revertirTransicion(request.user!.sub, auditoriaId, dto.motivo);
  }

  @Get('lotes')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listarLotes(
    @Req() request: Request,
    @Query('carreraId') carreraId?: string,
    @Query('planOrigenId') planOrigenId?: string,
    @Query('planDestinoId') planDestinoId?: string,
  ) {
    const cId = carreraId ? parseInt(carreraId, 10) : undefined;
    const origId = planOrigenId ? parseInt(planOrigenId, 10) : undefined;
    const destId = planDestinoId ? parseInt(planDestinoId, 10) : undefined;
    return this.transicionesService.listarLotesAuditoria(
      request.user!.sub,
      cId,
      origId,
      destId,
    );
  }
}
