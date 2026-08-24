import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepository: Repository<UsuarioRol>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly dataSource: DataSource,
  ) {}

  private serializarUsuario(usuario: Usuario) {
    const roles = (usuario.usuarioRoles ?? [])
      .filter((relacion) => relacion.rol?.activo)
      .map((relacion) => ({
        id: relacion.rol.id,
        nombre: relacion.rol.nombre,
        descripcion: relacion.rol.descripcion,
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
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
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
    const codigo = (
      error as {
        code?: string;
        driverError?: {
          code?: string;
        };
      }
    )?.driverError?.code ??
      (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'La cédula, el correo o la relación de rol ya está registrada.',
      );
    }

    throw error;
  }

  async listar() {
    const usuarios = await this.usuarioRepository.find({
      select: {
        id: true,
        cedula: true,
        nombres: true,
        apellido1: true,
        apellido2: true,
        correo: true,
        activo: true,
        ultimoAcceso: true,
        createdAt: true,
        updatedAt: true,
        usuarioRoles: {
          usuarioId: true,
          rolId: true,
          createdAt: true,
          rol: {
            id: true,
            nombre: true,
            descripcion: true,
            activo: true,
            createdAt: true,
          },
        },
      },
      relations: {
        usuarioRoles: {
          rol: true,
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
    const cedula = dto.cedula.trim();
    const correo = dto.correo.trim().toLowerCase();

    await this.validarDuplicados(cedula, correo);

    let usuarioId: number;

    try {
      usuarioId = await this.dataSource.transaction(async (manager) => {
        const usuarios = manager.getRepository(Usuario);
        const relaciones = manager.getRepository(UsuarioRol);
        const rolesRepository = manager.getRepository(Rol);

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
          nombres: dto.nombres.trim(),
          apellido1: dto.apellido1.trim(),
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

        return guardado.id;
      });
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerPorId(usuarioId);
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto) {
    await this.obtenerEntidadPorId(id);

    const cedula = dto.cedula?.trim();
    const correo = dto.correo?.trim().toLowerCase();

    await this.validarDuplicados(cedula, correo, id);

    const cambios: Partial<Usuario> = {};

    if (cedula !== undefined) cambios.cedula = cedula;
    if (dto.nombres !== undefined) cambios.nombres = dto.nombres.trim();
    if (dto.apellido1 !== undefined) cambios.apellido1 = dto.apellido1.trim();
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

    return this.obtenerPorId(id);
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    usuarioActualId: number,
  ) {
    await this.obtenerEntidadPorId(id);

    if (id === usuarioActualId && !activo) {
      throw new BadRequestException(
        'No puede desactivar su propia cuenta.',
      );
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
      await this.usuarioRolRepository.save(
        this.usuarioRolRepository.create({
          usuarioId: id,
          rolId: rol.id,
        }),
      );
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }

    return this.obtenerPorId(id);
  }

  async revocarRol(
    id: number,
    rolId: number,
    usuarioActualId: number,
  ) {
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

    await this.usuarioRolRepository.delete({
      usuarioId: id,
      rolId,
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
