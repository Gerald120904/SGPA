import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

  private obtenerRutaLogo(): string | null {
    const nombreArchivo = 'Logo-UNA-Rojo_FondoTransparente.png';
    const rutas = [
      join(process.cwd(), 'frontend', 'public', nombreArchivo),
      join(process.cwd(), '..', 'frontend', 'public', nombreArchivo),
      join(__dirname, '..', '..', '..', 'frontend', 'public', nombreArchivo),
    ];

    return rutas.find((ruta) => existsSync(ruta)) ?? null;
  }

  async enviarCodigoRecuperacion(
    destinatario: string,
    nombre: string,
    codigo: string,
  ): Promise<void> {
    const remitente = this.configService.get<string>('MAIL_FROM');
    const nombreHtml = this.escaparHtml(nombre);
    const codigoHtml = this.escaparHtml(codigo);
    const rutaLogo = this.obtenerRutaLogo();
    const logoCid = 'logo-una@sgpa';

    await this.transporter.sendMail({
      from: remitente,
      to: destinatario,
      subject: 'Código de recuperación | SGPA',
      text: `
Hola ${nombre}.

Se solicitó restablecer la contraseña de tu cuenta del SGPA.

Tu código de recuperación es:

${codigo}

Este código vence en 15 minutos.

Si no solicitaste este cambio, puedes ignorar este mensaje.
      `.trim(),
      attachments: rutaLogo
        ? [
            {
              filename: 'logo-una.png',
              path: rutaLogo,
              cid: logoCid,
            },
          ]
        : [],
      html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Recuperación de contraseña</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; color:#344054; font-family:Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      Tu código de recuperación del SGPA vence en 15 minutos.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#f4f6f8;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; overflow:hidden; border:1px solid #e4e7ec; border-radius:16px; background-color:#ffffff; box-shadow:0 12px 32px rgba(16,24,40,0.10);">
            <tr>
              <td style="height:5px; background-color:#cf2029; font-size:0; line-height:0;">&nbsp;</td>
            </tr>

            <tr>
              <td align="center" style="padding:28px 36px 20px; border-bottom:1px solid #edf0f4;">
                ${
                  rutaLogo
                    ? `<img src="cid:${logoCid}" width="92" alt="Universidad Nacional de Costa Rica" style="display:block; width:92px; height:auto; margin:0 auto 14px; border:0;">`
                    : '<div style="margin-bottom:12px; color:#cf2029; font-family:Georgia, serif; font-size:34px; font-weight:700; letter-spacing:2px;">UNA</div>'
                }
                <div style="color:#cf2029; font-size:10px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase;">
                  Universidad Nacional · Campus Nicoya
                </div>
                <div style="margin-top:7px; color:#182235; font-size:18px; font-weight:700;">
                  Sistema de Gestión y Proyección Académica
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 40px 36px;">
                <h1 style="margin:0 0 20px; color:#182235; font-size:24px; line-height:1.3; text-align:center;">
                  Recuperación de contraseña
                </h1>

                <p style="margin:0 0 14px; color:#344054; font-size:15px; line-height:1.65;">
                  Hola <strong>${nombreHtml}</strong>,
                </p>

                <p style="margin:0 0 24px; color:#667085; font-size:14px; line-height:1.65;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta. Ingresa el siguiente código en la pantalla de recuperación del SGPA.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 22px;">
                  <tr>
                    <td align="center" style="padding:22px 16px; border:1px solid #f3c4c7; border-radius:12px; background-color:#fff7f7;">
                      <div style="margin-bottom:8px; color:#b71922; font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;">
                        Código de verificación
                      </div>
                      <div style="color:#182235; font-family:'Courier New', monospace; font-size:34px; font-weight:700; letter-spacing:9px; line-height:1.2;">
                        ${codigoHtml}
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin-bottom:22px;">
                  <tr>
                    <td style="padding:13px 15px; border-left:4px solid #cf2029; border-radius:0 8px 8px 0; background-color:#f9fafb; color:#475467; font-size:13px; line-height:1.55;">
                      Por seguridad, este código vence en <strong style="color:#1d2939;">15 minutos</strong> y solo puede utilizarse una vez.
                    </td>
                  </tr>
                </table>

                <p style="margin:0; color:#667085; font-size:13px; line-height:1.6;">
                  Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña permanecerá sin cambios.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:20px 28px; border-top:1px solid #edf0f4; background-color:#fafbfc;">
                <p style="margin:0 0 5px; color:#475467; font-size:12px; font-weight:700;">
                  SGPA · Campus Nicoya
                </p>
                <p style="margin:0; color:#98a2b3; font-size:11px; line-height:1.5;">
                  Este es un mensaje automático. Por favor, no respondas a este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    });
  }
}
