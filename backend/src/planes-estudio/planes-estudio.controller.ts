import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PlanesEstudioService } from './planes-estudio.service';
import { CrearPlanEstudioDto } from './dto/crear-plan-estudio.dto';
import { ActualizarPlanEstudioDto } from './dto/actualizar-plan-estudio.dto';
import { CambiarEstadoPlanEstudioDto } from './dto/cambiar-estado-plan-estudio.dto';
import { PlanesAlcanceGuard } from './guards/planes-alcance.guard';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';

@Controller('planes-estudio')
@UseGuards(AuthGuard, PermisosGuard, PlanesAlcanceGuard)
export class PlanesEstudioController {
  constructor(private readonly planesEstudioService: PlanesEstudioService) {}

  @Get()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  listar(@UsuarioActualId() usuarioId: number) {
    return this.planesEstudioService.listar(usuarioId);
  }

  @Get(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_VER)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.planesEstudioService.obtenerPorId(id);
  }

  @Post()
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crear(@Body() dto: CrearPlanEstudioDto) {
    return this.planesEstudioService.crear(dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPlanEstudioDto,
  ) {
    return this.planesEstudioService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanEstudioDto,
    @UsuarioActualId() usuarioId?: number,
  ) {
    if (dto.estado !== undefined || dto.motivo !== undefined) {
      return this.planesEstudioService.cambiarEstado(id, dto, usuarioId);
    }
    return this.planesEstudioService.cambiarEstado(id, dto.activo!);
  }
}
