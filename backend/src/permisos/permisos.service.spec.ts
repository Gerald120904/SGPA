import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  PermisoSistema,
  PERMISOS_SISTEMA,
} from './constants/permisos.constant';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';
import { PermisosService } from './permisos.service';

describe('PermisosService', () => {
  let service: PermisosService;

  let usuarioPermisoRepository: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let usuarioRepository: {
    findOne: jest.Mock;
  };

  let manager: {
    getRepository: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  beforeEach(() => {
    usuarioPermisoRepository = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((val) => val),
      save: jest.fn(async (val) => val),
    };

    usuarioRepository = {
      findOne: jest.fn(),
    };

    manager = {
      getRepository: jest.fn(() => usuarioPermisoRepository),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => cb(manager)),
    };

    service = new PermisosService(
      usuarioPermisoRepository as unknown as Repository<UsuarioPermiso>,
      usuarioRepository as unknown as Repository<Usuario>,
      dataSource as unknown as DataSource,
    );

    jest.clearAllMocks();
  });

  it('obtiene el catálogo completo de permisos', () => {
    const catalogo = service.obtenerCatalogo();
    expect(catalogo).toEqual(PERMISOS_SISTEMA);
    expect(catalogo).toContain(PermisoSistema.PROFESORES_VER);
    expect(catalogo).toContain(PermisoSistema.ATESTADOS_VALIDAR);
    expect(catalogo).toContain(PermisoSistema.PERFILES_DOCENTES_VALIDAR);
  });

  describe('usuarioTienePermisos', () => {
    it('retorna true si la lista de permisos requeridos es vacía', async () => {
      const tiene = await service.usuarioTienePermisos(1, []);
      expect(tiene).toBe(true);
    });

    it('retorna true si el usuario tiene todos los permisos requeridos activos', async () => {
      usuarioPermisoRepository.find.mockResolvedValue([
        { permiso: PermisoSistema.PROFESORES_VER, activo: true },
        { permiso: PermisoSistema.ATESTADOS_VALIDAR, activo: true },
      ]);

      const tiene = await service.usuarioTienePermisos(1, [
        PermisoSistema.PROFESORES_VER,
        PermisoSistema.ATESTADOS_VALIDAR,
      ]);

      expect(tiene).toBe(true);
    });

    it('retorna false si le falta algún permiso requerido', async () => {
      usuarioPermisoRepository.find.mockResolvedValue([
        { permiso: PermisoSistema.PROFESORES_VER, activo: true },
      ]);

      const tiene = await service.usuarioTienePermisos(1, [
        PermisoSistema.PROFESORES_VER,
        PermisoSistema.ATESTADOS_VALIDAR,
      ]);

      expect(tiene).toBe(false);
    });
  });

  describe('listarUsuario', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      usuarioRepository.findOne.mockResolvedValue(null);

      await expect(service.listarUsuario(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna la lista de permisos del usuario', async () => {
      usuarioRepository.findOne.mockResolvedValue({ id: 10 });
      usuarioPermisoRepository.find.mockResolvedValue([
        {
          id: 1,
          usuarioId: 10,
          permiso: PermisoSistema.PROFESORES_VER,
          activo: true,
        },
      ]);

      const lista = await service.listarUsuario(10);
      expect(lista).toHaveLength(1);
      expect(lista[0].permiso).toBe(PermisoSistema.PROFESORES_VER);
    });
  });

  describe('reemplazarPermisos', () => {
    it('reemplaza los permisos transaccionalmente', async () => {
      usuarioRepository.findOne.mockResolvedValue({ id: 10 });
      usuarioPermisoRepository.find.mockResolvedValue([
        {
          id: 1,
          usuarioId: 10,
          permiso: PermisoSistema.OFERTA_VER,
          activo: true,
        },
      ]);

      const res = await service.reemplazarPermisos(10, [
        PermisoSistema.OFERTA_VER,
      ]);

      expect(usuarioPermisoRepository.delete).toHaveBeenCalledWith({
        usuarioId: 10,
      });
      expect(usuarioPermisoRepository.save).toHaveBeenCalled();
      expect(res).toHaveLength(1);
    });
  });
});
