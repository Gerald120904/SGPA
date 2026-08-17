import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';

describe('AuthService', () => {
  let service: AuthService;

  const usuariosService = {
    buscarPorCorreo: jest.fn(),
    actualizarUltimoAcceso: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        { provide: JwtService, useValue: jwtService },
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
      usuarioRoles: [{ rol: { nombre: 'ADMINISTRADOR', activo: true } }],
    });

    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({ correo: 'admin@una.ac.cr', password });

    expect(usuariosService.buscarPorCorreo).toHaveBeenCalledWith('admin@una.ac.cr');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      correo: 'admin@una.ac.cr',
      roles: ['ADMINISTRADOR'],
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
        roles: ['ADMINISTRADOR'],
      },
    });
  });
});
