import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

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

    const roles = usuario.usuarioRoles
      .filter((usuarioRol) => usuarioRol.rol && usuarioRol.rol.activo)
      .map((usuarioRol) => usuarioRol.rol.nombre);

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

  async perfil(usuarioId: number) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const roles = usuario.usuarioRoles
      .filter((usuarioRol) => usuarioRol.rol && usuarioRol.rol.activo)
      .map((usuarioRol) => usuarioRol.rol.nombre);

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
