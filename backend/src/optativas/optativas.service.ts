import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
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
    @Optional()
    private readonly alcance?: AlcanceJerarquicoService,
  ) {}

  huellaOptativa(optativa: CursoOptativo): string {
    const ts = optativa.updatedAt ? optativa.updatedAt.toISOString() : '';
    return createHash('sha256')
      .update(
        `${optativa.id}:${optativa.tipo}:${optativa.carreraOrigenId ?? ''}:${optativa.activo}:${ts}`,
      )
      .digest('hex');
  }

  private async carrerasPermitidas(
    usuarioId: number,
    permiso: PermisoSistema,
  ): Promise<number[] | null> {
    if (!this.alcance || !(await this.alcance.tipoCuentaJerarquica(usuarioId)))
      return null;
    const ids = await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    return (
      await Promise.all(
        ids.map(async (id) =>
          (await this.alcance!.puedeEjecutar(usuarioId, permiso, id)) ||
          (permiso === PermisoSistema.OPTATIVAS_VER &&
            (await this.alcance!.puedeEjecutar(
              usuarioId,
              PermisoSistema.OPTATIVAS_GESTIONAR,
              id,
            )))
            ? id
            : null,
        ),
      )
    ).filter((id): id is number => id !== null);
  }

  private async validarLectura(
    usuarioId: number,
    optativa: CursoOptativo,
  ): Promise<void> {
    if (!this.alcance) return;
    if (
      optativa.tipo === TipoOptativa.ABIERTA ||
      optativa.tipo === TipoOptativa.SEDE
    ) {
      return;
    }
    const ids = await this.carrerasPermitidas(
      usuarioId,
      PermisoSistema.OPTATIVAS_VER,
    );
    if (
      ids !== null &&
      (optativa.carreraOrigenId === null ||
        !ids.includes(optativa.carreraOrigenId))
    ) {
      throw new ForbiddenException(
        'Optativa disciplinaria fuera de las carreras autorizadas.',
      );
    }
  }

  private async validarGestion(
    usuarioId: number,
    carreraId: number | null,
    tipo: TipoOptativa,
  ): Promise<void> {
    if (!this.alcance) return;
    const tipoCuenta = await this.alcance.tipoCuentaJerarquica(usuarioId);
    if (!tipoCuenta) return;
    if (tipoCuenta === 'ASISTENTE_ESTUDIANTIL') {
      throw new ForbiddenException(
        'La escritura del asistente requiere una propuesta aprobada.',
      );
    }
    if (tipo !== TipoOptativa.DISCIPLINARIA) {
      throw new ForbiddenException(
        'Solo el administrador global puede gestionar optativas institucionales.',
      );
    }
    if (
      !carreraId ||
      !(await this.alcance.puedeEjecutar(
        usuarioId,
        PermisoSistema.OPTATIVAS_GESTIONAR,
        carreraId,
      ))
    ) {
      throw new ForbiddenException(
        'No posee permiso para gestionar optativas en esta carrera.',
      );
    }
  }

  async validarDelegacionCompleta(
    coordinadorId: number,
    asistenteId: number,
    carreraId: number,
  ): Promise<void> {
    if (!this.alcance) return;
    const [coordAuth, asistAuth] = await Promise.all([
      this.alcance.puedeEjecutar(
        coordinadorId,
        PermisoSistema.OPTATIVAS_GESTIONAR,
        carreraId,
      ),
      this.alcance.puedeEjecutar(
        asistenteId,
        PermisoSistema.OPTATIVAS_GESTIONAR,
        carreraId,
      ),
    ]);
    if (!coordAuth || !asistAuth) {
      throw new ForbiddenException(
        'El asistente o el coordinador no poseen delegación activa sobre la carrera.',
      );
    }
  }

  private async obtenerCarrera(
    carreraId: number,
    repo: Repository<Carrera> = this.carreraRepository,
  ): Promise<Carrera> {
    const carrera = await repo.findOne({
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
    repo: Repository<Curso> = this.cursoRepository,
  ): Promise<Curso> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();

    let curso = await repo.findOne({
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

      if (carreraOrigen && !(curso.carreras ?? []).some((c) => c.id === carreraOrigen.id)) {
        curso.carreras = [...(curso.carreras ?? []), carreraOrigen];
        await repo.save(curso);
      }

      return curso;
    }

    curso = repo.create({
      codigo,
      nombre,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
      carreras: carreraOrigen ? [carreraOrigen] : [],
    });

    return repo.save(curso);
  }

  async crear(dto: CrearOptativaDto, usuarioId?: number): Promise<CursoOptativo> {
    if (usuarioId) {
      await this.validarGestion(usuarioId, dto.carreraOrigenId ?? null, dto.tipo);
    }

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

    return this.obtenerPorId(optativa.id, usuarioId);
  }

  async listar(usuarioId?: number): Promise<CursoOptativo[]> {
    if (usuarioId && this.alcance) {
      const ids = await this.carrerasPermitidas(usuarioId, PermisoSistema.OPTATIVAS_VER);
      if (ids !== null) {
        if (!ids.length) {
          return this.optativaRepository.find({
            where: [
              { tipo: TipoOptativa.ABIERTA },
              { tipo: TipoOptativa.SEDE },
            ],
            relations: {
              curso: true,
              carreraOrigen: true,
            },
            order: {
              id: 'ASC',
            },
          });
        }
        return this.optativaRepository.find({
          where: [
            { tipo: TipoOptativa.ABIERTA },
            { tipo: TipoOptativa.SEDE },
            { tipo: TipoOptativa.DISCIPLINARIA, carreraOrigenId: In(ids) },
          ],
          relations: {
            curso: true,
            carreraOrigen: true,
          },
          order: {
            id: 'ASC',
          },
        });
      }
    }

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

  async obtenerPorId(id: number, usuarioId?: number): Promise<CursoOptativo> {
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

    if (usuarioId) {
      await this.validarLectura(usuarioId, optativa);
    }

    return optativa;
  }

  async actualizar(
    id: number,
    dto: ActualizarOptativaDto,
    usuarioId?: number,
  ): Promise<CursoOptativo> {
    const optativa = await this.obtenerPorId(id, usuarioId);

    const tipoResultante = dto.tipo ?? optativa.tipo;
    const carreraResultante =
      dto.carreraOrigenId !== undefined
        ? dto.carreraOrigenId
        : optativa.carreraOrigenId;

    this.validarOrigen(tipoResultante, carreraResultante);

    if (usuarioId) {
      await this.validarGestion(usuarioId, optativa.carreraOrigenId, optativa.tipo);
      if (
        dto.carreraOrigenId !== undefined &&
        dto.carreraOrigenId !== null &&
        dto.carreraOrigenId !== optativa.carreraOrigenId
      ) {
        await this.validarGestion(usuarioId, dto.carreraOrigenId, tipoResultante);
      }
    }

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

    return this.obtenerPorId(id, usuarioId);
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<CursoOptativo> {
    const optativa = await this.obtenerPorId(id, usuarioId);

    if (usuarioId) {
      await this.validarGestion(usuarioId, optativa.carreraOrigenId, optativa.tipo);
    }

    await this.optativaRepository.update(id, {
      activo,
    });

    return this.obtenerPorId(id, usuarioId);
  }

  // --- MÉTODOS TRANSACCIONALES PARA APROBACIÓN DE SOLICITUDES ---

  async obtenerOptativaParaSolicitud(id: number): Promise<CursoOptativo> {
    const optativa = await this.optativaRepository.findOne({
      where: { id },
      relations: { curso: true, carreraOrigen: true },
    });
    if (!optativa) throw new NotFoundException('Optativa no encontrada.');
    return optativa;
  }

  async crearDesdeSolicitud(
    manager: EntityManager,
    carreraId: number,
    datos: Record<string, unknown>,
  ): Promise<CursoOptativo> {
    const dto = datos as unknown as CrearOptativaDto;
    this.validarOrigen(dto.tipo, carreraId);

    const carreraOrigen = await this.obtenerCarrera(carreraId, manager.getRepository(Carrera));
    const curso = await this.obtenerOCrearCurso(dto, carreraOrigen, manager.getRepository(Curso));

    const existente = await manager.getRepository(CursoOptativo).findOne({
      where: { cursoId: curso.id },
    });
    if (existente) {
      throw new ConflictException(
        'Este curso ya se encuentra registrado en el catálogo de optativas.',
      );
    }

    const optativa = manager.getRepository(CursoOptativo).create({
      cursoId: curso.id,
      curso,
      tipo: dto.tipo,
      carreraOrigenId: carreraId,
      carreraOrigen,
      activo: true,
    });

    return manager.getRepository(CursoOptativo).save(optativa);
  }

  async actualizarDesdeSolicitud(
    manager: EntityManager,
    carreraId: number,
    optativaId: number,
    datos: Record<string, unknown>,
    huellaEsperada: string | null,
  ): Promise<CursoOptativo> {
    const optativa = await manager.getRepository(CursoOptativo).findOne({
      where: { id: optativaId },
      relations: { curso: true, carreraOrigen: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!optativa) throw new NotFoundException('Optativa no encontrada.');
    if (optativa.carreraOrigenId !== carreraId) {
      throw new ForbiddenException(
        'La optativa no pertenece a la carrera de la solicitud.',
      );
    }
    if (huellaEsperada && this.huellaOptativa(optativa) !== huellaEsperada) {
      throw new ConflictException(
        'La optativa fue modificada después de registrar la propuesta.',
      );
    }

    const dto = datos as unknown as ActualizarOptativaDto;
    if (dto.descripcion !== undefined && optativa.curso) {
      optativa.curso.descripcion = dto.descripcion?.trim() || null;
      await manager.getRepository(Curso).save(optativa.curso);
    }

    return manager.getRepository(CursoOptativo).save(optativa);
  }

  async cambiarEstadoDesdeSolicitud(
    manager: EntityManager,
    carreraId: number,
    optativaId: number,
    activo: boolean,
    huellaEsperada: string | null,
  ): Promise<CursoOptativo> {
    const optativa = await manager.getRepository(CursoOptativo).findOne({
      where: { id: optativaId },
      relations: { curso: true, carreraOrigen: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!optativa) throw new NotFoundException('Optativa no encontrada.');
    if (optativa.carreraOrigenId !== carreraId) {
      throw new ForbiddenException(
        'La optativa no pertenece a la carrera de la solicitud.',
      );
    }
    if (huellaEsperada && this.huellaOptativa(optativa) !== huellaEsperada) {
      throw new ConflictException(
        'La optativa fue modificada después de registrar la propuesta.',
      );
    }

    optativa.activo = activo;
    return manager.getRepository(CursoOptativo).save(optativa);
  }
}
