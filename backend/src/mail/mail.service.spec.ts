import { MailService } from './mail.service';

describe('MailService rechazo de formulario', () => {
  const detalles = { solicitudId: 7, tituloFormulario: 'Ingreso', motivoRechazo: 'Falta atestado' };
  const crear = (sendMail: jest.Mock) => {
    const mail = new MailService({ get: (key: string) => key === 'MAIL_FROM' ? 'sgpa@una.ac.cr' : undefined } as never);
    (mail as any).transporter = { sendMail };
    return mail;
  };

  it('confirma la entrega solo si SMTP aceptó al destinatario original', async () => {
    const sendMail = jest.fn().mockResolvedValue({ accepted: ['alumna@una.ac.cr'], rejected: [] });
    await expect(crear(sendMail).enviarNotificacionRechazoSolicitud(
      'alumna@una.ac.cr', 'Alumna', detalles)).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alumna@una.ac.cr', text: expect.stringContaining('Falta atestado'),
    }));
  });

  it('rechaza una respuesta SMTP que no aceptó al destinatario', async () => {
    const mail = crear(jest.fn().mockResolvedValue({ accepted: [], rejected: ['alumna@una.ac.cr'] }));
    await expect(mail.enviarNotificacionRechazoSolicitud(
      'alumna@una.ac.cr', 'Alumna', detalles)).rejects.toMatchObject({ responseCode: 550 });
  });
});
