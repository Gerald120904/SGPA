import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FiltrarSolicitudesFormulariosDto } from './dto/filtrar-solicitudes-formularios.dto';
import { RechazarRespuestaFormularioDto } from './dto/rechazar-respuesta-formulario.dto';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';

@Controller('formularios-estudiantes')
@UseGuards(AuthGuard, PermisosGuard)
export class FormulariosEstudiantesController {
  constructor(
    private readonly formulariosService: FormulariosEstudiantesService,
    private readonly syncService: FormulariosEstudiantesSyncService,
    private readonly procesamientoService: FormulariosEstudiantesProcesamientoService,
  ) {}

  @Get()
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER)
  listar(@Req() req: Request) {
    return this.formulariosService.listar(req.user!.sub);
  }

  @Get('solicitudes')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  listarSolicitudes(
    @Req() req: Request,
    @Query() filtros: FiltrarSolicitudesFormulariosDto,
  ) {
    return this.procesamientoService.listarSolicitudes(
      req.user!.sub,
      filtros.carreraId,
      filtros.planEstudioId,
    );
  }

  @Get(':id')
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER)
  obtenerPorId(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.formulariosService.obtenerPorId(
      id,
      req.user!.sub,
    );
  }

  @Post()
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_CREAR)
  crear(
    @Req() req: Request,
    @Body() dto: CrearFormularioEstudianteDto,
  ) {
    return this.formulariosService.crear(
      req.user!.sub,
      dto,
    );
  }

  @Post(':id/sincronizar')
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  sincronizar(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.syncService.sincronizar(
      id,
      req.user!.sub,
    );
  }

  @Post(':id/cerrar')
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  cerrar(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.formulariosService.cerrar(
      id,
      req.user!.sub,
    );
  }

  @Get(':id/respuestas')
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS)
  listarRespuestas(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.syncService.listarRespuestas(
      id,
      req.user!.sub,
    );
  }

  @Post('respuestas/:respuestaId/aceptar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  aceptarRespuesta(
    @Req() req: Request,
    @Param('respuestaId', ParseIntPipe)
    respuestaId: number,
  ) {
    return this.procesamientoService.aprobarRespuesta(
      respuestaId,
      req.user!.sub,
    );
  }

  @Post('respuestas/:respuestaId/rechazar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  rechazarRespuesta(
    @Req() req: Request,
    @Param('respuestaId', ParseIntPipe)
    respuestaId: number,
    @Body()
    dto: RechazarRespuestaFormularioDto,
  ) {
    return this.procesamientoService.rechazarRespuesta(
      respuestaId,
      req.user!.sub,
      dto.motivo,
    );
  }
}
