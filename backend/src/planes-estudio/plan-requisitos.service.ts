import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { CargaMasivaPlanRequisitosDto } from './dto/carga-masiva-plan-requisitos.dto';
import { CrearPlanRequisitoDto } from './dto/crear-plan-requisito.dto';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';

@Injectable()
export class PlanRequisitosService {
  constructor(
    @InjectRepository(PlanRequisito)
    private readonly requisitoRepository: Repository<PlanRequisito>,
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
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

  private async obtenerAsignaturaDelPlan(
    planId: number,
    asignaturaId: number,
  ): Promise<PlanAsignatura> {
    const asignatura = await this.asignaturaRepository.findOne({
      where: {
        id: asignaturaId,
        planEstudioId: planId,
      },
      relations: {
        curso: true,
      },
    });

    if (!asignatura) {
      throw new BadRequestException(
        'Una de las asignaturas seleccionadas no pertenece al plan.',
      );
    }

    if (!asignatura.activo) {
      throw new BadRequestException(
        'No se pueden utilizar asignaturas inactivas en una relación de requisitos.',
      );
    }

    return asignatura;
  }

  private async obtenerRelacion(
    planId: number,
    id: number,
  ): Promise<PlanRequisito> {
    const relacion = await this.requisitoRepository.findOne({
      where: { id },
      relations: {
        asignatura: {
          curso: true,
        },
        requisitoAsignatura: {
          curso: true,
        },
      },
    });

    if (
      !relacion ||
      relacion.asignatura.planEstudioId !== planId ||
      relacion.requisitoAsignatura.planEstudioId !== planId
    ) {
      throw new NotFoundException('Relación de requisito no encontrada.');
    }

    return relacion;
  }

  private async obtenerRequisitosDelPlan(
    planId: number,
  ): Promise<PlanRequisito[]> {
    return this.requisitoRepository.find({
      where: {
        tipo: TipoRequisito.REQUISITO,
        asignatura: {
          planEstudioId: planId,
        },
      },
      relations: {
        asignatura: true,
      },
    });
  }

  private validarSinCiclos(
    existentes: PlanRequisito[],
    nuevas: Array<{
      asignaturaId: number;
      requisitoAsignaturaId: number;
      tipo: TipoRequisito;
    }>,
  ): void {
    const grafo = new Map<number, Set<number>>();

    const agregarRelacion = (requisitoId: number, asignaturaId: number) => {
      if (!grafo.has(requisitoId)) {
        grafo.set(requisitoId, new Set());
      }

      grafo.get(requisitoId)!.add(asignaturaId);

      if (!grafo.has(asignaturaId)) {
        grafo.set(asignaturaId, new Set());
      }
    };

    for (const relacion of existentes) {
      if (relacion.tipo !== TipoRequisito.REQUISITO) {
        continue;
      }

      agregarRelacion(relacion.requisitoAsignaturaId, relacion.asignaturaId);
    }

    for (const relacion of nuevas) {
      if (relacion.tipo !== TipoRequisito.REQUISITO) {
        continue;
      }

      agregarRelacion(relacion.requisitoAsignaturaId, relacion.asignaturaId);
    }

    const visitados = new Set<number>();
    const enProceso = new Set<number>();

    const visitar = (nodo: number) => {
      if (enProceso.has(nodo)) {
        throw new BadRequestException(
          'La relación generaría un ciclo de requisitos en el plan de estudio.',
        );
      }

      if (visitados.has(nodo)) {
        return;
      }

      enProceso.add(nodo);

      for (const siguiente of grafo.get(nodo) ?? new Set<number>()) {
        visitar(siguiente);
      }

      enProceso.delete(nodo);
      visitados.add(nodo);
    };

    for (const nodo of grafo.keys()) {
      visitar(nodo);
    }
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          code?: string;
          driverError?: { code?: string };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Una o más relaciones académicas ya están registradas.',
      );
    }

    throw error;
  }

  async listar(planId: number): Promise<PlanRequisito[]> {
    await this.obtenerPlan(planId);

    return this.requisitoRepository.find({
      where: {
        asignatura: {
          planEstudioId: planId,
        },
      },
      relations: {
        asignatura: {
          curso: true,
        },
        requisitoAsignatura: {
          curso: true,
        },
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async crear(
    planId: number,
    dto: CrearPlanRequisitoDto,
  ): Promise<PlanRequisito> {
    await this.obtenerPlan(planId, true);

    if (dto.asignaturaId === dto.requisitoAsignaturaId) {
      throw new BadRequestException(
        'Una asignatura no puede ser requisito de sí misma.',
      );
    }

    await this.obtenerAsignaturaDelPlan(planId, dto.asignaturaId);
    await this.obtenerAsignaturaDelPlan(planId, dto.requisitoAsignaturaId);

    const existente = await this.requisitoRepository.findOne({
      where: {
        asignaturaId: dto.asignaturaId,
        requisitoAsignaturaId: dto.requisitoAsignaturaId,
        tipo: dto.tipo,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Esta relación académica ya está registrada.',
      );
    }

    if (dto.tipo === TipoRequisito.REQUISITO) {
      const existentes = await this.obtenerRequisitosDelPlan(planId);

      this.validarSinCiclos(existentes, [
        {
          asignaturaId: dto.asignaturaId,
          requisitoAsignaturaId: dto.requisitoAsignaturaId,
          tipo: dto.tipo,
        },
      ]);
    }

    const relacion = this.requisitoRepository.create({
      asignaturaId: dto.asignaturaId,
      requisitoAsignaturaId: dto.requisitoAsignaturaId,
      tipo: dto.tipo,
    });

    let guardada: PlanRequisito;

    try {
      guardada = await this.requisitoRepository.save(relacion);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerRelacion(planId, guardada.id);
  }

  async cargaMasiva(planId: number, dto: CargaMasivaPlanRequisitosDto) {
    await this.obtenerPlan(planId, true);

    const relacionesDelLote = new Set<string>();
    const asignaturaIds = new Set<number>();

    for (const requisito of dto.requisitos) {
      if (requisito.asignaturaId === requisito.requisitoAsignaturaId) {
        throw new BadRequestException(
          'Una asignatura no puede ser requisito de sí misma.',
        );
      }

      const clave = `${requisito.asignaturaId}-${requisito.requisitoAsignaturaId}-${requisito.tipo}`;

      if (relacionesDelLote.has(clave)) {
        throw new BadRequestException(
          'La carga contiene relaciones académicas repetidas.',
        );
      }

      relacionesDelLote.add(clave);
      asignaturaIds.add(requisito.asignaturaId);
      asignaturaIds.add(requisito.requisitoAsignaturaId);
    }

    const ids = [...asignaturaIds];
    const asignaturas = await this.asignaturaRepository.find({
      where: {
        id: In(ids),
        planEstudioId: planId,
      },
    });

    if (asignaturas.length !== ids.length) {
      throw new BadRequestException(
        'Una de las asignaturas seleccionadas no pertenece al plan.',
      );
    }

    if (asignaturas.some((asignatura) => !asignatura.activo)) {
      throw new BadRequestException(
        'No se pueden utilizar asignaturas inactivas en una relación de requisitos.',
      );
    }

    const duplicadas = await this.requisitoRepository.find({
      where: dto.requisitos.map((requisito) => ({
        asignaturaId: requisito.asignaturaId,
        requisitoAsignaturaId: requisito.requisitoAsignaturaId,
        tipo: requisito.tipo,
      })),
    });

    if (duplicadas.length > 0) {
      throw new ConflictException(
        'Una o más relaciones académicas ya están registradas.',
      );
    }

    const existenNuevosRequisitos = dto.requisitos.some(
      (item) => item.tipo === TipoRequisito.REQUISITO,
    );

    if (existenNuevosRequisitos) {
      const existentes = await this.obtenerRequisitosDelPlan(planId);
      this.validarSinCiclos(existentes, dto.requisitos);
    }

    const nuevas = dto.requisitos.map((requisito) =>
      this.requisitoRepository.create({
        asignaturaId: requisito.asignaturaId,
        requisitoAsignaturaId: requisito.requisitoAsignaturaId,
        tipo: requisito.tipo,
      }),
    );

    try {
      const guardadas = await this.dataSource.transaction(async (manager) => {
        return manager.getRepository(PlanRequisito).save(nuevas);
      });

      return {
        total: guardadas.length,
      };
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async eliminar(planId: number, id: number) {
    await this.obtenerPlan(planId, true);
    await this.obtenerRelacion(planId, id);
    await this.requisitoRepository.delete(id);

    return {
      message: 'Relación académica eliminada correctamente.',
    };
  }
}
