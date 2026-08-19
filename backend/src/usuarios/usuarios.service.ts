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
