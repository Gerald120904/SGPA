import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { EstadoPerfilProfesor } from './constants/estado-perfil-profesor.constant';
import { ActualizarPerfilAcademicoDto } from './dto/actualizar-perfil-academico.dto';
import { CrearPerfilAcademicoDto } from './dto/crear-perfil-academico.dto';
import { FiltrarPerfilesAcademicosDto } from './dto/filtrar-perfiles-academicos.dto';
import { CursoPerfilAcademico } from './entities/curso-perfil-academico.entity';
import { PerfilAcademico } from './entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from './entities/profesor-perfil-academico.entity';

@Injectable()
export class PerfilesAcademicosService {
  constructor(
    @InjectRepository(PerfilAcademico)
    private readonly perfilRepository: Repository<PerfilAcademico>,
    @InjectRepository(CursoPerfilAcademico)
    private readonly cursoPerfilRepository: Repository<CursoPerfilAcademico>,
    @InjectRepository(ProfesorPerfilAcademico)
    private readonly profesorPerfilRepository: Repository<ProfesorPerfilAcademico>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
  ) {}

  private async validarAlcanceCarrera(
    usuarioId: number,
    esAdminGlobal: boolean,
    carreraId: number,
  ): Promise<void> {
    if (esAdminGlobal) {
      return;
    }

    const autorizado =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        carreraId,
      );

    if (!autorizado) {
      throw new ForbiddenException(
        'No posee autoridad académica sobre esta carrera.',
      );
    }
  }

  private async obtenerCarrera(carreraId: number): Promise<Carrera> {
    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });

    if (!carrera) {
      throw new NotFoundException('Carrera no encontrada.');
    }

    if (!carrera.activo) {
      throw new BadRequestException(
        'La carrera seleccionada se encuentra inactiva.',
      );
    }

    return carrera;
  }

  async listar(
    filtros: FiltrarPerfilesAcademicosDto = {},
  ): Promise<PerfilAcademico[]> {
    return this.perfilRepository.find({
      where: {
        ...(filtros.carreraId !== undefined
          ? { carreraId: filtros.carreraId }
          : {}),
        ...(filtros.activo !== undefined ? { activo: filtros.activo } : {}),
      },
      relations: {
        carrera: true,
      },
      order: {
        carreraId: 'ASC',
        codigo: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<PerfilAcademico> {
    const perfil = await this.perfilRepository.findOne({
      where: { id },
      relations: {
        carrera: true,
      },
    });

    if (!perfil) {
      throw new NotFoundException('Perfil académico no encontrado.');
    }

    return perfil;
  }

  async crear(
    dto: CrearPerfilAcademicoDto,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<PerfilAcademico> {
    await this.validarAlcanceCarrera(usuarioId, esAdminGlobal, dto.carreraId);

    const carrera = await this.obtenerCarrera(dto.carreraId);
    const codigo = dto.codigo.trim().toUpperCase();

    const existente = await this.perfilRepository.findOne({
      where: {
        carreraId: dto.carreraId,
        codigo,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Ya existe un perfil académico con ese código en esta carrera.',
      );
    }

    const nuevo = this.perfilRepository.create({
      carreraId: carrera.id,
      codigo,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
      carrera,
    });

    const guardado = await this.perfilRepository.save(nuevo);
    return this.obtenerPorId(guardado.id);
  }

  async actualizar(
    id: number,
    dto: ActualizarPerfilAcademicoDto,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<PerfilAcademico> {
    const perfil = await this.obtenerPorId(id);

    await this.validarAlcanceCarrera(
      usuarioId,
      esAdminGlobal,
      perfil.carreraId,
    );

    if (dto.nombre !== undefined) {
      perfil.nombre = dto.nombre.trim();
    }

    if (dto.descripcion !== undefined) {
      perfil.descripcion = dto.descripcion?.trim() || null;
    }

    await this.perfilRepository.save(perfil);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<PerfilAcademico> {
    const perfil = await this.obtenerPorId(id);

    await this.validarAlcanceCarrera(
      usuarioId,
      esAdminGlobal,
      perfil.carreraId,
    );

    if (!activo) {
      const [profesoresAprobados, cursosActivos] = await Promise.all([
        this.profesorPerfilRepository.count({
          where: {
            perfilAcademicoId: id,
            estado: EstadoPerfilProfesor.APROBADO,
          },
        }),
        this.cursoPerfilRepository.count({
          where: {
            perfilAcademicoId: id,
            activo: true,
          },
        }),
      ]);

      if (profesoresAprobados > 0) {
        throw new BadRequestException(
          'No se puede desactivar el perfil académico porque tiene profesores con este perfil aprobado.',
        );
      }

      if (cursosActivos > 0) {
        throw new BadRequestException(
          'No se puede desactivar el perfil académico porque tiene cursos asociados activos.',
        );
      }
    }

    await this.perfilRepository.update(id, { activo });
    return this.obtenerPorId(id);
  }

  async listarCursosPorPerfil(
    perfilId: number,
  ): Promise<CursoPerfilAcademico[]> {
    await this.obtenerPorId(perfilId);

    return this.cursoPerfilRepository.find({
      where: {
        perfilAcademicoId: perfilId,
        activo: true,
      },
      relations: {
        curso: true,
        perfilAcademico: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async asociarCurso(
    perfilId: number,
    cursoId: number,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<CursoPerfilAcademico> {
    const perfil = await this.obtenerPorId(perfilId);

    await this.validarAlcanceCarrera(
      usuarioId,
      esAdminGlobal,
      perfil.carreraId,
    );

    if (!perfil.activo) {
      throw new BadRequestException(
        'No se pueden asociar cursos a un perfil académico inactivo.',
      );
    }

    const curso = await this.cursoRepository.findOne({
      where: { id: cursoId },
    });

    if (!curso) {
      throw new NotFoundException('Curso no encontrado.');
    }

    if (!curso.activo) {
      throw new BadRequestException(
        'No se puede asociar un curso inactivo a un perfil académico.',
      );
    }

    const existente = await this.cursoPerfilRepository.findOne({
      where: {
        perfilAcademicoId: perfilId,
        cursoId,
      },
    });

    if (existente) {
      if (existente.activo) {
        throw new ConflictException(
          'El curso ya se encuentra asociado a este perfil académico.',
        );
      }

      existente.activo = true;
      await this.cursoPerfilRepository.save(existente);
      return this.cursoPerfilRepository.findOneOrFail({
        where: { id: existente.id },
        relations: { curso: true, perfilAcademico: true },
      });
    }

    const relacion = this.cursoPerfilRepository.create({
      perfilAcademicoId: perfilId,
      cursoId,
      activo: true,
      curso,
      perfilAcademico: perfil,
    });

    const guardada = await this.cursoPerfilRepository.save(relacion);
    return this.cursoPerfilRepository.findOneOrFail({
      where: { id: guardada.id },
      relations: { curso: true, perfilAcademico: true },
    });
  }

  async desasociarCurso(
    perfilId: number,
    cursoId: number,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<void> {
    const perfil = await this.obtenerPorId(perfilId);

    await this.validarAlcanceCarrera(
      usuarioId,
      esAdminGlobal,
      perfil.carreraId,
    );

    const relacion = await this.cursoPerfilRepository.findOne({
      where: {
        perfilAcademicoId: perfilId,
        cursoId,
      },
    });

    if (!relacion) {
      throw new NotFoundException(
        'La relación entre el curso y el perfil académico no existe.',
      );
    }

    await this.cursoPerfilRepository.remove(relacion);
  }
}
