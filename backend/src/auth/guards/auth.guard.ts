import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DependenciaUsuario } from '../../usuarios/entities/dependencia-usuario.entity';
import { RolSistema } from '../constants/roles.constants';
import { establecerRolActivo } from '../active-role-context';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: number;
        correo: string;
        roles: string[];
        rolActivo?: string;
        av: number;
        iat?: number;
        exp?: number;
        jerarquiaConfigurada?: boolean;
      };
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @Optional()
    @InjectRepository(DependenciaUsuario)
    private readonly dependenciaRepository?: Repository<DependenciaUsuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    let payload: {
      sub?: unknown;
      correo?: string;
      roles?: string[];
      iat?: number;
      exp?: number;
      rolActivo?: RolSistema;
      av?: number;
    };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const sub = payload?.sub;
    if (typeof sub !== 'number' || !Number.isInteger(sub) || sub <= 0) {
      throw new UnauthorizedException(
        'Token con identificador de usuario inválido',
      );
    }

    if (!payload.rolActivo || !Number.isSafeInteger(payload.av) || (payload.av as number) < 1) {
      throw new UnauthorizedException('Token anterior al control de sesión. Inicie sesión nuevamente.');
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { id: sub },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
      select: {
        id: true,
        activo: true,
        versionAutenticacion: true,
        usuarioRoles: {
          usuarioId: true,
          rolId: true,
          rol: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario inexistente o no autorizado');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    if (usuario.versionAutenticacion !== payload.av) {
      throw new UnauthorizedException('Sesión reemplazada. Inicie sesión nuevamente.');
    }

    const rolesVigentes = (usuario.usuarioRoles ?? [])
      .filter((ur) => ur.rol && ur.rol.activo === true)
      .map((ur) => ur.rol.nombre);

    if (rolesVigentes.length === 0) {
      throw new UnauthorizedException('Usuario sin roles asignados o activos');
    }

    const rolActivoPayload = payload.rolActivo;
    if (!rolesVigentes.includes(rolActivoPayload)) {
      throw new UnauthorizedException(
        'El rol activo ya no está asignado o no está vigente.',
      );
    }

    const rolActivo = rolActivoPayload;

    let jerarquiaConfigurada = false;
    if (rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL) {
      if (rolesVigentes.includes(RolSistema.COORDINADOR) || rolesVigentes.includes(RolSistema.ADMIN_GLOBAL)) {
        throw new UnauthorizedException('Combinación de roles jerárquicos no permitida');
      }
      if (!this.dependenciaRepository && process.env.NODE_ENV !== 'test') {
        throw new UnauthorizedException('Dependencia del asistente no disponible');
      }
      if (this.dependenciaRepository) {
        const dependencia = await this.dependenciaRepository.findOne({ where: { asistenteId: sub, activo: true } });
        if (!dependencia) throw new UnauthorizedException('Asistente sin coordinador responsable activo');
        const responsable = await this.usuarioRepository.findOne({
          where: { id: dependencia.coordinadorId, activo: true },
          relations: { usuarioRoles: { rol: true } },
        });
        if (!responsable?.usuarioRoles?.some((ur) => ur.rol?.activo && ur.rol.nombre === RolSistema.COORDINADOR)) {
          throw new UnauthorizedException('Coordinador responsable inactivo');
        }
        jerarquiaConfigurada = true;
      }
    }

    if (rolActivo === RolSistema.COORDINADOR) {
      if (!this.dependenciaRepository && process.env.NODE_ENV !== 'test') {
        throw new UnauthorizedException('Alcance jerarquico no disponible');
      }
      // El rol entra al motor jerarquico incluso si se revocaron todas sus carreras.
      jerarquiaConfigurada = !!this.dependenciaRepository;
    }

    request['user'] = {
      ...payload,
      sub,
      roles: Array.from(new Set(rolesVigentes)),
      rolActivo,
      jerarquiaConfigurada,
    } as Express.Request['user'];

    establecerRolActivo(sub, rolActivo);

    return true;
  }

  private extraerToken(request: Request): string | undefined {
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' ? token : undefined;
  }
}
