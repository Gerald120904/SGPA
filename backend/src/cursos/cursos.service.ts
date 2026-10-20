import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { CursoOptativo } from '../optativas/entities/curso-optativo.entity';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { ActualizarCursoDto } from './dto/actualizar-curso.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { ListarAsignaturasDisponiblesDto } from './dto/listar-asignaturas-disponibles.dto';
import { CursoRequisito } from './entities/curso-requisito.entity';
import { Curso } from './entities/curso.entity';

@Injectable()
export class CursosService {
  constructor(
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(CursoRequisito)
    private readonly cursoRequisitoRepository: Repository<CursoRequisito>,
    @InjectRepository(CursoOptativo)
    private readonly optativaRepository: Repository<CursoOptativo>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepository: Repository<PlanAsignatura>,
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceJerarquicoService,
  ) {}

  private async carrerasPermitidas(usuarioId: number, permiso: PermisoSistema): Promise<number[] | null> {
    if (!(await this.alcance.tipoCuentaJerarquica(usuarioId))) return null;
    const ids = await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    return (await Promise.all(ids.map(async (id) =>
      ((await this.alcance.puedeEjecutar(usuarioId, permiso, id)) ||
        (permiso === PermisoSistema.CURSOS_VER &&
          await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_GESTIONAR, id))) ? id : null)))
      .filter((id): id is number => id !== null);
  }

  private async validarLectura(usuarioId: number, curso: Curso): Promise<void> {
    const ids = await this.carrerasPermitidas(usuarioId, PermisoSistema.CURSOS_VER);
    if (ids !== null && !(curso.carreras ?? []).some((c) => ids.includes(c.id))) {
      throw new ForbiddenException('Curso fuera de las carreras autorizadas.');
    }
  }

  private async validarGestion(usuarioId: number, carreraIds: number[]): Promise<void> {
    const tipo = await this.alcance.tipoCuentaJerarquica(usuarioId);
    if (!tipo) return;
    if (tipo === 'ASISTENTE_ESTUDIANTIL') {
      throw new ForbiddenException('La escritura del asistente requiere una solicitud aprobada.');
    }
    if (!carreraIds.length || !(await Promise.all(carreraIds.map((id) =>
      this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_GESTIONAR, id)))).every(Boolean)) {
      throw new ForbiddenException('La operación afecta carreras sin permiso de gestión.');
    }
  }

  private async obtenerAsignaturaFuente(
    planAsignaturaId: number,
    repo: Repository<PlanAsignatura> = this.planAsignaturaRepository,
    bloquear = false,
  ): Promise<PlanAsignatura> {
    const asignatura = await repo.findOne({
      where: {
        id: planAsignaturaId,
      },
      relations: {
        planEstudio: {
          carrera: true,
        },
        curso: true,
      },
      ...(bloquear && { lock: { mode: 'pessimistic_write' as const } }),
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

    if (
      asignatura.tipo === TipoPlanAsignatura.OPTATIVA ||
      asignatura.tipo === TipoPlanAsignatura.GENERAL
    ) {
      throw new BadRequestException(
        'Las asignaturas optativas y generales del plan representan espacios curriculares y no pueden convertirse directamente en cursos.',
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

  async contextoCreacion(planAsignaturaId: number): Promise<{ carreraId: number; codigo: string; nombre: string }> {
    const fuente = await this.obtenerAsignaturaFuente(planAsignaturaId);
    return { carreraId: fuente.planEstudio.carreraId,
      codigo: fuente.codigoReferencia!, nombre: fuente.nombreReferencia! };
  }

  async obtenerCursoCompleto(id: number): Promise<Curso> {
    return this.obtenerEntidadPorId(id);
  }

  huellaCurso(curso: Curso): string {
    return createHash('sha256').update(JSON.stringify({
      id: curso.id, codigo: curso.codigo, nombre: curso.nombre,
      descripcion: curso.descripcion, activo: curso.activo,
      carreras: (curso.carreras ?? []).map((c) => c.id).sort((a, b) => a - b),
      updatedAt: curso.updatedAt ? new Date(curso.updatedAt).toISOString() : null,
    })).digest('hex');
  }

  async validarDelegacionCompleta(coordinadorId: number, asistenteId: number, carreraIds: number[]): Promise<void> {
    await this.validarGestion(coordinadorId, carreraIds);
    if (!carreraIds.length || !(await Promise.all(carreraIds.map((id) =>
      this.alcance.puedeEjecutar(asistenteId, PermisoSistema.CURSOS_GESTIONAR, id)))).every(Boolean)) {
      throw new ForbiddenException('El asistente no conserva permiso para todas las carreras afectadas.');
    }
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

  private async validarPuedeDesactivarse(cursoId: number, manager?: EntityManager): Promise<void> {
    const planAsignaturas = manager?.getRepository(PlanAsignatura) ?? this.planAsignaturaRepository;
    const optativas = manager?.getRepository(CursoOptativo) ?? this.optativaRepository;
    const requisitos = manager?.getRepository(CursoRequisito) ?? this.cursoRequisitoRepository;
    const [
      asignaturasActivas,
      optativaActiva,
      usadoComoCurso,
      usadoComoRequisito,
    ] = await Promise.all([
      planAsignaturas.count({
        where: {
          cursoId,
          activo: true,
        },
      }),
      optativas.count({
        where: {
          cursoId,
          activo: true,
        },
      }),
      requisitos.count({
        where: {
          cursoId,
        },
      }),
      requisitos.count({
        where: {
          requisitoCursoId: cursoId,
        },
      }),
    ]);

    if (asignaturasActivas > 0) {
      throw new BadRequestException(
        'No se puede desactivar el curso porque está vinculado a asignaturas activas de uno o más planes de estudio.',
      );
    }

    if (optativaActiva > 0) {
      throw new BadRequestException(
        'No se puede desactivar el curso mientras esté activo en el catálogo de optativas.',
      );
    }

    if (usadoComoCurso > 0 || usadoComoRequisito > 0) {
      throw new BadRequestException(
        'No se puede desactivar el curso porque participa en relaciones de requisitos o correquisitos.',
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
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException('El código del curso ya está registrado.');
    }

    throw error;
  }

  async listar(usuarioId?: number): Promise<Array<Curso & { puedeGestionarGlobal?: boolean }>> {
    const ids = usuarioId === undefined ? null : await this.carrerasPermitidas(usuarioId, PermisoSistema.CURSOS_VER);
    if (ids !== null && !ids.length) return [];
    const cursos = await this.cursoRepository.find({
      ...(ids !== null && { where: { carreras: { id: In(ids) } } }),
      relations: {
        carreras: true,
      },
      order: {
        codigo: 'ASC',
      },
    });
    if (ids === null) return cursos;
    return Promise.all(cursos.map(async (resumen) => {
      const curso = await this.obtenerEntidadPorId(resumen.id);
      return { ...curso,
      carreras: curso.carreras.filter((carrera) => ids.includes(carrera.id)),
      puedeGestionarGlobal: !!curso.carreras.length && (await Promise.all(curso.carreras.map((carrera) =>
        this.alcance.puedeEjecutar(usuarioId!, PermisoSistema.CURSOS_GESTIONAR, carrera.id)))).every(Boolean),
      };
    }));
  }

  async listarAsignaturasDisponibles(
    filtros: ListarAsignaturasDisponiblesDto,
    usuarioId?: number,
  ): Promise<PlanAsignatura[]> {
    const ids = usuarioId === undefined ? null : await this.carrerasPermitidas(usuarioId, PermisoSistema.CURSOS_GESTIONAR);
    if (ids !== null && (!ids.length || (filtros.carreraId && !ids.includes(filtros.carreraId)))) return [];
    return this.planAsignaturaRepository.find({
      where: {
        activo: true,
        cursoId: IsNull(),
        tipo: Not(
          In([TipoPlanAsignatura.OPTATIVA, TipoPlanAsignatura.GENERAL]),
        ),
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
          ...(ids !== null && { carreraId: In(ids) }),
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
      },
      order: {
        nivel: 'ASC',
        ciclo: 'ASC',
        orden: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number, usuarioId?: number): Promise<Curso & { puedeGestionarGlobal?: boolean }> {
    const curso = await this.obtenerEntidadPorId(id);
    if (usuarioId !== undefined) {
      await this.validarLectura(usuarioId, curso);
      const ids = await this.carrerasPermitidas(usuarioId, PermisoSistema.CURSOS_VER);
      if (ids !== null) return { ...curso, carreras: curso.carreras.filter((c) => ids.includes(c.id)),
        puedeGestionarGlobal: !!curso.carreras.length && (await Promise.all(curso.carreras.map((c) =>
          this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_GESTIONAR, c.id)))).every(Boolean) };
    }
    return curso;
  }

  async crear(dto: CrearCursoDto, usuarioId?: number, managerExterno?: EntityManager,
    carreraEsperadaId?: number): Promise<Curso> {
    const asignaturaFuente = await this.obtenerAsignaturaFuente(
      dto.planAsignaturaId,
    );

    const codigo = asignaturaFuente.codigoReferencia!.trim().toUpperCase();
    const nombre = asignaturaFuente.nombreReferencia!.trim();
    const descripcion = dto.descripcion?.trim() || null;
    const carrera = asignaturaFuente.planEstudio.carrera;
    if (usuarioId !== undefined) await this.validarGestion(usuarioId, [carrera.id]);

    const ejecutar = async (manager: EntityManager) => {
      if (usuarioId !== undefined) {
        if (!managerExterno) await manager.getRepository(Usuario).findOne({
          where: { id: usuarioId }, lock: { mode: 'pessimistic_write' },
        });
        const actual = await this.obtenerAsignaturaFuente(dto.planAsignaturaId,
          manager.getRepository(PlanAsignatura), true);
        if (actual.planEstudio.carreraId !== carrera.id ||
          actual.codigoReferencia!.trim().toUpperCase() !== codigo ||
          actual.nombreReferencia!.trim() !== nombre ||
          (carreraEsperadaId !== undefined && carreraEsperadaId !== actual.planEstudio.carreraId)) {
          throw new ConflictException('La asignatura cambió desde que se revisó la propuesta.');
        }
        await this.validarGestion(usuarioId, [actual.planEstudio.carreraId]);
      }
      const cursoRepo = manager.getRepository(Curso);
      const asignaturaRepo = manager.getRepository(PlanAsignatura);

      let curso = await cursoRepo.findOne({
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
          curso = await cursoRepo.save(curso);
        }
      } else {
        const nuevoCurso = cursoRepo.create({
          codigo,
          nombre,
          descripcion,
          activo: true,
          carreras: [carrera],
        });

        try {
          curso = await cursoRepo.save(nuevoCurso);
        } catch (error) {
          this.relanzarErrorPersistencia(error);
        }
      }

      const asignatura = await asignaturaRepo.findOne({
        where: { id: dto.planAsignaturaId },
      });

      if (!asignatura) {
        throw new NotFoundException(
          'La asignatura seleccionada no existe en el plan de estudio.',
        );
      }

      asignatura.cursoId = curso.id;
      asignatura.curso = curso;

      await asignaturaRepo.save(asignatura);

      return cursoRepo.findOneOrFail({
        where: { id: curso.id },
        relations: { carreras: true },
      });
    };
    return managerExterno ? ejecutar(managerExterno) : this.dataSource.transaction(ejecutar);
  }

  async crearDesdeSolicitud(coordinadorId: number, asistenteId: number, carreraId: number,
    dto: CrearCursoDto, manager: EntityManager): Promise<number> {
    await this.validarDelegacionCompleta(coordinadorId, asistenteId, [carreraId]);
    const curso = await this.crear(dto, coordinadorId, manager, carreraId);
    return curso.id;
  }

  async actualizar(id: number, dto: ActualizarCursoDto, usuarioId?: number): Promise<Curso> {
    if (usuarioId !== undefined) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id: usuarioId }, lock: { mode: 'pessimistic_write' } });
        const curso = await this.obtenerCursoBloqueado(manager, id);
        await this.validarGestion(usuarioId, curso.carreras.map((c) => c.id));
        if (dto.descripcion !== undefined) curso.descripcion = dto.descripcion?.trim() || null;
        await manager.getRepository(Curso).save(curso);
      });
      return this.obtenerPorId(id, usuarioId);
    }
    const curso = await this.obtenerEntidadPorId(id);

    if (dto.descripcion !== undefined) {
      curso.descripcion = dto.descripcion?.trim() || null;
    }

    await this.cursoRepository.save(curso);

    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean, usuarioId?: number): Promise<Curso> {
    if (usuarioId !== undefined) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id: usuarioId }, lock: { mode: 'pessimistic_write' } });
        const curso = await this.obtenerCursoBloqueado(manager, id);
        await this.validarGestion(usuarioId, curso.carreras.map((c) => c.id));
        if (!activo) await this.validarPuedeDesactivarse(id, manager);
        curso.activo = activo;
        await manager.getRepository(Curso).save(curso);
      });
      return this.obtenerPorId(id, usuarioId);
    }
    const curso = await this.obtenerEntidadPorId(id);

    if (!activo) {
      await this.validarPuedeDesactivarse(id);
    }

    await this.cursoRepository.update(id, { activo });

    return this.obtenerEntidadPorId(id);
  }

  private async obtenerCursoBloqueado(manager: EntityManager, id: number): Promise<Curso> {
    const curso = await manager.getRepository(Curso).findOne({
      where: { id }, relations: { carreras: true }, lock: { mode: 'pessimistic_write' },
    });
    if (!curso) throw new NotFoundException('Curso no encontrado.');
    return curso;
  }

  async actualizarDesdeSolicitud(coordinadorId: number, asistenteId: number, id: number,
    carreraId: number, dto: ActualizarCursoDto, huellaOriginal: string,
    manager: EntityManager): Promise<number> {
    const curso = await this.obtenerCursoBloqueado(manager, id);
    const ids = curso.carreras.map((c) => c.id);
    if (!ids.includes(carreraId) || this.huellaCurso(curso) !== huellaOriginal) {
      throw new ConflictException('El curso cambió desde que se envió la solicitud.');
    }
    await this.validarDelegacionCompleta(coordinadorId, asistenteId, ids);
    if (dto.descripcion !== undefined) curso.descripcion = dto.descripcion?.trim() || null;
    await manager.getRepository(Curso).save(curso);
    return id;
  }

  async cambiarEstadoDesdeSolicitud(coordinadorId: number, asistenteId: number, id: number,
    carreraId: number, activo: boolean, huellaOriginal: string,
    manager: EntityManager): Promise<number> {
    const curso = await this.obtenerCursoBloqueado(manager, id);
    const ids = curso.carreras.map((c) => c.id);
    if (!ids.includes(carreraId) || this.huellaCurso(curso) !== huellaOriginal) {
      throw new ConflictException('El curso cambió desde que se envió la solicitud.');
    }
    await this.validarDelegacionCompleta(coordinadorId, asistenteId, ids);
    if (!activo) await this.validarPuedeDesactivarse(id, manager);
    curso.activo = activo;
    await manager.getRepository(Curso).save(curso);
    return id;
  }
}
