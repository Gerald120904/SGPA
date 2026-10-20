import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
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

  private async obtenerReglaOptativas(
    planId: number,
  ): Promise<ReglaOptativaPlan | null> {
    return this.reglaOptativaRepository.findOne({
      where: {
        planEstudioId: planId,
      },
    });
  }

  private obtenerLimiteTipoOptativa(
    regla: ReglaOptativaPlan,
    tipoOptativa: TipoOptativa,
  ): number {
    if (tipoOptativa === TipoOptativa.DISCIPLINARIA) {
      return Number(regla.cantidadDisciplinarias || 0);
    }

    if (tipoOptativa === TipoOptativa.ABIERTA) {
      return Number(regla.cantidadAbiertas || 0);
    }

    return Number(regla.cantidadSede || 0);
  }

  private obtenerNombreTipoOptativa(tipoOptativa: TipoOptativa): string {
    if (tipoOptativa === TipoOptativa.DISCIPLINARIA) {
      return 'disciplinaria / de carrera';
    }

    if (tipoOptativa === TipoOptativa.ABIERTA) {
      return 'abierta';
    }

    return 'de sede';
  }

  private async contarOptativasActivasPorTipo(
    planId: number,
    tipoOptativa: TipoOptativa,
    excluirId?: number,
  ): Promise<number> {
    return this.asignaturaRepository.count({
      where: {
        planEstudioId: planId,
        tipo: TipoPlanAsignatura.OPTATIVA,
        tipoOptativa,
        activo: true,
        ...(excluirId !== undefined ? { id: Not(excluirId) } : {}),
      },
    });
  }

  private async validarCupoOptativa(
    planId: number,
    tipo: TipoPlanAsignatura,
    tipoOptativa: TipoOptativa | null,
    opciones: {
      excluirId?: number;
      activo?: boolean;
      adicionales?: number;
    } = {},
  ): Promise<void> {
    if (opciones.activo === false || tipo !== TipoPlanAsignatura.OPTATIVA) {
      return;
    }

    if (!tipoOptativa) {
      throw new BadRequestException(
        'Debe indicar si la optativa es DISCIPLINARIA, ABIERTA o SEDE.',
      );
    }

    const regla = await this.obtenerReglaOptativas(planId);

    if (!regla) {
      throw new ConflictException(
        'Antes de agregar asignaturas optativas debe configurar la Regla de optativas del plan.',
      );
    }

    const limite = this.obtenerLimiteTipoOptativa(regla, tipoOptativa);
    const actuales = await this.contarOptativasActivasPorTipo(
      planId,
      tipoOptativa,
      opciones.excluirId,
    );
    const adicionales = opciones.adicionales ?? 1;

    if (actuales + adicionales > limite) {
      const nombreTipo = this.obtenerNombreTipoOptativa(tipoOptativa);
      throw new ConflictException(
        `El plan ya alcanzó el límite de ${limite} optativa${
          limite === 1 ? '' : 's'
        } ${nombreTipo}. Para agregar otra debe modificar primero la Regla de optativas.`,
      );
    }
  }

  private async validarCuposOptativasCarga(
    planId: number,
    asignaturas: PlanAsignatura[],
  ): Promise<void> {
    const optativas = asignaturas.filter(
      (asignatura) =>
        asignatura.activo && asignatura.tipo === TipoPlanAsignatura.OPTATIVA,
    );

    if (!optativas.length) {
      return;
    }

    const regla = await this.obtenerReglaOptativas(planId);

    if (!regla) {
      throw new ConflictException(
        'Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.',
      );
    }

    for (const tipoOptativa of Object.values(TipoOptativa)) {
      const nuevas = optativas.filter(
        (asignatura) => asignatura.tipoOptativa === tipoOptativa,
      ).length;

      if (!nuevas) {
        continue;
      }

      const actuales = await this.contarOptativasActivasPorTipo(
        planId,
        tipoOptativa,
      );
      const limite = this.obtenerLimiteTipoOptativa(regla, tipoOptativa);

      if (actuales + nuevas > limite) {
        const nombreTipo = this.obtenerNombreTipoOptativa(tipoOptativa);
        throw new ConflictException(
          `La carga supera el límite de ${limite} optativa${
            limite === 1 ? '' : 's'
          } ${nombreTipo} permitido por la Regla de optativas.`,
        );
      }
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
      orden: dto.orden ?? 0,
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

    await this.validarCupoOptativa(
      planId,
      asignatura.tipo,
      asignatura.tipoOptativa,
      {
        activo: asignatura.activo,
      },
    );

    const guardada = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(PlanEstudio).findOne({
        where: { id: planId },
        lock: { mode: 'pessimistic_write' },
      });
      const repository = manager.getRepository(PlanAsignatura);
      const [ultima] = await repository.find({
        where: { planEstudioId: planId, nivel: dto.nivel, ciclo: dto.ciclo },
        order: { orden: 'DESC' },
        take: 1,
      });
      const siguiente = Number(ultima?.orden || 0) + 1;
      if (siguiente > 200) {
        throw new ConflictException('El ciclo alcanzó el orden máximo permitido.');
      }
      asignatura.orden = siguiente;
      return repository.save(asignatura);
    });
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
      if (!Number.isInteger(asignaturaDto.orden) ||
          asignaturaDto.orden! < 1 || asignaturaDto.orden! > 200) {
        throw new BadRequestException('La carga masiva requiere el orden de cada asignatura.');
      }
      preparadas.push(await this.prepararAsignatura(plan, asignaturaDto));
    }

    await this.validarCuposOptativasCarga(planId, preparadas);

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

    await this.validarCupoOptativa(
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

      await this.validarCupoOptativa(
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

  huellaAsignatura(asignatura: PlanAsignatura): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          id: asignatura.id,
          planEstudioId: asignatura.planEstudioId,
          nivel: asignatura.nivel,
          ciclo: asignatura.ciclo,
          orden: asignatura.orden,
          creditos: asignatura.creditos,
          horasTeoria: asignatura.horasTeoria,
          horasPractica: asignatura.horasPractica,
          horasLaboratorio: asignatura.horasLaboratorio,
          horasGira: asignatura.horasGira,
          horasEstudioIndependiente: asignatura.horasEstudioIndependiente,
          horasTotales: asignatura.horasTotales,
          horasDocente: asignatura.horasDocente,
          tipo: asignatura.tipo,
          tipoOptativa: asignatura.tipoOptativa,
          codigoReferencia: asignatura.codigoReferencia,
          nombreReferencia: asignatura.nombreReferencia,
          activo: asignatura.activo,
          cursoId: asignatura.cursoId,
          updatedAt: asignatura.updatedAt ? new Date(asignatura.updatedAt).toISOString() : null,
        }),
      )
      .digest('hex');
  }

  async obtenerAsignaturaParaSolicitud(planId: number, id: number): Promise<PlanAsignatura> {
    return this.obtenerAsignatura(planId, id);
  }

  async crearDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    dto: CrearPlanAsignaturaDto,
    manager: EntityManager,
  ): Promise<number> {
    const planRepo = manager.getRepository(PlanEstudio);
    const asignaturaRepo = manager.getRepository(PlanAsignatura);
    const reglaRepo = manager.getRepository(ReglaOptativaPlan);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const codigoReferencia = dto.codigoReferencia.trim().toUpperCase();
    const nombreReferencia = dto.nombreReferencia.trim();
    if (!codigoReferencia) throw new BadRequestException('El código de la asignatura es obligatorio.');
    if (!nombreReferencia) throw new BadRequestException('El nombre de la asignatura es obligatorio.');

    if (dto.tipo !== TipoPlanAsignatura.OPTATIVA && dto.tipo !== TipoPlanAsignatura.GENERAL) {
      const existente = await asignaturaRepo.findOne({
        where: { planEstudioId: planId, codigoReferencia },
      });
      if (existente) {
        throw new ConflictException('Ya existe una asignatura con ese código en este plan de estudio.');
      }
    }

    const tipoOptativa = this.normalizarTipoOptativa(dto.tipo, dto.tipoOptativa);

    if (dto.tipo === TipoPlanAsignatura.OPTATIVA) {
      const regla = await reglaRepo.findOne({ where: { planEstudioId: planId } });
      if (!regla) {
        throw new ConflictException('Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.');
      }
      const actuales = await asignaturaRepo.count({
        where: { planEstudioId: planId, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: tipoOptativa!, activo: true },
      });
      const limite = this.obtenerLimiteTipoOptativa(regla, tipoOptativa!);
      if (actuales >= limite) {
        const nombreTipo = this.obtenerNombreTipoOptativa(tipoOptativa!);
        throw new ConflictException(`Se alcanzó el límite de ${limite} optativa${limite === 1 ? '' : 's'} ${nombreTipo} permitido por la Regla de optativas.`);
      }
    }

    const [ultima] = await asignaturaRepo.find({
      where: { planEstudioId: planId, nivel: dto.nivel, ciclo: dto.ciclo },
      order: { orden: 'DESC' },
      take: 1,
    });
    const siguiente = Number(ultima?.orden || 0) + 1;
    if (siguiente > 200) {
      throw new ConflictException('El ciclo alcanzó el orden máximo permitido.');
    }

    const nueva = asignaturaRepo.create({
      planEstudioId: planId,
      cursoId: null,
      curso: null,
      nivel: dto.nivel,
      ciclo: dto.ciclo,
      orden: siguiente,
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

    const guardada = await asignaturaRepo.save(nueva);
    return guardada.id;
  }

  async actualizarDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    id: number,
    dto: ActualizarPlanAsignaturaDto,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const planRepo = manager.getRepository(PlanEstudio);
    const asignaturaRepo = manager.getRepository(PlanAsignatura);
    const reglaRepo = manager.getRepository(ReglaOptativaPlan);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const asignatura = await asignaturaRepo.findOne({
      where: { id, planEstudioId: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!asignatura) throw new NotFoundException('Asignatura del plan no encontrada.');

    if (this.huellaAsignatura(asignatura) !== huellaOriginal) {
      throw new ConflictException('La asignatura del plan cambió desde que se envió la solicitud.');
    }

    this.validarIdentidadAsignaturaVinculada(asignatura, dto);

    const tipoResultante = dto.tipo ?? asignatura.tipo;
    const tipoOptativaResultante = this.normalizarTipoOptativa(
      tipoResultante,
      dto.tipoOptativa !== undefined ? dto.tipoOptativa : asignatura.tipoOptativa,
    );
    const codigoResultante =
      dto.codigoReferencia !== undefined
        ? (dto.codigoReferencia?.trim().toUpperCase() ?? '')
        : (asignatura.codigoReferencia?.trim().toUpperCase() ?? '');

    if (dto.codigoReferencia !== undefined || dto.tipo !== undefined) {
      if (!codigoResultante) throw new BadRequestException('La asignatura debe tener un código.');
      if (tipoResultante !== TipoPlanAsignatura.OPTATIVA && tipoResultante !== TipoPlanAsignatura.GENERAL) {
        const existente = await asignaturaRepo.findOne({
          where: { planEstudioId: planId, codigoReferencia: codigoResultante },
        });
        if (existente && existente.id !== id) {
          throw new ConflictException('Ya existe una asignatura con ese código en este plan de estudio.');
        }
      }
    }

    if (tipoResultante === TipoPlanAsignatura.OPTATIVA && asignatura.activo) {
      const regla = await reglaRepo.findOne({ where: { planEstudioId: planId } });
      if (!regla) {
        throw new ConflictException('Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.');
      }
      const actuales = await asignaturaRepo.count({
        where: { planEstudioId: planId, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: tipoOptativaResultante!, activo: true, id: Not(id) },
      });
      const limite = this.obtenerLimiteTipoOptativa(regla, tipoOptativaResultante!);
      if (actuales >= limite) {
        const nombreTipo = this.obtenerNombreTipoOptativa(tipoOptativaResultante!);
        throw new ConflictException(`Se alcanzó el límite de ${limite} optativa${limite === 1 ? '' : 's'} ${nombreTipo} permitido por la Regla de optativas.`);
      }
    }

    if (dto.nivel !== undefined) asignatura.nivel = dto.nivel;
    if (dto.ciclo !== undefined) asignatura.ciclo = dto.ciclo;
    if (dto.orden !== undefined) asignatura.orden = dto.orden;
    if (dto.creditos !== undefined) asignatura.creditos = dto.creditos;
    if (dto.horasTeoria !== undefined) asignatura.horasTeoria = dto.horasTeoria;
    if (dto.horasPractica !== undefined) asignatura.horasPractica = dto.horasPractica;
    if (dto.horasLaboratorio !== undefined) asignatura.horasLaboratorio = dto.horasLaboratorio;
    if (dto.horasGira !== undefined) asignatura.horasGira = dto.horasGira;
    if (dto.horasEstudioIndependiente !== undefined) asignatura.horasEstudioIndependiente = dto.horasEstudioIndependiente;
    if (dto.horasTotales !== undefined) asignatura.horasTotales = dto.horasTotales;
    if (dto.horasDocente !== undefined) asignatura.horasDocente = dto.horasDocente;
    if (dto.observacionHoras !== undefined) asignatura.observacionHoras = dto.observacionHoras?.trim() || null;
    if (dto.tipo !== undefined) asignatura.tipo = dto.tipo;
    asignatura.tipoOptativa = tipoOptativaResultante;
    if (dto.codigoReferencia !== undefined) asignatura.codigoReferencia = codigoResultante;
    if (dto.nombreReferencia !== undefined) {
      const nombre = dto.nombreReferencia?.trim() ?? '';
      if (!nombre) throw new BadRequestException('El nombre de la asignatura no puede estar vacío.');
      asignatura.nombreReferencia = nombre;
    }

    await asignaturaRepo.save(asignatura);
    return id;
  }

  async cambiarEstadoDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    id: number,
    activo: boolean,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const planRepo = manager.getRepository(PlanEstudio);
    const asignaturaRepo = manager.getRepository(PlanAsignatura);
    const reglaRepo = manager.getRepository(ReglaOptativaPlan);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const asignatura = await asignaturaRepo.findOne({
      where: { id, planEstudioId: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!asignatura) throw new NotFoundException('Asignatura del plan no encontrada.');

    if (this.huellaAsignatura(asignatura) !== huellaOriginal) {
      throw new ConflictException('La asignatura del plan cambió desde que se envió la solicitud.');
    }

    if (activo && asignatura.tipo === TipoPlanAsignatura.OPTATIVA) {
      const tipoOptativa = this.normalizarTipoOptativa(asignatura.tipo, asignatura.tipoOptativa);
      const regla = await reglaRepo.findOne({ where: { planEstudioId: planId } });
      if (!regla) {
        throw new ConflictException('Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.');
      }
      const actuales = await asignaturaRepo.count({
        where: { planEstudioId: planId, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: tipoOptativa!, activo: true, id: Not(id) },
      });
      const limite = this.obtenerLimiteTipoOptativa(regla, tipoOptativa!);
      if (actuales >= limite) {
        const nombreTipo = this.obtenerNombreTipoOptativa(tipoOptativa!);
        throw new ConflictException(`Se alcanzó el límite de ${limite} optativa${limite === 1 ? '' : 's'} ${nombreTipo} permitido por la Regla de optativas.`);
      }
    }

    asignatura.activo = activo;
    await asignaturaRepo.save(asignatura);
    return id;
  }

  async cargaMasivaDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    dto: CargaMasivaPlanAsignaturasDto,
    manager: EntityManager,
  ): Promise<{ total: number }> {
    const planRepo = manager.getRepository(PlanEstudio);
    const asignaturaRepo = manager.getRepository(PlanAsignatura);
    const reglaRepo = manager.getRepository(ReglaOptativaPlan);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const codigos = dto.asignaturas.map((item) => item.codigoReferencia.trim().toUpperCase());
    if (new Set(codigos).size !== codigos.length) {
      throw new BadRequestException('La carga contiene el mismo código de asignatura más de una vez.');
    }

    const preparadas: PlanAsignatura[] = [];
    for (const item of dto.asignaturas) {
      if (!Number.isInteger(item.orden) || item.orden! < 1 || item.orden! > 200) {
        throw new BadRequestException('La carga masiva requiere el orden de cada asignatura.');
      }
      const codRef = item.codigoReferencia.trim().toUpperCase();
      const nomRef = item.nombreReferencia.trim();
      if (!codRef) throw new BadRequestException('El código de la asignatura es obligatorio.');
      if (!nomRef) throw new BadRequestException('El nombre de la asignatura es obligatorio.');

      if (item.tipo !== TipoPlanAsignatura.OPTATIVA && item.tipo !== TipoPlanAsignatura.GENERAL) {
        const existente = await asignaturaRepo.findOne({
          where: { planEstudioId: planId, codigoReferencia: codRef },
        });
        if (existente) {
          throw new ConflictException('Ya existe una asignatura con ese código en este plan de estudio.');
        }
      }

      const tipoOpt = this.normalizarTipoOptativa(item.tipo, item.tipoOptativa);
      preparadas.push(
        asignaturaRepo.create({
          planEstudioId: planId,
          cursoId: null,
          curso: null,
          nivel: item.nivel,
          ciclo: item.ciclo,
          orden: item.orden,
          creditos: item.creditos,
          horasTeoria: item.horasTeoria ?? null,
          horasPractica: item.horasPractica ?? null,
          horasLaboratorio: item.horasLaboratorio ?? null,
          horasGira: item.horasGira ?? null,
          horasEstudioIndependiente: item.horasEstudioIndependiente ?? null,
          horasTotales: item.horasTotales ?? null,
          horasDocente: item.horasDocente ?? null,
          observacionHoras: item.observacionHoras?.trim() || null,
          tipo: item.tipo,
          tipoOptativa: tipoOpt,
          codigoReferencia: codRef,
          nombreReferencia: nomRef,
          activo: true,
        }),
      );
    }

    const optativas = preparadas.filter((asig) => asig.tipo === TipoPlanAsignatura.OPTATIVA);
    if (optativas.length > 0) {
      const regla = await reglaRepo.findOne({ where: { planEstudioId: planId } });
      if (!regla) {
        throw new ConflictException('Antes de cargar asignaturas optativas debe configurar la Regla de optativas del plan.');
      }
      for (const tOpt of Object.values(TipoOptativa)) {
        const nuevas = optativas.filter((asig) => asig.tipoOptativa === tOpt).length;
        if (!nuevas) continue;
        const actuales = await asignaturaRepo.count({
          where: { planEstudioId: planId, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: tOpt, activo: true },
        });
        const limite = this.obtenerLimiteTipoOptativa(regla, tOpt);
        if (actuales + nuevas > limite) {
          const nombreTipo = this.obtenerNombreTipoOptativa(tOpt);
          throw new ConflictException(`La carga supera el límite de ${limite} optativa${limite === 1 ? '' : 's'} ${nombreTipo} permitido por la Regla de optativas.`);
        }
      }
    }

    await asignaturaRepo.save(preparadas);
    return { total: preparadas.length };
  }
}
