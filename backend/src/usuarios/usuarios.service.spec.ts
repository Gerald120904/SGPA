import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Rol } from '../roles/entities/rol.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  const rolAdmin = {
    id: 1,
    nombre: RolSistema.ADMIN_GLOBAL,
    descripcion: 'Administrador global',
    activo: true,
  } as Rol;

  const crearUsuario = (cambios: Partial<Usuario> = {}) =>
    ({
      id: 1,
      cedula: '999999999',
      nombres: 'Administrador',
      apellido1: 'SGPA',
      apellido2: null,
      correo: 'admin@sgpa.local',
      passwordHash: 'hash-no-publicable',
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      activo: true,
      ultimoAcceso: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      usuarioRoles: [
        {
          usuarioId: 1,
          rolId: 1,
          rol: rolAdmin,
        } as UsuarioRol,
      ],
      ...cambios,
    }) as Usuario;

  let service: UsuariosService;
  let usuarioRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let usuarioRolRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let rolRepository: {
    findOne: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };
  let txUsuarioRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txUsuarioRolRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txRolRepository: {
    find: jest.Mock;
  };

  beforeEach(() => {
    usuarioRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    usuarioRolRepository = {
      findOne: jest.fn(),
      create: jest.fn((datos) => datos),
      save: jest.fn(),
      delete: jest.fn(),
    };
    rolRepository = {
      findOne: jest.fn(),
    };
    txUsuarioRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
    };
    txUsuarioRolRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
    };
    txRolRepository = {
      find: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entidad) => {
        if (entidad === Usuario) return txUsuarioRepository;
        if (entidad === UsuarioRol) return txUsuarioRolRepository;
        if (entidad === Rol) return txRolRepository;
        throw new Error('Repositorio inesperado');
      }),
    };

    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };

    service = new UsuariosService(
      usuarioRepository as unknown as Repository<Usuario>,
      usuarioRolRepository as unknown as Repository<UsuarioRol>,
      rolRepository as unknown as Repository<Rol>,
      dataSource as unknown as DataSource,
    );
  });

  it('lista usuarios con roles identificables y sin campos sensibles', async () => {
    usuarioRepository.find.mockResolvedValue([
      crearUsuario({
        usuarioRoles: [
          { rol: rolAdmin } as UsuarioRol,
          {
            rol: {
              id: 3,
              nombre: RolSistema.PROFESOR,
              activo: false,
            } as Rol,
          } as UsuarioRol,
        ],
      }),
    ]);

    const resultado = await service.listar();

    expect(resultado).toEqual([
      expect.objectContaining({
        id: 1,
        roles: [
          {
            id: 1,
            nombre: RolSistema.ADMIN_GLOBAL,
            descripcion: 'Administrador global',
          },
        ],
      }),
    ]);
    expect(resultado[0]).not.toHaveProperty('passwordHash');
    expect(resultado[0]).not.toHaveProperty('passwordResetTokenHash');
    expect(resultado[0]).not.toHaveProperty('passwordResetExpiresAt');
  });

  it('crea usuario y roles en una transacción con password cifrado', async () => {
    const usuarioCreado = crearUsuario();
    usuarioRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuarioCreado);
    txRolRepository.find.mockResolvedValue([rolAdmin]);
    txUsuarioRepository.save.mockImplementation(async (usuario) => ({
      ...usuario,
      id: 1,
    }));

    const resultado = await service.crear({
      cedula: ' 999999999 ',
      nombres: ' Administrador ',
      apellido1: ' SGPA ',
      correo: ' ADMIN@SGPA.LOCAL ',
      password: 'ClaveSegura123',
      roles: [RolSistema.ADMIN_GLOBAL],
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txUsuarioRolRepository.save).toHaveBeenCalledWith([
      {
        usuarioId: 1,
        rolId: 1,
      },
    ]);
    const usuarioGuardado = txUsuarioRepository.save.mock.calls[0][0];
    await expect(
      bcrypt.compare('ClaveSegura123', usuarioGuardado.passwordHash),
    ).resolves.toBe(true);
    expect(usuarioGuardado.correo).toBe('admin@sgpa.local');
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  it('rechaza una cédula duplicada antes de crear', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearUsuario());

    await expect(
      service.crear({
        cedula: '999999999',
        nombres: 'Otro',
        apellido1: 'Usuario',
        correo: 'otro@sgpa.local',
        password: 'ClaveSegura123',
        roles: [RolSistema.PROFESOR],
      }),
    ).rejects.toThrow(ConflictException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza crear con un rol inexistente o inactivo', async () => {
    usuarioRepository.findOne.mockResolvedValue(null);
    txRolRepository.find.mockResolvedValue([]);

    await expect(
      service.crear({
        cedula: '111111111',
        nombres: 'Usuario',
        apellido1: 'Prueba',
        correo: 'usuario@sgpa.local',
        password: 'ClaveSegura123',
        roles: [RolSistema.PROFESOR],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('actualiza y normaliza los datos administrativos', async () => {
    usuarioRepository.findOne
      .mockResolvedValueOnce(crearUsuario())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        crearUsuario({
          nombres: 'Nuevo Nombre',
          correo: 'nuevo@sgpa.local',
        }),
      );

    await service.actualizar(1, {
      nombres: ' Nuevo Nombre ',
      correo: ' NUEVO@SGPA.LOCAL ',
    });

    expect(usuarioRepository.update).toHaveBeenCalledWith(1, {
      nombres: 'Nuevo Nombre',
      correo: 'nuevo@sgpa.local',
    });
  });

  it('impide que el administrador desactive su propia cuenta', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearUsuario());

    await expect(service.cambiarEstado(1, false, 1)).rejects.toThrow(
      'No puede desactivar su propia cuenta.',
    );
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('cambia el estado de otra cuenta', async () => {
    usuarioRepository.findOne
      .mockResolvedValueOnce(crearUsuario({ id: 2 }))
      .mockResolvedValueOnce(crearUsuario({ id: 2, activo: false }));

    const resultado = await service.cambiarEstado(2, false, 1);

    expect(usuarioRepository.update).toHaveBeenCalledWith(2, {
      activo: false,
    });
    expect(resultado.activo).toBe(false);
  });

  it('impide asignar un rol duplicado', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearUsuario());
    rolRepository.findOne.mockResolvedValue(rolAdmin);
    usuarioRolRepository.findOne.mockResolvedValue({
      usuarioId: 1,
      rolId: 1,
    });

    await expect(
      service.asignarRol(1, RolSistema.ADMIN_GLOBAL),
    ).rejects.toThrow(ConflictException);
  });

  it('asigna un rol oficial activo', async () => {
    const rolProfesor = {
      id: 3,
      nombre: RolSistema.PROFESOR,
      descripcion: 'Profesor',
      activo: true,
    } as Rol;
    usuarioRepository.findOne
      .mockResolvedValueOnce(crearUsuario({ id: 2 }))
      .mockResolvedValueOnce(
        crearUsuario({
          id: 2,
          usuarioRoles: [{ rol: rolProfesor } as UsuarioRol],
        }),
      );
    rolRepository.findOne.mockResolvedValue(rolProfesor);
    usuarioRolRepository.findOne.mockResolvedValue(null);

    const resultado = await service.asignarRol(2, RolSistema.PROFESOR);

    expect(usuarioRolRepository.save).toHaveBeenCalledWith({
      usuarioId: 2,
      rolId: 3,
    });
    expect(resultado.roles).toEqual([
      {
        id: 3,
        nombre: RolSistema.PROFESOR,
        descripcion: 'Profesor',
      },
    ]);
  });

  it('impide revocar el propio rol ADMIN_GLOBAL', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearUsuario());
    usuarioRolRepository.findOne.mockResolvedValue({
      usuarioId: 1,
      rolId: 1,
      rol: rolAdmin,
    });

    await expect(service.revocarRol(1, 1, 1)).rejects.toThrow(
      'No puede revocar su propio rol de administrador global.',
    );
    expect(usuarioRolRepository.delete).not.toHaveBeenCalled();
  });

  it('revoca un rol de otra cuenta', async () => {
    usuarioRepository.findOne
      .mockResolvedValueOnce(crearUsuario({ id: 2 }))
      .mockResolvedValueOnce(
        crearUsuario({
          id: 2,
          usuarioRoles: [],
        }),
      );
    usuarioRolRepository.findOne.mockResolvedValue({
      usuarioId: 2,
      rolId: 3,
      rol: {
        id: 3,
        nombre: RolSistema.PROFESOR,
        activo: true,
      },
    });

    const resultado = await service.revocarRol(2, 3, 1);

    expect(usuarioRolRepository.delete).toHaveBeenCalledWith({
      usuarioId: 2,
      rolId: 3,
    });
    expect(resultado.roles).toEqual([]);
  });

  it('devuelve 404 para un usuario inexistente', async () => {
    usuarioRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });
});
