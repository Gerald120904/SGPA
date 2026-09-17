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
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarEstudianteDto } from './dto/actualizar-estudiante.dto';
import { CambiarEstadoEstudianteDto } from './dto/cambiar-estado-estudiante.dto';
import { CambiarPlanEstudianteDto } from './dto/cambiar-plan-estudiante.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { ConsultarProgresoEstudianteDto } from './dto/consultar-progreso-estudiante.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarResultadoAcademicoDto } from './dto/registrar-resultado-academico.dto';
import { EstudiantesService } from './estudiantes.service';

@Controller('estudiantes')
@UseGuards(AuthGuard, PermisosGuard)
export class EstudiantesController {
  constructor(private readonly estudiantesService: EstudiantesService) {}

  @Get()
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  listar(
    @UsuarioActualId() usuarioId: number,
    @Query() filtros: FiltrarEstudiantesDto,
  ) {
    return this.estudiantesService.listar(usuarioId, filtros);
  }

  @Get('conteos/carreras')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  contarPorCarrera(@UsuarioActualId() usuarioId: number) {
    return this.estudiantesService.contarPorCarrera(usuarioId);
  }

  @Get('conteos/planes')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  contarPorPlan(
    @UsuarioActualId() usuarioId: number,
    @Query('carreraId', ParseIntPipe) carreraId: number,
  ) {
    return this.estudiantesService.contarPorPlan(usuarioId, carreraId);
  }

  @Get(':id')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  obtenerPorId(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estudiantesService.obtenerPorId(usuarioId, id);
  }

  @Post()
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  crear(@UsuarioActualId() usuarioId: number, @Body() dto: CrearEstudianteDto) {
    return this.estudiantesService.crear(usuarioId, dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  actualizar(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstudianteDto,
  ) {
    return this.estudiantesService.actualizar(usuarioId, id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  cambiarEstado(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoEstudianteDto,
  ) {
    return this.estudiantesService.cambiarEstado(usuarioId, id, dto.estado);
  }

  @Get(':id/historial-academico')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  listarHistorialAcademico(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estudiantesService.listarHistorialAcademico(usuarioId, id);
  }

  @Post(':id/historial-academico')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  registrarResultado(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarResultadoAcademicoDto,
  ) {
    return this.estudiantesService.registrarResultado(usuarioId, id, dto);
  }

  @Get(':id/historial-planes')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  listarHistorialPlanes(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estudiantesService.listarHistorialPlanes(usuarioId, id);
  }

  @Patch(':id/plan')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  cambiarPlan(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarPlanEstudianteDto,
  ) {
    return this.estudiantesService.cambiarPlan(usuarioId, id, dto);
  }

  @Get(':id/progreso')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  obtenerProgreso(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() consulta: ConsultarProgresoEstudianteDto,
  ) {
    return this.estudiantesService.obtenerProgreso(
      usuarioId,
      id,
      consulta.periodoReferenciaId,
    );
  }
}
