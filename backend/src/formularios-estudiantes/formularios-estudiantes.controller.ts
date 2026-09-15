import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';

@Controller('formularios-estudiantes')
@UseGuards(AuthGuard, PermisosGuard)
export class FormulariosEstudiantesController {
  constructor(
    private readonly formulariosService: FormulariosEstudiantesService,
    private readonly syncService: FormulariosEstudiantesSyncService,
  ) {}
}
