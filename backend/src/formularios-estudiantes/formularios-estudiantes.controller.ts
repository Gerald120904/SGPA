import {
  Body,
  Controller,
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
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';

@Controller('formularios-estudiantes')
@UseGuards(AuthGuard, PermisosGuard)
export class FormulariosEstudiantesController {
  constructor(
    private readonly formulariosService: FormulariosEstudiantesService,
    private readonly syncService: FormulariosEstudiantesSyncService,
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
}
