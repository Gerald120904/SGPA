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
import { AuthGuard } from '../auth/guards/auth.guard';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarCursoDto } from './dto/actualizar-curso.dto';
import { CambiarEstadoCursoDto } from './dto/cambiar-estado-curso.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { ListarAsignaturasDisponiblesDto } from './dto/listar-asignaturas-disponibles.dto';
import { CursosService } from './cursos.service';

@Controller('cursos')
@UseGuards(AuthGuard, PermisosGuard)
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  @Permisos(PermisoSistema.CURSOS_VER)
  listar(@UsuarioActualId() usuarioId: number) {
    return this.cursosService.listar(usuarioId);
  }

  @Get('asignaturas-disponibles')
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  listarAsignaturasDisponibles(
    @UsuarioActualId() usuarioId: number,
    @Query() filtros: ListarAsignaturasDisponiblesDto,
  ) {
    return this.cursosService.listarAsignaturasDisponibles(filtros, usuarioId);
  }

  @Get(':id')
  @Permisos(PermisoSistema.CURSOS_VER)
  obtenerPorId(@UsuarioActualId() usuarioId: number, @Param('id', ParseIntPipe) id: number) {
    return this.cursosService.obtenerPorId(id, usuarioId);
  }

  @Post()
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  crear(@UsuarioActualId() usuarioId: number, @Body() dto: CrearCursoDto) {
    return this.cursosService.crear(dto, usuarioId);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  actualizar(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCursoDto,
  ) {
    return this.cursosService.actualizar(id, dto, usuarioId);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  cambiarEstado(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCursoDto,
  ) {
    return this.cursosService.cambiarEstado(id, dto.activo, usuarioId);
  }
}
