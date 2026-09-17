import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { ActualizarPlanAsignaturaDto } from './dto/actualizar-plan-asignatura.dto';
import { CargaMasivaPlanAsignaturasDto } from './dto/carga-masiva-plan-asignaturas.dto';
import { CrearPlanAsignaturaDto } from './dto/crear-plan-asignatura.dto';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { ReglaOptativaPlan } from './entities/regla-optativa-plan.entity';

@Injectable()
export class PlanAsignaturasService {
  constructor(
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(ReglaOptativaPlan)
    private readonly reglaOptativaRepository: Repository<ReglaOptativaPlan>,
    private readonly dataSource: DataSource,
  ) {}

  private async obtenerPlan(
    planId: number,
    exigirActivo = false,
  ): Promise<PlanEstudio> {
    const plan = await this.planRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan de estudio no encontrado.');
    }

    if (exigirActivo && !plan.activo) {
      throw new BadRequestException(
        'No se puede modificar un plan de estudio inactivo.',
      );
    }

    return plan;
  }

  private async obtenerAsignatura(
    planId: number,
    id: number,
  ): Promise<PlanAsignatura> {
    const asignatura = await this.asignaturaRepository.findOne({
      where: {
        id,
        planEstudioId: planId,
      },
      relations: {
        curso: true,
      },
    });

    if (!asignatura) {
      throw new NotFoundException('Asignatura del plan no encontrada.');
    }

    return asignatura;
  }


  private normalizarTipoOptativa(
    tipo: TipoPlanAsignatura,
    tipoOptativa?: TipoOptativa | null,
  ): TipoOptativa | null {
    if (tipo !== TipoPlanAsignatura.OPTATIVA) {
      return null;
    }

    if (
      !tipoOptativa ||
      !Object.values(TipoOptativa).includes(tipoOptativa)
    ) {
      throw new BadRequestException(
        'Debe indicar si la optativa es DISCIPLINARIA, ABIERTA o SEDE.',
      );
    }

    return tipoOptativa;
  }

  private esOptativaDeOtraArea(tipoOptativa?: TipoOptativa | null): boolean {
    return (
      tipoOptativa === TipoOptativa.ABIERTA ||
      tipoOptativa === TipoOptativa.SEDE
    );
  }

  private async obtenerReglaOptativas(
    planId: number,
  ): Promise<ReglaOptativaPlan | null> {
    return this.reglaOptativaRepository.findOne({
      where: {
        planEstudioId: planId,
      },
    });
  }

  private async contarOtrasAreasActivas(
    planId: number,
    excluirId?: number,
  ): Promise<number> {
    return this.asignaturaRepository.count({
      where: {
        planEstudioId: planId,
        tipo: TipoPlanAsignatura.OPTATIVA,
        tipoOptativa: In([TipoOptativa.ABIERTA, TipoOptativa.SEDE]),
        activo: true,
        ...(excluirId !== undefined ? { id: Not(excluirId) } : {}),
      },
    });
  }

  private async validarMaximoOtrasAreas(
    planId: number,
    tipo: TipoPlanAsignatura,
    tipoOptativa: TipoOptativa | null,
    opciones: {
      excluirId?: number;
      activo?: boolean;
      adicionales?: number;
    } = {},
  ): Promise<void> {
    if (
      opciones.activo === false ||
      tipo !== TipoPlanAsignatura.OPTATIVA ||
      !this.esOptativaDeOtraArea(tipoOptativa)
    ) {
      return;
    }

    const regla = await this.obtenerReglaOptativas(planId);

    if (
      !regla ||
      regla.maximoOtrasAreas === null ||
      regla.maximoOtrasAreas === undefined
    ) {
      return;
    }

    const actuales = await this.contarOtrasAreasActivas(
      planId,
      opciones.excluirId,
    );
    const adicionales = opciones.adicionales ?? 1;

    if (actuales + adicionales > Number(regla.maximoOtrasAreas)) {
      throw new ConflictException(
        `El plan ya alcanzó el máximo de ${regla.maximoOtrasAreas} optativa${
          Number(regla.maximoOtrasAreas) === 1 ? '' : 's'
        } de otras áreas. Las optativas ABIERTA y SEDE comparten este límite.`,
      );
    }
  }

  private async validarMaximoOtrasAreasCarga(
    planId: number,
    asignaturas: PlanAsignatura[],
  ): Promise<void> {
    const nuevasOtrasAreas = asignaturas.filter(
      (asignatura) =>
        asignatura.activo &&
        asignatura.tipo === TipoPlanAsignatura.OPTATIVA &&
        this.esOptativaDeOtraArea(asignatura.tipoOptativa),
    ).length;

    if (nuevasOtrasAreas === 0) {
      return;
    }

    const regla = await this.obtenerReglaOptativas(planId);

    if (
      !regla ||
      regla.maximoOtrasAreas === null ||
      regla.maximoOtrasAreas === undefined
    ) {
      return;
    }

    const actuales = await this.contarOtrasAreasActivas(planId);

    if (actuales + nuevasOtrasAreas > Number(regla.maximoOtrasAreas)) {
      throw new ConflictException(
        `La carga supera el máximo de ${regla.maximoOtrasAreas} optativa${
          Number(regla.maximoOtrasAreas) === 1 ? '' : 's'
        } de otras áreas permitido por la regla del plan.`,
      );
    }
  }

  private async validarCodigoDuplicado(
    planId: number,
    codigo: string,
    tipo: TipoPlanAsignatura,
    excluirId?: number,
  ): Promise<void> {
    if (
      tipo === TipoPlanAsignatura.OPTATIVA ||
      tipo === TipoPlanAsignatura.GENERAL
    ) {
      return;
    }

    const existente = await this.asignaturaRepository.findOne({
      where: {
        planEstudioId: planId,
        codigoReferencia: codigo,
      },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException(
        'Ya existe una asignatura con ese código en este plan de estudio.',
      );
    }
  }

  private async prepararAsignatura(
    plan: PlanEstudio,
    dto: CrearPlanAsignaturaDto,
  ): Promise<PlanAsignatura> {
    const codigoReferencia = dto.codigoReferencia.trim().toUpperCase();
    const nombreReferencia = dto.nombreReferencia.trim();

    if (!codigoReferencia) {
      throw new BadRequestException(
        'El código de la asignatura es obligatorio.',
      );
    }

    if (!nombreReferencia) {
      throw new BadRequestException(
        'El nombre de la asignatura es obligatorio.',
      );
    }

    await this.validarCodigoDuplicado(plan.id, codigoReferencia, dto.tipo);

    const tipoOptativa = this.normalizarTipoOptativa(
      dto.tipo,
      dto.tipoOptativa,
    );

    return this.asignaturaRepository.create({
      planEstudioId: plan.id,
      cursoId: null,
      curso: null,
      nivel: dto.nivel,
      ciclo: dto.ciclo,
      orden: dto.orden,
      creditos: dto.creditos,
      horasTeoria: dto.horasTeoria ?? null,
      horasPractica: dto.horasPractica ?? null,
      horasLaboratorio: dto.horasLaboratorio ?? null,
      horasGira: dto.horasGira ?? null,
      horasEstudioIndependiente: dto.horasEstudioIndependiente ?? null,
      horasTotales: dto.horasTotales ?? null,
      horasDocente: dto.horasDocente ?? null,
      observacionHoras: dto.observacionHoras?.trim() || null,
      tipo: dto.tipo,
      tipoOptativa,
      codigoReferencia,
      nombreReferencia,
      activo: true,
    });
  }

  async listar(planId: number): Promise<PlanAsignatura[]> {
    await this.obtenerPlan(planId);

    return this.asignaturaRepository.find({
      where: {
        planEstudioId: planId,
      },
      relations: {
        curso: true,
      },
      order: {
        nivel: 'ASC',
        ciclo: 'ASC',
        orden: 'ASC',
      },
    });
  }

  async obtenerPorId(planId: number, id: number): Promise<PlanAsignatura> {
    await this.obtenerPlan(planId);
    return this.obtenerAsignatura(planId, id);
  }

  async crear(
    planId: number,
    dto: CrearPlanAsignaturaDto,
  ): Promise<PlanAsignatura> {
    const plan = await this.obtenerPlan(planId, true);
    const asignatura = await this.prepararAsignatura(plan, dto);

    await this.validarMaximoOtrasAreas(
      planId,
      asignatura.tipo,
      asignatura.tipoOptativa,
      {
        activo: asignatura.activo,
      },
    );

    const guardada = await this.asignaturaRepository.save(asignatura);
    return this.obtenerAsignatura(planId, guardada.id);
  }

  async cargaMasiva(planId: number, dto: CargaMasivaPlanAsignaturasDto) {
    const plan = await this.obtenerPlan(planId, true);
    const codigos = dto.asignaturas.map((item) =>
      item.codigoReferencia.trim().toUpperCase(),
    );
    const codigosUnicos = new Set(codigos);

    if (codigosUnicos.size !== codigos.length) {
      throw new BadRequestException(
        'La carga contiene el mismo código de asignatura más de una vez.',
      );
    }

    const preparadas: PlanAsignatura[] = [];

    for (const asignaturaDto of dto.asignaturas) {
      preparadas.push(await this.prepararAsignatura(plan, asignaturaDto));
    }

    await this.validarMaximoOtrasAreasCarga(planId, preparadas);

    const idsGuardados = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PlanAsignatura);
      const guardadas = await repository.save(preparadas);
      return guardadas.map((item) => item.id);
    });

    const asignaturas = await this.asignaturaRepository.find({
      where: idsGuardados.map((id) => ({
        id,
        planEstudioId: planId,
      })),
      relations: {
        curso: true,
      },
      order: {
        nivel: 'ASC',
        ciclo: 'ASC',
        orden: 'ASC',
      },
    });

    return {
      total: asignaturas.length,
      asignaturas,
    };
  }

  private validarIdentidadAsignaturaVinculada(
    asignatura: PlanAsignatura,
    dto: ActualizarPlanAsignaturaDto,
  ): void {
    if (asignatura.cursoId === null) {
      return;
    }

    const codigoActual =
      asignatura.codigoReferencia?.trim().toUpperCase() ?? '';

    const nombreActual = asignatura.nombreReferencia?.trim() ?? '';

    const nuevoCodigo =
      dto.codigoReferencia !== undefined
        ? (dto.codigoReferencia?.trim().toUpperCase() ?? '')
        : codigoActual;

    const nuevoNombre =
      dto.nombreReferencia !== undefined
        ? (dto.nombreReferencia?.trim() ?? '')
        : nombreActual;

    const cambiaCodigo =
      dto.codigoReferencia !== undefined && nuevoCodigo !== codigoActual;

    const cambiaNombre =
      dto.nombreReferencia !== undefined && nuevoNombre !== nombreActual;

    if (cambiaCodigo || cambiaNombre) {
      throw new ConflictException(
        'No se puede modificar el código o nombre de una asignatura que ya está vinculada al catálogo de cursos.',
      );
    }
  }

  async actualizar(
    planId: number,
    id: number,
    dto: ActualizarPlanAsignaturaDto,
  ): Promise<PlanAsignatura> {
    await this.obtenerPlan(planId, true);
    const asignatura = await this.obtenerAsignatura(planId, id);

    this.validarIdentidadAsignaturaVinculada(asignatura, dto);

    const tipoResultante = dto.tipo ?? asignatura.tipo;
    const tipoOptativaResultante = this.normalizarTipoOptativa(
      tipoResultante,
      dto.tipoOptativa !== undefined
        ? dto.tipoOptativa
        : asignatura.tipoOptativa,
    );
    const codigoResultante =
      dto.codigoReferencia !== undefined
        ? (dto.codigoReferencia?.trim().toUpperCase() ?? '')
        : (asignatura.codigoReferencia?.trim().toUpperCase() ?? '');

    if (dto.codigoReferencia !== undefined || dto.tipo !== undefined) {
      if (!codigoResultante) {
        throw new BadRequestException('La asignatura debe tener un código.');
      }

      await this.validarCodigoDuplicado(
        planId,
        codigoResultante,
        tipoResultante,
        id,
      );
    }

    await this.validarMaximoOtrasAreas(
      planId,
      tipoResultante,
      tipoOptativaResultante,
      {
        excluirId: id,
        activo: asignatura.activo,
      },
    );

    if (dto.nivel !== undefined) asignatura.nivel = dto.nivel;
    if (dto.ciclo !== undefined) asignatura.ciclo = dto.ciclo;
    if (dto.orden !== undefined) asignatura.orden = dto.orden;
    if (dto.creditos !== undefined) asignatura.creditos = dto.creditos;
    if (dto.horasTeoria !== undefined) {
      asignatura.horasTeoria = dto.horasTeoria;
    }
    if (dto.horasPractica !== undefined) {
      asignatura.horasPractica = dto.horasPractica;
    }
    if (dto.horasLaboratorio !== undefined) {
      asignatura.horasLaboratorio = dto.horasLaboratorio;
    }
    if (dto.horasGira !== undefined) {
      asignatura.horasGira = dto.horasGira;
    }
    if (dto.horasEstudioIndependiente !== undefined) {
      asignatura.horasEstudioIndependiente = dto.horasEstudioIndependiente;
    }
    if (dto.horasTotales !== undefined) {
      asignatura.horasTotales = dto.horasTotales;
    }
    if (dto.horasDocente !== undefined) {
      asignatura.horasDocente = dto.horasDocente;
    }
    if (dto.observacionHoras !== undefined) {
      asignatura.observacionHoras = dto.observacionHoras?.trim() || null;
    }

    if (dto.tipo !== undefined) {
      asignatura.tipo = dto.tipo;
    }

    asignatura.tipoOptativa = tipoOptativaResultante;

    if (dto.codigoReferencia !== undefined) {
      asignatura.codigoReferencia = codigoResultante;
    }

    if (dto.nombreReferencia !== undefined) {
      const nombreReferencia = dto.nombreReferencia?.trim() ?? '';

      if (!nombreReferencia) {
        throw new BadRequestException(
          'El nombre de la asignatura no puede estar vacío.',
        );
      }

      asignatura.nombreReferencia = nombreReferencia;
    }

    if (!asignatura.codigoReferencia) {
      throw new BadRequestException('La asignatura debe tener un código.');
    }

    if (!asignatura.nombreReferencia) {
      throw new BadRequestException('La asignatura debe tener un nombre.');
    }

    await this.asignaturaRepository.save(asignatura);
    return this.obtenerAsignatura(planId, id);
  }

  async cambiarEstado(
    planId: number,
    id: number,
    activo: boolean,
  ): Promise<PlanAsignatura> {
    await this.obtenerPlan(planId, true);
    const asignatura = await this.obtenerAsignatura(planId, id);

    if (activo && asignatura.tipo === TipoPlanAsignatura.OPTATIVA) {
      const tipoOptativa = this.normalizarTipoOptativa(
        asignatura.tipo,
        asignatura.tipoOptativa,
      );

      await this.validarMaximoOtrasAreas(
        planId,
        asignatura.tipo,
        tipoOptativa,
        {
          excluirId: id,
          activo: true,
        },
      );
    }

    await this.asignaturaRepository.update(id, { activo });
    return this.obtenerAsignatura(planId, id);
  }
}
