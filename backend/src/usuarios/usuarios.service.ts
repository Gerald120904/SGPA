import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Rol } from '../roles/entities/rol.entity';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { UsuarioPermisoExcepcion } from '../permisos/entities/usuario-permiso-excepcion.entity';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import {
  obtenerPermisosPredeterminadosPorRoles,
  PERMISOS_PREDETERMINADOS_POR_ROL,
} from '../permisos/constants/plantillas-permisos.constant';
import { PermisosService } from '../permisos/permisos.service';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Carrera } from '../carreras/entities/carrera.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepository: Repository<UsuarioRol>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectRepository(ProfesorCarrera)
    private readonly profesorCarreraRepository: Repository<ProfesorCarrera>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly permisosService?: PermisosService,
  ) {}

  private normalizarCampoRequerido(valor: string, etiqueta: string): string {
    const normalizado = valor.trim();

    if (!normalizado) {
      throw new BadRequestException(
        `El campo ${etiqueta} no puede estar vacío.`,
      );
    }

    return normalizado;
  }

  private serializarUsuario(usuario: Usuario) {
    const roles = (usuario.usuarioRoles ?? [])
      .filter((relacion) => relacion.rol?.activo)
      .map((relacion) => ({
        id: relacion.rol.id,
        nombre: relacion.rol.nombre,
        descripcion: relacion.rol.descripcion,
      }))
      .sort((a, b) => a.id - b.id);

    const carreras = (usuario.profesorCarreras ?? [])
      .filter((relacion) => relacion.carrera?.activo !== false)
      .map((relacion) => ({
        id: relacion.carrera?.id ?? relacion.carreraId,
        codigo: relacion.carrera?.codigo,
        nombre: relacion.carrera?.nombre,
      }))
      .sort((a, b) => a.id - b.id);

    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      correo: usuario.correo,
      activo: usuario.activo,
      ultimoAcceso: usuario.ultimoAcceso,
      roles,
      carreras,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }

  private usuarioTieneRol(usuario: Usuario, rol: RolSistema): boolean {
    return (usuario.usuarioRoles ?? []).some(
      (relacion) =>
        relacion.rol?.activo === true && relacion.rol.nombre === rol,
    );
  }

  private async obtenerEntidadPorId(id: number): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return usuario;
  }

  private async validarDuplicados(
    cedula?: string,
    correo?: string,
    excluirId?: number,
  ): Promise<void> {
    if (cedula) {
      const existente = await this.usuarioRepository.findOne({
        where: { cedula },
      });

      if (existente && existente.id !== excluirId) {
        throw new ConflictException('La cédula ya está registrada.');
      }
    }

    if (correo) {
      const existente = await this.usuarioRepository.findOne({
        where: { correo },
      });

      if (existente && existente.id !== excluirId) {
        throw new ConflictException('El correo ya está registrado.');
      }
    }
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          code?: string;
          driverError?: {
            code?: string;
          };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'La cédula, el correo o la relación de rol ya está registrada.',
      );
    }

    throw error;
  }

  async listar() {
    const usuarios = await this.usuarioRepository.find({
      relations: {
        usuarioRoles: {
          rol: true,
        },
        profesorCarreras: {
          carrera: true,
        },
      },
      order: {
        nombres: 'ASC',
        apellido1: 'ASC',
      },
    });

    return usuarios.map((usuario) => this.serializarUsuario(usuario));
  }

  async obtenerPorId(id: number) {
    const usuario = await this.obtenerEntidadPorId(id);
    return this.serializarUsuario(usuario);
  }

  async crear(dto: CrearUsuarioDto) {
    const cedula = this.normalizarCampoRequerido(dto.cedula, 'cédula');
    const nombres = this.normalizarCampoRequerido(dto.nombres, 'nombre');
    const apellido1 = this.normalizarCampoRequerido(
      dto.apellido1,
      'primer apellido',
    );
    const correo = dto.correo.trim().toLowerCase();

    await this.validarDuplicados(cedula, correo);

    if (dto.carreraIds?.length && !dto.roles.includes(RolSistema.PROFESOR)) {
      throw new BadRequestException(
        'Solo un usuario con rol PROFESOR puede tener carreras docentes asociadas.',
      );
    }

    const permisosFinales = dto.roles.includes(RolSistema.ADMIN_GLOBAL)
      ? []
      : (dto.permisos ?? obtenerPermisosPredeterminadosPorRoles(dto.roles));

    let carrerasValidadas: Carrera[] = [];
    if (dto.carreraIds && dto.carreraIds.length > 0) {
      carrerasValidadas = await this.carreraRepository.find({
        where: {
          id: In(dto.carreraIds),
          activo: true,
        },
      });

      if (carrerasValidadas.length !== new Set(dto.carreraIds).size) {
        throw new BadRequestException(
          'Una o más carreras no existen o están inactivas.',
        );
      }
    }

    let usuarioId: number;

    try {
      usuarioId = await this.dataSource.transaction(async (manager) => {
        const usuarios = manager.getRepository(Usuario);
        const relaciones = manager.getRepository(UsuarioRol);
        const rolesRepository = manager.getRepository(Rol);
        const permisosRepository = manager.getRepository(UsuarioPermiso);
        const profesorCarrerasRepository =
          manager.getRepository(ProfesorCarrera);

        const roles = await rolesRepository.find({
          where: {
            nombre: In(dto.roles),
            activo: true,
          },
        });

        if (roles.length !== new Set(dto.roles).size) {
          throw new BadRequestException(
            'Uno o más roles no existen o están inactivos.',
          );
        }

        const usuario = usuarios.create({
          cedula,
          nombres,
          apellido1,
          apellido2: dto.apellido2?.trim() || null,
          correo,
          passwordHash: await bcrypt.hash(dto.password, 10),
          activo: true,
          ultimoAcceso: null,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        });

        const guardado = await usuarios.save(usuario);

        await relaciones.save(
          roles.map((rol) =>
            relaciones.create({
              usuarioId: guardado.id,
              rolId: rol.id,
            }),
          ),
        );

        if (this.permisosService?.esPoliticaOpcionBActiva()) {
          if (dto.permisos && !dto.roles.includes(RolSistema.ADMIN_GLOBAL)) {
            const basePlantilla = new Set<PermisoSistema>();
            for (const r of roles) {
              for (
                const p of PERMISOS_PREDETERMINADOS_POR_ROL[
                  r.nombre as RolSistema
                ] || []
              ) {
                basePlantilla.add(p);
              }
            }
            const deseados = new Set(dto.permisos);
            const excepcionesPorCrear: UsuarioPermisoExcepcion[] = [];
            let repoExc: Repository<UsuarioPermisoExcepcion> | null = null;
            try {
              repoExc = manager.getRepository(UsuarioPermisoExcepcion);
            } catch {
              repoExc = null;
            }

            if (repoExc) {
              for (const p of basePlantilla) {
                if (!deseados.has(p)) {
                  excepcionesPorCrear.push(
                    repoExc.create({
                      usuarioId: guardado.id,
                      permiso: p,
                      tipo: 'DENEGAR',
                      motivo: 'Exclusión inicial al crear usuario',
                      asignadoPorUsuarioId: null,
                    }),
                  );
                }
              }
              for (const p of deseados) {
                if (!basePlantilla.has(p)) {
                  excepcionesPorCrear.push(
                    repoExc.create({
                      usuarioId: guardado.id,
                      permiso: p,
                      tipo: 'CONCEDER',
                      motivo: 'Concesión inicial al crear usuario',
                      asignadoPorUsuarioId: null,
                    }),
                  );
                }
              }
              if (excepcionesPorCrear.length > 0) {
                await repoExc.save(excepcionesPorCrear);
              }
            }
          }
          await this.permisosService?.sincronizarDobleEscritura(
            manager,
            guardado.id,
            new Set(permisosFinales),
          );
        } else {
          if (permisosFinales.length > 0) {
            await permisosRepository.save(
              permisosFinales.map((permiso) =>
                permisosRepository.create({
                  usuarioId: guardado.id,
                  permiso,
                  activo: true,
                }),
              ),
            );
          }
        }

        if (carrerasValidadas.length > 0) {
          await profesorCarrerasRepository.save(
            carrerasValidadas.map((carrera) =>
              profesorCarrerasRepository.create({
                profesorUsuarioId: guardado.id,
                carreraId: carrera.id,
              }),
            ),
          );
        }

        return guardado.id;
      });
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerPorId(usuarioId);
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto) {
    const usuarioActual = await this.obtenerEntidadPorId(id);

    const cedula =
      dto.cedula === undefined
        ? undefined
        : this.normalizarCampoRequerido(dto.cedula, 'cédula');
    const nombres =
      dto.nombres === undefined
        ? undefined
        : this.normalizarCampoRequerido(dto.nombres, 'nombre');
    const apellido1 =
      dto.apellido1 === undefined
        ? undefined
        : this.normalizarCampoRequerido(
            dto.apellido1,
            'primer apellido',
          );
    const correo = dto.correo?.trim().toLowerCase();

    await this.validarDuplicados(cedula, correo, id);

    const cambios: Partial<Usuario> = {};

    if (cedula !== undefined) cambios.cedula = cedula;
    if (nombres !== undefined) cambios.nombres = nombres;
    if (apellido1 !== undefined) cambios.apellido1 = apellido1;
    if (dto.apellido2 !== undefined) {
      cambios.apellido2 = dto.apellido2?.trim() || null;
    }
    if (correo !== undefined) cambios.correo = correo;

    if (Object.keys(cambios).length > 0) {
      try {
        await this.usuarioRepository.update(id, cambios);
      } catch (error) {
        this.relanzarErrorPersistencia(error);
      }
    }

    if (
      dto.carreraIds !== undefined &&
      dto.carreraIds.length > 0 &&
      !this.usuarioTieneRol(usuarioActual, RolSistema.PROFESOR)
    ) {
      throw new BadRequestException(
        'Solo un usuario con rol PROFESOR puede tener carreras docentes asociadas.',
      );
    }

    if (dto.carreraIds !== undefined) {
      let carrerasValidadas: Carrera[] = [];
      if (dto.carreraIds.length > 0) {
        carrerasValidadas = await this.carreraRepository.find({
          where: {
            id: In(dto.carreraIds),
            activo: true,
          },
        });

        if (carrerasValidadas.length !== new Set(dto.carreraIds).size) {
          throw new BadRequestException(
            'Una o más carreras no existen o están inactivas.',
          );
        }
      }

      await this.dataSource.transaction(async (manager) => {
        const profesorCarrerasRepository =
          manager.getRepository(ProfesorCarrera);
        await profesorCarrerasRepository.delete({ profesorUsuarioId: id });

        if (carrerasValidadas.length > 0) {
          await profesorCarrerasRepository.save(
            carrerasValidadas.map((carrera) =>
              profesorCarrerasRepository.create({
                profesorUsuarioId: id,
                carreraId: carrera.id,
              }),
            ),
          );
        }
      });
    }

    return this.obtenerPorId(id);
  }

  async cambiarEstado(id: number, activo: boolean, usuarioActualId: number) {
    await this.obtenerEntidadPorId(id);

    if (id === usuarioActualId && !activo) {
      throw new BadRequestException('No puede desactivar su propia cuenta.');
    }

    await this.usuarioRepository.update(id, { activo });
    return this.obtenerPorId(id);
  }

  async asignarRol(id: number, nombreRol: RolSistema) {
    await this.obtenerEntidadPorId(id);

    const rol = await this.rolRepository.findOne({
      where: {
        nombre: nombreRol,
        activo: true,
      },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado o inactivo.');
    }

    const existente = await this.usuarioRolRepository.findOne({
      where: {
        usuarioId: id,
        rolId: rol.id,
      },
    });

    if (existente) {
      throw new ConflictException('El usuario ya posee este rol.');
    }

    try {
      if (this.permisosService?.esPoliticaOpcionBActiva()) {
        await this.dataSource.transaction(async (manager) => {
          const usuarioRolRepo = manager.getRepository(UsuarioRol);
          await usuarioRolRepo.save(
            usuarioRolRepo.create({
              usuarioId: id,
              rolId: rol.id,
            }),
          );

          await this.permisosService?.sincronizarPermisosUsuarioEnTransaccion(
            manager,
            id,
          );
        });
      } else {
        await this.usuarioRolRepository.save(
          this.usuarioRolRepository.create({
            usuarioId: id,
            rolId: rol.id,
          }),
        );
      }
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerPorId(id);
  }

  async revocarRol(id: number, rolId: number, usuarioActualId: number) {
    await this.obtenerEntidadPorId(id);

    const relacion = await this.usuarioRolRepository.findOne({
      where: {
        usuarioId: id,
        rolId,
      },
      relations: {
        rol: true,
      },
    });

    if (!relacion) {
      throw new NotFoundException('El usuario no posee este rol.');
    }

    if (
      id === usuarioActualId &&
      relacion.rol.nombre === RolSistema.ADMIN_GLOBAL
    ) {
      throw new BadRequestException(
        'No puede revocar su propio rol de administrador global.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const relaciones = manager.getRepository(UsuarioRol);
      const profesorCarreras = manager.getRepository(ProfesorCarrera);

      await relaciones.delete({
        usuarioId: id,
        rolId,
      });

      if (relacion.rol.nombre === RolSistema.PROFESOR) {
        await profesorCarreras.delete({
          profesorUsuarioId: id,
        });
      }

      if (this.permisosService?.esPoliticaOpcionBActiva()) {
        await this.permisosService?.sincronizarPermisosUsuarioEnTransaccion(
          manager,
          id,
        );
      }
    });

    return this.obtenerPorId(id);
  }

  async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { correo },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { id },
      relations: {
        usuarioRoles: {
          rol: true,
        },
        profesorCarreras: {
          carrera: true,
        },
      },
    });
  }

  async actualizarUltimoAcceso(id: number): Promise<void> {
    await this.usuarioRepository.update(id, {
      ultimoAcceso: new Date(),
    });
  }

  async guardarRecuperacionPassword(
    id: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    });
  }

  async actualizarPassword(id: number, passwordHash: string): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
  }

  async limpiarRecuperacionPassword(id: number): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
  }
}
