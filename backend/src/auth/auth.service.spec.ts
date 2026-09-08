import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;

  const usuariosService = {
    buscarPorCorreo: jest.fn(),
    buscarPorId: jest.fn(),
    actualizarUltimoAcceso: jest.fn(),
    guardarRecuperacionPassword: jest.fn(),
    actualizarPassword: jest.fn(),
    limpiarRecuperacionPassword: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  const mailService = {
    enviarCodigoRecuperacion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should return access token and user roles for a valid login', async () => {
    const password = 'MiClave123';
    const hashedPassword = await bcrypt.hash(password, 10);

    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 1,
      cedula: '000000000',
      nombres: 'Administrador',
      apellido1: 'SGPA',
      apellido2: null,
      correo: 'admin@una.ac.cr',
      passwordHash: hashedPassword,
      activo: true,
      usuarioRoles: [{ rol: { nombre: 'ADMIN_GLOBAL', activo: true } }],
    });

    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({ correo: 'admin@una.ac.cr', password });

    expect(usuariosService.buscarPorCorreo).toHaveBeenCalledWith('admin@una.ac.cr');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      correo: 'admin@una.ac.cr',
      roles: ['ADMIN_GLOBAL'],
    });
    expect(usuariosService.actualizarUltimoAcceso).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      accessToken: 'jwt-token',
      usuario: {
        id: 1,
        cedula: '000000000',
        nombres: 'Administrador',
        apellido1: 'SGPA',
        apellido2: null,
        correo: 'admin@una.ac.cr',
        roles: ['ADMIN_GLOBAL'],
      },
    });
  });

  it('should reject a valid user without a valid SGPA role', async () => {
    const password = 'MiClave123';
    const hashedPassword = await bcrypt.hash(password, 10);

    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 2,
      cedula: '111111111',
      nombres: 'Usuario',
      apellido1: 'Prueba',
      apellido2: null,
      correo: 'usuario@una.ac.cr',
      passwordHash: hashedPassword,
      activo: true,
      usuarioRoles: [
        {
          rol: {
            nombre: 'ROL_INVENTADO',
            activo: true,
          },
        },
      ],
    });

    await expect(
      service.login({
        correo: 'usuario@una.ac.cr',
        password,
      }),
    ).rejects.toThrow('El usuario no posee acceso habilitado al SGPA.');

    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(usuariosService.actualizarUltimoAcceso).not.toHaveBeenCalled();
  });

  it('should include only active, valid and unique roles in the JWT', async () => {
    const password = 'MiClave123';
    const hashedPassword = await bcrypt.hash(password, 10);

    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 3,
      cedula: '222222222',
      nombres: 'Usuario',
      apellido1: 'Multirrol',
      apellido2: null,
      correo: 'multi@una.ac.cr',
      passwordHash: hashedPassword,
      activo: true,
      usuarioRoles: [
        { rol: { nombre: 'PROFESOR', activo: true } },
        { rol: { nombre: 'COORDINADOR', activo: true } },
        { rol: { nombre: 'PROFESOR', activo: true } },
        { rol: { nombre: 'ESTUDIANTE', activo: false } },
        { rol: { nombre: 'ROL_INVENTADO', activo: true } },
      ],
    });
    jwtService.signAsync.mockResolvedValue('jwt-token');

    await service.login({
      correo: 'multi@una.ac.cr',
      password,
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 3,
      correo: 'multi@una.ac.cr',
      roles: ['PROFESOR', 'COORDINADOR'],
    });
  });

  it('should reject perfil when the user no longer has a valid active role', async () => {
    usuariosService.buscarPorId.mockResolvedValue({
      id: 4,
      activo: true,
      usuarioRoles: [
        { rol: { nombre: 'COORDINADOR', activo: false } },
        { rol: { nombre: 'ROL_INVENTADO', activo: true } },
      ],
    });

    await expect(service.perfil(4)).rejects.toThrow(
      'El usuario no posee acceso habilitado al SGPA.',
    );
  });

  it('should generate and store a six-digit recovery code hash', async () => {
    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 1,
      correo: 'admin@una.ac.cr',
      nombres: 'Administrador',
      activo: true,
    });

    const before = Date.now();
    const result = await service.solicitarRecuperacion({
      correo: ' ADMIN@UNA.AC.CR ',
    });
    const after = Date.now();

    expect(usuariosService.buscarPorCorreo).toHaveBeenCalledWith(
      'admin@una.ac.cr',
    );
    expect(result).toEqual({
      message:
        'Si el correo está registrado, recibirás un código de recuperación.',
    });

    const codigoEnviado = mailService.enviarCodigoRecuperacion.mock
      .calls[0][2] as string;

    expect(codigoEnviado).toMatch(/^\d{6}$/);
    expect(mailService.enviarCodigoRecuperacion).toHaveBeenCalledWith(
      'admin@una.ac.cr',
      'Administrador',
      codigoEnviado,
    );

    const expectedHash = createHash('sha256')
      .update(codigoEnviado)
      .digest('hex');
    const [, storedHash, expiresAt] =
      usuariosService.guardarRecuperacionPassword.mock.calls[0] as [
        number,
        string,
        Date,
      ];

    expect(storedHash).toBe(expectedHash);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
  });

  it('should return the generic response without revealing an unknown email', async () => {
    usuariosService.buscarPorCorreo.mockResolvedValue(null);

    const result = await service.solicitarRecuperacion({
      correo: 'desconocido@una.ac.cr',
    });

    expect(result).toEqual({
      message:
        'Si el correo está registrado, recibirás un código de recuperación.',
    });
    expect(
      usuariosService.guardarRecuperacionPassword,
    ).not.toHaveBeenCalled();
    expect(mailService.enviarCodigoRecuperacion).not.toHaveBeenCalled();
  });

  it('should hash the new password and invalidate the recovery code', async () => {
    const codigo = '123456';
    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 1,
      activo: true,
      passwordResetTokenHash: createHash('sha256')
        .update(codigo)
        .digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.restablecerPassword({
      correo: 'admin@una.ac.cr',
      codigo,
      password: 'NuevaClave123',
    });

    expect(usuariosService.actualizarPassword).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
    const passwordHash = usuariosService.actualizarPassword.mock.calls[0][1] as string;
    await expect(bcrypt.compare('NuevaClave123', passwordHash)).resolves.toBe(true);
    expect(result).toEqual({
      message: 'La contraseña se actualizó correctamente.',
    });
  });

  it('should reject and clear an expired recovery code', async () => {
    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 1,
      activo: true,
      passwordResetTokenHash: createHash('sha256')
        .update('123456')
        .digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() - 1),
    });

    await expect(
      service.restablecerPassword({
        correo: 'admin@una.ac.cr',
        codigo: '123456',
        password: 'NuevaClave123',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(usuariosService.limpiarRecuperacionPassword).toHaveBeenCalledWith(1);
    expect(usuariosService.actualizarPassword).not.toHaveBeenCalled();
  });
});
