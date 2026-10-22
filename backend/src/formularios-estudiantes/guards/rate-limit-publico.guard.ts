import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isIP } from 'node:net';

interface RegistroRateLimit {
  conteo: number;
  expiraEn: number;
}

@Injectable()
export class RateLimitPublicoGuard implements CanActivate {
  private readonly ventanaMs = 60_000; // 1 minuto
  private readonly limiteGet = 60; // 60 lecturas por minuto
  private readonly limitePost = 10; // 10 envíos por minuto
  private readonly almacenamiento = new Map<string, RegistroRateLimit>();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const ip = this.extraerIpCliente(req);
    const metodo = req.method.toUpperCase();
    const limite = metodo === 'GET' ? this.limiteGet : this.limitePost;
    const clave = `${metodo}:${ip}`;
    const ahora = Date.now();

    this.limpiarExpirados(ahora);

    const actual = this.almacenamiento.get(clave);

    if (!actual || actual.expiraEn <= ahora) {
      this.almacenamiento.set(clave, {
        conteo: 1,
        expiraEn: ahora + this.ventanaMs,
      });
      return true;
    }

    if (actual.conteo >= limite) {
      const segundosRestantes = Math.ceil((actual.expiraEn - ahora) / 1000);
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(segundosRestantes));
      }
      throw new HttpException(
        'Demasiadas solicitudes realizadas. Por favor espere antes de continuar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    actual.conteo += 1;
    return true;
  }

  /** Solo la conexión TCP identifica al cliente. Un proxy requiere configuración
   * explícita de confianza y límites compartidos antes de desplegar varias instancias. */
  extraerIpCliente(req: Request): string {
    const direccion = req.socket?.remoteAddress;
    return direccion && isIP(direccion) ? direccion : 'desconocida';
  }

  private limpiarExpirados(ahora: number): void {
    if (this.almacenamiento.size > 10_000) {
      for (const [clave, reg] of this.almacenamiento.entries()) {
        if (reg.expiraEn <= ahora) {
          this.almacenamiento.delete(clave);
        }
      }
    }
  }

  /**
   * Método de soporte para reiniciar contadores en pruebas unitarias.
   */
  reset(): void {
    this.almacenamiento.clear();
  }
}
