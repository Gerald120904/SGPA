import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActualId } from '../../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { Permisos } from '../../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { EstadoImportacionGoogle } from './constants/estado-importacion-google.constant';
import { ActualizarConfiguracionFormularioDto } from './dto/actualizar-configuracion-formulario.dto';
import { CrearConfiguracionFormularioDto } from './dto/crear-configuracion-formulario.dto';
import { SincronizarGoogleFormsSimuladoDto } from './dto/sincronizar-google-forms.dto';
import { GoogleFormsSyncService } from './google-forms-sync.service';
import { GoogleFormsService } from './google-forms.service';

@Controller('estudiantes/importacion/google-forms')
@UseGuards(AuthGuard, PermisosGuard)
@Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
export class GoogleFormsController {
  constructor(
    private readonly googleFormsService: GoogleFormsService,
    private readonly googleFormsSyncService: GoogleFormsSyncService,
  ) {}

  @Post('configuraciones')
  crearConfiguracion(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: CrearConfiguracionFormularioDto,
  ) {
    return this.googleFormsService.crearConfiguracion(usuarioId, dto);
  }

  @Get('configuraciones')
  listarConfiguraciones(
    @UsuarioActualId() usuarioId: number,
    @Query('carreraId') carreraId?: string,
    @Query('activo') activo?: string,
  ) {
    return this.googleFormsService.listarConfiguraciones(usuarioId, {
      carreraId: carreraId ? Number(carreraId) : undefined,
      activo: activo !== undefined ? activo === 'true' : undefined,
    });
  }

  @Get('configuraciones/:id')
  obtenerConfiguracion(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.googleFormsService.obtenerConfiguracionPorId(usuarioId, id);
  }

  @Patch('configuraciones/:id')
  actualizarConfiguracion(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarConfiguracionFormularioDto,
  ) {
    return this.googleFormsService.actualizarConfiguracion(usuarioId, id, dto);
  }

  @Patch('configuraciones/:id/estado')
  cambiarEstado(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('activo') activo: boolean,
  ) {
    return this.googleFormsService.cambiarEstado(usuarioId, id, Boolean(activo));
  }

  @Get('configuraciones/:id/respuestas')
  listarRespuestas(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado?: EstadoImportacionGoogle,
  ) {
    return this.googleFormsService.listarRespuestas(
      usuarioId,
      id,
      estado,
    );
  }

  @Post('configuraciones/:id/sincronizar-simulado')
  sincronizarSimulado(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SincronizarGoogleFormsSimuladoDto,
  ) {
    return this.googleFormsSyncService.sincronizarRespuestasCrudas(
      usuarioId,
      id,
      dto.respuestas,
    );
  }
}
