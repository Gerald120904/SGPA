import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { RolSistema } from '../auth/constants/roles.constants';
import { rolActivoDePeticion } from '../auth/active-role-context';
import { Usuario } from '../usuarios/entities/usuario.entity';
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
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { ReglaOptativaPlan } from './entities/regla-optativa-plan.entity';
import { HistorialPlanEstudiante } from '../estudiantes/entities/historial-plan-estudiante.entity';
import { EquivalenciaPlan } from './entities/equivalencia-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { EstadoPlanEstudio } from './constants/estado-plan-estudio.constant';
import { SimularTransicionDto } from './dto/simular-transicion.dto';
import { EjecutarTransicionDto } from './dto/ejecutar-transicion.dto';
import { CrearConvalidacionExternaDto } from './dto/crear-convalidacion-externa.dto';
import { ConvalidacionExterna } from './entities/convalidacion-externa.entity';
import { EstadoConvalidacionExterna } from './constants/estado-convalidacion-externa.constant';
import { VerificarEvidenciaConvalidacionExternaDto } from './dto/verificar-evidencia-convalidacion-externa.dto';

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
    tipoDestino?: TipoPlanAsignatura;
    codigo: string;
    nombre: string;
    creditos: number;
    tipoEquivalencia: string;
    historialOrigenId?: number;
    cursoOptativoId?: number;
    tipoOptativaReal?: TipoOptativa;
    codigoOptativaReal?: string | null;
    nombreOptativaReal?: string | null;
    creditosOptativaReal?: number | null;
    historialOrigenIds?: number[];
    asignaturasOrigenIds?: number[];
    equivalenciaIds?: number[];
    creditosOrigen?: number;
    convalidacionExternaId?: number;
    institucionOrigen?: string;
    asignaturaOrigen?: string;
    identificacionAsignatura?: string;
    documentacionOrigen?: Array<{ nombre: string; referencia: string; sha256: string }>;
  }>;
  asignaturasSinEquivalencia: Array<{
    asignaturaOrigenId: number;
    codigo: string;
    nombre: string;
    creditos: number;
  }>;
}

export interface RevertirTransicionDto {
  auditoriaId: number;
  motivo: string;
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
    @InjectRepository(ReglaOptativaPlan)
    private readonly reglaOptativaRepo: Repository<ReglaOptativaPlan>,
    @Optional()
    private readonly alcance?: AlcanceJerarquicoService,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    @InjectRepository(ConvalidacionExterna)
    private readonly convalidacionExternaRepo?: Repository<ConvalidacionExterna>,
  ) {}

  private async validarSolicitudExterna(manager: EntityManager, usuarioId: number, carreraId: number) {
    const rolActivo = rolActivoDePeticion(usuarioId);
    if (![RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR].includes(rolActivo as RolSistema)) {
      throw new ForbiddenException('El rol activo no puede registrar solicitudes de convalidación externa.');
    }
    const usuario = await manager.getRepository(Usuario).findOne({ where: { id: usuarioId, activo: true }, lock: { mode: 'pessimistic_write' } });
    const roles: Array<{ nombre: string }> = await manager.query(
      `SELECT r.nombre FROM usuario_roles ur INNER JOIN roles r ON r.id = ur.rol_id
       WHERE ur.usuario_id = ? AND r.activo = 1 ORDER BY r.id FOR UPDATE`, [usuarioId],
    );
    if (!usuario || !roles.some((r) => r.nombre === rolActivo)) {
      throw new ForbiddenException('El rol activo o la cuenta solicitante ya no están vigentes.');
    }
    if (rolActivo === RolSistema.COORDINADOR) {
      const permisos: any[] = await manager.query(
        `SELECT id FROM permisos_carrera WHERE usuario_id = ? AND carrera_id = ? AND permiso = ? AND activo = 1 FOR UPDATE`,
        [usuarioId, carreraId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR],
      );
      if (!permisos.length || !this.alcance || !(await this.alcance.puedeEjecutar(
        usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, carreraId,
      ))) throw new ForbiddenException('No tiene permiso vigente para gestionar convalidaciones en esta carrera.');
    }
  }

  private normalizarEvidenciaConvalidacion(evidencia: Array<{ nombre: string; referencia: string; sha256: string }>) {
    return evidencia.map((doc) => ({
      nombre: String(doc.nombre).trim(), referencia: String(doc.referencia).trim(), sha256: String(doc.sha256).toLowerCase(),
    })).sort((a, b) => a.sha256.localeCompare(b.sha256) || a.referencia.localeCompare(b.referencia));
  }

  async solicitarConvalidacionExterna(usuarioId: number, dto: CrearConvalidacionExternaDto) {
    if (!this.dataSource) throw new NotFoundException('Servicio de persistencia no disponible.');
    if (!/^[0-9a-f]{64}$/i.test(dto.documentacion?.[0]?.sha256 || '') ||
        !dto.documentacion?.length || dto.documentacion.length > 10 ||
        dto.documentacion.some((doc) => !/^[0-9a-f]{64}$/i.test(doc.sha256) || /^\s*(?:file:|data:)/i.test(doc.referencia))) {
      throw new BadRequestException('Adjunte entre 1 y 10 referencias institucionales de respaldo con SHA-256 válido.');
    }
    const payload = {
      estudianteId: dto.estudianteId, planDestinoId: dto.planDestinoId,
      planAsignaturaDestinoId: dto.planAsignaturaDestinoId,
      institucionOrigen: dto.institucionOrigen.trim(), asignaturaOrigen: dto.asignaturaOrigen.trim(),
      identificacionAsignatura: dto.identificacionAsignatura.trim(), creditosOrigen: dto.creditosOrigen,
      documentacion: dto.documentacion.map((d) => ({ nombre: d.nombre.trim(), referencia: d.referencia.trim(), sha256: d.sha256.toLowerCase() })),
      motivoSolicitud: dto.motivoSolicitud.trim(),
    };
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ConvalidacionExterna);
      const estudiante = await manager.getRepository(Estudiante).findOne({ where: { id: dto.estudianteId }, lock: { mode: 'pessimistic_write' } });
      if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
      await this.validarSolicitudExterna(manager, usuarioId, estudiante.carreraId);
      const existing = await repo.findOne({ where: { idempotencyKey: dto.idempotencyKey }, lock: { mode: 'pessimistic_write' } });
      if (existing) {
        if (existing.payloadHash !== payloadHash || existing.solicitadaPorUsuarioId !== usuarioId) {
          throw new ConflictException('La clave idempotente ya fue usada con otra solicitud.');
        }
        return { ...existing, idempotente: true };
      }
      const plan = await manager.getRepository(PlanEstudio).findOne({ where: { id: dto.planDestinoId }, lock: { mode: 'pessimistic_write' } });
      const asignatura = await manager.getRepository(PlanAsignatura).findOne({ where: { id: dto.planAsignaturaDestinoId }, lock: { mode: 'pessimistic_write' } });
      if (!plan || plan.carreraId !== estudiante.carreraId || plan.activo !== true || plan.estado !== EstadoPlanEstudio.VIGENTE ||
          !asignatura || asignatura.planEstudioId !== plan.id || asignatura.activo === false) {
        throw new BadRequestException('El plan destino debe estar vigente y su asignatura pertenecer a la carrera del estudiante.');
      }
      const duplicate = await repo.findOne({ where: {
        estudianteId: estudiante.id, planAsignaturaDestinoId: asignatura.id,
        identificacionAsignatura: payload.identificacionAsignatura, institucionOrigen: payload.institucionOrigen,
        estado: In([EstadoConvalidacionExterna.PENDIENTE, EstadoConvalidacionExterna.APROBADA]),
      }, lock: { mode: 'pessimistic_write' } });
      if (duplicate) throw new ConflictException('Ya existe una solicitud pendiente o aprobada para esa asignatura externa y destino.');
      const saved = await repo.save(repo.create({
        ...payload, estudianteId: estudiante.id, carreraId: estudiante.carreraId,
        planDestinoId: plan.id, planAsignaturaDestinoId: asignatura.id,
        estado: EstadoConvalidacionExterna.PENDIENTE, solicitadaPorUsuarioId: usuarioId,
        idempotencyKey: dto.idempotencyKey, payloadHash,
        revisadaPorUsuarioId: null, rolRevisor: null, permisoRevisor: null, fechaRevision: null, motivoDecision: null,
      }));
      await manager.query(
        `INSERT INTO auditoria_convalidaciones_externas (convalidacion_id, accion, usuario_id, rol_activo, permiso, motivo, snapshot_json, created_at)
         VALUES (?, 'SOLICITADA', ?, ?, ?, ?, ?, NOW(6))`,
        [saved.id, usuarioId, rolActivoDePeticion(usuarioId), PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
          payload.motivoSolicitud, JSON.stringify({ ...payload, carreraId: estudiante.carreraId, estado: EstadoConvalidacionExterna.PENDIENTE })],
      );
      return { ...saved, idempotente: false };
    });
  }

  async listarConvalidacionesExternas(usuarioId: number, carreraId?: number, estado?: EstadoConvalidacionExterna) {
    if (!this.dataSource || !this.alcance) throw new ForbiddenException('No se pudo verificar el alcance de solicitudes externas.');
    if (carreraId !== undefined && (!Number.isSafeInteger(carreraId) || carreraId <= 0)) {
      throw new BadRequestException('El filtro de carrera debe ser un identificador positivo.');
    }
    if (estado && !Object.values(EstadoConvalidacionExterna).includes(estado)) {
      throw new BadRequestException('Estado de convalidación externa inválido.');
    }
    const admin = rolActivoDePeticion(usuarioId) === RolSistema.ADMIN_GLOBAL;
    const carrerasCandidatas = admin ? undefined : await this.alcance.obtenerCarrerasAutorizadas(usuarioId);
    const carreras = carrerasCandidatas ? (await Promise.all(carrerasCandidatas.map(async (id) =>
      await this.alcance!.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_VER, id) ? id : null)))
      .filter((id): id is number => id !== null) : undefined;
    if (!admin && (!carreras?.length || (carreraId && !carreras.includes(carreraId)))) {
      throw new ForbiddenException('No tiene acceso al alcance solicitado.');
    }
    if (carreraId && !admin) await this.validarLecturaCarrera(usuarioId, carreraId);
    const query = this.dataSource.getRepository(ConvalidacionExterna).createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC').take(100);
    if (admin) { if (carreraId) query.andWhere('c.carreraId = :carreraId', { carreraId }); }
    else query.andWhere('c.carreraId IN (:...carreras)', { carreras });
    if (estado) query.andWhere('c.estado = :estado', { estado });
    return query.getMany();
  }

  async auditarConvalidacionExterna(usuarioId: number, id: number) {
    if (!this.dataSource || !this.convalidacionExternaRepo) throw new ForbiddenException('Auditoría no disponible.');
    const row = await this.convalidacionExternaRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Solicitud externa no encontrada.');
    if (rolActivoDePeticion(usuarioId) !== RolSistema.ADMIN_GLOBAL) {
      if (!this.alcance || !(await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_VER, row.carreraId))) {
        throw new ForbiddenException('No tiene acceso a la auditoría de esta solicitud.');
      }
    }
    return this.dataSource.query(
      `SELECT id, convalidacion_id, accion, usuario_id, rol_activo, permiso, motivo, snapshot_json, created_at
       FROM auditoria_convalidaciones_externas WHERE convalidacion_id = ? ORDER BY id`, [id],
    );
  }

  async verificarEvidenciaConvalidacionExterna(usuarioId: number, id: number, dto: VerificarEvidenciaConvalidacionExternaDto) {
    if (!this.dataSource) throw new NotFoundException('Servicio de persistencia no disponible.');
    const motivo = dto.motivoRevision?.trim();
    if (!Number.isSafeInteger(id) || id <= 0 || !motivo || motivo.length < 5 || motivo.length > 500 ||
        dto.confirmacion !== 'CONFIRMO_REVISION_DOCUMENTAL' || !Array.isArray(dto.hashesVerificados) ||
        dto.hashesVerificados.length < 1 || dto.hashesVerificados.length > 10 ||
        dto.hashesVerificados.some((hash) => !/^[0-9a-f]{64}$/i.test(hash))) {
      throw new BadRequestException('La confirmación de revisión, motivo e identificadores documentales deben ser válidos.');
    }
    return this.dataSource.transaction(async (manager) => {
      const solicitud = await manager.getRepository(ConvalidacionExterna).findOne({
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) throw new NotFoundException('Solicitud externa no encontrada.');
      if (solicitud.estado !== EstadoConvalidacionExterna.PENDIENTE) {
        throw new ConflictException('Solo las solicitudes pendientes permiten revisión de evidencia.');
      }
      await this.validarSolicitudExterna(manager, usuarioId, solicitud.carreraId);

      const evidencia = Array.isArray(solicitud.documentacion) ? solicitud.documentacion : [];
      if (!evidencia.length || evidencia.length > 10 || evidencia.some((doc) =>
        !doc.nombre?.trim() || !doc.referencia?.trim() || /^\s*(?:file:|data:)/i.test(doc.referencia) ||
        !/^[0-9a-f]{64}$/i.test(doc.sha256 || ''))) {
        throw new ConflictException('La evidencia documental no está disponible o está incompleta.');
      }
      const auditRows: any[] = await manager.query(
        `SELECT usuario_id, snapshot_json FROM auditoria_convalidaciones_externas
         WHERE convalidacion_id = ? AND accion = 'SOLICITADA' ORDER BY id LIMIT 1 FOR UPDATE`, [id],
      );
      const original = typeof auditRows[0]?.snapshot_json === 'string'
        ? JSON.parse(auditRows[0].snapshot_json) : auditRows[0]?.snapshot_json;
      const evidenciaNormalizada = this.normalizarEvidenciaConvalidacion(evidencia);
      if (!original || JSON.stringify(this.normalizarEvidenciaConvalidacion(original.documentacion || [])) !==
          JSON.stringify(evidenciaNormalizada) || Number(original.estudianteId) !== solicitud.estudianteId ||
          Number(original.carreraId) !== solicitud.carreraId || Number(original.planDestinoId) !== solicitud.planDestinoId ||
          Number(original.planAsignaturaDestinoId) !== solicitud.planAsignaturaDestinoId) {
        throw new ConflictException('La evidencia o el alcance difieren de la solicitud original.');
      }
      const hashesEsperados = evidenciaNormalizada.map((doc) => doc.sha256).sort();
      const hashesConfirmados = dto.hashesVerificados.map((hash) => hash.toLowerCase()).sort();
      if (JSON.stringify(hashesEsperados) !== JSON.stringify(hashesConfirmados)) {
        throw new ConflictException('Confirme individualmente todos los documentos de respaldo presentados.');
      }

      const rolActivo = rolActivoDePeticion(usuarioId);
      const snapshot = {
        solicitudId: id, estudianteId: solicitud.estudianteId, carreraId: solicitud.carreraId,
        planDestinoId: solicitud.planDestinoId, planAsignaturaDestinoId: solicitud.planAsignaturaDestinoId,
        documentos: evidenciaNormalizada, hashesVerificados: hashesConfirmados,
        motivoRevision: motivo, confirmacion: dto.confirmacion,
        revisionHumanaDeclarada: true,
      };
      await manager.query(
        `INSERT INTO auditoria_convalidaciones_externas (convalidacion_id, accion, usuario_id, rol_activo, permiso, motivo, snapshot_json, created_at)
         VALUES (?, 'EVIDENCIA_VERIFICADA', ?, ?, ?, ?, ?, NOW(6))`,
        [id, usuarioId, rolActivo, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, motivo, JSON.stringify(snapshot)],
      );
      return { id, estado: solicitud.estado, evidenciaVerificada: true, documentosRevisados: evidenciaNormalizada.length };
    });
  }

  async decidirConvalidacionExterna(usuarioId: number, id: number, dto: { decision: EstadoConvalidacionExterna.APROBADA | EstadoConvalidacionExterna.RECHAZADA; motivo: string }) {
    if (!this.dataSource) throw new NotFoundException('Servicio de persistencia no disponible.');
    const motivo = dto.motivo?.trim();
    if (!Number.isSafeInteger(id) || id <= 0 || !motivo || motivo.length < 5 || motivo.length > 500 ||
        ![EstadoConvalidacionExterna.APROBADA, EstadoConvalidacionExterna.RECHAZADA].includes(dto.decision)) {
      throw new BadRequestException('La decisión, solicitud y motivo deben ser válidos.');
    }
    return this.dataSource.transaction(async (manager) => {
      const rolActivo = rolActivoDePeticion(usuarioId);
      if (![RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR].includes(rolActivo as RolSistema)) {
        throw new ForbiddenException('El rol activo no puede decidir convalidaciones externas.');
      }
      const actor = await manager.getRepository(Usuario).findOne({ where: { id: usuarioId, activo: true }, lock: { mode: 'pessimistic_write' } });
      const roles: Array<{ nombre: string }> = await manager.query(
        `SELECT r.nombre FROM usuario_roles ur INNER JOIN roles r ON r.id = ur.rol_id
         WHERE ur.usuario_id = ? AND r.activo = 1 ORDER BY r.id FOR UPDATE`, [usuarioId],
      );
      if (!actor || !roles.some((r) => r.nombre === rolActivo)) throw new ForbiddenException('La cuenta o el rol activo del revisor ya no están vigentes.');

      const repo = manager.getRepository(ConvalidacionExterna);
      const solicitud = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!solicitud) throw new NotFoundException('Solicitud externa no encontrada.');
      if (solicitud.estado !== EstadoConvalidacionExterna.PENDIENTE) throw new ConflictException('Solo las solicitudes pendientes pueden recibir una decisión.');

      if (rolActivo === RolSistema.COORDINADOR) {
        const permissionRows: any[] = await manager.query(
          `SELECT id FROM permisos_carrera WHERE usuario_id = ? AND carrera_id = ? AND permiso = ? AND activo = 1 FOR UPDATE`,
          [usuarioId, solicitud.carreraId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR],
        );
        if (!permissionRows.length || !this.alcance || !(await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, solicitud.carreraId))) {
          throw new ForbiddenException('No tiene permiso efectivo vigente para decidir en esta carrera.');
        }
      }

      const estudiante = await manager.getRepository(Estudiante).findOne({ where: { id: solicitud.estudianteId }, lock: { mode: 'pessimistic_write' } });
      const carrera = await manager.getRepository(Carrera).findOne({ where: { id: solicitud.carreraId }, lock: { mode: 'pessimistic_write' } });
      const plan = await manager.getRepository(PlanEstudio).findOne({ where: { id: solicitud.planDestinoId }, lock: { mode: 'pessimistic_write' } });
      const asignatura = await manager.getRepository(PlanAsignatura).findOne({ where: { id: solicitud.planAsignaturaDestinoId }, lock: { mode: 'pessimistic_write' } });
      if (!estudiante || !carrera || !plan || !asignatura || estudiante.carreraId !== solicitud.carreraId || plan.carreraId !== solicitud.carreraId ||
          plan.estado !== EstadoPlanEstudio.VIGENTE || plan.activo !== true || asignatura.planEstudioId !== plan.id || asignatura.activo === false) {
        throw new ConflictException('La carrera, estudiante, plan o asignatura destino ya no coinciden con la solicitud.');
      }

      const evidencia = Array.isArray(solicitud.documentacion) ? solicitud.documentacion : [];
      if (!evidencia.length || evidencia.length > 10 || evidencia.some((doc) => !doc.nombre?.trim() || !doc.referencia?.trim() ||
          /^\s*(?:file:|data:)/i.test(doc.referencia) || !/^[0-9a-f]{64}$/i.test(doc.sha256 || ''))) {
        throw new ConflictException('La evidencia documental no es verificable o está incompleta.');
      }
      const solicitudAudit: any[] = await manager.query(
        `SELECT snapshot_json FROM auditoria_convalidaciones_externas WHERE convalidacion_id = ? AND accion = 'SOLICITADA' ORDER BY id LIMIT 1 FOR UPDATE`, [id],
      );
      const snapshot = typeof solicitudAudit[0]?.snapshot_json === 'string' ? JSON.parse(solicitudAudit[0].snapshot_json) : solicitudAudit[0]?.snapshot_json;
      const docsActuales = this.normalizarEvidenciaConvalidacion(evidencia);
      if (!snapshot || JSON.stringify(this.normalizarEvidenciaConvalidacion(snapshot.documentacion || [])) !== JSON.stringify(docsActuales) ||
          Number(snapshot.estudianteId) !== solicitud.estudianteId || Number(snapshot.carreraId) !== solicitud.carreraId ||
          Number(snapshot.planDestinoId) !== solicitud.planDestinoId || Number(snapshot.planAsignaturaDestinoId) !== solicitud.planAsignaturaDestinoId) {
        throw new ConflictException('La evidencia o el alcance de la solicitud difieren de la auditoría original.');
      }

      const evidenciaAudit: any[] = await manager.query(
        `SELECT usuario_id, rol_activo, permiso, motivo, snapshot_json, created_at
         FROM auditoria_convalidaciones_externas WHERE convalidacion_id = ? AND accion = 'EVIDENCIA_VERIFICADA'
         ORDER BY id DESC LIMIT 1 FOR UPDATE`, [id],
      );
      const revision = typeof evidenciaAudit[0]?.snapshot_json === 'string'
        ? JSON.parse(evidenciaAudit[0].snapshot_json) : evidenciaAudit[0]?.snapshot_json;
      if (!revision || Number(evidenciaAudit[0].usuario_id) !== usuarioId || evidenciaAudit[0].rol_activo !== rolActivo ||
          evidenciaAudit[0].permiso !== PermisoSistema.PLANES_ESTUDIO_GESTIONAR ||
          revision.confirmacion !== 'CONFIRMO_REVISION_DOCUMENTAL' || revision.revisionHumanaDeclarada !== true ||
          JSON.stringify(this.normalizarEvidenciaConvalidacion(revision.documentos || [])) !== JSON.stringify(docsActuales) ||
          JSON.stringify((revision.hashesVerificados || []).slice().sort()) !== JSON.stringify(docsActuales.map((doc) => doc.sha256).sort())) {
        throw new ConflictException('La autoridad debe verificar previamente cada documento de esta solicitud antes de decidir.');
      }

      solicitud.estado = dto.decision;
      solicitud.revisadaPorUsuarioId = usuarioId;
      solicitud.rolRevisor = rolActivo as RolSistema;
      solicitud.permisoRevisor = PermisoSistema.PLANES_ESTUDIO_GESTIONAR;
      solicitud.fechaRevision = new Date();
      solicitud.motivoDecision = motivo;
      await repo.save(solicitud);
      await manager.query(
        `INSERT INTO auditoria_convalidaciones_externas (convalidacion_id, accion, usuario_id, rol_activo, permiso, motivo, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(6))`,
        [id, dto.decision, usuarioId, rolActivo, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, motivo,
          JSON.stringify({ solicitudId: id, estudianteId: solicitud.estudianteId, carreraId: solicitud.carreraId,
            planDestinoId: solicitud.planDestinoId, planAsignaturaDestinoId: solicitud.planAsignaturaDestinoId,
            evidencia: docsActuales, creditosOrigen: solicitud.creditosOrigen, autorizacionVerificada: true,
            evidenciaVerificadaPorUsuarioId: usuarioId, evidenciaVerificadaAt: evidenciaAudit[0].created_at,
            evidenciaRevisionMotivo: evidenciaAudit[0].motivo })],
      );
      return solicitud;
    });
  }

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

  private async bloquearYValidarContextoTransicion(
    manager: EntityManager,
    usuarioId: number,
    dto: EjecutarTransicionDto,
  ): Promise<void> {
    const rolActivo = rolActivoDePeticion(usuarioId);
    if (!rolActivo) throw new ForbiddenException('La transición requiere un rol activo vigente.');

    const usuario = await manager.getRepository(Usuario).findOne({
      where: { id: usuarioId, activo: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!usuario) throw new ForbiddenException('El usuario responsable no está activo.');

    const rolesActivos: Array<{ nombre: string }> = await manager.query(
      `SELECT r.nombre
       FROM usuario_roles ur
       INNER JOIN roles r ON r.id = ur.rol_id
       WHERE ur.usuario_id = ? AND r.activo = 1
       ORDER BY r.id
       FOR UPDATE`,
      [usuarioId],
    );
    if (!rolesActivos.some((rol) => rol.nombre === rolActivo)) {
      throw new ForbiddenException('El rol activo ya no está autorizado para este usuario.');
    }

    if (rolActivo === RolSistema.COORDINADOR) {
      const permisos: Array<{ id: number }> = await manager.query(
        `SELECT id FROM permisos_carrera
         WHERE usuario_id = ? AND carrera_id = ? AND permiso = ? AND activo = 1
         FOR UPDATE`,
        [usuarioId, dto.carreraId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR],
      );
      if (!permisos.length || !this.alcance ||
          !(await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, dto.carreraId))) {
        throw new ForbiddenException('El permiso vigente para gestionar esta carrera es obligatorio.');
      }
    } else if (rolActivo !== RolSistema.ADMIN_GLOBAL) {
      throw new ForbiddenException('El rol activo no puede ejecutar transiciones curriculares.');
    }

    const carrera = await manager.getRepository(Carrera).findOne({
      where: { id: dto.carreraId, activo: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!carrera) throw new NotFoundException('La carrera no existe o está inactiva.');

    const planes = new Map<number, PlanEstudio>();
    for (const id of [dto.planOrigenId, dto.planDestinoId].sort((a, b) => a - b)) {
      const plan = await manager.getRepository(PlanEstudio).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan) throw new NotFoundException(`No se encontró el plan #${id}.`);
      planes.set(id, plan);
    }
    const origen = planes.get(dto.planOrigenId)!;
    const destino = planes.get(dto.planDestinoId)!;
    if (origen.carreraId !== dto.carreraId || destino.carreraId !== dto.carreraId) {
      throw new BadRequestException('Los planes deben pertenecer a la carrera indicada.');
    }
    if (origen.estado === EstadoPlanEstudio.BORRADOR) {
      throw new BadRequestException('No se pueden trasladar estudiantes desde un borrador curricular.');
    }
    if (!destino.activo || destino.estado !== EstadoPlanEstudio.VIGENTE) {
      throw new BadRequestException('El plan destino debe estar activo y vigente.');
    }
  }

  private validarEquivalenciasCurriculares(
    equivalencias: EquivalenciaPlan[],
    carreraId: number,
    asignaturasOrigen: PlanAsignatura[],
    asignaturasDestino: PlanAsignatura[],
  ): { validas: EquivalenciaPlan[]; errores: string[] } {
    const origenes = new Map(asignaturasOrigen.map((asignatura) => [asignatura.id, asignatura]));
    const destinos = new Map(asignaturasDestino.map((asignatura) => [asignatura.id, asignatura]));
    const errores = new Set<string>();
    const baseValidas: EquivalenciaPlan[] = [];
    for (const equivalencia of equivalencias) {
      const origen = origenes.get(equivalencia.asignaturaOrigenId);
      const destino = destinos.get(equivalencia.asignaturaDestinoId);
      if (equivalencia.carreraOrigenId !== carreraId || equivalencia.carreraDestinoId !== carreraId ||
          equivalencia.autorizadoPorUsuarioId == null || !origen || !destino || destino.activo === false) {
        errores.add(`La equivalencia #${equivalencia.id} no está aprobada o no pertenece a los planes y carrera seleccionados.`);
      } else baseValidas.push(equivalencia);
    }

    const gruposN1 = new Map<string, Array<{ eq: EquivalenciaPlan; match: RegExpMatchArray }>>();
    const grupos1N = new Map<string, Array<{ eq: EquivalenciaPlan; match: RegExpMatchArray }>>();
    const invalidas = new Set<number>();
    for (const eq of baseValidas) {
      const texto = eq.justificacion || '';
      if (texto.includes('[COMPUESTA_N1:')) {
        const match = texto.match(/\[COMPUESTA_N1:([^:]+):(\d+):(\d+):(\[[^\]]+\])\]/);
        if (!match) {
          errores.add(`La equivalencia compuesta N:1 #${eq.id} tiene una definición inválida.`);
          invalidas.add(eq.id);
        } else gruposN1.set(match[1], [...(gruposN1.get(match[1]) || []), { eq, match }]);
      } else if (texto.includes('[COMPUESTA_1N:')) {
        const match = texto.match(/\[COMPUESTA_1N:([^:]+):(\d+):(\d+):(\[[^\]]+\])\]/);
        if (!match) {
          errores.add(`La equivalencia compuesta 1:N #${eq.id} tiene una definición inválida.`);
          invalidas.add(eq.id);
        } else grupos1N.set(match[1], [...(grupos1N.get(match[1]) || []), { eq, match }]);
      }
    }

    const validarGrupo = (grupo: Array<{ eq: EquivalenciaPlan; match: RegExpMatchArray }>, tipo: 'N1' | '1N') => {
      const etiqueta = grupo[0]?.match[0] || tipo;
      let declarados: number[] = [];
      try { declarados = JSON.parse(grupo[0]?.match[4] || 'null'); } catch { /* Se marca inválido abajo. */ }
      const total = Number(grupo[0]?.match[3]);
      const indices = new Set(grupo.map(({ match }) => Number(match[2])));
      const actual = new Set(grupo.map(({ eq }) => tipo === 'N1' ? eq.asignaturaOrigenId : eq.asignaturaDestinoId));
      const authorizers = new Set(grupo.map(({ eq }) => eq.autorizadoPorUsuarioId));
      const idsDeclaradosValidos = Array.isArray(declarados) && declarados.length >= 2 &&
        declarados.length === total && new Set(declarados).size === total &&
        declarados.every((id) => Number.isSafeInteger(id) && id > 0);
      const ramasValidas = grupo.length === total && actual.size === total && indices.size === total &&
        declarados.every((id) => actual.has(id)) &&
        grupo.every(({ eq, match }) => match[1] === grupo[0].match[1] && Number(match[3]) === total &&
          Number(match[2]) >= 1 && Number(match[2]) <= total && match[4] === grupo[0].match[4] &&
          authorizers.has(eq.autorizadoPorUsuarioId));
      const mismaRelacion = tipo === 'N1'
        ? new Set(grupo.map(({ eq }) => eq.asignaturaDestinoId)).size === 1
        : new Set(grupo.map(({ eq }) => eq.asignaturaOrigenId)).size === 1;
      if (!idsDeclaradosValidos || !ramasValidas || !mismaRelacion || authorizers.size !== 1) {
        errores.add(`La equivalencia compuesta ${tipo === 'N1' ? 'N:1' : '1:N'} ${etiqueta} está incompleta o es inconsistente.`);
        grupo.forEach(({ eq }) => invalidas.add(eq.id));
      }
    };
    for (const grupo of gruposN1.values()) validarGrupo(grupo, 'N1');
    for (const grupo of grupos1N.values()) validarGrupo(grupo, '1N');

    const simples = baseValidas.filter((eq) =>
      !eq.justificacion?.includes('[COMPUESTA_N1:') && !eq.justificacion?.includes('[COMPUESTA_1N:'));
    const origenesSimples = new Set<number>();
    const destinosSimples = new Set<number>();
    for (const eq of simples) {
      if (origenesSimples.has(eq.asignaturaOrigenId) || destinosSimples.has(eq.asignaturaDestinoId)) {
        errores.add('Hay equivalencias simples duplicadas o ambiguas; se requiere una regla compuesta aprobada.');
        invalidas.add(eq.id);
        for (const otra of simples) {
          if (otra.asignaturaOrigenId === eq.asignaturaOrigenId || otra.asignaturaDestinoId === eq.asignaturaDestinoId) {
            invalidas.add(otra.id);
          }
        }
      }
      origenesSimples.add(eq.asignaturaOrigenId);
      destinosSimples.add(eq.asignaturaDestinoId);
    }
    return { validas: baseValidas.filter((eq) => !invalidas.has(eq.id)), errores: [...errores] };
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
    return this.simularTransicionInterna(usuarioId, dto);
  }

  private async simularTransicionInterna(
    usuarioId: number,
    dto: SimularTransicionDto,
    manager?: EntityManager,
  ): Promise<{
    carreraId: number;
    planOrigenId: number;
    planDestinoId: number;
    totalAnalizados: number;
    totalMigrables: number;
    totalConflictos: number;
    estudiantes: ResultadoSimulacionEstudiante[];
  }> {
    if (!manager) await this.validarLecturaCarrera(usuarioId, dto.carreraId);
    if (dto.estudianteIds && dto.estudianteIds.length === 0) {
      throw new BadRequestException('Seleccione al menos un estudiante para la simulación individual.');
    }

    if (dto.planOrigenId === dto.planDestinoId) {
      throw new BadRequestException('El plan de origen y destino no pueden ser el mismo.');
    }

    const planRepo = manager?.getRepository(PlanEstudio) ?? this.planRepo;
    const planAsignaturaRepo = manager?.getRepository(PlanAsignatura) ?? this.planAsignaturaRepo;
    const estudianteRepo = manager?.getRepository(Estudiante) ?? this.estudianteRepo;
    const historialRepo = manager?.getRepository(HistorialAcademicoEstudiante) ?? this.historialRepo;
    const equivalenciaRepo = manager?.getRepository(EquivalenciaPlan) ?? this.equivalenciaRepo;
    const reglaOptativaRepo = manager?.getRepository(ReglaOptativaPlan) ?? this.reglaOptativaRepo;
    const bloqueo = manager ? { lock: { mode: 'pessimistic_write' as const } } : {};

    const [planOrigen, planDestino] = await Promise.all([
      planRepo.findOne({ where: { id: dto.planOrigenId, carreraId: dto.carreraId }, ...bloqueo }),
      planRepo.findOne({ where: { id: dto.planDestinoId, carreraId: dto.carreraId }, ...bloqueo }),
    ]);

    if (!planOrigen || !planDestino) {
      throw new NotFoundException('Plan de origen o destino no encontrado en la carrera indicada.');
    }

    // 1. Obtener equivalencias oficiales activas entre ambos planes
    const equivalencias = await equivalenciaRepo.find({
      where: { planOrigenId: dto.planOrigenId, planDestinoId: dto.planDestinoId, activo: true },
      relations: { asignaturaOrigen: { curso: true }, asignaturaDestino: { curso: true } },
      ...bloqueo,
    });

    // 2. Obtener asignaturas del plan origen y destino
    const [asignaturasOrigen, asignaturasDestino] = await Promise.all([
      planAsignaturaRepo.find({ where: { planEstudioId: dto.planOrigenId }, relations: { curso: true }, ...bloqueo }),
      planAsignaturaRepo.find({ where: { planEstudioId: dto.planDestinoId }, relations: { curso: true }, ...bloqueo }),
    ]);
    const reglaOptativaDestino = await reglaOptativaRepo.findOne({
      where: { planEstudioId: dto.planDestinoId },
      ...bloqueo,
    });

    const mapaAsigDestino = new Map(asignaturasDestino.map((a) => [a.id, a]));
    const mapaAsigOrigen = new Map(asignaturasOrigen.map((a) => [a.id, a]));
    const { validas: equivalenciasValidas, errores: erroresConfiguracionEquivalencias } =
      this.validarEquivalenciasCurriculares(equivalencias, dto.carreraId, asignaturasOrigen, asignaturasDestino);

    // 3. Estudiantes a simular
    let estudiantes: Estudiante[] = [];
    if (dto.estudianteIds && dto.estudianteIds.length > 0) {
      const encontrados = await estudianteRepo.find({
        where: {
          id: In(dto.estudianteIds),
          carreraId: dto.carreraId,
          planEstudioId: dto.planOrigenId,
        },
        ...bloqueo,
      });
      estudiantes = Array.isArray(encontrados) ? encontrados : [];
    } else {
      const encontrados = await estudianteRepo.createQueryBuilder('e')
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
      const historiales = await historialRepo.find({
        where: { estudianteId: est.id, resultado: ResultadoAcademico.APROBADO },
        relations: { planAsignatura: { curso: true } },
        ...bloqueo,
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
        tipoDestino?: TipoPlanAsignatura;
        codigo: string;
        nombre: string;
        creditos: number;
        tipoEquivalencia: string;
        historialOrigenId?: number;
        cursoOptativoId?: number;
        tipoOptativaReal?: TipoOptativa;
        codigoOptativaReal?: string | null;
        nombreOptativaReal?: string | null;
        creditosOptativaReal?: number | null;
        historialOrigenIds?: number[];
        asignaturasOrigenIds?: number[];
        equivalenciaIds?: number[];
        creditosOrigen?: number;
        convalidacionExternaId?: number;
        institucionOrigen?: string;
        asignaturaOrigen?: string;
        identificacionAsignatura?: string;
        documentacionOrigen?: Array<{ nombre: string; referencia: string; sha256: string }>;
      }>();
      const origenConEquivalenciaIds = new Set<number>();
      const conflictos: string[] = [];
      const observacionesAcademicas: string[] = [];
      conflictos.push(...erroresConfiguracionEquivalencias);

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
      for (const eq of equivalenciasValidas) {
        if (eq.justificacion && eq.justificacion.includes('[COMPUESTA_N1:')) {
          const match = eq.justificacion.match(/\[COMPUESTA_N1:([^:]+):/);
          const grp = match ? match[1] : 'default';
          const list = gruposCompuestosN1.get(grp) || [];
          list.push(eq);
          gruposCompuestosN1.set(grp, list);
        }
      }

      // 1. Evaluar equivalencias simples
      for (const eq of equivalenciasValidas) {
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
              tipoDestino: dest.tipo,
              codigo: dest.curso?.codigo || dest.codigoReferencia || '—',
              nombre: dest.curso?.nombre || dest.nombreReferencia || '—',
              creditos: Number(dest.creditos) || 0,
              tipoEquivalencia: eq.justificacion?.includes('[COMPUESTA_1N:') ? '1_A_N' : '1_A_1',
              historialOrigenIds: historialesValidos.filter((h) => h.planAsignaturaId === eq.asignaturaOrigenId ||
                (eq.asignaturaOrigen?.cursoId != null && h.planAsignatura?.cursoId === eq.asignaturaOrigen.cursoId))
                .map((h) => h.id).filter((id): id is number => Number.isSafeInteger(id)),
              asignaturasOrigenIds: [eq.asignaturaOrigenId],
              equivalenciaIds: [eq.id],
              creditosOrigen: Number(mapaAsigOrigen.get(eq.asignaturaOrigenId)?.creditos) || 0,
            });
          }
        }
      }

      // 2. Evaluar equivalencias compuestas N:1
      for (const [_grp, listaEq] of gruposCompuestosN1.entries()) {
        const etiquetas = listaEq.map((eq) => eq.justificacion?.match(
          /\[COMPUESTA_N1:([^:]+):(\d+):(\d+):(\[[^\]]+\])\]/,
        ));
        let idsDeclarados: number[] = [];
        try {
          idsDeclarados = JSON.parse(etiquetas[0]?.[4] || 'null');
        } catch {
          // La configuración inválida se bloquea abajo.
        }
        const totalDeclarado = Number(etiquetas[0]?.[3]);
        const indices = new Set(etiquetas.map((etiqueta) => Number(etiqueta?.[2])));
        const idsActivos = new Set(listaEq.map((eq) => eq.asignaturaOrigenId));
        const grupoIntegro = Array.isArray(idsDeclarados) && idsDeclarados.length >= 2 &&
          idsDeclarados.length === totalDeclarado && listaEq.length === totalDeclarado &&
          idsActivos.size === totalDeclarado && indices.size === totalDeclarado &&
          idsDeclarados.every((id) => Number.isSafeInteger(id) && id > 0 && idsActivos.has(id)) &&
          etiquetas.every((etiqueta, indice) => etiqueta && etiqueta[1] === _grp &&
            Number(etiqueta[3]) === totalDeclarado &&
            Number(etiqueta[2]) >= 1 && Number(etiqueta[2]) <= totalDeclarado &&
            etiqueta[4] === etiquetas[0]?.[4] &&
            listaEq[indice].asignaturaDestinoId === listaEq[0].asignaturaDestinoId);
        if (!grupoIntegro) {
          conflictos.push('La equivalencia compuesta N:1 está incompleta o es inconsistente.');
          continue;
        }
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
              tipoDestino: dest.tipo,
              codigo: dest.curso?.codigo || dest.codigoReferencia || '—',
              nombre: dest.curso?.nombre || dest.nombreReferencia || '—',
              creditos: Number(dest.creditos) || 0,
              tipoEquivalencia: 'N_A_1',
              historialOrigenIds: historialesValidos.filter((h) => requeridas.includes(h.planAsignaturaId))
                .map((h) => h.id).filter((id): id is number => Number.isSafeInteger(id)),
              asignaturasOrigenIds: requeridas,
              equivalenciaIds: listaEq.map((equivalencia) => equivalencia.id),
              creditosOrigen: requeridas.reduce((total, id) => total + (Number(mapaAsigOrigen.get(id)?.creditos) || 0), 0),
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
      const convalidacionRepo = manager?.getRepository(ConvalidacionExterna) ?? this.convalidacionExternaRepo;
      const externasDelPlan = convalidacionRepo ? await convalidacionRepo.find({
        where: { estudianteId: est.id, carreraId: dto.carreraId, planDestinoId: dto.planDestinoId,
        },
        relations: { asignaturaDestino: { curso: true } },
        ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      }) : [];
      const externasAprobadas = externasDelPlan.filter((x) => x.estado === EstadoConvalidacionExterna.APROBADA);
      for (const externa of externasDelPlan.filter((x) => x.estado !== EstadoConvalidacionExterna.APROBADA)) {
        observacionesAcademicas.push(`La convalidación externa #${externa.id} está ${externa.estado}; no genera reconocimiento académico.`);
      }
      const destinosExternos = new Set<number>();
      for (const externa of externasAprobadas) {
        const destino = mapaAsigDestino.get(externa.planAsignaturaDestinoId);
        const reviewAudit: any[] = manager ? await manager.query(
          `SELECT id, usuario_id, rol_activo, permiso, snapshot_json
           FROM auditoria_convalidaciones_externas WHERE convalidacion_id = ? AND accion = 'APROBADA'
           ORDER BY id DESC LIMIT 1 FOR UPDATE`, [externa.id],
        ) : this.dataSource ? await this.dataSource.query(
          `SELECT id, usuario_id, rol_activo, permiso, snapshot_json
           FROM auditoria_convalidaciones_externas WHERE convalidacion_id = ? AND accion = 'APROBADA'
           ORDER BY id DESC LIMIT 1`, [externa.id],
        ) : [];
        const audit = reviewAudit[0];
        let auditSnapshot: any;
        try { auditSnapshot = typeof audit?.snapshot_json === 'string' ? JSON.parse(audit.snapshot_json) : audit?.snapshot_json; } catch { auditSnapshot = null; }
        const decisionValida = Number.isSafeInteger(Number(externa.revisadaPorUsuarioId)) &&
          externa.fechaRevision != null && Boolean(externa.motivoDecision?.trim()) &&
          [RolSistema.COORDINADOR, RolSistema.ADMIN_GLOBAL].includes(externa.rolRevisor as RolSistema) &&
          externa.permisoRevisor === PermisoSistema.PLANES_ESTUDIO_GESTIONAR && audit &&
          Number(audit.usuario_id) === Number(externa.revisadaPorUsuarioId) &&
          audit.rol_activo === externa.rolRevisor && audit.permiso === externa.permisoRevisor &&
          Number(auditSnapshot?.carreraId) === dto.carreraId && auditSnapshot?.autorizacionVerificada === true;
        if (!decisionValida || !destino || externa.planAsignaturaDestinoId !== destino.id || destino.activo === false) {
          conflictos.push(`La convalidación externa #${externa.id} no tiene una aprobación autorizada y trazable para el plan destino.`);
          continue;
        }
        if (destinosExternos.has(destino.id) || reconocidasMap.has(destino.id)) {
          conflictos.push(`Hay más de un antecedente que pretende reconocer la asignatura destino #${destino.id}; se bloquea para evitar créditos duplicados.`);
          continue;
        }
        if (historialesValidos.some((h) => h.planAsignaturaId === destino.id && h.resultado === ResultadoAcademico.APROBADO)) {
          conflictos.push(`La asignatura destino #${destino.id} ya figura aprobada en el historial; no se duplica el reconocimiento externo.`);
          continue;
        }
        destinosExternos.add(destino.id);
        reconocidasMap.set(destino.id, {
          asignaturaDestinoId: destino.id, tipoDestino: destino.tipo,
          codigo: destino.curso?.codigo || destino.codigoReferencia || '—',
          nombre: destino.curso?.nombre || destino.nombreReferencia || '—',
          creditos: Number(destino.creditos) || 0, tipoEquivalencia: 'CONVALIDACION_EXTERNA',
          equivalenciaIds: [], historialOrigenIds: [], asignaturasOrigenIds: [],
          creditosOrigen: Number(externa.creditosOrigen) || 0,
          convalidacionExternaId: externa.id, institucionOrigen: externa.institucionOrigen,
          asignaturaOrigen: externa.asignaturaOrigen, identificacionAsignatura: externa.identificacionAsignatura,
          documentacionOrigen: externa.documentacion,
        });
      }

      const optativasOrigen = historiales.filter((h) =>
        h.planAsignatura?.tipo === TipoPlanAsignatura.OPTATIVA && h.cursoOptativoId != null &&
        (h.planEstudioContextoId ?? h.planAsignatura?.planEstudioId ?? dto.planOrigenId) === dto.planOrigenId);
      const optativasPreviasDestino = historiales.filter((h) =>
        h.cursoOptativoId != null && h.planEstudioContextoId === dto.planDestinoId &&
        h.reconocimientoOptativo === 'RECONOCIDO');
      const cursosOptativosUsados = new Set(optativasPreviasDestino.map((h) => h.cursoOptativoId));
      const espaciosUsados = new Set(optativasPreviasDestino.map((h) => h.planAsignaturaId));
      const conteoTipo = new Map<TipoOptativa, number>();
      for (const h of optativasPreviasDestino) {
        if (h.tipoOptativaReal) conteoTipo.set(h.tipoOptativaReal, (conteoTipo.get(h.tipoOptativaReal) || 0) + 1);
      }
      for (const h of optativasOrigen.sort((a, b) => a.id - b.id)) {
        const tipo = h.tipoOptativaReal;
        if (h.reconocimientoOptativo !== 'RECONOCIDO' || !tipo || !Object.values(TipoOptativa).includes(tipo)
          || !h.cursoOptativoId || !Number.isSafeInteger(h.id)) {
          conflictos.push('Las optativas reales aprobadas requieren una decisión de reconocimiento en el plan de destino.');
          continue;
        }
        if (cursosOptativosUsados.has(h.cursoOptativoId)) {
          observacionesAcademicas.push(`La optativa real #${h.cursoOptativoId} ya tiene reconocimiento en el plan destino; no se duplican créditos.`);
          continue;
        }
        if (!reglaOptativaDestino) {
          conflictos.push('El plan destino carece de reglas de distribución de optativas para reconocer asignaturas aprobadas.');
          continue;
        }
        const limite = tipo === TipoOptativa.DISCIPLINARIA ? reglaOptativaDestino.cantidadDisciplinarias
          : tipo === TipoOptativa.ABIERTA ? reglaOptativaDestino.cantidadAbiertas
            : reglaOptativaDestino.cantidadSede;
        const usados = conteoTipo.get(tipo) || 0;
        const espacio = asignaturasDestino.find((destino) => destino.tipo === TipoPlanAsignatura.OPTATIVA &&
          destino.tipoOptativa === tipo && destino.activo !== false && !espaciosUsados.has(destino.id) &&
          !reconocidasMap.has(destino.id));
        if (!espacio || usados >= Number(limite)) {
          observacionesAcademicas.push(`La optativa real #${h.cursoOptativoId} permanece aprobada en el historial, sin espacio disponible de categoría ${tipo} en el plan destino.`);
          continue;
        }
        cursosOptativosUsados.add(h.cursoOptativoId);
        espaciosUsados.add(espacio.id);
        conteoTipo.set(tipo, usados + 1);
        origenConEquivalenciaIds.add(h.planAsignaturaId);
        reconocidasMap.set(espacio.id, {
          asignaturaDestinoId: espacio.id,
          tipoDestino: espacio.tipo,
          codigo: espacio.curso?.codigo || espacio.codigoReferencia || '—',
          nombre: espacio.curso?.nombre || espacio.nombreReferencia || '—',
          creditos: Number(espacio.creditos) || 0,
          tipoEquivalencia: 'OPTATIVA', historialOrigenId: h.id,
          historialOrigenIds: [h.id], asignaturasOrigenIds: [h.planAsignaturaId], equivalenciaIds: [],
          creditosOrigen: Number(h.creditosOptativaReal ?? h.planAsignatura?.creditos) || 0,
          cursoOptativoId: h.cursoOptativoId, tipoOptativaReal: tipo,
          codigoOptativaReal: h.codigoOptativaReal,
          nombreOptativaReal: h.nombreOptativaReal,
          creditosOptativaReal: h.creditosOptativaReal,
        });
      }

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
    if (new Set(dto.estudianteIds).size !== dto.estudianteIds.length) {
      throw new BadRequestException('La selección contiene estudiantes duplicados.');
    }
    if (!dto.motivo?.trim()) throw new BadRequestException('El motivo institucional es obligatorio.');
    const fallidos: Array<{ estudianteId: number; error: string }> = [];
    let migrados = 0;

    for (const estId of dto.estudianteIds) {
      try {
        if (!this.dataSource) {
          throw new Error('Servicio de persistencia no disponible.');
        }

        await this.dataSource.transaction(async (manager) => {
          const estRepo = manager.getRepository(Estudiante);
          const histRepo = manager.getRepository(HistorialAcademicoEstudiante);

          await this.bloquearYValidarContextoTransicion(manager, usuarioId, dto);

          const estudiante = await estRepo.findOne({
            where: { id: estId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!estudiante) throw new NotFoundException(`No se encontró el estudiante #${estId}.`);
          if (estudiante.planEstudioId !== dto.planOrigenId) {
            throw new BadRequestException(`El estudiante #${estId} no pertenece al plan de origen #${dto.planOrigenId}.`);
          }
          if (estudiante.carreraId !== dto.carreraId) {
            throw new BadRequestException(`Incompatibilidad de carrera del estudiante #${estId}.`);
          }
          if ([EstadoEstudiante.RETIRADO, EstadoEstudiante.GRADUADO].includes(estudiante.estado)) {
            throw new BadRequestException(`El estudiante #${estId} no es migrable por su estado ${estudiante.estado}.`);
          }

          const revalidacion = await this.simularTransicionInterna(usuarioId, {
            carreraId: dto.carreraId,
            planOrigenId: dto.planOrigenId,
            planDestinoId: dto.planDestinoId,
            estudianteIds: [estId],
          }, manager);
          const sim = revalidacion.estudiantes.find((item) => item.estudianteId === estId);
          if (!sim || !sim.puedeMigrar) {
            throw new BadRequestException(sim?.conflictos.join('; ') ||
              'No se pudo revalidar el expediente dentro de la transacción.');
          }

          // 1. Actualizar plan del estudiante
          estudiante.planEstudioId = dto.planDestinoId;
          await estRepo.save(estudiante);

          // 2. Registrar en historial de cambios de plan
          const resultadoHistorialPlan: any = await manager.query(
            `INSERT INTO historial_planes_estudiantes (estudiante_id, plan_anterior_id, plan_nuevo_id, periodo_cambio_id, motivo, cambiado_por_usuario_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [estId, dto.planOrigenId, dto.planDestinoId, estudiante.periodoIngresoId || 1, dto.motivo.trim(), usuarioId],
          );
          const historialPlanCambioId = Number(resultadoHistorialPlan?.insertId ?? resultadoHistorialPlan?.[0]?.insertId);
          const historialDestinoIds: number[] = [];

          // 3. Registrar materias reconocidas por convalidación institucional uniforme
          for (const rec of sim.asignaturasReconocidas) {
            const yaExiste = await histRepo.findOne({
              where: {
                estudianteId: estId,
                planAsignaturaId: rec.asignaturaDestinoId,
                resultado: ResultadoAcademico.APROBADO,
              },
              lock: { mode: 'pessimistic_write' },
            });

            if (!yaExiste) {
              const esOptativa = rec.tipoDestino === TipoPlanAsignatura.OPTATIVA;
              if (esOptativa && (!rec.cursoOptativoId || !rec.tipoOptativaReal || rec.historialOrigenId == null)) {
                throw new BadRequestException('La optativa aprobada no tiene una decisión curricular trazable.');
              }
              const nuevoHistorial = histRepo.create({
                estudianteId: estId,
                planAsignaturaId: rec.asignaturaDestinoId,
                planEstudioContextoId: dto.planDestinoId,
                cursoOptativoId: esOptativa ? rec.cursoOptativoId! : null,
                codigoOptativaReal: esOptativa ? rec.codigoOptativaReal ?? null : null,
                nombreOptativaReal: esOptativa ? rec.nombreOptativaReal ?? null : null,
                tipoOptativaReal: esOptativa ? rec.tipoOptativaReal! : null,
                creditosOptativaReal: esOptativa ? rec.creditosOptativaReal! : null,
                reconocimientoOptativo: esOptativa ? 'RECONOCIDO' : null,
                creditosReconocidos: esOptativa || rec.tipoEquivalencia === 'CONVALIDACION_EXTERNA'
                  ? rec.creditos : null,
                reconocidoPorUsuarioId: esOptativa ? usuarioId : null,
                fechaReconocimiento: esOptativa ? new Date() : null,
                resultado: ResultadoAcademico.APROBADO,
                origenAcademico: rec.tipoEquivalencia === 'CONVALIDACION_EXTERNA'
                  ? OrigenAcademico.RECONOCIMIENTO : OrigenAcademico.EQUIVALENCIA,
                fuenteRegistro: FuenteRegistroAcademico.MANUAL,
                observaciones: rec.tipoEquivalencia === 'CONVALIDACION_EXTERNA'
                  ? `Convalidacion externa aprobada #${rec.convalidacionExternaId}; institucion: ${rec.institucionOrigen}; asignatura: ${rec.asignaturaOrigen} (${rec.identificacionAsignatura}); creditos de origen: ${rec.creditosOrigen}; evidencia: ${(rec.documentacionOrigen || []).map((d) => d.sha256).join(',')}.`
                  : `Reconocimiento por transicion curricular institucional (${rec.tipoEquivalencia}); origen ${(rec.asignaturasOrigenIds || []).join(',')}; equivalencias ${(rec.equivalenciaIds || []).join(',') || 'optativa'}.`,
                registradoPorUsuarioId: usuarioId,
              });
              const guardado = await histRepo.save(nuevoHistorial);
              if (Number.isSafeInteger(Number(guardado?.id))) historialDestinoIds.push(Number(guardado.id));
            }
          }

          await manager.query(
            `INSERT INTO auditoria_planes_estudio (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
             VALUES (?, 'TRANSICION_CURRICULAR', ?, ?, ?, ?, ?, NOW())`,
            [dto.planOrigenId, `Plan #${dto.planOrigenId}`, `Plan #${dto.planDestinoId}`,
              dto.motivo.trim(), usuarioId, JSON.stringify({
                estudianteId: estId, carreraId: dto.carreraId, planOrigenId: dto.planOrigenId,
                planDestinoId: dto.planDestinoId,
                historialPlanCambioId: Number.isSafeInteger(historialPlanCambioId) && historialPlanCambioId > 0
                  ? historialPlanCambioId : null,
                historialDestinoIds,
                reversable: Number.isSafeInteger(historialPlanCambioId) && historialPlanCambioId > 0,
                revalidacionEnTransaccion: true,
                reconocimientos: sim.asignaturasReconocidas.map((rec) => ({
                  asignaturaDestinoId: rec.asignaturaDestinoId,
                  creditosDestino: rec.creditos,
                  asignaturasOrigenIds: rec.asignaturasOrigenIds || [],
                  historialOrigenIds: rec.historialOrigenIds || [],
                  creditosOrigen: rec.creditosOrigen || 0,
                  equivalenciaIds: rec.equivalenciaIds || [],
                  tipoEquivalencia: rec.tipoEquivalencia,
                  cursoOptativoId: rec.cursoOptativoId ?? null,
                  tipoOptativaReal: rec.tipoOptativaReal ?? null,
                  creditosOptativaReal: rec.creditosOptativaReal ?? null,
                  convalidacionExternaId: rec.convalidacionExternaId ?? null,
                  institucionOrigen: rec.institucionOrigen ?? null,
                  asignaturaOrigenExterna: rec.asignaturaOrigen ?? null,
                  identificacionAsignaturaExterna: rec.identificacionAsignatura ?? null,
                  evidenciaExterna: rec.documentacionOrigen ?? [],
                })),
                aprobadasOrigenConservadas: sim.asignaturasSinEquivalencia.map((asignatura) => ({
                  asignaturaOrigenId: asignatura.asignaturaOrigenId,
                  creditosOriginales: asignatura.creditos,
                })),
              })],
          );
        });

        migrados++;
      } catch (err: any) {
        if (err instanceof ForbiddenException) throw err;
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

  /**
   * Revierte exactamente una transición de un estudiante. Solo el administrador global
   * puede autorizarla. Se eliminan únicamente las filas de reconocimiento creadas por
   * esa transición y su fila de cambio de plan; el historial académico previo queda intacto.
   */
  async revertirTransicion(usuarioId: number, auditoriaId: number, motivo: string) {
    if (!Number.isSafeInteger(auditoriaId) || auditoriaId <= 0) {
      throw new BadRequestException('El identificador de auditoría debe ser positivo.');
    }
    const justificacion = motivo?.trim();
    if (!justificacion || justificacion.length < 5 || justificacion.length > 500) {
      throw new BadRequestException('El motivo de reversión debe tener entre 5 y 500 caracteres.');
    }
    if (!this.dataSource) throw new NotFoundException('Servicio de persistencia no disponible.');

    return this.dataSource.transaction(async (manager) => {
      const rolActivo = rolActivoDePeticion(usuarioId);
      if (rolActivo !== RolSistema.ADMIN_GLOBAL) {
        throw new ForbiddenException('Solo un administrador global puede autorizar la reversión de una transición.');
      }
      const actor = await manager.getRepository(Usuario).findOne({
        where: { id: usuarioId, activo: true }, lock: { mode: 'pessimistic_write' },
      });
      const rolesActivos: Array<{ nombre: string }> = await manager.query(
        `SELECT r.nombre FROM usuario_roles ur INNER JOIN roles r ON r.id = ur.rol_id
         WHERE ur.usuario_id = ? AND r.activo = 1 ORDER BY r.id FOR UPDATE`, [usuarioId],
      );
      if (!actor || !rolesActivos.some((r) => r.nombre === RolSistema.ADMIN_GLOBAL)) {
        throw new ForbiddenException('La autoridad global del usuario responsable ya no está vigente.');
      }

      const rows: any[] = await manager.query(
        `SELECT id, plan_estudio_id, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at
         FROM auditoria_planes_estudio WHERE id = ? AND tipo_modificacion = 'TRANSICION_CURRICULAR' FOR UPDATE`,
        [auditoriaId],
      );
      const original = rows?.[0];
      if (!original) throw new NotFoundException('No existe la auditoría original de esa transición.');
      const meta = typeof original.metadata_json === 'string'
        ? JSON.parse(original.metadata_json) : original.metadata_json;
      if (!meta?.reversable || !Number.isSafeInteger(Number(meta.historialPlanCambioId)) ||
          !Array.isArray(meta.historialDestinoIds) || !Number.isSafeInteger(Number(meta.estudianteId)) ||
          !Number.isSafeInteger(Number(meta.planDestinoId)) || !Number.isSafeInteger(Number(meta.planOrigenId))) {
        throw new ConflictException('Esta transición no tiene trazabilidad suficiente para una reversión segura.');
      }

      const yaRevertida: any[] = await manager.query(
        `SELECT id FROM auditoria_planes_estudio
         WHERE tipo_modificacion = 'REVERSA_TRANSICION_CURRICULAR'
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.auditoriaOrigenId')) = ?
         LIMIT 1 FOR UPDATE`, [auditoriaId],
      );
      if (yaRevertida?.length) return { auditoriaId, revertida: true, idempotente: true };

      const estudianteId = Number(meta.estudianteId);
      const planOrigenId = Number(meta.planOrigenId);
      const planDestinoId = Number(meta.planDestinoId);
      const estudiante = await manager.getRepository(Estudiante).findOne({
        where: { id: estudianteId }, lock: { mode: 'pessimistic_write' },
      });
      if (!estudiante) throw new NotFoundException('No se encontró el estudiante de la transición.');
      if (estudiante.planEstudioId !== planDestinoId) {
        throw new ConflictException('El estudiante ya no está en el plan destino; la reversión requeriría otra operación curricular.');
      }

      const cambio: any[] = await manager.query(
        `SELECT id FROM historial_planes_estudiantes
         WHERE id = ? AND estudiante_id = ? AND plan_anterior_id = ? AND plan_nuevo_id = ? FOR UPDATE`,
        [Number(meta.historialPlanCambioId), estudianteId, planOrigenId, planDestinoId],
      );
      if (!cambio?.length) throw new ConflictException('No se encontró el cambio de plan exacto registrado por la transición.');
      const cambiosPosteriores: any[] = await manager.query(
        `SELECT id FROM historial_planes_estudiantes WHERE estudiante_id = ? AND id > ? LIMIT 1 FOR UPDATE`,
        [estudianteId, Number(meta.historialPlanCambioId)],
      );
      if (cambiosPosteriores?.length) throw new ConflictException('Hay cambios curriculares posteriores; no se puede revertir sin un nuevo trámite.');

      const ids: number[] = meta.historialDestinoIds.map(Number);
      if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
        throw new ConflictException('La auditoría contiene identificadores de reconocimiento inválidos.');
      }
      let reconocimientos: any[] = [];
      if (ids.length) {
        reconocimientos = await manager.query(
          `SELECT h.id, h.plan_asignatura_id, h.resultado, h.origen_academico, h.registrado_por_usuario_id, p.plan_estudio_id
           FROM historial_academico_estudiantes h
           INNER JOIN plan_asignaturas p ON p.id = h.plan_asignatura_id
           WHERE h.estudiante_id = ? AND h.id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`,
          [estudianteId, ...ids],
        );
        if (reconocimientos.length !== ids.length || reconocimientos.some((h) =>
          Number(h.plan_estudio_id) !== planDestinoId || h.resultado !== ResultadoAcademico.APROBADO ||
          ![OrigenAcademico.EQUIVALENCIA, OrigenAcademico.RECONOCIMIENTO].includes(h.origen_academico) ||
          Number(h.registrado_por_usuario_id) !== Number(original.usuario_id))) {
          throw new ConflictException('Los reconocimientos generados cambiaron; la reversión segura no es posible.');
        }
      }

      // Si existen calificaciones posteriores en el plan destino, no se toca el expediente.
      const asignaturasDestino = await manager.query('SELECT id FROM plan_asignaturas WHERE plan_estudio_id = ?', [planDestinoId]);
      const destinoIds = (asignaturasDestino || []).map((r: any) => Number(r.id));
      if (destinoIds.length) {
        const idsSql = ids.length ? `AND id NOT IN (${ids.map(() => '?').join(',')})` : '';
        const posteriores: any[] = await manager.query(
          `SELECT id FROM historial_academico_estudiantes WHERE estudiante_id = ?
           AND plan_asignatura_id IN (${destinoIds.map(() => '?').join(',')}) ${idsSql}
           AND resultado IS NOT NULL LIMIT 1 FOR UPDATE`, [estudianteId, ...destinoIds, ...ids],
        );
        if (posteriores?.length) throw new ConflictException('El estudiante tiene actividad académica en el plan destino; no se puede retirar su reconocimiento.');
      }

      const idsReconocidos = reconocimientos.map((r) => Number(r.id));
      if (idsReconocidos.length) {
        await manager.query(`DELETE FROM historial_academico_estudiantes WHERE estudiante_id = ? AND id IN (${idsReconocidos.map(() => '?').join(',')})`,
          [estudianteId, ...idsReconocidos]);
      }
      await manager.query('DELETE FROM historial_planes_estudiantes WHERE id = ?', [Number(meta.historialPlanCambioId)]);
      estudiante.planEstudioId = planOrigenId;
      await manager.getRepository(Estudiante).save(estudiante);
      await manager.query(
        `INSERT INTO auditoria_planes_estudio (plan_estudio_id, tipo_modificacion, valor_anterior, valor_nuevo, motivo, usuario_id, metadata_json, created_at)
         VALUES (?, 'REVERSA_TRANSICION_CURRICULAR', ?, ?, ?, ?, ?, NOW())`,
        [planOrigenId, `Plan #${planDestinoId}`, `Plan #${planOrigenId}`, justificacion, usuarioId,
          JSON.stringify({ auditoriaOrigenId: auditoriaId, estudianteId, planOrigenId, planDestinoId,
            historialPlanCambioId: Number(meta.historialPlanCambioId), historialDestinoIds: idsReconocidos,
            motivoOriginal: original.motivo, responsableOriginalId: Number(original.usuario_id),
            reconocimientosRetirados: reconocimientos.map((r) => ({ id: Number(r.id), planAsignaturaId: Number(r.plan_asignatura_id) })) })],
      );
      return { auditoriaId, estudianteId, revertida: true, idempotente: false };
    });
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
                   WHERE a.tipo_modificacion IN ('TRANSICION_CURRICULAR', 'REVERSA_TRANSICION_CURRICULAR')`;
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
