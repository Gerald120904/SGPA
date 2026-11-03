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
  ) {}

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

    const reglaOptativas = await this.reglaOptativaRepo.findOne({
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
      if (asig.cursoId && aprobadasCursoIds.has(asig.cursoId)) return true;
      return false;
    };

    // Separación de obligatorias y optativas
    const obligatoriasPlan = asignaturasPlan.filter((a) => a.tipo !== TipoPlanAsignatura.OPTATIVA);
    const optativasPlan = asignaturasPlan.filter((a) => a.tipo === TipoPlanAsignatura.OPTATIVA);

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
      motivosBloqueo.push(
        `Faltan ${obligatoriasPendientes.length} asignaturas obligatorias por aprobar del plan de estudios.`,
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
        .filter((a) => a.tipoOptativa === tipo)
        .map((asig) => {
          const h = historialValidoPorAsignatura.get(asig.id);
          return {
            id: asig.id,
            codigo: asig.curso?.codigo || asig.codigoReferencia || '—',
            nombre: asig.curso?.nombre || asig.nombreReferencia || '—',
            nivel: asig.nivel,
            ciclo: asig.ciclo,
            creditos: Number(asig.creditos) || 0,
            tipo: asig.tipo,
            tipoOptativa: asig.tipoOptativa,
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

    // Créditos requeridos por optativas según la regla
    let creditosOptativosRequeridos = 0;
    if (reglaOptativas) {
      const promedioCreditosOptativa = optativasPlan.length
        ? Math.round(
            optativasPlan.reduce((sum, a) => sum + (Number(a.creditos) || 0), 0) /
              optativasPlan.length,
          ) || 3
        : 3;
      creditosOptativosRequeridos =
        (reqDisciplinarias + reqAbiertas + reqSede) * promedioCreditosOptativa;
    }

    const creditosRequeridosTotal =
      creditosObligatoriosRequeridos + creditosOptativosRequeridos;

    // Créditos aprobados por el estudiante: suma de materias aprobadas únicas
    const creditosObligatoriosAprobados = obligatoriasCumplidas.reduce(
      (sum, a) => sum + a.creditos,
      0,
    );

    // Contamos solo las optativas aprobadas hasta el límite requerido por categoría
    // para no inflar créditos con asignaturas extra
    const optativasReconocidas = [
      ...optDisciplinariasAprobadas.slice(0, reqDisciplinarias || optDisciplinariasAprobadas.length),
      ...optAbiertasAprobadas.slice(0, reqAbiertas || optAbiertasAprobadas.length),
      ...optSedeAprobadas.slice(0, reqSede || optSedeAprobadas.length),
    ];
    const creditosOptativosAprobados = optativasReconocidas.reduce(
      (sum, a) => sum + a.creditos,
      0,
    );

    const creditosReconocidosEquivalencias = equivalenciasReconocidas.reduce(
      (sum, eq) => sum + eq.creditos,
      0,
    );

    const creditosAprobadosTotal =
      creditosObligatoriosAprobados + creditosOptativosAprobados;

    const cumpleCreditos =
      creditosRequeridosTotal <= 0 || creditosAprobadosTotal >= creditosRequeridosTotal;

    if (!cumpleCreditos) {
      motivosBloqueo.push(
        `Créditos insuficientes: cuenta con ${creditosAprobadosTotal} de ${creditosRequeridosTotal} créditos exigidos.`,
      );
    }

    // Dictamen y Condición Académica
    let dictamen: DictamenGraduacion;
    let condicionAcademica: CondicionAcademica;

    if (estudiante.estado === EstadoEstudiante.GRADUADO) {
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
    const evaluacion = await this.evaluarGraduacion(usuarioId, estudianteId);

    if (evaluacion.dictamen !== DictamenGraduacion.APTO) {
      throw new ConflictException(
        `No es posible registrar la graduación: el estudiante no es apto. ${evaluacion.motivosBloqueo.join(' ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Estudiante);
      const estActual = await repo.findOne({
        where: { id: estudianteId },
        relations: { planEstudio: true, carrera: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!estActual) throw new NotFoundException('Estudiante no encontrado.');

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

      // Si es graduación del plan principal, se actualiza el estado del estudiante a GRADUADO
      if (!salidaAcademicaId) {
        estActual.estado = EstadoEstudiante.GRADUADO;
      }
      estActual.fechaGraduacion = new Date();
      estActual.graduadoPorUsuarioId = usuarioId;
      estActual.observacionGraduacion = observacion?.trim() || null;

      await repo.save(estActual);

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
        // Repetición verdaderamente idéntica: comportamiento idempotente, se preserva el título original
      } else {
        await manager.query(
          `INSERT INTO titulos_estudiantes (estudiante_id, plan_estudio_id, carrera_id, salida_academica_id, grado, nombre_titulo, fecha_graduacion, graduado_por_usuario_id, observaciones, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            estudianteId,
            estActual.planEstudioId,
            estActual.carreraId,
            salidaIdNormalizada,
            gradoTitulo,
            nombreTitulo,
            estActual.fechaGraduacion,
            usuarioId,
            observacion?.trim() || null,
          ],
        );
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
      ).catch(() => null);
    });

    return this.evaluarGraduacion(usuarioId, estudianteId);
  }
}

