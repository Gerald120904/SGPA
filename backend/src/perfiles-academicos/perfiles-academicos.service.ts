import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { ActualizarPerfilAcademicoDto } from './dto/actualizar-perfil-academico.dto';
import { CrearPerfilAcademicoDto } from './dto/crear-perfil-academico.dto';
import { FiltrarPerfilesAcademicosDto } from './dto/filtrar-perfiles-academicos.dto';
import { GuardarAreasPerfilDto } from './dto/guardar-areas-perfil.dto';
import { GuardarRequisitosPerfilDto } from './dto/guardar-requisitos-perfil.dto';
import { AreaPerfilAcademico } from './entities/area-perfil-academico.entity';
import { CursoPerfilAcademico } from './entities/curso-perfil-academico.entity';
import { PerfilAcademico } from './entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from './entities/profesor-perfil-academico.entity';
import { RequisitoPerfilAcademico } from './entities/requisito-perfil-academico.entity';

@Injectable()
export class PerfilesAcademicosService {
  constructor(
    @InjectRepository(PerfilAcademico)
    private readonly perfilRepository: Repository<PerfilAcademico>,
    @InjectRepository(CursoPerfilAcademico)
    private readonly cursoPerfilRepository: Repository<CursoPerfilAcademico>,
    @InjectRepository(ProfesorPerfilAcademico)
    private readonly profesorPerfilRepository: Repository<ProfesorPerfilAcademico>,
    @InjectRepository(AreaPerfilAcademico)
    private readonly areaPerfilRepository: Repository<AreaPerfilAcademico>,
    @InjectRepository(RequisitoPerfilAcademico)
    private readonly requisitoPerfilRepository: Repository<RequisitoPerfilAcademico>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly dataSource: DataSource,
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

  private async perfilEstaUtilizado(perfilId: number): Promise<boolean> {
    const cantidadSolicitudes = await this.profesorPerfilRepository.count({
      where: {
        perfilAcademicoId: perfilId,
      },
    });

    return cantidadSolicitudes > 0;
  }

  private async validarPerfilNoUtilizado(perfilId: number): Promise<void> {
    const utilizado = await this.perfilEstaUtilizado(perfilId);

    if (utilizado) {
      throw new ConflictException(
        'No se puede modificar la estructura del perfil académico porque ya ha sido solicitado por uno o más profesores. Cree un nuevo perfil para aplicar cambios estructurales.',
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
        areas: true,
        requisitos: true,
        cursos: { curso: true },
      },
      order: {
        areas: { tipo: 'ASC', orden: 'ASC', id: 'ASC' },
        requisitos: { obligatorio: 'DESC', orden: 'ASC', id: 'ASC' },
        cursos: { id: 'ASC' },
      },
    });

    if (!perfil) {
      throw new NotFoundException('Perfil académico no encontrado.');
    }

    return perfil;
  }

  async obtenerDetallePorId(id: number) {
    const perfil = await this.obtenerPorId(id);
    const utilizado = await this.perfilEstaUtilizado(id);

    return {
      ...perfil,
      utilizado,
      estructuraEditable: !utilizado,
    };
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
      numeroPerfil: dto.numeroPerfil?.trim() || null,
      consecutivo: dto.consecutivo?.trim() || null,
      acuerdoAprobacion: dto.acuerdoAprobacion?.trim() || null,
      fechaAprobacion: dto.fechaAprobacion || null,
      tipoRegistro: dto.tipoRegistro || null,
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

    if (dto.numeroPerfil !== undefined) {
      perfil.numeroPerfil = dto.numeroPerfil?.trim() || null;
    }

    if (dto.consecutivo !== undefined) {
      perfil.consecutivo = dto.consecutivo?.trim() || null;
    }

    if (dto.acuerdoAprobacion !== undefined) {
      perfil.acuerdoAprobacion = dto.acuerdoAprobacion?.trim() || null;
    }

    if (dto.fechaAprobacion !== undefined) {
      perfil.fechaAprobacion = dto.fechaAprobacion || null;
    }

    if (dto.tipoRegistro !== undefined) {
      perfil.tipoRegistro = dto.tipoRegistro || null;
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

    if (perfil.activo === activo) {
      return perfil;
    }

    await this.perfilRepository.update(id, {
      activo,
    });

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

  async listarAreas(perfilId: number): Promise<AreaPerfilAcademico[]> {
    await this.obtenerPorId(perfilId);

    return this.areaPerfilRepository.find({
      where: { perfilAcademicoId: perfilId },
      order: { tipo: 'ASC', orden: 'ASC', id: 'ASC' },
    });
  }

  async guardarAreas(
    perfilId: number,
    dto: GuardarAreasPerfilDto,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<AreaPerfilAcademico[]> {
    const perfil = await this.obtenerPorId(perfilId);
    await this.validarAlcanceCarrera(
      usuarioId,
      esAdminGlobal,
      perfil.carreraId,
    );
    await this.validarPerfilNoUtilizado(perfilId);

    const areas = dto.areas.map((area) => ({
      ...area,
      descripcion: area.descripcion.trim(),
    }));

    if (areas.some((area) => !area.descripcion)) {
      throw new BadRequestException(
        'Las descripciones de las áreas no pueden estar vacías.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AreaPerfilAcademico, {
        perfilAcademicoId: perfilId,
      });

      if (areas.length) {
        await manager.save(
          AreaPerfilAcademico,
          areas.map((area) =>
            manager.create(AreaPerfilAcademico, {
              ...area,
              perfilAcademicoId: perfilId,
            }),
          ),
        );
      }
    });

    return this.listarAreas(perfilId);
  }

  async listarRequisitos(
    perfilId: number,
  ): Promise<RequisitoPerfilAcademico[]> {
    await this.obtenerPorId(perfilId);

    return this.requisitoPerfilRepository.find({
      where: { perfilAcademicoId: perfilId },
      order: { obligatorio: 'DESC', orden: 'ASC', id: 'ASC' },
    });
  }

  async guardarRequisitos(
    perfilId: number,
    dto: GuardarRequisitosPerfilDto,
    usuarioId: number,
    esAdminGlobal: boolean,
  ): Promise<RequisitoPerfilAcademico[]> {
    const perfil = await this.obtenerPorId(perfilId);
    await this.validarAlcanceCarrera(
      usuarioId,
      esAdminGlobal,
      perfil.carreraId,
    );
    await this.validarPerfilNoUtilizado(perfilId);

    const requisitos = dto.requisitos.map((requisito) => ({
      ...requisito,
      descripcion: requisito.descripcion.trim(),
    }));

    if (requisitos.some((requisito) => !requisito.descripcion)) {
      throw new BadRequestException(
        'Las descripciones de los requisitos no pueden estar vacías.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RequisitoPerfilAcademico, {
        perfilAcademicoId: perfilId,
      });

      if (requisitos.length) {
        await manager.save(
          RequisitoPerfilAcademico,
          requisitos.map((requisito) =>
            manager.create(RequisitoPerfilAcademico, {
              ...requisito,
              perfilAcademicoId: perfilId,
            }),
          ),
        );
      }
    });

    return this.listarRequisitos(perfilId);
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

    await this.validarPerfilNoUtilizado(perfilId);

    const curso = await this.cursoRepository.findOne({
      where: { id: cursoId },
      relations: {
        carreras: true,
      },
    });

    if (!curso) {
      throw new NotFoundException('Curso no encontrado.');
    }

    if (!curso.activo) {
      throw new BadRequestException(
        'No se puede asociar un curso inactivo a un perfil académico.',
      );
    }

    const perteneceACarrera = (curso.carreras ?? []).some(
      (carrera) => carrera.id === perfil.carreraId,
    );

    if (!perteneceACarrera) {
      throw new BadRequestException(
        'El curso seleccionado no pertenece a la carrera del perfil académico.',
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

    await this.validarPerfilNoUtilizado(perfilId);

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
