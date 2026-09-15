import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { Permisos } from '../../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { GoogleOauthService } from './google-oauth.service';

@Controller('integraciones/google/oauth')
export class GoogleOauthController {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  @Post('iniciar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_CREAR)
  async iniciar(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    return this.googleOauthService.generarUrlAutorizacion(usuarioId);
  }

  @Get('estado')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER)
  async obtenerEstado(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    return this.googleOauthService.obtenerEstado(usuarioId);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const html = await this.googleOauthService.procesarCallback(code, state);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Delete('desconectar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  async desconectar(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    await this.googleOauthService.desconectar(usuarioId);
    return { mensaje: 'Conexión con Google desvinculada exitosamente' };
  }
}
