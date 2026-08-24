import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { AsignarRolDto } from './dto/asignar-rol.dto';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar() {
    return this.usuariosService.listar();
  }

  @Get(':id')
  obtenerPorId(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.usuariosService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    dto: ActualizarUsuarioDto,
  ) {
    return this.usuariosService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    dto: CambiarEstadoUsuarioDto,
    @Req()
    request: Request,
  ) {
    return this.usuariosService.cambiarEstado(
      id,
      dto.activo,
      request.user!.sub,
    );
  }

  @Post(':id/roles')
  asignarRol(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    dto: AsignarRolDto,
  ) {
    return this.usuariosService.asignarRol(id, dto.rol);
  }

  @Delete(':id/roles/:rolId')
  revocarRol(
    @Param('id', ParseIntPipe)
    id: number,
    @Param('rolId', ParseIntPipe)
    rolId: number,
    @Req()
    request: Request,
  ) {
    return this.usuariosService.revocarRol(
      id,
      rolId,
      request.user!.sub,
    );
  }
}
