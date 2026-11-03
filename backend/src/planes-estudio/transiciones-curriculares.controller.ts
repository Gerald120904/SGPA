import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { TransicionesCurricularesService } from './transiciones-curriculares.service';
import { SimularTransicionDto } from './dto/simular-transicion.dto';
import { EjecutarTransicionDto } from './dto/ejecutar-transicion.dto';

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

  @Post('ejecutar')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  ejecutar(
    @Req() request: Request,
    @Body() dto: EjecutarTransicionDto,
  ) {
    return this.transicionesService.ejecutarTransicion(request.user!.sub, dto);
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
