import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ROLES_SISTEMA } from '../auth/constants/roles.constants';
import { Rol } from './entities/rol.entity';
import { PermisosService } from '../permisos/permisos.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    private readonly permisosService?: PermisosService,
  ) {}

  async listar(): Promise<Rol[]> {
    return this.rolRepository.find({
      where: {
        activo: true,
        nombre: In(ROLES_SISTEMA),
      },
      order: {
        id: 'ASC',
      },
    });
  }

  /**
   * Operación transaccional controlada para cambiar el estado de un rol (activar/desactivar)
   * y sincronizar inmediatamente la tabla legacy usuario_permisos de todos los usuarios
   * que lo poseen, evitando que una reversión de la Opción B reactive permisos residuales.
   */
  async cambiarEstado(id: number, activo: boolean): Promise<Rol> {
    const rol = await this.rolRepository.findOne({ where: { id } });
    if (!rol) {
      throw new NotFoundException('Rol no encontrado.');
    }

    if (this.dataSource && this.permisosService?.esPoliticaOpcionBActiva()) {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Rol);
        await repo.update(id, { activo });

        await this.permisosService?.sincronizarUsuariosPorRolEnTransaccion(
          manager,
          id,
        );
      });
    } else {
      await this.rolRepository.update(id, { activo });
    }

    return (await this.rolRepository.findOne({ where: { id } }))!;
  }
}
