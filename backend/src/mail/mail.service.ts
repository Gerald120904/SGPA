import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT') || 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  private escaparHtml(valor: string): string {
    return valor.replace(
      /[&<>"']/g,
      (caracter) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[caracter]!,
    );
  }

  async enviarCodigoRecuperacion(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<void> {
    const remitente = this.configService.get<string>('MAIL_FROM');
    const nombreHtml = this.escaparHtml(nombre);

    await this.transporter.sendMail({
      from: remitente,
      to: destinatario,
      subject: 'Código de recuperación - SGPA',
      text: `
Hola ${nombre}.

Se solicitó restablecer la contraseña de tu cuenta del SGPA.

Tu código de recuperación es:

${codigo}

Este código vence en 15 minutos.

Si no solicitaste este cambio, puedes ignorar este mensaje.
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Recuperación de contraseña</h2>
          <p>Hola ${nombreHtml},</p>
          <p>
            Se solicitó restablecer la contraseña de tu cuenta del SGPA.
          </p>
          <p>Tu código de recuperación es:</p>
          <div
            style="
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 6px;
              margin: 20px 0;
            "
          >
            ${codigo}
          </div>
          <p>Este código vence en <strong>15 minutos</strong>.</p>
          <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
          <hr />
          <p>Sistema de Gestión y Proyección Académica — SGPA</p>
        </div>
      `,
    });
  }
}
