import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanAsignatura } from '../entities/plan-asignatura.entity';
import { PlanEstudio } from '../entities/plan-estudio.entity';
import { PlanRequisito } from '../entities/plan-requisito.entity';
import { MotorReglasAcademicas } from './motor-reglas-academicas';
import {
  AsignaturaRegla,
  OpcionesEvaluacionMotor,
  RequisitoRegla,
  ResultadoEvaluacionMotor,
} from './types/motor-reglas.types';

export interface EstructuraPlanReglas {
  plan: PlanEstudio;
  asignaturas: AsignaturaRegla[];
  requisitos: RequisitoRegla[];
}

export interface CatalogoPlanFormulario {
  plan: {
    id: number;
    nombre: string;
    carreraId: number;
  };
  aprobadasValidas: number[];
  niveles: Array<{
    nivel: number;
    ciclos: Array<{
      ciclo: number;
      asignaturas: ResultadoEvaluacionMotor['asignaturas'];
    }>;
  }>;
  resumen: ResultadoEvaluacionMotor['resumenPorNivelCiclo'];
}

/**
 * Servicio de integración entre el modelo relacional de Planes de Estudio (TypeORM)
 * y el Motor de Reglas Académicas desacoplado.
 * Prepara el contrato reutilizable para la futura API de formularios públicos.
 */
@Injectable()
export class MotorRequisitosService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,

    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,

    @InjectRepository(PlanRequisito)
    private readonly requisitoRepository: Repository<PlanRequisito>,
  ) {}

  /**
   * Obtiene la estructura completa de un plan de estudio (asignaturas activas y relaciones de requisitos),
   * mapeándola a las estructuras de dominio del motor de reglas.
   *
   * @param planEstudioId Identificador del plan de estudio.
   * @param exigirActivo Si es true, lanza excepción si el plan está inactivo.
   */
  async obtenerEstructuraPlan(
    planEstudioId: number,
    exigirActivo = true,
  ): Promise<EstructuraPlanReglas> {
    const plan = await this.planRepository.findOne({
      where: { id: planEstudioId },
      relations: { carrera: true },
    });

    if (!plan) {
      throw new NotFoundException(`El plan de estudio #${planEstudioId} no existe.`);
    }

    if (exigirActivo && !plan.activo) {
      throw new BadRequestException(
        `El plan de estudio "${plan.nombre}" (#${planEstudioId}) se encuentra inactivo.`,
      );
    }

    // 1. Consultar asignaturas del plan con sus cursos asociados
    const asignaturasEntities = await this.asignaturaRepository.find({
      where: {
        planEstudioId,
      },
      relations: {
        curso: true,
      },
      order: {
        nivel: 'ASC',
        ciclo: 'ASC',
        orden: 'ASC',
        id: 'ASC',
      },
    });

    const asignaturasReglas: AsignaturaRegla[] = asignaturasEntities.map((ent) => {
      const codigo =
        ent.codigoReferencia?.trim() || ent.curso?.codigo?.trim() || `ASIG-${ent.id}`;
      const nombre =
        ent.nombreReferencia?.trim() || ent.curso?.nombre?.trim() || `Asignatura #${ent.id}`;

      return {
        id: ent.id,
        planEstudioId: ent.planEstudioId,
        cursoId: ent.cursoId,
        codigo,
        nombre,
        nivel: ent.nivel,
        ciclo: ent.ciclo,
        orden: ent.orden,
        activo: ent.activo,
        tipo: ent.tipo,
        creditos: ent.creditos,
      };
    });

    // 2. Consultar requisitos académicos vinculados al plan
    const requisitosEntities = await this.requisitoRepository.find({
      where: {
        asignatura: {
          planEstudioId,
        },
      },
      relations: {
        asignatura: true,
        requisitoAsignatura: true,
      },
      order: {
        id: 'ASC',
      },
    });

    const requisitosReglas: RequisitoRegla[] = requisitosEntities
      // Garantizar que toda relación de una asignatura de este plan se preserve.
      // NO se descartan silenciosamente requisitos externos/inconsistentes, para que
      // el motor detecte la anomalía y mantenga la asignatura BLOQUEADA en lugar de habilitarla.
      .filter(
        (req) => req.asignatura && req.asignatura.planEstudioId === planEstudioId,
      )
      .map((req) => ({
        id: req.id,
        asignaturaId: req.asignaturaId,
        requisitoAsignaturaId: req.requisitoAsignaturaId,
        tipo: req.tipo,
      }));

    return {
      plan,
      asignaturas: asignaturasReglas,
      requisitos: requisitosReglas,
    };
  }

  /**
   * Evalúa las asignaturas declaradas por un estudiante contra el plan de estudio real.
   *
   * @param planEstudioId Identificador del plan.
   * @param aprobadasSeleccionadas Lista de IDs declarados como aprobados.
   * @param opciones Opciones de políticas de evaluación.
   */
  async evaluarSeleccionEstudiante(
    planEstudioId: number,
    aprobadasSeleccionadas: number[],
    opciones?: OpcionesEvaluacionMotor,
  ): Promise<ResultadoEvaluacionMotor> {
    const estructura = await this.obtenerEstructuraPlan(planEstudioId, true);

    return MotorReglasAcademicas.evaluar(
      estructura.asignaturas,
      estructura.requisitos,
      aprobadasSeleccionadas,
      opciones,
    );
  }

  /**
   * Validación estricta para persistencia en backend (Zero-Trust):
   * Verifica que ninguna asignatura declarada por el estudiante viole las reglas del plan.
   * Si alguna asignatura fue invalidada en cascada por falta de requisitos, lanza BadRequestException.
   */
  async validarSeleccionEstricta(
    planEstudioId: number,
    aprobadasSeleccionadas: number[],
    opciones?: OpcionesEvaluacionMotor,
  ): Promise<ResultadoEvaluacionMotor> {
    const resultado = await this.evaluarSeleccionEstudiante(
      planEstudioId,
      aprobadasSeleccionadas,
      opciones,
    );

    if (!resultado.esValido && resultado.inconsistenciasGrafo.length > 0) {
      throw new BadRequestException(
        `El plan de estudio contiene inconsistencias en su grafo académico: ${resultado.inconsistenciasGrafo.join('; ')}`,
      );
    }

    if (resultado.desmarcadasCascada.length > 0) {
      const primerError = resultado.desmarcadasCascada[0];
      throw new BadRequestException(
        `Selección inválida: La asignatura "${primerError.codigo} - ${primerError.nombre}" no puede marcarse como aprobada porque falta su requisito previo. ${primerError.motivo}`,
      );
    }

    // Verificar que todas las solicitadas pertenecen al plan
    const idsValidos = new Set(resultado.asignaturas.map((a) => a.asignaturaId));
    for (const solicitadaId of resultado.solicitadasOriginales) {
      if (!idsValidos.has(solicitadaId)) {
        throw new BadRequestException(
          `La asignatura #${solicitadaId} no pertenece al plan de estudios #${planEstudioId}.`,
        );
      }
    }

    return resultado;
  }

  /**
   * Contrato de servicio para la futura interfaz pública de formularios:
   * Retorna el catálogo estructurado por Niveles (Años) y Ciclos, con el estado de elegibilidad
   * de cada materia según la selección actual del estudiante.
   */
  async obtenerCatalogoFormulario(
    planEstudioId: number,
    aprobadasSeleccionadas: number[] = [],
    opciones?: OpcionesEvaluacionMotor,
  ): Promise<CatalogoPlanFormulario> {
    const estructura = await this.obtenerEstructuraPlan(planEstudioId, true);
    const resultado = MotorReglasAcademicas.evaluar(
      estructura.asignaturas,
      estructura.requisitos,
      aprobadasSeleccionadas,
      opciones,
    );

    // Agrupar jerárquicamente: Nivel -> Ciclo -> Asignaturas
    const nivelesMap = new Map<
      number,
      Map<number, ResultadoEvaluacionMotor['asignaturas']>
    >();

    for (const asig of resultado.asignaturas) {
      let ciclosMap = nivelesMap.get(asig.nivel);
      if (!ciclosMap) {
        ciclosMap = new Map<number, ResultadoEvaluacionMotor['asignaturas']>();
        nivelesMap.set(asig.nivel, ciclosMap);
      }

      let listaCiclo = ciclosMap.get(asig.ciclo);
      if (!listaCiclo) {
        listaCiclo = [];
        ciclosMap.set(asig.ciclo, listaCiclo);
      }

      listaCiclo.push(asig);
    }

    const nivelesOrdenados = [...nivelesMap.entries()]
      .sort(([nA], [nB]) => nA - nB)
      .map(([nivel, ciclosMap]) => ({
        nivel,
        ciclos: [...ciclosMap.entries()]
          .sort(([cA], [cB]) => cA - cB)
          .map(([ciclo, asignaturas]) => ({
            ciclo,
            asignaturas,
          })),
      }));

    return {
      plan: {
        id: estructura.plan.id,
        nombre: estructura.plan.nombre,
        carreraId: estructura.plan.carreraId,
      },
      aprobadasValidas: resultado.aprobadasValidas,
      niveles: nivelesOrdenados,
      resumen: resultado.resumenPorNivelCiclo,
    };
  }
}
