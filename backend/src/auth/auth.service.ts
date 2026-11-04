import {
  BadRequestException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { CambiarRolActivoDto } from './dto/cambiar-rol-activo.dto';
import { ConfigService } from '@nestjs/config';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { AceptarInvitacionDto } from './dto/aceptar-invitacion.dto';
import { MailService } from '../mail/mail.service';
import { RolSistema, ROLES_SISTEMA } from './constants/roles.constants';
import { PermisosService } from '../permisos/permisos.service';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly permisosService: PermisosService,
    @Optional() private readonly alcanceJerarquico?: AlcanceJerarquicoService,
    @Optional() private readonly configService?: ConfigService,
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
          ROLES_SISTEMA.includes(usuarioRol.rol.nombre as RolSistema),
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

    if (roles.includes(RolSistema.ASISTENTE_ESTUDIANTIL) &&
      (roles.includes(RolSistema.COORDINADOR) || roles.includes(RolSistema.ADMIN_GLOBAL))) {
      throw new UnauthorizedException('Combinación de roles jerárquicos no permitida.');
    }

    if (roles.includes(RolSistema.ASISTENTE_ESTUDIANTIL) && !this.alcanceJerarquico) {
      throw new UnauthorizedException('No se pudo verificar el alcance del asistente.');
    }

    const rolActivo = [RolSistema.PROFESOR, RolSistema.ASISTENTE_ESTUDIANTIL,
      RolSistema.COORDINADOR, RolSistema.ADMIN_GLOBAL]
      .find((rol) => roles.includes(rol));
    if (!rolActivo) throw new UnauthorizedException('Sin rol activo válido.');

    const permisos = await this.permisosService.obtenerPermisosEfectivos(
      usuario.id,
      roles,
      rolActivo,
    );
    const opcionesCarrera = rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL
      ? await this.alcanceJerarquico!.obtenerOpcionesCarrera(usuario.id) : [];
    const carreraActiva = opcionesCarrera.length === 1 ? opcionesCarrera[0].id : null;

    const versionAutenticacion = await this.usuariosService.rotarVersionAutenticacion(
      usuario.id, usuario.versionAutenticacion,
    );
    const payload = {
      sub: usuario.id,
      correo: usuario.correo,
      roles,
      rolActivo,
      carreraActiva,
      av: versionAutenticacion,
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
        rolActivo,
        permisos: rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL
          ? (opcionesCarrera.find((c) => c.id === carreraActiva)?.permisos ?? []) : permisos,
        carreraActiva,
        carrerasDisponibles: opcionesCarrera,
      },
    };
  }

  private hashCodigo(codigo: string): string {
    return createHash('sha256').update(codigo).digest('hex');
  }

  async solicitarRecuperacion(dto: SolicitarRecuperacionDto) {
    const correo = dto.correo.trim().toLowerCase();
    const usuario = await this.usuariosService.buscarPorCorreo(correo);
    const mensaje = {
      message:
        'Si el correo está registrado, recibirás un código de recuperación.',
    };

    if (!usuario || !usuario.activo) {
      return mensaje;
    }

    const codigo = randomInt(100000, 1000000).toString();
    const tokenHash = this.hashCodigo(codigo);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.usuariosService.guardarRecuperacionPassword(
      usuario.id,
      tokenHash,
      expiresAt,
    );

    await this.mailService.enviarCodigoRecuperacion(
      usuario.correo,
      usuario.nombres,
      codigo,
    );

    return mensaje;
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
      esperado.length === recibido.length &&
      timingSafeEqual(esperado, recibido);

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

  async aceptarInvitacion(dto: AceptarInvitacionDto) {
    return this.usuariosService.aceptarInvitacion(
      dto.correo,
      dto.token,
      dto.password,
    );
  }


  async cambiarRolActivo(usuarioId: number, dto: CambiarRolActivoDto, versionActual: number) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo o no encontrado');
    }

    const rolesVigentes = this.obtenerRolesValidos(usuario.usuarioRoles ?? []);

    if (!rolesVigentes.includes(dto.rol)) {
      throw new BadRequestException(
        'El usuario no posee el rol solicitado o no está vigente.',
      );
    }

    if (dto.rol === RolSistema.ASISTENTE_ESTUDIANTIL && !this.alcanceJerarquico) {
      throw new UnauthorizedException('No se pudo verificar el alcance del asistente.');
    }

    const permisos = await this.permisosService.obtenerPermisosEfectivos(
      usuario.id,
      rolesVigentes,
      dto.rol,
    );
    const opcionesCarrera = dto.rol === RolSistema.ASISTENTE_ESTUDIANTIL
      ? await this.alcanceJerarquico!.obtenerOpcionesCarrera(usuario.id) : [];
    const carreraActiva = opcionesCarrera.length === 1 ? opcionesCarrera[0].id : null;

    const versionAutenticacion = await this.usuariosService.rotarVersionAutenticacion(
      usuario.id, versionActual,
    );
    const payload = {
      sub: usuario.id,
      correo: usuario.correo,
      roles: rolesVigentes,
      rolActivo: dto.rol,
      carreraActiva,
      av: versionAutenticacion,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        apellido1: usuario.apellido1,
        apellido2: usuario.apellido2,
        correo: usuario.correo,
        roles: rolesVigentes,
        rolActivo: dto.rol,
        permisos: dto.rol === RolSistema.ASISTENTE_ESTUDIANTIL
          ? (opcionesCarrera.find((c) => c.id === carreraActiva)?.permisos ?? []) : permisos,
        carreraActiva,
        carrerasDisponibles: opcionesCarrera,
      },
    };
  }

  obtenerIdentidad() {
    const database =
      this.configService?.get<string>('DB_DATABASE') ||
      process.env.DB_DATABASE ||
      'sgpa';
    const entorno =
      this.configService?.get<string>('NODE_ENV') ||
      process.env.NODE_ENV ||
      'development';

    return {
      app: 'SGPA',
      database,
      entorno,
      modoAislado: database === 'sgpa_isolated_audit',
    };
  }

  async cambiarCarreraActiva(usuarioId: number, versionActual: number, carreraId: number) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);
    if (!usuario?.activo || !this.alcanceJerarquico) throw new UnauthorizedException('Usuario no válido.');
    const roles = this.obtenerRolesValidos(usuario.usuarioRoles ?? []);
    if (!roles.includes(RolSistema.ASISTENTE_ESTUDIANTIL)) throw new UnauthorizedException('Rol de asistente no vigente.');
    if (usuario.versionAutenticacion !== versionActual) throw new UnauthorizedException('Sesión reemplazada.');
    const carrerasDisponibles = await this.alcanceJerarquico.obtenerOpcionesCarrera(usuarioId);
    const seleccionada = carrerasDisponibles.find((c) => c.id === carreraId && c.permisos.length > 0);
    if (!seleccionada) throw new BadRequestException('Carrera no autorizada o sin permisos.');
    const accessToken = await this.jwtService.signAsync({ sub: usuario.id, correo: usuario.correo,
      roles, rolActivo: RolSistema.ASISTENTE_ESTUDIANTIL, av: versionActual, carreraActiva: carreraId });
    return { accessToken, usuario: {
      id: usuario.id, cedula: usuario.cedula, nombres: usuario.nombres, apellido1: usuario.apellido1,
      apellido2: usuario.apellido2, correo: usuario.correo, roles,
      rolActivo: RolSistema.ASISTENTE_ESTUDIANTIL, permisos: seleccionada.permisos,
      carreraActiva: carreraId, carrerasDisponibles,
    } };
  }

  async perfil(usuarioId: number, rolActivo?: RolSistema | string, carreraActiva?: number | null) {
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

    if (!rolActivo || !roles.includes(rolActivo as RolSistema)) {
      throw new UnauthorizedException('El rol activo ya no está vigente.');
    }

    const permisos = await this.permisosService.obtenerPermisosEfectivos(
      usuario.id,
      roles,
      rolActivo as RolSistema,
    );
    const carrerasDisponibles = rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL
      ? await this.alcanceJerarquico!.obtenerOpcionesCarrera(usuario.id) : [];
    const activa = carrerasDisponibles.find((c) => c.id === carreraActiva);

    return {
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      correo: usuario.correo,
      roles,
      rolActivo,
      permisos: rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL ? (activa?.permisos ?? []) : permisos,
      carreraActiva: activa?.id ?? null,
      carrerasDisponibles,
    };
  }
}
