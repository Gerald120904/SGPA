import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { RateLimitPublicoGuard } from './guards/rate-limit-publico.guard';
import { generarHtmlFormularioPublico } from './web/formulario-web.template';

/**
 * Controlador web que sirve la interfaz pública HTML5 del formulario para estudiantes.
 * Accesible sin autenticación administrativa ni dependencias de Electron.
 * Servido en el mismo origen para evitar problemas de CORS y con encabezados de seguridad estrictos (CSP, X-Frame-Options, nosniff).
 */
@Controller('formularios')
@UseGuards(RateLimitPublicoGuard)
export class FormulariosPublicosWebController {
  @Get('p/:token')
  mostrarFormularioPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const esValido = Boolean(
      token &&
        token.length === 64 &&
        /^[0-9a-fA-F]{64}$/.test(token),
    );
    const html = generarHtmlFormularioPublico(token || '');
    const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
    const scriptSrc = script
      ? `'sha256-${createHash('sha256').update(script).digest('base64')}'`
      : "'none'";

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`,
    );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    if (!esValido) {
      res.status(HttpStatus.BAD_REQUEST);
      return res.type('html').send(html);
    }

    res.status(HttpStatus.OK);
    return res.type('html').send(html);
  }
}
