import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('MailService invitaciones', () => {
  const enviar = jest.fn();
  let service: MailService;
  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: enviar });
    service = new MailService({ get: (key: string) => ({
      SMTP_HOST: 'smtp.test.invalid', SMTP_PORT: '587', SMTP_SECURE: 'false',
      SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sgpa@example.invalid',
    }[key]) } as unknown as ConfigService);
  });

  it('acepta una respuesta SMTP que confirma el destinatario', async () => {
    enviar.mockResolvedValue({ accepted: ['persona@example.invalid'] });
    await expect(service.enviarInvitacion('persona@example.invalid', 'Persona', 'https://example.invalid/#token'))
      .resolves.toBeUndefined();
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('clasifica el rechazo SMTP del destinatario como definitivo', async () => {
    enviar.mockResolvedValue({ accepted: [], rejected: ['persona@example.invalid'] });
    await expect(service.enviarInvitacion('persona@example.invalid', 'Persona', 'https://example.invalid/#token'))
      .rejects.toMatchObject({ definitive: true, code: 'SMTP_DESTINATARIO_RECHAZADO' });
  });

  it('preserva como incierto un error de transporte sin respuesta SMTP', async () => {
    enviar.mockRejectedValue(Object.assign(new Error('transporte interrumpido'), { code: 'ECONNRESET' }));
    await expect(service.enviarInvitacion('persona@example.invalid', 'Persona', 'https://example.invalid/#token'))
      .rejects.toMatchObject({ code: 'ECONNRESET' });
  });
});
