import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { EstudiantesService } from '../estudiantes/estudiantes.service';
import { CrearEstudianteDto } from '../estudiantes/dto/crear-estudiante.dto';
import { ActualizarEstudianteDto } from '../estudiantes/dto/actualizar-estudiante.dto';
import { CambiarEstadoEstudianteDto } from '../estudiantes/dto/cambiar-estado-estudiante.dto';
import { EstadoEstudiante } from '../estudiantes/constants/estado-estudiante.constant';
import { CursosService } from '../cursos/cursos.service';
import { CrearCursoDto } from '../cursos/dto/crear-curso.dto';
import { ActualizarCursoDto } from '../cursos/dto/actualizar-curso.dto';
import { CursoRequisitosService } from '../cursos/curso-requisitos.service';
import { CrearCursoRequisitoDto } from '../cursos/dto/crear-curso-requisito.dto';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { PlanesEstudioService } from '../planes-estudio/planes-estudio.service';
import { PlanAsignaturasService } from '../planes-estudio/plan-asignaturas.service';
import { PlanRequisitosService } from '../planes-estudio/plan-requisitos.service';
import { SalidasAcademicasService } from '../planes-estudio/salidas-academicas.service';
import { PlanReglasOptativasService } from '../planes-estudio/plan-reglas-optativas.service';
import { PlanImportacionService } from '../planes-estudio/plan-importacion.service';
import { OptativasService } from '../optativas/optativas.service';
import { CrearOptativaDto } from '../optativas/dto/crear-optativa.dto';
import { ActualizarOptativaDto } from '../optativas/dto/actualizar-optativa.dto';
import { CrearPlanEstudioDto } from '../planes-estudio/dto/crear-plan-estudio.dto';
import { ActualizarPlanEstudioDto } from '../planes-estudio/dto/actualizar-plan-estudio.dto';
import { CrearPlanAsignaturaDto } from '../planes-estudio/dto/crear-plan-asignatura.dto';
import { ActualizarPlanAsignaturaDto } from '../planes-estudio/dto/actualizar-plan-asignatura.dto';
import { CargaMasivaPlanAsignaturasDto } from '../planes-estudio/dto/carga-masiva-plan-asignaturas.dto';
import { CrearPlanRequisitoDto } from '../planes-estudio/dto/crear-plan-requisito.dto';
import { CargaMasivaPlanRequisitosDto } from '../planes-estudio/dto/carga-masiva-plan-requisitos.dto';
import { CrearSalidaAcademicaDto } from '../planes-estudio/dto/crear-salida-academica.dto';
import { ActualizarSalidaAcademicaDto } from '../planes-estudio/dto/actualizar-salida-academica.dto';
import { ActualizarAsignaturasSalidaDto } from '../planes-estudio/dto/actualizar-asignaturas-salida.dto';
import { GuardarReglaOptativaPlanDto } from '../planes-estudio/dto/guardar-regla-optativa-plan.dto';
import { ValidarImportacionPlanDto } from '../planes-estudio/dto/validar-importacion-plan.dto';
import { CambiarPlanEstudianteDto } from '../estudiantes/dto/cambiar-plan-estudiante.dto';
import { RegistrarResultadoAcademicoDto } from '../estudiantes/dto/registrar-resultado-academico.dto';
import { ImportarEstudiantesDto } from '../estudiantes/dto/importar-estudiantes.dto';
import { EstudiantesImportacionService } from '../estudiantes/estudiantes-importacion.service';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class SolicitudesCambioService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SolicitudCambio) private readonly solicitudes: Repository<SolicitudCambio>,
    @InjectRepository(DependenciaUsuario) private readonly dependencias: Repository<DependenciaUsuario>,
    private readonly alcance: AlcanceJerarquicoService,
    private readonly estudiantes: EstudiantesService,
    private readonly cursos: CursosService,
    private readonly requisitosCursos: CursoRequisitosService,
    private readonly planes: PlanesEstudioService,
    private readonly planAsignaturas: PlanAsignaturasService,
    private readonly planRequisitos: PlanRequisitosService,
    private readonly salidasAcademicas: SalidasAcademicasService,
    private readonly planReglasOptativas: PlanReglasOptativasService,
    private readonly planImportacion: PlanImportacionService,
    @Optional()
    private readonly optativas?: OptativasService,
    @Optional()
    private readonly estudiantesImportacion?: EstudiantesImportacionService,
  ) {}

  private async registrarPropuestaPlan(solicitanteId: number, carreraId: number, operacion: string,
    datosPropuestos: Record<string, unknown>, objetivoId: number | null, huellaOriginal: string | null) {
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia) throw new ForbiddenException('Asistente sin coordinador responsable.');
    await this.planes.validarDelegacionCompleta(dependencia.coordinadorId, solicitanteId, carreraId);
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({ solicitanteId,
        coordinadorId: dependencia.coordinadorId, carreraId, modulo: 'PLANES_ESTUDIO', operacion, objetivoId,
        datosPropuestos, huellaOriginal, estado: 'PENDIENTE', correlacionId: randomUUID(), resultadoAplicado: null });
      await manager.getRepository(AuditoriaJerarquia).save({ actorUsuarioId: solicitanteId,
        objetivoUsuarioId: solicitanteId, accion: 'ENVIAR_SOLICITUD',
        detalle: { solicitudId: solicitud.id, carreraId, modulo: 'PLANES_ESTUDIO', operacion, objetivoId } });
      return solicitud;
    });
  }

  async proponerCrearPlan(solicitanteId: number, dto: CrearPlanEstudioDto) {
    return this.registrarPropuestaPlan(solicitanteId, dto.carreraId, 'CREAR', { ...dto }, null, null);
  }

  async proponerActualizarPlan(solicitanteId: number, id: number, dto: ActualizarPlanEstudioDto) {
    const plan = await this.planes.obtenerPlanCompleto(id);
    return this.registrarPropuestaPlan(solicitanteId, plan.carreraId, 'ACTUALIZAR',
      { ...dto, planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        datosAnteriores: { grado: plan.grado, codigo: plan.codigo, nombre: plan.nombre,
          descripcion: plan.descripcion } }, id, this.planes.huellaPlan(plan));
  }

  async proponerCambiarEstadoPlan(solicitanteId: number, id: number, activo: boolean) {
    const plan = await this.planes.obtenerPlanCompleto(id);
    return this.registrarPropuestaPlan(solicitanteId, plan.carreraId, 'CAMBIAR_ESTADO',
      { activo, planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        datosAnteriores: { activo: plan.activo } }, id, this.planes.huellaPlan(plan));
  }

  async proponerAgregarAsignatura(solicitanteId: number, planId: number, dto: CrearPlanAsignaturaDto) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'AGREGAR_ASIGNATURA',
      { planId, ...dto, planReferencia: { codigo: plan.codigo, nombre: plan.nombre } },
      planId,
      null,
    );
  }

  async proponerActualizarAsignatura(
    solicitanteId: number,
    planId: number,
    id: number,
    dto: ActualizarPlanAsignaturaDto,
  ) {
    const [plan, asignatura] = await Promise.all([
      this.planes.obtenerPlanCompleto(planId),
      this.planAsignaturas.obtenerAsignaturaParaSolicitud(planId, id),
    ]);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'ACTUALIZAR_ASIGNATURA',
      {
        planId,
        asignaturaId: id,
        ...dto,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        asignaturaReferencia: {
          codigo: asignatura.codigoReferencia,
          nombre: asignatura.nombreReferencia,
        },
      },
      id,
      this.planAsignaturas.huellaAsignatura(asignatura),
    );
  }

  async proponerCambiarEstadoAsignatura(
    solicitanteId: number,
    planId: number,
    id: number,
    activo: boolean,
  ) {
    const [plan, asignatura] = await Promise.all([
      this.planes.obtenerPlanCompleto(planId),
      this.planAsignaturas.obtenerAsignaturaParaSolicitud(planId, id),
    ]);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'CAMBIAR_ESTADO_ASIGNATURA',
      {
        planId,
        asignaturaId: id,
        activo,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        asignaturaReferencia: {
          codigo: asignatura.codigoReferencia,
          nombre: asignatura.nombreReferencia,
        },
      },
      id,
      this.planAsignaturas.huellaAsignatura(asignatura),
    );
  }

  async proponerCargaMasivaAsignaturas(
    solicitanteId: number,
    planId: number,
    dto: CargaMasivaPlanAsignaturasDto,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'CARGA_MASIVA_ASIGNATURAS',
      { planId, ...dto, planReferencia: { codigo: plan.codigo, nombre: plan.nombre } },
      planId,
      null,
    );
  }

  async proponerAgregarRequisitoPlan(
    solicitanteId: number,
    planId: number,
    dto: CrearPlanRequisitoDto,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    const [asig, reqAsig] = await Promise.all([
      this.planAsignaturas.obtenerAsignaturaParaSolicitud(planId, dto.asignaturaId),
      this.planAsignaturas.obtenerAsignaturaParaSolicitud(planId, dto.requisitoAsignaturaId),
    ]);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'AGREGAR_REQUISITO',
      {
        planId,
        ...dto,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        asignaturaReferencia: { codigo: asig.codigoReferencia, nombre: asig.nombreReferencia },
        requisitoReferencia: { codigo: reqAsig.codigoReferencia, nombre: reqAsig.nombreReferencia },
      },
      planId,
      null,
    );
  }

  async proponerEliminarRequisitoPlan(
    solicitanteId: number,
    planId: number,
    relacionId: number,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    const rel = await this.planRequisitos.obtenerRelacionParaSolicitud(planId, relacionId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'ELIMINAR_REQUISITO',
      {
        planId,
        relacionId,
        asignaturaId: rel.asignaturaId,
        requisitoAsignaturaId: rel.requisitoAsignaturaId,
        tipo: rel.tipo,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        asignaturaReferencia: {
          codigo: rel.asignatura?.codigoReferencia,
          nombre: rel.asignatura?.nombreReferencia,
        },
        requisitoReferencia: {
          codigo: rel.requisitoAsignatura?.codigoReferencia,
          nombre: rel.requisitoAsignatura?.nombreReferencia,
        },
      },
      relacionId,
      null,
    );
  }

  async proponerCargaMasivaRequisitosPlan(
    solicitanteId: number,
    planId: number,
    dto: CargaMasivaPlanRequisitosDto,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'CARGA_MASIVA_REQUISITOS',
      { planId, ...dto, planReferencia: { codigo: plan.codigo, nombre: plan.nombre } },
      planId,
      null,
    );
  }

  async proponerCrearSalida(
    solicitanteId: number,
    planId: number,
    dto: CrearSalidaAcademicaDto,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'CREAR_SALIDA',
      { planId, ...dto, planReferencia: { codigo: plan.codigo, nombre: plan.nombre } },
      planId,
      null,
    );
  }

  async proponerActualizarSalida(
    solicitanteId: number,
    planId: number,
    id: number,
    dto: ActualizarSalidaAcademicaDto,
  ) {
    const [plan, salida] = await Promise.all([
      this.planes.obtenerPlanCompleto(planId),
      this.salidasAcademicas.obtenerSalidaParaSolicitud(planId, id),
    ]);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'ACTUALIZAR_SALIDA',
      {
        planId,
        salidaId: id,
        ...dto,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        salidaReferencia: { codigo: salida.codigo, nombre: salida.nombre },
      },
      id,
      this.salidasAcademicas.huellaSalida(salida),
    );
  }

  async proponerCambiarEstadoSalida(
    solicitanteId: number,
    planId: number,
    id: number,
    activo: boolean,
  ) {
    const [plan, salida] = await Promise.all([
      this.planes.obtenerPlanCompleto(planId),
      this.salidasAcademicas.obtenerSalidaParaSolicitud(planId, id),
    ]);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'CAMBIAR_ESTADO_SALIDA',
      {
        planId,
        salidaId: id,
        activo,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        salidaReferencia: { codigo: salida.codigo, nombre: salida.nombre },
      },
      id,
      this.salidasAcademicas.huellaSalida(salida),
    );
  }

  async proponerAsignarAsignaturasSalida(
    solicitanteId: number,
    planId: number,
    id: number,
    dto: ActualizarAsignaturasSalidaDto,
  ) {
    const [plan, salida] = await Promise.all([
      this.planes.obtenerPlanCompleto(planId),
      this.salidasAcademicas.obtenerSalidaParaSolicitud(planId, id),
    ]);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'ASIGNAR_ASIGNATURAS_SALIDA',
      {
        planId,
        salidaId: id,
        ...dto,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
        salidaReferencia: { codigo: salida.codigo, nombre: salida.nombre },
      },
      id,
      null,
    );
  }

  async proponerGuardarReglaOptativa(
    solicitanteId: number,
    planId: number,
    dto: GuardarReglaOptativaPlanDto,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    const regla = await this.planReglasOptativas.obtenerReglaParaSolicitud(planId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'GUARDAR_REGLA_OPTATIVA',
      { planId, ...dto, planReferencia: { codigo: plan.codigo, nombre: plan.nombre } },
      planId,
      this.planReglasOptativas.huellaRegla(regla),
    );
  }

  async proponerEliminarReglaOptativa(solicitanteId: number, planId: number) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    const regla = await this.planReglasOptativas.obtenerReglaParaSolicitud(planId);
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'ELIMINAR_REGLA_OPTATIVA',
      { planId, planReferencia: { codigo: plan.codigo, nombre: plan.nombre } },
      planId,
      this.planReglasOptativas.huellaRegla(regla),
    );
  }

  async proponerImportarPlan(
    solicitanteId: number,
    planId: number,
    dto: ValidarImportacionPlanDto,
  ) {
    const plan = await this.planes.obtenerPlanCompleto(planId);
    const validacion = await this.planImportacion.validar(planId, dto);
    if (!validacion.puedeImportar) {
      throw new BadRequestException({
        message: 'El archivo contiene errores y no puede enviarse como propuesta de importación.',
        validacion,
      });
    }
    return this.registrarPropuestaPlan(
      solicitanteId,
      plan.carreraId,
      'IMPORTAR_PLAN',
      {
        planId,
        ...dto,
        resumenValidacion: validacion.resumen,
        planReferencia: { codigo: plan.codigo, nombre: plan.nombre },
      },
      planId,
      null,
    );
  }

  private async registrarPropuestaCurso(solicitanteId: number, carreraIds: number[], operacion: string,
    datosPropuestos: Record<string, unknown>, objetivoId: number | null, huellaOriginal: string | null) {
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia) throw new ForbiddenException('Asistente sin coordinador responsable.');
    await this.cursos.validarDelegacionCompleta(dependencia.coordinadorId, solicitanteId, carreraIds);
    const carreraId = carreraIds[0];
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId, coordinadorId: dependencia.coordinadorId, carreraId,
        modulo: 'CURSOS', operacion, objetivoId,
        datosPropuestos: { ...datosPropuestos, carrerasAfectadas: carreraIds }, huellaOriginal,
        estado: 'PENDIENTE', correlacionId: randomUUID(), resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId, objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD', detalle: { solicitudId: solicitud.id, carreraId,
          modulo: 'CURSOS', operacion, objetivoId },
      });
      return solicitud;
    });
  }

  async proponerCrearCurso(solicitanteId: number, dto: CrearCursoDto) {
    const { carreraId, codigo, nombre } = await this.cursos.contextoCreacion(dto.planAsignaturaId);
    return this.registrarPropuestaCurso(solicitanteId, [carreraId], 'CREAR',
      { ...dto, cursoReferencia: { codigo, nombre } }, null, null);
  }

  async proponerActualizarCurso(solicitanteId: number, cursoId: number, dto: ActualizarCursoDto) {
    const curso = await this.cursos.obtenerCursoCompleto(cursoId);
    return this.registrarPropuestaCurso(solicitanteId, curso.carreras.map((c) => c.id),
      'ACTUALIZAR', { ...dto, cursoReferencia: { codigo: curso.codigo, nombre: curso.nombre },
        datosAnteriores: { descripcion: curso.descripcion } }, cursoId, this.cursos.huellaCurso(curso));
  }

  async proponerCambiarEstadoCurso(solicitanteId: number, cursoId: number, activo: boolean) {
    const curso = await this.cursos.obtenerCursoCompleto(cursoId);
    return this.registrarPropuestaCurso(solicitanteId, curso.carreras.map((c) => c.id),
      'CAMBIAR_ESTADO', { activo, cursoReferencia: { codigo: curso.codigo, nombre: curso.nombre },
        datosAnteriores: { activo: curso.activo } }, cursoId, this.cursos.huellaCurso(curso));
  }

  async proponerAgregarRequisitoCurso(solicitanteId: number, cursoId: number, dto: CrearCursoRequisitoDto) {
    const [curso, requerido] = await Promise.all([
      this.cursos.obtenerCursoCompleto(cursoId), this.cursos.obtenerCursoCompleto(dto.requisitoCursoId),
    ]);
    const carreraIds = [...new Set([...curso.carreras, ...requerido.carreras].map((c) => c.id))];
    return this.registrarPropuestaCurso(solicitanteId, carreraIds, 'AGREGAR_REQUISITO',
      { ...dto, cursoReferencia: { codigo: curso.codigo, nombre: curso.nombre },
        requisitoReferencia: { codigo: requerido.codigo, nombre: requerido.nombre } }, cursoId, null);
  }

  async proponerEliminarRequisitoCurso(solicitanteId: number, cursoId: number, relacionId: number) {
    const relacion = await this.requisitosCursos.contextoEliminacion(cursoId, relacionId);
    const [curso, requerido] = await Promise.all([
      this.cursos.obtenerCursoCompleto(cursoId), this.cursos.obtenerCursoCompleto(relacion.requisitoCursoId),
    ]);
    const carreraIds = [...new Set([...curso.carreras, ...requerido.carreras].map((c) => c.id))];
    return this.registrarPropuestaCurso(solicitanteId, carreraIds, 'ELIMINAR_REQUISITO',
      { cursoId, requisitoCursoId: relacion.requisitoCursoId, tipo: relacion.tipo,
        cursoReferencia: { codigo: curso.codigo, nombre: curso.nombre },
        requisitoReferencia: { codigo: requerido.codigo, nombre: requerido.nombre } }, relacionId, null);
  }

  async proponerCrearEstudiante(solicitanteId: number, dto: CrearEstudianteDto) {
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia || !(await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, dto.carreraId))) {
      throw new ForbiddenException('No puede proponer estudiantes en esa carrera.');
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId, coordinadorId: dependencia.coordinadorId, carreraId: dto.carreraId,
        modulo: 'ESTUDIANTES', operacion: 'CREAR', objetivoId: null,
        datosPropuestos: { ...dto }, huellaOriginal: null, estado: 'PENDIENTE',
        correlacionId: randomUUID(), resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId, objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD', detalle: { solicitudId: solicitud.id, carreraId: dto.carreraId,
          modulo: 'ESTUDIANTES', operacion: 'CREAR' },
      });
      return solicitud;
    });
  }

  async proponerActualizarEstudiante(solicitanteId: number, estudianteId: number, dto: ActualizarEstudianteDto) {
    const estudiante = await this.estudiantes.obtenerPorId(solicitanteId, estudianteId);
    const carreraId = estudiante.carreraId;
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia || !(await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, carreraId))) {
      throw new ForbiddenException('No puede proponer cambios de estudiantes en esa carrera.');
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId, coordinadorId: dependencia.coordinadorId, carreraId,
        modulo: 'ESTUDIANTES', operacion: 'ACTUALIZAR', objetivoId: estudianteId,
        datosPropuestos: { ...dto }, huellaOriginal: this.estudiantes.huellaEstudiante(estudiante),
        estado: 'PENDIENTE', correlacionId: randomUUID(), resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId, objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD', detalle: { solicitudId: solicitud.id, carreraId,
          modulo: 'ESTUDIANTES', operacion: 'ACTUALIZAR', estudianteId },
      });
      return solicitud;
    });
  }

  async proponerCambiarEstadoEstudiante(solicitanteId: number, estudianteId: number, dto: CambiarEstadoEstudianteDto) {
    const estudiante = await this.estudiantes.obtenerPorId(solicitanteId, estudianteId);
    const carreraId = estudiante.carreraId;
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia || !(await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, carreraId))) {
      throw new ForbiddenException('No puede proponer cambios de estudiantes en esa carrera.');
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId, coordinadorId: dependencia.coordinadorId, carreraId,
        modulo: 'ESTUDIANTES', operacion: 'CAMBIAR_ESTADO', objetivoId: estudianteId,
        datosPropuestos: { estado: dto.estado }, huellaOriginal: this.estudiantes.huellaEstudiante(estudiante),
        estado: 'PENDIENTE', correlacionId: randomUUID(), resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId, objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD', detalle: { solicitudId: solicitud.id, carreraId,
          modulo: 'ESTUDIANTES', operacion: 'CAMBIAR_ESTADO', estudianteId },
      });
      return solicitud;
    });
  }

  async proponerCambiarPlanEstudiante(
    solicitanteId: number,
    estudianteId: number,
    dto: CambiarPlanEstudianteDto,
  ) {
    const estudiante = await this.estudiantes.obtenerPorId(solicitanteId, estudianteId);
    const carreraId = estudiante.carreraId;
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia || !(await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, carreraId))) {
      throw new ForbiddenException('No puede proponer cambios de plan en esa carrera.');
    }
    const planNuevo = await this.planes.obtenerPlanCompleto(dto.planNuevoId);
    if (!planNuevo || !planNuevo.activo) {
      throw new BadRequestException('El nuevo plan no existe o está inactivo.');
    }
    if (planNuevo.carreraId !== carreraId) {
      const puedeDestino = await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, planNuevo.carreraId);
      if (!puedeDestino) {
        throw new ForbiddenException('No posee delegación para proponer transferencia hacia la carrera del plan destino.');
      }
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId,
        coordinadorId: dependencia.coordinadorId,
        carreraId,
        modulo: 'ESTUDIANTES',
        operacion: 'CAMBIAR_PLAN',
        objetivoId: estudianteId,
        datosPropuestos: {
          ...dto,
          carreraDestinoId: planNuevo.carreraId,
          estudianteReferencia: { cedula: estudiante.cedula, nombres: `${estudiante.nombres} ${estudiante.apellido1}` },
          planAnteriorId: estudiante.planEstudioId,
          planNuevoReferencia: { codigo: planNuevo.codigo, nombre: planNuevo.nombre },
        },
        huellaOriginal: this.estudiantes.huellaEstudiante(estudiante),
        estado: 'PENDIENTE',
        correlacionId: randomUUID(),
        resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId,
        objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD',
        detalle: { solicitudId: solicitud.id, carreraId, modulo: 'ESTUDIANTES', operacion: 'CAMBIAR_PLAN', estudianteId },
      });
      return solicitud;
    });
  }

  async proponerRegistrarResultadoEstudiante(
    solicitanteId: number,
    estudianteId: number,
    dto: RegistrarResultadoAcademicoDto,
  ) {
    const estudiante = await this.estudiantes.obtenerPorId(solicitanteId, estudianteId);
    const carreraId = estudiante.carreraId;
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia || !(await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, carreraId))) {
      throw new ForbiddenException('No puede proponer resultados académicos en esa carrera.');
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId,
        coordinadorId: dependencia.coordinadorId,
        carreraId,
        modulo: 'ESTUDIANTES',
        operacion: 'REGISTRAR_RESULTADO',
        objetivoId: estudianteId,
        datosPropuestos: {
          ...dto,
          estudianteReferencia: { cedula: estudiante.cedula, nombres: `${estudiante.nombres} ${estudiante.apellido1}` },
        },
        huellaOriginal: this.estudiantes.huellaEstudiante(estudiante),
        estado: 'PENDIENTE',
        correlacionId: randomUUID(),
        resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId,
        objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD',
        detalle: { solicitudId: solicitud.id, carreraId, modulo: 'ESTUDIANTES', operacion: 'REGISTRAR_RESULTADO', estudianteId },
      });
      return solicitud;
    });
  }

  async proponerImportarEstudiantes(
    solicitanteId: number,
    dto: ImportarEstudiantesDto,
  ) {
    const dependencia = await this.dependencias.findOne({ where: { asistenteId: solicitanteId, activo: true } });
    if (!dependencia || !(await this.alcance.puedeEjecutar(solicitanteId, PermisoSistema.ESTUDIANTES_GESTIONAR, dto.carreraId))) {
      throw new ForbiddenException('No puede proponer importación de estudiantes en esa carrera.');
    }
    if (!this.estudiantesImportacion) {
      throw new ForbiddenException('Servicio de importación de estudiantes no disponible.');
    }
    const validacion = await this.estudiantesImportacion.validar(solicitanteId, dto);
    const errores = validacion.filas.filter((f) => f.accion === 'ERROR');
    if (errores.length > 0) {
      throw new BadRequestException(`La importación contiene ${errores.length} filas con error.`);
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId,
        coordinadorId: dependencia.coordinadorId,
        carreraId: dto.carreraId,
        modulo: 'ESTUDIANTES',
        operacion: 'IMPORTAR_ESTUDIANTES',
        objetivoId: dto.planEstudioId,
        datosPropuestos: { ...dto, resumenValidacion: validacion.resumen },
        huellaOriginal: null,
        estado: 'PENDIENTE',
        correlacionId: randomUUID(),
        resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId,
        objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD',
        detalle: { solicitudId: solicitud.id, carreraId: dto.carreraId, modulo: 'ESTUDIANTES', operacion: 'IMPORTAR_ESTUDIANTES' },
      });
      return solicitud;
    });
  }

  private async registrarPropuestaOptativa(
    solicitanteId: number,
    carreraId: number,
    operacion: string,
    datosPropuestos: Record<string, unknown>,
    objetivoId: number | null,
    huellaOriginal: string | null,
  ) {
    const dependencia = await this.dependencias.findOne({
      where: { asistenteId: solicitanteId, activo: true },
    });
    if (!dependencia) throw new ForbiddenException('Asistente sin coordinador responsable.');
    if (!this.optativas) throw new ForbiddenException('Servicio de optativas no disponible.');
    await this.optativas.validarDelegacionCompleta(
      dependencia.coordinadorId,
      solicitanteId,
      carreraId,
    );
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(SolicitudCambio).save({
        solicitanteId,
        coordinadorId: dependencia.coordinadorId,
        carreraId,
        modulo: 'OPTATIVAS',
        operacion,
        objetivoId,
        datosPropuestos,
        huellaOriginal,
        estado: 'PENDIENTE',
        correlacionId: randomUUID(),
        resultadoAplicado: null,
      });
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: solicitanteId,
        objetivoUsuarioId: solicitanteId,
        accion: 'ENVIAR_SOLICITUD',
        detalle: {
          solicitudId: solicitud.id,
          carreraId,
          modulo: 'OPTATIVAS',
          operacion,
          objetivoId,
        },
      });
      return solicitud;
    });
  }

  async proponerCrearOptativa(solicitanteId: number, dto: CrearOptativaDto) {
    if (!dto.carreraOrigenId) {
      throw new BadRequestException('La propuesta de optativa debe indicar su carrera de origen.');
    }
    return this.registrarPropuestaOptativa(
      solicitanteId,
      dto.carreraOrigenId,
      'CREAR',
      { ...dto },
      null,
      null,
    );
  }

  async proponerActualizarOptativa(solicitanteId: number, id: number, dto: ActualizarOptativaDto) {
    if (!this.optativas) throw new ForbiddenException('Servicio de optativas no disponible.');
    const optativa = await this.optativas.obtenerOptativaParaSolicitud(id);
    if (!optativa.carreraOrigenId) {
      throw new BadRequestException('Solo pueden proponerse modificaciones sobre optativas con carrera de origen.');
    }
    return this.registrarPropuestaOptativa(
      solicitanteId,
      optativa.carreraOrigenId,
      'ACTUALIZAR',
      {
        ...dto,
        optativaReferencia: { codigo: optativa.curso?.codigo, nombre: optativa.curso?.nombre },
        datosAnteriores: { tipo: optativa.tipo, descripcion: optativa.curso?.descripcion },
      },
      id,
      this.optativas.huellaOptativa(optativa),
    );
  }

  async proponerCambiarEstadoOptativa(solicitanteId: number, id: number, activo: boolean) {
    if (!this.optativas) throw new ForbiddenException('Servicio de optativas no disponible.');
    const optativa = await this.optativas.obtenerOptativaParaSolicitud(id);
    if (!optativa.carreraOrigenId) {
      throw new BadRequestException('Solo pueden proponerse modificaciones sobre optativas con carrera de origen.');
    }
    return this.registrarPropuestaOptativa(
      solicitanteId,
      optativa.carreraOrigenId,
      'CAMBIAR_ESTADO',
      {
        activo,
        optativaReferencia: { codigo: optativa.curso?.codigo, nombre: optativa.curso?.nombre },
        datosAnteriores: { activo: optativa.activo },
      },
      id,
      this.optativas.huellaOptativa(optativa),
    );
  }

  async listarParaCoordinador(coordinadorId: number) {
    return this.solicitudes.find({ where: { coordinadorId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async listarPropias(solicitanteId: number) {
    return this.solicitudes.find({ where: { solicitanteId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async aprobar(coordinadorId: number, solicitudId: number) {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Usuario).findOne({ where: { id: coordinadorId }, lock: { mode: 'pessimistic_write' } });
      const repo = manager.getRepository(SolicitudCambio);
      const solicitud = await repo.findOne({ where: { id: solicitudId }, lock: { mode: 'pessimistic_write' } });
      if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
      if (solicitud.coordinadorId !== coordinadorId) throw new ForbiddenException('Solicitud de otro coordinador.');
      if (solicitud.estado !== 'PENDIENTE') throw new ConflictException('La solicitud ya fue resuelta.');
      const permiso = solicitud.modulo === 'ESTUDIANTES' ? PermisoSistema.ESTUDIANTES_GESTIONAR :
        solicitud.modulo === 'CURSOS' ? PermisoSistema.CURSOS_GESTIONAR :
        solicitud.modulo === 'PLANES_ESTUDIO' ? PermisoSistema.PLANES_ESTUDIO_GESTIONAR :
        solicitud.modulo === 'OPTATIVAS' ? PermisoSistema.OPTATIVAS_GESTIONAR : null;
      const carrerasAfectadas =
        solicitud.modulo === 'CURSOS' && Array.isArray(solicitud.datosPropuestos.carrerasAfectadas)
          ? solicitud.datosPropuestos.carrerasAfectadas
              .map(Number)
              .filter((id) => Number.isInteger(id) && id > 0)
          : solicitud.modulo === 'ESTUDIANTES' &&
            solicitud.operacion === 'CAMBIAR_PLAN' &&
            Number.isInteger(solicitud.datosPropuestos.carreraDestinoId) &&
            Number(solicitud.datosPropuestos.carreraDestinoId) !== solicitud.carreraId
          ? [solicitud.carreraId, Number(solicitud.datosPropuestos.carreraDestinoId)]
          : [solicitud.carreraId];
      const vigente = !!permiso && (await this.alcance.puedeAdministrarAsistente(coordinadorId, solicitud.solicitanteId)) &&
        carrerasAfectadas.length > 0 &&
        (await Promise.all(carrerasAfectadas.flatMap((carreraId) => [
          this.alcance.puedeEjecutar(solicitud.solicitanteId, permiso, carreraId),
          this.alcance.puedeEjecutar(coordinadorId, permiso, carreraId),
        ]))).every(Boolean);
      if (!vigente) {
        solicitud.estado = 'INVALIDADA';
        solicitud.resueltoEn = new Date();
        solicitud.resueltoPorUsuarioId = coordinadorId;
        await repo.save(solicitud);
        await manager.getRepository(AuditoriaJerarquia).save({
          actorUsuarioId: coordinadorId, objetivoUsuarioId: solicitud.solicitanteId,
          accion: 'INVALIDAR_SOLICITUD', detalle: { solicitudId },
        });
        return solicitud;
      }
      let resultado: Record<string, number> = {};
      if (solicitud.modulo === 'CURSOS') {
        let cursoId: number;
        if (solicitud.operacion === 'CREAR' && Number.isInteger(solicitud.datosPropuestos.planAsignaturaId)) {
          cursoId = await this.cursos.crearDesdeSolicitud(coordinadorId, solicitud.solicitanteId,
            solicitud.carreraId, solicitud.datosPropuestos as unknown as CrearCursoDto, manager);
        } else if (solicitud.operacion === 'ACTUALIZAR' && solicitud.objetivoId && solicitud.huellaOriginal) {
          cursoId = await this.cursos.actualizarDesdeSolicitud(coordinadorId, solicitud.solicitanteId,
            solicitud.objetivoId, solicitud.carreraId, solicitud.datosPropuestos as ActualizarCursoDto,
            solicitud.huellaOriginal, manager);
        } else if (solicitud.operacion === 'CAMBIAR_ESTADO' && solicitud.objetivoId && solicitud.huellaOriginal &&
          typeof solicitud.datosPropuestos.activo === 'boolean') {
          cursoId = await this.cursos.cambiarEstadoDesdeSolicitud(coordinadorId, solicitud.solicitanteId,
            solicitud.objetivoId, solicitud.carreraId, solicitud.datosPropuestos.activo,
            solicitud.huellaOriginal, manager);
        } else if (solicitud.operacion === 'AGREGAR_REQUISITO' && solicitud.objetivoId &&
          Number.isInteger(solicitud.datosPropuestos.requisitoCursoId) &&
          Object.values(TipoRequisito).includes(solicitud.datosPropuestos.tipo as TipoRequisito)) {
          const relacionId = await this.requisitosCursos.crearDesdeSolicitud(coordinadorId, solicitud.solicitanteId,
            solicitud.objetivoId, solicitud.datosPropuestos as unknown as CrearCursoRequisitoDto, manager);
          resultado = { cursoId: solicitud.objetivoId, relacionId };
          cursoId = solicitud.objetivoId;
        } else if (solicitud.operacion === 'ELIMINAR_REQUISITO' && solicitud.objetivoId &&
          Number.isInteger(solicitud.datosPropuestos.cursoId) &&
          Number.isInteger(solicitud.datosPropuestos.requisitoCursoId) &&
          Object.values(TipoRequisito).includes(solicitud.datosPropuestos.tipo as TipoRequisito)) {
          const relacionId = await this.requisitosCursos.eliminarDesdeSolicitud(coordinadorId, solicitud.solicitanteId,
            Number(solicitud.datosPropuestos.cursoId), solicitud.objetivoId,
            { requisitoCursoId: Number(solicitud.datosPropuestos.requisitoCursoId),
              tipo: solicitud.datosPropuestos.tipo as TipoRequisito }, manager);
          resultado = { cursoId: Number(solicitud.datosPropuestos.cursoId), relacionId };
          cursoId = Number(solicitud.datosPropuestos.cursoId);
        } else throw new ForbiddenException('Operación de curso no admitida.');
        if (!Object.keys(resultado).length) resultado = { cursoId };
      } else if (solicitud.modulo === 'PLANES_ESTUDIO') {
        const datos = solicitud.datosPropuestos;
        const planId = Number(datos.planId ?? solicitud.objetivoId);
        if (solicitud.operacion === 'CREAR' && Number(datos.carreraId) === solicitud.carreraId) {
          const id = await this.planes.crearDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, datos as unknown as CrearPlanEstudioDto, manager,
          );
          resultado = { planId: id };
        } else if (solicitud.operacion === 'ACTUALIZAR' && solicitud.objetivoId && solicitud.huellaOriginal) {
          const id = await this.planes.actualizarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, solicitud.objetivoId,
            datos as ActualizarPlanEstudioDto, solicitud.huellaOriginal, manager,
          );
          resultado = { planId: id };
        } else if (solicitud.operacion === 'CAMBIAR_ESTADO' && solicitud.objetivoId && solicitud.huellaOriginal &&
          typeof datos.activo === 'boolean') {
          const id = await this.planes.cambiarEstadoDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, solicitud.objetivoId,
            datos.activo, solicitud.huellaOriginal, manager,
          );
          resultado = { planId: id };
        } else if (solicitud.operacion === 'AGREGAR_ASIGNATURA' && Number.isInteger(planId)) {
          const asignaturaId = await this.planAsignaturas.crearDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as CrearPlanAsignaturaDto, manager,
          );
          resultado = { planId, asignaturaId };
        } else if (solicitud.operacion === 'ACTUALIZAR_ASIGNATURA' && Number.isInteger(planId) && solicitud.objetivoId && solicitud.huellaOriginal) {
          const asignaturaId = await this.planAsignaturas.actualizarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, solicitud.objetivoId,
            datos as unknown as ActualizarPlanAsignaturaDto, solicitud.huellaOriginal, manager,
          );
          resultado = { planId, asignaturaId };
        } else if (solicitud.operacion === 'CAMBIAR_ESTADO_ASIGNATURA' && Number.isInteger(planId) && solicitud.objetivoId && solicitud.huellaOriginal && typeof datos.activo === 'boolean') {
          const asignaturaId = await this.planAsignaturas.cambiarEstadoDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, solicitud.objetivoId,
            datos.activo, solicitud.huellaOriginal, manager,
          );
          resultado = { planId, asignaturaId };
        } else if (solicitud.operacion === 'CARGA_MASIVA_ASIGNATURAS' && Number.isInteger(planId) && Array.isArray(datos.asignaturas)) {
          const res = await this.planAsignaturas.cargaMasivaDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as CargaMasivaPlanAsignaturasDto, manager,
          );
          resultado = { planId, totalAsignaturas: res.total };
        } else if (solicitud.operacion === 'AGREGAR_REQUISITO' && Number.isInteger(planId) && Number.isInteger(datos.asignaturaId) && Number.isInteger(datos.requisitoAsignaturaId) && Object.values(TipoRequisito).includes(datos.tipo as TipoRequisito)) {
          const relacionId = await this.planRequisitos.crearDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as CrearPlanRequisitoDto, manager,
          );
          resultado = { planId, relacionId };
        } else if (solicitud.operacion === 'ELIMINAR_REQUISITO' && Number.isInteger(planId) && solicitud.objetivoId) {
          const relacionId = await this.planRequisitos.eliminarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, solicitud.objetivoId,
            { asignaturaId: Number(datos.asignaturaId), requisitoAsignaturaId: Number(datos.requisitoAsignaturaId), tipo: datos.tipo as TipoRequisito }, manager,
          );
          resultado = { planId, relacionId };
        } else if (solicitud.operacion === 'CARGA_MASIVA_REQUISITOS' && Number.isInteger(planId) && Array.isArray(datos.requisitos)) {
          const res = await this.planRequisitos.cargaMasivaDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as CargaMasivaPlanRequisitosDto, manager,
          );
          resultado = { planId, totalRequisitos: res.total };
        } else if (solicitud.operacion === 'CREAR_SALIDA' && Number.isInteger(planId)) {
          const salidaId = await this.salidasAcademicas.crearDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as CrearSalidaAcademicaDto, manager,
          );
          resultado = { planId, salidaId };
        } else if (solicitud.operacion === 'ACTUALIZAR_SALIDA' && Number.isInteger(planId) && solicitud.objetivoId && solicitud.huellaOriginal) {
          const salidaId = await this.salidasAcademicas.actualizarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, solicitud.objetivoId,
            datos as unknown as ActualizarSalidaAcademicaDto, solicitud.huellaOriginal, manager,
          );
          resultado = { planId, salidaId };
        } else if (solicitud.operacion === 'CAMBIAR_ESTADO_SALIDA' && Number.isInteger(planId) && solicitud.objetivoId && solicitud.huellaOriginal && typeof datos.activo === 'boolean') {
          const salidaId = await this.salidasAcademicas.cambiarEstadoDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, solicitud.objetivoId,
            datos.activo, solicitud.huellaOriginal, manager,
          );
          resultado = { planId, salidaId };
        } else if (solicitud.operacion === 'ASIGNAR_ASIGNATURAS_SALIDA' && Number.isInteger(planId) && solicitud.objetivoId && Array.isArray(datos.asignaturaIds)) {
          const salidaId = await this.salidasAcademicas.reemplazarAsignaturasDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, solicitud.objetivoId,
            datos as unknown as ActualizarAsignaturasSalidaDto, manager,
          );
          resultado = { planId, salidaId };
        } else if (solicitud.operacion === 'GUARDAR_REGLA_OPTATIVA' && Number.isInteger(planId)) {
          const reglaId = await this.planReglasOptativas.guardarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as GuardarReglaOptativaPlanDto, manager,
          );
          resultado = { planId, reglaId };
        } else if (solicitud.operacion === 'ELIMINAR_REGLA_OPTATIVA' && Number.isInteger(planId)) {
          await this.planReglasOptativas.eliminarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, manager,
          );
          resultado = { planId };
        } else if (solicitud.operacion === 'IMPORTAR_PLAN' && Number.isInteger(planId)) {
          const res = await this.planImportacion.importarDesdeSolicitud(
            coordinadorId, solicitud.solicitanteId, planId, datos as unknown as ValidarImportacionPlanDto, manager,
          );
          resultado = { planId, ...res };
        } else {
          throw new ForbiddenException('Operación de plan no admitida.');
        }
      } else if (solicitud.modulo === 'ESTUDIANTES') {
        let estudianteId: number;
        if (solicitud.operacion === 'CREAR' && Number(solicitud.datosPropuestos.carreraId) === solicitud.carreraId) {
          estudianteId = await this.estudiantes.crearDesdeSolicitud(
            coordinadorId, solicitud.datosPropuestos as unknown as CrearEstudianteDto, manager,
          );
          resultado = { estudianteId };
        } else if (solicitud.operacion === 'ACTUALIZAR' && solicitud.objetivoId && solicitud.huellaOriginal) {
          estudianteId = await this.estudiantes.actualizarDesdeSolicitud(
            coordinadorId, solicitud.objetivoId, solicitud.carreraId,
            solicitud.datosPropuestos as ActualizarEstudianteDto, solicitud.huellaOriginal, manager,
          );
          resultado = { estudianteId };
        } else if (solicitud.operacion === 'CAMBIAR_ESTADO' && solicitud.objetivoId && solicitud.huellaOriginal) {
          const estado = solicitud.datosPropuestos.estado;
          if (!Object.values(EstadoEstudiante).includes(estado as EstadoEstudiante)) {
            throw new ForbiddenException('Estado propuesto no admitido.');
          }
          estudianteId = await this.estudiantes.cambiarEstadoDesdeSolicitud(
            coordinadorId, solicitud.objetivoId, solicitud.carreraId,
            estado as EstadoEstudiante,
            solicitud.huellaOriginal, manager,
          );
          resultado = { estudianteId };
        } else if (solicitud.operacion === 'CAMBIAR_PLAN' && solicitud.objetivoId && solicitud.huellaOriginal) {
          estudianteId = await this.estudiantes.cambiarPlanDesdeSolicitud(
            coordinadorId,
            solicitud.objetivoId,
            solicitud.carreraId,
            solicitud.datosPropuestos as unknown as CambiarPlanEstudianteDto,
            solicitud.huellaOriginal,
            manager,
          );
          resultado = { estudianteId };
        } else if (solicitud.operacion === 'REGISTRAR_RESULTADO' && solicitud.objetivoId && solicitud.huellaOriginal) {
          const resultadoId = await this.estudiantes.registrarResultadoDesdeSolicitud(
            coordinadorId,
            solicitud.objetivoId,
            solicitud.carreraId,
            solicitud.datosPropuestos as unknown as RegistrarResultadoAcademicoDto,
            solicitud.huellaOriginal,
            manager,
          );
          resultado = { estudianteId: solicitud.objetivoId, resultadoId };
        } else if (solicitud.operacion === 'IMPORTAR_ESTUDIANTES') {
          if (!this.estudiantesImportacion) throw new ForbiddenException('Servicio de importación no disponible.');
          const res = await this.estudiantesImportacion.importarDesdeSolicitud(
            coordinadorId,
            solicitud.datosPropuestos as unknown as ImportarEstudiantesDto,
            manager,
          );
          resultado = res as Record<string, number>;
        } else throw new ForbiddenException('Operación de estudiante no admitida.');
      } else if (solicitud.modulo === 'OPTATIVAS') {
        let optativaId: number;
        if (!this.optativas) throw new ForbiddenException('Servicio de optativas no disponible.');
        if (solicitud.operacion === 'CREAR') {
          const res = await this.optativas.crearDesdeSolicitud(
            manager,
            solicitud.carreraId,
            solicitud.datosPropuestos,
          );
          optativaId = res.id;
        } else if (solicitud.operacion === 'ACTUALIZAR' && solicitud.objetivoId && solicitud.huellaOriginal) {
          const res = await this.optativas.actualizarDesdeSolicitud(
            manager,
            solicitud.carreraId,
            solicitud.objetivoId,
            solicitud.datosPropuestos,
            solicitud.huellaOriginal,
          );
          optativaId = res.id;
        } else if (solicitud.operacion === 'CAMBIAR_ESTADO' && solicitud.objetivoId && solicitud.huellaOriginal && typeof solicitud.datosPropuestos.activo === 'boolean') {
          const res = await this.optativas.cambiarEstadoDesdeSolicitud(
            manager,
            solicitud.carreraId,
            solicitud.objetivoId,
            solicitud.datosPropuestos.activo,
            solicitud.huellaOriginal,
          );
          optativaId = res.id;
        } else {
          throw new ForbiddenException('Operación de optativa no admitida.');
        }
        resultado = { optativaId };
      } else throw new ForbiddenException('Módulo de solicitud no admitido.');
      solicitud.estado = 'APROBADA';
      solicitud.resueltoEn = new Date();
      solicitud.resueltoPorUsuarioId = coordinadorId;
      solicitud.resultadoAplicado = resultado;
      await repo.save(solicitud);
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: coordinadorId, objetivoUsuarioId: solicitud.solicitanteId,
        accion: 'APROBAR_SOLICITUD', detalle: { solicitudId, ...resultado, modulo: solicitud.modulo,
          operacion: solicitud.operacion },
      });
      return solicitud;
    });
  }

  async rechazar(coordinadorId: number, solicitudId: number, motivo: string) {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Usuario).findOne({ where: { id: coordinadorId }, lock: { mode: 'pessimistic_write' } });
      const repo = manager.getRepository(SolicitudCambio);
      const solicitud = await repo.findOne({ where: { id: solicitudId }, lock: { mode: 'pessimistic_write' } });
      if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
      if (solicitud.coordinadorId !== coordinadorId) throw new ForbiddenException('Solicitud de otro coordinador.');
      if (solicitud.estado !== 'PENDIENTE') throw new ConflictException('La solicitud ya fue resuelta.');
      if (!(await this.alcance.puedeAdministrarAsistente(coordinadorId, solicitud.solicitanteId))) {
        throw new ForbiddenException('El asistente no pertenece al coordinador.');
      }
      solicitud.estado = 'RECHAZADA';
      solicitud.motivoRechazo = motivo.trim();
      solicitud.resueltoEn = new Date();
      solicitud.resueltoPorUsuarioId = coordinadorId;
      await repo.save(solicitud);
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId: coordinadorId, objetivoUsuarioId: solicitud.solicitanteId,
        accion: 'RECHAZAR_SOLICITUD', detalle: { solicitudId, motivo: solicitud.motivoRechazo },
      });
      return solicitud;
    });
  }
}
