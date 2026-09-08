import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EstadoPerfilProfesor } from '../perfiles-academicos/constants/estado-perfil-profesor.constant';
import { CursoPerfilAcademico } from '../perfiles-academicos/entities/curso-perfil-academico.entity';
import { PerfilAcademico } from '../perfiles-academicos/entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from '../perfiles-academicos/entities/profesor-perfil-academico.entity';
import { EstadoAtestadoProfesor } from './constants/estado-atestado-profesor.constant';
import { EstadoDisponibilidad } from './constants/estado-disponibilidad.constant';
import {
  AccionHistorialPerfilProfesor,
  TipoHistorialPerfilProfesor,
} from './constants/historial-perfil-profesor.constant';
import { ActualizarAtestadoProfesorDto } from './dto/actualizar-atestado-profesor.dto';
import { ActualizarCarrerasPerfilDto } from './dto/actualizar-carreras-perfil.dto';
import { ActualizarProyectoProfesorDto } from './dto/actualizar-proyecto-profesor.dto';
import { CambiarEstadoProyectoProfesorDto } from './dto/cambiar-estado-proyecto-profesor.dto';
import { CrearAtestadoProfesorDto } from './dto/crear-atestado-profesor.dto';
import { CrearProyectoProfesorDto } from './dto/crear-proyecto-profesor.dto';
import { FiltroProfesoresDto } from './dto/filtro-profesores.dto';
import { RevisarAtestadoProfesorDto } from './dto/revisar-atestado-profesor.dto';
import { RevisarPerfilProfesorDto } from './dto/revisar-perfil-profesor.dto';
import { SolicitarPerfilProfesorDto } from './dto/solicitar-perfil-profesor.dto';
import { AtestadoProfesor } from './entities/atestado-profesor.entity';
import { DisponibilidadProfesor } from './entities/disponibilidad-profesor.entity';
import { HistorialPerfilProfesor } from './entities/historial-perfil-profesor.entity';
import { ProfesorCarrera } from './entities/profesor-carrera.entity';
import { ProyectoProfesor } from './entities/proyecto-profesor.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';

@Injectable()
export class ProfesoresService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,

    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,

    @InjectRepository(ProfesorCarrera)
    private readonly profesorCarreraRepository: Repository<ProfesorCarrera>,

    @InjectRepository(PerfilAcademico)
    private readonly perfilAcademicoRepository: Repository<PerfilAcademico>,

    @InjectRepository(ProfesorPerfilAcademico)
    private readonly profesorPerfilRepository: Repository<ProfesorPerfilAcademico>,

    @InjectRepository(CursoPerfilAcademico)
    private readonly cursoPerfilRepository: Repository<CursoPerfilAcademico>,

    @InjectRepository(AtestadoProfesor)
    private readonly atestadoRepository: Repository<AtestadoProfesor>,

    @InjectRepository(ProyectoProfesor)
    private readonly proyectoRepository: Repository<ProyectoProfesor>,

    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepository: Repository<PeriodoAcademico>,

    @InjectRepository(DisponibilidadProfesor)
    private readonly disponibilidadRepository: Repository<DisponibilidadProfesor>,

    @InjectRepository(HistorialPerfilProfesor)
    private readonly historialPerfilRepository: Repository<HistorialPerfilProfesor>,

    private readonly estructuraAcademicaService: EstructuraAcademicaService,

    private readonly dataSource: DataSource,
  ) {}

  private tieneRolProfesor(usuario: Usuario): boolean {
    return (usuario.usuarioRoles ?? []).some(
      (relacion) =>
        relacion.rol &&
        relacion.rol.activo &&
        (relacion.rol.nombre as RolSistema) === RolSistema.PROFESOR,
    );
  }

  private obtenerRolesUsuario(usuario: Usuario): string[] {
    return [
      ...new Set(
        (usuario.usuarioRoles ?? [])
          .filter((relacion) => relacion.rol && relacion.rol.activo)
          .map((relacion) => relacion.rol.nombre),
      ),
    ];
  }

  private mapearUsuarioProfesor(usuario: Usuario) {
    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      correo: usuario.correo,
      activo: usuario.activo,
      ultimoAcceso: usuario.ultimoAcceso,
      roles: this.obtenerRolesUsuario(usuario),
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }

  private obtenerEstadoDisponibilidadEfectivo(
    disponibilidad: DisponibilidadProfesor | undefined,
    periodo: PeriodoAcademico,
  ): EstadoDisponibilidad {
    if (!disponibilidad) {
      return EstadoDisponibilidad.PENDIENTE;
    }

    if (periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION) {
      return EstadoDisponibilidad.BLOQUEADA;
    }

    return disponibilidad.estado;
  }

  private async buscarUsuarioCompleto(id: number): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: {
        id,
      },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });
  }

  private async obtenerProfesor(id: number): Promise<Usuario> {
    const usuario = await this.buscarUsuarioCompleto(id);

    if (!usuario || !this.tieneRolProfesor(usuario)) {
      throw new NotFoundException('Profesor no encontrado.');
    }

    return usuario;
  }

  private async validarProfesorParaAutogestion(id: number): Promise<Usuario> {
    const usuario = await this.buscarUsuarioCompleto(id);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!usuario.activo) {
      throw new ForbiddenException('El usuario se encuentra inactivo.');
    }

    if (!this.tieneRolProfesor(usuario)) {
      throw new ForbiddenException(
        'El usuario no posee actualmente el rol PROFESOR.',
      );
    }

    return usuario;
  }

  private async obtenerCarrerasPerfil(
    profesorUsuarioId: number,
  ): Promise<ProfesorCarrera[]> {
    return this.profesorCarreraRepository.find({
      where: {
        profesorUsuarioId,
      },
      relations: {
        carrera: true,
      },
      order: {
        carreraId: 'ASC',
      },
    });
  }

  private async obtenerPerfilesProfesor(
    profesorUsuarioId: number,
  ): Promise<ProfesorPerfilAcademico[]> {
    return this.profesorPerfilRepository.find({
      where: {
        profesorUsuarioId,
      },
      relations: {
        perfilAcademico: {
          carrera: true,
        },
        solicitadoPor: true,
        revisadoPor: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private mapearPerfilProfesor(item: ProfesorPerfilAcademico) {
    return {
      id: item.id,
      perfilAcademicoId: item.perfilAcademicoId,
      codigo: item.perfilAcademico?.codigo ?? null,
      nombre: item.perfilAcademico?.nombre ?? null,
      estado: item.estado,
      carrera: item.perfilAcademico?.carrera
        ? {
            id: item.perfilAcademico.carrera.id,
            codigo: item.perfilAcademico.carrera.codigo,
            nombre: item.perfilAcademico.carrera.nombre,
          }
        : null,
      solicitadoPorUsuarioId: item.solicitadoPorUsuarioId,
      revisadoPorUsuarioId: item.revisadoPorUsuarioId,
      fechaRevision: item.fechaRevision,
      observacionRevision: item.observacionRevision,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async obtenerCursosHabilitados(profesorUsuarioId: number) {
    const perfiles = await this.profesorPerfilRepository.find({
      where: {
        profesorUsuarioId,
        estado: EstadoPerfilProfesor.APROBADO,
      },
      relations: {
        perfilAcademico: true,
      },
    });

    const perfilesActivos = perfiles.filter(
      (item) => item.perfilAcademico?.activo,
    );

    if (!perfilesActivos.length) {
      return [];
    }

    const perfilIds = perfilesActivos.map((item) => item.perfilAcademicoId);

    const relaciones = await this.cursoPerfilRepository.find({
      where: {
        perfilAcademicoId: In(perfilIds),
        activo: true,
      },
      relations: {
        curso: {
          carreras: true,
        },
        perfilAcademico: true,
      },
    });

    const cursos = new Map<
      number,
      {
        id: number;
        codigo: string;
        nombre: string;
        descripcion: string | null;
        carreras: {
          id: number;
          codigo: string;
          nombre: string;
        }[];
        habilitadoPor: {
          perfilId: number;
          codigo: string;
          nombre: string;
        }[];
      }
    >();

    for (const relacion of relaciones) {
      if (!relacion.curso?.activo || !relacion.perfilAcademico?.activo) {
        continue;
      }

      let curso = cursos.get(relacion.curso.id);

      if (!curso) {
        curso = {
          id: relacion.curso.id,
          codigo: relacion.curso.codigo,
          nombre: relacion.curso.nombre,
          descripcion: relacion.curso.descripcion,
          carreras: (relacion.curso.carreras ?? []).map((carrera) => ({
            id: carrera.id,
            codigo: carrera.codigo,
            nombre: carrera.nombre,
          })),
          habilitadoPor: [],
        };

        cursos.set(relacion.curso.id, curso);
      }

      if (
        !curso.habilitadoPor.some(
          (h) => h.perfilId === relacion.perfilAcademico.id,
        )
      ) {
        curso.habilitadoPor.push({
          perfilId: relacion.perfilAcademico.id,
          codigo: relacion.perfilAcademico.codigo,
          nombre: relacion.perfilAcademico.nombre,
        });
      }
    }

    return [...cursos.values()].sort((a, b) =>
      a.codigo.localeCompare(b.codigo),
    );
  }

  private async obtenerAtestadosProfesor(
    profesorUsuarioId: number,
  ): Promise<AtestadoProfesor[]> {
    return this.atestadoRepository.find({
      where: { profesorUsuarioId },
      relations: {
        revisadoPor: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private mapearAtestadoProfesor(item: AtestadoProfesor) {
    return {
      id: item.id,
      profesorUsuarioId: item.profesorUsuarioId,
      tipo: item.tipo,
      nombre: item.nombre,
      institucion: item.institucion,
      fechaObtencion: item.fechaObtencion,
      descripcion: item.descripcion,
      estado: item.estado,
      revisadoPorUsuarioId: item.revisadoPorUsuarioId,
      fechaRevision: item.fechaRevision,
      observacionRevision: item.observacionRevision,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async obtenerProyectosProfesor(
    profesorUsuarioId: number,
  ): Promise<ProyectoProfesor[]> {
    return this.proyectoRepository.find({
      where: { profesorUsuarioId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private mapearProyectoProfesor(item: ProyectoProfesor) {
    return {
      id: item.id,
      profesorUsuarioId: item.profesorUsuarioId,
      nombre: item.nombre,
      unidad: item.unidad,
      rol: item.rol,
      fechaInicio: item.fechaInicio,
      fechaFin: item.fechaFin,
      descripcion: item.descripcion,
      activo: item.activo,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async registrarHistorialPerfil(
    profesorUsuarioId: number,
    usuarioAccionId: number,
    tipo: TipoHistorialPerfilProfesor,
    accion: AccionHistorialPerfilProfesor,
    datosAnteriores: unknown | null,
    datosNuevos: unknown | null,
    cursoId: number | null = null,
    perfilAcademicoId: number | null = null,
    repository: Repository<HistorialPerfilProfesor> = this
      .historialPerfilRepository,
  ): Promise<void> {
    const historial = repository.create({
      profesorUsuarioId,
      usuarioAccionId,
      cursoId,
      perfilAcademicoId,
      tipo,
      accion,
      datosAnteriores,
      datosNuevos,
    });

    await repository.save(historial);
  }

  async listar(filtros: FiltroProfesoresDto = {}) {
    if ((filtros.dia && !filtros.hora) || (!filtros.dia && filtros.hora)) {
      throw new BadRequestException(
        'Para filtrar por horario debe indicar tanto el día como la hora.',
      );
    }

    const usaFiltroDisponibilidad =
      filtros.periodoAcademicoId !== undefined ||
      filtros.estadoDisponibilidad !== undefined ||
      filtros.dia !== undefined ||
      filtros.hora !== undefined;

    if (usaFiltroDisponibilidad && filtros.periodoAcademicoId === undefined) {
      throw new BadRequestException(
        'Debe indicar periodoAcademicoId para consultar o filtrar disponibilidad.',
      );
    }

    const usuarios = await this.usuarioRepository.find({
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
      order: {
        nombres: 'ASC',
        apellido1: 'ASC',
      },
    });

    const usuariosProfesores = usuarios.filter((usuario) =>
      this.tieneRolProfesor(usuario),
    );

    let profesores = await Promise.all(
      usuariosProfesores.map(async (profesor) => {
        const carreras = await this.obtenerCarrerasPerfil(profesor.id);
        const perfiles = await this.obtenerPerfilesProfesor(profesor.id);
        const cursosHabilitados = await this.obtenerCursosHabilitados(
          profesor.id,
        );

        return {
          ...this.mapearUsuarioProfesor(profesor),

          carreras: carreras.map((item) => ({
            id: item.carrera.id,
            codigo: item.carrera.codigo,
            nombre: item.carrera.nombre,
            activo: item.carrera.activo,
          })),

          perfilesAcademicos: perfiles.map((item) =>
            this.mapearPerfilProfesor(item),
          ),

          cursosHabilitados,
        };
      }),
    );

    if (filtros.nombre) {
      const busqueda = filtros.nombre.toLocaleLowerCase('es');

      profesores = profesores.filter((profesor) => {
        const nombreCompleto = [
          profesor.nombres,
          profesor.apellido1,
          profesor.apellido2,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('es');

        return nombreCompleto.includes(busqueda);
      });
    }

    if (filtros.cedula) {
      profesores = profesores.filter((profesor) =>
        profesor.cedula.includes(filtros.cedula!),
      );
    }

    if (filtros.activo !== undefined) {
      profesores = profesores.filter(
        (profesor) => profesor.activo === filtros.activo,
      );
    }

    if (filtros.carreraId !== undefined) {
      profesores = profesores.filter((profesor) =>
        profesor.carreras.some((carrera) => carrera.id === filtros.carreraId),
      );
    }

    if (filtros.perfilAcademicoId !== undefined) {
      profesores = profesores.filter((profesor) =>
        profesor.perfilesAcademicos.some(
          (perfil) =>
            perfil.perfilAcademicoId === filtros.perfilAcademicoId &&
            perfil.estado === EstadoPerfilProfesor.APROBADO,
        ),
      );
    }

    if (filtros.cursoId !== undefined) {
      profesores = profesores.filter((profesor) =>
        profesor.cursosHabilitados.some(
          (curso) => curso.id === filtros.cursoId,
        ),
      );
    }

    if (!usaFiltroDisponibilidad) {
      return profesores;
    }

    const periodo = await this.periodoRepository.findOne({
      where: {
        id: filtros.periodoAcademicoId!,
      },
    });

    if (!periodo) {
      throw new NotFoundException('Periodo académico no encontrado.');
    }

    if (profesores.length === 0) {
      return [];
    }

    const profesorIds = profesores.map((profesor) => profesor.id);

    const disponibilidades = await this.disponibilidadRepository.find({
      where: {
        profesorUsuarioId: In(profesorIds),
        periodoAcademicoId: filtros.periodoAcademicoId!,
      },
      relations: {
        bloques: true,
      },
    });

    const mapaDisponibilidad = new Map<number, DisponibilidadProfesor>();

    for (const disponibilidad of disponibilidades) {
      mapaDisponibilidad.set(disponibilidad.profesorUsuarioId, disponibilidad);
    }

    const resultado = profesores.map((profesor) => {
      const disponibilidad = mapaDisponibilidad.get(profesor.id);

      const estadoDisponibilidad = this.obtenerEstadoDisponibilidadEfectivo(
        disponibilidad,
        periodo,
      );

      const bloques = (disponibilidad?.bloques ?? []).map((bloque) => ({
        id: bloque.id,
        dia: bloque.dia,
        horaInicio: bloque.horaInicio.slice(0, 5),
        horaFin: bloque.horaFin.slice(0, 5),
      }));

      let disponibleEnHorario: boolean | null = null;

      if (filtros.dia && filtros.hora) {
        disponibleEnHorario =
          estadoDisponibilidad === EstadoDisponibilidad.REGISTRADA &&
          periodo.estado === EstadoPeriodoAcademico.EN_PREPARACION &&
          bloques.some(
            (bloque) =>
              bloque.dia === filtros.dia &&
              filtros.hora! >= bloque.horaInicio &&
              filtros.hora! < bloque.horaFin,
          );
      }

      return {
        ...profesor,

        disponibilidadPeriodo: {
          periodoAcademicoId: periodo.id,
          codigoPeriodo: periodo.codigo,
          estado: estadoDisponibilidad,
          registrada: disponibilidad !== undefined,
          bloques,
        },

        disponibleEnHorario,
      };
    });

    return resultado.filter((profesor) => {
      if (
        filtros.estadoDisponibilidad &&
        profesor.disponibilidadPeriodo.estado !== filtros.estadoDisponibilidad
      ) {
        return false;
      }

      if (
        filtros.dia &&
        filtros.hora &&
        profesor.disponibleEnHorario !== true
      ) {
        return false;
      }

      return true;
    });
  }

  async obtenerPorId(id: number) {
    const profesor = await this.obtenerProfesor(id);

    const [carreras, perfiles, cursosHabilitados, atestados, proyectos] =
      await Promise.all([
        this.obtenerCarrerasPerfil(id),
        this.obtenerPerfilesProfesor(id),
        this.obtenerCursosHabilitados(id),
        this.obtenerAtestadosProfesor(id),
        this.obtenerProyectosProfesor(id),
      ]);

    return {
      ...this.mapearUsuarioProfesor(profesor),

      carreras: carreras.map((item) => ({
        id: item.carrera.id,
        codigo: item.carrera.codigo,
        nombre: item.carrera.nombre,
        activo: item.carrera.activo,
      })),

      perfilesAcademicos: perfiles.map((item) =>
        this.mapearPerfilProfesor(item),
      ),

      cursosHabilitados,

      atestados: atestados.map((item) => this.mapearAtestadoProfesor(item)),

      proyectos: proyectos.map((item) => this.mapearProyectoProfesor(item)),
    };
  }

  async obtenerMiPerfil(usuarioId: number) {
    await this.validarProfesorParaAutogestion(usuarioId);

    return this.obtenerPorId(usuarioId);
  }

  async actualizarCarrerasMiPerfil(
    usuarioId: number,
    dto: ActualizarCarrerasPerfilDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const carreraIds = dto.carreraIds;

    let carreras: Carrera[] = [];

    if (carreraIds.length > 0) {
      carreras = await this.carreraRepository.find({
        where: {
          id: In(carreraIds),
          activo: true,
        },
      });

      if (carreras.length !== carreraIds.length) {
        throw new BadRequestException(
          'Una o más carreras no existen o se encuentran inactivas.',
        );
      }
    }

    const carrerasAnteriores = await this.profesorCarreraRepository.find({
      where: {
        profesorUsuarioId: usuarioId,
      },
      relations: {
        carrera: true,
      },
    });

    const idsAnteriores = carrerasAnteriores
      .map((item) => item.carreraId)
      .sort((a, b) => a - b);

    const idsNuevos = [...carreraIds].sort((a, b) => a - b);

    const huboCambios =
      JSON.stringify(idsAnteriores) !== JSON.stringify(idsNuevos);

    await this.dataSource.transaction(async (manager) => {
      const profesorCarreraRepo = manager.getRepository(ProfesorCarrera);
      const historialRepo = manager.getRepository(HistorialPerfilProfesor);

      await profesorCarreraRepo.delete({
        profesorUsuarioId: usuarioId,
      });

      if (carreras.length > 0) {
        const relaciones = carreras.map((carrera) =>
          profesorCarreraRepo.create({
            profesorUsuarioId: usuarioId,
            carreraId: carrera.id,
          }),
        );

        await profesorCarreraRepo.save(relaciones);
      }

      if (huboCambios) {
        await this.registrarHistorialPerfil(
          usuarioId,
          usuarioId,
          TipoHistorialPerfilProfesor.CARRERAS,
          AccionHistorialPerfilProfesor.ACTUALIZAR_CARRERAS,
          {
            carreraIds: idsAnteriores,
          },
          {
            carreraIds: idsNuevos,
          },
          null,
          null,
          historialRepo,
        );
      }
    });

    return this.obtenerMiPerfil(usuarioId);
  }

  // --- Cursos Habilitados ---

  async listarCursosHabilitadosMiPerfil(usuarioId: number) {
    await this.validarProfesorParaAutogestion(usuarioId);

    return this.obtenerCursosHabilitados(usuarioId);
  }

  // --- Perfiles Académicos (Nuevo Modelo) ---

  async listarPerfilesMiPerfil(usuarioId: number) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const perfiles = await this.obtenerPerfilesProfesor(usuarioId);

    return perfiles.map((item) => this.mapearPerfilProfesor(item));
  }

  async solicitarPerfilMiPerfil(
    usuarioId: number,
    dto: SolicitarPerfilProfesorDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const perfil = await this.perfilAcademicoRepository.findOne({
      where: {
        id: dto.perfilAcademicoId,
      },
      relations: {
        carrera: true,
      },
    });

    if (!perfil) {
      throw new NotFoundException('Perfil académico no encontrado.');
    }

    if (!perfil.activo) {
      throw new BadRequestException(
        'No se puede solicitar un perfil académico inactivo.',
      );
    }

    const existente = await this.profesorPerfilRepository.findOne({
      where: {
        profesorUsuarioId: usuarioId,
        perfilAcademicoId: perfil.id,
      },
    });

    if (existente) {
      if (existente.estado === EstadoPerfilProfesor.PENDIENTE) {
        throw new ConflictException(
          'Este perfil académico ya tiene una solicitud pendiente.',
        );
      }

      if (existente.estado === EstadoPerfilProfesor.APROBADO) {
        throw new ConflictException(
          'Este perfil académico ya se encuentra aprobado en el perfil docente.',
        );
      }

      const estadoAnterior = existente.estado;

      await this.dataSource.transaction(async (manager) => {
        const profesorPerfilRepo = manager.getRepository(
          ProfesorPerfilAcademico,
        );
        const historialRepo = manager.getRepository(HistorialPerfilProfesor);

        existente.estado = EstadoPerfilProfesor.PENDIENTE;
        existente.solicitadoPorUsuarioId = usuarioId;
        existente.revisadoPorUsuarioId = null;
        existente.fechaRevision = null;
        existente.observacionRevision = null;

        await profesorPerfilRepo.save(existente);

        await this.registrarHistorialPerfil(
          usuarioId,
          usuarioId,
          TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
          AccionHistorialPerfilProfesor.SOLICITAR_PERFIL,
          {
            perfilAcademicoId: existente.perfilAcademicoId,
            estado: estadoAnterior,
          },
          {
            perfilAcademicoId: existente.perfilAcademicoId,
            estado: EstadoPerfilProfesor.PENDIENTE,
          },
          null,
          existente.perfilAcademicoId,
          historialRepo,
        );
      });

      const actualizado = await this.profesorPerfilRepository.findOne({
        where: {
          id: existente.id,
        },
        relations: {
          perfilAcademico: {
            carrera: true,
          },
          solicitadoPor: true,
          revisadoPor: true,
        },
      });

      return actualizado ? this.mapearPerfilProfesor(actualizado) : null;
    }

    try {
      const guardada = await this.dataSource.transaction(async (manager) => {
        const profesorPerfilRepo = manager.getRepository(
          ProfesorPerfilAcademico,
        );
        const historialRepo = manager.getRepository(HistorialPerfilProfesor);

        const solicitud = profesorPerfilRepo.create({
          profesorUsuarioId: usuarioId,
          perfilAcademicoId: perfil.id,
          estado: EstadoPerfilProfesor.PENDIENTE,
          solicitadoPorUsuarioId: usuarioId,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
        });

        const solicitudGuardada = await profesorPerfilRepo.save(solicitud);

        await this.registrarHistorialPerfil(
          usuarioId,
          usuarioId,
          TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
          AccionHistorialPerfilProfesor.SOLICITAR_PERFIL,
          null,
          {
            perfilAcademicoId: perfil.id,
            estado: EstadoPerfilProfesor.PENDIENTE,
          },
          null,
          perfil.id,
          historialRepo,
        );

        return solicitudGuardada;
      });

      const resultado = await this.profesorPerfilRepository.findOne({
        where: {
          id: guardada.id,
        },
        relations: {
          perfilAcademico: {
            carrera: true,
          },
          solicitadoPor: true,
          revisadoPor: true,
        },
      });

      return resultado ? this.mapearPerfilProfesor(resultado) : null;
    } catch (error) {
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
          'Este perfil académico ya se encuentra registrado en el perfil docente.',
        );
      }

      throw error;
    }
  }

  async revisarPerfilProfesor(
    profesorId: number,
    perfilId: number,
    revisorUsuarioId: number,
    dto: RevisarPerfilProfesorDto,
  ) {
    const profesor = await this.obtenerProfesor(profesorId);

    const solicitud = await this.profesorPerfilRepository.findOne({
      where: {
        profesorUsuarioId: profesorId,
        perfilAcademicoId: perfilId,
      },
      relations: {
        perfilAcademico: {
          carrera: true,
        },
        solicitadoPor: true,
        revisadoPor: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException(
        'El perfil académico no se encuentra registrado en el perfil del profesor.',
      );
    }

    if (solicitud.estado !== EstadoPerfilProfesor.PENDIENTE) {
      throw new BadRequestException(
        'Únicamente se pueden revisar solicitudes que se encuentren pendientes.',
      );
    }

    const revisor = await this.usuarioRepository.findOne({
      where: { id: revisorUsuarioId },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });

    const esAdminRevisor = (revisor?.usuarioRoles ?? []).some(
      (rel) => rel.rol?.activo && rel.rol.nombre === RolSistema.ADMIN_GLOBAL,
    );

    if (!esAdminRevisor) {
      const carreraId =
        solicitud.perfilAcademico?.carreraId ??
        solicitud.perfilAcademico?.carrera?.id;

      if (carreraId) {
        const tieneAlcance =
          await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
            revisorUsuarioId,
            carreraId,
          );

        if (!tieneAlcance) {
          throw new ForbiddenException(
            'No posee autoridad académica sobre la carrera asociada a este perfil.',
          );
        }
      }
    }

    if (dto.estado === EstadoPerfilProfesor.APROBADO) {
      if (!profesor.activo) {
        throw new BadRequestException(
          'No se puede aprobar un perfil académico para un profesor inactivo.',
        );
      }

      if (!solicitud.perfilAcademico?.activo) {
        throw new BadRequestException(
          'No se puede aprobar un perfil académico que se encuentra inactivo.',
        );
      }
    }

    const estadoAnterior = solicitud.estado;

    await this.dataSource.transaction(async (manager) => {
      const profesorPerfilRepo = manager.getRepository(ProfesorPerfilAcademico);
      const historialRepo = manager.getRepository(HistorialPerfilProfesor);

      solicitud.estado = dto.estado;
      solicitud.revisadoPorUsuarioId = revisorUsuarioId;
      solicitud.fechaRevision = new Date();
      solicitud.observacionRevision = dto.observacion?.trim() || null;

      await profesorPerfilRepo.save(solicitud);

      const accion =
        dto.estado === EstadoPerfilProfesor.APROBADO
          ? AccionHistorialPerfilProfesor.APROBAR_PERFIL
          : AccionHistorialPerfilProfesor.RECHAZAR_PERFIL;

      await this.registrarHistorialPerfil(
        profesorId,
        revisorUsuarioId,
        TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
        accion,
        {
          perfilAcademicoId: perfilId,
          estado: estadoAnterior,
        },
        {
          perfilAcademicoId: perfilId,
          estado: dto.estado,
          observacion: dto.observacion?.trim() || null,
        },
        null,
        perfilId,
        historialRepo,
      );
    });

    const resultado = await this.profesorPerfilRepository.findOne({
      where: {
        id: solicitud.id,
      },
      relations: {
        perfilAcademico: {
          carrera: true,
        },
        solicitadoPor: true,
        revisadoPor: true,
      },
    });

    if (!resultado) {
      throw new NotFoundException(
        'No fue posible recuperar el perfil académico revisado.',
      );
    }

    return this.mapearPerfilProfesor(resultado);
  }

  async inactivarPerfilProfesor(
    profesorId: number,
    perfilId: number,
    usuarioAccionId: number,
    observacion?: string,
  ) {
    const profesor = await this.obtenerProfesor(profesorId);

    const relacion = await this.profesorPerfilRepository.findOne({
      where: {
        profesorUsuarioId: profesor.id,
        perfilAcademicoId: perfilId,
      },
      relations: {
        perfilAcademico: {
          carrera: true,
        },
        solicitadoPor: true,
        revisadoPor: true,
      },
    });

    if (!relacion) {
      throw new NotFoundException(
        'El perfil académico no se encuentra registrado en el perfil del profesor.',
      );
    }

    if (relacion.estado === EstadoPerfilProfesor.INACTIVO) {
      throw new ConflictException(
        'El perfil académico ya se encuentra inactivo en el perfil docente.',
      );
    }

    const estadoAnterior = relacion.estado;

    await this.dataSource.transaction(async (manager) => {
      const profesorPerfilRepo = manager.getRepository(ProfesorPerfilAcademico);
      const historialRepo = manager.getRepository(HistorialPerfilProfesor);

      relacion.estado = EstadoPerfilProfesor.INACTIVO;
      relacion.revisadoPorUsuarioId = usuarioAccionId;
      relacion.fechaRevision = new Date();
      relacion.observacionRevision = observacion?.trim() || null;

      await profesorPerfilRepo.save(relacion);

      await this.registrarHistorialPerfil(
        profesorId,
        usuarioAccionId,
        TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
        AccionHistorialPerfilProfesor.INACTIVAR_PERFIL,
        {
          perfilAcademicoId: perfilId,
          estado: estadoAnterior,
        },
        {
          perfilAcademicoId: perfilId,
          estado: EstadoPerfilProfesor.INACTIVO,
          observacion: observacion?.trim() || null,
        },
        null,
        perfilId,
        historialRepo,
      );
    });

    const resultado = await this.profesorPerfilRepository.findOne({
      where: {
        id: relacion.id,
      },
      relations: {
        perfilAcademico: {
          carrera: true,
        },
        solicitadoPor: true,
        revisadoPor: true,
      },
    });

    if (!resultado) {
      throw new NotFoundException(
        'No fue posible recuperar el perfil académico actualizado.',
      );
    }

    return this.mapearPerfilProfesor(resultado);
  }

  async obtenerHistorialPerfil(profesorId: number) {
    await this.obtenerProfesor(profesorId);

    const historial = await this.historialPerfilRepository.find({
      where: {
        profesorUsuarioId: profesorId,
      },
      relations: {
        curso: true,
        perfilAcademico: true,
        usuarioAccion: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return historial.map((item) => ({
      id: item.id,
      profesorUsuarioId: item.profesorUsuarioId,
      tipo: item.tipo,
      accion: item.accion,
      curso: item.curso
        ? {
            id: item.curso.id,
            codigo: item.curso.codigo,
            nombre: item.curso.nombre,
          }
        : null,
      perfilAcademico: item.perfilAcademico
        ? {
            id: item.perfilAcademico.id,
            codigo: item.perfilAcademico.codigo,
            nombre: item.perfilAcademico.nombre,
          }
        : null,
      datosAnteriores: item.datosAnteriores,
      datosNuevos: item.datosNuevos,
      realizadoPor: item.usuarioAccion
        ? {
            id: item.usuarioAccion.id,
            cedula: item.usuarioAccion.cedula,
            nombres: item.usuarioAccion.nombres,
            apellido1: item.usuarioAccion.apellido1,
            apellido2: item.usuarioAccion.apellido2,
            correo: item.usuarioAccion.correo,
          }
        : null,
      createdAt: item.createdAt,
    }));
  }

  // --- Atestados del Profesor ---

  async listarAtestadosMiPerfil(usuarioId: number) {
    await this.validarProfesorParaAutogestion(usuarioId);
    const atestados = await this.obtenerAtestadosProfesor(usuarioId);
    return atestados.map((item) => this.mapearAtestadoProfesor(item));
  }

  async crearAtestadoMiPerfil(
    usuarioId: number,
    dto: CrearAtestadoProfesorDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const atestado = this.atestadoRepository.create({
      profesorUsuarioId: usuarioId,
      tipo: dto.tipo,
      nombre: dto.nombre.trim(),
      institucion: dto.institucion.trim(),
      fechaObtencion: dto.fechaObtencion || null,
      descripcion: dto.descripcion?.trim() || null,
      estado: EstadoAtestadoProfesor.PENDIENTE,
      revisadoPorUsuarioId: null,
      fechaRevision: null,
      observacionRevision: null,
    });

    const guardado = await this.atestadoRepository.save(atestado);
    return this.mapearAtestadoProfesor(guardado);
  }

  async actualizarAtestadoMiPerfil(
    usuarioId: number,
    atestadoId: number,
    dto: ActualizarAtestadoProfesorDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const atestado = await this.atestadoRepository.findOne({
      where: {
        id: atestadoId,
        profesorUsuarioId: usuarioId,
      },
    });

    if (!atestado) {
      throw new NotFoundException('Atestado no encontrado.');
    }

    if (atestado.estado === EstadoAtestadoProfesor.INACTIVO) {
      throw new BadRequestException(
        'No se puede modificar un atestado inactivo.',
      );
    }

    if (dto.tipo !== undefined) {
      atestado.tipo = dto.tipo;
    }

    if (dto.nombre !== undefined) {
      atestado.nombre = dto.nombre.trim();
    }

    if (dto.institucion !== undefined) {
      atestado.institucion = dto.institucion.trim();
    }

    if (dto.fechaObtencion !== undefined) {
      atestado.fechaObtencion = dto.fechaObtencion || null;
    }

    if (dto.descripcion !== undefined) {
      atestado.descripcion = dto.descripcion?.trim() || null;
    }

    if (atestado.estado === EstadoAtestadoProfesor.APROBADO) {
      atestado.estado = EstadoAtestadoProfesor.PENDIENTE;
      atestado.revisadoPorUsuarioId = null;
      atestado.fechaRevision = null;
      atestado.observacionRevision = null;
    }

    const guardado = await this.atestadoRepository.save(atestado);
    return this.mapearAtestadoProfesor(guardado);
  }

  async inactivarAtestadoMiPerfil(usuarioId: number, atestadoId: number) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const atestado = await this.atestadoRepository.findOne({
      where: {
        id: atestadoId,
        profesorUsuarioId: usuarioId,
      },
    });

    if (!atestado) {
      throw new NotFoundException('Atestado no encontrado.');
    }

    if (atestado.estado === EstadoAtestadoProfesor.INACTIVO) {
      throw new ConflictException('El atestado ya se encuentra inactivo.');
    }

    atestado.estado = EstadoAtestadoProfesor.INACTIVO;

    const guardado = await this.atestadoRepository.save(atestado);
    return this.mapearAtestadoProfesor(guardado);
  }

  async revisarAtestadoProfesor(
    profesorId: number,
    atestadoId: number,
    revisorUsuarioId: number,
    dto: RevisarAtestadoProfesorDto,
  ) {
    const profesor = await this.obtenerProfesor(profesorId);

    if (!profesor.activo) {
      throw new BadRequestException(
        'No se puede revisar un atestado de un profesor inactivo.',
      );
    }

    const atestado = await this.atestadoRepository.findOne({
      where: {
        id: atestadoId,
        profesorUsuarioId: profesorId,
      },
    });

    if (!atestado) {
      throw new NotFoundException('Atestado no encontrado.');
    }

    if (atestado.estado === EstadoAtestadoProfesor.INACTIVO) {
      throw new BadRequestException(
        'No se puede revisar un atestado inactivo.',
      );
    }

    const revisor = await this.usuarioRepository.findOne({
      where: { id: revisorUsuarioId },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });

    const esAdminRevisor = (revisor?.usuarioRoles ?? []).some(
      (rel) => rel.rol?.activo && rel.rol.nombre === RolSistema.ADMIN_GLOBAL,
    );

    if (!esAdminRevisor) {
      const tieneAlcance =
        await this.estructuraAcademicaService.tieneAlcanceSobreProfesor(
          revisorUsuarioId,
          profesorId,
        );

      if (!tieneAlcance) {
        throw new ForbiddenException(
          'No posee autoridad académica sobre el profesor evaluado.',
        );
      }
    }

    if (atestado.estado === dto.estado) {
      throw new BadRequestException(
        'El atestado ya se encuentra en el estado indicado.',
      );
    }

    atestado.estado = dto.estado;
    atestado.revisadoPorUsuarioId = revisorUsuarioId;
    atestado.fechaRevision = new Date();
    atestado.observacionRevision = dto.observacion?.trim() || null;

    const guardado = await this.atestadoRepository.save(atestado);
    return this.mapearAtestadoProfesor(guardado);
  }

  // --- Proyectos / Laboratorios del Profesor ---

  private validarFechasProyecto(
    fechaInicio?: string | null,
    fechaFin?: string | null,
  ): void {
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }
  }

  async listarProyectosMiPerfil(usuarioId: number) {
    await this.validarProfesorParaAutogestion(usuarioId);
    const proyectos = await this.obtenerProyectosProfesor(usuarioId);
    return proyectos.map((item) => this.mapearProyectoProfesor(item));
  }

  async crearProyectoMiPerfil(
    usuarioId: number,
    dto: CrearProyectoProfesorDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);
    this.validarFechasProyecto(dto.fechaInicio, dto.fechaFin);

    const proyecto = this.proyectoRepository.create({
      profesorUsuarioId: usuarioId,
      nombre: dto.nombre.trim(),
      unidad: dto.unidad?.trim() || null,
      rol: dto.rol?.trim() || null,
      fechaInicio: dto.fechaInicio || null,
      fechaFin: dto.fechaFin || null,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
    });

    const guardado = await this.proyectoRepository.save(proyecto);
    return this.mapearProyectoProfesor(guardado);
  }

  async actualizarProyectoMiPerfil(
    usuarioId: number,
    proyectoId: number,
    dto: ActualizarProyectoProfesorDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const proyecto = await this.proyectoRepository.findOne({
      where: {
        id: proyectoId,
        profesorUsuarioId: usuarioId,
      },
    });

    if (!proyecto) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    const nuevaFechaInicio =
      dto.fechaInicio !== undefined ? dto.fechaInicio : proyecto.fechaInicio;
    const nuevaFechaFin =
      dto.fechaFin !== undefined ? dto.fechaFin : proyecto.fechaFin;

    this.validarFechasProyecto(nuevaFechaInicio, nuevaFechaFin);

    if (dto.nombre !== undefined) {
      proyecto.nombre = dto.nombre.trim();
    }

    if (dto.unidad !== undefined) {
      proyecto.unidad = dto.unidad?.trim() || null;
    }

    if (dto.rol !== undefined) {
      proyecto.rol = dto.rol?.trim() || null;
    }

    if (dto.fechaInicio !== undefined) {
      proyecto.fechaInicio = dto.fechaInicio || null;
    }

    if (dto.fechaFin !== undefined) {
      proyecto.fechaFin = dto.fechaFin || null;
    }

    if (dto.descripcion !== undefined) {
      proyecto.descripcion = dto.descripcion?.trim() || null;
    }

    const guardado = await this.proyectoRepository.save(proyecto);
    return this.mapearProyectoProfesor(guardado);
  }

  async cambiarEstadoProyectoMiPerfil(
    usuarioId: number,
    proyectoId: number,
    dto: CambiarEstadoProyectoProfesorDto,
  ) {
    await this.validarProfesorParaAutogestion(usuarioId);

    const proyecto = await this.proyectoRepository.findOne({
      where: {
        id: proyectoId,
        profesorUsuarioId: usuarioId,
      },
    });

    if (!proyecto) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    if (proyecto.activo === dto.activo) {
      throw new ConflictException(
        'El proyecto ya se encuentra en el estado solicitado.',
      );
    }

    proyecto.activo = dto.activo;

    const guardado = await this.proyectoRepository.save(proyecto);
    return this.mapearProyectoProfesor(guardado);
  }
}
