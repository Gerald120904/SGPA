import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
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

  @Post(':id/procesar')
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  procesar(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.procesamientoService.procesar(
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
}
