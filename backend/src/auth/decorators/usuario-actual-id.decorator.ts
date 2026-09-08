import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export const UsuarioActualId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest<Request>();

    const usuarioId = (request as unknown as { user?: { sub?: unknown } })?.user
      ?.sub;

    if (!Number.isInteger(usuarioId) || Number(usuarioId) <= 0) {
      throw new UnauthorizedException('Usuario autenticado no válido.');
    }

    return Number(usuarioId);
  },
);
