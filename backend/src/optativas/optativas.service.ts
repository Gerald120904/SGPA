import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { TipoOptativa } from './constants/tipo-optativa.constant';
import { ActualizarOptativaDto } from './dto/actualizar-optativa.dto';
import { CrearOptativaDto } from './dto/crear-optativa.dto';
import { CursoOptativo } from './entities/curso-optativo.entity';

@Injectable()
export class OptativasService {
  constructor(
    @InjectRepository(CursoOptativo)
    private readonly optativaRepository: Repository<CursoOptativo>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
  ) {}

  private async obtenerCarrera(carreraId: number): Promise<Carrera> {
    const carrera = await this.carreraRepository.findOne({
      where: {
        id: carreraId,
      },
    });

    if (!carrera) {
      throw new NotFoundException('Carrera de origen no encontrada.');
    }

    if (!carrera.activo) {
      throw new BadRequestException(
        'La carrera de origen se encuentra inactiva.',
      );
    }

    return carrera;
  }

  private validarOrigen(
    tipo: TipoOptativa,
    carreraOrigenId?: number | null,
  ): void {
    if (tipo === TipoOptativa.DISCIPLINARIA && !carreraOrigenId) {
      throw new BadRequestException(
        'Una optativa disciplinaria debe indicar su carrera de origen.',
      );
    }
  }

  private async obtenerOCrearCurso(
    dto: CrearOptativaDto,
    carreraOrigen: Carrera | null,
  ): Promise<Curso> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();

    let curso = await this.cursoRepository.findOne({
      where: {
        codigo,
      },
      relations: {
        carreras: true,
      },
    });

    if (curso) {
      if (curso.nombre.trim().toLowerCase() !== nombre.toLowerCase()) {
        throw new ConflictException(
          `Ya existe el curso ${codigo}, pero tiene un nombre diferente.`,
        );
      }

      if (!curso.activo) {
        throw new BadRequestException(
          'El curso ya existe, pero se encuentra inactivo.',
        );
      }

      return curso;
    }

    curso = this.cursoRepository.create({
      codigo,
      nombre,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
      carreras: carreraOrigen ? [carreraOrigen] : [],
    });

    return this.cursoRepository.save(curso);
  }

  async crear(dto: CrearOptativaDto): Promise<CursoOptativo> {
    this.validarOrigen(dto.tipo, dto.carreraOrigenId);

    const carreraOrigen = dto.carreraOrigenId
      ? await this.obtenerCarrera(dto.carreraOrigenId)
      : null;

    const curso = await this.obtenerOCrearCurso(dto, carreraOrigen);

    const existente = await this.optativaRepository.findOne({
      where: {
        cursoId: curso.id,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Este curso ya se encuentra registrado en el catálogo de optativas.',
      );
    }

    const optativa = this.optativaRepository.create({
      cursoId: curso.id,
      curso,
      tipo: dto.tipo,
      carreraOrigenId: carreraOrigen?.id ?? null,
      carreraOrigen,
      activo: true,
    });

    await this.optativaRepository.save(optativa);

    return this.obtenerPorId(optativa.id);
  }

  async listar(): Promise<CursoOptativo[]> {
    return this.optativaRepository.find({
      relations: {
        curso: true,
        carreraOrigen: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<CursoOptativo> {
    const optativa = await this.optativaRepository.findOne({
      where: {
        id,
      },
      relations: {
        curso: true,
        carreraOrigen: true,
      },
    });

    if (!optativa) {
      throw new NotFoundException('Optativa no encontrada.');
    }

    return optativa;
  }

  async actualizar(
    id: number,
    dto: ActualizarOptativaDto,
  ): Promise<CursoOptativo> {
    const optativa = await this.obtenerPorId(id);

    const tipoResultante = dto.tipo ?? optativa.tipo;
    const carreraResultante =
      dto.carreraOrigenId !== undefined
        ? dto.carreraOrigenId
        : optativa.carreraOrigenId;

    this.validarOrigen(tipoResultante, carreraResultante);

    if (dto.tipo !== undefined) {
      optativa.tipo = dto.tipo;
    }

    if (dto.carreraOrigenId !== undefined) {
      if (dto.carreraOrigenId === null) {
        optativa.carreraOrigenId = null;
        optativa.carreraOrigen = null;
      } else {
        const carrera = await this.obtenerCarrera(dto.carreraOrigenId);
        optativa.carreraOrigenId = carrera.id;
        optativa.carreraOrigen = carrera;
      }
    }

    if (dto.descripcion !== undefined) {
      optativa.curso.descripcion = dto.descripcion?.trim() || null;
      await this.cursoRepository.save(optativa.curso);
    }

    await this.optativaRepository.save(optativa);

    return this.obtenerPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<CursoOptativo> {
    await this.obtenerPorId(id);

    await this.optativaRepository.update(id, {
      activo,
    });

    return this.obtenerPorId(id);
  }
}
