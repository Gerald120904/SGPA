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
import { CorregirResultadoAcademicoDto } from './dto/corregir-resultado-academico.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { ConsultarProgresoEstudianteDto } from './dto/consultar-progreso-estudiante.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarResultadoAcademicoDto } from './dto/registrar-resultado-academico.dto';
import { ReingresarEstudianteDto } from './dto/reingresar-estudiante.dto';
import { EstudiantesService } from './estudiantes.service';
import { EntregarTituloDto } from './dto/entregar-titulo.dto';

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

  @Get(':id/reingreso/diagnostico')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  diagnosticarReingreso(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estudiantesService.diagnosticarReingreso(usuarioId, id);
  }

  @Post(':id/reingresar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  reingresar(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: ReingresarEstudianteDto,
  ) {
    return this.estudiantesService.reingresar(usuarioId, id, dto);
  }

  @Get(':id/comparar-planes')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  compararPlanes(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('planNuevoId', ParseIntPipe) planNuevoId: number,
  ) {
    return this.estudiantesService.compararPlanes(usuarioId, id, planNuevoId);
  }

  @Get(':id/evaluacion-graduacion')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  evaluarGraduacion(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('salidaAcademicaId') salidaAcademicaId?: string,
  ) {
    const salidaId = salidaAcademicaId ? Number(salidaAcademicaId) : undefined;
    return this.estudiantesService.evaluarGraduacion(usuarioId, id, salidaId);
  }

  @Post(':id/confirmar-graduacion')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  confirmarGraduacion(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: { observacion?: string; salidaAcademicaId?: number },
  ) {
    return this.estudiantesService.graduarEstudiante(usuarioId, id, dto?.observacion, dto?.salidaAcademicaId);
  }

  @Post(':id/graduar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  graduar(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: { observacion?: string; salidaAcademicaId?: number },
  ) {
    return this.estudiantesService.graduarEstudiante(usuarioId, id, dto?.observacion, dto?.salidaAcademicaId);
  }

  @Get(':id/titulaciones')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  obtenerTitulaciones(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estudiantesService.obtenerTitulaciones(usuarioId, id);
  }

  @Post(':id/titulaciones/:tituloId/entregar')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  entregarTitulo(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('tituloId', ParseIntPipe) tituloId: number,
    @Body() dto: EntregarTituloDto,
  ) {
    return this.estudiantesService.entregarTitulo(usuarioId, id, tituloId, dto.motivo);
  }

  @Patch(':id/historial-academico/:historialId/corregir')
  @Permisos(PermisoSistema.ESTUDIANTES_GESTIONAR)
  corregirResultado(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('historialId', ParseIntPipe) historialId: number,
    @Body() dto: CorregirResultadoAcademicoDto,
  ) {
    return this.estudiantesService.corregirResultado(usuarioId, id, historialId, dto);
  }

  @Get(':id/historial-academico/correcciones')
  @Permisos(PermisoSistema.ESTUDIANTES_VER)
  listarCorreccionesHistorial(
    @UsuarioActualId() usuarioId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estudiantesService.listarCorreccionesHistorial(usuarioId, id);
  }

}
