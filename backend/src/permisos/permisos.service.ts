import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioRol } from '../usuarios/entities/usuario-rol.entity';
import { Rol } from '../roles/entities/rol.entity';
import {
  PermisoSistema,
  PERMISOS_SISTEMA,
} from './constants/permisos.constant';
import {
  PERMISOS_PREDETERMINADOS_POR_ROL,
} from './constants/plantillas-permisos.constant';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';
import { UsuarioPermisoExcepcion } from './entities/usuario-permiso-excepcion.entity';
import { PermisoCarrera } from './entities/permiso-carrera.entity';

@Injectable()
export class PermisosService {
  private politicaOpcionBActiva = false;

  constructor(
    @InjectRepository(UsuarioPermiso)
    private readonly usuarioPermisoRepository: Repository<UsuarioPermiso>,

    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    private readonly dataSource: DataSource,

    @Optional()
    @InjectRepository(UsuarioPermisoExcepcion)
    private readonly usuarioPermisoExcepcionRepository?: Repository<UsuarioPermisoExcepcion>,
    @Optional()
    @InjectRepository(PermisoCarrera)
    private readonly permisoCarreraRepository?: Repository<PermisoCarrera>,
  ) {}

  activarPoliticaOpcionB(activa = true): void {
    this.politicaOpcionBActiva = activa;
  }

  esPoliticaOpcionBActiva(): boolean {
    return (
      this.politicaOpcionBActiva ||
      process.env.SGPA_PERMISOS_OPCION_B_ENABLED === 'true'
    );
  }

  obtenerCatalogo(): PermisoSistema[] {
    return PERMISOS_SISTEMA;
  }

  obtenerPlantillasRoles(): Record<RolSistema, PermisoSistema[]> {
    return Object.fromEntries(
      Object.entries(PERMISOS_PREDETERMINADOS_POR_ROL).map(
        ([rol, permisos]) => [rol, [...permisos]],
      ),
    ) as Record<RolSistema, PermisoSistema[]>;
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

  async resolverPermisosEfectivosOpcionB(
    usuarioId: number,
    rolActivo?: RolSistema,
  ): Promise<Set<PermisoSistema>> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });

    if (!usuario || !usuario.activo) {
      return new Set();
    }

    const rolesActivos = (usuario.usuarioRoles || [])
      .filter((rel) => rel.rol && rel.rol.activo)
      .map((rel) => rel.rol.nombre as RolSistema);

    if (rolesActivos.length === 0) {
      return new Set();
    }

    const rolesEvaluar = rolActivo
      ? (rolesActivos.includes(rolActivo) ? [rolActivo] : [])
      : rolesActivos;
    if (rolesEvaluar.length === 0) return new Set();

    if (rolesEvaluar.includes(RolSistema.ADMIN_GLOBAL)) {
      return new Set(PERMISOS_SISTEMA);
    }

    if (this.permisoCarreraRepository && rolesEvaluar.some((rol) =>
      rol === RolSistema.COORDINADOR || rol === RolSistema.ASISTENTE_ESTUDIANTIL)) {
      const porCarrera = await this.permisoCarreraRepository.find({ where: { usuarioId, activo: true } });
      const efectivos = new Set<PermisoSistema>(porCarrera.map((p) => p.permiso));
      if (rolesEvaluar.includes(RolSistema.PROFESOR)) {
        for (const p of PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.PROFESOR]) efectivos.add(p);
      }
      return efectivos;
    }

    const base = new Set<PermisoSistema>();
    for (const rol of rolesEvaluar) {
      const plantilla = PERMISOS_PREDETERMINADOS_POR_ROL[rol] || [];
      for (const p of plantilla) {
        base.add(p);
      }
    }

    if (!this.usuarioPermisoExcepcionRepository) {
      throw new InternalServerErrorException(
        'La política Opción B no puede consultar las excepciones de permisos.',
      );
    }
    const excepciones = await this.usuarioPermisoExcepcionRepository.find({
      where: { usuarioId },
    });

    const denegados = new Set<PermisoSistema>();
    const concedidos = new Set<PermisoSistema>();

    for (const exc of excepciones) {
      if (exc.tipo === 'DENEGAR') {
        denegados.add(exc.permiso);
      } else if (exc.tipo === 'CONCEDER') {
        concedidos.add(exc.permiso);
      }
    }

    const efectivos = new Set<PermisoSistema>();
    for (const p of base) {
      if (!denegados.has(p)) {
        efectivos.add(p);
      }
    }
    for (const p of concedidos) {
      if (!denegados.has(p)) {
        efectivos.add(p);
      }
    }

    return efectivos;
  }

  async usuarioTienePermisos(
    usuarioId: number,
    permisos: PermisoSistema[],
    rolActivo?: RolSistema,
  ): Promise<boolean> {
    if (!permisos.length) {
      return true;
    }

    if (this.esPoliticaOpcionBActiva() || rolActivo) {
      const efectivos = await this.resolverPermisosEfectivosOpcionB(usuarioId, rolActivo);
      return permisos.every((permiso) => efectivos.has(permiso));
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

  async listarCodigosUsuario(usuarioId: number): Promise<PermisoSistema[]> {
    const relaciones = await this.listarUsuario(usuarioId);

    return relaciones.map((item) => item.permiso);
  }

  async obtenerPermisosEfectivos(
    usuarioId: number,
    roles: RolSistema[],
    rolActivo?: RolSistema,
  ): Promise<PermisoSistema[]> {
    const rolesEvaluar = rolActivo ? (roles.includes(rolActivo) ? [rolActivo] : []) : roles;
    if (rolesEvaluar.includes(RolSistema.ADMIN_GLOBAL)) {
      return [...PERMISOS_SISTEMA];
    }

    if (this.esPoliticaOpcionBActiva() || rolActivo) {
      const efectivos = await this.resolverPermisosEfectivosOpcionB(usuarioId, rolActivo);
      return Array.from(efectivos).sort();
    }

    return this.listarCodigosUsuario(usuarioId);
  }

  /**
   * Sincroniza la tabla legacy usuario_permisos dentro de una transacción activa
   * para garantizar reversión en caliente con cero pérdida de datos.
   */
  async sincronizarDobleEscritura(
    manager: EntityManager,
    usuarioId: number,
    permisosEfectivos: Set<PermisoSistema>,
  ): Promise<void> {
    const repoLegacy = manager.getRepository(UsuarioPermiso);
    await repoLegacy.delete({ usuarioId });

    if (permisosEfectivos.size > 0) {
      const entidades = Array.from(permisosEfectivos).map((permiso) =>
        repoLegacy.create({
          usuarioId,
          permiso,
          activo: true,
        }),
      );
      await repoLegacy.save(entidades);
    }
  }

  /**
   * Resuelve y sincroniza en caliente los permisos efectivos de un usuario
   * dentro de una transacción en curso (asignarRol, revocarRol, etc.).
   */
  async sincronizarPermisosUsuarioEnTransaccion(
    manager: EntityManager,
    usuarioId: number,
  ): Promise<Set<PermisoSistema>> {
    const usuarioRolRepo = manager.getRepository(UsuarioRol);
    const relacionesRoles = await usuarioRolRepo.find({
      where: { usuarioId },
      relations: { rol: true },
    });

    const rolRepo = manager.getRepository(Rol);
    const rolesActivos: RolSistema[] = [];

    for (const rel of relacionesRoles) {
      const rolEntidad =
        rel.rol ?? (await rolRepo.findOne({ where: { id: rel.rolId } }));
      if (rolEntidad && rolEntidad.activo) {
        rolesActivos.push(rolEntidad.nombre as RolSistema);
      }
    }

    let efectivos: Set<PermisoSistema>;

    if (rolesActivos.length === 0) {
      efectivos = new Set();
    } else if (rolesActivos.includes(RolSistema.ADMIN_GLOBAL)) {
      efectivos = new Set(PERMISOS_SISTEMA);
    } else if (this.permisoCarreraRepository && rolesActivos.some((rol) =>
      rol === RolSistema.COORDINADOR || rol === RolSistema.ASISTENTE_ESTUDIANTIL)) {
      const porCarrera = await manager.getRepository(PermisoCarrera).find({ where: { usuarioId, activo: true } });
      efectivos = new Set<PermisoSistema>(porCarrera.map((p) => p.permiso));
      if (rolesActivos.includes(RolSistema.PROFESOR)) {
        for (const p of PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.PROFESOR]) efectivos.add(p);
      }
    } else {
      const base = new Set<PermisoSistema>();
      for (const rol of rolesActivos) {
        for (const p of PERMISOS_PREDETERMINADOS_POR_ROL[rol] || []) {
          base.add(p);
        }
      }

      const repoExc = manager.getRepository(UsuarioPermisoExcepcion);
      const excepciones = await repoExc.find({ where: { usuarioId } });

      const denegados = new Set<PermisoSistema>();
      const concedidos = new Set<PermisoSistema>();

      for (const exc of excepciones) {
        if (exc.tipo === 'DENEGAR') {
          denegados.add(exc.permiso);
        } else if (exc.tipo === 'CONCEDER') {
          concedidos.add(exc.permiso);
        }
      }

      efectivos = new Set<PermisoSistema>();
      for (const p of base) {
        if (!denegados.has(p)) efectivos.add(p);
      }
      for (const p of concedidos) {
        if (!denegados.has(p)) efectivos.add(p);
      }
    }

    await this.sincronizarDobleEscritura(manager, usuarioId, efectivos);
    return efectivos;
  }

  /**
   * Sincroniza en caliente la tabla legacy usuario_permisos para todos los usuarios
   * que posean un rol cuando dicho rol cambie de estado (ej. rol desactivado globalmente).
   * Esto previene que una reversión de la Opción B reactive permisos residuales indebidos.
   */
  async sincronizarUsuariosPorRolEnTransaccion(
    manager: EntityManager,
    rolId: number,
  ): Promise<void> {
    const usuarioRolRepo = manager.getRepository(UsuarioRol);
    const relaciones = await usuarioRolRepo.find({
      where: { rolId },
    });

    for (const rel of relaciones) {
      await this.sincronizarPermisosUsuarioEnTransaccion(manager, rel.usuarioId);
    }
  }

  async reemplazarPermisos(
    usuarioId: number,
    permisos: PermisoSistema[],
    asignadoPorUsuarioId?: number,
  ): Promise<UsuarioPermiso[]> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const rolesActivos = (usuario.usuarioRoles || [])
      .filter((rel) => rel.rol && rel.rol.activo)
      .map((rel) => rel.rol.nombre as RolSistema);

    if (this.permisoCarreraRepository &&
      rolesActivos.some((rol) => rol === RolSistema.COORDINADOR || rol === RolSistema.ASISTENTE_ESTUDIANTIL)) {
      throw new ConflictException('Los permisos jerárquicos deben configurarse por carrera.');
    }

    return this.dataSource.transaction(async (manager) => {
      const repoLegacy = manager.getRepository(UsuarioPermiso);

      // 1. Si la tabla de excepciones existe o se opera con el modelo nuevo, calcular excepciones
      const repoExcepciones = manager.getRepository(UsuarioPermisoExcepcion);

      if (repoExcepciones) {
        // Calcular plantilla de roles activos
        const basePlantilla = new Set<PermisoSistema>();
        for (const rol of rolesActivos) {
          for (const p of PERMISOS_PREDETERMINADOS_POR_ROL[rol] || []) {
            basePlantilla.add(p);
          }
        }

        const deseados = new Set(permisos);
        const excepcionesPorCrear: UsuarioPermisoExcepcion[] = [];

        // Permisos de plantilla no deseados -> DENEGAR
        for (const p of basePlantilla) {
          if (!deseados.has(p)) {
            excepcionesPorCrear.push(
              repoExcepciones.create({
                usuarioId,
                permiso: p,
                tipo: 'DENEGAR',
                motivo: 'Exclusión manual en administración de permisos',
                asignadoPorUsuarioId: asignadoPorUsuarioId ?? null,
              }),
            );
          }
        }

        // Permisos deseados fuera de plantilla -> CONCEDER
        for (const p of deseados) {
          if (!basePlantilla.has(p)) {
            excepcionesPorCrear.push(
              repoExcepciones.create({
                usuarioId,
                permiso: p,
                tipo: 'CONCEDER',
                motivo: 'Concesión manual en administración de permisos',
                asignadoPorUsuarioId: asignadoPorUsuarioId ?? null,
              }),
            );
          }
        }

        await repoExcepciones.delete({ usuarioId });
        if (excepcionesPorCrear.length > 0) {
          await repoExcepciones.save(excepcionesPorCrear);
        }
      }

      // 2. Doble Escritura Sincronizada: Reflejar en caliente en usuario_permisos
      await repoLegacy.delete({ usuarioId });

      if (permisos.length > 0) {
        const entidades = permisos.map((permiso) =>
          repoLegacy.create({
            usuarioId,
            permiso,
            activo: true,
          }),
        );
        await repoLegacy.save(entidades);
      }

      return repoLegacy.find({
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
