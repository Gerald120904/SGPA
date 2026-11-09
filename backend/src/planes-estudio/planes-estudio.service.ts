import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { ActualizarPlanEstudioDto } from './dto/actualizar-plan-estudio.dto';
import { CrearPlanEstudioDto } from './dto/crear-plan-estudio.dto';
import { CambiarEstadoPlanEstudioDto } from './dto/cambiar-estado-plan-estudio.dto';
import { CrearVersionPlanEstudioDto } from './dto/crear-version-plan-estudio.dto';
import { EstadoPlanEstudio } from './constants/estado-plan-estudio.constant';
import { Estudiante } from '../estudiantes/entities/estudiante.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { DataSource } from 'typeorm';
import { Optional } from '@nestjs/common';

@Injectable()
export class PlanesEstudioService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    private readonly alcance: AlcanceJerarquicoService,
    @Optional()
    @InjectRepository(Estudiante)
    private readonly estudianteRepository?: Repository<Estudiante>,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private enriquecerEstadoPlan(plan: PlanEstudio): PlanEstudio & { estado: EstadoPlanEstudio } {
    const estado = (plan as any).estado || (plan.activo ? EstadoPlanEstudio.VIGENTE : EstadoPlanEstudio.CERRADO);
    (plan as any).estado = estado;
    return plan as PlanEstudio & { estado: EstadoPlanEstudio };
  }

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

  private async validarGestionJerarquica(coordinadorId: number, carreraId: number): Promise<void> {
    if (!(await this.alcance.puedeEjecutar(coordinadorId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carreraId))) {
      throw new ConflictException('El coordinador ya no tiene permiso sobre la carrera del plan.');
    }
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
    const planes = await this.planRepository.find({
      ...(carreraIds !== null && { where: { carreraId: In(carreraIds) } }),
      relations: {
        carrera: true,
      },
      order: {
        carreraId: 'ASC',
        codigo: 'ASC',
      },
    });
    return planes.map((p) => this.enriquecerEstadoPlan(p));
  }

  async obtenerPorId(id: number): Promise<PlanEstudio> {
    return this.obtenerEntidadPorId(id);
  }

  async crearVersion(origenId: number, dto: CrearVersionPlanEstudioDto, usuarioId: number): Promise<PlanEstudio> {
    if (!this.dataSource) throw new ServiceUnavailableException('No se puede garantizar la creación transaccional de versiones.');
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const motivo = dto.motivo.trim();
    if (!codigo || !nombre || motivo.length < 5 || motivo.length > 500) throw new BadRequestException('Código, nombre y motivo válidos son obligatorios.');
    let nuevaId = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const planes = manager.getRepository(PlanEstudio);
        const origen = await planes.findOne({ where: { id: origenId }, lock: { mode: 'pessimistic_write' } });
        if (!origen) throw new NotFoundException('Plan de estudio no encontrado.');
        if (await this.alcance.tipoCuentaJerarquica(usuarioId) &&
          !(await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, origen.carreraId))) {
          throw new ForbiddenException('No tiene permiso vigente para versionar este plan.');
        }
        if (origen.estado !== EstadoPlanEstudio.VIGENTE || !origen.activo) throw new ConflictException('Solo se puede versionar un plan vigente.');
        const [sucesores] = await manager.query('SELECT COUNT(*) AS total FROM planes_estudio WHERE version_anterior_id = ?', [origenId]);
        if (Number(sucesores?.total || 0) !== 0) throw new ConflictException('Este plan ya tiene una versión derivada.');
        const duplicado = await planes.findOne({ where: { carreraId: origen.carreraId, codigo } });
        if (duplicado) throw new ConflictException('Ya existe un plan con ese código para la carrera.');

        const nueva = await planes.save(planes.create({
          carreraId: origen.carreraId, grado: origen.grado, codigo, nombre,
          descripcion: origen.descripcion, activo: true, estado: EstadoPlanEstudio.BORRADOR,
          motivoUltimoCambio: motivo, versionAnteriorId: origen.id,
          numeroVersion: Number(origen.numeroVersion || 1) + 1,
        }));
        nuevaId = nueva.id;

        const asignaturasOrigen = await manager.query('SELECT * FROM plan_asignaturas WHERE plan_estudio_id = ? ORDER BY id', [origenId]);
        const mapa = new Map<number, number>();
        const asignaturasRepo = manager.getRepository(PlanAsignatura);
        for (const row of asignaturasOrigen) {
          const copia = await asignaturasRepo.save(asignaturasRepo.create({
            planEstudioId: nueva.id, cursoId: row.curso_id, nivel: row.nivel, ciclo: row.ciclo, orden: row.orden,
            creditos: row.creditos, horasTeoria: row.horas_teoria, horasPractica: row.horas_practica,
            horasLaboratorio: row.horas_laboratorio, horasGira: row.horas_gira,
            horasEstudioIndependiente: row.horas_estudio_independiente, horasTotales: row.horas_totales,
            horasDocente: row.horas_docente, observacionHoras: row.observacion_horas, tipo: row.tipo,
            tipoOptativa: row.tipo_optativa, codigoReferencia: row.codigo_referencia,
            nombreReferencia: row.nombre_referencia, activo: Boolean(row.activo),
          }));
          mapa.set(Number(row.id), copia.id);
        }

        const requisitos = await manager.query(`SELECT r.asignatura_id, r.requisito_asignatura_id, r.tipo
          FROM plan_requisitos r JOIN plan_asignaturas a ON a.id = r.asignatura_id
          WHERE a.plan_estudio_id = ?`, [origenId]);
        for (const requisito of requisitos) {
          const asignaturaId = mapa.get(Number(requisito.asignatura_id));
          const requisitoId = mapa.get(Number(requisito.requisito_asignatura_id));
          if (!asignaturaId || !requisitoId) throw new ConflictException('El plan contiene requisitos con relaciones curriculares incompletas.');
          await manager.query('INSERT INTO plan_requisitos (asignatura_id, requisito_asignatura_id, tipo) VALUES (?, ?, ?)', [asignaturaId, requisitoId, requisito.tipo]);
        }

        const reglas = await manager.query('SELECT * FROM reglas_optativas_plan WHERE plan_estudio_id = ?', [origenId]);
        if (reglas.length) await manager.query(`INSERT INTO reglas_optativas_plan
          (plan_estudio_id, cantidad_disciplinarias, cantidad_abiertas, cantidad_sede, minimo_disciplinarias_propias, maximo_otras_areas)
          VALUES (?, ?, ?, ?, ?, ?)`, [nueva.id, reglas[0].cantidad_disciplinarias, reglas[0].cantidad_abiertas,
          reglas[0].cantidad_sede, reglas[0].minimo_disciplinarias_propias, reglas[0].maximo_otras_areas]);

        const salidas = await manager.query('SELECT * FROM salidas_academicas WHERE plan_estudio_id = ? ORDER BY id', [origenId]);
        for (const salida of salidas) {
          const salidaNueva = await manager.query(`INSERT INTO salidas_academicas
            (plan_estudio_id, codigo, nombre, tipo, creditos_requeridos, orden, descripcion, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [nueva.id, salida.codigo, salida.nombre, salida.tipo,
            salida.creditos_requeridos, salida.orden, salida.descripcion, salida.activo]);
          const miembros = await manager.query('SELECT plan_asignatura_id FROM salida_academica_asignaturas WHERE salida_academica_id = ?', [salida.id]);
          for (const miembro of miembros) {
            const mappedId = mapa.get(Number(miembro.plan_asignatura_id));
            if (!mappedId) throw new ConflictException('Una salida académica referencia una asignatura fuera del plan origen.');
            await manager.query('INSERT INTO salida_academica_asignaturas (salida_academica_id, plan_asignatura_id) VALUES (?, ?)', [salidaNueva.insertId, mappedId]);
          }
        }

        const equivalencias = await manager.query(`SELECT * FROM equivalencias_plan WHERE plan_origen_id = ? OR plan_destino_id = ? ORDER BY id`, [origenId, origenId]);
        for (const eq of equivalencias) {
          const ladoOrigen = Number(eq.plan_origen_id) === origenId;
          const ladoDestino = Number(eq.plan_destino_id) === origenId;
          const asignaturaOrigen = ladoOrigen ? mapa.get(Number(eq.asignatura_origen_id)) : Number(eq.asignatura_origen_id);
          const asignaturaDestino = ladoDestino ? mapa.get(Number(eq.asignatura_destino_id)) : Number(eq.asignatura_destino_id);
          if (!asignaturaOrigen || !asignaturaDestino) throw new ConflictException('No se pudo conservar una equivalencia existente al versionar el plan.');
          await manager.query(`INSERT INTO equivalencias_plan
            (carrera_origen_id, plan_origen_id, asignatura_origen_id, carrera_destino_id, plan_destino_id,
             asignatura_destino_id, justificacion, autorizado_por_usuario_id, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [eq.carrera_origen_id, ladoOrigen ? nueva.id : eq.plan_origen_id,
            asignaturaOrigen, eq.carrera_destino_id, ladoDestino ? nueva.id : eq.plan_destino_id,
            asignaturaDestino, eq.justificacion, eq.autorizado_por_usuario_id, eq.activo]);
        }
        await manager.query(`INSERT INTO auditoria_planes_estudio
          (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
          VALUES (?, 'CREACION_VERSION', ?, ?, ?, ?, ?, NOW())`, [origenId, String(origen.numeroVersion || 1),
          String(nueva.numeroVersion), motivo, usuarioId, JSON.stringify({ versionNuevaId: nueva.id, codigo, carreraId: origen.carreraId })]);
      });
    } catch (error) {
      if ((error as any)?.driverError?.code === 'ER_DUP_ENTRY' || (error as any)?.code === 'ER_DUP_ENTRY') throw new ConflictException('Ya existe esta versión o su código en la carrera.');
      throw error;
    }
    return this.obtenerEntidadPorId(nuevaId);
  }

  async activarVersion(origenId: number, versionId: number, motivo: string, usuarioId: number): Promise<PlanEstudio> {
    if (!this.dataSource) throw new ServiceUnavailableException('No se puede garantizar la activación auditada de la versión.');
    const razon = typeof motivo === 'string' ? motivo.trim() : '';
    if (razon.length < 5 || razon.length > 500) throw new BadRequestException('Indique un motivo de activación de 5 a 500 caracteres.');
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PlanEstudio);
      const origen = await repo.findOne({ where: { id: origenId }, lock: { mode: 'pessimistic_write' } });
      const version = await repo.findOne({ where: { id: versionId }, lock: { mode: 'pessimistic_write' } });
      if (!origen || !version) throw new NotFoundException('Plan origen o versión no encontrados.');
      if (version.versionAnteriorId !== origen.id || version.estado !== EstadoPlanEstudio.BORRADOR || origen.estado !== EstadoPlanEstudio.VIGENTE) {
        throw new ConflictException('La versión no es un borrador activable del plan vigente indicado.');
      }
      if (await this.alcance.tipoCuentaJerarquica(usuarioId) && !(await this.alcance.puedeEjecutar(usuarioId,
        PermisoSistema.PLANES_ESTUDIO_GESTIONAR, origen.carreraId))) throw new ForbiddenException('No tiene permiso vigente para activar esta versión.');
      const anteriorEstado = origen.estado;
      origen.estado = EstadoPlanEstudio.EN_TRANSICION;
      origen.activo = true;
      origen.motivoUltimoCambio = razon;
      version.estado = EstadoPlanEstudio.VIGENTE;
      version.activo = true;
      version.motivoUltimoCambio = razon;
      await repo.save([origen, version]);
      for (const [id, antes, despues] of [[origen.id, anteriorEstado, EstadoPlanEstudio.EN_TRANSICION],
        [version.id, EstadoPlanEstudio.BORRADOR, EstadoPlanEstudio.VIGENTE]] as const) {
        await manager.query(`INSERT INTO auditoria_planes_estudio
          (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
          VALUES (?, 'ACTIVACION_VERSION', ?, ?, ?, ?, ?, NOW())`, [id, antes, despues, razon, usuarioId,
          JSON.stringify({ versionAnteriorId: origen.id, versionActivadaId: version.id })]);
      }
    });
    return this.obtenerEntidadPorId(versionId);
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
      estado: EstadoPlanEstudio.BORRADOR,
      numeroVersion: 1,
      versionAnteriorId: null,
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
    usuarioId?: number,
  ): Promise<PlanEstudio> {
    if (usuarioId !== undefined) return this.actualizarAuditado(id, dto, usuarioId);
    const plan = await this.obtenerEntidadPorId(id);

    if (dto.grado !== undefined && dto.grado !== plan.grado) {
      throw new ConflictException('Un cambio de grado requiere crear una nueva versión del plan.');
    }

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

  private async actualizarAuditado(id: number, dto: ActualizarPlanEstudioDto,
    usuarioId: number): Promise<PlanEstudio> {
    if (!Number.isInteger(usuarioId) || usuarioId <= 0 || !this.dataSource) {
      throw new ServiceUnavailableException('No se puede auditar la edición del plan.');
    }
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PlanEstudio);
      const plan = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
      if (await this.alcance.tipoCuentaJerarquica(usuarioId) &&
        !(await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, plan.carreraId))) {
        throw new ForbiddenException('No tiene permiso vigente para editar este plan.');
      }
      if (dto.grado !== undefined && dto.grado !== plan.grado) {
        throw new ConflictException('Un cambio de grado requiere crear una nueva versión del plan.');
      }
      const anterior = { codigo: plan.codigo, nombre: plan.nombre, descripcion: plan.descripcion };
      const codigo = dto.codigo === undefined ? plan.codigo : dto.codigo.trim().toUpperCase();
      const nombre = dto.nombre === undefined ? plan.nombre : dto.nombre.trim();
      if (!codigo || !nombre) throw new BadRequestException('Código y nombre del plan son obligatorios.');
      if (codigo !== plan.codigo && await repo.findOne({ where: { carreraId: plan.carreraId, codigo } })) {
        throw new ConflictException('Ya existe un plan con ese código para la carrera.');
      }
      plan.codigo = codigo;
      plan.nombre = nombre;
      if (dto.descripcion !== undefined) plan.descripcion = dto.descripcion?.trim() || null;
      const nuevo = { codigo: plan.codigo, nombre: plan.nombre, descripcion: plan.descripcion };
      if (JSON.stringify(anterior) === JSON.stringify(nuevo)) return;
      await repo.save(plan);
      await manager.query(`INSERT INTO auditoria_planes_estudio
        (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo,
         usuario_id, metadata_json, created_at)
        VALUES (?, 'EDICION_MENOR', ?, ?, ?, ?, ?, NOW())`,
      [id, JSON.stringify(anterior), JSON.stringify(nuevo),
        'Corrección administrativa de metadatos del plan', usuarioId,
        JSON.stringify({ anterior, nuevo, carreraId: plan.carreraId })]);
    });
    return this.obtenerEntidadPorId(id);
  }

  async cambiarEstado(
    id: number,
    activoOEstado: boolean | CambiarEstadoPlanEstudioDto,
    usuarioId?: number,
  ): Promise<PlanEstudio> {
    const planActual = await this.obtenerEntidadPorId(id);
    if (usuarioId !== undefined && await this.alcance.tipoCuentaJerarquica(usuarioId)) {
      const puede = await this.alcance.puedeEjecutar(
        usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, planActual.carreraId,
      );
      if (!puede) {
        throw new ForbiddenException('No tiene permisos para modificar el estado del plan en esta carrera.');
      }
    }

    // El cierre ordinario corresponde a EN_TRANSICION: bloquea nuevos ingresos,
    // pero mantiene la continuidad y graduacion de estudiantes ya vinculados.
    const solicitud = typeof activoOEstado === 'boolean'
      ? { activo: activoOEstado } : activoOEstado;
    if (solicitud.estado === undefined && solicitud.activo === undefined) {
      throw new BadRequestException('Debe indicar un estado para el plan.');
    }
    const estadoObjetivo = solicitud.estado ??
      (solicitud.activo ? EstadoPlanEstudio.VIGENTE : EstadoPlanEstudio.EN_TRANSICION);
    if (solicitud.estado !== undefined && solicitud.activo !== undefined &&
      solicitud.activo !== (estadoObjetivo !== EstadoPlanEstudio.CERRADO)) {
      throw new BadRequestException('El estado y la propiedad activo son contradictorios.');
    }
    const motivo = (solicitud.motivo ?? '').trim();
    if (motivo.length < 5 || motivo.length > 500) {
      throw new BadRequestException('Indique un motivo de 5 a 500 caracteres para cambiar el estado.');
    }
    if (!usuarioId || !Number.isInteger(usuarioId) || usuarioId <= 0) {
      throw new BadRequestException('No se pudo identificar al usuario que realiza el cambio.');
    }
    if (!this.dataSource || typeof this.dataSource.transaction !== 'function') {
      throw new ServiceUnavailableException('No se puede garantizar la auditoria transaccional del cambio de estado.');
    }

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(PlanEstudio);
      const plan = await repo.findOne({
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
      const estadoAnterior = plan.estado ||
        (plan.activo ? EstadoPlanEstudio.VIGENTE : EstadoPlanEstudio.CERRADO);
      if (plan.estado === EstadoPlanEstudio.BORRADOR && plan.versionAnteriorId !== null &&
        plan.versionAnteriorId !== undefined && estadoObjetivo !== EstadoPlanEstudio.BORRADOR) {
        throw new ConflictException('Una versión derivada en borrador solo puede activarse mediante la activación auditada de versiones.');
      }

      // CERRADO es el archivo definitivo. Solo aplica si ya no hay alumnos
      // activos; para un plan con estudiantes se usa EN_TRANSICION.
      if (estadoObjetivo === EstadoPlanEstudio.CERRADO) {
        const filas = await manager.query(
          "SELECT COUNT(*) AS total FROM estudiantes WHERE plan_estudio_id = ? AND estado = 'ACTIVO'",
          [id],
        );
        const total = Number(filas?.[0]?.total);
        if (!Number.isInteger(total) || total < 0) {
          throw new ServiceUnavailableException('No fue posible verificar los estudiantes del plan.');
        }
        if (total > 0) {
          throw new BadRequestException('El plan tiene estudiantes activos. Use EN_TRANSICION para cerrar nuevos ingresos sin interrumpir sus estudios.');
        }
      }

      plan.estado = estadoObjetivo;
      plan.activo = estadoObjetivo !== EstadoPlanEstudio.CERRADO;
      plan.motivoUltimoCambio = motivo;
      await repo.save(plan);
      const tipo = estadoObjetivo === EstadoPlanEstudio.CERRADO ? 'CIERRE'
        : estadoObjetivo === EstadoPlanEstudio.VIGENTE && estadoAnterior !== EstadoPlanEstudio.VIGENTE
          ? 'REAPERTURA' : 'CAMBIO_ESTADO';
      await manager.query(
        `INSERT INTO auditoria_planes_estudio
         (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [id, tipo, estadoAnterior, estadoObjetivo, motivo, usuarioId],
      );
      // Si falla guardar el estado o la auditoria, todo se revierte.
    });
    return this.obtenerEntidadPorId(id);
  }

  async crearDesdeSolicitud(coordinadorId: number, asistenteId: number, dto: CrearPlanEstudioDto,
    manager: EntityManager): Promise<number> {
    await this.validarGestionJerarquica(coordinadorId, dto.carreraId);
    const carrera = await manager.getRepository(Carrera).findOne({ where: { id: dto.carreraId },
      lock: { mode: 'pessimistic_read' } });
    if (!carrera || !carrera.activo) throw new BadRequestException('La carrera seleccionada no estÃ¡ activa.');
    const repo = manager.getRepository(PlanEstudio);
    const codigo = dto.codigo.trim().toUpperCase();
    if (await repo.findOne({ where: { carreraId: dto.carreraId, codigo } })) {
      throw new ConflictException('Ya existe un plan con ese cÃ³digo para la carrera.');
    }
    const guardado = await repo.save(repo.create({ carreraId: dto.carreraId, grado: dto.grado,
      codigo, nombre: dto.nombre.trim(), descripcion: dto.descripcion?.trim() || null, activo: true,
      estado: EstadoPlanEstudio.BORRADOR, versionAnteriorId: null, numeroVersion: 1 }));
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
    await this.validarGestionJerarquica(coordinadorId, plan.carreraId);
    if (dto.grado !== undefined && dto.grado !== plan.grado) {
      throw new ConflictException('Un cambio de grado requiere crear una nueva versiÃ³n del plan.');
    }
    const anterior = { codigo: plan.codigo, nombre: plan.nombre, descripcion: plan.descripcion };
    if (dto.codigo !== undefined) plan.codigo = dto.codigo.trim().toUpperCase();
    if (dto.nombre !== undefined) plan.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) plan.descripcion = dto.descripcion?.trim() || null;
    if (!plan.codigo || !plan.nombre) throw new BadRequestException('CÃ³digo y nombre del plan son obligatorios.');
    const nuevo = { codigo: plan.codigo, nombre: plan.nombre, descripcion: plan.descripcion };
    if (JSON.stringify(anterior) === JSON.stringify(nuevo)) return id;
    try { await manager.getRepository(PlanEstudio).save(plan); } catch (error) { this.relanzarErrorPersistencia(error); }
    await manager.query(
      `INSERT INTO auditoria_planes_estudio
       (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
       VALUES (?, 'EDICION_MENOR', ?, ?, ?, ?, ?, NOW())`,
      [id, JSON.stringify(anterior), JSON.stringify(nuevo),
        'CorrecciÃ³n administrativa de metadatos aprobada por coordinaciÃ³n', coordinadorId,
        JSON.stringify({ propuestaPorUsuarioId: asistenteId, carreraId: plan.carreraId, anterior, nuevo })],
    );
    return id;
  }

  async cambiarEstadoDesdeSolicitud(coordinadorId: number, asistenteId: number, id: number,
    activo: boolean, huella: string, manager: EntityManager, motivo: string): Promise<number> {
    const plan = await this.planBloqueado(manager, id);
    if (plan.estado === EstadoPlanEstudio.BORRADOR && plan.versionAnteriorId !== null && plan.versionAnteriorId !== undefined) {
      throw new ConflictException('El estado de una versión derivada debe cambiarse mediante el flujo auditado de activación.');
    }
    if (this.huellaPlan(plan) !== huella) throw new ConflictException('El plan cambio desde que se envio la solicitud.');
    await this.validarGestionJerarquica(coordinadorId, plan.carreraId);
    if (!motivo || motivo.trim().length < 5 || motivo.trim().length > 500) {
      throw new BadRequestException('El cambio de estado debe tener un motivo de 5 a 500 caracteres.');
    }
    const anterior = plan.estado || (plan.activo ? EstadoPlanEstudio.VIGENTE : EstadoPlanEstudio.CERRADO);
    const objetivo = activo ? EstadoPlanEstudio.VIGENTE : EstadoPlanEstudio.EN_TRANSICION;
    plan.estado = objetivo;
    plan.activo = true; // EN_TRANSICION mantiene al alumnado actual.
    plan.motivoUltimoCambio = motivo.trim();
    await manager.getRepository(PlanEstudio).save(plan);
    await manager.query(
      `INSERT INTO auditoria_planes_estudio
       (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
       VALUES (?, 'CAMBIO_ESTADO', ?, ?, ?, ?, ?, NOW())`,
      [id, anterior, objetivo, motivo.trim(), coordinadorId,
        JSON.stringify({ propuestaPorUsuarioId: asistenteId })],
    );
    return id;
  }
}
