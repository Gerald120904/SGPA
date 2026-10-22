import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Rol } from '../roles/entities/rol.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { UsuariosService } from './usuarios.service';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Carrera } from '../carreras/entities/carrera.entity';

describe('UsuariosService', () => {
  const rolAdmin = {
    id: 1,
    nombre: RolSistema.ADMIN_GLOBAL,
    descripcion: 'Administrador global',
    activo: true,
  } as Rol;

  const rolCoordinador = {
    id: 2,
    nombre: RolSistema.COORDINADOR,
    descripcion: 'Coordinador',
    activo: true,
  } as Rol;

  const rolProfesor = {
    id: 3,
    nombre: RolSistema.PROFESOR,
    descripcion: 'Profesor',
    activo: true,
  } as Rol;

  const rolEstudiante = {
    id: 4,
    nombre: RolSistema.ASISTENTE_ESTUDIANTIL,
    descripcion: 'Estudiante',
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
      profesorCarreras: [],
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
  let profesorCarreraRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let carreraRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };
  let txUsuarioRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let txUsuarioRolRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let txUsuarioPermisoRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txRolRepository: {
    find: jest.Mock;
  };
  let txProfesorCarreraRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  const mailService = { enviarInvitacion: jest.fn() };
  const invitaciones = {
    verificarDestino: jest.fn(),
    crearPendiente: jest.fn(),
    procesarId: jest.fn(),
    procesarUsuario: jest.fn(),
    rotarYReintentar: jest.fn(),
    obtenerEstado: jest.fn(),
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
    profesorCarreraRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos) => datos),
      save: jest.fn(),
      delete: jest.fn(),
    };
    carreraRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    txUsuarioRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
    };
    txUsuarioRolRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
      delete: jest.fn(),
    };
    txUsuarioPermisoRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
    };
    txRolRepository = {
      find: jest.fn(),
    };
    txProfesorCarreraRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entidad) => {
        if (entidad === Usuario) return txUsuarioRepository;
        if (entidad === UsuarioRol) return txUsuarioRolRepository;
        if (entidad === UsuarioPermiso) return txUsuarioPermisoRepository;
        if (entidad === Rol) return txRolRepository;
        if (entidad === ProfesorCarrera) return txProfesorCarreraRepository;
        throw new Error('Repositorio inesperado');
      }),
    };

    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    mailService.enviarInvitacion.mockReset().mockResolvedValue(undefined);
    invitaciones.verificarDestino.mockReset().mockResolvedValue(undefined);
    invitaciones.crearPendiente.mockReset().mockResolvedValue(undefined);
    invitaciones.procesarId.mockReset().mockResolvedValue('ENVIADA');
    invitaciones.procesarUsuario.mockReset().mockResolvedValue('ENVIADA');
    invitaciones.rotarYReintentar.mockReset().mockResolvedValue('ENVIADA');
    invitaciones.obtenerEstado.mockReset();

    service = new UsuariosService(
      usuarioRepository as unknown as Repository<Usuario>,
      usuarioRolRepository as unknown as Repository<UsuarioRol>,
      rolRepository as unknown as Repository<Rol>,
      profesorCarreraRepository as unknown as Repository<ProfesorCarrera>,
      carreraRepository as unknown as Repository<Carrera>,
      dataSource as unknown as DataSource,
      undefined,
      mailService as never,
      invitaciones as never,
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

  it('buscarPorId carga roles y carreras docentes', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearUsuario());

    await service.buscarPorId(1);

    expect(usuarioRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: {
          usuarioRoles: {
            rol: true,
          },
          profesorCarreras: {
            carrera: true,
          },
        },
      }),
    );
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
    expect(txUsuarioPermisoRepository.save).not.toHaveBeenCalled();
    const usuarioGuardado = txUsuarioRepository.save.mock.calls[0][0];
    await expect(
      bcrypt.compare('ClaveSegura123', usuarioGuardado.passwordHash),
    ).resolves.toBe(true);
    expect(usuarioGuardado.correo).toBe('admin@sgpa.local');
    expect(resultado).not.toHaveProperty('passwordHash');
  });

  it('crea una cuenta inactiva e invita con token hash sin contraseña administrativa', async () => {
    usuarioRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(crearUsuario({ activo: false }));
    txRolRepository.find.mockResolvedValue([rolAdmin]);
    txUsuarioRepository.save.mockImplementation(async (usuario) => ({ ...usuario, id: 1 }));

    const resultado = await service.crearConInvitacion({
      cedula: '222222222',
      nombres: 'Invitada',
      apellido1: 'Prueba',
      correo: 'invitada@sgpa.local',
      roles: [RolSistema.ADMIN_GLOBAL],
    });

    const guardado = txUsuarioRepository.save.mock.calls[0][0];
    const enlace = invitaciones.crearPendiente.mock.calls[0][3] as string;
    const token = new URLSearchParams(new URL(enlace).hash.slice(1)).get('token')!;
    expect(guardado.activo).toBe(false);
    expect(guardado.passwordResetTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(guardado.passwordResetTokenHash).not.toBe(token);
    expect(guardado.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(resultado).not.toHaveProperty('passwordHash');
    expect(resultado).not.toHaveProperty('passwordResetTokenHash');
    expect(invitaciones.procesarUsuario).toHaveBeenCalledWith(1);
    expect(mailService.enviarInvitacion).not.toHaveBeenCalled();
  });

  it('si falla el correo, la transacción de alta falla sin entregar cuenta activa', async () => {
    usuarioRepository.findOne.mockResolvedValue(null);
    txRolRepository.find.mockResolvedValue([rolAdmin]);
    txUsuarioRepository.save.mockImplementation(async (usuario) => ({ ...usuario, id: 1 }));
    invitaciones.procesarUsuario.mockResolvedValue('INCIERTA');
    await expect(service.crearConInvitacion({
      cedula: '222222222',
      nombres: 'Invitada',
      apellido1: 'Prueba',
      correo: 'invitada@sgpa.local',
      roles: [RolSistema.ADMIN_GLOBAL],
    })).rejects.toThrow('requiere recuperación administrativa');
    expect(txUsuarioRepository.save.mock.calls[0][0].activo).toBe(false);
    expect(invitaciones.crearPendiente).toHaveBeenCalledTimes(1);
  });

  it('conserva la invitación pendiente cuando el envío automático está deshabilitado', async () => {
    const anterior = process.env.SGPA_INVITATION_OUTBOX_ENABLED;
    try {
      process.env.SGPA_INVITATION_OUTBOX_ENABLED = 'false';
      usuarioRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(crearUsuario({ activo: false }));
      txRolRepository.find.mockResolvedValue([rolAdmin]);
      txUsuarioRepository.save.mockImplementation(async (usuario) => ({ ...usuario, id: 1 }));

      const resultado = await service.crearConInvitacion({
        cedula: '222222222', nombres: 'Invitada', apellido1: 'Prueba',
        correo: 'invitada@sgpa.local', roles: [RolSistema.ADMIN_GLOBAL],
      }, undefined, { respetarConfiguracionEnvio: true, incluirEstadoInvitacion: true });

      expect(invitaciones.crearPendiente).toHaveBeenCalledTimes(1);
      expect(invitaciones.procesarUsuario).not.toHaveBeenCalled();
      expect((resultado as any).invitacion).toEqual({ estado: 'PENDIENTE' });
    } finally {
      if (anterior === undefined) delete process.env.SGPA_INVITATION_OUTBOX_ENABLED;
      else process.env.SGPA_INVITATION_OUTBOX_ENABLED = anterior;
    }
  });

  it.each([
    ['http://127.0.0.1:3000', 'production'],
    ['https://127.0.0.2:3000', 'production'],
    ['https://localhost:3000', 'production'],
    ['https://a.localhost:3000', 'production'],
    ['', 'production'],
    ['http://sgpa.universidad.test', 'production'],
    ['http://sgpa.universidad.test', 'development'],
    ['https://usuario:clave@sgpa.universidad.test', 'production'],
    ['https://sgpa.universidad.test/?token=previo', 'production'],
  ])('rechaza origen inseguro %s en %s sin persistir ni enviar', async (base, entorno) => {
    const anteriorEntorno = process.env.NODE_ENV;
    const anteriorBase = process.env.SGPA_INVITATION_BASE_URL;
    try {
      process.env.NODE_ENV = entorno;
      process.env.SGPA_INVITATION_BASE_URL = base;
      await expect(service.crearConInvitacion({
        cedula: '222222222',
        nombres: 'Invitada',
        apellido1: 'Prueba',
        correo: 'invitada@sgpa.local',
        roles: [RolSistema.ADMIN_GLOBAL],
      })).rejects.toThrow('Configure una URL');
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(invitaciones.crearPendiente).not.toHaveBeenCalled();
    } finally {
      if (anteriorEntorno === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = anteriorEntorno;
      if (anteriorBase === undefined) delete process.env.SGPA_INVITATION_BASE_URL;
      else process.env.SGPA_INVITATION_BASE_URL = anteriorBase;
    }
  });

  it('permite URL HTTPS remota y conserva el token fuera de la respuesta', async () => {
    const anteriorEntorno = process.env.NODE_ENV;
    const anteriorBase = process.env.SGPA_INVITATION_BASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      process.env.SGPA_INVITATION_BASE_URL = 'https://sgpa.universidad.test/app';
      usuarioRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(crearUsuario({ activo: false }));
      txRolRepository.find.mockResolvedValue([rolAdmin]);
      txUsuarioRepository.save.mockImplementation(async (usuario) => ({ ...usuario, id: 1 }));

      const resultado = await service.crearConInvitacion({
        cedula: '222222222',
        nombres: 'Invitada',
        apellido1: 'Prueba',
        correo: 'invitada@sgpa.local',
        roles: [RolSistema.ADMIN_GLOBAL],
      });
      const enlace = invitaciones.crearPendiente.mock.calls[0][3] as string;
      expect(new URL(enlace).origin).toBe('https://sgpa.universidad.test');
      expect(new URL(enlace).pathname).toBe('/auth/invitacion');
      expect(enlace).toContain('#correo=');
      expect(enlace).toContain('&token=');
      expect(JSON.stringify(resultado)).not.toContain('token');
      expect(JSON.stringify(resultado)).not.toContain('password');
    } finally {
      if (anteriorEntorno === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = anteriorEntorno;
      if (anteriorBase === undefined) delete process.env.SGPA_INVITATION_BASE_URL;
      else process.env.SGPA_INVITATION_BASE_URL = anteriorBase;
    }
  });

  it('acepta una invitación una sola vez y activa con contraseña propia', async () => {
    const token = 'a'.repeat(64);
    const hash = createHash('sha256').update(token).digest('hex');
    usuarioRepository.findOne.mockResolvedValue(crearUsuario({
      activo: false,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    }));
    usuarioRepository.update.mockResolvedValueOnce({ affected: 1 });
    await expect(service.aceptarInvitacion('admin@sgpa.local', token, 'ClavePropia123')).resolves.toHaveProperty('message');
    const cambios = usuarioRepository.update.mock.calls[0][1];
    expect(cambios).toMatchObject({
      activo: true,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
    await expect(bcrypt.compare('ClavePropia123', cambios.passwordHash)).resolves.toBe(true);
    usuarioRepository.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.aceptarInvitacion('admin@sgpa.local', token, 'ClavePropia123')).rejects.toThrow('Invitación inválida');
  });

  it('rechaza invitaciones caducadas o con token diferente sin activar la cuenta', async () => {
    const token = 'a'.repeat(64);
    const hash = createHash('sha256').update(token).digest('hex');
    usuarioRepository.findOne.mockResolvedValueOnce(crearUsuario({
      activo: false,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() - 60_000),
    })).mockResolvedValueOnce(crearUsuario({
      activo: false,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    }));

    await expect(service.aceptarInvitacion('admin@sgpa.local', token, 'ClavePropia123')).rejects.toThrow('Invitación inválida');
    await expect(service.aceptarInvitacion('admin@sgpa.local', 'b'.repeat(64), 'ClavePropia123')).rejects.toThrow('Invitación inválida');
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza crear carreras docentes sin incluir el rol PROFESOR', async () => {
    usuarioRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        cedula: '888888888',
        nombres: 'Coordinador',
        apellido1: 'Sin Profesor',
        correo: 'coordinador.sin.profesor@sgpa.local',
        password: 'ClaveSegura123',
        roles: [RolSistema.COORDINADOR],
        carreraIds: [10],
      }),
    ).rejects.toThrow(
      'Solo un usuario con rol PROFESOR puede tener carreras docentes asociadas.',
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('crea ASISTENTE_ESTUDIANTIL sin permisos personalizados y no guarda permisos', async () => {
    const usuarioCreado = crearUsuario();
    usuarioRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuarioCreado);
    txRolRepository.find.mockResolvedValue([rolEstudiante]);
    txUsuarioRepository.save.mockImplementation(async (usuario) => ({
      ...usuario,
      id: 2,
    }));

    await service.crear({
      cedula: '111111111',
      nombres: 'Estudiante',
      apellido1: 'Prueba',
      correo: 'estudiante@sgpa.local',
      password: 'ClaveSegura123',
      roles: [RolSistema.ASISTENTE_ESTUDIANTIL],
    });

    expect(txUsuarioPermisoRepository.save).not.toHaveBeenCalled();
  });

  it('crea COORDINADOR sin permisos generales hasta configurar carreras', async () => {
    const usuarioCreado = crearUsuario();
    usuarioRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuarioCreado);
    txRolRepository.find.mockResolvedValue([rolCoordinador]);
    txUsuarioRepository.save.mockImplementation(async (usuario) => ({
      ...usuario,
      id: 3,
    }));

    await service.crear({
      cedula: '222222222',
      nombres: 'Coordinador',
      apellido1: 'Prueba',
      correo: 'coord@sgpa.local',
      password: 'ClaveSegura123',
      roles: [RolSistema.COORDINADOR],
    });

    expect(txUsuarioPermisoRepository.save).not.toHaveBeenCalled();
  });

  it('no concede permisos generales enviados al crear COORDINADOR', async () => {
    const usuarioCreado = crearUsuario();
    usuarioRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usuarioCreado);
    txRolRepository.find.mockResolvedValue([rolCoordinador]);
    txUsuarioRepository.save.mockImplementation(async (usuario) => ({
      ...usuario,
      id: 4,
    }));

    await service.crear({
      cedula: '333333333',
      nombres: 'Coordinador',
      apellido1: 'Restringido',
      correo: 'coord.res@sgpa.local',
      password: 'ClaveSegura123',
      roles: [RolSistema.COORDINADOR],
      permisos: [PermisoSistema.PERIODOS_VER],
    });

    expect(txUsuarioPermisoRepository.save).not.toHaveBeenCalled();
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

  it('rechaza campos requeridos compuestos solo por espacios al crear', async () => {
    await expect(
      service.crear({
        cedula: '   ',
        nombres: 'Usuario',
        apellido1: 'Prueba',
        correo: 'usuario@sgpa.local',
        password: 'ClaveSegura123',
        roles: [RolSistema.PROFESOR],
      }),
    ).rejects.toThrow('El campo cédula no puede estar vacío.');

    expect(usuarioRepository.findOne).not.toHaveBeenCalled();
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

  it('rechaza vaciar un campo requerido al actualizar', async () => {
    usuarioRepository.findOne.mockResolvedValueOnce(crearUsuario());

    await expect(
      service.actualizar(1, {
        nombres: '   ',
      }),
    ).rejects.toThrow('El campo nombre no puede estar vacío.');

    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('actualiza las carreras asociadas a un usuario profesor', async () => {
    usuarioRepository.findOne
      .mockResolvedValueOnce(
        crearUsuario({
          usuarioRoles: [{ rol: rolProfesor } as UsuarioRol],
        }),
      )
      .mockResolvedValueOnce(
        crearUsuario({
          usuarioRoles: [{ rol: rolProfesor } as UsuarioRol],
        }),
      );
    carreraRepository.find.mockResolvedValue([
      { id: 10, activo: true },
      { id: 20, activo: true },
    ]);

    await service.actualizar(1, {
      carreraIds: [10, 20],
    });

    expect(carreraRepository.find).toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(txProfesorCarreraRepository.delete).toHaveBeenCalledWith({
      profesorUsuarioId: 1,
    });
    expect(txProfesorCarreraRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ profesorUsuarioId: 1, carreraId: 10 }),
      expect.objectContaining({ profesorUsuarioId: 1, carreraId: 20 }),
    ]);
  });

  it('rechaza carreras docentes para un usuario sin rol PROFESOR', async () => {
    usuarioRepository.findOne.mockResolvedValue(
      crearUsuario({
        usuarioRoles: [
          {
            rol: rolCoordinador,
          } as UsuarioRol,
        ],
      }),
    );

    await expect(
      service.actualizar(1, {
        carreraIds: [10],
      }),
    ).rejects.toThrow(
      'Solo un usuario con rol PROFESOR puede tener carreras docentes asociadas.',
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
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

  it('impide reactivar un asistente cuya dependencia fue desactivada', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearUsuario({
      id: 4, activo: false,
      usuarioRoles: [{ usuarioId: 4, rolId: 4, rol: rolEstudiante } as UsuarioRol],
    }));
    await expect(service.cambiarEstado(4, true, 1)).rejects.toThrow(BadRequestException);
    expect(usuarioRepository.update).not.toHaveBeenCalled();
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

    expect(txUsuarioRolRepository.delete).toHaveBeenCalledWith({
      usuarioId: 2,
      rolId: 3,
    });
    expect(txProfesorCarreraRepository.delete).toHaveBeenCalledWith({
      profesorUsuarioId: 2,
    });
    expect(resultado.roles).toEqual([]);
  });

  it('al revocar PROFESOR elimina sus carreras docentes activas', async () => {
    usuarioRepository.findOne
      .mockResolvedValueOnce(
        crearUsuario({
          id: 2,
        }),
      )
      .mockResolvedValueOnce(
        crearUsuario({
          id: 2,
          usuarioRoles: [],
          profesorCarreras: [],
        }),
      );

    usuarioRolRepository.findOne.mockResolvedValue({
      usuarioId: 2,
      rolId: 3,
      rol: rolProfesor,
    });

    await service.revocarRol(2, 3, 1);

    expect(txUsuarioRolRepository.delete).toHaveBeenCalledWith({
      usuarioId: 2,
      rolId: 3,
    });

    expect(txProfesorCarreraRepository.delete).toHaveBeenCalledWith({
      profesorUsuarioId: 2,
    });
  });

  it('devuelve 404 para un usuario inexistente', async () => {
    usuarioRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });
});
