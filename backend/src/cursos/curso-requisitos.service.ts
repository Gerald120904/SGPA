import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { CrearCursoRequisitoDto } from './dto/crear-curso-requisito.dto';
import { CursoRequisito } from './entities/curso-requisito.entity';
import { Curso } from './entities/curso.entity';

@Injectable()
export class CursoRequisitosService {
  constructor(
    @InjectRepository(CursoRequisito)
    private readonly requisitoRepository: Repository<CursoRequisito>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
    private readonly alcance: AlcanceJerarquicoService,
    private readonly dataSource: DataSource,
  ) {}

  private async validarCurso(usuarioId: number, curso: Curso, permiso: PermisoSistema): Promise<void> {
    const tipo = await this.alcance.tipoCuentaJerarquica(usuarioId);
    if (!tipo) return;
    if (permiso === PermisoSistema.CURSOS_GESTIONAR && tipo === 'ASISTENTE_ESTUDIANTIL') {
      throw new ForbiddenException('La escritura del asistente requiere una solicitud aprobada.');
    }
    const ids = (curso.carreras ?? []).map((c) => c.id);
    const vigentes = await Promise.all(ids.map(async (id) =>
      (await this.alcance.puedeEjecutar(usuarioId, permiso, id)) ||
      (permiso === PermisoSistema.CURSOS_VER &&
        await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.CURSOS_GESTIONAR, id))));
    if (!ids.length || (permiso === PermisoSistema.CURSOS_VER ? !vigentes.some(Boolean) : !vigentes.every(Boolean))) {
      throw new ForbiddenException('Curso fuera de las carreras autorizadas.');
    }
  }

  private async obtenerCursoActivo(id: number, repo: Repository<Curso> = this.cursoRepository,
    bloquear = false): Promise<Curso> {
    const curso = await repo.findOne({
      where: { id },
      relations: { carreras: true },
      ...(bloquear && { lock: { mode: 'pessimistic_write' as const } }),
    });

    if (!curso) {
      throw new NotFoundException('Curso no encontrado.');
    }

    if (!curso.activo) {
      throw new BadRequestException(
        'No se pueden crear requisitos utilizando cursos inactivos.',
      );
    }

    return curso;
  }

  private async validarSinCiclos(
    cursoId: number,
    requisitoCursoId: number,
    repo: Repository<CursoRequisito> = this.requisitoRepository,
  ): Promise<void> {
    const existentes = await repo.find({
      where: {
        tipo: TipoRequisito.REQUISITO,
      },
    });

    const grafo = new Map<number, Set<number>>();

    const agregarRelacion = (origen: number, destino: number) => {
      if (!grafo.has(origen)) {
        grafo.set(origen, new Set());
      }
      grafo.get(origen)!.add(destino);

      if (!grafo.has(destino)) {
        grafo.set(destino, new Set());
      }
    };

    for (const rel of existentes) {
      agregarRelacion(rel.requisitoCursoId, rel.cursoId);
    }

    // Agregar la nueva relación propuesta
    agregarRelacion(requisitoCursoId, cursoId);

    const visitados = new Set<number>();
    const enProceso = new Set<number>();

    const visitar = (nodo: number) => {
      if (enProceso.has(nodo)) {
        throw new BadRequestException(
          'La relación generaría un ciclo de requisitos entre cursos.',
        );
      }

      if (visitados.has(nodo)) {
        return;
      }

      enProceso.add(nodo);

      for (const siguiente of grafo.get(nodo) ?? new Set<number>()) {
        visitar(siguiente);
      }

      enProceso.delete(nodo);
      visitados.add(nodo);
    };

    for (const nodo of grafo.keys()) {
      visitar(nodo);
    }
  }

  async listar(cursoId: number, usuarioId?: number): Promise<CursoRequisito[]> {
    const curso = await this.obtenerCursoActivo(cursoId);
    if (usuarioId !== undefined) await this.validarCurso(usuarioId, curso, PermisoSistema.CURSOS_VER);

    const relaciones = await this.requisitoRepository.find({
      where: {
        cursoId,
      },
      relations: {
        curso: true,
        requisitoCurso: true,
      },
      order: {
        id: 'ASC',
      },
    });
    if (usuarioId === undefined || !(await this.alcance.tipoCuentaJerarquica(usuarioId))) return relaciones;
    const visibles: CursoRequisito[] = [];
    for (const relacion of relaciones) {
      const requerido = await this.cursoRepository.findOne({ where: { id: relacion.requisitoCursoId }, relations: { carreras: true } });
      if (!requerido) continue;
      try { await this.validarCurso(usuarioId, requerido, PermisoSistema.CURSOS_VER); visibles.push(relacion); }
      catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
    }
    return visibles;
  }

  async crear(
    cursoId: number,
    dto: CrearCursoRequisitoDto,
    usuarioId?: number,
  ): Promise<CursoRequisito> {
    if (usuarioId !== undefined) {
      return this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id: usuarioId }, lock: { mode: 'pessimistic_write' } });
        await this.bloquearGrafo(manager);
        return this.crearConRepos(cursoId, dto, usuarioId, manager.getRepository(Curso),
          manager.getRepository(CursoRequisito), true);
      });
    }
    return this.crearConRepos(cursoId, dto, undefined, this.cursoRepository, this.requisitoRepository, false);
  }

  private async bloquearGrafo(manager: EntityManager): Promise<void> {
    // Una fila común serializa cambios de aristas que no comparten extremos.
    await manager.query('SELECT id FROM cursos ORDER BY id LIMIT 1 FOR UPDATE');
  }

  private async crearConRepos(cursoId: number, dto: CrearCursoRequisitoDto,
    usuarioId: number | undefined, cursoRepo: Repository<Curso>, requisitoRepo: Repository<CursoRequisito>,
    bloquear: boolean, asistenteId?: number): Promise<CursoRequisito> {
    if (cursoId === dto.requisitoCursoId) {
      throw new BadRequestException(
        'Un curso no puede ser requisito de sí mismo.',
      );
    }

    const curso = await this.obtenerCursoActivo(cursoId, cursoRepo, bloquear);
    const requerido = await this.obtenerCursoActivo(dto.requisitoCursoId, cursoRepo, bloquear);
    if (usuarioId !== undefined) {
      await this.validarCurso(usuarioId, curso, PermisoSistema.CURSOS_GESTIONAR);
      await this.validarCurso(usuarioId, requerido, PermisoSistema.CURSOS_GESTIONAR);
    }
    if (asistenteId !== undefined) {
      await this.validarCursoDelegado(asistenteId, curso);
      await this.validarCursoDelegado(asistenteId, requerido);
    }

    const existente = await requisitoRepo.findOne({
      where: {
        cursoId,
        requisitoCursoId: dto.requisitoCursoId,
        tipo: dto.tipo,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Esta relación de requisito ya está registrada.',
      );
    }

    if (dto.tipo === TipoRequisito.REQUISITO) {
      await this.validarSinCiclos(cursoId, dto.requisitoCursoId, requisitoRepo);
    }

    const relacion = requisitoRepo.create({
      cursoId,
      requisitoCursoId: dto.requisitoCursoId,
      tipo: dto.tipo,
    });

    const guardada = await requisitoRepo.save(relacion);

    return requisitoRepo.findOneOrFail({
      where: {
        id: guardada.id,
      },
      relations: {
        curso: true,
        requisitoCurso: true,
      },
    });
  }

  private async validarCursoDelegado(asistenteId: number, curso: Curso): Promise<void> {
    if (!(curso.carreras ?? []).length || !(await Promise.all(curso.carreras.map((c) =>
      this.alcance.puedeEjecutar(asistenteId, PermisoSistema.CURSOS_GESTIONAR, c.id)))).every(Boolean)) {
      throw new ForbiddenException('El asistente perdió permiso sobre una carrera del requisito.');
    }
  }

  async crearDesdeSolicitud(coordinadorId: number, asistenteId: number, cursoId: number,
    dto: CrearCursoRequisitoDto, manager: EntityManager): Promise<number> {
    await this.bloquearGrafo(manager);
    const relacion = await this.crearConRepos(cursoId, dto, coordinadorId,
      manager.getRepository(Curso), manager.getRepository(CursoRequisito), true, asistenteId);
    return relacion.id;
  }

  async eliminar(cursoId: number, id: number, usuarioId?: number): Promise<void> {
    if (usuarioId !== undefined) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id: usuarioId }, lock: { mode: 'pessimistic_write' } });
        await this.bloquearGrafo(manager);
        await this.eliminarConRepos(cursoId, id, usuarioId, manager.getRepository(Curso),
          manager.getRepository(CursoRequisito), true);
      });
      return;
    }
    await this.eliminarConRepos(cursoId, id, undefined, this.cursoRepository, this.requisitoRepository, false);
  }

  async contextoEliminacion(cursoId: number, id: number): Promise<CursoRequisito> {
    const relacion = await this.requisitoRepository.findOne({ where: { id, cursoId } });
    if (!relacion) throw new NotFoundException('Relación de requisito no encontrada.');
    return relacion;
  }

  private async eliminarConRepos(cursoId: number, id: number, usuarioId: number | undefined,
    cursoRepo: Repository<Curso>, requisitoRepo: Repository<CursoRequisito>, bloquear: boolean,
    asistenteId?: number, esperado?: { requisitoCursoId: number; tipo: TipoRequisito }): Promise<void> {
    const relacion = await requisitoRepo.findOne({
      where: {
        id,
        cursoId,
      },
    });

    if (!relacion) {
      throw new NotFoundException('Relación de requisito no encontrada.');
    }
    if (esperado && (relacion.requisitoCursoId !== esperado.requisitoCursoId || relacion.tipo !== esperado.tipo)) {
      throw new ConflictException('La relación de requisito cambió desde la propuesta.');
    }

    if (usuarioId !== undefined) {
      await this.validarCurso(usuarioId, await this.obtenerCursoActivo(cursoId, cursoRepo, bloquear), PermisoSistema.CURSOS_GESTIONAR);
      await this.validarCurso(usuarioId, await this.obtenerCursoActivo(relacion.requisitoCursoId, cursoRepo, bloquear), PermisoSistema.CURSOS_GESTIONAR);
    }
    if (asistenteId !== undefined) {
      await this.validarCursoDelegado(asistenteId, await this.obtenerCursoActivo(cursoId, cursoRepo, bloquear));
      await this.validarCursoDelegado(asistenteId, await this.obtenerCursoActivo(relacion.requisitoCursoId, cursoRepo, bloquear));
    }

    await requisitoRepo.remove(relacion);
  }

  async eliminarDesdeSolicitud(coordinadorId: number, asistenteId: number, cursoId: number,
    id: number, esperado: { requisitoCursoId: number; tipo: TipoRequisito }, manager: EntityManager): Promise<number> {
    await this.bloquearGrafo(manager);
    await this.eliminarConRepos(cursoId, id, coordinadorId, manager.getRepository(Curso),
      manager.getRepository(CursoRequisito), true, asistenteId, esperado);
    return id;
  }
}
