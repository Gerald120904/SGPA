import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';
import { CrearCarreraDto } from './dto/crear-carrera.dto';
import { Carrera } from './entities/carrera.entity';

@Injectable()
export class CarrerasService {
  constructor(
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
  ) {}

  private async obtenerEntidadPorId(id: number): Promise<Carrera> {
    const carrera = await this.carreraRepository.findOne({
      where: { id },
    });

    if (!carrera) {
      throw new NotFoundException('Carrera no encontrada.');
    }

    return carrera;
  }

  private async validarDuplicados(
    codigo?: string,
    nombre?: string,
    excluirId?: number,
  ): Promise<void> {
    if (codigo) {
      const existente = await this.carreraRepository.findOne({
        where: { codigo },
      });

      if (existente && existente.id !== excluirId) {
        throw new ConflictException('El código de carrera ya está registrado.');
      }
    }

    if (nombre) {
      const existente = await this.carreraRepository.findOne({
        where: { nombre },
      });

      if (existente && existente.id !== excluirId) {
        throw new ConflictException(
          'El nombre de la carrera ya está registrado.',
        );
      }
    }
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          driverError?: {
            code?: string;
          };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'El código o nombre de la carrera ya está registrado.',
      );
    }

    throw error;
  }

  async listar(): Promise<Carrera[]> {
    return this.carreraRepository.find({
      order: {
        nombre: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<Carrera> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearCarreraDto): Promise<Carrera> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;

    if (!codigo) {
      throw new BadRequestException('El código de la carrera es obligatorio.');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre de la carrera es obligatorio.');
    }

    await this.validarDuplicados(codigo, nombre);

    const carrera = this.carreraRepository.create({
      codigo,
      nombre,
      grado: dto.grado,
      descripcion,
      activo: true,
    });

    try {
      return await this.carreraRepository.save(carrera);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(id: number, dto: ActualizarCarreraDto): Promise<Carrera> {
    await this.obtenerEntidadPorId(id);

    const codigo =
      dto.codigo !== undefined ? dto.codigo.trim().toUpperCase() : undefined;

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;

    if (codigo !== undefined && !codigo) {
      throw new BadRequestException(
        'El código de la carrera no puede estar vacío.',
      );
    }

    if (nombre !== undefined && !nombre) {
      throw new BadRequestException(
        'El nombre de la carrera no puede estar vacío.',
      );
    }

    await this.validarDuplicados(codigo, nombre, id);

    const cambios: Partial<Carrera> = {};

    if (codigo !== undefined) {
      cambios.codigo = codigo;
    }

    if (nombre !== undefined) {
      cambios.nombre = nombre;
    }

    if (dto.grado !== undefined) {
      cambios.grado = dto.grado;
    }

    if (dto.descripcion !== undefined) {
      cambios.descripcion = dto.descripcion?.trim() || null;
    }

    if (Object.keys(cambios).length > 0) {
      try {
        await this.carreraRepository.update(id, cambios);
      } catch (error) {
        this.relanzarErrorPersistencia(error);
      }
    }

    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<Carrera> {
    await this.obtenerEntidadPorId(id);

    await this.carreraRepository.update(id, { activo });

    return this.obtenerEntidadPorId(id);
  }
}
