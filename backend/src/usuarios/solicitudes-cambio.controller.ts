import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CrearEstudianteDto } from '../estudiantes/dto/crear-estudiante.dto';
import { ActualizarEstudianteDto } from '../estudiantes/dto/actualizar-estudiante.dto';
import { CambiarEstadoEstudianteDto } from '../estudiantes/dto/cambiar-estado-estudiante.dto';
import { CambiarPlanEstudianteDto } from '../estudiantes/dto/cambiar-plan-estudiante.dto';
import { RegistrarResultadoAcademicoDto } from '../estudiantes/dto/registrar-resultado-academico.dto';
import { ImportarEstudiantesDto } from '../estudiantes/dto/importar-estudiantes.dto';
import { CrearCursoDto } from '../cursos/dto/crear-curso.dto';
import { ActualizarCursoDto } from '../cursos/dto/actualizar-curso.dto';
import { CambiarEstadoCursoDto } from '../cursos/dto/cambiar-estado-curso.dto';
import { CrearCursoRequisitoDto } from '../cursos/dto/crear-curso-requisito.dto';
import { CrearPlanEstudioDto } from '../planes-estudio/dto/crear-plan-estudio.dto';
import { ActualizarPlanEstudioDto } from '../planes-estudio/dto/actualizar-plan-estudio.dto';
import { CambiarEstadoPlanEstudioDto } from '../planes-estudio/dto/cambiar-estado-plan-estudio.dto';
import { CrearPlanAsignaturaDto } from '../planes-estudio/dto/crear-plan-asignatura.dto';
import { ActualizarPlanAsignaturaDto } from '../planes-estudio/dto/actualizar-plan-asignatura.dto';
import { CambiarEstadoPlanAsignaturaDto } from '../planes-estudio/dto/cambiar-estado-plan-asignatura.dto';
import { CargaMasivaPlanAsignaturasDto } from '../planes-estudio/dto/carga-masiva-plan-asignaturas.dto';
import { CrearPlanRequisitoDto } from '../planes-estudio/dto/crear-plan-requisito.dto';
import { CargaMasivaPlanRequisitosDto } from '../planes-estudio/dto/carga-masiva-plan-requisitos.dto';
import { CrearSalidaAcademicaDto } from '../planes-estudio/dto/crear-salida-academica.dto';
import { ActualizarSalidaAcademicaDto } from '../planes-estudio/dto/actualizar-salida-academica.dto';
import { CambiarEstadoSalidaAcademicaDto } from '../planes-estudio/dto/cambiar-estado-salida-academica.dto';
import { ActualizarAsignaturasSalidaDto } from '../planes-estudio/dto/actualizar-asignaturas-salida.dto';
import { GuardarReglaOptativaPlanDto } from '../planes-estudio/dto/guardar-regla-optativa-plan.dto';
import { ValidarImportacionPlanDto } from '../planes-estudio/dto/validar-importacion-plan.dto';
import { CrearOptativaDto } from '../optativas/dto/crear-optativa.dto';
import { ActualizarOptativaDto } from '../optativas/dto/actualizar-optativa.dto';
import { CambiarEstadoOptativaDto } from '../optativas/dto/cambiar-estado-optativa.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
import { SolicitudesCambioService } from './solicitudes-cambio.service';

@Controller('solicitudes-cambio')
@UseGuards(AuthGuard, RolesGuard)
export class SolicitudesCambioController {
  constructor(private readonly solicitudes: SolicitudesCambioService) {}

  @Post('estudiantes')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstudiante(@Req() request: Request, @Body() dto: CrearEstudianteDto) {
    return this.solicitudes.proponerCrearEstudiante(request.user!.sub, dto);
  }

  @Post('estudiantes/:id/actualizar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerActualizacionEstudiante(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstudianteDto) {
    return this.solicitudes.proponerActualizarEstudiante(request.user!.sub, id, dto);
  }

  @Post('estudiantes/:id/estado')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstadoEstudiante(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoEstudianteDto) {
    return this.solicitudes.proponerCambiarEstadoEstudiante(request.user!.sub, id, dto);
  }

  @Post('estudiantes/:id/plan')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerPlanEstudiante(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarPlanEstudianteDto,
  ) {
    return this.solicitudes.proponerCambiarPlanEstudiante(request.user!.sub, id, dto);
  }

  @Post('estudiantes/:id/historial-academico')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerResultadoEstudiante(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarResultadoAcademicoDto,
  ) {
    return this.solicitudes.proponerRegistrarResultadoEstudiante(request.user!.sub, id, dto);
  }

  @Post('estudiantes/importacion')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerImportacionEstudiantes(
    @Req() request: Request,
    @Body() dto: ImportarEstudiantesDto,
  ) {
    return this.solicitudes.proponerImportarEstudiantes(request.user!.sub, dto);
  }

  @Post('cursos')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerCurso(@Req() request: Request, @Body() dto: CrearCursoDto) {
    return this.solicitudes.proponerCrearCurso(request.user!.sub, dto);
  }

  @Post('cursos/:id/actualizar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerActualizacionCurso(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCursoDto) {
    return this.solicitudes.proponerActualizarCurso(request.user!.sub, id, dto);
  }

  @Post('cursos/:id/estado')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstadoCurso(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCursoDto) {
    return this.solicitudes.proponerCambiarEstadoCurso(request.user!.sub, id, dto.activo);
  }

  @Post('cursos/:id/requisitos')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerRequisitoCurso(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearCursoRequisitoDto) {
    return this.solicitudes.proponerAgregarRequisitoCurso(request.user!.sub, id, dto);
  }

  @Post('cursos/:id/requisitos/:relacionId/eliminar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEliminarRequisitoCurso(@Req() request: Request,
    @Param('id', ParseIntPipe) id: number, @Param('relacionId', ParseIntPipe) relacionId: number) {
    return this.solicitudes.proponerEliminarRequisitoCurso(request.user!.sub, id, relacionId);
  }

  @Post('planes-estudio')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerPlan(@Req() request: Request, @Body() dto: CrearPlanEstudioDto) {
    return this.solicitudes.proponerCrearPlan(request.user!.sub, dto);
  }

  @Post('planes-estudio/:id/actualizar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerActualizacionPlan(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPlanEstudioDto) {
    return this.solicitudes.proponerActualizarPlan(request.user!.sub, id, dto);
  }

  @Post('planes-estudio/:id/estado')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstadoPlan(@Req() request: Request, @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPlanEstudioDto) {
    return this.solicitudes.proponerCambiarEstadoPlan(request.user!.sub, id, dto.activo);
  }

  @Post('planes-estudio/:planId/asignaturas')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerAgregarAsignatura(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearPlanAsignaturaDto) {
    return this.solicitudes.proponerAgregarAsignatura(request.user!.sub, planId, dto);
  }

  @Post('planes-estudio/:planId/asignaturas/:id/actualizar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerActualizarAsignatura(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPlanAsignaturaDto) {
    return this.solicitudes.proponerActualizarAsignatura(request.user!.sub, planId, id, dto);
  }

  @Post('planes-estudio/:planId/asignaturas/:id/estado')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstadoAsignatura(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoPlanAsignaturaDto) {
    return this.solicitudes.proponerCambiarEstadoAsignatura(request.user!.sub, planId, id, dto.activo);
  }

  @Post('planes-estudio/:planId/asignaturas/carga-masiva')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerCargaMasivaAsignaturas(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CargaMasivaPlanAsignaturasDto) {
    return this.solicitudes.proponerCargaMasivaAsignaturas(request.user!.sub, planId, dto);
  }

  @Post('planes-estudio/:planId/requisitos')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerAgregarRequisitoPlan(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearPlanRequisitoDto) {
    return this.solicitudes.proponerAgregarRequisitoPlan(request.user!.sub, planId, dto);
  }

  @Post('planes-estudio/:planId/requisitos/:id/eliminar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEliminarRequisitoPlan(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number) {
    return this.solicitudes.proponerEliminarRequisitoPlan(request.user!.sub, planId, id);
  }

  @Post('planes-estudio/:planId/requisitos/carga-masiva')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerCargaMasivaRequisitosPlan(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CargaMasivaPlanRequisitosDto) {
    return this.solicitudes.proponerCargaMasivaRequisitosPlan(request.user!.sub, planId, dto);
  }

  @Post('planes-estudio/:planId/salidas-academicas')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerCrearSalida(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearSalidaAcademicaDto) {
    return this.solicitudes.proponerCrearSalida(request.user!.sub, planId, dto);
  }

  @Post('planes-estudio/:planId/salidas-academicas/:id/actualizar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerActualizarSalida(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarSalidaAcademicaDto) {
    return this.solicitudes.proponerActualizarSalida(request.user!.sub, planId, id, dto);
  }

  @Post('planes-estudio/:planId/salidas-academicas/:id/estado')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstadoSalida(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoSalidaAcademicaDto) {
    return this.solicitudes.proponerCambiarEstadoSalida(request.user!.sub, planId, id, dto.activo);
  }

  @Post('planes-estudio/:planId/salidas-academicas/:id/asignaturas')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerAsignarAsignaturasSalida(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAsignaturasSalidaDto) {
    return this.solicitudes.proponerAsignarAsignaturasSalida(request.user!.sub, planId, id, dto);
  }

  @Put('planes-estudio/:planId/regla-optativas')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerGuardarReglaOptativa(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: GuardarReglaOptativaPlanDto) {
    return this.solicitudes.proponerGuardarReglaOptativa(request.user!.sub, planId, dto);
  }

  @Post('planes-estudio/:planId/regla-optativas/eliminar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEliminarReglaOptativa(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number) {
    return this.solicitudes.proponerEliminarReglaOptativa(request.user!.sub, planId);
  }

  @Post('planes-estudio/:planId/importacion')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerImportarPlan(@Req() request: Request, @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: ValidarImportacionPlanDto) {
    return this.solicitudes.proponerImportarPlan(request.user!.sub, planId, dto);
  }

  @Post('optativas')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerOptativa(@Req() request: Request, @Body() dto: CrearOptativaDto) {
    return this.solicitudes.proponerCrearOptativa(request.user!.sub, dto);
  }

  @Post('optativas/:id/actualizar')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerActualizacionOptativa(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarOptativaDto,
  ) {
    return this.solicitudes.proponerActualizarOptativa(request.user!.sub, id, dto);
  }

  @Post('optativas/:id/estado')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  proponerEstadoOptativa(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoOptativaDto,
  ) {
    return this.solicitudes.proponerCambiarEstadoOptativa(request.user!.sub, id, dto.activo);
  }

  @Get('mis-solicitudes')
  @Roles(RolSistema.ASISTENTE_ESTUDIANTIL)
  listarPropias(@Req() request: Request) {
    return this.solicitudes.listarPropias(request.user!.sub);
  }

  @Get('pendientes')
  @Roles(RolSistema.COORDINADOR)
  listarCoordinador(@Req() request: Request) {
    return this.solicitudes.listarParaCoordinador(request.user!.sub);
  }

  @Post(':id/aprobar')
  @Roles(RolSistema.COORDINADOR)
  aprobar(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.solicitudes.aprobar(request.user!.sub, id);
  }

  @Post(':id/rechazar')
  @Roles(RolSistema.COORDINADOR)
  rechazar(@Req() request: Request, @Param('id', ParseIntPipe) id: number, @Body() dto: RechazarSolicitudDto) {
    return this.solicitudes.rechazar(request.user!.sub, id, dto.motivo);
  }
}
