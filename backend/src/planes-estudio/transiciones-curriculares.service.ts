import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { rolActivoDePeticion } from '../auth/active-role-context';
import { Carrera } from '../carreras/entities/carrera.entity';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { EstadoEstudiante } from '../estudiantes/constants/estado-estudiante.constant';
import { FuenteRegistroAcademico } from '../estudiantes/constants/fuente-registro-academico.constant';
import { OrigenAcademico } from '../estudiantes/constants/origen-academico.constant';
import { ResultadoAcademico } from '../estudiantes/constants/resultado-academico.constant';
import { Estudiante } from '../estudiantes/entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from '../estudiantes/entities/historial-academico-estudiante.entity';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { HistorialPlanEstudiante } from '../estudiantes/entities/historial-plan-estudiante.entity';
import { EquivalenciaPlan } from './entities/equivalencia-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { SimularTransicionDto } from './dto/simular-transicion.dto';
import { EjecutarTransicionDto } from './dto/ejecutar-transicion.dto';

export interface ResultadoSimulacionEstudiante {
  estudianteId: number;
  cedula: string;
  nombreCompleto: string;
  estado: string;
  puedeMigrar: boolean;
  conflictos: string[];
  observacionesAcademicas?: string[];
  asignaturasAprobadasOrigenCount: number;
  asignaturasReconocidas: Array<{
    asignaturaDestinoId: number;
    codigo: string;
    nombre: string;
    creditos: number;
    tipoEquivalencia: string;
  }>;
  asignaturasSinEquivalencia: Array<{
    asignaturaOrigenId: number;
    codigo: string;
    nombre: string;
    creditos: number;
  }>;
}

@Injectable()
export class TransicionesCurricularesService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepo: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,
    @InjectRepository(Estudiante)
    private readonly estudianteRepo: Repository<Estudiante>,
    @InjectRepository(HistorialAcademicoEstudiante)
    private readonly historialRepo: Repository<HistorialAcademicoEstudiante>,
    @InjectRepository(EquivalenciaPlan)
    private readonly equivalenciaRepo: Repository<EquivalenciaPlan>,
    @Optional()
    private readonly alcance?: AlcanceJerarquicoService,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private async validarLecturaCarrera(usuarioId: number, carreraId: number): Promise<void> {
    if (this.alcance) {
      const tipo = await this.alcance.tipoCuentaJerarquica(usuarioId);
      if (tipo) {
        const puede = await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_VER, carreraId);
        if (!puede) throw new ForbiddenException('No tiene permisos de lectura sobre esta carrera.');
        return;
      }
    }
  }

  private async validarGestionCarrera(usuarioId: number, carreraId: number): Promise<void> {
    if (this.alcance) {
      const tipo = await this.alcance.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException('El asistente estudiantil debe registrar una propuesta de transición para revisión del coordinador.');
      }
      if (tipo === 'COORDINADOR') {
        const puede = await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carreraId);
        if (!puede) throw new ForbiddenException('No tiene permisos para gestionar transiciones en esta carrera.');
        return;
      }
    }
  }

  async consultarPoblacionEstudiantil(
    usuarioId: number,
    planOrigenId: number,
    carreraId?: number,
    filtros?: { estado?: string; soloActivos?: boolean },
  ) {
    let resolvedCarreraId = carreraId;
    if (!resolvedCarreraId) {
      const plan = await this.planRepo.findOne({ where: { id: planOrigenId } });
      if (!plan) throw new NotFoundException('Plan de origen no encontrado.');
      resolvedCarreraId = plan.carreraId;
    }
    await this.validarLecturaCarrera(usuarioId, resolvedCarreraId);

    const qb = this.estudianteRepo.createQueryBuilder('e')
      .where('e.carreraId = :carreraId', { carreraId: resolvedCarreraId })
      .andWhere('e.planEstudioId = :planOrigenId', { planOrigenId });

    if (filtros?.estado) {
      qb.andWhere('e.estado = :estado', { estado: filtros.estado });
    } else if (filtros?.soloActivos !== false) {
      // Regla PO: Por defecto estudiantes ACTIVOS; inactivos/retirados/graduados no se migran masivamente
      qb.andWhere('e.estado = :activo', { activo: EstadoEstudiante.ACTIVO });
    }

    qb.orderBy('e.apellido1', 'ASC').addOrderBy('e.nombres', 'ASC');

    const estudiantes = await qb.getMany();

    return estudiantes.map((e) => ({
      id: e.id,
      cedula: e.cedula,
      nombreCompleto: [e.nombres, e.apellido1, e.apellido2].filter(Boolean).join(' '),
      correoInstitucional: e.correoInstitucional,
      telefono: e.telefono,
      estado: e.estado,
      carreraId: e.carreraId,
      planEstudioId: e.planEstudioId,
    }));
  }

  async simularTransicion(
    usuarioId: number,
    dto: SimularTransicionDto,
  ): Promise<{
    carreraId: number;
    planOrigenId: number;
    planDestinoId: number;
    totalAnalizados: number;
    totalMigrables: number;
    totalConflictos: number;
    estudiantes: ResultadoSimulacionEstudiante[];
  }> {
    await this.validarLecturaCarrera(usuarioId, dto.carreraId);

    if (dto.planOrigenId === dto.planDestinoId) {
      throw new BadRequestException('El plan de origen y destino no pueden ser el mismo.');
    }

    const [planOrigen, planDestino] = await Promise.all([
      this.planRepo.findOne({ where: { id: dto.planOrigenId, carreraId: dto.carreraId } }),
      this.planRepo.findOne({ where: { id: dto.planDestinoId, carreraId: dto.carreraId } }),
    ]);

    if (!planOrigen || !planDestino) {
      throw new NotFoundException('Plan de origen o destino no encontrado en la carrera indicada.');
    }

    // 1. Obtener equivalencias oficiales activas entre ambos planes
    const equivalencias = await this.equivalenciaRepo.find({
      where: { planOrigenId: dto.planOrigenId, planDestinoId: dto.planDestinoId, activo: true },
      relations: { asignaturaOrigen: { curso: true }, asignaturaDestino: { curso: true } },
    });

    // 2. Obtener asignaturas del plan origen y destino
    const [asignaturasOrigen, asignaturasDestino] = await Promise.all([
      this.planAsignaturaRepo.find({ where: { planEstudioId: dto.planOrigenId }, relations: { curso: true } }),
      this.planAsignaturaRepo.find({ where: { planEstudioId: dto.planDestinoId }, relations: { curso: true } }),
    ]);

    const mapaAsigDestino = new Map(asignaturasDestino.map((a) => [a.id, a]));
    const mapaAsigOrigen = new Map(asignaturasOrigen.map((a) => [a.id, a]));

    // 3. Estudiantes a simular
    let estudiantes: Estudiante[] = [];
    if (dto.estudianteIds && dto.estudianteIds.length > 0) {
      const encontrados = await this.estudianteRepo.find({
        where: {
          id: In(dto.estudianteIds),
          carreraId: dto.carreraId,
          planEstudioId: dto.planOrigenId,
        },
      });
      estudiantes = Array.isArray(encontrados) ? encontrados : [];
    } else {
      const encontrados = await this.estudianteRepo.createQueryBuilder('e')
        .where('e.carreraId = :carreraId', { carreraId: dto.carreraId })
        .andWhere('e.planEstudioId = :planOrigenId', { planOrigenId: dto.planOrigenId })
        .andWhere('e.estado = :activo', { activo: EstadoEstudiante.ACTIVO })
        .orderBy('e.apellido1', 'ASC')
        .addOrderBy('e.nombres', 'ASC')
        .getMany();
      estudiantes = Array.isArray(encontrados) ? encontrados : [];
    }

    const mapaEstudiantes = new Map(estudiantes.map((e) => [e.id, e]));
    const listaAProcesar: Array<Estudiante | { id: number; noEncontrado: true }> =
      dto.estudianteIds && dto.estudianteIds.length > 0
        ? dto.estudianteIds.map((id) => mapaEstudiantes.get(id) || { id, noEncontrado: true })
        : estudiantes;

    const resultados: ResultadoSimulacionEstudiante[] = [];

    for (const item of listaAProcesar) {
      if ('noEncontrado' in item) {
        resultados.push({
          estudianteId: item.id,
          cedula: '—',
          nombreCompleto: 'Estudiante no encontrado',
          estado: 'DESCONOCIDO',
          puedeMigrar: false,
          conflictos: [`Estudiante #${item.id} no encontrado en el sistema.`],
          observacionesAcademicas: [],
          asignaturasAprobadasOrigenCount: 0,
          asignaturasReconocidas: [],
          asignaturasSinEquivalencia: [],
        });
        continue;
      }

      const est = item as Estudiante;
      const historiales = await this.historialRepo.find({
        where: { estudianteId: est.id, resultado: ResultadoAcademico.APROBADO },
        relations: { planAsignatura: { curso: true } },
      });

      const historialesValidos = historiales.filter((h) =>
        h.planAsignatura?.tipo !== TipoPlanAsignatura.OPTATIVA ||
        h.cursoOptativoId == null || h.reconocimientoOptativo === 'RECONOCIDO');
      const aprobadasOrigenIds = new Set(historialesValidos.map((h) => h.planAsignaturaId));
      const aprobadasCursosIds = new Set(
        historialesValidos.filter((h) => h.planAsignatura?.cursoId).map((h) => h.planAsignatura.cursoId!),
      );

      const reconocidasMap = new Map<number, {
        asignaturaDestinoId: number;
        codigo: string;
        nombre: string;
        creditos: number;
        tipoEquivalencia: string;
      }>();
      const origenConEquivalenciaIds = new Set<number>();
      const conflictos: string[] = [];
      const observacionesAcademicas: string[] = [];

      // Aún no existe una autorización de reconocimiento entre planes para la
      // optativa real. La simulación no debe presentar este caso como migrable.
      if (historiales.some((h) =>
        h.planAsignatura?.tipo === TipoPlanAsignatura.OPTATIVA && h.cursoOptativoId != null)) {
        conflictos.push('Las optativas reales aprobadas requieren una decisión de reconocimiento en el plan de destino.');
      }

      // Validar conflictos reales que impiden procesar la transición (regla institucional PO):
      // 1. Pertenencia incorrecta al plan de origen
      if (est.planEstudioId !== dto.planOrigenId) {
        conflictos.push(
          `El estudiante no pertenece al plan de origen #${dto.planOrigenId} (plan actual: #${est.planEstudioId}).`,
        );
      }

      // 2. Incompatibilidad de carrera
      if (est.carreraId !== dto.carreraId) {
        conflictos.push(
          `Incompatibilidad de carrera: el estudiante pertenece a la carrera #${est.carreraId}, distinta a la carrera #${dto.carreraId}.`,
        );
      }

      // 3. Estado no migrable sin reingreso formal
      if (est.estado === EstadoEstudiante.RETIRADO) {
        conflictos.push(
          `Estado de expediente no migrable (RETIRADO): requiere trámite de reingreso formal antes de la transición curricular.`,
        );
      } else if (est.estado === EstadoEstudiante.GRADUADO) {
        conflictos.push(
          `El estudiante ya se encuentra graduado en este plan de estudios; no requiere transición curricular.`,
        );
      }

      // Procesar equivalencias agrupadas
      // Detectar N:1
      const gruposCompuestosN1 = new Map<string, EquivalenciaPlan[]>();
      for (const eq of equivalencias) {
        if (eq.justificacion && eq.justificacion.includes('[COMPUESTA_N1:')) {
          const match = eq.justificacion.match(/\[COMPUESTA_N1:([^\]]+)\]/);
          const grp = match ? match[1] : 'default';
          const list = gruposCompuestosN1.get(grp) || [];
          list.push(eq);
          gruposCompuestosN1.set(grp, list);
        }
      }

      // 1. Evaluar equivalencias simples
      for (const eq of equivalencias) {
        if (eq.justificacion && eq.justificacion.includes('[COMPUESTA_N1:')) {
          continue; // Procesadas abajo
        }

        const tieneAprobada = aprobadasOrigenIds.has(eq.asignaturaOrigenId) ||
          (eq.asignaturaOrigen?.cursoId != null && aprobadasCursosIds.has(eq.asignaturaOrigen.cursoId));

        if (tieneAprobada) {
          origenConEquivalenciaIds.add(eq.asignaturaOrigenId);
          const dest = mapaAsigDestino.get(eq.asignaturaDestinoId);
          if (dest && !reconocidasMap.has(dest.id)) {
            reconocidasMap.set(dest.id, {
              asignaturaDestinoId: dest.id,
              codigo: dest.curso?.codigo || dest.codigoReferencia || '—',
              nombre: dest.curso?.nombre || dest.nombreReferencia || '—',
              creditos: Number(dest.creditos) || 0,
              tipoEquivalencia: eq.justificacion?.includes('[COMPUESTA_1N:') ? '1_A_N' : '1_A_1',
            });
          }
        }
      }

      // 2. Evaluar equivalencias compuestas N:1
      for (const [_grp, listaEq] of gruposCompuestosN1.entries()) {
        const destId = listaEq[0].asignaturaDestinoId;
        const dest = mapaAsigDestino.get(destId);
        let requeridas = listaEq.map((e) => e.asignaturaOrigenId);
        for (const e of listaEq) {
          const m = e.justificacion?.match(/\[COMPUESTA_N1:[^:]+:\d+:\d+:(\[[^\]]+\])\]/);
          if (m && m[1]) {
            try {
              const parsed = JSON.parse(m[1]);
              if (Array.isArray(parsed)) {
                requeridas = Array.from(new Set([...requeridas, ...parsed]));
              }
            } catch {}
          }
        }
        const aprobadasDeGrupo = requeridas.filter((reqId) => aprobadasOrigenIds.has(reqId));

        if (aprobadasDeGrupo.length === requeridas.length) {
          // Todas aprobadas
          requeridas.forEach((id) => origenConEquivalenciaIds.add(id));
          if (dest && !reconocidasMap.has(dest.id)) {
            reconocidasMap.set(dest.id, {
              asignaturaDestinoId: dest.id,
              codigo: dest.curso?.codigo || dest.codigoReferencia || '—',
              nombre: dest.curso?.nombre || dest.nombreReferencia || '—',
              creditos: Number(dest.creditos) || 0,
              tipoEquivalencia: 'N_A_1',
            });
          }
        } else if (aprobadasDeGrupo.length > 0) {
          // Regla PO: Requisito académico pendiente, NO es un conflicto que bloquee la transición
          const faltantes = requeridas.filter((r) => !aprobadasOrigenIds.has(r)).map((id) => {
            const a = mapaAsigOrigen.get(id);
            return a?.curso?.nombre || a?.nombreReferencia || `#${id}`;
          });
          observacionesAcademicas.push(
            `Equivalencia compuesta N:1 incompleta para '${dest?.curso?.nombre || dest?.nombreReferencia || 'materia destino'}': aprobó ${aprobadasDeGrupo.length}/${requeridas.length} materias requeridas (faltan: ${faltantes.join(', ')}). La asignatura destino queda pendiente en el nuevo plan y las materias aprobadas permanecen en el historial.`,
          );
        }
      }

      // 3. Materias sin equivalencia (permanecen como histórico aprobado)
      const sinEquivalencia: ResultadoSimulacionEstudiante['asignaturasSinEquivalencia'] = [];
      for (const h of historiales) {
        if (!origenConEquivalenciaIds.has(h.planAsignaturaId)) {
          sinEquivalencia.push({
            asignaturaOrigenId: h.planAsignaturaId,
            codigo: h.planAsignatura?.curso?.codigo || h.planAsignatura?.codigoReferencia || '—',
            nombre: h.planAsignatura?.curso?.nombre || h.planAsignatura?.nombreReferencia || '—',
            creditos: Number(h.planAsignatura?.creditos) || 0,
          });
        }
      }

      const puedeMigrar = conflictos.length === 0;

      resultados.push({
        estudianteId: est.id,
        cedula: est.cedula,
        nombreCompleto: [est.nombres, est.apellido1, est.apellido2].filter(Boolean).join(' '),
        estado: est.estado,
        puedeMigrar,
        conflictos,
        observacionesAcademicas,
        asignaturasAprobadasOrigenCount: historiales.length,
        asignaturasReconocidas: Array.from(reconocidasMap.values()),
        asignaturasSinEquivalencia: sinEquivalencia,
      });
    }

    const totalMigrables = resultados.filter((r) => r.puedeMigrar).length;
    const totalConflictos = resultados.filter((r) => !r.puedeMigrar).length;

    return {
      carreraId: dto.carreraId,
      planOrigenId: dto.planOrigenId,
      planDestinoId: dto.planDestinoId,
      totalAnalizados: resultados.length,
      totalMigrables,
      totalConflictos,
      estudiantes: resultados,
    };
  }

  async ejecutarTransicion(
    usuarioId: number,
    dto: EjecutarTransicionDto,
  ): Promise<{
    solicitados: number;
    migrados: number;
    fallidos: Array<{ estudianteId: number; error: string }>;
  }> {
    await this.validarGestionCarrera(usuarioId, dto.carreraId);

    // Ejecuta simulación previa para garantizar consistencia académica
    const simulacion = await this.simularTransicion(usuarioId, {
      carreraId: dto.carreraId,
      planOrigenId: dto.planOrigenId,
      planDestinoId: dto.planDestinoId,
      estudianteIds: dto.estudianteIds,
    });

    const mapaSimulacion = new Map(simulacion.estudiantes.map((s) => [s.estudianteId, s]));
    const fallidos: Array<{ estudianteId: number; error: string }> = [];
    let migrados = 0;

    for (const estId of dto.estudianteIds) {
      const sim = mapaSimulacion.get(estId);
      if (!sim) {
        fallidos.push({ estudianteId: estId, error: 'Estudiante no encontrado en la población del plan origen.' });
        continue;
      }

      if (!sim.puedeMigrar) {
        fallidos.push({
          estudianteId: estId,
          error: sim.conflictos.join('; ') || 'El expediente presenta conflictos curriculares sin resolver.',
        });
        continue;
      }

      // Ejecución atómica individual por estudiante
      try {
        if (!this.dataSource) {
          throw new Error('Servicio de persistencia no disponible.');
        }

        await this.dataSource.transaction(async (manager) => {
          const estRepo = manager.getRepository(Estudiante);
          const histRepo = manager.getRepository(HistorialAcademicoEstudiante);

          const estudiante = await estRepo.findOne({
            where: { id: estId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!estudiante || estudiante.planEstudioId !== dto.planOrigenId ||
              estudiante.carreraId !== dto.carreraId ||
              [EstadoEstudiante.RETIRADO, EstadoEstudiante.GRADUADO].includes(estudiante.estado)) {
            throw new BadRequestException('El estudiante no se encuentra en el plan de origen esperado.');
          }

          if (sim.asignaturasReconocidas.length) {
            const destinos = await manager.getRepository(PlanAsignatura).find({
              where: { id: In(sim.asignaturasReconocidas.map((rec) => rec.asignaturaDestinoId)) },
            });
            if (destinos.some((destino) => destino.tipo === TipoPlanAsignatura.OPTATIVA)) {
              throw new BadRequestException('La transición hacia espacios optativos requiere una decisión explícita sobre la asignatura real y su reconocimiento en el nuevo plan.');
            }
          }

          // 1. Actualizar plan del estudiante
          estudiante.planEstudioId = dto.planDestinoId;
          await estRepo.save(estudiante);

          // 2. Registrar en historial de cambios de plan
          await manager.query(
            `INSERT INTO historial_planes_estudiantes (estudiante_id, plan_anterior_id, plan_nuevo_id, periodo_cambio_id, motivo, cambiado_por_usuario_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [estId, dto.planOrigenId, dto.planDestinoId, estudiante.periodoIngresoId || 1, dto.motivo.trim(), usuarioId],
          );

          // 3. Registrar materias reconocidas por convalidación institucional uniforme
          for (const rec of sim.asignaturasReconocidas) {
            const yaExiste = await histRepo.findOne({
              where: {
                estudianteId: estId,
                planAsignaturaId: rec.asignaturaDestinoId,
                resultado: ResultadoAcademico.APROBADO,
              },
            });

            if (!yaExiste) {
              const nuevoHistorial = histRepo.create({
                estudianteId: estId,
                planAsignaturaId: rec.asignaturaDestinoId,
                resultado: ResultadoAcademico.APROBADO,
                origenAcademico: OrigenAcademico.EQUIVALENCIA,
                fuenteRegistro: FuenteRegistroAcademico.MANUAL,
                observaciones: `Reconocimiento por transición curricular institucional (${rec.tipoEquivalencia})`,
                registradoPorUsuarioId: usuarioId,
              });
              await histRepo.save(nuevoHistorial);
            }
          }

          await manager.query(
            `INSERT INTO auditoria_planes_estudio (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
             VALUES (?, 'TRANSICION_CURRICULAR', ?, ?, ?, ?, ?, NOW())`,
            [dto.planOrigenId, `Plan #${dto.planOrigenId}`, `Plan #${dto.planDestinoId}`,
              dto.motivo.trim(), usuarioId, JSON.stringify({
                estudianteId: estId, carreraId: dto.carreraId, planDestinoId: dto.planDestinoId,
              })],
          );
        });

        migrados++;
      } catch (err: any) {
        fallidos.push({
          estudianteId: estId,
          error: err?.message || 'Error al aplicar transición atómica individual.',
        });
      }
    }

    return {
      solicitados: dto.estudianteIds.length,
      migrados,
      fallidos,
    };
  }

  async listarLotesAuditoria(
    usuarioId: number,
    carreraId?: number,
    planOrigenId?: number,
    planDestinoId?: number,
  ) {
    if (!this.alcance || !this.dataSource) {
      throw new ForbiddenException('No se pudo verificar el alcance de la auditoría.');
    }
    for (const id of [carreraId, planOrigenId, planDestinoId]) {
      if (id !== undefined && (!Number.isInteger(id) || id <= 0)) {
        throw new BadRequestException('Los filtros deben ser identificadores positivos.');
      }
    }
    const esAdmin = rolActivoDePeticion(usuarioId) === RolSistema.ADMIN_GLOBAL;
    const carrerasPermitidas = esAdmin ? [] : await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    if (!esAdmin && (!carrerasPermitidas.length ||
        (carreraId && !carrerasPermitidas.includes(carreraId)))) {
      throw new ForbiddenException('No tiene acceso a la carrera solicitada.');
    }
    if (carreraId) await this.validarLecturaCarrera(usuarioId, carreraId);

    let query = `SELECT a.id, a.plan_estudio_id, a.tipo_modificacion, a.motivo,
                          a.usuario_id, a.valor_anterior, a.valor_nuevo, a.metadata_json, a.created_at,
                          u.nombres, u.apellido1, p.nombre AS plan_nombre, p.codigo AS plan_codigo
                   FROM auditoria_planes_estudio a
                   LEFT JOIN usuarios u ON u.id = a.usuario_id
                   LEFT JOIN planes_estudio p ON p.id = a.plan_estudio_id
                   WHERE a.tipo_modificacion = 'TRANSICION_CURRICULAR'`;
    const params: Array<number | string> = [];
    if (!esAdmin) {
      query += ` AND p.carrera_id IN (${carrerasPermitidas.map(() => '?').join(', ')})`;
      params.push(...carrerasPermitidas);
    }
    if (carreraId) {
      query += ' AND p.carrera_id = ?';
      params.push(carreraId);
    }
    if (planOrigenId) {
      query += ' AND a.plan_estudio_id = ?';
      params.push(planOrigenId);
    }
    if (planDestinoId) {
      query += ` AND (CAST(JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json, '$.planDestinoId')) AS UNSIGNED) = ? OR a.valor_nuevo = ?)`;
      params.push(planDestinoId, `Plan #${planDestinoId}`);
    }
    query += ' ORDER BY a.created_at DESC, a.id DESC LIMIT 50';
    return this.dataSource.query(query, params);
  }
}
