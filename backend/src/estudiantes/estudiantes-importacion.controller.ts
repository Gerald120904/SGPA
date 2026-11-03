import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ImportarEstudiantesDto } from './dto/importar-estudiantes.dto';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';
import { BandejaRevisionEstudiantesService } from './bandeja-revision-estudiantes.service';

@Controller(['estudiantes/importacion/excel', 'estudiantes/importar'])
@UseGuards(AuthGuard, PermisosGuard)
@Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
export class EstudiantesImportacionController {
  constructor(
    private readonly service: EstudiantesImportacionService,
    private readonly bandejaService: BandejaRevisionEstudiantesService,
  ) {}

  @Post('validar')
  validar(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: ImportarEstudiantesDto,
  ): Promise<Record<string, unknown>> {
    return this.service.validar(usuarioId, dto);
  }

  @Post(['', 'ejecutar'])
  async ejecutar(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: ImportarEstudiantesDto,
  ): Promise<Record<string, unknown>> {
    const lote = await this.bandejaService.cargarLoteExcel(usuarioId, dto);
    return {
      ok: true,
      mensaje:
        'Lote registrado en la bandeja de revisión y staging para aprobación previa.',
      loteId: lote.loteId,
      totalFilas: lote.totalFilas,
      resumen: lote.resumen,
      creados: lote.resumen?.creados || 0,
      actualizados: lote.resumen?.actualizados || 0,
      sinCambios: lote.resumen?.sinCambios || 0,
      errores: lote.resumen?.errores || 0,
      enStaging: true,
    };
  }
}
