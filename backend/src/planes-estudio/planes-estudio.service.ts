import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { ActualizarPlanEstudioDto } from './dto/actualizar-plan-estudio.dto';
import { CrearPlanEstudioDto } from './dto/crear-plan-estudio.dto';
import { PlanEstudio } from './entities/plan-estudio.entity';

@Injectable()
export class PlanesEstudioService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
  ) {}

  private async obtenerEntidadPorId(id: number): Promise<PlanEstudio> {
    const plan = await this.planRepository.findOne({
      where: { id },
      relations: {
        carrera: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan de estudio no encontrado.');
    }

    return plan;
  }

  private async obtenerCarreraActiva(carreraId: number): Promise<Carrera> {
    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });

    if (!carrera) {
      throw new BadRequestException('La carrera seleccionada no existe.');
    }

    if (!carrera.activo) {
      throw new BadRequestException(
        'No se puede crear un plan para una carrera inactiva.',
      );
    }

    return carrera;
  }

  private async validarCodigoDuplicado(
    carreraId: number,
    codigo: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.planRepository.findOne({
      where: {
        carreraId,
        codigo,
      },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException(
        'Ya existe un plan con ese código para la carrera.',
      );
    }
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          driverError?: {
            code?: string;
          };
          code?: string;
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Ya existe un plan con ese código para la carrera.',
      );
    }

    throw error;
  }

  async listar(): Promise<PlanEstudio[]> {
    return this.planRepository.find({
      relations: {
        carrera: true,
      },
      order: {
        carreraId: 'ASC',
        codigo: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<PlanEstudio> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearPlanEstudioDto): Promise<PlanEstudio> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;

    if (!codigo) {
      throw new BadRequestException('El código del plan es obligatorio.');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre del plan es obligatorio.');
    }

    await this.obtenerCarreraActiva(dto.carreraId);
    await this.validarCodigoDuplicado(dto.carreraId, codigo);

    const plan = this.planRepository.create({
      carreraId: dto.carreraId,
      codigo,
      nombre,
      descripcion,
      activo: true,
    });

    try {
      const guardado = await this.planRepository.save(plan);
      return this.obtenerEntidadPorId(guardado.id);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarPlanEstudioDto,
  ): Promise<PlanEstudio> {
    const plan = await this.obtenerEntidadPorId(id);

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();

      if (!codigo) {
        throw new BadRequestException(
          'El código del plan no puede estar vacío.',
        );
      }

      await this.validarCodigoDuplicado(plan.carreraId, codigo, id);
      plan.codigo = codigo;
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      if (!nombre) {
        throw new BadRequestException(
          'El nombre del plan no puede estar vacío.',
        );
      }

      plan.nombre = nombre;
    }

    if (dto.descripcion !== undefined) {
      plan.descripcion = dto.descripcion?.trim() || null;
    }

    try {
      await this.planRepository.save(plan);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<PlanEstudio> {
    await this.obtenerEntidadPorId(id);

    await this.planRepository.update(id, { activo });

    return this.obtenerEntidadPorId(id);
  }
}
