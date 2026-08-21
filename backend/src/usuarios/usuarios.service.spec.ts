import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let repository: jest.Mocked<Pick<Repository<Usuario>, 'find'>>;

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: getRepositoryToken(Usuario),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('lista usuarios ordenados, con roles y sin campos sensibles', async () => {
    repository.find.mockResolvedValue([
      {
        id: 1,
        cedula: '999999999',
        nombres: 'Administrador',
        apellido1: 'SGPA',
        apellido2: null,
        correo: 'admin@sgpa.local',
        passwordHash: 'hash-no-publicable',
        passwordResetTokenHash: 'token-no-publicable',
        passwordResetExpiresAt: new Date(),
        activo: true,
        ultimoAcceso: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        usuarioRoles: [
          {
            rol: {
              nombre: 'ADMIN_GLOBAL',
              activo: true,
            },
          },
          {
            rol: {
              nombre: 'PROFESOR',
              activo: false,
            },
          },
        ],
      } as Usuario,
    ]);

    await expect(service.listar()).resolves.toEqual([
      {
        id: 1,
        cedula: '999999999',
        nombres: 'Administrador',
        apellido1: 'SGPA',
        apellido2: null,
        correo: 'admin@sgpa.local',
        activo: true,
        ultimoAcceso: null,
        roles: ['ADMIN_GLOBAL'],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: {
          usuarioRoles: {
            rol: true,
          },
        },
        order: {
          nombres: 'ASC',
          apellido1: 'ASC',
        },
      }),
    );

    const options = repository.find.mock.calls[0][0];

    expect(options?.select).not.toHaveProperty('passwordHash');
    expect(options?.select).not.toHaveProperty('passwordResetTokenHash');
    expect(options?.select).not.toHaveProperty('passwordResetExpiresAt');
  });
});
