import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ImportarEstudiantesDto } from './dto/importar-estudiantes.dto';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';

@Controller('estudiantes/importacion/excel')
@UseGuards(AuthGuard, PermisosGuard)
@Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
export class EstudiantesImportacionController {
  constructor(private readonly service: EstudiantesImportacionService) {}

  @Post('validar')
  validar(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: ImportarEstudiantesDto,
  ): Promise<Record<string, unknown>> {
    return this.service.validar(usuarioId, dto);
  }

  @Post('ejecutar')
  ejecutar(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: ImportarEstudiantesDto,
  ): Promise<Record<string, unknown>> {
    return this.service.ejecutar(usuarioId, dto);
  }
}
