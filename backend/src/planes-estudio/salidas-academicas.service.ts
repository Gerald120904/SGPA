import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { ActualizarAsignaturasSalidaDto } from './dto/actualizar-asignaturas-salida.dto';
import { ActualizarSalidaAcademicaDto } from './dto/actualizar-salida-academica.dto';
import { CrearSalidaAcademicaDto } from './dto/crear-salida-academica.dto';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';

@Injectable()
export class SalidasAcademicasService {
  constructor(
    @InjectRepository(SalidaAcademica)
    private readonly salidaRepository: Repository<SalidaAcademica>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
  ) {}

  private async obtenerPlan(
    planId: number,
    exigirActivo = false,
  ): Promise<PlanEstudio> {
    const plan = await this.planRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('El plan de estudio no existe.');
    }

    if (exigirActivo && !plan.activo) {
      throw new BadRequestException(
        'No se puede modificar un plan de estudio inactivo.',
      );
    }

    return plan;
  }

  private async obtenerSalida(
    planId: number,
    salidaId: number,
  ): Promise<SalidaAcademica> {
    const salida = await this.salidaRepository.findOne({
      where: {
        id: salidaId,
        planEstudioId: planId,
      },
      relations: {
        asignaturas: {
          curso: true,
        },
      },
    });

    if (!salida) {
      throw new NotFoundException(
        'La salida académica no existe dentro de este plan.',
      );
    }

    return salida;
  }

  private async validarCodigo(
    planId: number,
    codigo: string,
    ignorarId?: number,
  ): Promise<void> {
    const existente = await this.salidaRepository.findOne({
      where: {
        planEstudioId: planId,
        codigo,
      },
    });

    if (existente && existente.id !== ignorarId) {
      throw new ConflictException(
        'Ya existe una salida académica con ese código dentro del plan.',
      );
    }
  }

  private async obtenerAsignaturasValidas(
    planId: number,
    ids: number[],
  ): Promise<PlanAsignatura[]> {
    if (ids.length === 0) {
      return [];
    }

    const asignaturas = await this.asignaturaRepository.find({
      where: {
        id: In(ids),
        planEstudioId: planId,
      },
      relations: {
        curso: true,
      },
    });

    if (asignaturas.length !== ids.length) {
      throw new BadRequestException(
        'Una o más asignaturas no pertenecen a este plan de estudio.',
      );
    }

    if (asignaturas.some((item) => !item.activo)) {
      throw new BadRequestException(
        'No se pueden agregar asignaturas inactivas a una salida académica.',
      );
    }

    return asignaturas;
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
        'Ya existe una salida académica con ese código dentro del plan.',
      );
    }

    throw error;
  }

  async listar(planId: number): Promise<SalidaAcademica[]> {
    await this.obtenerPlan(planId);

    return this.salidaRepository.find({
      where: { planEstudioId: planId },
      relations: {
        asignaturas: {
          curso: true,
        },
      },
      order: {
        orden: 'ASC',
        nombre: 'ASC',
      },
    });
  }

  async obtenerPorId(
    planId: number,
    salidaId: number,
  ): Promise<SalidaAcademica> {
    await this.obtenerPlan(planId);
    return this.obtenerSalida(planId, salidaId);
  }

  async crear(
    planId: number,
    dto: CrearSalidaAcademicaDto,
  ): Promise<SalidaAcademica> {
    await this.obtenerPlan(planId, true);

    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();

    if (!codigo) {
      throw new BadRequestException(
        'El código de la salida académica es obligatorio.',
      );
    }

    if (!nombre) {
      throw new BadRequestException(
        'El nombre de la salida académica es obligatorio.',
      );
    }

    await this.validarCodigo(planId, codigo);

    const salida = this.salidaRepository.create({
      planEstudioId: planId,
      codigo,
      nombre,
      tipo: dto.tipo,
      creditosRequeridos: dto.creditosRequeridos,
      orden: dto.orden,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
      asignaturas: [],
    });

    try {
      const guardada = await this.salidaRepository.save(salida);
      return this.obtenerSalida(planId, guardada.id);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(
    planId: number,
    salidaId: number,
    dto: ActualizarSalidaAcademicaDto,
  ): Promise<SalidaAcademica> {
    await this.obtenerPlan(planId, true);
    const salida = await this.obtenerSalida(planId, salidaId);

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();

      if (!codigo) {
        throw new BadRequestException(
          'El código de la salida académica no puede estar vacío.',
        );
      }

      await this.validarCodigo(planId, codigo, salidaId);
      salida.codigo = codigo;
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      if (!nombre) {
        throw new BadRequestException(
          'El nombre de la salida académica no puede estar vacío.',
        );
      }

      salida.nombre = nombre;
    }

    if (dto.tipo !== undefined) salida.tipo = dto.tipo;
    if (dto.creditosRequeridos !== undefined) {
      salida.creditosRequeridos = dto.creditosRequeridos;
    }
    if (dto.orden !== undefined) salida.orden = dto.orden;
    if (dto.descripcion !== undefined) {
      salida.descripcion = dto.descripcion?.trim() || null;
    }

    try {
      await this.salidaRepository.save(salida);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerSalida(planId, salidaId);
  }

  async reemplazarAsignaturas(
    planId: number,
    salidaId: number,
    dto: ActualizarAsignaturasSalidaDto,
  ): Promise<SalidaAcademica> {
    await this.obtenerPlan(planId, true);
    const salida = await this.obtenerSalida(planId, salidaId);

    if (!salida.activo) {
      throw new BadRequestException(
        'No se pueden modificar las asignaturas de una salida académica inactiva.',
      );
    }

    salida.asignaturas = await this.obtenerAsignaturasValidas(
      planId,
      dto.asignaturaIds,
    );
    await this.salidaRepository.save(salida);

    return this.obtenerSalida(planId, salidaId);
  }

  async cambiarEstado(
    planId: number,
    salidaId: number,
    activo: boolean,
  ): Promise<SalidaAcademica> {
    await this.obtenerPlan(planId, true);
    const salida = await this.obtenerSalida(planId, salidaId);
    salida.activo = activo;
    await this.salidaRepository.save(salida);

    return this.obtenerSalida(planId, salidaId);
  }

  huellaSalida(salida: SalidaAcademica): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          id: salida.id,
          planEstudioId: salida.planEstudioId,
          codigo: salida.codigo,
          nombre: salida.nombre,
          tipo: salida.tipo,
          creditosRequeridos: salida.creditosRequeridos,
          orden: salida.orden,
          descripcion: salida.descripcion,
          activo: salida.activo,
          updatedAt: salida.updatedAt ? new Date(salida.updatedAt).toISOString() : null,
        }),
      )
      .digest('hex');
  }

  async obtenerSalidaParaSolicitud(planId: number, id: number): Promise<SalidaAcademica> {
    return this.obtenerSalida(planId, id);
  }

  async crearDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    dto: CrearSalidaAcademicaDto,
    manager: EntityManager,
  ): Promise<number> {
    const planRepo = manager.getRepository(PlanEstudio);
    const salidaRepo = manager.getRepository(SalidaAcademica);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('El plan de estudio no existe.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    if (!codigo) throw new BadRequestException('El código de la salida académica es obligatorio.');
    if (!nombre) throw new BadRequestException('El nombre de la salida académica es obligatorio.');

    const existente = await salidaRepo.findOne({ where: { planEstudioId: planId, codigo } });
    if (existente) {
      throw new ConflictException('Ya existe una salida académica con ese código dentro del plan.');
    }

    const salida = salidaRepo.create({
      planEstudioId: planId,
      codigo,
      nombre,
      tipo: dto.tipo,
      creditosRequeridos: dto.creditosRequeridos,
      orden: dto.orden,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
      asignaturas: [],
    });

    const guardada = await salidaRepo.save(salida);
    return guardada.id;
  }

  async actualizarDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    id: number,
    dto: ActualizarSalidaAcademicaDto,
    huellaOriginal: string,
    manager: EntityManager,
  ): Promise<number> {
    const planRepo = manager.getRepository(PlanEstudio);
    const salidaRepo = manager.getRepository(SalidaAcademica);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('El plan de estudio no existe.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const salida = await salidaRepo.findOne({
      where: { id, planEstudioId: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!salida) throw new NotFoundException('La salida académica no existe dentro de este plan.');

    if (this.huellaSalida(salida) !== huellaOriginal) {
      throw new ConflictException('La salida académica cambió desde que se envió la solicitud.');
    }

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();
      if (!codigo) throw new BadRequestException('El código de la salida académica no puede estar vacío.');
      const existente = await salidaRepo.findOne({ where: { planEstudioId: planId, codigo } });
      if (existente && existente.id !== id) {
        throw new ConflictException('Ya existe una salida académica con ese código dentro del plan.');
      }
      salida.codigo = codigo;
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (!nombre) throw new BadRequestException('El nombre de la salida académica no puede estar vacío.');
      salida.nombre = nombre;
    }

    if (dto.tipo !== undefined) salida.tipo = dto.tipo;
    if (dto.creditosRequeridos !== undefined) salida.creditosRequeridos = dto.creditosRequeridos;
    if (dto.orden !== undefined) salida.orden = dto.orden;
    if (dto.descripcion !== undefined) salida.descripcion = dto.descripcion?.trim() || null;

    await salidaRepo.save(salida);
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
    const salidaRepo = manager.getRepository(SalidaAcademica);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('El plan de estudio no existe.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const salida = await salidaRepo.findOne({
      where: { id, planEstudioId: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!salida) throw new NotFoundException('La salida académica no existe dentro de este plan.');

    if (this.huellaSalida(salida) !== huellaOriginal) {
      throw new ConflictException('La salida académica cambió desde que se envió la solicitud.');
    }

    salida.activo = activo;
    await salidaRepo.save(salida);
    return id;
  }

  async reemplazarAsignaturasDesdeSolicitud(
    coordinadorId: number,
    asistenteId: number,
    planId: number,
    id: number,
    dto: ActualizarAsignaturasSalidaDto,
    manager: EntityManager,
  ): Promise<number> {
    const planRepo = manager.getRepository(PlanEstudio);
    const salidaRepo = manager.getRepository(SalidaAcademica);
    const asigRepo = manager.getRepository(PlanAsignatura);

    const plan = await planRepo.findOne({
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) throw new NotFoundException('El plan de estudio no existe.');
    if (!plan.activo) {
      throw new BadRequestException('No se puede modificar un plan de estudio inactivo.');
    }

    const salida = await salidaRepo.findOne({
      where: { id, planEstudioId: planId },
      relations: { asignaturas: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!salida) throw new NotFoundException('La salida académica no existe dentro de este plan.');

    if (!salida.activo) {
      throw new BadRequestException('No se pueden modificar las asignaturas de una salida académica inactiva.');
    }

    let asignaturasValidas: PlanAsignatura[] = [];
    if (dto.asignaturaIds.length > 0) {
      asignaturasValidas = await asigRepo.find({
        where: { id: In(dto.asignaturaIds), planEstudioId: planId },
      });
      if (asignaturasValidas.length !== dto.asignaturaIds.length) {
        throw new BadRequestException('Una o más asignaturas no pertenecen a este plan de estudio.');
      }
      if (asignaturasValidas.some((a) => !a.activo)) {
        throw new BadRequestException('No se pueden agregar asignaturas inactivas a una salida académica.');
      }
    }

    salida.asignaturas = asignaturasValidas;
    await salidaRepo.save(salida);
    return id;
  }
}
