import {
  BadRequestException,
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
import { CrearVersionPlanEstudioDto } from './dto/crear-version-plan-estudio.dto';
import { ActivarVersionPlanEstudioDto } from './dto/activar-version-plan-estudio.dto';

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
    @UsuarioActualId() usuarioId?: number,
  ) {
    return this.planesEstudioService.actualizar(id, dto, usuarioId);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanEstudioDto,
    @UsuarioActualId() usuarioId?: number,
  ) {
    if (dto.estado === undefined && dto.activo === undefined) {
      throw new BadRequestException('Debe indicar el estado o la propiedad activo.');
    }
    if (dto.estado !== undefined && dto.activo !== undefined) {
      const activoEsperado = dto.estado !== 'CERRADO';
      if (dto.activo !== activoEsperado) {
        throw new BadRequestException('El estado y la propiedad activo son contradictorios.');
      }
    }
    return this.planesEstudioService.cambiarEstado(id, dto, usuarioId);
  }

  @Post(':id/versiones')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  crearVersion(@Param('id', ParseIntPipe) id: number, @Body() dto: CrearVersionPlanEstudioDto,
    @UsuarioActualId() usuarioId: number) {
    return this.planesEstudioService.crearVersion(id, dto, usuarioId);
  }

  @Post(':id/versiones/:versionId/activar')
  @Permisos(PermisoSistema.PLANES_ESTUDIO_GESTIONAR)
  activarVersion(@Param('id', ParseIntPipe) id: number, @Param('versionId', ParseIntPipe) versionId: number,
    @Body() dto: ActivarVersionPlanEstudioDto, @UsuarioActualId() usuarioId: number) {
    return this.planesEstudioService.activarVersion(id, versionId, dto.motivo, usuarioId);
  }
}
