import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActualizarBloquePlanDto } from './dto/actualizar-bloque-plan.dto';
import { CrearBloquePlanDto } from './dto/crear-bloque-plan.dto';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';

@Injectable()
export class BloquesPlanService {
  constructor(
    @InjectRepository(BloquePlan)
    private readonly bloqueRepository: Repository<BloquePlan>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
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

  private async obtenerBloque(planId: number, id: number): Promise<BloquePlan> {
    const bloque = await this.bloqueRepository.findOne({
      where: {
        id,
        planEstudioId: planId,
      },
    });

    if (!bloque) {
      throw new NotFoundException('Bloque del plan no encontrado.');
    }

    return bloque;
  }

  private async validarCodigoDuplicado(
    planId: number,
    codigo: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.bloqueRepository.findOne({
      where: {
        planEstudioId: planId,
        codigo,
      },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException(
        'Ya existe un bloque con ese código en este plan.',
      );
    }
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigoError =
      (
        error as {
          code?: string;
          driverError?: { code?: string };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigoError === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Ya existe un bloque con ese código en este plan.',
      );
    }

    throw error;
  }

  async listar(planId: number): Promise<BloquePlan[]> {
    await this.obtenerPlan(planId);

    return this.bloqueRepository.find({
      where: { planEstudioId: planId },
      order: {
        orden: 'ASC',
        nombre: 'ASC',
      },
    });
  }

  async obtenerPorId(planId: number, id: number): Promise<BloquePlan> {
    await this.obtenerPlan(planId);
    return this.obtenerBloque(planId, id);
  }

  async crear(planId: number, dto: CrearBloquePlanDto): Promise<BloquePlan> {
    await this.obtenerPlan(planId, true);

    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;

    if (!codigo) {
      throw new BadRequestException('El código del bloque es obligatorio.');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre del bloque es obligatorio.');
    }

    await this.validarCodigoDuplicado(planId, codigo);

    const bloque = this.bloqueRepository.create({
      planEstudioId: planId,
      codigo,
      nombre,
      tipo: dto.tipo,
      orden: dto.orden,
      descripcion,
      activo: true,
    });

    try {
      return await this.bloqueRepository.save(bloque);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(
    planId: number,
    id: number,
    dto: ActualizarBloquePlanDto,
  ): Promise<BloquePlan> {
    await this.obtenerPlan(planId, true);
    const bloque = await this.obtenerBloque(planId, id);

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();

      if (!codigo) {
        throw new BadRequestException(
          'El código del bloque no puede estar vacío.',
        );
      }

      await this.validarCodigoDuplicado(planId, codigo, id);
      bloque.codigo = codigo;
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      if (!nombre) {
        throw new BadRequestException(
          'El nombre del bloque no puede estar vacío.',
        );
      }

      bloque.nombre = nombre;
    }

    if (dto.tipo !== undefined) bloque.tipo = dto.tipo;
    if (dto.orden !== undefined) bloque.orden = dto.orden;

    if (dto.descripcion !== undefined) {
      bloque.descripcion = dto.descripcion?.trim() || null;
    }

    try {
      await this.bloqueRepository.save(bloque);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerBloque(planId, id);
  }

  async cambiarEstado(
    planId: number,
    id: number,
    activo: boolean,
  ): Promise<BloquePlan> {
    await this.obtenerPlan(planId, true);
    await this.obtenerBloque(planId, id);
    await this.bloqueRepository.update(id, { activo });
    return this.obtenerBloque(planId, id);
  }
}
