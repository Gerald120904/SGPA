import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  Like,
  Not,
  Repository,
} from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanRequisito } from '../planes-estudio/entities/plan-requisito.entity';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { ActualizarEstudianteDto } from './dto/actualizar-estudiante.dto';
import { CambiarPlanEstudianteDto } from './dto/cambiar-plan-estudiante.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarResultadoAcademicoDto } from './dto/registrar-resultado-academico.dto';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { HistorialPlanEstudiante } from './entities/historial-plan-estudiante.entity';

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
  ) {}

  async listar(usuarioId: number, filtros: FiltrarEstudiantesDto) {
    const carreraIds =
      await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(
        usuarioId,
      );
    if (
      !carreraIds.length ||
      (filtros.carreraId && !carreraIds.includes(filtros.carreraId))
    )
      return [];
    const base: FindOptionsWhere<Estudiante> = {
      carreraId: filtros.carreraId ?? In(carreraIds),
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

  async obtenerPorId(usuarioId: number, id: number) {
    const estudiante = await this.obtenerEntidad(id);
    await this.validarAlcance(usuarioId, estudiante.carreraId);
    return estudiante;
  }

  async crear(usuarioId: number, dto: CrearEstudianteDto) {
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
    await this.validarDuplicados(cedula, correoInstitucional);
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

  async actualizar(
    usuarioId: number,
    id: number,
    dto: ActualizarEstudianteDto,
  ) {
    const estudiante = await this.obtenerPorId(usuarioId, id);
    const cedula =
      dto.cedula === undefined
        ? undefined
        : this.normalizarRequerido(dto.cedula, 'La cédula');
    const correo = dto.correoInstitucional?.trim().toLowerCase();
    if (cedula && cedula !== estudiante.cedula) {
      await this.validarDuplicados(cedula, undefined, id);
      estudiante.cedula = cedula;
    }
    if (correo && correo !== estudiante.correoInstitucional) {
      await this.validarDuplicados(undefined, correo, id);
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
      await this.estudianteRepository.save(estudiante);
      return this.obtenerPorId(usuarioId, id);
    } catch (error) {
      this.relanzarDuplicado(error);
    }
  }

  async cambiarEstado(usuarioId: number, id: number, estado: EstadoEstudiante) {
    const estudiante = await this.obtenerPorId(usuarioId, id);
    estudiante.estado = estado;
    await this.estudianteRepository.save(estudiante);
    return this.obtenerPorId(usuarioId, id);
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
    const asignatura = await this.planAsignaturaRepository.findOne({
      where: { id: dto.planAsignaturaId },
    });
    if (!asignatura || asignatura.planEstudioId !== estudiante.planEstudioId) {
      throw new BadRequestException(
        'La asignatura no pertenece al plan actual del estudiante.',
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
    if (estudiante.planEstudioId === dto.planNuevoId)
      throw new ConflictException('El estudiante ya pertenece a ese plan.');
    const planNuevo = await this.planRepository.findOne({
      where: { id: dto.planNuevoId },
    });
    if (!planNuevo) throw new BadRequestException('El nuevo plan no existe.');
    if (!planNuevo.activo)
      throw new BadRequestException('El nuevo plan se encuentra inactivo.');
    if (planNuevo.carreraId !== estudiante.carreraId) {
      throw new BadRequestException(
        'El nuevo plan no pertenece a la carrera del estudiante.',
      );
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
      await historiales.save(
        historiales.create({
          estudianteId,
          planAnteriorId: estudiante.planEstudioId,
          planNuevoId: dto.planNuevoId,
          periodoCambioId: dto.periodoCambioId,
          motivo: dto.motivo?.trim() || null,
          cambiadoPorUsuarioId: usuarioId,
        }),
      );
      await estudiantes.update(estudianteId, {
        planEstudioId: dto.planNuevoId,
      });
    });
    return this.obtenerPorId(usuarioId, estudianteId);
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
    const aprobadasIds = new Set(
      historial
        .filter((item) => item.resultado === ResultadoAcademico.APROBADO)
        .map((item) => item.planAsignaturaId),
    );
    const cursosAprobadosIds = new Set(
      historial
        .filter(
          (item) =>
            item.resultado === ResultadoAcademico.APROBADO &&
            item.planAsignatura?.cursoId != null,
        )
        .map((item) => item.planAsignatura.cursoId!),
    );
    const reprobadasIds = new Set(
      historial
        .filter((item) => item.resultado === ResultadoAcademico.REPROBADO)
        .map((item) => item.planAsignaturaId),
    );
    const cursosReprobadosIds = new Set(
      historial
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
    cedula?: string,
    correoInstitucional?: string,
    excluirId?: number,
  ) {
    const id = excluirId ? Not(excluirId) : undefined;
    if (
      cedula &&
      (await this.estudianteRepository.findOne({
        where: { cedula, ...(id && { id }) },
      }))
    ) {
      throw new ConflictException('Ya existe un estudiante con esa cédula.');
    }
    if (
      correoInstitucional &&
      (await this.estudianteRepository.findOne({
        where: { correoInstitucional, ...(id && { id }) },
      }))
    ) {
      throw new ConflictException(
        'Ya existe un estudiante con ese correo institucional.',
      );
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
}
