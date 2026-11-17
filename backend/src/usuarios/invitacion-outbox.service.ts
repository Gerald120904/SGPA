import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { DataSource, EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { InvitacionOutbox } from './entities/invitacion-outbox.entity';
import { Usuario } from './entities/usuario.entity';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';

const MAX_INTENTOS = 3;
const LEASE_MS = 2 * 60 * 1000;
const DURACION_MS = 48 * 60 * 60 * 1000;

export type ResultadoProcesamientoInvitacion =
  | 'ENVIADA' | 'INCIERTA' | 'FALLIDA' | 'OMITIDA' | 'PENDIENTE'
  | 'EN_PROCESO' | 'CADUCADA' | 'LIMITE_ALCANZADO';

@Injectable()
export class InvitacionOutboxService {
  private readonly logger = new Logger(InvitacionOutboxService.name);

  constructor(
    @InjectRepository(InvitacionOutbox)
    private readonly repositorio: Repository<InvitacionOutbox>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async verificarDestino(): Promise<void> {
    const permitidas = new Set(['sgpa', 'sgpa_test']);
    const opciones = this.dataSource.options;
    const dbConfigurada =
      typeof opciones?.database === 'string' ? opciones.database.trim() : '';
    if (
      !this.dataSource.isInitialized ||
      opciones?.type !== 'mysql' ||
      opciones.synchronize !== false ||
      !dbConfigurada ||
      !permitidas.has(dbConfigurada)
    ) {
      throw new ServiceUnavailableException(
        'Invitaciones habilitadas solo en sgpa y sgpa_test sin sincronización.',
      );
    }
    let filas: unknown;
    try {
      filas = await this.dataSource.query('SELECT DATABASE() AS db');
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar la base de datos para invitaciones.',
      );
    }
    const fila = Array.isArray(filas) ? filas[0] : undefined;
    const dbActiva =
      fila && typeof fila === 'object' && 'db' in fila &&
      typeof fila.db === 'string'
        ? fila.db.trim()
        : '';
    if (
      !dbActiva ||
      !permitidas.has(dbActiva) ||
      dbActiva !== dbConfigurada
    ) {
      throw new ServiceUnavailableException(
        'El destino de invitaciones no coincide con una base autorizada.',
      );
    }
  }

  private clave(): Buffer {
    const valor = process.env.SGPA_INVITATION_ENCRYPTION_KEY;
    if (!valor || !/^[a-fA-F0-9]{64}$/.test(valor)) {
      throw new ServiceUnavailableException(
        'Falta la clave de cifrado de invitaciones.',
      );
    }
    return Buffer.from(valor, 'hex');
  }

  private cifrar(enlace: string, usuarioId: number, tokenHash: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.clave(), iv);
    cipher.setAAD(Buffer.from(`${usuarioId}:${tokenHash}`));
    const texto = Buffer.concat([
      cipher.update(enlace, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), texto]).toString('base64');
  }

  private descifrar(entrada: InvitacionOutbox): string {
    const datos = Buffer.from(entrada.enlaceCifrado!, 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.clave(),
      datos.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(`${entrada.usuarioId}:${entrada.tokenHash}`));
    decipher.setAuthTag(datos.subarray(12, 28));
    return Buffer.concat([
      decipher.update(datos.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
  }

  async crearPendiente(
    manager: EntityManager,
    usuarioId: number,
    tokenHash: string,
    enlace: string,
    expiraEn: Date,
  ): Promise<void> {
    const repo = manager.getRepository(InvitacionOutbox);
    await repo.save(
      repo.create({
        usuarioId,
        tokenHash,
        enlaceCifrado: this.cifrar(enlace, usuarioId, tokenHash),
        estado: 'PENDIENTE',
        intentos: 0,
        leaseId: null,
        bloqueadoHasta: null,
        expiraEn,
        enviadoEn: null,
      }),
    );
  }

  async pendienteVigente(usuarioId: number): Promise<boolean> {
    const entrada = await this.repositorio.findOne({
      where: { usuarioId },
      relations: { usuario: true },
    });
    return !!entrada && entrada.estado === 'PENDIENTE' &&
      !!entrada.enlaceCifrado && entrada.expiraEn.getTime() > Date.now() &&
      !entrada.usuario.activo &&
      entrada.usuario.passwordResetTokenHash === entrada.tokenHash &&
      !!entrada.usuario.passwordResetExpiresAt &&
      entrada.usuario.passwordResetExpiresAt.getTime() > Date.now();
  }

  async procesarId(id: number): Promise<'ENVIADA' | 'OMITIDA' | 'INCIERTA' | 'FALLIDA'> {
    await this.verificarDestino();
    const lease = randomUUID();
    const claim = await this.repositorio
      .createQueryBuilder()
      .update(InvitacionOutbox)
      .set({
        estado: 'EN_PROCESO',
        leaseId: lease,
        bloqueadoHasta: new Date(Date.now() + LEASE_MS),
        intentos: () => 'intentos + 1',
      })
      .where(
        'id = :id AND estado = :estado AND expira_en > NOW(3) AND intentos < :max',
        { id, estado: 'PENDIENTE', max: MAX_INTENTOS },
      )
      .execute();
    if (claim.affected !== 1) return 'OMITIDA';

    const entrada = await this.repositorio.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!entrada || entrada.leaseId !== lease) return 'OMITIDA';
    if (
      entrada.usuario.activo ||
      entrada.usuario.passwordResetTokenHash !== entrada.tokenHash ||
      !entrada.usuario.passwordResetExpiresAt ||
      entrada.usuario.passwordResetExpiresAt.getTime() <= Date.now()
    ) {
      await this.repositorio.update(
        { id, leaseId: lease, estado: 'EN_PROCESO' },
        {
          estado: 'CADUCADA',
          enlaceCifrado: null,
          leaseId: null,
          bloqueadoHasta: null,
        },
      );
      return 'OMITIDA';
    }

    try {
      const enlace = this.descifrar(entrada);
      await this.mailService.enviarInvitacion(
        entrada.usuario.correo,
        entrada.usuario.nombres,
        enlace,
      );
      const completado = await this.repositorio.update(
        { id, leaseId: lease, estado: 'EN_PROCESO' },
        {
          estado: 'ENVIADA',
          enlaceCifrado: null,
          leaseId: null,
          bloqueadoHasta: null,
          enviadoEn: new Date(),
        },
      );
      return completado.affected === 1 ? 'ENVIADA' : 'INCIERTA';
    } catch (error) {
      const responseCode = (error as { responseCode?: unknown } | null)?.responseCode;
      const definitivo = (error as { definitive?: unknown } | null)?.definitive === true ||
        (typeof responseCode === 'number' && responseCode >= 400 && responseCode < 600);
      const estado = definitivo ? 'FALLIDA' : 'INCIERTA';
      await this.repositorio.update(
        { id, leaseId: lease, estado: 'EN_PROCESO' },
        {
          estado,
          enlaceCifrado: null,
          leaseId: null,
          bloqueadoHasta: null,
        },
      );
      const codigo = (error as { code?: unknown } | null)?.code;
      const codigoSeguro = typeof codigo === 'string'
        ? codigo.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
        : 'SMTP_ERROR';
      this.logger.warn(`Invitacion ${estado.toLowerCase()} para usuario ${entrada.usuarioId}; codigo=${codigoSeguro}.`);
      return estado;
    }
  }

  async procesarPendiente(usuarioId: number): Promise<ResultadoProcesamientoInvitacion> {
    await this.verificarDestino();
    const entrada = await this.repositorio.findOne({ where: { usuarioId } });
    if (!entrada) throw new BadRequestException('El usuario no tiene una invitación registrada.');
    if (entrada.estado !== 'PENDIENTE') return entrada.estado as ResultadoProcesamientoInvitacion;
    if (entrada.expiraEn.getTime() <= Date.now()) {
      const caducada = await this.repositorio.update(
        { id: entrada.id, estado: 'PENDIENTE', expiraEn: LessThanOrEqual(new Date()) },
        { estado: 'CADUCADA', enlaceCifrado: null, leaseId: null, bloqueadoHasta: null },
      );
      if (caducada.affected === 1) return 'CADUCADA';
      const actualizada = await this.repositorio.findOne({ where: { id: entrada.id } });
      return actualizada?.estado as ResultadoProcesamientoInvitacion || 'OMITIDA';
    }
    if (entrada.intentos >= MAX_INTENTOS) return 'LIMITE_ALCANZADO';
    const resultado = await this.procesarId(entrada.id);
    if (resultado !== 'OMITIDA') return resultado;
    const actual = await this.repositorio.findOne({ where: { id: entrada.id } });
    if (!actual) return 'OMITIDA';
    if (actual.estado === 'PENDIENTE' && actual.intentos >= MAX_INTENTOS) return 'LIMITE_ALCANZADO';
    return actual.estado as ResultadoProcesamientoInvitacion;
  }

  async procesarUsuario(
    usuarioId: number,
  ): Promise<'ENVIADA' | 'OMITIDA' | 'INCIERTA' | 'FALLIDA'> {
    const entrada = await this.repositorio.findOne({ where: { usuarioId } });
    return entrada ? this.procesarId(entrada.id) : 'OMITIDA';
  }

  @Interval(30_000)
  async procesarPendientes(): Promise<void> {
    if (process.env.SGPA_INVITATION_OUTBOX_ENABLED !== 'true') return;
    await this.verificarDestino();
    await this.repositorio
      .createQueryBuilder()
      .update(InvitacionOutbox)
      .set({
        estado: 'INCIERTA',
        enlaceCifrado: null,
        leaseId: null,
        bloqueadoHasta: null,
      })
      .where('estado = :estado AND bloqueado_hasta < NOW(3)', {
        estado: 'EN_PROCESO',
      })
      .execute();
    await this.repositorio
      .createQueryBuilder()
      .update(InvitacionOutbox)
      .set({ estado: 'CADUCADA', enlaceCifrado: null })
      .where('estado = :estado AND expira_en <= NOW(3)', {
        estado: 'PENDIENTE',
      })
      .execute();
    const pendientes = await this.repositorio.find({
      where: { estado: 'PENDIENTE' },
      order: { id: 'ASC' },
      take: 20,
    });
    for (const entrada of pendientes) await this.procesarId(entrada.id);
  }

  async rotarYReintentar(
    usuarioId: number,
    origen: URL,
    actorUsuarioId: number,
  ): Promise<'ENVIADA' | 'INCIERTA' | 'FALLIDA' | 'OMITIDA'> {
    await this.verificarDestino();
    const id = await this.dataSource.transaction(async (manager) => {
      const usuarios = manager.getRepository(Usuario);
      const repo = manager.getRepository(InvitacionOutbox);
      const usuario = await usuarios.findOne({
        where: { id: usuarioId },
        lock: { mode: 'pessimistic_write' },
      });
      const entrada = await repo.findOne({
        where: { usuarioId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!usuario || !entrada || usuario.activo)
        throw new BadRequestException('No hay invitación pendiente.');
      const estadoAnterior = entrada.estado;
      const intentosPrevios = entrada.intentos;
      const pendienteExpirada = entrada.estado === 'PENDIENTE' &&
        entrada.expiraEn.getTime() <= Date.now();
      if (entrada.estado === 'EN_PROCESO' ||
        (entrada.estado === 'PENDIENTE' && !pendienteExpirada)) {
        throw new ConflictException('La invitación está en procesamiento.');
      }
      if (
        entrada.estado === 'ENVIADA' &&
        entrada.expiraEn.getTime() > Date.now()
      ) {
        throw new ConflictException(
          'La invitación enviada todavía está vigente.',
        );
      }
      if (entrada.intentos >= MAX_INTENTOS) {
        throw new ConflictException(
          'Se alcanzó el límite de intentos de invitación.',
        );
      }
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiraEn = new Date(Date.now() + DURACION_MS);
      const enlace = new URL(origen.toString());
      enlace.hash = new URLSearchParams({
        correo: usuario.correo,
        token,
      }).toString();
      usuario.passwordResetTokenHash = tokenHash;
      usuario.passwordResetExpiresAt = expiraEn;
      await usuarios.save(usuario);
      entrada.tokenHash = tokenHash;
      entrada.enlaceCifrado = this.cifrar(
        enlace.toString(),
        usuarioId,
        tokenHash,
      );
      entrada.estado = 'PENDIENTE';
      entrada.leaseId = null;
      entrada.bloqueadoHasta = null;
      entrada.expiraEn = expiraEn;
      entrada.enviadoEn = null;
      await repo.save(entrada);
      await manager.getRepository(AuditoriaJerarquia).save({
        actorUsuarioId,
        objetivoUsuarioId: usuarioId,
        accion: 'ROTAR_INVITACION',
        detalle: { estadoAnterior, intentosPrevios },
      });
      return entrada.id;
    });
    return this.procesarId(id);
  }

  async obtenerEstado(usuarioId: number) {
    const entrada = await this.repositorio.findOne({ where: { usuarioId } });
    return entrada
      ? {
          estado: entrada.estado,
          intentos: entrada.intentos,
          expiraEn: entrada.expiraEn,
          enviadoEn: entrada.enviadoEn,
          puedeProcesar: entrada.estado === 'PENDIENTE' &&
            !!entrada.enlaceCifrado && entrada.expiraEn.getTime() > Date.now() &&
            entrada.intentos < MAX_INTENTOS,
        }
      : { estado: 'SIN_INVITACION' };
  }
}
