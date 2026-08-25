import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { ActualizarCursoDto } from './dto/actualizar-curso.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { ListarAsignaturasDisponiblesDto } from './dto/listar-asignaturas-disponibles.dto';
import { Curso } from './entities/curso.entity';

@Injectable()
export class CursosService {
  constructor(
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepository: Repository<PlanAsignatura>,
  ) {}

  private async obtenerAsignaturaFuente(
    planAsignaturaId: number,
  ): Promise<PlanAsignatura> {
    const asignatura = await this.planAsignaturaRepository.findOne({
      where: {
        id: planAsignaturaId,
      },
      relations: {
        planEstudio: {
          carrera: true,
        },
        curso: true,
      },
    });

    if (!asignatura) {
      throw new NotFoundException(
        'La asignatura seleccionada no existe en el plan de estudio.',
      );
    }

    if (!asignatura.activo) {
      throw new BadRequestException(
        'No se puede crear un curso desde una asignatura inactiva.',
      );
    }

    if (!asignatura.planEstudio?.activo) {
      throw new BadRequestException(
        'No se puede crear un curso desde un plan de estudio inactivo.',
      );
    }

    if (!asignatura.planEstudio.carrera?.activo) {
      throw new BadRequestException(
        'La carrera asociada al plan se encuentra inactiva.',
      );
    }

    if (asignatura.cursoId !== null) {
      throw new ConflictException(
        'Esta asignatura del plan ya está vinculada a un curso.',
      );
    }

    if (!asignatura.codigoReferencia?.trim()) {
      throw new BadRequestException(
        'La asignatura del plan no tiene un código válido.',
      );
    }

    if (!asignatura.nombreReferencia?.trim()) {
      throw new BadRequestException(
        'La asignatura del plan no tiene un nombre válido.',
      );
    }

    return asignatura;
  }

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

  async listarAsignaturasDisponibles(
    filtros: ListarAsignaturasDisponiblesDto,
  ): Promise<PlanAsignatura[]> {
    return this.planAsignaturaRepository.find({
      where: {
        activo: true,
        cursoId: IsNull(),
        ...(filtros.planId !== undefined
          ? {
              planEstudioId: filtros.planId,
            }
          : {}),
        ...(filtros.nivel !== undefined
          ? {
              nivel: filtros.nivel,
            }
          : {}),
        ...(filtros.ciclo !== undefined
          ? {
              ciclo: filtros.ciclo,
            }
          : {}),
        planEstudio: {
          activo: true,
          ...(filtros.carreraId !== undefined
            ? {
                carreraId: filtros.carreraId,
              }
            : {}),
        },
      },
      relations: {
        planEstudio: {
          carrera: true,
        },
        bloque: true,
      },
      order: {
        nivel: 'ASC',
        ciclo: 'ASC',
        orden: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<Curso> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearCursoDto): Promise<Curso> {
    const asignatura = await this.obtenerAsignaturaFuente(
      dto.planAsignaturaId,
    );

    const codigo = asignatura.codigoReferencia!.trim().toUpperCase();
    const nombre = asignatura.nombreReferencia!.trim();
    const descripcion = dto.descripcion?.trim() || null;
    const carrera = asignatura.planEstudio.carrera;

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
          'El curso correspondiente ya existe, pero se encuentra inactivo.',
        );
      }

      const yaPerteneceCarrera = (curso.carreras ?? []).some(
        (item) => item.id === carrera.id,
      );

      if (!yaPerteneceCarrera) {
        curso.carreras = [...(curso.carreras ?? []), carrera];
        curso = await this.cursoRepository.save(curso);
      }
    } else {
      const nuevoCurso = this.cursoRepository.create({
        codigo,
        nombre,
        descripcion,
        activo: true,
        carreras: [carrera],
      });

      try {
        curso = await this.cursoRepository.save(nuevoCurso);
      } catch (error) {
        this.relanzarErrorPersistencia(error);
      }
    }

    asignatura.cursoId = curso.id;
    asignatura.curso = curso;

    await this.planAsignaturaRepository.save(asignatura);

    return this.obtenerEntidadPorId(curso.id);
  }

  async actualizar(id: number, dto: ActualizarCursoDto): Promise<Curso> {
    const curso = await this.obtenerEntidadPorId(id);

    if (dto.descripcion !== undefined) {
      curso.descripcion = dto.descripcion?.trim() || null;
    }

    await this.cursoRepository.save(curso);

    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<Curso> {
    await this.obtenerEntidadPorId(id);

    await this.cursoRepository.update(id, { activo });

    return this.obtenerEntidadPorId(id);
  }
}
