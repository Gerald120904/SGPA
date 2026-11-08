import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { EquivalenciaPlan } from '../planes-estudio/entities/equivalencia-plan.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanRequisito } from '../planes-estudio/entities/plan-requisito.entity';
import { ReglaOptativaPlan } from '../planes-estudio/entities/regla-optativa-plan.entity';
import { SalidaAcademica } from '../planes-estudio/entities/salida-academica.entity';
import { CondicionAcademica } from './constants/condicion-academica.constant';
import { DictamenGraduacion } from './constants/dictamen-graduacion.constant';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { OrigenAcademico } from './constants/origen-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { TituloEstudiante } from './entities/titulo-estudiante.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  AsignaturaEvaluadaResumen,
  CategoriaOptativaEvaluada,
  ResultadoEvaluacionGraduacion,
} from './types/evaluacion-graduacion.types';

@Injectable()
export class EvaluacionGraduacionService {
  constructor(
    @InjectRepository(Estudiante)
    private readonly estudianteRepo: Repository<Estudiante>,
    @InjectRepository(HistorialAcademicoEstudiante)
    private readonly historialRepo: Repository<HistorialAcademicoEstudiante>,
    @InjectRepository(PlanEstudio)
    private readonly planRepo: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,
    @InjectRepository(PlanRequisito)
    private readonly planRequisitoRepo: Repository<PlanRequisito>,
    @InjectRepository(ReglaOptativaPlan)
    private readonly reglaOptativaRepo: Repository<ReglaOptativaPlan>,
    @InjectRepository(EquivalenciaPlan)
    private readonly equivalenciaRepo: Repository<EquivalenciaPlan>,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly alcanceJerarquico?: AlcanceJerarquicoService,
    @Optional()
    private readonly notificacionesService?: NotificacionesService,
  ) {}

  private async obtenerDestinatariosNotificacionCarrera(
    carreraId: number,
  ): Promise<number[]> {
    try {
      const candidatos = new Set<number>();

      if (this.dataSource && typeof this.dataSource.query === 'function') {
        const asig = await this.dataSource.query(
          `SELECT DISTINCT usuario_id FROM asignaciones_academicas
           WHERE activo = 1 AND (carrera_id = ? OR area_academica_id IN (SELECT area_academica_id FROM area_carreras WHERE carrera_id = ?))
             AND (fecha_inicio <= CURDATE() AND (fecha_fin IS NULL OR fecha_fin >= CURDATE()))`,
          [carreraId, carreraId],
        ).catch(() => []);
        for (const r of asig) {
          if (r.usuario_id) candidatos.add(Number(r.usuario_id));
        }

        const perm = await this.dataSource.query(
          `SELECT DISTINCT usuario_id FROM permisos_carrera WHERE carrera_id = ? AND activo = 1`,
          [carreraId],
        ).catch(() => []);
        for (const r of perm) {
          if (r.usuario_id) candidatos.add(Number(r.usuario_id));
        }

        const adm = await this.dataSource.query(
          `SELECT DISTINCT ur.usuario_id FROM usuario_roles ur
           JOIN roles r ON r.id = ur.rol_id
           JOIN usuarios u ON u.id = ur.usuario_id
           WHERE r.nombre = 'ADMIN_GLOBAL' AND r.activo = 1 AND u.activo = 1`,
        ).catch(() => []);
        for (const r of adm) {
          if (r.usuario_id) candidatos.add(Number(r.usuario_id));
        }
      }

      const destinatariosValidos: number[] = [];
      for (const destId of candidatos) {
        try {
          const tieneAlcance = await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
            destId,
            carreraId,
          );
          if (tieneAlcance) destinatariosValidos.push(destId);
        } catch {}
      }
      return destinatariosValidos;
    } catch {
      return [];
    }
  }

  private async validarLectura(usuarioId: number, carreraId: number): Promise<void> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo) {
        const puede = await this.alcanceJerarquico.puedeEjecutar(
          usuarioId,
          PermisoSistema.ESTUDIANTES_VER,
          carreraId,
        );
        if (!puede) {
          throw new ForbiddenException('No posee permiso para consultar el expediente de esta carrera.');
        }
        return;
      }
    }
    const tieneAlcance = await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(usuarioId, carreraId);
    if (!tieneAlcance) {
      throw new ForbiddenException('No posee alcance académico sobre la carrera del estudiante.');
    }
  }

  private async validarConfirmacionGraduacion(usuarioId: number, carreraId: number): Promise<void> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException('El asistente estudiantil no está autorizado para confirmar graduaciones.');
      }
      if (tipo === 'COORDINADOR') {
        const puede = await this.alcanceJerarquico.puedeEjecutar(
          usuarioId,
          PermisoSistema.ESTUDIANTES_GESTIONAR,
          carreraId,
        );
        if (!puede) {
          throw new ForbiddenException('No posee permiso para confirmar graduaciones en esta carrera.');
        }
        return;
      }
    }
    const tieneAlcance = await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(usuarioId, carreraId);
    if (!tieneAlcance) {
      throw new ForbiddenException('No posee alcance administrativo para confirmar graduaciones en esta carrera.');
    }
  }

  async evaluarGraduacion(
    usuarioId: number,
    estudianteId: number,
    salidaAcademicaId?: number,
  ): Promise<ResultadoEvaluacionGraduacion> {
    const estudiante = await this.estudianteRepo.findOne({
      where: { id: estudianteId },
      relations: {
        carrera: true,
        planEstudio: true,
        periodoIngreso: true,
      },
    });

    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado.');
    }

    await this.validarLectura(usuarioId, estudiante.carreraId);

    const plan = await this.planRepo.findOne({
      where: { id: estudiante.planEstudioId },
      relations: { carrera: true },
    });

    if (!plan) {
      throw new NotFoundException('El plan de estudio del estudiante no existe.');
    }

    let salida: SalidaAcademica | null = null;
    if (salidaAcademicaId) {
      salida = await this.dataSource.getRepository(SalidaAcademica).findOne({
        where: { id: salidaAcademicaId, planEstudioId: estudiante.planEstudioId, activo: true },
        relations: { asignaturas: { curso: true } },
      });
      if (!salida) {
        throw new NotFoundException('La salida académica solicitada no existe o no pertenece al plan del estudiante.');
      }
    }

    const asignaturasPlan = await this.planAsignaturaRepo.find({
      where: { planEstudioId: estudiante.planEstudioId, activo: true },
      relations: { curso: true },
      order: { nivel: 'ASC', ciclo: 'ASC', orden: 'ASC' },
    });

    const requisitos = asignaturasPlan.length
      ? await this.planRequisitoRepo.find({
          where: { asignaturaId: In(asignaturasPlan.map((a) => a.id)) },
          relations: { requisitoAsignatura: { curso: true } },
        })
      : [];

    const reglaOptativas = salida
      ? null
      : await this.reglaOptativaRepo.findOne({
          where: { planEstudioId: estudiante.planEstudioId },
        });

    const historiales = await this.historialRepo.find({
      where: {
        estudianteId,
        resultado: ResultadoAcademico.APROBADO,
      },
      relations: {
        planAsignatura: { curso: true },
        periodo: true,
      },
      order: { createdAt: 'ASC' },
    });

    // Mapeo seguro de asignaturas aprobadas sin duplicar
    const aprobadasPlanAsignaturaIds = new Set<number>();
    const aprobadasCursoIds = new Set<number>();
    const equivalenciasReconocidas: ResultadoEvaluacionGraduacion['equivalenciasReconocidas'] = [];
    const historialValidoPorAsignatura = new Map<number, HistorialAcademicoEstudiante>();

    for (const h of historiales) {
      if (h.planAsignatura?.tipo === TipoPlanAsignatura.OPTATIVA &&
          h.cursoOptativoId != null && h.reconocimientoOptativo !== 'RECONOCIDO') continue;
      if (h.origenAcademico === OrigenAcademico.EQUIVALENCIA) {
        equivalenciasReconocidas.push({
          id: h.planAsignaturaId,
          codigo: h.planAsignatura?.curso?.codigo || h.planAsignatura?.codigoReferencia || '—',
          nombre: h.planAsignatura?.curso?.nombre || h.planAsignatura?.nombreReferencia || '—',
          creditos: Number(h.planAsignatura?.creditos) || 0,
          observaciones: h.observaciones,
        });
      }

      if (h.planAsignaturaId) {
        aprobadasPlanAsignaturaIds.add(h.planAsignaturaId);
        if (!historialValidoPorAsignatura.has(h.planAsignaturaId)) {
          historialValidoPorAsignatura.set(h.planAsignaturaId, h);
        }
      }
      if (h.planAsignatura?.cursoId) {
        aprobadasCursoIds.add(h.planAsignatura.cursoId);
      }
    }

    const estaAprobada = (asig: PlanAsignatura): boolean => {
      if (aprobadasPlanAsignaturaIds.has(asig.id)) return true;
      if (asig.tipo === TipoPlanAsignatura.OPTATIVA) return false;
      if (asig.cursoId && aprobadasCursoIds.has(asig.cursoId)) return true;
      return false;
    };

    // Separación de obligatorias y optativas
    const obligatoriasPlan = salida
      ? ((salida.asignaturas && salida.asignaturas.length > 0)
          ? salida.asignaturas.filter((a) => a.activo !== false)
          : asignaturasPlan.filter((a) => a.tipo !== TipoPlanAsignatura.OPTATIVA))
      : asignaturasPlan.filter((a) => a.tipo !== TipoPlanAsignatura.OPTATIVA);
    const optativasPlan = salida ? [] : asignaturasPlan.filter((a) => a.tipo === TipoPlanAsignatura.OPTATIVA);

    const motivosBloqueo: string[] = [];

    // 1. Evaluación de obligatorias
    const obligatoriasCumplidas: AsignaturaEvaluadaResumen[] = [];
    const obligatoriasPendientes: AsignaturaEvaluadaResumen[] = [];

    for (const asig of obligatoriasPlan) {
      const aprobada = estaAprobada(asig);
      const h = historialValidoPorAsignatura.get(asig.id);
      const resumen: AsignaturaEvaluadaResumen = {
        id: asig.id,
        codigo: asig.curso?.codigo || asig.codigoReferencia || '—',
        nombre: asig.curso?.nombre || asig.nombreReferencia || '—',
        nivel: asig.nivel,
        ciclo: asig.ciclo,
        creditos: Number(asig.creditos) || 0,
        tipo: asig.tipo,
        tipoOptativa: asig.tipoOptativa,
        aprobada,
        origen: h?.origenAcademico,
        periodoNombre: h?.periodo ? `${h.periodo.anio}-${h.periodo.ciclo}` : undefined,
      };

      if (aprobada) {
        obligatoriasCumplidas.push(resumen);
      } else {
        obligatoriasPendientes.push(resumen);
      }
    }

    if (obligatoriasPendientes.length > 0) {
      const contextoObligatorias = salida ? `de la salida académica '${salida.nombre}'` : 'del plan de estudios';
      motivosBloqueo.push(
        `Faltan ${obligatoriasPendientes.length} asignaturas obligatorias por aprobar ${contextoObligatorias}.`,
      );
    }

    // 2. Evaluación de prerrequisitos de obligatorias aprobadas
    for (const asig of obligatoriasPlan) {
      if (estaAprobada(asig)) {
        const reqs = requisitos.filter(
          (r) => r.asignaturaId === asig.id && r.tipo === TipoRequisito.REQUISITO,
        );
        for (const req of reqs) {
          if (!estaAprobada(req.requisitoAsignatura)) {
            motivosBloqueo.push(
              `Inconsistencia curricular: La asignatura ${asig.curso?.codigo || asig.codigoReferencia} requiere haber aprobado ${req.requisitoAsignatura?.curso?.codigo || req.requisitoAsignatura?.codigoReferencia}.`,
            );
          }
        }
      }
    }

    // 3. Evaluación de Optativas
    const optativasAprobadasTodas = optativasPlan.filter(estaAprobada);

    const clasificarOptativas = (tipo: TipoOptativa): AsignaturaEvaluadaResumen[] => {
      return optativasAprobadasTodas
        .filter((a) => {
          const h = historialValidoPorAsignatura.get(a.id);
          return h?.cursoOptativoId != null ? h.tipoOptativaReal === tipo : a.tipoOptativa === tipo;
        })
        .map((asig) => {
          const h = historialValidoPorAsignatura.get(asig.id);
          return {
            id: asig.id,
            codigo: h?.codigoOptativaReal || asig.curso?.codigo || asig.codigoReferencia || '—',
            nombre: h?.nombreOptativaReal || asig.curso?.nombre || asig.nombreReferencia || '—',
            nivel: asig.nivel,
            ciclo: asig.ciclo,
            creditos: h?.cursoOptativoId != null ? Number(h.creditosReconocidos) || 0 : Number(asig.creditos) || 0,
            tipo: asig.tipo,
            tipoOptativa: h?.tipoOptativaReal || asig.tipoOptativa,
            aprobada: true,
            origen: h?.origenAcademico,
            periodoNombre: h?.periodo ? `${h.periodo.anio}-${h.periodo.ciclo}` : undefined,
          };
        });
    };

    const optDisciplinariasAprobadas = clasificarOptativas(TipoOptativa.DISCIPLINARIA);
    const optAbiertasAprobadas = clasificarOptativas(TipoOptativa.ABIERTA);
    const optSedeAprobadas = clasificarOptativas(TipoOptativa.SEDE);

    const reqDisciplinarias = reglaOptativas?.cantidadDisciplinarias || 0;
    const reqAbiertas = reglaOptativas?.cantidadAbiertas || 0;
    const reqSede = reglaOptativas?.cantidadSede || 0;

    const catDisciplinarias: CategoriaOptativaEvaluada = {
      requeridas: reqDisciplinarias,
      aprobadas: optDisciplinariasAprobadas.length,
      cumplidas: optDisciplinariasAprobadas.length >= reqDisciplinarias,
      asignaturas: optDisciplinariasAprobadas,
    };

    const catAbiertas: CategoriaOptativaEvaluada = {
      requeridas: reqAbiertas,
      aprobadas: optAbiertasAprobadas.length,
      cumplidas: optAbiertasAprobadas.length >= reqAbiertas,
      asignaturas: optAbiertasAprobadas,
    };

    const catSede: CategoriaOptativaEvaluada = {
      requeridas: reqSede,
      aprobadas: optSedeAprobadas.length,
      cumplidas: optSedeAprobadas.length >= reqSede,
      asignaturas: optSedeAprobadas,
    };

    let cumpleOptativas = true;
    if (reglaOptativas) {
      if (!catDisciplinarias.cumplidas) {
        cumpleOptativas = false;
        motivosBloqueo.push(
          `Optativas disciplinarias insuficientes: ${catDisciplinarias.aprobadas} de ${catDisciplinarias.requeridas} requeridas.`,
        );
      }
      if (!catAbiertas.cumplidas) {
        cumpleOptativas = false;
        motivosBloqueo.push(
          `Optativas abiertas insuficientes: ${catAbiertas.aprobadas} de ${catAbiertas.requeridas} requeridas.`,
        );
      }
      if (!catSede.cumplidas) {
        cumpleOptativas = false;
        motivosBloqueo.push(
          `Optativas de sede insuficientes: ${catSede.aprobadas} de ${catSede.requeridas} requeridas.`,
        );
      }
    } else if (optativasPlan.length > 0) {
      // Si el plan ofrece optativas pero no tiene regla formal configurada
      // Verificamos si existe ambigüedad curricular
      motivosBloqueo.push(
        'El plan contiene asignaturas optativas pero no posee una regla de distribución de optativas configurada.',
      );
      cumpleOptativas = false;
    }

    // 4. Créditos: sumas estrictas sin duplicar
    const creditosObligatoriosRequeridos = obligatoriasPlan.reduce(
      (sum, a) => sum + (Number(a.creditos) || 0),
      0,
    );

    // La exigencia de créditos procede de los espacios oficiales, sin promedios supuestos.
    const creditosOptativosRequeridos = optativasPlan.reduce(
      (sum, a) => sum + (Number(a.creditos) || 0), 0,
    );

    const creditosRequeridosTotal = salida
      ? (Number(salida.creditosRequeridos) || creditosObligatoriosRequeridos)
      : (creditosObligatoriosRequeridos + creditosOptativosRequeridos);

    // Créditos aprobados por el estudiante: suma de materias aprobadas únicas
    const creditosObligatoriosAprobados = obligatoriasCumplidas.reduce(
      (sum, a) => sum + a.creditos,
      0,
    );

    // Contamos solo las optativas aprobadas hasta el límite requerido por categoría
    // para no inflar créditos con asignaturas extra
    const optativasReconocidas = [
      ...optDisciplinariasAprobadas.slice(0, reqDisciplinarias),
      ...optAbiertasAprobadas.slice(0, reqAbiertas),
      ...optSedeAprobadas.slice(0, reqSede),
    ];
    const creditosOptativosAprobados = optativasReconocidas.reduce(
      (sum, a) => sum + a.creditos,
      0,
    );

    const creditosReconocidosEquivalencias = equivalenciasReconocidas.reduce(
      (sum, eq) => sum + eq.creditos,
      0,
    );

    const creditosHistorialTotal = historiales.reduce((sum, h) => {
      const c = h.planAsignatura?.creditos || h.creditosReconocidos || 0;
      return sum + (Number(c) || 0);
    }, 0);

    const creditosAprobadosTotal = salida
      ? Math.max(creditosObligatoriosAprobados, creditosHistorialTotal)
      : (creditosObligatoriosAprobados + creditosOptativosAprobados);

    const cumpleCreditos =
      creditosRequeridosTotal <= 0 || creditosAprobadosTotal >= creditosRequeridosTotal;

    if (!cumpleCreditos) {
      const contextoCreditos = salida ? `exigidos para la salida académica '${salida.nombre}'` : 'exigidos';
      motivosBloqueo.push(
        `Créditos insuficientes: cuenta con ${creditosAprobadosTotal} de ${creditosRequeridosTotal} créditos ${contextoCreditos}.`,
      );
    }

    // Dictamen y Condición Académica
    let dictamen: DictamenGraduacion;
    let condicionAcademica: CondicionAcademica;

    let yaTituladoSalida = false;
    if (salida) {
      try {
        const titulosSalida = await this.dataSource.query(
          `SELECT id FROM titulos_estudiantes WHERE estudiante_id = ? AND salida_academica_id = ? LIMIT 1`,
          [estudianteId, salida.id],
        );
        yaTituladoSalida = titulosSalida && titulosSalida.length > 0;
      } catch {}
    }

    if (salida ? yaTituladoSalida : estudiante.estado === EstadoEstudiante.GRADUADO) {
      dictamen = DictamenGraduacion.APTO;
      condicionAcademica = CondicionAcademica.GRADUADO;
    } else if (optativasPlan.length > 0 && !reglaOptativas) {
      dictamen = DictamenGraduacion.NO_EVALUABLE;
      condicionAcademica = CondicionAcademica.REGULAR;
    } else if (motivosBloqueo.length === 0) {
      dictamen = DictamenGraduacion.APTO;
      condicionAcademica = CondicionAcademica.EGRESADO;
    } else {
      dictamen = DictamenGraduacion.NO_APTO;
      condicionAcademica = CondicionAcademica.REGULAR;
    }

    const nombreCompleto = [estudiante.nombres, estudiante.apellido1, estudiante.apellido2]
      .filter(Boolean)
      .join(' ');

    return {
      dictamen,
      condicionAcademica,
      estudiante: {
        id: estudiante.id,
        cedula: estudiante.cedula,
        nombreCompleto,
        correoInstitucional: estudiante.correoInstitucional,
        carreraId: estudiante.carreraId,
        planEstudioId: estudiante.planEstudioId,
        estadoAdministrativo: estudiante.estado,
        fechaGraduacion: estudiante.fechaGraduacion,
        observacionGraduacion: estudiante.observacionGraduacion,
        graduadoPor: estudiante.graduadoPorUsuarioId
          ? {
              id: estudiante.graduadoPorUsuarioId,
              nombreCompleto: 'Usuario Coordinador',
            }
          : null,
      },
      carrera: {
        id: plan.carrera.id,
        codigo: plan.carrera.codigo,
        nombre: plan.carrera.nombre,
      },
      planEstudio: {
        id: plan.id,
        codigo: plan.codigo,
        nombre: plan.nombre,
        activo: plan.activo,
      },
      salidaAcademica: salida
        ? {
            id: salida.id,
            codigo: salida.codigo,
            nombre: salida.nombre,
            tipo: salida.tipo,
            creditosRequeridos: Number(salida.creditosRequeridos) || 0,
          }
        : null,
      obligatorias: {
        total: obligatoriasPlan.length,
        aprobadasCount: obligatoriasCumplidas.length,
        pendientesCount: obligatoriasPendientes.length,
        cumplidas: obligatoriasCumplidas,
        pendientes: obligatoriasPendientes,
      },
      optativas: {
        reglaDefinida: Boolean(reglaOptativas),
        disciplinarias: catDisciplinarias,
        abiertas: catAbiertas,
        sede: catSede,
        cumpleDistribucion: cumpleOptativas,
      },
      creditos: {
        requeridosTotal: creditosRequeridosTotal,
        obligatoriosRequeridos: creditosObligatoriosRequeridos,
        aprobadosTotal: creditosAprobadosTotal,
        obligatoriosAprobados: creditosObligatoriosAprobados,
        optativosAprobados: creditosOptativosAprobados,
        reconocidosEquivalencias: creditosReconocidosEquivalencias,
        cumpleCreditos,
      },
      equivalenciasReconocidas,
      motivosBloqueo,
      cumpleTodosLosRequisitos: motivosBloqueo.length === 0,
    };
  }

  async confirmarGraduacion(
    usuarioId: number,
    estudianteId: number,
    observacion?: string,
    salidaAcademicaId?: number,
  ): Promise<ResultadoEvaluacionGraduacion> {
    const estudiante = await this.estudianteRepo.findOne({
      where: { id: estudianteId },
    });

    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado.');
    }

    await this.validarConfirmacionGraduacion(usuarioId, estudiante.carreraId);

    if (estudiante.estado === EstadoEstudiante.GRADUADO && !salidaAcademicaId) {
      throw new ConflictException('El estudiante ya se encuentra graduado oficialmente.');
    }

    // Revalidación inmediata de requisitos
    const evaluacion = await this.evaluarGraduacion(usuarioId, estudianteId, salidaAcademicaId);

    if (evaluacion.dictamen !== DictamenGraduacion.APTO) {
      throw new ConflictException(
        `No es posible registrar la graduación: el estudiante no es apto. ${evaluacion.motivosBloqueo.join(' ')}`,
      );
    }

    let tituloIdGenerado: number | null = null;
    let gradoNotif: string = '';
    let nombreTituloNotif: string = '';
    let salidaIdNotif: number | null = null;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Estudiante);
      const estActual = await repo.findOne({
        where: { id: estudianteId },
        relations: { planEstudio: true, carrera: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!estActual) throw new NotFoundException('Estudiante no encontrado.');

      if (estActual.estado === EstadoEstudiante.GRADUADO && !salidaAcademicaId) {
        throw new ConflictException('El estudiante ya se encuentra graduado oficialmente.');
      }

      // Re-verificación concurrente de calificaciones y requisitos bajo bloqueo
      const historialesActuales = await manager.getRepository(HistorialAcademicoEstudiante).find({
        where: {
          estudianteId,
          resultado: ResultadoAcademico.APROBADO,
        },
        relations: { planAsignatura: { curso: true } },
      });

      const aprobadasActualesPlanIds = new Set(
        historialesActuales
          .map((h) => h.planAsignaturaId)
          .filter((id): id is number => typeof id === 'number'),
      );
      const aprobadasActualesCursoIds = new Set(
        historialesActuales
          .map((h) => h.planAsignatura?.cursoId)
          .filter((id): id is number => typeof id === 'number'),
      );

      const obligatoriaPerdida = evaluacion.obligatorias.cumplidas.some(
        (asig) => !aprobadasActualesPlanIds.has(asig.id) && (!asig.codigo || !aprobadasActualesCursoIds.has(asig.id)),
      );

      if (obligatoriaPerdida) {
        throw new ConflictException(
          'Las calificaciones o requisitos académicos cambiaron concurrentemente durante la aprobación. Operación cancelada.',
        );
      }

      const creditosActuales = historialesActuales.reduce((sum, h) => {
        const c = h.planAsignatura?.creditos || h.creditosReconocidos || 0;
        return sum + (Number(c) || 0);
      }, 0);

      if (evaluacion.creditos.requeridosTotal > 0 && creditosActuales < evaluacion.creditos.requeridosTotal) {
        throw new ConflictException(
          'Las calificaciones o requisitos académicos cambiaron concurrentemente durante la aprobación. Operación cancelada.',
        );
      }

      let gradoTitulo = estActual.planEstudio?.grado || 'BACHILLERATO';
      let nombreTitulo = estActual.planEstudio?.nombre || 'Título Oficial';
      let salidaIdNormalizada: number | null = null;

      if (salidaAcademicaId) {
        const salida = await manager.getRepository(SalidaAcademica).findOne({
          where: { id: salidaAcademicaId, planEstudioId: estActual.planEstudioId },
        });
        if (!salida) {
          throw new NotFoundException('La salida académica especificada no pertenece al plan del estudiante.');
        }
        salidaIdNormalizada = salida.id;
        gradoTitulo = (salida.tipo as any) || gradoTitulo;
        nombreTitulo = salida.nombre || nombreTitulo;
      }

      // Comprobar si ya existe un registro previo para el mismo grado y salida académica
      const titulosPrevios = await manager.query(
        `SELECT id, nombre_titulo, fecha_graduacion, graduado_por_usuario_id
         FROM titulos_estudiantes
         WHERE estudiante_id = ?
           AND plan_estudio_id = ?
           AND grado = ?
           AND (
             (salida_academica_id IS NULL AND ? IS NULL)
             OR salida_academica_id = ?
           )
         LIMIT 1`,
        [estudianteId, estActual.planEstudioId, gradoTitulo, salidaIdNormalizada, salidaIdNormalizada],
      );

      if (titulosPrevios && titulosPrevios.length > 0) {
        const previo = titulosPrevios[0];
        if (previo.nombre_titulo !== nombreTitulo) {
          throw new ConflictException(
            `Conflicto académico: El estudiante ya cuenta con la titulación oficial '${previo.nombre_titulo}' registrada para este grado/salida. No puede sobrescribirse con '${nombreTitulo}'.`,
          );
        }
        // Repetición idéntica: preservar fechas, responsables y auditoría originales.
        return;
      } else {
        if (!salidaAcademicaId) estActual.estado = EstadoEstudiante.GRADUADO;
        const fechaAprobacion = new Date();
        if (!estActual.fechaGraduacion) {
          estActual.fechaGraduacion = fechaAprobacion;
          estActual.graduadoPorUsuarioId = usuarioId;
          estActual.observacionGraduacion = observacion?.trim() || null;
        }
        await repo.save(estActual);
        const insertado = await manager.query(
          `INSERT INTO titulos_estudiantes (estudiante_id, plan_estudio_id, carrera_id, salida_academica_id, grado, nombre_titulo, fecha_graduacion, graduado_por_usuario_id, observaciones, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            estudianteId,
            estActual.planEstudioId,
            estActual.carreraId,
            salidaIdNormalizada,
            gradoTitulo,
            nombreTitulo,
            fechaAprobacion,
            usuarioId,
            observacion?.trim() || null,
          ],
        );
        tituloIdGenerado = insertado.insertId;
        gradoNotif = gradoTitulo;
        nombreTituloNotif = nombreTitulo;
        salidaIdNotif = salidaIdNormalizada;
        await manager.query(`INSERT INTO auditoria_titulos_estudiantes
          (titulo_id, usuario_id, accion, motivo, datos_json)
          VALUES (?, ?, 'APROBACION', ?, ?)`, [insertado.insertId, usuarioId,
          observacion?.trim() || 'Aprobación de graduación', JSON.stringify({
            estudianteId, planEstudioId: estActual.planEstudioId, salidaAcademicaId: salidaIdNormalizada,
            estadoEntrega: 'PENDIENTE', nombreTitulo,
          })]);
      }

      // Registrar hito de graduación en auditoría de planes
      await manager.query(
        `INSERT INTO auditoria_planes_estudio (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
         VALUES (?, 'GRADUACION_OFICIAL', 'ACTIVO', 'GRADUADO', ?, ?, ?, NOW())`,
        [
          estActual.planEstudioId,
          observacion?.trim() || `Graduación oficial confirmada (${nombreTitulo})`,
          usuarioId,
          JSON.stringify({
            estudianteId,
            cedula: estActual.cedula,
            planEstudioId: estActual.planEstudioId,
            carreraId: estActual.carreraId,
            salidaAcademicaId: salidaIdNormalizada,
            grado: gradoTitulo,
            nombreTitulo,
            fechaGraduacion: estActual.fechaGraduacion,
            observacionGraduacion: estActual.observacionGraduacion,
          }),
        ],
      );

      if (this.notificacionesService && tituloIdGenerado) {
        const destinatarios = await this.obtenerDestinatariosNotificacionCarrera(estudiante.carreraId);
        for (const destId of destinatarios) {
          await this.notificacionesService.crear({
            claveIdempotencia: `notif:graduacion:${tituloIdGenerado}:${destId}`,
            usuarioId: destId,
            carreraId: estudiante.carreraId,
            titulo: 'Aprobación oficial de graduación',
            mensaje: `Se aprobó oficialmente la graduación del estudiante ${estudiante.cedula} (${estudiante.nombres} ${estudiante.apellido1}) para el título "${nombreTituloNotif}" (${gradoNotif}).${observacion ? ` Observación: ${observacion.trim()}.` : ''}`,
            tipo: 'EXITO',
            enlace: `/estudiantes/${estudianteId}/graduacion`,
            metadatos: {
              estudianteId,
              carreraId: estudiante.carreraId,
              tituloId: tituloIdGenerado,
              grado: gradoNotif,
              nombreTitulo: nombreTituloNotif,
              salidaAcademicaId: salidaIdNotif,
              usuarioResponsableId: usuarioId,
              observacion: observacion?.trim() || null,
            },
          }, manager);
        }
      }
    });

    return this.evaluarGraduacion(usuarioId, estudianteId, salidaAcademicaId);
  }

  async entregarTitulo(usuarioId: number, estudianteId: number, tituloId: number, motivo: string): Promise<TituloEstudiante> {
    const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';
    if (motivoLimpio.length < 5 || motivoLimpio.length > 500) {
      throw new BadRequestException('El motivo de entrega debe tener entre 5 y 500 caracteres.');
    }
    const estudiante = await this.estudianteRepo.findOne({ where: { id: estudianteId } });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
    await this.validarConfirmacionGraduacion(usuarioId, estudiante.carreraId);

    return this.dataSource.transaction(async (manager) => {
      const estActual = await manager.getRepository(Estudiante).findOne({
        where: { id: estudianteId }, lock: { mode: 'pessimistic_write' },
      });
      if (!estActual || estActual.carreraId !== estudiante.carreraId) {
        throw new ConflictException('El expediente cambió durante la entrega.');
      }
      const repo = manager.getRepository(TituloEstudiante);
      const titulo = await repo.findOne({ where: { id: tituloId, estudianteId },
        lock: { mode: 'pessimistic_write' } });
      if (!titulo) throw new NotFoundException('Título aprobado no encontrado para el estudiante.');
      if (titulo.estadoEntrega === 'ENTREGADO' || titulo.entregadoAt) {
        throw new ConflictException('Este título ya fue entregado.');
      }
      if (titulo.estadoEntrega !== 'PENDIENTE') {
        throw new ConflictException('El título no está aprobado para entrega.');
      }
      titulo.estadoEntrega = 'ENTREGADO';
      titulo.entregadoAt = new Date();
      titulo.entregadoPorUsuarioId = usuarioId;
      titulo.motivoEntrega = motivoLimpio;
      await repo.save(titulo);
      await manager.query(`INSERT INTO auditoria_titulos_estudiantes
        (titulo_id, usuario_id, accion, motivo, datos_json)
        VALUES (?, ?, 'ENTREGA', ?, ?)`, [titulo.id, usuarioId, motivoLimpio,
        JSON.stringify({ estudianteId, anterior: 'PENDIENTE', nuevo: 'ENTREGADO',
          entregadoAt: titulo.entregadoAt })]);
      return titulo;
    });
  }
}

