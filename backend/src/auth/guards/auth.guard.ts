import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { Usuario } from '../../usuarios/entities/usuario.entity';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: number;
        correo: string;
        roles: string[];
        iat?: number;
        exp?: number;
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

    const rolesVigentes = (usuario.usuarioRoles ?? [])
      .filter((ur) => ur.rol && ur.rol.activo === true)
      .map((ur) => ur.rol.nombre);

    if (rolesVigentes.length === 0) {
      throw new UnauthorizedException('Usuario sin roles asignados o activos');
    }

    request['user'] = {
      ...payload,
      sub,
      roles: Array.from(new Set(rolesVigentes)),
    } as Express.Request['user'];

    return true;
  }

  private extraerToken(request: Request): string | undefined {
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' ? token : undefined;
  }
}
