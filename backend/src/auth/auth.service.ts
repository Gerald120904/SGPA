import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import {
  RolSistema,
  ROLES_SISTEMA,
} from './constants/roles.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  private obtenerRolesValidos(
    usuarioRoles: {
      rol: {
        nombre: string;
        activo: boolean;
      };
    }[],
  ): RolSistema[] {
    const roles = usuarioRoles
      .filter(
        (usuarioRol) =>
          usuarioRol.rol &&
          usuarioRol.rol.activo &&
          ROLES_SISTEMA.includes(
            usuarioRol.rol.nombre as RolSistema,
          ),
      )
      .map((usuarioRol) => usuarioRol.rol.nombre as RolSistema);

    return [...new Set(roles)];
  }

  async login(loginDto: LoginDto) {
    const correo = loginDto.correo.trim().toLowerCase();
    const usuario = await this.usuariosService.buscarPorCorreo(correo);

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordCorrecto = await bcrypt.compare(
      loginDto.password,
      usuario.passwordHash,
    );

    if (!passwordCorrecto) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const roles = this.obtenerRolesValidos(usuario.usuarioRoles);

    if (roles.length === 0) {
      throw new UnauthorizedException(
        'El usuario no posee acceso habilitado al SGPA.',
      );
    }

    const payload = {
      sub: usuario.id,
      correo: usuario.correo,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.usuariosService.actualizarUltimoAcceso(usuario.id);

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        apellido1: usuario.apellido1,
        apellido2: usuario.apellido2,
        correo: usuario.correo,
        roles,
      },
    };
  }

  private hashCodigo(codigo: string): string {
    return createHash('sha256').update(codigo).digest('hex');
  }

  async solicitarRecuperacion(dto: SolicitarRecuperacionDto) {
    const correo = dto.correo.trim().toLowerCase();
    const usuario = await this.usuariosService.buscarPorCorreo(correo);

    if (!usuario || !usuario.activo) {
      throw new BadRequestException('No existe un usuario activo con ese correo');
    }

    const codigo = randomInt(100000, 1000000).toString();
    const tokenHash = this.hashCodigo(codigo);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.usuariosService.guardarRecuperacionPassword(
      usuario.id,
      tokenHash,
      expiresAt,
    );

    return {
      message: 'Se generó un código de recuperación válido durante 15 minutos.',
      ...(process.env.NODE_ENV !== 'production'
        ? { codigoDesarrollo: codigo }
        : {}),
    };
  }

  async restablecerPassword(dto: RestablecerPasswordDto) {
    const correo = dto.correo.trim().toLowerCase();
    const usuario = await this.usuariosService.buscarPorCorreo(correo);
    const errorCodigo = new BadRequestException('Código inválido o expirado');

    if (
      !usuario ||
      !usuario.activo ||
      !usuario.passwordResetTokenHash ||
      !usuario.passwordResetExpiresAt
    ) {
      throw errorCodigo;
    }

    if (usuario.passwordResetExpiresAt.getTime() <= Date.now()) {
      await this.usuariosService.limpiarRecuperacionPassword(usuario.id);
      throw errorCodigo;
    }

    const hashRecibido = this.hashCodigo(dto.codigo);
    const esperado = Buffer.from(usuario.passwordResetTokenHash, 'hex');
    const recibido = Buffer.from(hashRecibido, 'hex');
    const codigoValido =
      esperado.length === recibido.length && timingSafeEqual(esperado, recibido);

    if (!codigoValido) {
      throw errorCodigo;
    }

    const nuevoPasswordHash = await bcrypt.hash(dto.password, 10);

    await this.usuariosService.actualizarPassword(
      usuario.id,
      nuevoPasswordHash,
    );

    return {
      message: 'La contraseña se actualizó correctamente.',
    };
  }

  async perfil(usuarioId: number) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const roles = this.obtenerRolesValidos(usuario.usuarioRoles);

    if (roles.length === 0) {
      throw new UnauthorizedException(
        'El usuario no posee acceso habilitado al SGPA.',
      );
    }

    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      correo: usuario.correo,
      roles,
    };
  }
}
