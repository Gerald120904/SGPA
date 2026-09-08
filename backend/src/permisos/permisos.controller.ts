import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarPermisosUsuarioDto } from './dto/actualizar-permisos-usuario.dto';
import { PermisosService } from './permisos.service';

@Controller('permisos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL)
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get('catalogo')
  obtenerCatalogo() {
    return this.permisosService.obtenerCatalogo();
  }

  @Get('usuarios/:usuarioId')
  listarUsuario(@Param('usuarioId', ParseIntPipe) usuarioId: number) {
    return this.permisosService.listarUsuario(usuarioId);
  }

  @Put('usuarios/:usuarioId')
  reemplazarPermisos(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Body() dto: ActualizarPermisosUsuarioDto,
  ) {
    return this.permisosService.reemplazarPermisos(usuarioId, dto.permisos);
  }
}
