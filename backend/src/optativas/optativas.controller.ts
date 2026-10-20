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
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarOptativaDto } from './dto/actualizar-optativa.dto';
import { CambiarEstadoOptativaDto } from './dto/cambiar-estado-optativa.dto';
import { CrearOptativaDto } from './dto/crear-optativa.dto';
import { OptativasService } from './optativas.service';

@Controller('optativas')
@UseGuards(AuthGuard, PermisosGuard)
export class OptativasController {
  constructor(private readonly service: OptativasService) {}

  @Get()
  @Permisos(PermisoSistema.OPTATIVAS_VER)
  listar(@UsuarioActualId() usuarioId?: number) {
    return this.service.listar(usuarioId);
  }

  @Get(':id')
  @Permisos(PermisoSistema.OPTATIVAS_VER)
  obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActualId() usuarioId?: number,
  ) {
    return this.service.obtenerPorId(id, usuarioId);
  }

  @Post()
  @Permisos(PermisoSistema.OPTATIVAS_GESTIONAR)
  crear(
    @Body() dto: CrearOptativaDto,
    @UsuarioActualId() usuarioId?: number,
  ) {
    return this.service.crear(dto, usuarioId);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.OPTATIVAS_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarOptativaDto,
    @UsuarioActualId() usuarioId?: number,
  ) {
    return this.service.actualizar(id, dto, usuarioId);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.OPTATIVAS_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoOptativaDto,
    @UsuarioActualId() usuarioId?: number,
  ) {
    return this.service.cambiarEstado(id, dto.activo, usuarioId);
  }
}
