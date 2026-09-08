import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarPerfilAcademicoDto } from './dto/actualizar-perfil-academico.dto';
import { CambiarEstadoPerfilAcademicoDto } from './dto/cambiar-estado-perfil-academico.dto';
import { CrearPerfilAcademicoDto } from './dto/crear-perfil-academico.dto';
import { FiltrarPerfilesAcademicosDto } from './dto/filtrar-perfiles-academicos.dto';
import { PerfilesAcademicosService } from './perfiles-academicos.service';

@Controller('perfiles-academicos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PerfilesAcademicosController {
  constructor(private readonly service: PerfilesAcademicosService) {}

  private obtenerUsuario(request: Request): {
    sub: number;
    esAdminGlobal: boolean;
  } {
    const user = request.user;
    if (!user || typeof user.sub !== 'number') {
      throw new UnauthorizedException('Usuario no autenticado.');
    }
    const esAdminGlobal =
      Array.isArray(user.roles) && user.roles.includes(RolSistema.ADMIN_GLOBAL);
    return { sub: user.sub, esAdminGlobal };
  }

  @Get()
  listar(@Query() filtros: FiltrarPerfilesAcademicosDto) {
    return this.service.listar(filtros);
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerPorId(id);
  }

  @Post()
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.PERFILES_ACADEMICOS_GESTIONAR)
  crear(@Req() request: Request, @Body() dto: CrearPerfilAcademicoDto) {
    const { sub, esAdminGlobal } = this.obtenerUsuario(request);
    return this.service.crear(dto, sub, esAdminGlobal);
  }

  @Patch(':id')
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.PERFILES_ACADEMICOS_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @Body() dto: ActualizarPerfilAcademicoDto,
  ) {
    const { sub, esAdminGlobal } = this.obtenerUsuario(request);
    return this.service.actualizar(id, dto, sub, esAdminGlobal);
  }

  @Patch(':id/estado')
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.PERFILES_ACADEMICOS_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @Body() dto: CambiarEstadoPerfilAcademicoDto,
  ) {
    const { sub, esAdminGlobal } = this.obtenerUsuario(request);
    return this.service.cambiarEstado(id, dto.activo, sub, esAdminGlobal);
  }

  @Get(':perfilId/cursos')
  listarCursosPorPerfil(@Param('perfilId', ParseIntPipe) perfilId: number) {
    return this.service.listarCursosPorPerfil(perfilId);
  }

  @Post(':perfilId/cursos/:cursoId')
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.PERFILES_ACADEMICOS_GESTIONAR)
  asociarCurso(
    @Param('perfilId', ParseIntPipe) perfilId: number,
    @Param('cursoId', ParseIntPipe) cursoId: number,
    @Req() request: Request,
  ) {
    const { sub, esAdminGlobal } = this.obtenerUsuario(request);
    return this.service.asociarCurso(perfilId, cursoId, sub, esAdminGlobal);
  }

  @Delete(':perfilId/cursos/:cursoId')
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.PERFILES_ACADEMICOS_GESTIONAR)
  @HttpCode(204)
  async desasociarCurso(
    @Param('perfilId', ParseIntPipe) perfilId: number,
    @Param('cursoId', ParseIntPipe) cursoId: number,
    @Req() request: Request,
  ) {
    const { sub, esAdminGlobal } = this.obtenerUsuario(request);
    await this.service.desasociarCurso(perfilId, cursoId, sub, esAdminGlobal);
  }
}
