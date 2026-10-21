import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

describe('AuthController invitaciones', () => {
  let app: INestApplication;
  const authService = { aceptarInvitacion: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).overrideGuard(AuthGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { if (app) await app.close(); });

  it('sirve el formulario sin cachear y sin token en HTML', async () => {
    const response = await request(app.getHttpServer()).get('/auth/invitacion').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.text).toContain('Establecer contraseña');
    expect(response.text).not.toContain('a'.repeat(64));
  });

  it('rechaza token inválido antes de activar la invitación', async () => {
    authService.aceptarInvitacion.mockClear();
    await request(app.getHttpServer()).post('/auth/aceptar-invitacion').send({
      correo: 'prueba@sgpa.test', token: 'incorrecto', password: 'ClavePropia123',
    }).expect(400);
    expect(authService.aceptarInvitacion).not.toHaveBeenCalled();
  });

  it('entrega la contraseña elegida al servicio de invitaciones', async () => {
    authService.aceptarInvitacion.mockResolvedValue({ message: 'OK' });
    await request(app.getHttpServer()).post('/auth/aceptar-invitacion').send({
      correo: 'PRUEBA@SGPA.TEST', token: 'a'.repeat(64), password: 'ClavePropia123',
    }).expect(200, { message: 'OK' });
    expect(authService.aceptarInvitacion).toHaveBeenCalledWith({
      correo: 'prueba@sgpa.test', token: 'a'.repeat(64), password: 'ClavePropia123',
    });
  });
});
