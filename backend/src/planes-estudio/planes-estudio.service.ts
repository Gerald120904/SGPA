import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { ActualizarPlanEstudioDto } from './dto/actualizar-plan-estudio.dto';
import { CrearPlanEstudioDto } from './dto/crear-plan-estudio.dto';
import { PlanEstudio } from './entities/plan-estudio.entity';

@Injectable()
export class PlanesEstudioService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    private readonly alcance: AlcanceJerarquicoService,
  ) {}

  private async obtenerEntidadPorId(id: number): Promise<PlanEstudio> {
    const plan = await this.planRepository.findOne({
      where: { id },
      relations: {
        carrera: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan de estudio no encontrado.');
    }

    return plan;
  }

  async obtenerPlanCompleto(id: number): Promise<PlanEstudio> {
    return this.obtenerEntidadPorId(id);
  }

  huellaPlan(plan: PlanEstudio): string {
    return createHash('sha256').update(JSON.stringify({ id: plan.id, carreraId: plan.carreraId,
      grado: plan.grado, codigo: plan.codigo, nombre: plan.nombre, descripcion: plan.descripcion,
      activo: plan.activo, updatedAt: plan.updatedAt ? new Date(plan.updatedAt).toISOString() : null }))
      .digest('hex');
  }

  async validarDelegacionCompleta(coordinadorId: number, asistenteId: number, carreraId: number): Promise<void> {
    const [coordinador, asistente] = await Promise.all([
      this.alcance.puedeEjecutar(coordinadorId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carreraId),
      this.alcance.puedeEjecutar(asistenteId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carreraId),
    ]);
    if (!coordinador || !asistente) throw new ConflictException('Ya no existe permiso vigente sobre la carrera del plan.');
  }

  private async obtenerCarreraActiva(carreraId: number): Promise<Carrera> {
    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });

    if (!carrera) {
      throw new BadRequestException('La carrera seleccionada no existe.');
    }

    if (!carrera.activo) {
      throw new BadRequestException(
        'No se puede crear un plan para una carrera inactiva.',
      );
    }

    return carrera;
  }

  private async validarCodigoDuplicado(
    carreraId: number,
    codigo: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.planRepository.findOne({
      where: {
        carreraId,
        codigo,
      },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException(
        'Ya existe un plan con ese código para la carrera.',
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
          code?: string;
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Ya existe un plan con ese código para la carrera.',
      );
    }

    throw error;
  }

  async listar(usuarioId?: number): Promise<PlanEstudio[]> {
    let carreraIds: number[] | null = null;
    if (usuarioId !== undefined && await this.alcance.tipoCuentaJerarquica(usuarioId)) {
      const asignadas = await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
      carreraIds = (await Promise.all(asignadas.map(async (id) =>
        await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_VER, id) ||
        await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, id) ? id : null)))
        .filter((id): id is number => id !== null);
      if (!carreraIds.length) return [];
    }
    return this.planRepository.find({
      ...(carreraIds !== null && { where: { carreraId: In(carreraIds) } }),
      relations: {
        carrera: true,
      },
      order: {
        carreraId: 'ASC',
        codigo: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<PlanEstudio> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearPlanEstudioDto): Promise<PlanEstudio> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;

    if (!codigo) {
      throw new BadRequestException('El código del plan es obligatorio.');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre del plan es obligatorio.');
    }

    await this.obtenerCarreraActiva(dto.carreraId);
    await this.validarCodigoDuplicado(dto.carreraId, codigo);

    const plan = this.planRepository.create({
      carreraId: dto.carreraId,
      grado: dto.grado,
      codigo,
      nombre,
      descripcion,
      activo: true,
    });

    try {
      const guardado = await this.planRepository.save(plan);
      return this.obtenerEntidadPorId(guardado.id);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarPlanEstudioDto,
  ): Promise<PlanEstudio> {
    const plan = await this.obtenerEntidadPorId(id);

    if (dto.grado !== undefined) {
      plan.grado = dto.grado;
    }

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();

      if (!codigo) {
        throw new BadRequestException(
          'El código del plan no puede estar vacío.',
        );
      }

      await this.validarCodigoDuplicado(plan.carreraId, codigo, id);
      plan.codigo = codigo;
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      if (!nombre) {
        throw new BadRequestException(
          'El nombre del plan no puede estar vacío.',
        );
      }

      plan.nombre = nombre;
    }

    if (dto.descripcion !== undefined) {
      plan.descripcion = dto.descripcion?.trim() || null;
    }

    try {
      await this.planRepository.save(plan);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<PlanEstudio> {
    await this.obtenerEntidadPorId(id);

    await this.planRepository.update(id, { activo });

    return this.obtenerEntidadPorId(id);
  }

  async crearDesdeSolicitud(coordinadorId: number, asistenteId: number, dto: CrearPlanEstudioDto,
    manager: EntityManager): Promise<number> {
    await this.validarDelegacionCompleta(coordinadorId, asistenteId, dto.carreraId);
    const carrera = await manager.getRepository(Carrera).findOne({ where: { id: dto.carreraId },
      lock: { mode: 'pessimistic_read' } });
    if (!carrera || !carrera.activo) throw new BadRequestException('La carrera seleccionada no estÃ¡ activa.');
    const repo = manager.getRepository(PlanEstudio);
    const codigo = dto.codigo.trim().toUpperCase();
    if (await repo.findOne({ where: { carreraId: dto.carreraId, codigo } })) {
      throw new ConflictException('Ya existe un plan con ese cÃ³digo para la carrera.');
    }
    const guardado = await repo.save(repo.create({ carreraId: dto.carreraId, grado: dto.grado,
      codigo, nombre: dto.nombre.trim(), descripcion: dto.descripcion?.trim() || null, activo: true }));
    return guardado.id;
  }

  private async planBloqueado(manager: EntityManager, id: number): Promise<PlanEstudio> {
    const plan = await manager.getRepository(PlanEstudio).findOne({ where: { id },
      relations: { carrera: true }, lock: { mode: 'pessimistic_write' } });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
    return plan;
  }

  async actualizarDesdeSolicitud(coordinadorId: number, asistenteId: number, id: number,
    dto: ActualizarPlanEstudioDto, huella: string, manager: EntityManager): Promise<number> {
    const plan = await this.planBloqueado(manager, id);
    if (this.huellaPlan(plan) !== huella) throw new ConflictException('El plan cambiÃ³ desde que se enviÃ³ la solicitud.');
    await this.validarDelegacionCompleta(coordinadorId, asistenteId, plan.carreraId);
    if (dto.grado !== undefined) plan.grado = dto.grado;
    if (dto.codigo !== undefined) plan.codigo = dto.codigo.trim().toUpperCase();
    if (dto.nombre !== undefined) plan.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) plan.descripcion = dto.descripcion?.trim() || null;
    try { await manager.getRepository(PlanEstudio).save(plan); } catch (error) { this.relanzarErrorPersistencia(error); }
    return id;
  }

  async cambiarEstadoDesdeSolicitud(coordinadorId: number, asistenteId: number, id: number,
    activo: boolean, huella: string, manager: EntityManager): Promise<number> {
    const plan = await this.planBloqueado(manager, id);
    if (this.huellaPlan(plan) !== huella) throw new ConflictException('El plan cambiÃ³ desde que se enviÃ³ la solicitud.');
    await this.validarDelegacionCompleta(coordinadorId, asistenteId, plan.carreraId);
    plan.activo = activo;
    await manager.getRepository(PlanEstudio).save(plan);
    return id;
  }
}
