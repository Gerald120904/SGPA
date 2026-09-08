import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { ActualizarAtestadoProfesorDto } from './dto/actualizar-atestado-profesor.dto';
import { ActualizarCarrerasPerfilDto } from './dto/actualizar-carreras-perfil.dto';
import { ActualizarProyectoProfesorDto } from './dto/actualizar-proyecto-profesor.dto';
import { CambiarEstadoProyectoProfesorDto } from './dto/cambiar-estado-proyecto-profesor.dto';
import { CrearAtestadoProfesorDto } from './dto/crear-atestado-profesor.dto';
import { CrearProyectoProfesorDto } from './dto/crear-proyecto-profesor.dto';
import { FiltroProfesoresDto } from './dto/filtro-profesores.dto';
import { InactivarPerfilProfesorDto } from './dto/inactivar-perfil-profesor.dto';
import { RevisarAtestadoProfesorDto } from './dto/revisar-atestado-profesor.dto';
import { RevisarPerfilProfesorDto } from './dto/revisar-perfil-profesor.dto';
import { SolicitarPerfilProfesorDto } from './dto/solicitar-perfil-profesor.dto';
import { ProfesoresService } from './profesores.service';

@Controller('profesores')
@UseGuards(AuthGuard, RolesGuard)
export class ProfesoresController {
  constructor(private readonly profesoresService: ProfesoresService) {}

  private obtenerUsuarioId(request: Request): number {
    if (!request.user) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    return request.user.sub;
  }

  @Get('mi-perfil')
  @Roles(RolSistema.PROFESOR)
  obtenerMiPerfil(@Req() request: Request) {
    return this.profesoresService.obtenerMiPerfil(
      this.obtenerUsuarioId(request),
    );
  }

  @Put('mi-perfil/carreras')
  @Roles(RolSistema.PROFESOR)
  actualizarCarrerasMiPerfil(
    @Req() request: Request,
    @Body() dto: ActualizarCarrerasPerfilDto,
  ) {
    return this.profesoresService.actualizarCarrerasMiPerfil(
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  // --- Perfiles Académicos (Nuevo Modelo) ---

  @Get('mi-perfil/perfiles')
  @Roles(RolSistema.PROFESOR)
  listarPerfilesMiPerfil(@Req() request: Request) {
    return this.profesoresService.listarPerfilesMiPerfil(
      this.obtenerUsuarioId(request),
    );
  }

  @Post('mi-perfil/perfiles')
  @Roles(RolSistema.PROFESOR)
  solicitarPerfilMiPerfil(
    @Req() request: Request,
    @Body() dto: SolicitarPerfilProfesorDto,
  ) {
    return this.profesoresService.solicitarPerfilMiPerfil(
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  @Patch('mi-perfil/perfiles/:perfilId/inactivar')
  @Roles(RolSistema.PROFESOR)
  inactivarPerfilMiPerfil(
    @Req() request: Request,
    @Param('perfilId', ParseIntPipe) perfilId: number,
    @Body() dto: InactivarPerfilProfesorDto,
  ) {
    const usuarioId = this.obtenerUsuarioId(request);
    return this.profesoresService.inactivarPerfilProfesor(
      usuarioId,
      perfilId,
      usuarioId,
      dto.observacion,
    );
  }

  @Patch(':profesorId/perfiles/:perfilId/revision')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.PERFILES_DOCENTES_VALIDAR)
  revisarPerfilProfesor(
    @Param('profesorId', ParseIntPipe) profesorId: number,
    @Param('perfilId', ParseIntPipe) perfilId: number,
    @Req() request: Request,
    @Body() dto: RevisarPerfilProfesorDto,
  ) {
    return this.profesoresService.revisarPerfilProfesor(
      profesorId,
      perfilId,
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  @Patch(':profesorId/perfiles/:perfilId/inactivar')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  inactivarPerfilProfesor(
    @Param('profesorId', ParseIntPipe) profesorId: number,
    @Param('perfilId', ParseIntPipe) perfilId: number,
    @Req() request: Request,
    @Body() dto: InactivarPerfilProfesorDto,
  ) {
    return this.profesoresService.inactivarPerfilProfesor(
      profesorId,
      perfilId,
      this.obtenerUsuarioId(request),
      dto.observacion,
    );
  }

  // --- Atestados del Profesor ---

  @Get('mi-perfil/atestados')
  @Roles(RolSistema.PROFESOR)
  listarAtestadosMiPerfil(@Req() request: Request) {
    return this.profesoresService.listarAtestadosMiPerfil(
      this.obtenerUsuarioId(request),
    );
  }

  @Post('mi-perfil/atestados')
  @Roles(RolSistema.PROFESOR)
  crearAtestadoMiPerfil(
    @Req() request: Request,
    @Body() dto: CrearAtestadoProfesorDto,
  ) {
    return this.profesoresService.crearAtestadoMiPerfil(
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  @Patch('mi-perfil/atestados/:id')
  @Roles(RolSistema.PROFESOR)
  actualizarAtestadoMiPerfil(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAtestadoProfesorDto,
  ) {
    return this.profesoresService.actualizarAtestadoMiPerfil(
      this.obtenerUsuarioId(request),
      id,
      dto,
    );
  }

  @Patch('mi-perfil/atestados/:id/inactivar')
  @Roles(RolSistema.PROFESOR)
  inactivarAtestadoMiPerfil(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.profesoresService.inactivarAtestadoMiPerfil(
      this.obtenerUsuarioId(request),
      id,
    );
  }

  @Patch(':profesorId/atestados/:atestadoId/revision')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  @UseGuards(PermisosGuard)
  @Permisos(PermisoSistema.ATESTADOS_VALIDAR)
  revisarAtestadoProfesor(
    @Param('profesorId', ParseIntPipe) profesorId: number,
    @Param('atestadoId', ParseIntPipe) atestadoId: number,
    @Req() request: Request,
    @Body() dto: RevisarAtestadoProfesorDto,
  ) {
    return this.profesoresService.revisarAtestadoProfesor(
      profesorId,
      atestadoId,
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  // --- Proyectos / Laboratorios del Profesor ---

  @Get('mi-perfil/proyectos')
  @Roles(RolSistema.PROFESOR)
  listarProyectosMiPerfil(@Req() request: Request) {
    return this.profesoresService.listarProyectosMiPerfil(
      this.obtenerUsuarioId(request),
    );
  }

  @Post('mi-perfil/proyectos')
  @Roles(RolSistema.PROFESOR)
  crearProyectoMiPerfil(
    @Req() request: Request,
    @Body() dto: CrearProyectoProfesorDto,
  ) {
    return this.profesoresService.crearProyectoMiPerfil(
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  @Patch('mi-perfil/proyectos/:id')
  @Roles(RolSistema.PROFESOR)
  actualizarProyectoMiPerfil(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProyectoProfesorDto,
  ) {
    return this.profesoresService.actualizarProyectoMiPerfil(
      this.obtenerUsuarioId(request),
      id,
      dto,
    );
  }

  @Patch('mi-perfil/proyectos/:id/estado')
  @Roles(RolSistema.PROFESOR)
  cambiarEstadoProyectoMiPerfil(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoProyectoProfesorDto,
  ) {
    return this.profesoresService.cambiarEstadoProyectoMiPerfil(
      this.obtenerUsuarioId(request),
      id,
      dto,
    );
  }

  // --- Cursos Habilitados ---

  @Get('mi-perfil/cursos')
  @Roles(RolSistema.PROFESOR)
  listarCursosMiPerfil(@Req() request: Request) {
    return this.profesoresService.listarCursosHabilitadosMiPerfil(
      this.obtenerUsuarioId(request),
    );
  }

  @Get('mi-perfil/historial')
  @Roles(RolSistema.PROFESOR)
  obtenerMiHistorialPerfil(@Req() request: Request) {
    return this.profesoresService.obtenerHistorialPerfil(
      this.obtenerUsuarioId(request),
    );
  }

  @Get(':profesorId/historial-perfil')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  obtenerHistorialPerfil(
    @Param('profesorId', ParseIntPipe) profesorId: number,
  ) {
    return this.profesoresService.obtenerHistorialPerfil(profesorId);
  }

  @Get()
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  listar(@Query() filtros: FiltroProfesoresDto) {
    return this.profesoresService.listar(filtros);
  }

  @Get(':id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.profesoresService.obtenerPorId(id);
  }
}
