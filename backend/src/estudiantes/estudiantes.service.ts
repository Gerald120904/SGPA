import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Like,
  Not,
  Repository,
} from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanRequisito } from '../planes-estudio/entities/plan-requisito.entity';
import { EquivalenciaPlan } from '../planes-estudio/entities/equivalencia-plan.entity';
import { ReglaOptativaPlan } from '../planes-estudio/entities/regla-optativa-plan.entity';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { OrigenAcademico } from './constants/origen-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { ActualizarEstudianteDto } from './dto/actualizar-estudiante.dto';
import { CambiarPlanEstudianteDto } from './dto/cambiar-plan-estudiante.dto';
import { CorregirResultadoAcademicoDto } from './dto/corregir-resultado-academico.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarResultadoAcademicoDto } from './dto/registrar-resultado-academico.dto';
import { ReingresarEstudianteDto } from './dto/reingresar-estudiante.dto';
import { AuditoriaHistorialAcademico } from './entities/auditoria-historial-academico.entity';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { HistorialPlanEstudiante } from './entities/historial-plan-estudiante.entity';
import { EvaluacionGraduacionService } from './evaluacion-graduacion.service';

@Injectable()
export class EstudiantesService {
  constructor(
    @InjectRepository(Estudiante)
    private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(HistorialAcademicoEstudiante)
    private readonly historialAcademicoRepository: Repository<HistorialAcademicoEstudiante>,
    @InjectRepository(HistorialPlanEstudiante)
    private readonly historialPlanRepository: Repository<HistorialPlanEstudiante>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(PlanRequisito)
    private readonly planRequisitoRepository: Repository<PlanRequisito>,
    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepository: Repository<PeriodoAcademico>,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly dataSource: DataSource,
    private readonly alcanceJerarquico: AlcanceJerarquicoService,
    @Optional()
    @InjectRepository(AuditoriaHistorialAcademico)
    private readonly auditoriaHistorialRepository?: Repository<AuditoriaHistorialAcademico>,
    @Optional()
    @InjectRepository(EquivalenciaPlan)
    private readonly equivalenciaRepository?: Repository<EquivalenciaPlan>,
    @Optional()
    private readonly evaluacionGraduacionService?: EvaluacionGraduacionService,
  ) {}

  async listar(usuarioId: number, filtros: FiltrarEstudiantesDto) {
    const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
    const carreraIds = tipo
      ? await this.alcanceJerarquico.obtenerCarrerasAutorizadas(usuarioId)
      : await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(usuarioId);
    const carrerasLegibles = tipo
      ? (await Promise.all(carreraIds.map(async (id) =>
          (await this.alcanceJerarquico.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_VER, id)) ? id : null,
        ))).filter((id): id is number => id !== null)
      : carreraIds;
    if (
      !carrerasLegibles.length ||
      (filtros.carreraId && !carrerasLegibles.includes(filtros.carreraId))
    )
      return [];
    const base: FindOptionsWhere<Estudiante> = {
      carreraId: filtros.carreraId ?? In(carrerasLegibles),
      ...(filtros.planEstudioId && { planEstudioId: filtros.planEstudioId }),
      ...(filtros.periodoIngresoId && {
        periodoIngresoId: filtros.periodoIngresoId,
      }),
      ...(filtros.estado && { estado: filtros.estado }),
    };
    const texto = filtros.texto?.trim();
    const where: FindOptionsWhere<Estudiante>[] | FindOptionsWhere<Estudiante> =
      texto
        ? [
            'cedula',
            'nombres',
            'apellido1',
            'apellido2',
            'correoInstitucional',
          ].map((campo) => ({ ...base, [campo]: Like(`%${texto}%`) }))
        : base;
    return this.estudianteRepository.find({
      where,
      relations: { carrera: true, planEstudio: true, periodoIngreso: true },
      order: { apellido1: 'ASC', nombres: 'ASC' },
    });
  }

  async contarPorCarrera(usuarioId: number) {
    const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
    const carreraIdsPermitidas = tipo
      ? (await Promise.all((await this.alcanceJerarquico.obtenerCarrerasAutorizadas(usuarioId))
          .map(async (id) => (await this.alcanceJerarquico.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_VER, id)) ? id : null)))
          .filter((id): id is number => id !== null)
      : await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(usuarioId);

    if (!carreraIdsPermitidas.length) {
      return [];
    }

    const filas = await this.estudianteRepository
      .createQueryBuilder('estudiante')
      .select('estudiante.carreraId', 'carreraId')
      .addSelect('COUNT(estudiante.id)', 'total')
      .where('estudiante.carreraId IN (:...carreraIds)', {
        carreraIds: carreraIdsPermitidas,
      })
      .groupBy('estudiante.carreraId')
      .getRawMany();

    return filas.map((fila) => ({
      carreraId: Number(fila.carreraId),
      total: Number(fila.total),
    }));
  }

  async contarPorPlan(usuarioId: number, carreraId: number) {
    await this.validarAlcance(usuarioId, carreraId);

    const filas = await this.estudianteRepository
      .createQueryBuilder('estudiante')
      .select('estudiante.planEstudioId', 'planEstudioId')
      .addSelect('COUNT(estudiante.id)', 'total')
      .where('estudiante.carreraId = :carreraId', {
        carreraId,
      })
      .groupBy('estudiante.planEstudioId')
      .getRawMany();

    return filas.map((fila) => ({
      planEstudioId: Number(fila.planEstudioId),
      total: Number(fila.total),
    }));
  }

  async obtenerPorId(usuarioId: number, id: number) {
    const estudiante = await this.obtenerEntidad(id);
    await this.validarAlcance(usuarioId, estudiante.carreraId);
    return estudiante;
  }

  private validarExpedienteEditable(estudiante: Estudiante, permitirGraduadoParaPromocion = false): void {
    if (estudiante.estado === EstadoEstudiante.GRADUADO && !permitirGraduadoParaPromocion) {
      throw new ConflictException('El expediente de un estudiante graduado no puede modificarse.');
    }
  }

  async crear(usuarioId: number, dto: CrearEstudianteDto) {
    await this.validarEscrituraJerarquica(usuarioId, dto.carreraId);
    const cedula = this.normalizarRequerido(dto.cedula, 'La cédula');
    const nombres = this.normalizarRequerido(dto.nombres, 'Los nombres');
    const apellido1 = this.normalizarRequerido(
      dto.apellido1,
      'El primer apellido',
    );
    const correoInstitucional = dto.correoInstitucional.trim().toLowerCase();
    await this.validarDatosAcademicos(
      usuarioId,
      dto.carreraId,
      dto.planEstudioId,
      dto.periodoIngresoId,
    );
    await this.validarDuplicados(dto.carreraId, cedula, correoInstitucional);
    const estudiante = this.estudianteRepository.create({
      cedula,
      nombres,
      apellido1,
      apellido2: dto.apellido2?.trim() || null,
      correoInstitucional,
      telefono: dto.telefono?.trim() || null,
      carreraId: dto.carreraId,
      planEstudioId: dto.planEstudioId,
      periodoIngresoId: dto.periodoIngresoId,
      estado: EstadoEstudiante.ACTIVO,
    });
    try {
      const guardado = await this.estudianteRepository.save(estudiante);
      return this.obtenerPorId(usuarioId, guardado.id);
    } catch (error) {
      this.relanzarDuplicado(error);
    }
  }

  /** Ejecuta una propuesta aprobada dentro de la transacción que bloquea la solicitud. */
  async crearDesdeSolicitud(coordinadorId: number, dto: CrearEstudianteDto, manager: EntityManager): Promise<number> {
    await this.validarEscrituraJerarquica(coordinadorId, dto.carreraId);
    await this.validarDatosAcademicos(coordinadorId, dto.carreraId, dto.planEstudioId, dto.periodoIngresoId);
    const cedula = this.normalizarRequerido(dto.cedula, 'La cédula');
    const nombres = this.normalizarRequerido(dto.nombres, 'Los nombres');
    const apellido1 = this.normalizarRequerido(dto.apellido1, 'El primer apellido');
    const correoInstitucional = dto.correoInstitucional.trim().toLowerCase();
    const repo = manager.getRepository(Estudiante);
    await this.validarDuplicados(dto.carreraId, cedula, correoInstitucional, undefined, repo);
    try {
      const guardado = await repo.save(repo.create({
        cedula, nombres, apellido1, apellido2: dto.apellido2?.trim() || null,
        correoInstitucional, telefono: dto.telefono?.trim() || null,
        carreraId: dto.carreraId, planEstudioId: dto.planEstudioId,
        periodoIngresoId: dto.periodoIngresoId, estado: EstadoEstudiante.ACTIVO,
      }));
      return guardado.id;
    } catch (error) {
      this.relanzarDuplicado(error);
    }
  }

  async actualizar(
    usuarioId: number,
    id: number,
    dto: ActualizarEstudianteDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Estudiante);
      const estudiante = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
      await this.validarAlcance(usuarioId, estudiante.carreraId);
      await this.validarEscrituraJerarquica(usuarioId, estudiante.carreraId);
      this.validarExpedienteEditable(estudiante);

      await this.aplicarActualizacion(estudiante, dto, repo);
    });
    return this.obtenerPorId(usuarioId, id);
  }

  huellaEstudiante(estudiante: Estudiante): string {
    return createHash('sha256').update(JSON.stringify({
      id: estudiante.id, cedula: estudiante.cedula, nombres: estudiante.nombres,
      apellido1: estudiante.apellido1, apellido2: estudiante.apellido2,
      correoInstitucional: estudiante.correoInstitucional, telefono: estudiante.telefono,
      carreraId: estudiante.carreraId, planEstudioId: estudiante.planEstudioId,
      periodoIngresoId: estudiante.periodoIngresoId, estado: estudiante.estado,
      updatedAt: estudiante.updatedAt ? new Date(estudiante.updatedAt).toISOString() : null,
    })).digest('hex');
  }

  async actualizarDesdeSolicitud(coordinadorId: number, id: number, carreraId: number,
    dto: ActualizarEstudianteDto, huellaOriginal: string, manager: EntityManager): Promise<number> {
    const repo = manager.getRepository(Estudiante);
    const estudiante = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carreraId !== carreraId || this.huellaEstudiante(estudiante) !== huellaOriginal) {
      throw new ConflictException('El estudiante cambió desde que se envió la solicitud.');
    }
    await this.validarAlcance(coordinadorId, carreraId);
    await this.validarEscrituraJerarquica(coordinadorId, carreraId);
    this.validarExpedienteEditable(estudiante);
    await this.aplicarActualizacion(estudiante, dto, repo);
    return id;
  }

  private async aplicarActualizacion(estudiante: Estudiante, dto: ActualizarEstudianteDto,
    repo: Repository<Estudiante>): Promise<void> {
    const id = estudiante.id;
    const cedula =
      dto.cedula === undefined
        ? undefined
        : this.normalizarRequerido(dto.cedula, 'La cédula');
    const correo = dto.correoInstitucional?.trim().toLowerCase();
    if (cedula && cedula !== estudiante.cedula) {
      await this.validarDuplicados(estudiante.carreraId, cedula, undefined, id, repo);
      estudiante.cedula = cedula;
    }
    if (correo && correo !== estudiante.correoInstitucional) {
      await this.validarDuplicados(estudiante.carreraId, estudiante.cedula, correo, id, repo);
      estudiante.correoInstitucional = correo;
    }
    if (dto.nombres !== undefined)
      estudiante.nombres = this.normalizarRequerido(dto.nombres, 'Los nombres');
    if (dto.apellido1 !== undefined)
      estudiante.apellido1 = this.normalizarRequerido(
        dto.apellido1,
        'El primer apellido',
      );
    if (dto.apellido2 !== undefined)
      estudiante.apellido2 = dto.apellido2?.trim() || null;
    if (dto.telefono !== undefined)
      estudiante.telefono = dto.telefono?.trim() || null;
    try {
      await repo.save(estudiante);
    } catch (error) {
      this.relanzarDuplicado(error);
    }
  }

  async cambiarEstado(usuarioId: number, id: number, estado: EstadoEstudiante) {
    if (estado === EstadoEstudiante.GRADUADO) {
      throw new BadRequestException(
        'La graduación oficial no puede asignarse mediante un cambio genérico de estado. Requiere la evaluación de requisitos académicos y la confirmación oficial del coordinador.',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Estudiante);
      const estudiante = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
      await this.validarAlcance(usuarioId, estudiante.carreraId);
      await this.validarEscrituraJerarquica(usuarioId, estudiante.carreraId);
      this.validarExpedienteEditable(estudiante);
      estudiante.estado = estado;
      await repo.save(estudiante);
    });
    return this.obtenerPorId(usuarioId, id);
  }

  async cambiarEstadoDesdeSolicitud(coordinadorId: number, id: number, carreraId: number,
    estado: EstadoEstudiante, huellaOriginal: string, manager: EntityManager): Promise<number> {
    if (estado === EstadoEstudiante.GRADUADO) {
      throw new BadRequestException(
        'No se puede registrar la graduación oficial a través de una solicitud genérica de cambio de estado.',
      );
    }
    const repo = manager.getRepository(Estudiante);
    const estudiante = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carreraId !== carreraId || this.huellaEstudiante(estudiante) !== huellaOriginal) {
      throw new ConflictException('El estudiante cambió desde que se envió la solicitud.');
    }
    await this.validarAlcance(coordinadorId, carreraId);
    await this.validarEscrituraJerarquica(coordinadorId, carreraId);
    this.validarExpedienteEditable(estudiante);
    estudiante.estado = estado;
    await repo.save(estudiante);
    return id;
  }

  async listarHistorialAcademico(usuarioId: number, estudianteId: number) {
    await this.obtenerPorId(usuarioId, estudianteId);
    const historial = await this.historialAcademicoRepository.find({
      where: { estudianteId },
      relations: {
        planAsignatura: { curso: true, planEstudio: true },
        periodo: true,
        registradoPor: true,
      },
      order: { periodo: { anio: 'DESC', ciclo: 'DESC' }, createdAt: 'DESC' },
    });
    return historial.map((item) => this.mapearHistorialAcademicoSeguro(item));
  }

  async registrarResultado(
    usuarioId: number,
    estudianteId: number,
    dto: RegistrarResultadoAcademicoDto,
  ) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    this.validarExpedienteEditable(estudiante);

    await this.validarEscrituraJerarquica(usuarioId, estudiante.carreraId);
    const asignatura = await this.planAsignaturaRepository.findOne({
      where: { id: dto.planAsignaturaId },
    });
    if (
      !asignatura ||
      !asignatura.activo ||
      asignatura.planEstudioId !== estudiante.planEstudioId
    ) {
      throw new BadRequestException(
        'La asignatura no existe, está inactiva o no pertenece al plan actual del estudiante.',
      );
    }
    const periodo = await this.periodoRepository.findOne({
      where: { id: dto.periodoId },
    });
    if (!periodo) {
      throw new BadRequestException('El período académico no existe.');
    }
    this.validarPeriodoDesdeIngreso(
      periodo,
      estudiante.periodoIngreso,
      'El período del resultado académico',
    );
    return this.historialAcademicoRepository.save(
      this.historialAcademicoRepository.create({
        estudianteId,
        planAsignaturaId: dto.planAsignaturaId,
        periodoId: dto.periodoId,
        resultado: dto.resultado,
        origenAcademico: dto.origenAcademico,
        fuenteRegistro: FuenteRegistroAcademico.MANUAL,
        observaciones: dto.observaciones?.trim() || null,
        registradoPorUsuarioId: usuarioId,
      }),
    );
  }

  async registrarResultadoDesdeSolicitud(
    coordinadorId: number,
    estudianteId: number,
    carreraId: number,
    dto: RegistrarResultadoAcademicoDto,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(Estudiante);
    const estudiante = await repo.findOne({
      where: { id: estudianteId },
      relations: { periodoIngreso: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carreraId !== carreraId || this.huellaEstudiante(estudiante) !== huellaOriginal) {
      throw new ConflictException('El estudiante cambió desde que se envió la solicitud.');
    }
    await this.validarAlcance(coordinadorId, carreraId);
    await this.validarEscrituraJerarquica(coordinadorId, carreraId);
    this.validarExpedienteEditable(estudiante);

    const planAsignaturaRepo = manager.getRepository(PlanAsignatura);
    const asignatura = await planAsignaturaRepo.findOne({
      where: { id: dto.planAsignaturaId },
    });
    if (
      !asignatura ||
      !asignatura.activo ||
      asignatura.planEstudioId !== estudiante.planEstudioId
    ) {
      throw new BadRequestException(
        'La asignatura no existe, está inactiva o no pertenece al plan actual del estudiante.',
      );
    }
    const periodoRepo = manager.getRepository(PeriodoAcademico);
    const periodo = await periodoRepo.findOne({
      where: { id: dto.periodoId },
    });
    if (!periodo) {
      throw new BadRequestException('El período académico no existe.');
    }
    this.validarPeriodoDesdeIngreso(
      periodo,
      estudiante.periodoIngreso,
      'El período del resultado académico',
    );
    const historialRepo = manager.getRepository(HistorialAcademicoEstudiante);
    const guardado = await historialRepo.save(
      historialRepo.create({
        estudianteId,
        planAsignaturaId: dto.planAsignaturaId,
        periodoId: dto.periodoId,
        resultado: dto.resultado,
        origenAcademico: dto.origenAcademico,
        fuenteRegistro: FuenteRegistroAcademico.MANUAL,
        observaciones: dto.observaciones?.trim() || null,
        registradoPorUsuarioId: coordinadorId,
      }),
    );
    return guardado.id;
  }

  async listarHistorialPlanes(usuarioId: number, estudianteId: number) {
    await this.obtenerPorId(usuarioId, estudianteId);
    const historial = await this.historialPlanRepository.find({
      where: { estudianteId },
      relations: {
        planAnterior: true,
        planNuevo: true,
        periodoCambio: true,
        cambiadoPor: true,
      },
      order: { createdAt: 'DESC' },
    });
    return historial.map((item) => this.mapearHistorialPlanSeguro(item));
  }

  async cambiarPlan(
    usuarioId: number,
    estudianteId: number,
    dto: CambiarPlanEstudianteDto,
  ) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    await this.validarEscrituraJerarquica(usuarioId, estudiante.carreraId);
    const esPromocionGraduado =
      estudiante.estado === EstadoEstudiante.GRADUADO &&
      Boolean(dto.motivo && /continuidad|licenciatura|promoci[oó]n/i.test(dto.motivo));
    this.validarExpedienteEditable(estudiante, esPromocionGraduado);
    if (estudiante.planEstudioId === dto.planNuevoId)
      throw new ConflictException('El estudiante ya pertenece a ese plan.');
    const planNuevo = await this.planRepository.findOne({
      where: { id: dto.planNuevoId },
    });
    if (!planNuevo) throw new BadRequestException('El nuevo plan no existe.');
    if (!planNuevo.activo)
      throw new BadRequestException('El nuevo plan se encuentra inactivo.');
    let esEnTransicion = (planNuevo as any).estado === 'EN_TRANSICION';
    if (!esEnTransicion && this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        const ult = await this.dataSource.query(
          "SELECT valor_nuevo FROM auditoria_planes_estudio WHERE plan_estudio_id = ? AND tipo_modificacion IN ('CAMBIO_ESTADO', 'CIERRE', 'REAPERTURA') ORDER BY id DESC LIMIT 1",
          [dto.planNuevoId],
        );
        if (ult?.[0]?.valor_nuevo === 'EN_TRANSICION') {
          esEnTransicion = true;
        }
      } catch {}
    }
    if (esEnTransicion) {
      throw new BadRequestException(
        'El nuevo plan de estudio se encuentra EN TRANSICIÓN. No se admiten cambios de plan ordinarios hacia este plan.',
      );
    }
    if (planNuevo.carreraId !== estudiante.carreraId) {
      await this.validarAlcance(usuarioId, planNuevo.carreraId);
      await this.validarEscrituraJerarquica(usuarioId, planNuevo.carreraId);
    }
    const periodoCambio = await this.periodoRepository.findOne({
      where: { id: dto.periodoCambioId },
    });
    if (!periodoCambio) {
      throw new BadRequestException('El período de cambio no existe.');
    }
    this.validarPeriodoDesdeIngreso(
      periodoCambio,
      estudiante.periodoIngreso,
      'El período del cambio de plan',
    );
    await this.dataSource.transaction(async (manager) => {
      const estudiantes = manager.getRepository(Estudiante);
      const historiales = manager.getRepository(HistorialPlanEstudiante);
      const motivoHistorial = esPromocionGraduado
        ? `[GRADUACION_PREVIA: plan=${estudiante.planEstudioId}, fecha=${estudiante.fechaGraduacion ? new Date(estudiante.fechaGraduacion).toISOString() : 'N/A'}, usuario=${estudiante.graduadoPorUsuarioId || 'N/A'}] ${dto.motivo?.trim() || 'Continuidad académica a Licenciatura tras graduación'}`
        : dto.motivo?.trim() || null;

      await historiales.save(
        historiales.create({
          estudianteId,
          planAnteriorId: estudiante.planEstudioId,
          planNuevoId: dto.planNuevoId,
          periodoCambioId: dto.periodoCambioId,
          motivo: motivoHistorial,
          cambiadoPorUsuarioId: usuarioId,
        }),
      );
      const datosActualizacion: Partial<Estudiante> = {
        planEstudioId: dto.planNuevoId,
        carreraId: planNuevo.carreraId,
      };
      if (esPromocionGraduado) {
        datosActualizacion.estado = EstadoEstudiante.ACTIVO;
        await manager.query(
          `INSERT INTO auditoria_planes_estudio (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
           VALUES (?, 'CONTINUIDAD_LICENCIATURA', ?, ?, ?, ?, ?, NOW())`,
          [
            dto.planNuevoId,
            `Graduado Plan #${estudiante.planEstudioId}`,
            `Activo Plan #${dto.planNuevoId}`,
            dto.motivo?.trim() || 'Promoción académica de graduado a Licenciatura',
            usuarioId,
            JSON.stringify({
              estudianteId,
              planAnteriorId: estudiante.planEstudioId,
              fechaGraduacionAnterior: estudiante.fechaGraduacion,
              graduadoPorUsuarioId: estudiante.graduadoPorUsuarioId,
              observacionGraduacion: estudiante.observacionGraduacion,
            }),
          ],
        ).catch(() => null);
      }
      await estudiantes.update(estudianteId, datosActualizacion);

      if (dto.equivalenciaIds && dto.equivalenciaIds.length > 0) {
        const eqRepo = manager.getRepository(EquivalenciaPlan);
        const histRepo = manager.getRepository(HistorialAcademicoEstudiante);
        const equivalencias = await eqRepo.find({
          where: { id: In(dto.equivalenciaIds), activo: true },
        });
        for (const eq of equivalencias) {
          const yaAprobada = await histRepo.findOne({
            where: {
              estudianteId,
              planAsignaturaId: eq.asignaturaDestinoId,
              resultado: ResultadoAcademico.APROBADO,
            },
          });
          if (!yaAprobada) {
            await histRepo.save(
              histRepo.create({
                estudianteId,
                planAsignaturaId: eq.asignaturaDestinoId,
                resultado: ResultadoAcademico.APROBADO,
                origenAcademico: OrigenAcademico.EQUIVALENCIA,
                fuenteRegistro: FuenteRegistroAcademico.MANUAL,
                observaciones: `Convalidación aprobada en cambio de plan desde asignatura #${eq.asignaturaOrigenId}`,
                registradoPorUsuarioId: usuarioId,
              }),
            );
          }
        }
      }
    });
    return this.obtenerPorId(usuarioId, estudianteId);
  }

  async cambiarPlanDesdeSolicitud(
    coordinadorId: number,
    id: number,
    carreraId: number,
    dto: CambiarPlanEstudianteDto,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(Estudiante);
    const estudiante = await repo.findOne({
      where: { id },
      relations: { periodoIngreso: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carreraId !== carreraId || this.huellaEstudiante(estudiante) !== huellaOriginal) {
      throw new ConflictException('El estudiante cambió desde que se envió la solicitud.');
    }
    await this.validarAlcance(coordinadorId, carreraId);
    await this.validarEscrituraJerarquica(coordinadorId, carreraId);
    const esPromocionGraduado =
      estudiante.estado === EstadoEstudiante.GRADUADO &&
      Boolean(dto.motivo && /continuidad|licenciatura|promoci[oó]n/i.test(dto.motivo));
    this.validarExpedienteEditable(estudiante, esPromocionGraduado);
    if (estudiante.planEstudioId === dto.planNuevoId) {
      throw new ConflictException('El estudiante ya pertenece a ese plan.');
    }
    const planRepo = manager.getRepository(PlanEstudio);
    const planNuevo = await planRepo.findOne({ where: { id: dto.planNuevoId } });
    if (!planNuevo) throw new BadRequestException('El nuevo plan no existe.');
    if (!planNuevo.activo) throw new BadRequestException('El nuevo plan se encuentra inactivo.');
    let esEnTransicionSolicitud = (planNuevo as any).estado === 'EN_TRANSICION';
    if (!esEnTransicionSolicitud && this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        const ult = await this.dataSource.query(
          "SELECT valor_nuevo FROM auditoria_planes_estudio WHERE plan_estudio_id = ? AND tipo_modificacion IN ('CAMBIO_ESTADO', 'CIERRE', 'REAPERTURA') ORDER BY id DESC LIMIT 1",
          [dto.planNuevoId],
        );
        if (ult?.[0]?.valor_nuevo === 'EN_TRANSICION') {
          esEnTransicionSolicitud = true;
        }
      } catch {}
    }
    if (esEnTransicionSolicitud) {
      throw new BadRequestException(
        'El nuevo plan de estudio se encuentra EN TRANSICIÓN. No se admiten cambios de plan ordinarios hacia este plan.',
      );
    }
    if (planNuevo.carreraId !== estudiante.carreraId) {
      await this.validarAlcance(coordinadorId, planNuevo.carreraId);
      await this.validarEscrituraJerarquica(coordinadorId, planNuevo.carreraId);
    }
    const periodoRepo = manager.getRepository(PeriodoAcademico);
    const periodoCambio = await periodoRepo.findOne({ where: { id: dto.periodoCambioId } });
    if (!periodoCambio) throw new BadRequestException('El período de cambio no existe.');
    this.validarPeriodoDesdeIngreso(
      periodoCambio,
      estudiante.periodoIngreso,
      'El período del cambio de plan',
    );
    const motivoHistorialSolicitud = esPromocionGraduado
      ? `[GRADUACION_PREVIA: plan=${estudiante.planEstudioId}, fecha=${estudiante.fechaGraduacion ? new Date(estudiante.fechaGraduacion).toISOString() : 'N/A'}, usuario=${estudiante.graduadoPorUsuarioId || 'N/A'}] ${dto.motivo?.trim() || 'Continuidad académica a Licenciatura tras graduación'}`
      : dto.motivo?.trim() || null;

    const historiales = manager.getRepository(HistorialPlanEstudiante);
    await historiales.save(
      historiales.create({
        estudianteId: id,
        planAnteriorId: estudiante.planEstudioId,
        planNuevoId: dto.planNuevoId,
        periodoCambioId: dto.periodoCambioId,
        motivo: motivoHistorialSolicitud,
        cambiadoPorUsuarioId: coordinadorId,
      }),
    );
    estudiante.planEstudioId = dto.planNuevoId;
    if (planNuevo.carreraId !== estudiante.carreraId) {
      estudiante.carreraId = planNuevo.carreraId;
    }
    if (esPromocionGraduado) {
      estudiante.estado = EstadoEstudiante.ACTIVO;
      await manager.query(
        `INSERT INTO auditoria_planes_estudio (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
         VALUES (?, 'CONTINUIDAD_LICENCIATURA', ?, ?, ?, ?, ?, NOW())`,
        [
          dto.planNuevoId,
          `Graduado Plan #${estudiante.planEstudioId}`,
          `Activo Plan #${dto.planNuevoId}`,
          dto.motivo?.trim() || 'Promoción académica de graduado a Licenciatura',
          coordinadorId,
          JSON.stringify({
            estudianteId: id,
            planAnteriorId: estudiante.planEstudioId,
            fechaGraduacionAnterior: estudiante.fechaGraduacion,
            graduadoPorUsuarioId: estudiante.graduadoPorUsuarioId,
            observacionGraduacion: estudiante.observacionGraduacion,
          }),
        ],
      ).catch(() => null);
    }
    await repo.save(estudiante);

    if (dto.equivalenciaIds && dto.equivalenciaIds.length > 0) {
      const eqRepo = manager.getRepository(EquivalenciaPlan);
      const histRepo = manager.getRepository(HistorialAcademicoEstudiante);
      const equivalencias = await eqRepo.find({
        where: { id: In(dto.equivalenciaIds), activo: true },
      });
      for (const eq of equivalencias) {
        const yaAprobada = await histRepo.findOne({
          where: {
            estudianteId: id,
            planAsignaturaId: eq.asignaturaDestinoId,
            resultado: ResultadoAcademico.APROBADO,
          },
        });
        if (!yaAprobada) {
          await histRepo.save(
            histRepo.create({
              estudianteId: id,
              planAsignaturaId: eq.asignaturaDestinoId,
              resultado: ResultadoAcademico.APROBADO,
              origenAcademico: OrigenAcademico.EQUIVALENCIA,
              fuenteRegistro: FuenteRegistroAcademico.MANUAL,
              observaciones: `Convalidación aprobada desde solicitud de cambio de plan (asignatura #${eq.asignaturaOrigenId})`,
              registradoPorUsuarioId: coordinadorId,
            }),
          );
        }
      }
    }

    return id;
  }

  async validarDelegacionCompleta(
    coordinadorId: number,
    asistenteId: number,
    carreraId: number,
  ): Promise<void> {
    const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(coordinadorId);
    if (tipo === 'COORDINADOR') {
      const coordOk = await this.alcanceJerarquico.puedeEjecutar(
        coordinadorId,
        PermisoSistema.ESTUDIANTES_GESTIONAR,
        carreraId,
      );
      if (!coordOk) {
        throw new ForbiddenException('Coordinador sin permiso sobre la carrera.');
      }
    }
    const asisOk = await this.alcanceJerarquico.puedeEjecutar(
      asistenteId,
      PermisoSistema.ESTUDIANTES_GESTIONAR,
      carreraId,
    );
    if (!asisOk) {
      throw new ForbiddenException(
        'Asistente sin delegación para gestionar estudiantes en esta carrera.',
      );
    }
  }

  async obtenerProgreso(
    usuarioId: number,
    estudianteId: number,
    periodoReferenciaId: number,
  ) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    const periodoReferencia = await this.periodoRepository.findOne({
      where: { id: periodoReferenciaId },
    });
    if (!periodoReferencia)
      throw new BadRequestException('El período de referencia no existe.');
    this.validarPeriodoDesdeIngreso(
      periodoReferencia,
      estudiante.periodoIngreso,
      'El período de referencia',
    );
    const asignaturas = await this.planAsignaturaRepository.find({
      where: { planEstudioId: estudiante.planEstudioId, activo: true },
      relations: { curso: true },
      order: { nivel: 'ASC', ciclo: 'ASC', orden: 'ASC' },
    });
    const historial = await this.historialAcademicoRepository.find({
      where: { estudianteId },
      relations: { planAsignatura: true, periodo: true },
      order: { createdAt: 'ASC' },
    });
    const historialHastaReferencia = historial.filter((item) => {
      if (item.periodoId == null) {
        // Aprobaciones importadas desde Excel o Google Forms
        // no poseen período y se consideran antecedentes previos.
        return true;
      }
      if (!item.periodo) {
        return false;
      }
      return (
        item.periodo.anio < periodoReferencia.anio ||
        (item.periodo.anio === periodoReferencia.anio &&
          item.periodo.ciclo <= periodoReferencia.ciclo)
      );
    });
    const aprobadasIds = new Set(
      historialHastaReferencia
        .filter((item) => item.resultado === ResultadoAcademico.APROBADO)
        .map((item) => item.planAsignaturaId),
    );
    const cursosAprobadosIds = new Set(
      historialHastaReferencia
        .filter(
          (item) =>
            item.resultado === ResultadoAcademico.APROBADO &&
            item.planAsignatura?.cursoId != null,
        )
        .map((item) => item.planAsignatura.cursoId!),
    );
    const reprobadasIds = new Set(
      historialHastaReferencia
        .filter((item) => item.resultado === ResultadoAcademico.REPROBADO)
        .map((item) => item.planAsignaturaId),
    );
    const cursosReprobadosIds = new Set(
      historialHastaReferencia
        .filter(
          (item) =>
            item.resultado === ResultadoAcademico.REPROBADO &&
            item.planAsignatura?.cursoId != null,
        )
        .map((item) => item.planAsignatura.cursoId!),
    );
    const estaAprobada = (item: PlanAsignatura) =>
      aprobadasIds.has(item.id) ||
      (item.cursoId !== null && cursosAprobadosIds.has(item.cursoId));
    const estaReprobada = (item: PlanAsignatura) =>
      !estaAprobada(item) &&
      (reprobadasIds.has(item.id) ||
        (item.cursoId !== null && cursosReprobadosIds.has(item.cursoId)));
    const aprobadas = asignaturas.filter(estaAprobada);
    const reprobadas = asignaturas.filter(estaReprobada);
    const pendientes = asignaturas.filter((item) => !estaAprobada(item));
    const requisitos = pendientes.length
      ? await this.planRequisitoRepository.find({
          where: { asignaturaId: In(pendientes.map((item) => item.id)) },
          relations: { requisitoAsignatura: { curso: true } },
        })
      : [];
    const habilitadas = pendientes.map((asignatura) => {
      const relaciones = requisitos.filter(
        (item) => item.asignaturaId === asignatura.id,
      );
      const requisitosFaltantes = relaciones
        .filter(
          (item) =>
            item.tipo === TipoRequisito.REQUISITO &&
            !estaAprobada(item.requisitoAsignatura),
        )
        .map((item) => this.resumirAsignatura(item.requisitoAsignatura));
      const correquisitos = relaciones
        .filter((item) => item.tipo === TipoRequisito.CORREQUISITO)
        .map((item) => ({
          ...this.resumirAsignatura(item.requisitoAsignatura),
          aprobado: estaAprobada(item.requisitoAsignatura),
        }));
      return {
        ...this.resumirAsignatura(asignatura),
        habilitada: requisitosFaltantes.length === 0,
        requisitosFaltantes,
        correquisitos,
      };
    });
    const ciclosPorAnio = Math.max(
      2,
      periodoReferencia.ciclo,
      estudiante.periodoIngreso.ciclo,
      ...asignaturas.map((item) => item.ciclo),
    );
    const posicionReferencia =
      (periodoReferencia.anio - estudiante.periodoIngreso.anio) *
        ciclosPorAnio +
      (periodoReferencia.ciclo - estudiante.periodoIngreso.ciclo);
    const rezagadas = pendientes.filter(
      (item) =>
        (item.nivel - 1) * ciclosPorAnio + (item.ciclo - 1) <
        posicionReferencia,
    );
    return {
      estudiante,
      periodoReferencia,
      resumen: {
        totalPlan: asignaturas.length,
        aprobadas: aprobadas.length,
        reprobadas: reprobadas.length,
        pendientes: pendientes.length,
        rezagadas: rezagadas.length,
      },
      aprobadas: aprobadas.map((item) => this.resumirAsignatura(item)),
      reprobadas: reprobadas.map((item) => this.resumirAsignatura(item)),
      pendientes: pendientes.map((item) => this.resumirAsignatura(item)),
      habilitadas,
      rezagadas: rezagadas.map((item) => this.resumirAsignatura(item)),
    };
  }

  private mapearHistorialAcademicoSeguro(item: HistorialAcademicoEstudiante) {
    return {
      id: item.id,
      estudianteId: item.estudianteId,
      planAsignaturaId: item.planAsignaturaId,
      periodoId: item.periodoId,
      resultado: item.resultado,
      origenAcademico: item.origenAcademico,
      fuenteRegistro: item.fuenteRegistro,
      observaciones: item.observaciones,
      registradoPorUsuarioId: item.registradoPorUsuarioId,
      createdAt: item.createdAt,
      planAsignatura: item.planAsignatura,
      periodo: item.periodo,
      registradoPor: item.registradoPor
        ? {
            id: item.registradoPor.id,
            nombres: item.registradoPor.nombres,
            apellido1: item.registradoPor.apellido1,
            apellido2: item.registradoPor.apellido2,
            correo: item.registradoPor.correo,
          }
        : undefined,
    };
  }

  private mapearHistorialPlanSeguro(item: HistorialPlanEstudiante) {
    return {
      id: item.id,
      estudianteId: item.estudianteId,
      planAnteriorId: item.planAnteriorId,
      planNuevoId: item.planNuevoId,
      periodoCambioId: item.periodoCambioId,
      motivo: item.motivo,
      cambiadoPorUsuarioId: item.cambiadoPorUsuarioId,
      createdAt: item.createdAt,
      planAnterior: item.planAnterior,
      planNuevo: item.planNuevo,
      periodoCambio: item.periodoCambio,
      cambiadoPor: item.cambiadoPor
        ? {
            id: item.cambiadoPor.id,
            nombres: item.cambiadoPor.nombres,
            apellido1: item.cambiadoPor.apellido1,
            apellido2: item.cambiadoPor.apellido2,
            correo: item.cambiadoPor.correo,
          }
        : undefined,
    };
  }

  private resumirAsignatura(asignatura: PlanAsignatura) {
    return {
      planAsignaturaId: asignatura.id,
      codigo: asignatura.curso?.codigo ?? asignatura.codigoReferencia,
      nombre: asignatura.curso?.nombre ?? asignatura.nombreReferencia,
      nivel: asignatura.nivel,
      ciclo: asignatura.ciclo,
      creditos: asignatura.creditos,
    };
  }

  private normalizarRequerido(valor: string, nombreCampo: string): string {
    const normalizado = valor.trim();
    if (!normalizado) {
      throw new BadRequestException(`${nombreCampo} no puede quedar vacío.`);
    }
    return normalizado;
  }

  private validarPeriodoDesdeIngreso(
    periodo: PeriodoAcademico,
    periodoIngreso: PeriodoAcademico,
    nombrePeriodo: string,
  ): void {
    const esAnterior =
      periodo.anio < periodoIngreso.anio ||
      (periodo.anio === periodoIngreso.anio &&
        periodo.ciclo < periodoIngreso.ciclo);
    if (esAnterior) {
      throw new BadRequestException(
        `${nombrePeriodo} no puede ser anterior al período de ingreso.`,
      );
    }
  }

  private async obtenerEntidad(id: number) {
    const estudiante = await this.estudianteRepository.findOne({
      where: { id },
      relations: { carrera: true, planEstudio: true, periodoIngreso: true },
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    return estudiante;
  }

  private async validarAlcance(usuarioId: number, carreraId: number) {
    if (await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId)) {
      if (!(await this.alcanceJerarquico.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_VER, carreraId))) {
        throw new ForbiddenException('No posee permiso para consultar estudiantes de esta carrera.');
      }
      return;
    }
    if (
      !(await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        carreraId,
      ))
    ) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera del estudiante.',
      );
    }
  }

  private async validarEscrituraJerarquica(usuarioId: number, carreraId: number) {
    const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
    if (tipo === 'ASISTENTE_ESTUDIANTIL') {
      throw new ForbiddenException('La escritura del asistente requiere una solicitud aprobada.');
    }
    if (tipo === 'COORDINADOR' &&
      !(await this.alcanceJerarquico.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_GESTIONAR, carreraId))) {
      throw new ForbiddenException('No posee permiso para gestionar estudiantes de esta carrera.');
    }
  }

  private async validarDatosAcademicos(
    usuarioId: number,
    carreraId: number,
    planEstudioId: number,
    periodoIngresoId: number,
  ) {
    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });
    if (!carrera) throw new BadRequestException('La carrera no existe.');
    if (!carrera.activo)
      throw new BadRequestException('La carrera se encuentra inactiva.');
    await this.validarAlcance(usuarioId, carreraId);
    const plan = await this.planRepository.findOne({
      where: { id: planEstudioId },
    });
    if (!plan) throw new BadRequestException('El plan de estudio no existe.');
    if (!plan.activo)
      throw new BadRequestException(
        'El plan de estudio se encuentra inactivo.',
      );
    let esEnTransicion = (plan as any).estado === 'EN_TRANSICION';
    if (!esEnTransicion && this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        const ult = await this.dataSource.query(
          "SELECT valor_nuevo FROM auditoria_planes_estudio WHERE plan_estudio_id = ? AND tipo_modificacion IN ('CAMBIO_ESTADO', 'CIERRE', 'REAPERTURA') ORDER BY id DESC LIMIT 1",
          [planEstudioId],
        );
        if (ult?.[0]?.valor_nuevo === 'EN_TRANSICION') {
          esEnTransicion = true;
        }
      } catch {}
    }
    if (esEnTransicion) {
      throw new BadRequestException(
        'El plan de estudio se encuentra EN TRANSICIÓN. No se admiten nuevos ingresos ordinarios.',
      );
    }
    if (plan.carreraId !== carreraId)
      throw new BadRequestException(
        'El plan de estudio no pertenece a la carrera indicada.',
      );
    if (
      !(await this.periodoRepository.findOne({
        where: { id: periodoIngresoId },
      }))
    ) {
      throw new BadRequestException('El período de ingreso no existe.');
    }
  }

  private async validarDuplicados(
    carreraId: number,
    cedula?: string,
    correoInstitucional?: string,
    excluirId?: number,
    repo: Repository<Estudiante> = this.estudianteRepository,
  ) {
    const id = excluirId ? Not(excluirId) : undefined;
    if (cedula) {
      const existeEnCarrera = await repo.findOne({
        where: { carreraId, cedula, ...(id && { id }) },
      });
      if (existeEnCarrera) {
        throw new ConflictException('El estudiante con esta cédula ya está registrado en esta carrera.');
      }
    }
    if (correoInstitucional) {
      const existeConOtroCedula = await repo.findOne({
        where: {
          correoInstitucional,
          ...(cedula ? { cedula: Not(cedula) } : {}),
          ...(id && { id }),
        },
      });
      if (existeConOtroCedula) {
        throw new ConflictException(
          'Ya existe otro estudiante con ese correo institucional.',
        );
      }
    }
  }

  private relanzarDuplicado(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException(
        'La cédula o el correo ya están registrados.',
      );
    }
    throw error;
  }

  async diagnosticarReingreso(usuarioId: number, id: number) {
    const estudiante = await this.obtenerPorId(usuarioId, id);
    const plan = await this.planRepository.findOne({
      where: { id: estudiante.planEstudioId },
    });
    const planVigente = Boolean(plan && plan.activo);
    const planesDisponibles = await this.planRepository.find({
      where: { carreraId: estudiante.carreraId, activo: true },
      order: { codigo: 'ASC' },
    });

    let puedeReingresar = true;
    let motivoBloqueo: string | null = null;

    if (estudiante.estado === EstadoEstudiante.ACTIVO) {
      puedeReingresar = false;
      motivoBloqueo = 'El estudiante ya se encuentra activo.';
    } else if (estudiante.estado === EstadoEstudiante.GRADUADO) {
      puedeReingresar = false;
      motivoBloqueo = 'Un estudiante graduado no puede reingresar bajo el mismo expediente ordinario.';
    }

    return {
      estudianteId: id,
      estadoActual: estudiante.estado,
      puedeReingresar,
      motivoBloqueo,
      planActual: plan ? { id: plan.id, codigo: plan.codigo, nombre: plan.nombre, activo: plan.activo } : null,
      planVigente,
      requiereCambioPlan: !planVigente,
      planesDisponibles: planesDisponibles.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre })),
    };
  }

  async reingresar(usuarioId: number, id: number, dto?: ReingresarEstudianteDto) {
    const estudiante = await this.obtenerPorId(usuarioId, id);
    await this.validarEscrituraJerarquica(usuarioId, estudiante.carreraId);

    if (estudiante.estado === EstadoEstudiante.ACTIVO) {
      throw new ConflictException('El estudiante ya se encuentra activo.');
    }
    if (estudiante.estado === EstadoEstudiante.GRADUADO) {
      throw new ConflictException('Un estudiante graduado no puede reingresar bajo el mismo expediente.');
    }

    const plan = await this.planRepository.findOne({ where: { id: estudiante.planEstudioId } });
    const planInactivo = !plan || !plan.activo;

    if (planInactivo && !dto?.nuevoPlanId) {
      throw new BadRequestException(
        'El plan de estudio original del estudiante se encuentra inactivo y no permite continuar. Debe seleccionar un nuevo plan vigente para completar el reingreso.',
      );
    }

    if (dto?.nuevoPlanId) {
      if (!dto.periodoCambioId) {
        throw new BadRequestException('Debe indicar el período del cambio de plan para el reingreso.');
      }
      const planNuevo = await this.planRepository.findOne({ where: { id: dto.nuevoPlanId } });
      if (!planNuevo || !planNuevo.activo) {
        throw new BadRequestException('El nuevo plan seleccionado no existe o está inactivo.');
      }
      const periodoCambio = await this.periodoRepository.findOne({ where: { id: dto.periodoCambioId } });
      if (!periodoCambio) {
        throw new BadRequestException('El período de cambio no existe.');
      }

      await this.dataSource.transaction(async (manager) => {
        const estRepo = manager.getRepository(Estudiante);
        const histPlanRepo = manager.getRepository(HistorialPlanEstudiante);

        await histPlanRepo.save(
          histPlanRepo.create({
            estudianteId: id,
            planAnteriorId: estudiante.planEstudioId,
            planNuevoId: dto.nuevoPlanId!,
            periodoCambioId: dto.periodoCambioId!,
            motivo: dto.motivo?.trim() || 'Reingreso con cambio a plan vigente',
            cambiadoPorUsuarioId: usuarioId,
          }),
        );

        if (dto.equivalenciaIds && dto.equivalenciaIds.length > 0) {
          const eqRepo = manager.getRepository(EquivalenciaPlan);
          const histAcademicoRepo = manager.getRepository(HistorialAcademicoEstudiante);
          const equivalencias = await eqRepo.find({
            where: { id: In(dto.equivalenciaIds), activo: true },
          });

          for (const eq of equivalencias) {
            const yaAprobada = await histAcademicoRepo.findOne({
              where: {
                estudianteId: id,
                planAsignaturaId: eq.asignaturaDestinoId,
                resultado: ResultadoAcademico.APROBADO,
              },
            });
            if (!yaAprobada) {
              await histAcademicoRepo.save(
                histAcademicoRepo.create({
                  estudianteId: id,
                  planAsignaturaId: eq.asignaturaDestinoId,
                  resultado: ResultadoAcademico.APROBADO,
                  origenAcademico: OrigenAcademico.EQUIVALENCIA,
                  fuenteRegistro: FuenteRegistroAcademico.MANUAL,
                  observaciones: `Convalidación aprobada en reingreso desde asignatura #${eq.asignaturaOrigenId}`,
                  registradoPorUsuarioId: usuarioId,
                }),
              );
            }
          }
        }

        estudiante.estado = EstadoEstudiante.ACTIVO;
        estudiante.planEstudioId = dto.nuevoPlanId!;
        estudiante.carreraId = planNuevo.carreraId;
        await estRepo.save(estudiante);
      });
    } else {
      estudiante.estado = EstadoEstudiante.ACTIVO;
      await this.estudianteRepository.save(estudiante);
    }

    return {
      estudiante: await this.obtenerPorId(usuarioId, id),
      mensaje: 'Estudiante reactivado exitosamente.',
      cambioPlanRealizado: Boolean(dto?.nuevoPlanId),
    };
  }

  async reingresarDesdeSolicitud(
    coordinadorId: number,
    id: number,
    carreraId: number,
    dto: ReingresarEstudianteDto,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(Estudiante);
    const estudiante = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carreraId !== carreraId || this.huellaEstudiante(estudiante) !== huellaOriginal) {
      throw new ConflictException('El estudiante cambió desde que se envió la propuesta.');
    }
    await this.validarAlcance(coordinadorId, carreraId);
    await this.validarEscrituraJerarquica(coordinadorId, carreraId);

    if (estudiante.estado === EstadoEstudiante.ACTIVO) {
      throw new ConflictException('El estudiante ya se encuentra activo.');
    }
    if (estudiante.estado === EstadoEstudiante.GRADUADO) {
      throw new ConflictException('Un estudiante graduado no puede reingresar.');
    }

    if (dto.nuevoPlanId) {
      const planRepo = manager.getRepository(PlanEstudio);
      const planNuevo = await planRepo.findOne({ where: { id: dto.nuevoPlanId } });
      if (!planNuevo || !planNuevo.activo) {
        throw new BadRequestException('El plan nuevo no existe o está inactivo.');
      }
      const periodoRepo = manager.getRepository(PeriodoAcademico);
      const periodoCambio = await periodoRepo.findOne({ where: { id: dto.periodoCambioId } });
      if (!periodoCambio) throw new BadRequestException('El período de cambio no existe.');

      const histPlanRepo = manager.getRepository(HistorialPlanEstudiante);
      await histPlanRepo.save(
        histPlanRepo.create({
          estudianteId: id,
          planAnteriorId: estudiante.planEstudioId,
          planNuevoId: dto.nuevoPlanId,
          periodoCambioId: dto.periodoCambioId!,
          motivo: dto.motivo?.trim() || 'Reingreso autorizado desde propuesta de asistente',
          cambiadoPorUsuarioId: coordinadorId,
        }),
      );

      if (dto.equivalenciaIds && dto.equivalenciaIds.length > 0) {
        const eqRepo = manager.getRepository(EquivalenciaPlan);
        const histAcademicoRepo = manager.getRepository(HistorialAcademicoEstudiante);
        const equivalencias = await eqRepo.find({
          where: { id: In(dto.equivalenciaIds), activo: true },
        });

        for (const eq of equivalencias) {
          const yaAprobada = await histAcademicoRepo.findOne({
            where: {
              estudianteId: id,
              planAsignaturaId: eq.asignaturaDestinoId,
              resultado: ResultadoAcademico.APROBADO,
            },
          });
          if (!yaAprobada) {
            await histAcademicoRepo.save(
              histAcademicoRepo.create({
                estudianteId: id,
                planAsignaturaId: eq.asignaturaDestinoId,
                resultado: ResultadoAcademico.APROBADO,
                origenAcademico: OrigenAcademico.EQUIVALENCIA,
                fuenteRegistro: FuenteRegistroAcademico.MANUAL,
                observaciones: `Convalidación aprobada en reingreso desde propuesta (asignatura #${eq.asignaturaOrigenId})`,
                registradoPorUsuarioId: coordinadorId,
              }),
            );
          }
        }
      }

      estudiante.estado = EstadoEstudiante.ACTIVO;
      estudiante.planEstudioId = dto.nuevoPlanId;
      estudiante.carreraId = planNuevo.carreraId;
      await repo.save(estudiante);
    } else {
      estudiante.estado = EstadoEstudiante.ACTIVO;
      await repo.save(estudiante);
    }

    return id;
  }

  async compararPlanes(usuarioId: number, estudianteId: number, planNuevoId: number) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    const planOrigen = await this.planRepository.findOne({
      where: { id: estudiante.planEstudioId },
      relations: { carrera: true },
    });
    const planDestino = await this.planRepository.findOne({
      where: { id: planNuevoId },
      relations: { carrera: true },
    });

    if (!planOrigen) throw new NotFoundException('Plan de origen no encontrado.');
    if (!planDestino) throw new NotFoundException('Plan de destino no encontrado.');

    // Asignaturas aprobadas del estudiante en plan origen
    const historiales = await this.historialAcademicoRepository.find({
      where: { estudianteId, resultado: ResultadoAcademico.APROBADO },
      relations: { planAsignatura: { curso: true } },
    });
    const aprobadasOrigenIds = new Set(historiales.map((h) => h.planAsignaturaId));
    const cursosAprobadosIds = new Set(
      historiales.filter((h) => h.planAsignatura?.cursoId).map((h) => h.planAsignatura.cursoId!),
    );

    // Asignaturas del plan destino
    const asignaturasDestino = await this.planAsignaturaRepository.find({
      where: { planEstudioId: planNuevoId, activo: true },
      relations: { curso: true },
      order: { nivel: 'ASC', ciclo: 'ASC', orden: 'ASC' },
    });

    // Equivalencias aprobadas del plan origen al nuevo plan
    const eqRepo = this.equivalenciaRepository || this.dataSource.getRepository(EquivalenciaPlan);
    const equivalencias = await eqRepo.find({
      where: {
        planOrigenId: estudiante.planEstudioId,
        planDestinoId: planNuevoId,
        activo: true,
      },
      relations: {
        asignaturaOrigen: { curso: true },
        asignaturaDestino: { curso: true },
      },
    });

    const equivalenciasAplicables = equivalencias.filter((eq) => {
      const aprobadaPorId = aprobadasOrigenIds.has(eq.asignaturaOrigenId);
      const aprobadaPorCurso =
        eq.asignaturaOrigen.cursoId != null && cursosAprobadosIds.has(eq.asignaturaOrigen.cursoId);
      return aprobadaPorId || aprobadaPorCurso;
    });

    const destinoConvalidadasIds = new Set(equivalenciasAplicables.map((eq) => eq.asignaturaDestinoId));

    const obligatoriasDestino = asignaturasDestino.filter((a) => a.tipo !== TipoPlanAsignatura.OPTATIVA);
    const optativasDestino = asignaturasDestino.filter((a) => a.tipo === TipoPlanAsignatura.OPTATIVA);

    const materiasConvalidadas = asignaturasDestino.filter((a) => destinoConvalidadasIds.has(a.id));
    const materiasPendientesDestino = obligatoriasDestino.filter((a) => !destinoConvalidadasIds.has(a.id));

    const creditosTotalesDestino = asignaturasDestino.reduce((sum, a) => sum + (Number(a.creditos) || 0), 0);
    const creditosConvalidados = materiasConvalidadas.reduce((sum, a) => sum + (Number(a.creditos) || 0), 0);

    return {
      estudianteId,
      planOrigen: { id: planOrigen.id, codigo: planOrigen.codigo, nombre: planOrigen.nombre },
      planDestino: { id: planDestino.id, codigo: planDestino.codigo, nombre: planDestino.nombre },
      asignaturasAprobadasOrigen: historiales.map((h) => ({
        id: h.planAsignaturaId,
        codigo: h.planAsignatura?.curso?.codigo || h.planAsignatura?.codigoReferencia || '—',
        nombre: h.planAsignatura?.curso?.nombre || h.planAsignatura?.nombreReferencia || '—',
        creditos: Number(h.planAsignatura?.creditos) || 0,
      })),
      asignaturasDestino: {
        total: asignaturasDestino.length,
        obligatorias: obligatoriasDestino.length,
        optativas: optativasDestino.length,
      },
      equivalenciasDisponibles: equivalenciasAplicables.map((eq) => ({
        id: eq.id,
        origen: {
          id: eq.asignaturaOrigenId,
          codigo: eq.asignaturaOrigen.curso?.codigo || eq.asignaturaOrigen.codigoReferencia,
          nombre: eq.asignaturaOrigen.curso?.nombre || eq.asignaturaOrigen.nombreReferencia,
        },
        destino: {
          id: eq.asignaturaDestinoId,
          codigo: eq.asignaturaDestino.curso?.codigo || eq.asignaturaDestino.codigoReferencia,
          nombre: eq.asignaturaDestino.curso?.nombre || eq.asignaturaDestino.nombreReferencia,
        },
        justificacion: eq.justificacion,
      })),
      materiasConvalidadas: materiasConvalidadas.map((a) => this.resumirAsignatura(a)),
      materiasPendientesDestino: materiasPendientesDestino.map((a) => this.resumirAsignatura(a)),
      creditos: {
        totalDestino: creditosTotalesDestino,
        convalidados: creditosConvalidados,
        pendientes: Math.max(0, creditosTotalesDestino - creditosConvalidados),
      },
    };
  }

  async corregirResultado(
    usuarioId: number,
    estudianteId: number,
    historialId: number,
    dto: CorregirResultadoAcademicoDto,
  ) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    await this.validarEscrituraJerarquica(usuarioId, estudiante.carreraId);

    if (estudiante.estado === EstadoEstudiante.GRADUADO) {
      throw new ConflictException(
        'El expediente de un estudiante graduado no puede corregirse mediante el procedimiento ordinario. Requiere un trámite formal institucional.',
      );
    }

    const registroActual = await this.historialAcademicoRepository.findOne({
      where: { id: historialId, estudianteId },
      relations: { planAsignatura: true },
    });

    if (!registroActual) {
      throw new NotFoundException('Registro de historial académico no encontrado.');
    }

    if (!dto.motivo || dto.motivo.trim().length < 5) {
      throw new BadRequestException('El motivo de la corrección es obligatorio y debe tener al menos 5 caracteres.');
    }

    return this.dataSource.transaction(async (manager) => {
      const auditoriaRepo = manager.getRepository(AuditoriaHistorialAcademico);
      const histRepo = manager.getRepository(HistorialAcademicoEstudiante);

      await auditoriaRepo.save(
        auditoriaRepo.create({
          estudianteId,
          historialAcademicoId: historialId,
          carreraId: estudiante.carreraId,
          planAsignaturaId: registroActual.planAsignaturaId,
          resultadoAnterior: registroActual.resultado,
          resultadoNuevo: dto.resultado,
          origenAcademicoAnterior: registroActual.origenAcademico,
          origenAcademicoNuevo: dto.origenAcademico || registroActual.origenAcademico,
          observacionesAnteriores: registroActual.observaciones,
          observacionesNuevas: dto.observaciones !== undefined ? dto.observaciones : registroActual.observaciones,
          motivo: dto.motivo.trim(),
          usuarioResponsableId: usuarioId,
        }),
      );

      registroActual.resultado = dto.resultado;
      if (dto.origenAcademico) registroActual.origenAcademico = dto.origenAcademico;
      if (dto.observaciones !== undefined) registroActual.observaciones = dto.observaciones?.trim() || null;

      await histRepo.save(registroActual);

      return this.mapearHistorialAcademicoSeguro(registroActual);
    });
  }

  async corregirResultadoDesdeSolicitud(
    coordinadorId: number,
    estudianteId: number,
    carreraId: number,
    historialId: number,
    dto: CorregirResultadoAcademicoDto,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(Estudiante);
    const estudiante = await repo.findOne({ where: { id: estudianteId }, lock: { mode: 'pessimistic_write' } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    if (estudiante.carreraId !== carreraId || this.huellaEstudiante(estudiante) !== huellaOriginal) {
      throw new ConflictException('El estudiante cambió desde que se envió la solicitud.');
    }
    await this.validarAlcance(coordinadorId, carreraId);
    await this.validarEscrituraJerarquica(coordinadorId, carreraId);

    if (estudiante.estado === EstadoEstudiante.GRADUADO) {
      throw new ConflictException('No se puede corregir el expediente de un estudiante graduado.');
    }

    const histRepo = manager.getRepository(HistorialAcademicoEstudiante);
    const registroActual = await histRepo.findOne({
      where: { id: historialId, estudianteId },
      relations: { planAsignatura: true },
    });

    if (!registroActual) {
      throw new NotFoundException('Registro de historial académico no encontrado.');
    }

    const auditoriaRepo = manager.getRepository(AuditoriaHistorialAcademico);
    await auditoriaRepo.save(
      auditoriaRepo.create({
        estudianteId,
        historialAcademicoId: historialId,
        carreraId: estudiante.carreraId,
        planAsignaturaId: registroActual.planAsignaturaId,
        resultadoAnterior: registroActual.resultado,
        resultadoNuevo: dto.resultado,
        origenAcademicoAnterior: registroActual.origenAcademico,
        origenAcademicoNuevo: dto.origenAcademico || registroActual.origenAcademico,
        observacionesAnteriores: registroActual.observaciones,
        observacionesNuevas: dto.observaciones !== undefined ? dto.observaciones : registroActual.observaciones,
        motivo: dto.motivo.trim(),
        usuarioResponsableId: coordinadorId,
      }),
    );

    registroActual.resultado = dto.resultado;
    if (dto.origenAcademico) registroActual.origenAcademico = dto.origenAcademico;
    if (dto.observaciones !== undefined) registroActual.observaciones = dto.observaciones?.trim() || null;

    await histRepo.save(registroActual);
    return historialId;
  }

  async listarCorreccionesHistorial(usuarioId: number, estudianteId: number) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    const repo = this.auditoriaHistorialRepository || this.dataSource.getRepository(AuditoriaHistorialAcademico);
    const correcciones = await repo.find({
      where: { estudianteId: estudiante.id },
      relations: {
        planAsignatura: { curso: true },
        usuarioResponsable: true,
      },
      order: { createdAt: 'DESC' },
    });

    return correcciones.map((c) => ({
      id: c.id,
      historialAcademicoId: c.historialAcademicoId,
      asignaturaCodigo: c.planAsignatura?.curso?.codigo || c.planAsignatura?.codigoReferencia || '—',
      asignaturaNombre: c.planAsignatura?.curso?.nombre || c.planAsignatura?.nombreReferencia || '—',
      resultadoAnterior: c.resultadoAnterior,
      resultadoNuevo: c.resultadoNuevo,
      origenAcademicoAnterior: c.origenAcademicoAnterior,
      origenAcademicoNuevo: c.origenAcademicoNuevo,
      observacionesAnteriores: c.observacionesAnteriores,
      observacionesNuevas: c.observacionesNuevas,
      motivo: c.motivo,
      usuarioResponsable: c.usuarioResponsable
        ? `${c.usuarioResponsable.nombres} ${c.usuarioResponsable.apellido1}`
        : 'Usuario',
      createdAt: c.createdAt,
    }));
  }

  async evaluarGraduacion(usuarioId: number, id: number) {
    if (!this.evaluacionGraduacionService) {
      throw new Error('Servicio de evaluación de graduación no disponible.');
    }
    return this.evaluacionGraduacionService.evaluarGraduacion(usuarioId, id);
  }

  async graduarEstudiante(usuarioId: number, id: number, observacion?: string, salidaAcademicaId?: number) {
    if (!this.evaluacionGraduacionService) {
      throw new Error('Servicio de graduación no disponible.');
    }
    return this.evaluacionGraduacionService.confirmarGraduacion(usuarioId, id, observacion, salidaAcademicaId);
  }

  /**
   * Obtiene los identificadores de asignaturas del plan (planAsignaturaId) que un estudiante
   * ya tiene oficialmente aprobadas en su historial académico (o por equivalencias reconocidas)
   * dentro de una carrera específica.
   * Utilizado para validar prerrequisitos en formularios públicos sin exigir re-declaración.
   */
  async obtenerAsignaturasAprobadasPorCedula(
    carreraId: number,
    cedula: string,
  ): Promise<number[]> {
    if (!cedula || !carreraId) return [];

    const estudiante = await this.estudianteRepository.findOne({
      where: {
        carreraId,
        cedula: cedula.trim(),
      },
      select: { id: true, planEstudioId: true },
    });

    if (!estudiante) return [];

    // Solo asignaturas con resultado estrictamente APROBADO.
    // Una materia con resultado REPROBADO NUNCA debe considerarse aprobada por el simple hecho
    // de tener origen EQUIVALENCIA o RECONOCIMIENTO. Las aprobaciones y reconocimientos válidos
    // deben comprobarse siempre con resultados académicos coherentes.
    const aprobadas = await this.historialAcademicoRepository.find({
      where: {
        estudianteId: estudiante.id,
        resultado: ResultadoAcademico.APROBADO,
      },
      select: { planAsignaturaId: true, resultado: true },
    });

    const ids: number[] = aprobadas
      .filter((a) => a.resultado === ResultadoAcademico.APROBADO)
      .map((a) => a.planAsignaturaId);
    return [...new Set(ids)];
  }

  /**
   * Obtiene la relación oficial e individual de todos los títulos obtenidos por el estudiante
   * (Diplomado, Bachillerato, Licenciatura, etc.), preservados de manera independiente.
   */
  async obtenerTitulaciones(usuarioId: number, estudianteId: number) {
    const estudiante = await this.obtenerPorId(usuarioId, estudianteId);
    if (this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        const titulos = await this.dataSource.query(
          `SELECT t.id, t.estudiante_id, t.plan_estudio_id, t.carrera_id, t.salida_academica_id,
                  t.grado, t.nombre_titulo, t.fecha_graduacion, t.graduado_por_usuario_id,
                  t.observaciones, t.created_at,
                  p.codigo AS plan_codigo, p.nombre AS plan_nombre,
                  c.codigo AS carrera_codigo, c.nombre AS carrera_nombre
           FROM titulos_estudiantes t
           LEFT JOIN planes_estudio p ON p.id = t.plan_estudio_id
           LEFT JOIN carreras c ON c.id = t.carrera_id
           WHERE t.estudiante_id = ?
           ORDER BY t.fecha_graduacion ASC`,
          [estudiante.id],
        );
        if (Array.isArray(titulos) && titulos.length > 0) {
          return titulos;
        }
      } catch {
        // Fallback si la tabla aún no fue creada en MySQL físico
      }
    }

    if (estudiante.fechaGraduacion) {
      return [
        {
          id: 1,
          estudiante_id: estudiante.id,
          plan_estudio_id: estudiante.planEstudioId,
          carrera_id: estudiante.carreraId,
          salida_academica_id: null,
          grado: (estudiante.planEstudio as any)?.grado || 'BACHILLERATO',
          nombre_titulo: estudiante.planEstudio?.nombre || 'Título Oficial',
          fecha_graduacion: estudiante.fechaGraduacion,
          graduado_por_usuario_id: estudiante.graduadoPorUsuarioId,
          observaciones: estudiante.observacionGraduacion,
          plan_codigo: estudiante.planEstudio?.codigo,
          plan_nombre: estudiante.planEstudio?.nombre,
          carrera_codigo: estudiante.carrera?.codigo,
          carrera_nombre: estudiante.carrera?.nombre,
        },
      ];
    }
    return [];
  }
}
