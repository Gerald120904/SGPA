import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { BandejaRevisionEstudiantesService } from './bandeja-revision-estudiantes.service';
import { AprobarRevisionMasivaDto } from './dto/aprobar-revision-masiva.dto';
import { FiltrarBandejaRevisionDto } from './dto/filtrar-bandeja-revision.dto';
import { ImportarEstudiantesDto } from './dto/importar-estudiantes.dto';
import { RechazarRevisionMasivaDto } from './dto/rechazar-revision-masiva.dto';

@Controller(['estudiantes/bandeja-revision', 'estudiantes/revision'])
@UseGuards(AuthGuard, PermisosGuard)
export class BandejaRevisionEstudiantesController {
  constructor(private readonly service: BandejaRevisionEstudiantesService) {}

  @Post('lote-excel')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  cargarLoteExcel(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: ImportarEstudiantesDto,
  ) {
    return this.service.cargarLoteExcel(usuarioId, dto);
  }

  @Get(['', 'bandeja'])
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  listarBandeja(
    @UsuarioActualId() usuarioId: number,
    @Query() filtros: FiltrarBandejaRevisionDto,
  ) {
    return this.service.listarBandeja(usuarioId, filtros);
  }

  @Get(':id')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  obtenerDetalle(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.obtenerDetalleRegistro(usuarioId, id);
  }

  @Post(':id/aprobar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  aprobarIndividual(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: { motivo?: string },
  ) {
    return this.service.aprobarIndividual(usuarioId, id, body?.motivo);
  }

  @Post(':id/rechazar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  rechazarIndividual(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivo: string },
  ) {
    return this.service.rechazarIndividual(usuarioId, id, body?.motivo);
  }

  @Post(['aprobar-masivo', 'aprobar'])
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  aprobarMasivo(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: AprobarRevisionMasivaDto,
  ) {
    return this.service.aprobarMasivo(usuarioId, dto);
  }

  @Post(['rechazar-masivo', 'rechazar'])
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  rechazarMasivo(
    @UsuarioActualId() usuarioId: number,
    @Body() dto: RechazarRevisionMasivaDto,
  ) {
    return this.service.rechazarMasivo(usuarioId, dto);
  }

  @Post(['devolver', 'devolver-propuesta'])
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  devolver(
    @UsuarioActualId() usuarioId: number,
    @Body() body: { registroIds: number[]; observacion: string },
  ) {
    return this.service.devolverPropuesta(usuarioId, body.registroIds, body.observacion);
  }
}

