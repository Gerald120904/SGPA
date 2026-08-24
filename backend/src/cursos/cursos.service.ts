import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { ActualizarCursoDto } from './dto/actualizar-curso.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { Curso } from './entities/curso.entity';

@Injectable()
export class CursosService {
  constructor(
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
  ) {}

  private async obtenerEntidadPorId(id: number): Promise<Curso> {
    const curso = await this.cursoRepository.findOne({
      where: { id },
      relations: {
        carreras: true,
      },
    });

    if (!curso) {
      throw new NotFoundException('Curso no encontrado.');
    }

    return curso;
  }

  private async obtenerCarreras(carreraIds: number[]): Promise<Carrera[]> {
    const ids = [...new Set(carreraIds)];

    if (ids.length === 0) {
      throw new BadRequestException(
        'El curso debe pertenecer al menos a una carrera.',
      );
    }

    const carreras = await this.carreraRepository.find({
      where: {
        id: In(ids),
      },
      order: {
        nombre: 'ASC',
      },
    });

    if (carreras.length !== ids.length) {
      throw new BadRequestException(
        'Una o más carreras seleccionadas no existen.',
      );
    }

    return carreras;
  }

  private async validarCodigoDuplicado(
    codigo: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.cursoRepository.findOne({
      where: { codigo },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException('El código del curso ya está registrado.');
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
      throw new ConflictException('El código del curso ya está registrado.');
    }

    throw error;
  }

  async listar(): Promise<Curso[]> {
    return this.cursoRepository.find({
      relations: {
        carreras: true,
      },
      order: {
        codigo: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<Curso> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearCursoDto): Promise<Curso> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;

    if (!codigo) {
      throw new BadRequestException('El código del curso es obligatorio.');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre del curso es obligatorio.');
    }

    await this.validarCodigoDuplicado(codigo);
    const carreras = await this.obtenerCarreras(dto.carreraIds);

    const curso = this.cursoRepository.create({
      codigo,
      nombre,
      descripcion,
      activo: true,
      carreras,
    });

    try {
      const guardado = await this.cursoRepository.save(curso);
      return this.obtenerEntidadPorId(guardado.id);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(id: number, dto: ActualizarCursoDto): Promise<Curso> {
    const curso = await this.obtenerEntidadPorId(id);

    const codigo =
      dto.codigo !== undefined ? dto.codigo.trim().toUpperCase() : undefined;
    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;

    if (codigo !== undefined && !codigo) {
      throw new BadRequestException(
        'El código del curso no puede estar vacío.',
      );
    }

    if (nombre !== undefined && !nombre) {
      throw new BadRequestException(
        'El nombre del curso no puede estar vacío.',
      );
    }

    if (codigo !== undefined) {
      await this.validarCodigoDuplicado(codigo, id);
    }

    if (codigo !== undefined) {
      curso.codigo = codigo;
    }

    if (nombre !== undefined) {
      curso.nombre = nombre;
    }

    if (dto.descripcion !== undefined) {
      curso.descripcion = dto.descripcion?.trim() || null;
    }

    if (dto.carreraIds !== undefined) {
      curso.carreras = await this.obtenerCarreras(dto.carreraIds);
    }

    try {
      await this.cursoRepository.save(curso);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<Curso> {
    await this.obtenerEntidadPorId(id);

    await this.cursoRepository.update(id, { activo });

    return this.obtenerEntidadPorId(id);
  }
}
