import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { MailService } from '../mail/mail.service';
import { PermisosService } from '../permisos/permisos.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { RolSistema } from './constants/roles.constants';

describe('AuthService', () => {
  let service: AuthService;

  const usuariosService = {
    buscarPorCorreo: jest.fn(),
    buscarPorId: jest.fn(),
    actualizarUltimoAcceso: jest.fn(),
    rotarVersionAutenticacion: jest.fn(),
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

  const permisosService = {
    obtenerPermisosEfectivos: jest.fn(),
  };
  const alcanceJerarquico = { obtenerOpcionesCarrera: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        { provide: PermisosService, useValue: permisosService },
        { provide: AlcanceJerarquicoService, useValue: alcanceJerarquico },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    permisosService.obtenerPermisosEfectivos.mockResolvedValue([
      PermisoSistema.PERIODOS_VER,
    ]);
    usuariosService.rotarVersionAutenticacion.mockResolvedValue(1);
    alcanceJerarquico.obtenerOpcionesCarrera.mockResolvedValue([]);
  });

  it('permite iniciar sesión a un asistente activo sin delegación funcional', async () => {
    const password = 'MiClave123';
    usuariosService.buscarPorCorreo.mockResolvedValue({ id: 8, cedula: '888888888',
      nombres: 'Ana', apellido1: 'Asistente', correo: 'ana@una.ac.cr',
      passwordHash: await bcrypt.hash(password, 10), versionAutenticacion: 0, activo: true,
      usuarioRoles: [{ rol: { nombre: RolSistema.ASISTENTE_ESTUDIANTIL, activo: true } }] });
    jwtService.signAsync.mockResolvedValue('token-sin-permisos');
    const resultado = await service.login({ correo: 'ana@una.ac.cr', password });
    expect(resultado.usuario).toMatchObject({ rolActivo: RolSistema.ASISTENTE_ESTUDIANTIL,
      permisos: [], carreraActiva: null, carrerasDisponibles: [] });
    expect(jwtService.signAsync).toHaveBeenCalledWith(expect.objectContaining({ carreraActiva: null }));
  });

  it('mantiene permisos separados al seleccionar entre dos carreras y rechaza una tercera', async () => {
    const opciones = [
      { id: 1, nombre: 'Carrera 1', permisos: [PermisoSistema.ESTUDIANTES_GESTIONAR] },
      { id: 2, nombre: 'Carrera 2', permisos: [PermisoSistema.PLANES_ESTUDIO_GESTIONAR] },
    ];
    usuariosService.buscarPorId.mockResolvedValue({ id: 8, activo: true, versionAutenticacion: 3,
      cedula: '888888888', nombres: 'Ana', apellido1: 'Asistente', correo: 'ana@una.ac.cr',
      usuarioRoles: [{ rol: { nombre: RolSistema.ASISTENTE_ESTUDIANTIL, activo: true } }] });
    alcanceJerarquico.obtenerOpcionesCarrera.mockResolvedValue(opciones);
    jwtService.signAsync.mockResolvedValue('token-carrera');
    const primera = await service.cambiarCarreraActiva(8, 3, 1);
    const segunda = await service.cambiarCarreraActiva(8, 3, 2);
    expect(primera.usuario.permisos).toEqual([PermisoSistema.ESTUDIANTES_GESTIONAR]);
    expect(segunda.usuario.permisos).toEqual([PermisoSistema.PLANES_ESTUDIO_GESTIONAR]);
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ carreraActiva: 2, av: 3 }));
    await expect(service.cambiarCarreraActiva(8, 3, 9)).rejects.toThrow(BadRequestException);
    expect(usuariosService.rotarVersionAutenticacion).not.toHaveBeenCalled();
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
      versionAutenticacion: 0,
      activo: true,
      usuarioRoles: [{ rol: { nombre: 'ADMIN_GLOBAL', activo: true } }],
    });

    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({ correo: 'admin@una.ac.cr', password });

    expect(usuariosService.buscarPorCorreo).toHaveBeenCalledWith(
      'admin@una.ac.cr',
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      correo: 'admin@una.ac.cr',
      roles: ['ADMIN_GLOBAL'],
      rolActivo: 'ADMIN_GLOBAL',
      carreraActiva: null,
      av: 1,
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
        rolActivo: 'ADMIN_GLOBAL',
        permisos: [PermisoSistema.PERIODOS_VER],
        carreraActiva: null,
        carrerasDisponibles: [],
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
      versionAutenticacion: 0,
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
      versionAutenticacion: 0,
      activo: true,
      usuarioRoles: [
        { rol: { nombre: 'PROFESOR', activo: true } },
        { rol: { nombre: 'COORDINADOR', activo: true } },
        { rol: { nombre: 'PROFESOR', activo: true } },
        { rol: { nombre: 'ASISTENTE_ESTUDIANTIL', activo: false } },
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
      rolActivo: 'PROFESOR',
      carreraActiva: null,
      av: 1,
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
    const [, storedHash, expiresAt] = usuariosService
      .guardarRecuperacionPassword.mock.calls[0] as [number, string, Date];

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
    expect(usuariosService.guardarRecuperacionPassword).not.toHaveBeenCalled();
    expect(mailService.enviarCodigoRecuperacion).not.toHaveBeenCalled();
  });

  it('should hash the new password and invalidate the recovery code', async () => {
    const codigo = '123456';
    usuariosService.buscarPorCorreo.mockResolvedValue({
      id: 1,
      activo: true,
      passwordResetTokenHash: createHash('sha256').update(codigo).digest('hex'),
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
    const passwordHash = usuariosService.actualizarPassword.mock
      .calls[0][1] as string;
    await expect(bcrypt.compare('NuevaClave123', passwordHash)).resolves.toBe(
      true,
    );
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
