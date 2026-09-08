import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  PermisoSistema,
  PERMISOS_SISTEMA,
} from './constants/permisos.constant';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';

@Injectable()
export class PermisosService {
  constructor(
    @InjectRepository(UsuarioPermiso)
    private readonly usuarioPermisoRepository: Repository<UsuarioPermiso>,

    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    private readonly dataSource: DataSource,
  ) {}

  obtenerCatalogo(): PermisoSistema[] {
    return PERMISOS_SISTEMA;
  }

  private async obtenerUsuario(usuarioId: number): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return usuario;
  }

  async usuarioTienePermisos(
    usuarioId: number,
    permisos: PermisoSistema[],
  ): Promise<boolean> {
    if (!permisos.length) {
      return true;
    }

    const relaciones = await this.usuarioPermisoRepository.find({
      where: {
        usuarioId,
        activo: true,
        permiso: In(permisos),
      },
    });

    const asignados = new Set(relaciones.map((item) => item.permiso));

    return permisos.every((permiso) => asignados.has(permiso));
  }

  async listarUsuario(usuarioId: number): Promise<UsuarioPermiso[]> {
    await this.obtenerUsuario(usuarioId);

    return this.usuarioPermisoRepository.find({
      where: {
        usuarioId,
        activo: true,
      },
      order: {
        permiso: 'ASC',
      },
    });
  }

  async reemplazarPermisos(
    usuarioId: number,
    permisos: PermisoSistema[],
  ): Promise<UsuarioPermiso[]> {
    await this.obtenerUsuario(usuarioId);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UsuarioPermiso);

      await repo.delete({ usuarioId });

      if (permisos.length > 0) {
        const entidades = permisos.map((permiso) =>
          repo.create({
            usuarioId,
            permiso,
            activo: true,
          }),
        );

        await repo.save(entidades);
      }

      return repo.find({
        where: {
          usuarioId,
          activo: true,
        },
        order: {
          permiso: 'ASC',
        },
      });
    });
  }
}
