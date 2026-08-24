import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Curso } from '../cursos/entities/curso.entity';
import { ActualizarPlanAsignaturaDto } from './dto/actualizar-plan-asignatura.dto';
import { CargaMasivaPlanAsignaturasDto } from './dto/carga-masiva-plan-asignaturas.dto';
import { CrearPlanAsignaturaDto } from './dto/crear-plan-asignatura.dto';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';

@Injectable()
export class PlanAsignaturasService {
  constructor(
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(BloquePlan)
    private readonly bloqueRepository: Repository<BloquePlan>,
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
        bloque: true,
      },
    });

    if (!asignatura) {
      throw new NotFoundException('Asignatura del plan no encontrada.');
    }

    return asignatura;
  }

  private async obtenerBloqueValido(
    planId: number,
    bloqueId: number,
  ): Promise<BloquePlan> {
    const bloque = await this.bloqueRepository.findOne({
      where: {
        id: bloqueId,
        planEstudioId: planId,
      },
    });

    if (!bloque) {
      throw new BadRequestException(
        'El bloque seleccionado no pertenece a este plan de estudio.',
      );
    }

    if (!bloque.activo) {
      throw new BadRequestException('No se puede utilizar un bloque inactivo.');
    }

    return bloque;
  }

  private async obtenerCursoValido(
    cursoId: number,
    carreraId: number,
  ): Promise<Curso> {
    const curso = await this.cursoRepository.findOne({
      where: { id: cursoId },
      relations: {
        carreras: true,
      },
    });

    if (!curso) {
      throw new BadRequestException('El curso seleccionado no existe.');
    }

    if (!curso.activo) {
      throw new BadRequestException(
        'No se puede agregar un curso inactivo al plan.',
      );
    }

    const perteneceCarrera = (curso.carreras ?? []).some(
      (carrera) => carrera.id === carreraId,
    );

    if (!perteneceCarrera) {
      throw new BadRequestException(
        'El curso seleccionado no está asociado a la carrera de este plan.',
      );
    }

    return curso;
  }

  private async validarCursoDuplicado(
    planId: number,
    cursoId: number,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.asignaturaRepository.findOne({
      where: {
        planEstudioId: planId,
        cursoId,
      },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException(
        'El curso ya está incluido en este plan de estudio.',
      );
    }
  }

  private async prepararAsignatura(
    plan: PlanEstudio,
    dto: CrearPlanAsignaturaDto,
  ): Promise<PlanAsignatura> {
    let bloque: BloquePlan | null = null;
    let curso: Curso | null = null;
    let codigoReferencia: string | null = null;
    let nombreReferencia: string | null = null;

    if (dto.bloqueId !== undefined) {
      bloque = await this.obtenerBloqueValido(plan.id, dto.bloqueId);
    }

    if (dto.cursoId !== undefined) {
      curso = await this.obtenerCursoValido(dto.cursoId, plan.carreraId);
      await this.validarCursoDuplicado(plan.id, curso.id);
    }

    if (!curso) {
      nombreReferencia = dto.nombreReferencia?.trim() || null;
      codigoReferencia = dto.codigoReferencia?.trim().toUpperCase() || null;

      if (!nombreReferencia) {
        throw new BadRequestException(
          'Cuando no se selecciona un curso debe indicar el nombre de la asignatura o espacio del plan.',
        );
      }
    }

    return this.asignaturaRepository.create({
      planEstudioId: plan.id,
      bloqueId: bloque?.id ?? null,
      bloque,
      cursoId: curso?.id ?? null,
      curso,
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
        bloque: true,
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

    const guardada = await this.asignaturaRepository.save(asignatura);
    return this.obtenerAsignatura(planId, guardada.id);
  }

  async cargaMasiva(planId: number, dto: CargaMasivaPlanAsignaturasDto) {
    const plan = await this.obtenerPlan(planId, true);
    const cursoIds = dto.asignaturas
      .map((item) => item.cursoId)
      .filter((id): id is number => id !== undefined);
    const cursosUnicos = new Set(cursoIds);

    if (cursosUnicos.size !== cursoIds.length) {
      throw new BadRequestException(
        'La carga contiene el mismo curso más de una vez.',
      );
    }

    const preparadas: PlanAsignatura[] = [];

    for (const asignaturaDto of dto.asignaturas) {
      preparadas.push(await this.prepararAsignatura(plan, asignaturaDto));
    }

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
        bloque: true,
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

  async actualizar(
    planId: number,
    id: number,
    dto: ActualizarPlanAsignaturaDto,
  ): Promise<PlanAsignatura> {
    const plan = await this.obtenerPlan(planId, true);
    const asignatura = await this.obtenerAsignatura(planId, id);

    if (dto.bloqueId !== undefined) {
      if (dto.bloqueId === null) {
        asignatura.bloqueId = null;
        asignatura.bloque = null;
      } else {
        const bloque = await this.obtenerBloqueValido(planId, dto.bloqueId);
        asignatura.bloqueId = bloque.id;
        asignatura.bloque = bloque;
      }
    }

    if (dto.cursoId !== undefined) {
      if (dto.cursoId === null) {
        asignatura.cursoId = null;
        asignatura.curso = null;
      } else {
        const curso = await this.obtenerCursoValido(
          dto.cursoId,
          plan.carreraId,
        );

        await this.validarCursoDuplicado(planId, curso.id, id);
        asignatura.cursoId = curso.id;
        asignatura.curso = curso;
      }
    }

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
    if (dto.tipo !== undefined) asignatura.tipo = dto.tipo;

    if (dto.codigoReferencia !== undefined) {
      asignatura.codigoReferencia =
        dto.codigoReferencia?.trim().toUpperCase() || null;
    }

    if (dto.nombreReferencia !== undefined) {
      asignatura.nombreReferencia = dto.nombreReferencia?.trim() || null;
    }

    if (asignatura.cursoId !== null) {
      asignatura.codigoReferencia = null;
      asignatura.nombreReferencia = null;
    }

    if (asignatura.cursoId === null && !asignatura.nombreReferencia) {
      throw new BadRequestException(
        'Una asignatura sin curso debe tener un nombre de referencia.',
      );
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
    await this.obtenerAsignatura(planId, id);
    await this.asignaturaRepository.update(id, { activo });
    return this.obtenerAsignatura(planId, id);
  }
}
