import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { MailService } from '../mail/mail.service';

type EstadoEnvio = 'ENTREGADO' | 'OMITIDO' | 'PENDIENTE' | 'FALLIDO' | 'INCIERTO';
type Entrada = {
  id: number; respuesta_id: number; destinatario: string | null; nombre_estudiante: string;
  titulo_formulario: string; carrera_nombre: string | null; motivo_rechazo: string;
  lease_id: string; intentos: number;
};

@Injectable()
export class CorreoRechazoOutboxService {
  private readonly logger = new Logger(CorreoRechazoOutboxService.name);
  private readonly maxIntentos = 5;

  constructor(private readonly dataSource: DataSource, private readonly mail: MailService) {}

  async crearPendiente(manager: EntityManager, datos: {
    respuestaId: number; destinatario: string | null; nombreEstudiante: string;
    tituloFormulario: string; carreraNombre: string | null; motivoRechazo: string;
  }): Promise<number> {
    const destino = datos.destinatario?.trim().toLowerCase() || null;
    const estado = destino ? 'PENDIENTE' : 'REQUIERE_REVISION';
    const result = await manager.query(`INSERT INTO correos_rechazo_formularios
      (respuesta_id, destinatario, nombre_estudiante, titulo_formulario, carrera_nombre,
       motivo_rechazo, estado, intentos, proximo_intento_at, ultimo_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [datos.respuestaId, destino,
      datos.nombreEstudiante, datos.tituloFormulario, datos.carreraNombre,
      datos.motivoRechazo, estado, destino ? new Date() : null,
      destino ? null : 'La respuesta no contiene un correo estudiantil válido para notificación.']);
    return Number(result.insertId);
  }

  private errorPublico(error: unknown): string {
    const codigo = (error as { code?: string })?.code;
    const respuesta = (error as { responseCode?: number })?.responseCode;
    return `Fallo del proveedor de correo${codigo ? ` (${String(codigo).slice(0, 40)})` : ''}${respuesta ? `, SMTP ${respuesta}` : ''}`;
  }

  private falloDefinitivo(error: unknown): 'REINTENTAR' | 'FALLIDO' | 'INCIERTO' {
    const status = Number((error as { responseCode?: number })?.responseCode);
    if ([421, 450, 451, 452].includes(status)) return 'REINTENTAR';
    if (status >= 500 && status < 600) return 'FALLIDO';
    // Una caída de red o timeout puede ocurrir después de la aceptación SMTP.
    return 'INCIERTO';
  }

  async procesarId(id: number): Promise<EstadoEnvio> {
    const lease = randomUUID();
    const claim = await this.dataSource.query(`UPDATE correos_rechazo_formularios
      SET estado = 'EN_PROCESO', lease_id = ?, bloqueado_hasta = DATE_ADD(NOW(3), INTERVAL 2 MINUTE),
          intentos = intentos + 1
      WHERE id = ? AND estado = 'PENDIENTE' AND proximo_intento_at <= NOW(3)
        AND intentos < ?`, [lease, id, this.maxIntentos]);
    if (Number(claim.affectedRows) !== 1) return 'OMITIDO';
    const [entrada] = await this.dataSource.query(
      'SELECT * FROM correos_rechazo_formularios WHERE id = ? AND lease_id = ?', [id, lease],
    ) as Entrada[];
    if (!entrada?.destinatario) return 'INCIERTO';

    let estado: EstadoEnvio = 'INCIERTO';
    let errorTexto: string | null = null;
    try {
      await this.mail.enviarNotificacionRechazoSolicitud(entrada.destinatario,
        entrada.nombre_estudiante, { solicitudId: entrada.respuesta_id,
          tituloFormulario: entrada.titulo_formulario,
          carreraNombre: entrada.carrera_nombre || undefined,
          motivoRechazo: entrada.motivo_rechazo });
      estado = 'ENTREGADO';
    } catch (error) {
      errorTexto = this.errorPublico(error);
      const resultado = this.falloDefinitivo(error);
      estado = resultado === 'REINTENTAR'
        ? (entrada.intentos < this.maxIntentos ? 'PENDIENTE' : 'FALLIDO') : resultado;
    }

    const demoraMinutos = Math.min(60, 2 ** entrada.intentos);
    try {
      await this.dataSource.transaction(async (manager) => {
        const actualizacion = await manager.query(`UPDATE correos_rechazo_formularios
          SET estado = ?, lease_id = NULL, bloqueado_hasta = NULL,
              proximo_intento_at = CASE WHEN ? = 'PENDIENTE'
                THEN DATE_ADD(NOW(3), INTERVAL ? MINUTE) ELSE NULL END,
              ultimo_error = ?, entregado_at = CASE WHEN ? = 'ENTREGADO' THEN NOW(3) ELSE NULL END
          WHERE id = ? AND estado = 'EN_PROCESO' AND lease_id = ?`,
        [estado, estado, demoraMinutos, errorTexto, estado, id, lease]);
        if (Number(actualizacion.affectedRows) !== 1) throw new Error('El lease del correo cambió durante el envío.');
        await manager.query(`INSERT INTO correos_rechazo_formularios_intentos
          (correo_id, numero, estado, error) VALUES (?, ?, ?, ?)`,
        [id, entrada.intentos, estado, errorTexto]);
      });
      return estado;
    } catch (error) {
      this.logger.error(`No se pudo registrar el resultado del correo de rechazo #${id}: ${this.errorPublico(error)}`);
      // El lease vencerá en INCIERTO; no se reenvía automáticamente.
      return 'INCIERTO';
    }
  }

  @Interval(30_000)
  async procesarPendientes(): Promise<void> {
    try {
      await this.dataSource.query(`UPDATE correos_rechazo_formularios
        SET estado = 'INCIERTO', lease_id = NULL, bloqueado_hasta = NULL,
            ultimo_error = 'El proceso terminó sin confirmar la respuesta del proveedor.'
        WHERE estado = 'EN_PROCESO' AND bloqueado_hasta < NOW(3)`);
      const pendientes = await this.dataSource.query(`SELECT id FROM correos_rechazo_formularios
        WHERE estado = 'PENDIENTE' AND proximo_intento_at <= NOW(3) AND intentos < ?
        ORDER BY id LIMIT 20`, [this.maxIntentos]) as Array<{ id: number }>;
      for (const entrada of pendientes) await this.procesarId(entrada.id);
    } catch (error) {
      this.logger.error(`Error al procesar correos de rechazo pendientes: ${this.errorPublico(error)}`);
    }
  }
}
