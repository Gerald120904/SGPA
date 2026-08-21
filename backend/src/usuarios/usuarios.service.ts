import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

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

    return usuarios.map((usuario) => ({
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      correo: usuario.correo,
      activo: usuario.activo,
      ultimoAcceso: usuario.ultimoAcceso,
      roles: usuario.usuarioRoles
        .filter((relacion) => relacion.rol && relacion.rol.activo)
        .map((relacion) => relacion.rol.nombre),
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    }));
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
